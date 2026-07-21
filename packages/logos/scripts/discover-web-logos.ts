import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import sharp from "sharp";
import {
  communityCandidates,
  foreignAuthorizedInstitutions,
  institutions,
  type Institution
} from "../../institutions/src";
import { logoCatalog } from "../src/catalog";
import { institutionLogoLinks } from "../src/institution-links";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcingRoot = join(packageRoot, "sourcing");
const candidatesRoot = join(sourcingRoot, "web-candidates");
const cachePath = join(sourcingRoot, "web-discovery-cache.json");
const reportPath = join(sourcingRoot, "web-discovery-report.json");
const discoveryVersion = 2;
const options = parseOptions(process.argv.slice(2));
const userAgent = "Mozilla/5.0 (compatible; Awalogo/0.1; +https://awalogo.com/)";

const blockedHosts = [
  "facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "youtube.com",
  "tiktok.com", "wikipedia.org", "crunchbase.com", "b2bhint.com", "ng-check.com",
  "google.com", "bing.com", "duckduckgo.com", "yahoo.com", "pinterest.com", "behance.net",
  "dribbble.com", "play.google.com", "apps.apple.com", "nigerialogos.com", "logowik.com",
  "seeklogo.com", "brandfetch.com", "companieshouse.gov.uk", "signalhire.com", "zoominfo.com",
  "manpower.com.ng", "nigeriacommunicationsweek.com.ng", "techcabal.com", "technext24.com",
  "businessday.ng", "guardian.ng", "punchng.com", "vanguardngr.com", "thisdaylive.com"
];
const genericWords = new Set([
  "company", "global", "international", "limited", "ltd", "nigeria", "nigerian",
  "payment", "payments", "plc", "service", "services", "solution", "solutions",
  "technologies", "technology"
]);
const searchGenericWords = new Set([
  ...genericWords, "and", "assurance", "bank", "brokers", "capital", "finance", "financial",
  "general", "group", "holdings", "insurance", "investment", "microfinance"
]);

type SearchResult = { url: string; title: string; snippet: string; score: number };
type SiteCandidate = {
  url: string;
  source_url: string;
  format: "svg" | "png" | "webp" | "jpeg" | "avif";
  descriptor: string;
  confidence: "high" | "medium";
  local_path?: string;
  sha256?: string;
  width?: number | null;
  height?: number | null;
  error?: string;
};
type CacheEntry = {
  discovery_version: number;
  searched_at: string;
  query: string;
  website: string | null;
  website_score: number;
  website_evidence: "catalog" | "search" | "none";
  search_results: SearchResult[];
  page_title?: string;
  identity_score?: number;
  candidate_assets: SiteCandidate[];
  error?: string;
};
type Cache = Record<string, CacheEntry>;
type PendingCard = {
  slug: string;
  display_name: string;
  institutions: Institution[];
};

await mkdir(candidatesRoot, { recursive: true });
const cache = await readJson<Cache>(cachePath, {});
const pendingCards = buildPendingCards();
const selected = pendingCards.slice(options.offset, options.offset + options.limit);
let completed = 0;

await mapWithConcurrency(selected, options.concurrency, async (card) => {
  if (!options.refresh && cache[card.slug]?.discovery_version === discoveryVersion && !isRetryable(cache[card.slug])) {
    completed += 1;
    progress();
    return;
  }
  cache[card.slug] = await discoverCard(card);
  completed += 1;
  if (completed % 10 === 0 || completed === selected.length) await writeCache(cache);
  progress();
});

await writeCache(cache);
const reportEntries = pendingCards.map((card) => ({
  card_slug: card.slug,
  display_name: card.display_name,
  institution_slugs: card.institutions.map((entry) => entry.slug),
  ...(cache[card.slug] ?? {
    searched_at: null,
    query: null,
    website: null,
    website_score: 0,
    website_evidence: "none",
    search_results: [],
    candidate_assets: []
  })
}));
const searched = reportEntries.filter((entry) => entry.searched_at);
const output = {
  generated_at: new Date().toISOString(),
  policy: "Internet discoveries are review candidates. A logo is not verified until its institution-owned source and artwork are confirmed.",
  summary: {
    pending_cards: pendingCards.length,
    searched_cards: searched.length,
    official_sites_found: searched.filter((entry) => entry.website).length,
    cards_with_candidates: searched.filter((entry) => entry.candidate_assets.some((asset) => asset.local_path)).length,
    high_confidence_cards: searched.filter((entry) => entry.candidate_assets.some((asset) => asset.local_path && asset.confidence === "high")).length,
    candidate_files: searched.flatMap((entry) => entry.candidate_assets).filter((asset) => asset.local_path).length,
    unresolved_cards: searched.filter((entry) => !entry.candidate_assets.some((asset) => asset.local_path)).length
  },
  entries: reportEntries
};
await writeFile(reportPath, JSON.stringify(output, null, 2) + "\n");
console.log(`\nDiscovered ${output.summary.candidate_files} candidates for ${output.summary.cards_with_candidates} of ${searched.length} searched cards.`);

async function discoverCard(card: PendingCard): Promise<CacheEntry> {
  const query = `\"${card.display_name}\" Nigeria official`;
  await rm(join(candidatesRoot, card.slug), { recursive: true, force: true });
  const knownWebsite = card.institutions.map((entry) => entry.website).find(Boolean) ?? null;
  let searchResults: SearchResult[] = [];
  let website = knownWebsite;
  let websiteScore = knownWebsite ? 100 : 0;
  let evidence: CacheEntry["website_evidence"] = knownWebsite ? "catalog" : "none";

  try {
    if (!website) {
      await sleep(options.delay);
      searchResults = await searchWeb(query, card);
      const best = searchResults.find((result) =>
        result.score >= 38 && domainMatchesCard(result.url, card) && domainHasRelevantContext(result.url, searchResults)
      );
      if (best) {
        website = best.url;
        websiteScore = best.score;
        evidence = "search";
      }
    }
    if (!website) return emptyEntry(query, searchResults);

    const page = await fetchHtml(website);
    const identityScore = scorePageIdentity(page.html, page.url, card);
    if (evidence === "search" && identityScore < 28) {
      return {
        ...emptyEntry(query, searchResults),
        error: `Rejected search result after identity check (${identityScore})`
      };
    }
    const candidates = discoverCandidates(page.html, page.url, card.display_name);
    const saved = await mapWithConcurrency(candidates.slice(0, 5), 2, (candidate, index) =>
      saveCandidate(candidate, card.slug, index)
    );
    return {
      discovery_version: discoveryVersion,
      searched_at: new Date().toISOString(),
      query,
      website: page.url,
      website_score: websiteScore,
      website_evidence: evidence,
      search_results: searchResults,
      page_title: load(page.html)("title").first().text().trim().slice(0, 240),
      identity_score: identityScore,
      candidate_assets: saved
    };
  } catch (error) {
    return {
      discovery_version: discoveryVersion,
      searched_at: new Date().toISOString(),
      query,
      website,
      website_score: websiteScore,
      website_evidence: evidence,
      search_results: searchResults,
      candidate_assets: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function emptyEntry(query: string, searchResults: SearchResult[]): CacheEntry {
  return {
    discovery_version: discoveryVersion,
    searched_at: new Date().toISOString(),
    query,
    website: null,
    website_score: 0,
    website_evidence: "none",
    search_results: searchResults,
    candidate_assets: []
  };
}

async function searchWeb(query: string, card: PendingCard): Promise<SearchResult[]> {
  const braveHtml = await fetchSearchPage(`https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`);
  const braveResults = braveHtml ? parseBrave(braveHtml, card) : [];
  if (braveResults.some((result) =>
    result.score >= 38 && domainMatchesCard(result.url, card) && domainHasRelevantContext(result.url, braveResults)
  )) return braveResults;

  const bingHtml = await fetchSearchPage(`https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10`);
  if (!braveHtml && !bingHtml) throw new Error("search unavailable after retries");
  return mergeSearchResults(braveResults, bingHtml ? parseBing(bingHtml, card) : []);
}

async function fetchSearchPage(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 1; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(10_000)
      });
      if (response.ok) return await response.text();
    } catch {
      // Retry transient DNS, connection, and timeout failures with a short backoff.
    }
    await sleep(500 * (attempt + 1));
  }
  return null;
}

function parseDuckDuckGo(html: string, card: PendingCard): SearchResult[] {
  const $ = load(html);
  const results: SearchResult[] = [];
  $(".result").slice(0, 10).each((_, element) => {
    const anchor = $(element).find(".result__a").first();
    const raw = anchor.attr("href");
    if (!raw) return;
    const url = unwrapSearchUrl(raw);
    if (!url || isBlockedUrl(url)) return;
    const title = anchor.text().replace(/\s+/g, " ").trim();
    const snippet = $(element).find(".result__snippet").text().replace(/\s+/g, " ").trim();
    results.push({ url, title, snippet, score: scoreSearchResult(url, title, snippet, card) });
  });
  return results.sort((a, b) => b.score - a.score).slice(0, 5);
}

function parseBing(html: string, card: PendingCard): SearchResult[] {
  const $ = load(html);
  const results: SearchResult[] = [];
  $("li.b_algo").slice(0, 10).each((_, element) => {
    const anchor = $(element).find("h2 a").first();
    const raw = anchor.attr("href");
    if (!raw) return;
    const url = unwrapBingUrl(raw);
    if (!url || isBlockedUrl(url)) return;
    const title = anchor.text().replace(/\s+/g, " ").trim();
    const snippet = $(element).find(".b_caption p").first().text().replace(/\s+/g, " ").trim();
    results.push({ url, title, snippet, score: scoreSearchResult(url, title, snippet, card) });
  });
  return results.sort((a, b) => b.score - a.score).slice(0, 5);
}

function parseBrave(html: string, card: PendingCard): SearchResult[] {
  const $ = load(html);
  const results: SearchResult[] = [];
  $(".search-snippet-title").slice(0, 10).each((_, element) => {
    const anchor = $(element).closest("a[href]");
    const url = anchor.attr("href");
    if (!url || !/^https?:/i.test(url) || isBlockedUrl(url)) return;
    const title = $(element).text().replace(/\s+/g, " ").trim();
    const container = $(element).closest(".snippet");
    const snippet = container.find(".generic-snippet .content").first().text().replace(/\s+/g, " ").trim();
    results.push({ url, title, snippet, score: scoreSearchResult(url, title, snippet, card) });
  });
  return results.sort((a, b) => b.score - a.score).slice(0, 5);
}

function mergeSearchResults(...groups: SearchResult[][]): SearchResult[] {
  return [...new Map(groups.flat().map((result) => [result.url, result])).values()]
    .sort((a, b) => b.score - a.score).slice(0, 5);
}

function unwrapSearchUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw, "https://duckduckgo.com");
    const target = parsed.searchParams.get("uddg") ?? parsed.href;
    const result = new URL(target);
    return `${result.protocol}//${result.host}${result.pathname}${result.search}`;
  } catch {
    return null;
  }
}

function unwrapBingUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    const encoded = parsed.hostname.endsWith("bing.com") ? parsed.searchParams.get("u") : null;
    if (!encoded) return parsed.href;
    const base64 = encoded.startsWith("a1") ? encoded.slice(2) : encoded;
    const target = Buffer.from(base64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return new URL(target).href;
  } catch {
    return null;
  }
}

function isBlockedUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return blockedHosts.some((blocked) => host === blocked || host.endsWith(`.${blocked}`)) ||
      /\.(pdf|docx?|xlsx?)(?:$|\?)/i.test(value);
  } catch {
    return true;
  }
}

function scoreSearchResult(url: string, title: string, snippet: string, card: PendingCard): number {
  const host = normalize(new URL(url).hostname.replace(/^www\./, ""));
  const titleKey = normalize(title);
  const snippetKey = normalize(snippet);
  const names = card.institutions.flatMap((entry) => [card.display_name, entry.brand_name, entry.legal_name ?? "", ...entry.aliases]);
  const identities = names.map(brandIdentity).filter((value) => value.length >= 4);
  const displayIdentity = brandIdentity(card.display_name);
  const tokens = meaningfulTokens(names.join(" "));
  let score = 0;
  if (displayIdentity.length >= 4 && titleKey.includes(displayIdentity)) score += 40;
  else if (identities.some((identity) => titleKey.includes(identity))) score += 24;
  if (identities.some((identity) => snippetKey.includes(identity))) score += 14;
  if (tokens.some((token) => host.includes(token))) score += 26;
  score += Math.min(18, tokens.filter((token) => titleKey.includes(token)).length * 6);
  score += Math.min(8, tokens.filter((token) => snippetKey.includes(token)).length * 2);
  if (/official|homepage|welcome/i.test(`${title} ${snippet}`)) score += 4;
  if (/\.ng$/i.test(new URL(url).hostname)) score += 3;
  return score;
}

async function fetchHtml(url: string): Promise<{ url: string; html: string }> {
  const attempts = [url];
  if (url.startsWith("https://")) attempts.push(url.replace(/^https:/, "http:"));
  let lastError = "fetch failed";
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt, {
        headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml" },
        redirect: "follow",
        signal: AbortSignal.timeout(12_000)
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !/html/i.test(contentType)) {
        lastError = `page HTTP ${response.status}`;
        continue;
      }
      const html = await response.text();
      if (html.length > 5_000_000) throw new Error("page exceeds 5 MB");
      return { url: response.url, html };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError);
}

function scorePageIdentity(html: string, url: string, card: PendingCard): number {
  const $ = load(html);
  const head = [
    $("title").first().text(),
    $('meta[name="description"]').attr("content"),
    $('meta[property="og:site_name"]').attr("content"),
    $("h1").first().text(),
    $("header").first().text().slice(0, 500)
  ].filter(Boolean).join(" ");
  const key = normalize(head);
  const host = normalize(new URL(url).hostname.replace(/^www\./, ""));
  const names = card.institutions.flatMap((entry) => [card.display_name, entry.brand_name, entry.legal_name ?? "", ...entry.aliases]);
  const identities = names.map(brandIdentity).filter((value) => value.length >= 4);
  const tokens = meaningfulTokens(names.join(" "));
  let score = identities.some((identity) => key.includes(identity)) ? 34 : 0;
  if (tokens.some((token) => host.includes(token))) score += 24;
  score += Math.min(24, tokens.filter((token) => key.includes(token)).length * 8);
  return score;
}

function discoverCandidates(html: string, baseUrl: string, brandName: string): SiteCandidate[] {
  const $ = load(html);
  const found = new Map<string, SiteCandidate>();
  const brand = brandIdentity(brandName);

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const json = JSON.parse($(element).text());
      for (const logo of findJsonLogos(json)) addCandidate(logo, "structured data logo", true);
    } catch {
      // Invalid JSON-LD is common and should not stop page discovery.
    }
  });

  $("img[src], source[srcset], meta[property='og:logo'][content]").each((_, element) => {
    const node = $(element);
    const raw = node.attr("src") ?? node.attr("content") ?? node.attr("srcset")?.split(/[ ,]/)[0];
    if (!raw) return;
    const descriptor = describeNode($, element, raw, false);
    const mentionsLogo = /logo|wordmark|logomark|brandmark/i.test(descriptor);
    const mentionsBrand = brand.length > 3 && brandIdentity(descriptor).includes(brand);
    if (!mentionsLogo && !mentionsBrand) return;
    addCandidate(raw, descriptor, mentionsLogo);
  });

  $("svg").each((index, element) => {
    const descriptor = describeNode($, element, "inline svg");
    const mentionsLogo = /logo|wordmark|logomark|brandmark/i.test(descriptor);
    const mentionsBrand = brand.length > 3 && brandIdentity(descriptor).includes(brand);
    if (!mentionsLogo && !mentionsBrand) return;
    const markup = $.html(element);
    if (!markup || !isSafeSvg(markup)) return;
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(markup).toString("base64")}`;
    found.set(`${baseUrl}#inline-logo-${index}`, {
      url: `${baseUrl}#inline-logo-${index}`,
      source_url: dataUrl,
      format: "svg",
      descriptor: descriptor.slice(0, 240),
      confidence: mentionsLogo ? "high" : "medium"
    });
  });

  return [...found.values()].sort((a, b) =>
    Number(b.confidence === "high") - Number(a.confidence === "high") ||
    Number(a.format !== "svg") - Number(b.format !== "svg")
  );

  function addCandidate(raw: string, descriptor: string, high: boolean): void {
    try {
      const resolved = new URL(raw, baseUrl);
      if (!/^https?:$/.test(resolved.protocol) || isBlockedUrl(resolved.href)) return;
      const extension = decodeURIComponent(`${resolved.pathname}${resolved.search}`)
        .match(/\.(svg|png|webp|jpe?g|avif)(?:$|[?&#])/i)?.[1]?.toLowerCase();
      if (!extension) return;
      const format = extension === "jpg" ? "jpeg" : extension as SiteCandidate["format"];
      found.set(resolved.href, {
        url: resolved.href,
        source_url: resolved.href,
        format,
        descriptor: descriptor.slice(0, 240),
        confidence: high ? "high" : "medium"
      });
    } catch {
      // Ignore malformed asset references.
    }
  }
}

function findJsonLogos(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(findJsonLogos);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    if (key.toLowerCase() === "logo") {
      if (typeof child === "string") return [child];
      if (child && typeof child === "object" && typeof (child as { url?: unknown }).url === "string") {
        return [(child as { url: string }).url];
      }
    }
    return findJsonLogos(child);
  });
}

function describeNode($: CheerioAPI, element: AnyNode, raw: string, includeAncestors = true): string {
  const node = $(element);
  const ancestors = node.parentsUntil("body").slice(0, 4);
  return [
    node.attr("alt"), node.attr("class"), node.attr("id"), node.attr("aria-label"),
    node.attr("itemprop"), node.attr("property"), node.find("title").first().text(),
    includeAncestors ? ancestors.attr("class") : undefined,
    includeAncestors ? ancestors.attr("id") : undefined,
    raw
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

async function saveCandidate(candidate: SiteCandidate, slug: string, index: number): Promise<SiteCandidate> {
  try {
    const bytes = candidate.source_url.startsWith("data:image/svg+xml;base64,")
      ? Buffer.from(candidate.source_url.split(",", 2)[1], "base64")
      : await downloadAsset(candidate.source_url);
    const dimensions = await validateAsset(bytes, candidate.format);
    const extension = candidate.format === "jpeg" ? "jpg" : candidate.format;
    const directory = join(candidatesRoot, slug);
    await mkdir(directory, { recursive: true });
    const fileName = `${String(index + 1).padStart(2, "0")}.${extension}`;
    await writeFile(join(directory, fileName), bytes);
    return {
      ...candidate,
      source_url: candidate.source_url.startsWith("data:") ? candidate.url : candidate.source_url,
      local_path: `web-candidates/${slug}/${fileName}`,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      ...dimensions
    };
  } catch (error) {
    return { ...candidate, error: error instanceof Error ? error.message : String(error) };
  }
}

async function downloadAsset(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { "user-agent": userAgent, accept: "image/*,*/*;q=0.5" },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`asset HTTP ${response.status}`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 5_000_000) throw new Error("asset exceeds 5 MB");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 5_000_000) throw new Error("asset exceeds 5 MB");
  return bytes;
}

async function validateAsset(bytes: Buffer, format: SiteCandidate["format"]): Promise<{ width: number | null; height: number | null }> {
  if (bytes.length < 32) throw new Error("asset is empty or truncated");
  if (format === "svg") {
    const text = bytes.toString("utf8");
    if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text)) throw new Error("invalid SVG");
    if (!isSafeSvg(text)) throw new Error("unsafe SVG");
  }
  const metadata = await sharp(bytes, { failOn: "error" }).metadata();
  const width = metadata.width ?? null;
  const height = metadata.height ?? null;
  if (width && height && (width < 24 || height < 16)) throw new Error("asset dimensions are too small");
  if (width && height && width * height > 20_000_000) throw new Error("asset dimensions are too large");
  return { width, height };
}

function isSafeSvg(value: string): boolean {
  return !/<script|<foreignObject|\son[a-z]+\s*=|(?:href|src)\s*=\s*["']https?:/i.test(value);
}

function buildPendingCards(): PendingCard[] {
  const all = [...institutions, ...foreignAuthorizedInstitutions, ...communityCandidates];
  const accepted = new Set(logoCatalog.flatMap((logo) => [logo.slug, logo.name, ...logo.aliases]).map(normalize));
  const pending = all.filter((institution) => {
    const linked = institution.logo_slug ?? institutionLogoLinks[institution.slug];
    if (linked && logoCatalog.some((logo) => logo.slug === linked)) return false;
    return ![institution.slug, institution.brand_name, institution.legal_name ?? "", ...institution.aliases]
      .map(normalize).some((key) => key.length > 3 && accepted.has(key));
  });
  const groups = new Map<string, Institution[]>();
  for (const institution of pending) {
    const displayName = institution.brand_name === "N/A" ? institution.legal_name ?? institution.slug : institution.brand_name;
    const key = brandIdentity(displayName);
    groups.set(key, [...(groups.get(key) ?? []), institution]);
  }
  return [...groups.values()].map((records) => {
    const sorted = [...records].sort((a, b) =>
      verificationRank(a) - verificationRank(b) ||
      Number(Boolean(b.website)) - Number(Boolean(a.website)) ||
      a.brand_name.length - b.brand_name.length ||
      a.slug.localeCompare(b.slug)
    );
    const preferred = sorted[0];
    const displayName = preferred.brand_name === "N/A" ? preferred.legal_name ?? preferred.slug : preferred.brand_name;
    return { slug: preferred.slug, display_name: displayName, institutions: records };
  }).sort((a, b) => a.display_name.localeCompare(b.display_name));
}

function verificationRank(institution: Institution): number {
  if (institution.verification_status === "officially-verified") return 0;
  if (institution.verification_status === "market-verified") return 1;
  return 2;
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function brandIdentity(value: string): string {
  const words = value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ").split(/[^a-z0-9]+/).filter(Boolean);
  return words.filter((word) => !genericWords.has(word)).join("") || words.join("");
}

function meaningfulTokens(value: string): string[] {
  return [...new Set(value.toLowerCase().split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !searchGenericWords.has(word)))].sort((a, b) => b.length - a.length).slice(0, 8);
}

function domainMatchesCard(url: string, card: PendingCard): boolean {
  const host = normalize(new URL(url).hostname.replace(/^www\./, ""));
  const names = card.institutions.flatMap((entry) => [card.display_name, entry.brand_name, entry.legal_name ?? "", ...entry.aliases]);
  return meaningfulTokens(names.join(" ")).some((token) => host.includes(token));
}

function domainHasRelevantContext(url: string, results: SearchResult[]): boolean {
  const host = new URL(url).hostname.toLowerCase();
  if (/\.ng$/.test(host)) return true;
  const organization = rootDomain(host);
  return results.some((result) => {
    try {
      if (rootDomain(new URL(result.url).hostname) !== organization) return false;
      return /\b(?:nigeria|nigerian|lagos|abuja|bank|banking|finance|financial|fintech|payment|insurance|insurer|loan|credit|investment|pension|remittance|broker|exchange|securities|hmo|health)\b/i
        .test(`${result.title} ${result.snippet}`);
    } catch {
      return false;
    }
  });
}

function rootDomain(hostname: string): string {
  const parts = hostname.toLowerCase().replace(/^www\./, "").split(".");
  const suffix = parts.slice(-2).join(".");
  if (["com.ng", "org.ng", "net.ng", "gov.ng", "co.uk"].includes(suffix)) return parts.slice(-3).join(".");
  return suffix;
}

function isRetryable(entry: CacheEntry): boolean {
  if (!entry.error) return false;
  return /search unavailable|fetch failed|timeout|aborted|HTTP 5\d\d/i.test(entry.error);
}

async function writeCache(cache: Cache): Promise<void> {
  const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(cachePath, JSON.stringify(sorted, null, 2) + "\n");
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  if (!existsSync(path)) return fallback;
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function parseOptions(args: string[]): { limit: number; offset: number; concurrency: number; delay: number; refresh: boolean } {
  const value = (name: string, fallback: number) => {
    const index = args.indexOf(name);
    return index >= 0 ? Number(args[index + 1]) : fallback;
  };
  return {
    limit: value("--limit", Number.POSITIVE_INFINITY),
    offset: value("--offset", 0),
    concurrency: Math.max(1, value("--concurrency", 3)),
    delay: Math.max(0, value("--delay", 350)),
    refresh: args.includes("--refresh")
  };
}

async function mapWithConcurrency<T, R>(values: T[], limit: number, mapper: (value: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  async function worker() {
    while (next < values.length) {
      const index = next++;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function progress(): void {
  if (completed % 25 === 0 || completed === selected.length) {
    process.stdout.write(`\rProcessed ${completed}/${selected.length} selected cards`);
  }
}

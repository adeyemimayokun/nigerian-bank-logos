import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load, type CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import * as XLSX from "xlsx";
import { institutions, type Institution } from "../../institutions/src";
import { logoCatalog } from "../src/catalog";
import { institutionLogoLinks } from "../src/institution-links";
import assetOverridesJson from "../sourcing/asset-overrides.json";
import websiteOverridesJson from "../sourcing/website-overrides.json";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcingRoot = join(packageRoot, "sourcing");
const candidatesRoot = join(sourcingRoot, "candidates");
const snapshotDate = "2026-07-13";
const concurrency = 8;
const naicomSources = [
  { url: "https://portal.naicom.gov.ng/Download/AllInsurers.xlsx", prefix: "Company" },
  { url: "https://portal.naicom.gov.ng/Download/AllBrokers.xlsx", prefix: "Broker" }
] as const;
const genericEmailDomains = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com",
  "outlook.com", "live.com", "icloud.com", "aol.com", "protonmail.com",
  "ymail.com", "mail.com", "rocketmail.com"
]);
const acceptedNames = logoCatalog
  .flatMap((logo) => [logo.name, logo.slug, ...logo.aliases])
  .map(normalize);
const websiteOverrides = websiteOverridesJson as Record<string, string>;
const assetOverrides = assetOverridesJson as Record<string, string[]>;

type CandidateFormat = "svg" | "png" | "webp" | "jpeg" | "avif" | "pdf";
type CandidateAsset = {
  source_url: string;
  format: CandidateFormat;
  confidence: "high" | "medium";
  descriptor: string;
  local_path?: string;
  sha256?: string;
  error?: string;
};
type WebsiteHint = {
  url: string;
  evidence: "regulator-website" | "regulator-email-domain";
  evidence_url: string;
};
type QueueEntry = {
  institution_slug: string;
  brand_name: string;
  website: string | null;
  website_source: "catalog" | "curated-official-domain" | WebsiteHint["evidence"] | "unavailable";
  website_evidence_url?: string;
  verification_status: Institution["verification_status"];
  status: "needs-review" | "no-candidate" | "website-unavailable" | "source-unavailable";
  candidate_assets: CandidateAsset[];
  error?: string;
};

await rm(candidatesRoot, { recursive: true, force: true });
await mkdir(candidatesRoot, { recursive: true });

const hints = await loadRegulatorWebsiteHints();
const pending = institutions.filter((institution) => !hasAcceptedLogo(institution));
const results = await mapWithConcurrency(pending, concurrency, crawlInstitution);
const candidateFormats = results
  .flatMap((entry) => entry.candidate_assets)
  .reduce<Record<string, number>>((totals, asset) => {
    totals[asset.format] = (totals[asset.format] ?? 0) + 1;
    return totals;
  }, {});
const output = {
  generated_at: snapshotDate,
  policy: "Candidates are never accepted automatically. Confirm the artwork and official source before adding it to the logo catalog.",
  summary: {
    institutions: institutions.length,
    accepted_logos: logoCatalog.length,
    pending: pending.length,
    catalog_websites: pending.filter((entry) => entry.website).length,
    curated_domain_overrides: pending.filter((entry) => !entry.website && websiteOverrides[entry.slug]).length,
    regulator_domain_hints: pending.filter((entry) => !entry.website && findHint(entry)).length,
    websites_attempted: results.filter((entry) => entry.website).length,
    websites_unavailable: results.filter((entry) => entry.status === "website-unavailable").length,
    source_failures: results.filter((entry) => entry.status === "source-unavailable").length,
    institutions_with_candidates: results.filter((entry) => entry.candidate_assets.some((asset) => asset.local_path)).length,
    candidate_files: results.flatMap((entry) => entry.candidate_assets).filter((asset) => asset.local_path).length,
    candidate_formats: candidateFormats
  },
  entries: results
};

await writeFile(join(sourcingRoot, "queue.json"), JSON.stringify(output, null, 2) + "\n");
console.log(
  `Reviewed ${pending.length} pending institutions; saved ${output.summary.candidate_files} candidate files for ` +
  `${output.summary.institutions_with_candidates} institutions.`
);

function normalize(value: string): string {
  return value.toLowerCase().replace(/\b(nigeria|limited|ltd|plc|inc|llc|company)\b/g, "").replace(/[^a-z0-9]/g, "");
}

function institutionKeys(institution: Institution): string[] {
  return [institution.legal_name ?? "", institution.brand_name, ...institution.aliases]
    .map(normalize).filter((value) => value.length > 3);
}

function hasAcceptedLogo(institution: Institution): boolean {
  if (institutionLogoLinks[institution.slug] && logoCatalog.some((logo) => logo.slug === institutionLogoLinks[institution.slug])) return true;
  if (institution.logo_slug && logoCatalog.some((logo) => logo.slug === institution.logo_slug)) return true;
  return institutionKeys(institution).some((name) => acceptedNames.includes(name));
}

function findHint(institution: Institution): WebsiteHint | undefined {
  return institutionKeys(institution).map((key) => hints.get(key)).find(Boolean);
}

async function crawlInstitution(institution: Institution): Promise<QueueEntry> {
  const override = websiteOverrides[institution.slug];
  const hint = institution.website || override ? undefined : findHint(institution);
  const website = institution.website ?? override ?? hint?.url ?? null;
  const base = {
    institution_slug: institution.slug,
    brand_name: institution.brand_name,
    website,
    website_source: institution.website
      ? "catalog" as const
      : override
        ? "curated-official-domain" as const
        : hint?.evidence ?? "unavailable" as const,
    ...(hint ? { website_evidence_url: hint.evidence_url } : {}),
    verification_status: institution.verification_status
  };
  if (!website) return { ...base, status: "website-unavailable", candidate_assets: [] };

  const curatedAssets = (assetOverrides[institution.slug] ?? []).map(curatedAsset);
  try {
    const response = await fetchWebsite(website);
    const html = await response.text();
    const candidates = deduplicateCandidates([
      ...curatedAssets,
      ...discoverCandidates(html, response.url, institution.brand_name)
    ]);
    const saved = await mapWithConcurrency(candidates.slice(0, 8), 3, (asset, index) =>
      saveCandidate(asset, institution.slug, index)
    );
    return {
      ...base,
      website: response.url,
      status: saved.some((asset) => asset.local_path) ? "needs-review" : "no-candidate",
      candidate_assets: saved
    };
  } catch (error) {
    const saved = await mapWithConcurrency(curatedAssets.slice(0, 8), 3, (asset, index) =>
      saveCandidate(asset, institution.slug, index)
    );
    if (saved.some((asset) => asset.local_path)) {
      return {
        ...base,
        status: "needs-review",
        candidate_assets: saved,
        error: error instanceof Error ? error.message : String(error)
      };
    }
    return {
      ...base,
      status: "source-unavailable",
      candidate_assets: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function curatedAsset(sourceUrl: string): CandidateAsset {
  const extension = new URL(sourceUrl).pathname.match(/\.(svg|png|webp|jpe?g|avif|pdf)$/i)?.[1]?.toLowerCase();
  if (!extension) throw new Error(`Curated asset has no supported extension: ${sourceUrl}`);
  return {
    source_url: sourceUrl,
    format: (extension === "jpg" ? "jpeg" : extension) as CandidateFormat,
    confidence: "high",
    descriptor: "curated official asset"
  };
}

function deduplicateCandidates(candidates: CandidateAsset[]): CandidateAsset[] {
  return [...new Map(candidates.map((candidate) => [candidate.source_url, candidate])).values()];
}

async function fetchWebsite(url: string): Promise<Response> {
  const attempts = [url];
  if (url.startsWith("https://")) attempts.push(url.replace(/^https:/, "http:"));
  let lastError = "fetch failed";
  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt, {
        headers: { "user-agent": "nigerian-bank-logos/0.1 (+open-source logo sourcing)" },
        redirect: "follow",
        signal: AbortSignal.timeout(10_000)
      });
      if (response.ok && /text\/html/i.test(response.headers.get("content-type") ?? "text/html")) return response;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError);
}

function discoverCandidates(html: string, baseUrl: string, brandName: string): CandidateAsset[] {
  const $ = load(html);
  const found = new Map<string, CandidateAsset>();
  const brand = normalize(brandName);
  $("img[src], source[srcset], link[href], meta[content]").each((_, element) => {
    const node = $(element);
    const raw = node.attr("src") ?? node.attr("href") ?? node.attr("content") ?? node.attr("srcset")?.split(/[ ,]/)[0];
    if (!raw) return;
    const descriptor = describeNode($, element, raw);
    const descriptorKey = normalize(descriptor);
    const mentionsLogo = /logo|brand|wordmark|logomark/i.test(descriptor);
    const mentionsBrand = brand.length > 3 && descriptorKey.includes(brand);
    if (!mentionsLogo && !mentionsBrand) return;
    try {
      const url = new URL(raw, baseUrl);
      const extension = raw.startsWith("data:image/svg+xml")
        ? "svg"
        : decodeURIComponent(`${url.pathname}${url.search}`).match(/\.(svg|png|webp|jpe?g|avif|pdf)(?:$|[?&#])/i)?.[1]?.toLowerCase();
      if (!extension) return;
      const format = extension === "jpg" ? "jpeg" : extension as CandidateFormat;
      found.set(url.href, {
        source_url: url.href,
        format,
        confidence: mentionsBrand && mentionsLogo ? "high" : "medium",
        descriptor: descriptor.slice(0, 240)
      });
    } catch {
      // Ignore malformed page assets; discovery only stages review candidates.
    }
  });

  $("svg").each((index, element) => {
    const descriptor = describeNode($, element, "inline svg");
    const descriptorKey = normalize(descriptor);
    const mentionsLogo = /logo|brand|wordmark|logomark/i.test(descriptor);
    const mentionsBrand = brand.length > 3 && descriptorKey.includes(brand);
    if (!mentionsLogo && !mentionsBrand) return;
    const markup = $.html(element);
    if (!markup || /<script|\son[a-z]+\s*=|(?:href|src)\s*=\s*["']https?:/i.test(markup)) return;
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(markup).toString("base64")}`;
    found.set(`${baseUrl}#inline-logo-${index}`, {
      source_url: dataUrl,
      format: "svg",
      confidence: mentionsBrand && mentionsLogo ? "high" : "medium",
      descriptor: descriptor.slice(0, 240)
    });
  });
  return [...found.values()]
    .sort((a, b) => Number(b.confidence === "high") - Number(a.confidence === "high"));
}

function describeNode($: CheerioAPI, element: AnyNode, raw: string): string {
  const node = $(element);
  const ancestors = node.parentsUntil("body").slice(0, 3);
  return [
    node.attr("alt"), node.attr("class"), node.attr("id"), node.attr("rel"),
    node.attr("property"), node.attr("aria-label"), node.find("title").first().text(),
    ancestors.attr("class"), ancestors.attr("id"), raw
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

async function saveCandidate(asset: CandidateAsset, slug: string, index: number): Promise<CandidateAsset> {
  try {
    let bytes = asset.source_url.startsWith("data:image/svg+xml;base64,")
      ? Buffer.from(asset.source_url.split(",", 2)[1], "base64")
      : await downloadAsset(asset.source_url);
    if (asset.format === "svg") {
      const svgStart = bytes.toString("utf8").search(/<svg[\s>]/i);
      if (svgStart >= 0) bytes = Buffer.from(bytes.toString("utf8").slice(svgStart));
    }
    validateAsset(bytes, asset.format);
    const extension = asset.format === "jpeg" ? "jpg" : asset.format;
    const fileName = `${slug}-${String(index + 1).padStart(2, "0")}.${extension}`;
    await writeFile(join(candidatesRoot, fileName), bytes);
    return {
      ...asset,
      source_url: asset.source_url.startsWith("data:") ? asset.source_url.replace(/,.+$/, ",[inline-svg]") : asset.source_url,
      local_path: `candidates/${fileName}`,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
  } catch (error) {
    return { ...asset, error: error instanceof Error ? error.message : String(error) };
  }
}

async function downloadAsset(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { "user-agent": "nigerian-bank-logos/0.1 (+open-source logo sourcing)" },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`asset HTTP ${response.status}`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 5_000_000) throw new Error("asset exceeds 5 MB");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 5_000_000) throw new Error("asset exceeds 5 MB");
  return bytes;
}

function validateAsset(bytes: Buffer, format: CandidateFormat): void {
  if (bytes.length < 16) throw new Error("asset is empty or truncated");
  if (format === "svg") {
    const text = bytes.toString("utf8");
    if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text)) throw new Error("invalid SVG");
    if (/<script|\son[a-z]+\s*=|(?:href|src)\s*=\s*["']https?:/i.test(text)) throw new Error("unsafe SVG");
  }
  if (format === "png" && !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("invalid PNG");
  if (format === "webp" && !(bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP")) throw new Error("invalid WebP");
  if (format === "jpeg" && !(bytes[0] === 0xff && bytes[1] === 0xd8)) throw new Error("invalid JPEG");
  if (format === "pdf" && bytes.toString("ascii", 0, 5) !== "%PDF-") throw new Error("invalid PDF");
}

async function loadRegulatorWebsiteHints(): Promise<Map<string, WebsiteHint>> {
  const result = new Map<string, WebsiteHint>();
  for (const source of naicomSources) {
    try {
      const response = await fetch(source.url, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) continue;
      const workbook = XLSX.read(await response.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      for (const row of rows) {
        if (String(row[`${source.prefix}Status`]) !== "0") continue;
        const name = String(row[`${source.prefix}Name`] ?? "");
        const website = websiteFromRegulatorRow(row, source.prefix);
        if (!name || !website) continue;
        result.set(normalize(name), { ...website, evidence_url: source.url });
      }
    } catch {
      // A source outage should not prevent catalog websites from being processed.
    }
  }
  return result;
}

function websiteFromRegulatorRow(row: Record<string, unknown>, prefix: string): Omit<WebsiteHint, "evidence_url"> | null {
  const rawWebsite = String(row[`${prefix}Website`] ?? "").trim();
  const websiteDomain = domainFromValue(rawWebsite);
  if (websiteDomain && !/^(company\.com)$/i.test(websiteDomain)) {
    return { url: `https://${websiteDomain}/`, evidence: "regulator-website" };
  }
  const email = String(row[`${prefix}Email`] ?? "");
  const emailDomain = email.match(/@([a-z0-9.-]+\.[a-z]{2,})/i)?.[1]?.toLowerCase();
  if (!emailDomain || genericEmailDomains.has(emailDomain)) return null;
  return { url: `https://${emailDomain}/`, evidence: "regulator-email-domain" };
}

function domainFromValue(value: string): string | null {
  if (!value || /^(null|n\/a)$/i.test(value)) return null;
  const match = value.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})(?:\/|$)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T, index: number) => Promise<R>
): Promise<R[]> {
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

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import sharp from "sharp";
import * as XLSX from "xlsx";
import type { Institution } from "../../institutions/src";

const snapshotDate = "2026-07-14";
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const institutions = JSON.parse(await readFile(join(packageRoot, "../institutions/exports/institutions-ng.json"), "utf8")) as Institution[];
const promotionsPath = join(packageRoot, "sourcing/naicom-directory-promotions.json");
const reportPath = join(packageRoot, "sourcing/naicom-directory-report.json");
const candidatesRoot = join(packageRoot, "sourcing/naicom-directory-candidates");
const genericEmailDomains = new Set([
  "aol.com", "gmail.com", "hotmail.com", "icloud.com", "outlook.com", "rocketmail.com",
  "yahoo.co.uk", "yahoo.com", "ymail.com"
]);
const sources = [
  {
    url: "https://portal.naicom.gov.ng/Download/AllBrokers.xlsx",
    prefix: "Broker",
    category: "insurance-broker"
  },
  {
    url: "https://portal.naicom.gov.ng/Download/AllInsurers.xlsx",
    prefix: "Company",
    category: "insurer"
  }
] as const;

type Target = {
  institution: Institution;
  domain: string;
  source: string;
};

type Promotion = {
  institution_slug: string;
  candidate_path: string;
  website: string;
  source_url: string;
  source_type: "official-website";
  status: "verified";
  added_at: string;
  updated_at: string;
};

const unresolved = institutions.filter((institution) => !institution.logo_slug);
const institutionIndex = new Map<string, Institution[]>();
for (const institution of unresolved) {
  for (const value of [institution.legal_name, institution.brand_name, ...institution.aliases]) {
    const key = normalizeName(value ?? "");
    if (!key) continue;
    institutionIndex.set(key, [...(institutionIndex.get(key) ?? []), institution]);
  }
}

const targets = new Map<string, Target>();
for (const source of sources) {
  const workbook = XLSX.read(await fetchBuffer(source.url));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  for (const row of rows) {
    if (String(row[`${source.prefix}Status`]) !== "0") continue;
    const name = String(row[`${source.prefix}Name`] ?? "");
    const matches = institutionIndex.get(normalizeName(name)) ?? [];
    const institution = matches.find((entry) => entry.categories.includes(source.category));
    if (!institution) continue;
    const website = cleanDomain(String(row[`${source.prefix}Website`] ?? ""));
    const emailDomain = domainFromEmail(String(row[`${source.prefix}Email`] ?? ""));
    const domain = website || emailDomain;
    if (!domain) continue;
    targets.set(institution.slug, { institution, domain, source: source.url });
  }
}

await rm(candidatesRoot, { recursive: true, force: true });
const results = await mapLimit([...targets.values()], 8, discoverLogo);
const promotions = results.flatMap((result) => result.promotion ? [result.promotion] : []);
await writeFile(promotionsPath, `${JSON.stringify(promotions.sort((a, b) => a.institution_slug.localeCompare(b.institution_slug)), null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify({
  retrieved_at: snapshotDate,
  regulator: "NAICOM",
  directory_targets: targets.size,
  imported_verified: promotions.length,
  unresolved: results.filter((result) => !result.promotion).length,
  entries: results
}, null, 2)}\n`);

console.log(`Checked ${targets.size} NAICOM directory domains and imported ${promotions.length} verified logo candidates.`);

async function discoverLogo(target: Target): Promise<Record<string, unknown> & { promotion?: Promotion }> {
  try {
    const page = await fetchWebsite(target.domain);
    const candidateUrls = findLogoUrls(page.html, page.url, target.institution);
    for (const sourceUrl of candidateUrls.slice(0, 8)) {
      try {
        const asset = await fetchBuffer(sourceUrl);
        const normalized = await normalizeAsset(asset, sourceUrl);
        if (!normalized) continue;
        const relativePath = `naicom-directory-candidates/${target.institution.slug}/${target.institution.slug}.${normalized.extension}`;
        await mkdir(dirname(join(packageRoot, "sourcing", relativePath)), { recursive: true });
        await writeFile(join(packageRoot, "sourcing", relativePath), normalized.data);
        return {
          institution_slug: target.institution.slug,
          domain: target.domain,
          source: target.source,
          website: page.url,
          source_url: sourceUrl,
          action: "imported-verified",
          promotion: {
            institution_slug: target.institution.slug,
            candidate_path: relativePath,
            website: page.url,
            source_url: sourceUrl,
            source_type: "official-website",
            status: "verified",
            added_at: snapshotDate,
            updated_at: snapshotDate
          }
        };
      } catch {
        // Try the next high-confidence logo candidate from the same official page.
      }
    }
    return { institution_slug: target.institution.slug, domain: target.domain, source: target.source, action: "no-valid-logo" };
  } catch (error) {
    return {
      institution_slug: target.institution.slug,
      domain: target.domain,
      source: target.source,
      action: "website-unavailable",
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

function findLogoUrls(html: string, baseUrl: string, institution: Institution): string[] {
  const $ = load(html);
  const genericTokens = new Set(["and", "broker", "brokers", "company", "general", "insurance", "limited", "microinsurance", "nigeria", "takaful"]);
  const meaningfulTokens = normalizeName([institution.brand_name, institution.legal_name, ...institution.aliases].filter(Boolean).join(" "))
    .split(" ")
    .filter((token) => token.length >= 3 && !genericTokens.has(token));
  const candidates: Array<{ url: string; score: number }> = [];
  $("img,source").each((_, element) => {
    const node = $(element);
    const source = node.attr("src") ?? node.attr("data-src") ?? node.attr("data-lazy-src") ?? node.attr("srcset")?.split(/[ ,]/)[0];
    if (!source || source.startsWith("data:")) return;
    const context = [
      node.attr("alt"), node.attr("class"), node.attr("id"), source,
      node.parent().attr("class"), node.parent().attr("id"), node.parent().attr("aria-label")
    ].filter(Boolean).join(" ");
    let assetIdentity = "";
    try {
      assetIdentity = normalizeName(new URL(source, baseUrl).pathname);
    } catch {
      return;
    }
    if (!meaningfulTokens.some((token) => assetIdentity.includes(token))) return;
    let score = /logo|brand/i.test(context) ? 100 : 0;
    if (node.closest("header,nav").length) score += 30;
    if (/\.svg(?:$|[?#])/i.test(source)) score += 15;
    if (meaningfulTokens.some((token) => context.toLowerCase().includes(token))) score += 15;
    if (score < 100) return;
    try {
      candidates.push({ url: new URL(source, baseUrl).href, score });
    } catch {
      // Ignore malformed asset URLs.
    }
  });
  return [...new Map(candidates.sort((a, b) => b.score - a.score).map((entry) => [entry.url, entry])).values()]
    .map((entry) => entry.url);
}

async function normalizeAsset(source: Buffer, sourceUrl: string): Promise<{ data: Buffer; extension: "svg" | "png" } | null> {
  const text = source.subarray(0, 512).toString("utf8");
  if (/<svg[\s>]/i.test(text)) {
    const fullText = source.toString("utf8");
    const start = fullText.search(/<svg[\s>]/i);
    const $ = load(fullText.slice(start), { xmlMode: true });
    const svg = $("svg").first();
    if (!svg.length) return null;
    svg.find("script,foreignObject").remove();
    if (!svg.attr("viewBox")) {
      const width = Number.parseFloat(svg.attr("width") ?? "");
      const height = Number.parseFloat(svg.attr("height") ?? "");
      if (!width || !height) return null;
      svg.attr("viewBox", `0 0 ${width} ${height}`);
    }
    return { data: Buffer.from(`${$.xml(svg)}\n`), extension: "svg" };
  }
  try {
    const image = sharp(source, { failOn: "error" });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width < 24 || metadata.height < 16) return null;
    if (metadata.width / metadata.height > 20 || metadata.height / metadata.width > 20) return null;
    return { data: await image.png().toBuffer(), extension: "png" };
  } catch {
    throw new Error(`Unsupported image returned by ${sourceUrl}`);
  }
}

async function fetchWebsite(domain: string): Promise<{ html: string; url: string }> {
  const attempts = [`https://${domain}`, `https://www.${domain}`, `http://${domain}`, `http://www.${domain}`];
  let lastError = "unreachable";
  for (const url of attempts) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "nigerian-bank-logos/0.1 (+open-source asset verification)" },
        signal: AbortSignal.timeout(8_000)
      });
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }
      return { html: await response.text(), url: response.url };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError);
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "nigerian-bank-logos/0.1 (+open-source asset verification)" },
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 8 * 1024 * 1024) throw new Error(`${url} exceeds the asset size limit`);
  return Buffer.from(await response.arrayBuffer());
}

function cleanDomain(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!cleaned) return "";
  try {
    return new URL(cleaned.match(/^https?:\/\//) ? cleaned : `https://${cleaned}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function domainFromEmail(value: string): string {
  const match = value.toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})/);
  const domain = match?.[1]?.replace(/[.,;]+$/, "") ?? "";
  return genericEmailDomains.has(domain) ? "" : domain;
}

function normalizeName(value: string): string {
  return value.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(limited|ltd|plc|company|co|l t d)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function mapLimit<T, R>(values: T[], limit: number, task: (value: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await task(values[index]);
    }
  }));
  return results;
}

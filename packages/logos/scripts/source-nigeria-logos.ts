import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { institutions, type Institution } from "../../institutions/src";
import { logoCatalog } from "../src/catalog";
import { institutionLogoLinks } from "../src/institution-links";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcingRoot = join(packageRoot, "sourcing");
const candidatesRoot = join(sourcingRoot, "nigeria-logos-candidates");
const outputPath = join(sourcingRoot, "nigeria-logos.json");
const sourceBaseUrl = "https://nigerialogos.com";
const sourceDataUrl = `${sourceBaseUrl}/logos.json`;
const sourceRepositoryUrl = "https://github.com/PaystackHQ/nigerialogos";
const concurrency = 6;
const legalTerms = new Set(["company", "inc", "limited", "llc", "ltd", "nigeria", "nigerian", "plc"]);
const allowedSuffixTerms = new Set(["digital", "insurance", "io", "payment", "service", "services", "technology", "technologies"]);

type NigeriaLogosEntry = {
  title: string;
  filename: string;
  url: string;
  category: string[];
};

type MatchBasis = "exact-name-or-alias" | "official-domain" | "generic-legal-suffix";

type CandidateAsset = {
  format: "svg" | "png";
  source_url: string;
  local_path?: string;
  sha256?: string;
  error?: string;
};

type CandidateEntry = {
  institution_slug: string;
  brand_name: string;
  verification_status: Institution["verification_status"];
  regulatory_status: Institution["regulatory_status"];
  match_basis: MatchBasis;
  source_title: string;
  source_filename: string;
  source_categories: string[];
  source_page: string;
  official_website_hint: string | null;
  status: "needs-official-source" | "download-failed";
  candidate_assets: CandidateAsset[];
};

await rm(candidatesRoot, { recursive: true, force: true });
await mkdir(candidatesRoot, { recursive: true });

const sourceEntries = await fetchJson<NigeriaLogosEntry[]>(sourceDataUrl);
const pendingInstitutions = institutions.filter((institution) => !hasAcceptedLogo(institution));
const matched = matchEntries(sourceEntries, pendingInstitutions);
const candidateEntries = await mapWithConcurrency(matched.matches, concurrency, downloadMatch);
const output = {
  generated_at: new Date().toISOString(),
  source: {
    website: sourceBaseUrl,
    dataset: sourceDataUrl,
    repository: sourceRepositoryUrl,
    license: "MIT",
    note: "Nigeria Logos is a third-party discovery source. Logo trademarks remain owned by their respective institutions."
  },
  policy: "These files are review candidates only. Do not add them to the approved catalog until the artwork is confirmed on an institution-owned official source.",
  summary: {
    source_entries: sourceEntries.length,
    institutions: institutions.length,
    accepted_logos: logoCatalog.length,
    pending_institutions: pendingInstitutions.length,
    matched_institutions: candidateEntries.length,
    downloaded_files: candidateEntries.flatMap((entry) => entry.candidate_assets).filter((asset) => asset.local_path).length,
    download_failures: candidateEntries.flatMap((entry) => entry.candidate_assets).filter((asset) => asset.error).length,
    ambiguous_source_entries: matched.ambiguous.length
  },
  entries: candidateEntries.sort((a, b) => a.brand_name.localeCompare(b.brand_name)),
  ambiguous: matched.ambiguous
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Matched ${output.summary.matched_institutions} pending institutions and saved ` +
  `${output.summary.downloaded_files} Nigeria Logos review files.`
);

function normalize(value: string): string {
  return tokenize(value).join("");
}

function tokenize(value: string): string[] {
  return value.toLowerCase().replace(/&/g, " and ").split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !legalTerms.has(token));
}

function institutionNames(institution: Institution): string[] {
  return [institution.legal_name ?? "", institution.brand_name, ...institution.aliases, institution.slug]
    .filter(Boolean);
}

function hasAcceptedLogo(institution: Institution): boolean {
  const linkedSlug = institutionLogoLinks[institution.slug] ?? institution.logo_slug;
  if (linkedSlug && logoCatalog.some((logo) => logo.slug === linkedSlug)) return true;
  const acceptedNames = logoCatalog.flatMap((logo) => [logo.name, logo.slug, ...logo.aliases]).map(normalize);
  return institutionNames(institution).map(normalize)
    .some((name) => name.length > 3 && acceptedNames.includes(name));
}

function domain(url: string | null): string {
  try {
    return new URL(url ?? "").hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function domainKey(url: string | null): string {
  const hostname = domain(url);
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;
  const countrySuffix = new Set(["co", "com", "net", "org"]);
  return parts.slice(countrySuffix.has(parts.at(-2) ?? "") ? -3 : -2).join(".");
}

function isAlreadyRepresentedSource(source: NigeriaLogosEntry): boolean {
  const sourceNames = [source.title, source.filename].map(normalize);
  const sourceDomain = domainKey(source.url);
  return logoCatalog.some((logo) => {
    const acceptedNames = [logo.name, logo.slug, ...logo.aliases].map(normalize);
    return sourceNames.some((name) => name.length > 3 && acceptedNames.includes(name)) ||
      Boolean(sourceDomain && sourceDomain === domainKey(logo.website));
  });
}

function matchBasis(source: NigeriaLogosEntry, institution: Institution): MatchBasis | null {
  const sourceNames = [source.title, source.filename];
  const targetNames = institutionNames(institution);
  const sourceDomain = domain(source.url);
  const institutionDomain = domain(institution.website);
  if (sourceDomain && institutionDomain && (
    sourceDomain === institutionDomain ||
    sourceDomain.endsWith(`.${institutionDomain}`) ||
    institutionDomain.endsWith(`.${sourceDomain}`)
  )) return "official-domain";

  if (sourceNames.some((name) => {
    const key = normalize(name);
    return key.length > 3 && targetNames.some((target) => normalize(target) === key);
  })) return "exact-name-or-alias";

  if (targetNames.some((target) => differsOnlyByGenericSuffix(tokenize(source.title), tokenize(target)))) {
    return "generic-legal-suffix";
  }
  return null;
}

function differsOnlyByGenericSuffix(left: string[], right: string[]): boolean {
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length === 0 || longer.length === shorter.length) return false;
  if (!shorter.every((token, index) => token === longer[index])) return false;
  return longer.slice(shorter.length).every((token) => allowedSuffixTerms.has(token));
}

function matchEntries(sourceEntries: NigeriaLogosEntry[], pending: Institution[]) {
  const matches: Array<{ source: NigeriaLogosEntry; institution: Institution; basis: MatchBasis }> = [];
  const ambiguous: Array<{ source_title: string; source_filename: string; institution_slugs: string[] }> = [];
  for (const source of sourceEntries) {
    if (isAlreadyRepresentedSource(source)) continue;
    const candidates = pending.flatMap((institution) => {
      const basis = matchBasis(source, institution);
      return basis ? [{ source, institution, basis }] : [];
    });
    if (candidates.length === 1) matches.push(candidates[0]);
    if (candidates.length > 1) {
      ambiguous.push({
        source_title: source.title,
        source_filename: source.filename,
        institution_slugs: candidates.map((candidate) => candidate.institution.slug).sort()
      });
    }
  }
  return { matches, ambiguous };
}

async function downloadMatch(match: { source: NigeriaLogosEntry; institution: Institution; basis: MatchBasis }): Promise<CandidateEntry> {
  const { source, institution, basis } = match;
  const assets = await Promise.all((["svg", "png"] as const).map(async (format): Promise<CandidateAsset> => {
    const sourceUrl = `${sourceBaseUrl}/logos/${source.filename}/${source.filename}.${format}`;
    try {
      const response = await fetch(sourceUrl, {
        headers: { "user-agent": "awalogo/0.1 (+https://awalogo.com; open-source candidate review)" },
        signal: AbortSignal.timeout(15_000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      validateAsset(bytes, format);
      const directory = join(candidatesRoot, institution.slug);
      await mkdir(directory, { recursive: true });
      const localFile = join(directory, `${source.filename}.${format}`);
      await writeFile(localFile, bytes);
      return {
        format,
        source_url: sourceUrl,
        local_path: relative(packageRoot, localFile).replaceAll("\\", "/"),
        sha256: createHash("sha256").update(bytes).digest("hex")
      };
    } catch (error) {
      return {
        format,
        source_url: sourceUrl,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }));

  return {
    institution_slug: institution.slug,
    brand_name: institution.brand_name,
    verification_status: institution.verification_status,
    regulatory_status: institution.regulatory_status,
    match_basis: basis,
    source_title: source.title,
    source_filename: source.filename,
    source_categories: source.category,
    source_page: sourceBaseUrl,
    official_website_hint: /^https?:\/\//i.test(source.url) ? source.url : null,
    status: assets.some((asset) => asset.local_path) ? "needs-official-source" : "download-failed",
    candidate_assets: assets
  };
}

function validateAsset(bytes: Buffer, format: "svg" | "png") {
  if (format === "png") {
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      throw new Error("Invalid PNG signature");
    }
    return;
  }
  const markup = bytes.toString("utf8");
  if (!/<svg[\s>]/i.test(markup)) throw new Error("Missing SVG root");
  if (/<script|\son[a-z]+\s*=|(?:href|src)\s*=\s*["']https?:/i.test(markup)) {
    throw new Error("Unsafe SVG content");
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "user-agent": "awalogo/0.1 (+https://awalogo.com; open-source candidate review)" },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  return await response.json() as T;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  }));
  return results;
}

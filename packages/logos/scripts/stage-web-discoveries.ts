import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const report = JSON.parse(await readFile(join(packageRoot, "sourcing/web-discovery-report.json"), "utf8")) as Report;
const promotions: Promotion[] = [];
const links: Record<string, string> = {};
const rejected: Array<{ card_slug: string; reason: string }> = [];

for (const entry of report.entries) {
  const asset = selectAsset(entry);
  if (!asset) {
    if (entry.website) rejected.push({ card_slug: entry.card_slug, reason: rejectionReason(entry) });
    continue;
  }
  promotions.push({
    institution_slug: entry.card_slug,
    candidate_path: asset.local_path,
    source_url: asset.source_url,
    source_type: "official-website",
    status: "needs-review",
    website: entry.website,
    added_at: "2026-07-15",
    updated_at: "2026-07-15"
  });
  for (const slug of entry.institution_slugs) links[slug] = entry.card_slug;
}

promotions.sort((a, b) => a.institution_slug.localeCompare(b.institution_slug));
const sortedLinks = Object.fromEntries(Object.entries(links).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(join(packageRoot, "sourcing/web-discovery-promotions.json"), JSON.stringify(promotions, null, 2) + "\n");
await writeFile(join(packageRoot, "sourcing/web-discovery-links.json"), JSON.stringify(sortedLinks, null, 2) + "\n");
await writeFile(join(packageRoot, "sourcing/web-discovery-staging-report.json"), JSON.stringify({
  generated_at: new Date().toISOString(),
  policy: "Staged web discoveries remain needs-review until a maintainer visually confirms the official artwork.",
  summary: { staged: promotions.length, linked_institutions: Object.keys(sortedLinks).length, rejected: rejected.length },
  rejected
}, null, 2) + "\n");
console.log(`Staged ${promotions.length} official-site logo candidates and ${Object.keys(sortedLinks).length} institution links as needs-review.`);

function selectAsset(entry: ReportEntry): CandidateAsset | null {
  if (!entry.website || entry.website_score < 62 || (entry.identity_score ?? 0) < 50 || !hasNigeriaContext(entry)) return null;
  return entry.candidate_assets
    .filter((asset): asset is CandidateAsset & { local_path: string } =>
      Boolean(asset.local_path) && isOwnedLogoCandidate(asset, entry.display_name) && sameOrganization(entry.website!, asset.source_url)
    )
    .sort((a, b) => assetRank(a, entry.display_name) - assetRank(b, entry.display_name))[0] ?? null;
}

function isOwnedLogoCandidate(asset: CandidateAsset, displayName: string): boolean {
  if (/(?:partner|client|customer|compliance|certif|iso|award)/i.test(asset.descriptor)) return false;
  const identity = displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const assetPath = safeAssetPath(asset.source_url);
  const candidateIdentity = `${asset.descriptor} ${assetPath}`.toLowerCase().replace(/[^a-z0-9]/g, "");
  return asset.confidence === "high" ||
    /(?:brand[_ -]?logo|wordmark|logomark|\/logo[._/-])/i.test(`${asset.descriptor} ${asset.source_url}`) ||
    (identity.length >= 4 && candidateIdentity.includes(identity));
}

function assetRank(asset: CandidateAsset, displayName: string): number {
  const descriptor = asset.descriptor.toLowerCase();
  const variantPenalty = /white|light|inverse|inverted|footer/.test(descriptor) ? 20 : 0;
  const formatRank = asset.format === "svg" ? 0 : asset.format === "png" ? 4 : 8;
  const squarePenalty = asset.width && asset.height && asset.width / asset.height < 1.5 ? 10 : 0;
  const identity = displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const candidateIdentity = `${asset.descriptor} ${safeAssetPath(asset.source_url)}`.toLowerCase().replace(/[^a-z0-9]/g, "");
  const identityBonus = identity.length >= 4 && candidateIdentity.includes(identity) ? -8 : 0;
  return variantPenalty + formatRank + squarePenalty + identityBonus;
}

function safeAssetPath(sourceUrl: string): string {
  try { return new URL(sourceUrl).pathname; } catch { return sourceUrl; }
}

function rejectionReason(entry: ReportEntry): string {
  if (entry.website_score < 62) return "website score below staging threshold";
  if ((entry.identity_score ?? 0) < 50) return "page identity score below staging threshold";
  if (!hasNigeriaContext(entry)) return "official-site result has no Nigeria context";
  if (!entry.candidate_assets.some((asset) => asset.local_path)) return "no downloadable logo candidate";
  if (!entry.candidate_assets.some((asset) => asset.local_path && asset.confidence === "high")) return "no explicit high-confidence logo markup";
  return "asset host does not match the institution website";
}

function hasNigeriaContext(entry: ReportEntry): boolean {
  if (!entry.website) return false;
  const host = new URL(entry.website).hostname.toLowerCase();
  if (/\.ng$/.test(host)) return true;
  const organization = rootDomain(host);
  const evidence = entry.search_results
    .filter((result) => {
      try { return rootDomain(new URL(result.url).hostname) === organization; } catch { return false; }
    })
    .map((result) => `${result.title} ${result.snippet}`).join(" ");
  return /\b(?:nigeria|nigerian|lagos|abuja)\b/i.test(evidence);
}

function sameOrganization(website: string, asset: string): boolean {
  try {
    return rootDomain(new URL(website).hostname) === rootDomain(new URL(asset).hostname);
  } catch {
    return false;
  }
}

function rootDomain(hostname: string): string {
  const parts = hostname.toLowerCase().replace(/^www\./, "").split(".");
  const suffix = parts.slice(-2).join(".");
  if (["com.ng", "org.ng", "net.ng", "gov.ng", "co.uk"].includes(suffix)) return parts.slice(-3).join(".");
  return suffix;
}

type CandidateAsset = {
  source_url: string;
  format: "svg" | "png" | "webp" | "jpeg" | "avif";
  descriptor: string;
  confidence: "high" | "medium";
  local_path?: string;
  width?: number | null;
  height?: number | null;
};
type ReportEntry = {
  card_slug: string;
  display_name: string;
  institution_slugs: string[];
  website: string | null;
  website_score: number;
  identity_score?: number;
  search_results: Array<{ url: string; title: string; snippet: string }>;
  candidate_assets: CandidateAsset[];
};
type Report = { entries: ReportEntry[] };
type Promotion = {
  institution_slug: string;
  candidate_path: string;
  source_url: string;
  source_type: "official-website";
  status: "needs-review";
  website: string;
  added_at: string;
  updated_at: string;
};

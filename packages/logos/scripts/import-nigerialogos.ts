import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import type { Institution, InstitutionCategory } from "../../institutions/src";

const repository = "PaystackHQ/nigerialogos";
const branch = "master";
const snapshotDate = "2026-07-14";
const rawRoot = `https://raw.githubusercontent.com/${repository}/${branch}`;
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const institutionCandidatesPath = join(packageRoot, "../institutions/data/community-candidates.json");
const promotionsPath = join(packageRoot, "sourcing/nigerialogos-promotions.json");
const reportPath = join(packageRoot, "sourcing/nigerialogos-report.json");

type NigeriaLogo = {
  title: string;
  filename: string;
  url: string;
  category: string[];
};

const existingLogoFiles = new Set([
  "access_bank", "aella_credit", "afrinvest", "axa_mansard", "branch", "busha",
  "carbon", "cowrywise", "credpal", "ecobank", "fidelity_bank", "fincra", "first_bank",
  "fcmb", "flutterwave", "fsdh", "globus_bank", "guaranty_trust_bank", "hervest",
  "interswitch", "keystone_bank", "kuda_bank", "moniepoint", "onepipe", "paga", "paystack",
  "piggyvest", "polaris_bank", "quidax", "ren_money", "stanbic_ibtc", "standard_chartered",
  "sterling_bank", "sycamore", "union_bank", "united_bank_for_africa", "wema_bank", "zenith_bank"
]);

const excludedFiles: Record<string, string> = {
  abeg: "superseded by PocketApp; retained as a searchable alias",
  heritage_bank: "revoked institution already recorded in the inactive ledger",
  mainstreet_bank: "superseded bank brand",
  paylater: "superseded by Carbon"
};

const existingInstitutionSlugs: Record<string, string> = {
  ekondo_microfinance_bank: "ekondo-microfinance-bank",
  eyowo: "eyowo-integrated-payments",
  kora: "kora-payments"
};

const categoryOverrides: Record<string, InstitutionCategory[]> = {
  abeg: ["finance-app", "fintech"],
  africa_fintech_foundry: ["fintech"],
  alat_by_wema: ["finance-app", "fintech"],
  aso_savings_loans: ["primary-mortgage-bank"],
  barter: ["finance-app", "fintech"],
  brass: ["fintech"],
  buycoins: ["crypto-vasp"],
  ekondo_microfinance_bank: ["microfinance-bank"],
  eyowo: ["payment-solution-service-provider", "payment-terminal-service-provider"],
  fidia: ["fintech"],
  fintellia: ["fintech"],
  fliqpay: ["crypto-vasp"],
  fluidcoins: ["crypto-vasp"],
  fundall: ["finance-app", "fintech"],
  indicina: ["fintech"],
  investment_one: ["stockbroker", "investment-manager"],
  kora: ["payment-solution-service-provider"],
  monnify: ["payment-solution-service-provider", "fintech"],
  mono: ["fintech"],
  nestcoin: ["crypto-vasp", "fintech"],
  okra: ["fintech"],
  optimus_by_afrinvest: ["finance-app", "investment-manager"],
  orchestrate: ["payment-solution-service-provider", "fintech"],
  pandabase: ["investment-manager"],
  pandascrow: ["fintech"],
  patricia: ["crypto-vasp"],
  peerstack: ["fintech"],
  pettysave: ["finance-app", "fintech"],
  pofela: ["crypto-vasp"],
  quickteller: ["finance-app", "fintech"],
  schoolable: ["fintech"],
  seampay: ["fintech"],
  thank_u_cash: ["fintech"],
  thepeer: ["switching-processing", "fintech"],
  ucard_store: ["fintech"],
  ventures_platform: ["investment-manager"],
  verifi: ["fintech"],
  verve: ["card-scheme"],
  wallets_africa: ["fintech"],
  yellowcard: ["crypto-vasp"],
  zap: ["finance-app", "fintech"],
  zazuu: ["remittance-imto", "fintech"]
};

const financialCategory = /financial|bank|fintech|payment|lending|insurance|invest|crypto|saving|pension|mortgage|credit|wealth|broker|remittance|money/i;
const response = await fetch(`${rawRoot}/public/logos.json`);
if (!response.ok) throw new Error(`Nigeria Logos index request failed: ${response.status}`);
const allLogos = await response.json() as NigeriaLogo[];
const financialLogos = allLogos.filter((entry) =>
  entry.category.some((category) => financialCategory.test(category)) || financialCategory.test(entry.title)
).sort((a, b) => a.title.localeCompare(b.title));

const existingCandidates = JSON.parse(await readFile(institutionCandidatesPath, "utf8")) as Institution[];
const preservedCandidates = existingCandidates.filter((entry) =>
  !entry.sources.some((source) => source.url.includes("PaystackHQ/nigerialogos"))
);
const importedInstitutions: Institution[] = [];
const promotions: Array<Record<string, unknown>> = [];
const reportEntries: Array<Record<string, string>> = [];

for (const entry of financialLogos) {
  if (existingLogoFiles.has(entry.filename)) {
    reportEntries.push({ title: entry.title, filename: entry.filename, action: "existing-canonical" });
    continue;
  }
  if (excludedFiles[entry.filename]) {
    reportEntries.push({ title: entry.title, filename: entry.filename, action: "excluded", reason: excludedFiles[entry.filename] });
    continue;
  }

  const categories = categoryOverrides[entry.filename];
  if (!categories) throw new Error(`Missing category mapping for ${entry.filename}`);
  const slug = existingInstitutionSlugs[entry.filename] ?? slugify(entry.filename);
  const sourceUrl = `${rawRoot}/public/logos/${entry.filename}/${entry.filename}.svg`;
  const candidateRelativePath = `nigerialogos-candidates/${entry.filename}/${entry.filename}.svg`;
  const candidatePath = join(packageRoot, "sourcing", candidateRelativePath);
  const assetResponse = await fetch(sourceUrl);
  if (!assetResponse.ok) {
    reportEntries.push({
      title: entry.title,
      filename: entry.filename,
      action: "source-asset-missing",
      reason: `Nigeria Logos returned ${assetResponse.status} for its indexed SVG`
    });
    continue;
  }
  await mkdir(dirname(candidatePath), { recursive: true });
  const svg = normalizeSvg(await assetResponse.text(), entry.filename);
  await writeFile(candidatePath, svg);

  promotions.push({
    institution_slug: slug,
    candidate_path: candidateRelativePath,
    website: normalizeWebsite(entry.url),
    source_url: sourceUrl,
    source_type: "community-catalog",
    status: "needs-review",
    added_at: snapshotDate,
    updated_at: snapshotDate
  });

  if (!existingInstitutionSlugs[entry.filename]) {
    importedInstitutions.push({
      slug,
      legal_name: null,
      brand_name: entry.title,
      aliases: [],
      primary_category: categories[0],
      categories,
      country_code: "NG",
      nigeria_presence: "market-only",
      regulators: [],
      licence_types: [],
      regulatory_status: "unverified",
      verification_status: "community-candidate",
      website: normalizeWebsite(entry.url),
      sources: [{
        url: `https://github.com/${repository}/tree/${branch}/public/logos/${entry.filename}`,
        source_type: "community",
        retrieved_at: snapshotDate
      }],
      logo_slug: slug,
      added_at: snapshotDate,
      updated_at: snapshotDate
    });
  }
  reportEntries.push({ title: entry.title, filename: entry.filename, action: "imported-needs-review", slug });
}

const candidates = [...preservedCandidates, ...importedInstitutions]
  .sort((a, b) => a.brand_name.localeCompare(b.brand_name));
await writeFile(institutionCandidatesPath, JSON.stringify(candidates, null, 2) + "\n");
await writeFile(promotionsPath, JSON.stringify(promotions, null, 2) + "\n");
await writeFile(reportPath, JSON.stringify({
  source: `https://github.com/${repository}`,
  retrieved_at: snapshotDate,
  total_entries: allLogos.length,
  financial_entries: financialLogos.length,
  existing_canonical: reportEntries.filter((entry) => entry.action === "existing-canonical").length,
  imported_needs_review: promotions.length,
  excluded_inactive_or_superseded: reportEntries.filter((entry) => entry.action === "excluded").length,
  source_assets_missing: reportEntries.filter((entry) => entry.action === "source-asset-missing").length,
  entries: reportEntries
}, null, 2) + "\n");

console.log(`Audited ${allLogos.length} Nigeria Logos entries: ${financialLogos.length} financial, ${promotions.length} imported for review.`);

function slugify(value: string): string {
  return value.replace(/_/g, "-").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function normalizeWebsite(value: string): string {
  if (value.startsWith("http://")) return `https://${value.slice(7)}`;
  return value;
}

function normalizeSvg(source: string, filename: string): string {
  const $ = load(source, { xmlMode: true });
  const svg = $("svg").first();
  if (!svg.length) throw new Error(`Missing SVG root for ${filename}`);
  if (!svg.attr("viewBox")) {
    const width = Number.parseFloat(svg.attr("width") ?? "");
    const height = Number.parseFloat(svg.attr("height") ?? "");
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error(`Cannot derive viewBox for ${filename}`);
    }
    svg.attr("viewBox", `0 0 ${width} ${height}`);
  }
  const viewBox = (svg.attr("viewBox") ?? "").trim().split(/[ ,]+/).map(Number);
  const viewBoxWidth = viewBox[2];
  const viewBoxHeight = viewBox[3];
  if (!Number.isFinite(viewBoxWidth) || !Number.isFinite(viewBoxHeight) || viewBoxWidth <= 0 || viewBoxHeight <= 0) {
    throw new Error(`Invalid viewBox for ${filename}`);
  }
  const scale = Math.min(1, 1024 / Math.max(viewBoxWidth, viewBoxHeight));
  svg.attr("width", String(Math.max(1, Math.round(viewBoxWidth * scale))));
  svg.attr("height", String(Math.max(1, Math.round(viewBoxHeight * scale))));
  return `${$.xml()}\n`;
}

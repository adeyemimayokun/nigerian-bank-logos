import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { institutionCatalogSchema, institutionCategories, type Institution } from "../src/schema";
import { mergeCatalog, packageRoot, readJson, snapshotDate } from "./lib";

const dataRoot = join(packageRoot, "data");
const exportsRoot = join(packageRoot, "exports");

async function sourceRecords(): Promise<Institution[]> {
  const importsRoot = join(dataRoot, "regulator-imports");
  const files = (await readdir(importsRoot)).filter((file) => file.endsWith(".json")).sort();
  const imported = (await Promise.all(files.map((file) => readJson<Institution[]>(join(importsRoot, file))))).flat();
  const curated = await readJson<Institution[]>(join(dataRoot, "curated.json"));
  return institutionCatalogSchema.parse([...imported, ...curated]);
}

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join("|") : value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(records: Institution[]): string {
  const headers = [
    "slug", "legal_name", "brand_name", "aliases", "primary_category", "categories",
    "country_code", "nigeria_presence", "regulators", "licence_types", "regulatory_status",
    "verification_status", "website", "source_urls", "source_types", "source_retrieved_at",
    "logo_slug", "added_at", "updated_at"
  ];
  const rows = records.map((record) => [
    record.slug, record.legal_name, record.brand_name, record.aliases, record.primary_category,
    record.categories, record.country_code, record.nigeria_presence, record.regulators,
    record.licence_types, record.regulatory_status, record.verification_status, record.website,
    record.sources.map((source) => source.url), record.sources.map((source) => source.source_type),
    record.sources.map((source) => source.retrieved_at), record.logo_slug, record.added_at, record.updated_at
  ]);
  return [headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n") + "\n";
}

function json(records: Institution[]): string {
  return JSON.stringify(records, null, 2) + "\n";
}

export async function generatedFiles(): Promise<Map<string, string>> {
  const all = mergeCatalog(await sourceRecords());
  const nigerian = all.filter((entry) => entry.nigeria_presence !== "foreign-authorized");
  const foreign = all.filter((entry) => entry.nigeria_presence === "foreign-authorized");
  const categoryTotals = Object.fromEntries(institutionCategories
    .map((category) => [category, all.filter((entry) => entry.categories.includes(category)).length]));
  const report = {
    snapshot_date: snapshotDate,
    generated_at: snapshotDate,
    totals: { nigerian: nigerian.length, foreign_authorized: foreign.length },
    category_totals: categoryTotals,
    sources: [
      { regulator: "CBN", register: "Payment Service Providers", status: "imported" },
      { regulator: "CBN", register: "International Money Transfer Operators", status: "imported" },
      { regulator: "SEC", register: "Registered FinTech Operators", status: "imported" },
      { regulator: "NDIC", register: "Insured Institutions", status: "unavailable-as-structured-list", note: "The public page names institution classes but does not expose institution rows." },
      { regulator: "FCCPC", register: "Digital Money Lenders", status: "imported" },
      { regulator: "NAICOM", register: "Licensed Insurance Institutions", status: "imported" },
      { regulator: "PenCom", register: "Licensed Pension Operators", status: "imported" }
    ],
    known_gaps: [
      "Current structured regulator lists were not publicly extractable for all MFBs, PMBs, finance companies, DFIs, BDCs, and credit bureaus.",
      "Foreign IMTO country codes are inferred from the regulator-listed address and use ZZ when the jurisdiction is not identifiable.",
      "Discount houses remain an explicit zero-record category pending evidence of an active licensee."
    ]
  };
  return new Map([
    [join(exportsRoot, "institutions-ng.json"), json(nigerian)],
    [join(exportsRoot, "institutions-ng.csv"), toCsv(nigerian)],
    [join(exportsRoot, "foreign-authorized-ng.json"), json(foreign)],
    [join(exportsRoot, "foreign-authorized-ng.csv"), toCsv(foreign)],
    [join(exportsRoot, "source-report.json"), JSON.stringify(report, null, 2) + "\n"]
  ]);
}

async function main(): Promise<void> {
  const check = process.argv.includes("--check");
  let changed = false;
  for (const [path, contents] of await generatedFiles()) {
    if (check) {
      const current = await readJsonOrText(path);
      if (current !== contents) {
        console.error(`Generated file is stale: ${path}`);
        changed = true;
      }
    } else {
      await writeFile(path, contents);
    }
  }
  if (changed) process.exitCode = 1;
  else console.log(check ? "Institution exports are current." : "Generated institution JSON, CSV, and source report.");
}

async function readJsonOrText(path: string): Promise<string | null> {
  try { return await (await import("node:fs/promises")).readFile(path, "utf8"); }
  catch { return null; }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();

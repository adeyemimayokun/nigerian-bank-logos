import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Institution, InstitutionCategory } from "../src/schema";

export const snapshotDate = "2026-07-13";
export const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const cbnPaymentsUrl = "https://www.cbn.gov.ng/PaymentsSystem/PSPs.html";
export const cbnImtoUrl = "https://www.cbn.gov.ng/PaymentsSystem/InternationalMoneyTransferOperators.html";
export const secFintechUrl = "https://sec.gov.ng/fintech-and-innovation-hub-finport/registered-fintech-operators/";
export const fccpcLendersUrl = "https://fccpc.gov.ng/registration-of-digital-money-lenders/";
export const pencomPfaUrl = "https://www.pencom.gov.ng/pension-fund-administrators/";
export const pencomPfcUrl = "https://www.pencom.gov.ng/pension-fund-custodians/";
export const naicomInsurersUrl = "https://portal.naicom.gov.ng/Download/AllInsurers.xlsx";
export const naicomBrokersUrl = "https://portal.naicom.gov.ng/Download/AllBrokers.xlsx";

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export function unique(values: string[]): string[] {
  const entries = new Map<string, string>();
  for (const value of values) {
    const cleaned = value.trim();
    if (cleaned && !entries.has(cleaned.toLowerCase())) entries.set(cleaned.toLowerCase(), cleaned);
  }
  return [...entries.values()].sort((a, b) => a.localeCompare(b));
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function cleanText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").replace(/\s+([.,])/g, "$1").trim();
}

export function splitFormerNames(value: string): { name: string; aliases: string[] } {
  const aliases: string[] = [];
  const name = cleanText(value).replace(/\s*\((?:formerly|fromerly)(?: known as)?\s+([^()]+)\)\.?/gi, (_, alias: string) => {
    aliases.push(cleanText(alias));
    return "";
  }).replace(/\.+$/, "").trim();
  return { name, aliases };
}

export function brandFromLegalName(name: string): string {
  return name
    .replace(/\s+(Nigeria\s+)?(Limited|Ltd\.?|Plc|Inc\.?|LLC)$/i, "")
    .trim();
}

export function legalSlug(name: string): string {
  return slugify(name.replace(/\s+(Nigeria\s+)?(Limited|Ltd\.?|Plc|Inc\.?|LLC)$/i, ""));
}

export function makeInstitution(input: {
  name: string;
  category: InstitutionCategory;
  sourceUrl: string;
  regulator: string;
  licenceType: string;
  countryCode?: string;
  presence?: Institution["nigeria_presence"];
  status?: Institution["regulatory_status"];
  brandName?: string;
  aliases?: string[];
}): Institution {
  const former = splitFormerNames(input.name);
  const brandName = input.brandName ?? brandFromLegalName(former.name);
  return {
    slug: legalSlug(former.name),
    legal_name: former.name,
    brand_name: brandName,
    aliases: unique([...former.aliases, ...(input.aliases ?? []), ...(brandName !== former.name ? [former.name] : [])]),
    primary_category: input.category,
    categories: [input.category],
    country_code: input.countryCode ?? "NG",
    nigeria_presence: input.presence ?? "nigerian-company",
    regulators: [input.regulator],
    licence_types: [input.licenceType],
    regulatory_status: input.status ?? "active",
    verification_status: "officially-verified",
    website: null,
    sources: [{ url: input.sourceUrl, source_type: "regulator", retrieved_at: snapshotDate }],
    logo_slug: null,
    added_at: snapshotDate,
    updated_at: snapshotDate
  };
}

export function mergeInstitutions(base: Institution, overlay: Institution): Institution {
  return {
    ...base,
    ...overlay,
    aliases: unique([...base.aliases, ...overlay.aliases]),
    categories: unique([...base.categories, ...overlay.categories]) as InstitutionCategory[],
    regulators: unique([...base.regulators, ...overlay.regulators]),
    licence_types: unique([...base.licence_types, ...overlay.licence_types]),
    sources: [...new Map([...base.sources, ...overlay.sources].map((source) => [source.url, source])).values()]
      .sort((a, b) => a.url.localeCompare(b.url)),
    website: overlay.website ?? base.website,
    logo_slug: overlay.logo_slug ?? base.logo_slug
  };
}

export function mergeCatalog(records: Institution[]): Institution[] {
  const merged = new Map<string, Institution>();
  for (const record of records) {
    const key = canonicalEntityKey(record);
    const current = merged.get(key);
    const normalized = { ...record, aliases: unique(record.aliases) };
    merged.set(key, current ? mergeInstitutions(current, normalized) : normalized);
  }
  return [...merged.values()].sort((a, b) => a.brand_name.localeCompare(b.brand_name));
}

function canonicalEntityKey(record: Institution): string {
  return (record.legal_name ?? record.slug)
    .toLowerCase()
    .replace(/l\.?t\.?d\.?/g, "limited")
    .replace(/\b(nigeria\s+)?(limited|plc|inc|llc)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

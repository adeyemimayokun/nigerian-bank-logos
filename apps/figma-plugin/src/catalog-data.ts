import type { Institution, InstitutionCategory } from "@awalogo/institutions";
import communityCandidatesJson from "../../../packages/institutions/data/community-candidates.json";
import institutionsJson from "../../../packages/institutions/exports/institutions-ng.json";
import { institutionLogoLinks } from "../../../packages/logos/src/institution-links";
import { logos, type LogoWithSvg } from "./logo-data";

export type CatalogItem = {
  institution: Institution;
  institutions: Institution[];
  logo: LogoWithSvg | null;
  displayName: string;
  categories: InstitutionCategory[];
};

export type LogoCatalogItem = CatalogItem & { logo: LogoWithSvg };

const institutions = [...institutionsJson, ...communityCandidatesJson] as Institution[];
const logosBySlug = new Map(logos.map((logo) => [logo.slug, logo]));
const categoryOverrides: Partial<Record<InstitutionCategory, string>> = {
  "crypto-vasp": "Crypto / VASP",
  "development-finance-institution": "Development finance",
  "payment-solution-service-provider": "Payment solutions",
  "payment-terminal-service-provider": "Payment terminals",
  "payment-service-holding-company": "Payment holding company",
  "pension-fund-administrator": "Pension administrator",
  "pension-fund-custodian": "Pension custodian",
  "remittance-imto": "Remittance / IMTO",
  "switching-processing": "Switching / processing"
};
const commonBrandNames: Record<string, string> = {
  "cordros-insurance-brokers": "Cordros",
  "custodian-and-allied-insurance": "Custodian",
  "emple-general-insurance-company": "emPLE",
  "fairmoney-microfinance-bank": "FairMoney",
  "heirs-general-insurance": "Heirs Insurance",
  "kiakia-bits": "KiaKia",
  "palmpay": "PalmPay",
  "pagatech": "Paga",
  "mutual-benefit-assurance": "Mutual Benefits",
  "renmoney-microfinance-bank": "Renmoney",
  "tangerine-general-insurance": "Tangerine",
  "vfd-microfinance-bank": "VBank"
};

const genericBrandWords = new Set([
  "company", "global", "international", "limited", "ltd", "nigeria", "nigerian",
  "payment", "payments", "plc", "service", "services", "solution", "solutions",
  "technologies", "technology"
]);

function brandIdentity(value: string): string {
  const words = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return words.filter((word) => !genericBrandWords.has(word)).join("") || words.join("");
}

function preferredInstitution(records: Institution[]): Institution {
  return [...records].sort((a, b) => {
    const verificationRank = (record: Institution) => record.verification_status === "officially-verified"
      ? 0
      : record.verification_status === "market-verified" ? 1 : 2;
    return verificationRank(a) - verificationRank(b) ||
      Number(Boolean(b.website)) - Number(Boolean(a.website)) ||
      a.brand_name.length - b.brand_name.length ||
      a.slug.localeCompare(b.slug);
  })[0];
}

function mergeCatalogItems(items: CatalogItem[]): CatalogItem[] {
  const groups = new Map<string, CatalogItem[]>();

  for (const item of items) {
    const key = item.logo
      ? `logo:${item.logo.slug}`
      : `brand:${brandIdentity(item.displayName)}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    const institutions = group.flatMap((item) => item.institutions);
    const logo = group.find((item) => item.logo)?.logo ?? null;
    const preferredNames = group.map((item) => item.displayName).sort((a, b) =>
      a.length - b.length || a.localeCompare(b)
    );
    return {
      institution: preferredInstitution(institutions),
      institutions,
      logo,
      displayName: logo
        ? commonBrandNames[logo.slug] ?? logo.name
        : preferredNames[0],
      categories: [...new Set(group.flatMap((item) => item.categories))]
    };
  });
}

const institutionItems: CatalogItem[] = institutions.map((institution) => {
  const logoSlug = institution.logo_slug ?? institutionLogoLinks[institution.slug] ??
    (logosBySlug.has(institution.slug) ? institution.slug : undefined);
  const logo = logoSlug ? logosBySlug.get(logoSlug) ?? null : null;
  const fallbackName = institution.legal_name ?? institution.slug;
  const displayName = logo
    ? commonBrandNames[logo.slug] ?? logo.name
    : institution.brand_name === "N/A" ? fallbackName : institution.brand_name;
  return {
    institution,
    institutions: [institution],
    logo,
    displayName,
    categories: institution.categories
  };
});

export const catalogItems: CatalogItem[] = mergeCatalogItems(institutionItems)
  .sort((a, b) => a.displayName.localeCompare(b.displayName));

export const institutionCount = catalogItems.length;
export const logoCatalogItems = catalogItems.filter(
  (item): item is LogoCatalogItem => item.logo !== null
);
export const availableLogoCount = logoCatalogItems.length;
export const canonicalLogoCount = logos.length;

export const availableInstitutionCategories = [...new Set(
  logoCatalogItems.flatMap((item) => item.categories)
)].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));

export function categoryLabel(category: InstitutionCategory): string {
  return categoryOverrides[category] ?? category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

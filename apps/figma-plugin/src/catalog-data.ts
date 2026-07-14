import type { Institution, InstitutionCategory } from "@nigerian-bank-logos/institutions";
import institutionsJson from "../../../packages/institutions/exports/institutions-ng.json";
import { institutionLogoLinks } from "../../../packages/logos/src/institution-links";
import { logos, type LogoWithSvg } from "./logo-data";

export type CatalogItem = {
  institution: Institution;
  institutions: Institution[];
  logo: LogoWithSvg;
  displayName: string;
  categories: InstitutionCategory[];
};

const institutions = institutionsJson as Institution[];
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
  "cordros-insurance-brokers": "Cordros Insurance Brokers",
  "custodian-and-allied-insurance": "Custodian",
  "fairmoney-microfinance-bank": "FairMoney",
  "kiakia-bits": "KiaKia",
  "palmpay": "PalmPay",
  "pagatech": "Paga",
  "renmoney-microfinance-bank": "Renmoney",
  "vfd-microfinance-bank": "VBank"
};

const institutionsByLogo = new Map<string, Institution[]>();
for (const institution of institutions) {
  const logoSlug = institution.logo_slug ?? institutionLogoLinks[institution.slug] ??
    (logosBySlug.has(institution.slug) ? institution.slug : undefined);
  if (!logoSlug || !logosBySlug.has(logoSlug)) continue;
  institutionsByLogo.set(logoSlug, [...(institutionsByLogo.get(logoSlug) ?? []), institution]);
}

export const catalogItems: CatalogItem[] = [...institutionsByLogo.entries()].map(([logoSlug, groupedInstitutions]) => {
  const logo = logosBySlug.get(logoSlug)!;
  const displayName = commonBrandNames[logoSlug] ?? logo.name;
  const representative = [...groupedInstitutions].sort((a, b) =>
    nameDistance(a.brand_name, displayName) - nameDistance(b.brand_name, displayName)
  )[0];
  return {
    institution: representative,
    institutions: groupedInstitutions,
    logo,
    displayName,
    categories: [...new Set(groupedInstitutions.flatMap((institution) => institution.categories))]
  };
}).sort((a, b) => a.displayName.localeCompare(b.displayName));

export const availableLogoCount = catalogItems.length;
export const canonicalLogoCount = logos.length;

export const availableInstitutionCategories = [...new Set(
  catalogItems.flatMap((item) => item.categories)
)].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));

function nameDistance(name: string, displayName: string): number {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedName = normalize(name);
  const normalizedDisplayName = normalize(displayName);
  if (normalizedName === normalizedDisplayName) return 0;
  if (normalizedName.includes(normalizedDisplayName) || normalizedDisplayName.includes(normalizedName)) {
    return Math.abs(normalizedName.length - normalizedDisplayName.length) + 1;
  }
  return normalizedName.length + normalizedDisplayName.length;
}

export function categoryLabel(category: InstitutionCategory): string {
  return categoryOverrides[category] ?? category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

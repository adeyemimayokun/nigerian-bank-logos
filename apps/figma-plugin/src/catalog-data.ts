import type { Institution, InstitutionCategory } from "@nigerian-bank-logos/institutions";
import institutionsJson from "../../../packages/institutions/exports/institutions-ng.json";
import { institutionLogoLinks } from "../../../packages/logos/src/institution-links";
import { logos, type LogoWithSvg } from "./logo-data";

export type CatalogItem = {
  institution: Institution;
  logo: LogoWithSvg;
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

export const catalogItems: CatalogItem[] = institutions.flatMap((institution) => {
  const logoSlug = institution.logo_slug ?? institutionLogoLinks[institution.slug] ??
    (logosBySlug.has(institution.slug) ? institution.slug : undefined);
  const logo = logoSlug ? logosBySlug.get(logoSlug) : undefined;
  if (!logo) return [];
  return [{
    institution,
    logo
  }];
}).sort((a, b) => a.institution.brand_name.localeCompare(b.institution.brand_name));

export const availableLogoCount = catalogItems.length;

export const availableInstitutionCategories = [...new Set(
  catalogItems.flatMap((item) => item.institution.categories)
)].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));

export function categoryLabel(category: InstitutionCategory): string {
  return categoryOverrides[category] ?? category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

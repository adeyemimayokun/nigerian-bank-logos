export { logoCatalog } from "./catalog";
export { institutionLogoLinks } from "./institution-links";
export {
  logoCatalogSchema,
  logoCategories,
  logoEntrySchema,
  logoFormatSchema,
  logoFormatTypes,
  logoVariationSchema,
  logoStatuses,
  sourceTypes
} from "./schema";
export type {
  LogoCategory,
  LogoEntry,
  LogoFormat,
  LogoFormatType,
  LogoStatus,
  LogoVariation,
  SourceType
} from "./schema";
import type { LogoCategory } from "./schema";
import { logoCatalog } from "./catalog";

export function findLogoBySlug(slug: string) {
  return logoCatalog.find((logo) => logo.slug === slug);
}

export function getLogosByCategory(category: LogoCategory) {
  return logoCatalog.filter((logo) => logo.category === category);
}

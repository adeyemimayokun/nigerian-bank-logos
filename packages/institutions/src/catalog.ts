import communityCandidatesJson from "../data/community-candidates.json";
import excludedInstitutionsJson from "../data/excluded-inactive.json";
import foreignInstitutionsJson from "../exports/foreign-authorized-ng.json";
import institutionsJson from "../exports/institutions-ng.json";
import {
  excludedInstitutionsSchema,
  institutionCatalogSchema,
  type Institution,
  type InstitutionCategory
} from "./schema";

export const institutions = institutionCatalogSchema.parse(institutionsJson);
export const foreignAuthorizedInstitutions = institutionCatalogSchema.parse(foreignInstitutionsJson);
export const communityCandidates = institutionCatalogSchema.parse(communityCandidatesJson);
export const excludedInstitutions = excludedInstitutionsSchema.parse(excludedInstitutionsJson);

export function getInstitutionsByCategory(category: InstitutionCategory): Institution[] {
  return institutions.filter((institution) => institution.categories.includes(category));
}

export function findInstitution(slug: string): Institution | undefined {
  return [...institutions, ...foreignAuthorizedInstitutions].find((entry) => entry.slug === slug);
}

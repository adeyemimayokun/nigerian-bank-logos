import { z } from "zod";

export const institutionCategories = [
  "commercial-bank", "microfinance-bank", "fintech", "crypto-vasp",
  "financial-holding-company", "remittance-imto", "mobile-money-operator",
  "bureau-de-change", "payment-service-bank", "non-interest-bank",
  "primary-mortgage-bank", "merchant-bank", "development-finance-institution",
  "discount-house", "finance-company", "switching-processing",
  "payment-solution-service-provider", "payment-terminal-service-provider",
  "super-agent", "payment-service-holding-company", "card-scheme",
  "clearing-house", "credit-bureau", "digital-lender", "crowdfunding-platform",
  "robo-adviser", "digital-broker", "investment-manager", "insurer", "reinsurer",
  "insurance-broker", "pension-fund-administrator", "pension-fund-custodian"
] as const;

export const nigeriaPresenceValues = [
  "nigerian-company", "foreign-authorized", "market-only"
] as const;
export const regulatoryStatuses = [
  "active", "approval-in-principle", "sandbox", "unverified", "status-unknown"
] as const;
export const verificationStatuses = [
  "officially-verified", "market-verified", "community-candidate"
] as const;
export const institutionSourceTypes = [
  "regulator", "official-website", "association", "publication", "community"
] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const institutionSourceSchema = z.object({
  url: z.string().url(),
  source_type: z.enum(institutionSourceTypes),
  retrieved_at: isoDate
});

export const institutionSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  legal_name: z.string().min(2).nullable(),
  brand_name: z.string().min(2),
  aliases: z.array(z.string().min(1)),
  primary_category: z.enum(institutionCategories),
  categories: z.array(z.enum(institutionCategories)).min(1),
  country_code: z.string().regex(/^[A-Z]{2}$/),
  nigeria_presence: z.enum(nigeriaPresenceValues),
  regulators: z.array(z.string().min(2)),
  licence_types: z.array(z.string().min(2)),
  regulatory_status: z.enum(regulatoryStatuses),
  verification_status: z.enum(verificationStatuses),
  website: z.string().url().nullable(),
  sources: z.array(institutionSourceSchema).min(1),
  logo_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).nullable(),
  added_at: isoDate,
  updated_at: isoDate
}).superRefine((entry, context) => {
  if (!entry.categories.includes(entry.primary_category)) {
    context.addIssue({ code: "custom", path: ["categories"], message: "Must include primary_category." });
  }
  if (entry.verification_status === "officially-verified" &&
      !entry.sources.some((source) => source.source_type === "regulator")) {
    context.addIssue({ code: "custom", path: ["sources"], message: "Officially verified records require a regulator source." });
  }
  if (entry.verification_status === "community-candidate" && entry.regulatory_status !== "unverified") {
    context.addIssue({ code: "custom", path: ["regulatory_status"], message: "Community candidates must remain unverified." });
  }
});

export const institutionCatalogSchema = z.array(institutionSchema);

export const excludedInstitutionSchema = z.object({
  name: z.string().min(2),
  former_categories: z.array(z.enum(institutionCategories)).min(1),
  reason: z.enum(["revoked", "closed", "superseded"]),
  effective_at: isoDate.nullable(),
  source_url: z.string().url(),
  retrieved_at: isoDate
});
export const excludedInstitutionsSchema = z.array(excludedInstitutionSchema);

export type InstitutionCategory = (typeof institutionCategories)[number];
export type Institution = z.infer<typeof institutionSchema>;
export type ExcludedInstitution = z.infer<typeof excludedInstitutionSchema>;

import { describe, expect, it } from "vitest";
import communityCandidates from "../../../packages/institutions/data/community-candidates.json";
import foreignAuthorized from "../../../packages/institutions/exports/foreign-authorized-ng.json";
import institutions from "../../../packages/institutions/exports/institutions-ng.json";
import {
  availableInstitutionCategories,
  availableLogoCount,
  canonicalLogoCount,
  catalogItems,
  institutionCount,
  logoCatalogItems
} from "./catalog-data";
import { logos } from "./logo-data";

describe("institution catalog", () => {
  it("shows every Nigerian and Nigeria-authorized institution", () => {
    const sourceRecords = [...institutions, ...foreignAuthorized, ...communityCandidates];
    const expectedDirectorySize = sourceRecords.length;
    const renderedRecords = catalogItems.flatMap((item) => item.institutions);
    expect(catalogItems.length).toBeLessThan(expectedDirectorySize);
    expect(renderedRecords).toHaveLength(expectedDirectorySize);
    expect(new Set(renderedRecords.map((institution) => institution.slug))).toEqual(
      new Set(sourceRecords.map((institution) => institution.slug))
    );
    expect(institutionCount).toBe(catalogItems.length);
    expect(canonicalLogoCount).toBe(205);
  });

  it("only exposes categories represented by available logo assets", () => {
    const logoCategories = new Set(logoCatalogItems.flatMap((item) => item.categories));

    expect(new Set(availableInstitutionCategories)).toEqual(logoCategories);
    expect(availableInstitutionCategories.every((category) =>
      logoCatalogItems.some((item) => item.categories.includes(category))
    )).toBe(true);
  });

  it("includes foreign-authorized operators in the searchable directory", () => {
    const foreignSlug = foreignAuthorized[0].slug;
    const item = catalogItems.find((entry) =>
      entry.institutions.some((institution) => institution.slug === foreignSlug)
    );

    expect(item?.institutions.some((institution) => institution.nigeria_presence === "foreign-authorized")).toBe(true);
  });

  it("includes unmatched fintech research as unverified candidates", () => {
    const candidate = catalogItems.find((item) => item.institution.slug === "passpoint");

    expect(candidate?.displayName).toBe("Passpoint");
    expect(candidate?.institution.verification_status).toBe("community-candidate");
    expect(candidate?.institution.regulatory_status).toBe("unverified");
    expect(candidate?.logo).toBeNull();
  });

  it("links newly verified fintech discoveries to official assets", () => {
    for (const slug of ["pawapay", "grey", "onafriq"]) {
      const item = catalogItems.find((entry) => entry.institutions.some((institution) => institution.slug === slug));
      expect(item?.logo?.slug).toBe(slug);
      expect(item?.institution.verification_status).toBe("community-candidate");
      expect(item?.logo?.status).toBe("verified");
    }
  });

  it("merges related Flutterwave institutions into the common brand entry", () => {
    const flutterwave = catalogItems.find((item) => item.logo?.slug === "flutterwave");

    expect(flutterwave?.displayName).toBe("Flutterwave");
    expect(flutterwave?.institutions.map((institution) => institution.slug)).toEqual(expect.arrayContaining([
      "flutterwave-tech-payments",
      "flutterwave-technology-solutions"
    ]));
  });

  it("merges every duplicate canonical logo into one catalog entry", () => {
    const logoSlugs = logoCatalogItems.map((item) => item.logo.slug);

    expect(new Set(logoSlugs).size).toBe(logoSlugs.length);
    const custodian = catalogItems.find((item) => item.logo?.slug === "custodian-and-allied-insurance");
    expect(custodian?.displayName).toBe("Custodian");
    expect(custodian?.institutions).toHaveLength(2);
  });

  it("merges related institutions that use byte-identical brand artwork", () => {
    const expectedFamilies = [
      ["cordros-insurance-brokers", "Cordros", 3],
      ["emple-general-insurance-company", "emPLE", 2],
      ["heirs-general-insurance", "Heirs Insurance", 2],
      ["mutual-benefit-assurance", "Mutual Benefits", 2],
      ["tangerine-general-insurance", "Tangerine", 2]
    ] as const;

    for (const [logoSlug, displayName, institutionTotal] of expectedFamilies) {
      const family = catalogItems.find((item) => item.logo?.slug === logoSlug);
      expect(family?.displayName).toBe(displayName);
      expect(family?.institutions).toHaveLength(institutionTotal);
    }
  });

  it("keeps unsourced institutions visible with a pending logo", () => {
    const pending = catalogItems.find((item) => item.institution.slug === "caelum-technologies");

    expect(pending?.displayName).toBe("1-HOUR LOAN");
    expect(pending?.logo).toBeNull();
  });

  it("exposes a logo-only catalog for the public explorer", () => {
    expect(logoCatalogItems).toHaveLength(availableLogoCount);
    expect(logoCatalogItems.every((item) => item.logo !== null)).toBe(true);
  });

  it("hydrates reviewed logo variations with downloadable assets", () => {
    const sycamore = logoCatalogItems.find((item) => item.logo.slug === "sycamore-integrated-solutions");
    const symbol = sycamore?.logo.variations.find((variation) => variation.id === "symbol");
    const busha = logoCatalogItems.find((item) => item.logo.slug === "busha-digital");
    const light = busha?.logo.variations.find((variation) => variation.id === "light");

    expect(symbol?.svg).toContain("<svg");
    expect(symbol?.asset_urls.png).toBeTruthy();
    expect(symbol?.asset_urls.webp).toBeTruthy();
    expect(light?.svg).toContain("<svg");
    expect(light?.asset_urls.png).toBeTruthy();
    expect(light?.asset_urls.webp).toBeTruthy();
    expect(logos.flatMap((logo) => logo.variations)).toHaveLength(40);
    expect(logos.find((logo) => logo.slug === "moniepoint")?.variations.map((variation) => variation.id)).toContain("wordmark");
    expect(logos.find((logo) => logo.slug === "bamboo-system-technology")?.variations.map((variation) => variation.id))
      .toEqual(expect.arrayContaining(["dark", "symbol"]));
  });

  it("bundles an isolated raster preview for every catalog logo", () => {
    for (const logo of logos) {
      expect(logo.asset_urls.png ?? logo.asset_urls.webp ?? logo.asset_urls.jpeg).toBeTruthy();
    }
  });
});

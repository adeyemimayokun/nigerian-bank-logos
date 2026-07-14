import { describe, expect, it } from "vitest";
import communityCandidates from "../../../packages/institutions/data/community-candidates.json";
import institutions from "../../../packages/institutions/exports/institutions-ng.json";
import { availableLogoCount, canonicalLogoCount, catalogItems, institutionCount, logoCatalogItems } from "./catalog-data";
import { logos } from "./logo-data";

describe("institution catalog", () => {
  it("shows every Nigerian institution", () => {
    const expectedDirectorySize = institutions.length + communityCandidates.length;
    expect(catalogItems.length).toBeLessThan(expectedDirectorySize);
    expect(catalogItems.flatMap((item) => item.institutions)).toHaveLength(expectedDirectorySize);
    expect(institutionCount).toBe(catalogItems.length);
    expect(canonicalLogoCount).toBe(196);
  });

  it("includes unmatched fintech research as unverified candidates", () => {
    const candidate = catalogItems.find((item) => item.institution.slug === "pawapay");

    expect(candidate?.displayName).toBe("PawaPay");
    expect(candidate?.institution.verification_status).toBe("community-candidate");
    expect(candidate?.institution.regulatory_status).toBe("unverified");
    expect(candidate?.logo).toBeNull();
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

  it("bundles an isolated raster preview for every catalog logo", () => {
    for (const logo of logos) {
      expect(logo.asset_urls.png ?? logo.asset_urls.webp ?? logo.asset_urls.jpeg).toBeTruthy();
    }
  });
});

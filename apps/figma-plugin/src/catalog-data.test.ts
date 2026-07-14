import { describe, expect, it } from "vitest";
import { canonicalLogoCount, catalogItems } from "./catalog-data";

describe("brand-level catalog", () => {
  it("shows one listing per canonical logo", () => {
    expect(catalogItems).toHaveLength(canonicalLogoCount);
  });

  it("merges related Flutterwave institutions under the common brand", () => {
    const flutterwave = catalogItems.find((item) => item.logo.slug === "flutterwave");

    expect(flutterwave?.displayName).toBe("Flutterwave");
    expect(flutterwave?.institutions.map((institution) => institution.slug)).toEqual(expect.arrayContaining([
      "flutterwave-tech-payments",
      "flutterwave-technology-solutions"
    ]));
    expect(flutterwave?.categories).toEqual(expect.arrayContaining(["remittance-imto", "switching-processing"]));
  });
});

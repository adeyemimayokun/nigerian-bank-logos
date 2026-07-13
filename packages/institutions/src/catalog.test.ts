import { describe, expect, it } from "vitest";
import {
  communityCandidates,
  foreignAuthorizedInstitutions,
  getInstitutionsByCategory,
  institutionCategories,
  institutions
} from "./index";

describe("institution catalog", () => {
  it("contains a substantial regulator-backed snapshot", () => {
    expect(institutions.length).toBeGreaterThan(1_500);
    expect(foreignAuthorizedInstitutions.length).toBeGreaterThan(50);
  });

  it("keeps foreign-authorized operators separate", () => {
    expect(institutions.every((entry) => entry.nigeria_presence !== "foreign-authorized")).toBe(true);
    expect(foreignAuthorizedInstitutions.every((entry) => entry.nigeria_presence === "foreign-authorized")).toBe(true);
  });

  it("supports every declared category, including zero-record categories", () => {
    expect(institutionCategories).toContain("discount-house");
    expect(getInstitutionsByCategory("commercial-bank").length).toBeGreaterThan(20);
    expect(getInstitutionsByCategory("discount-house")).toEqual([]);
  });

  it("never presents community candidates as licensed", () => {
    expect(communityCandidates.every((entry) =>
      entry.verification_status === "community-candidate" && entry.regulatory_status === "unverified"
    )).toBe(true);
  });

  it("is deterministically sorted", () => {
    const names = institutions.map((entry) => entry.brand_name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

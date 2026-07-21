import { describe, expect, it } from "vitest";
import {
  communityCandidates,
  foreignAuthorizedInstitutions,
  getInstitutionsByCategory,
  institutionCategories,
  institutions
} from "./index";
import logoCoverage from "../exports/logo-coverage-report.json";

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

  it("uses PocketApp as the current Abeg Technologies brand", () => {
    const pocket = institutions.find((entry) => entry.slug === "abeg-technologies");

    expect(pocket?.brand_name).toBe("PocketApp");
    expect(pocket?.aliases).toEqual(expect.arrayContaining(["Abeg", "Pocket by PiggyVest"]));
    expect(pocket?.logo_slug).toBe("abeg-technologies");
  });

  it("tracks logo coverage for every Nigerian institution", () => {
    expect(logoCoverage.total_institutions).toBe(institutions.length);
    expect(logoCoverage.linked_to_logo).toBe(173);
    expect(logoCoverage.unresolved_with_website).toBe(0);
    expect(logoCoverage.linked_to_logo + logoCoverage.unresolved).toBe(logoCoverage.total_institutions);
  });
});

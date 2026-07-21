import { describe, expect, it } from "vitest";
import { buildCompanyLogoSubmissionUrl, buildLogoRequestUrl } from "./logo-request";

describe("logo request issue", () => {
  it("builds a structured GitHub request with notification consent", () => {
    const url = new URL(buildLogoRequestUrl({
      institutionName: "Example Finance",
      officialWebsite: "https://example.com/",
      email: "designer@example.com",
      category: "Finance app",
      notes: "The current wordmark is on the press page.",
      notificationConsent: true
    }));

    expect(url.hostname).toBe("github.com");
    expect(url.searchParams.get("title")).toBe("Logo request: Example Finance");
    expect(url.searchParams.get("body")).toContain("Notify me through this GitHub issue");
    expect(url.searchParams.get("body")).toContain("https://example.com/");
    expect(url.searchParams.get("body")).toContain("designer@example.com");
  });

  it("does not request follow-up without consent", () => {
    const url = new URL(buildLogoRequestUrl({
      institutionName: "Example Bank",
      officialWebsite: "",
      email: "",
      category: "Bank",
      notes: "",
      notificationConsent: false
    }));

    expect(url.searchParams.get("body")).toContain("No notification follow-up requested");
    expect(url.searchParams.get("body")).toContain("Not provided");
  });
});

describe("company logo submission issue", () => {
  it("builds a verified company submission with asset details", () => {
    const url = new URL(buildCompanyLogoSubmissionUrl({
      companyName: "Example Finance",
      officialWebsite: "https://example.com/",
      workEmail: "brand@example.com",
      category: "Fintech",
      submitterRole: "Brand manager",
      logoFormat: "SVG",
      logoAssetUrl: "https://example.com/brand/logo.svg",
      brandGuidelinesUrl: "https://example.com/brand/",
      notes: "Use the primary horizontal lockup.",
      rightsConfirmed: true
    }));

    expect(url.searchParams.get("template")).toBe("company-logo-submission.md");
    expect(url.searchParams.get("title")).toBe("Company logo submission: Example Finance");
    expect(url.searchParams.get("body")).toContain("https://example.com/brand/logo.svg");
    expect(url.searchParams.get("body")).toContain("brand@example.com");
    expect(url.searchParams.get("body")).toContain("authorized to submit");
  });
});

import { describe, expect, it } from "vitest";
import { institutionLogoLinks, logoCatalog } from "../../logos/src";
import { validateCatalog } from "./validate";

describe("logo catalog validation", () => {
  it("contains the seed and reviewed promotion catalog", () => {
    expect(logoCatalog).toHaveLength(139);
    expect(logoCatalog.map((logo) => logo.slug)).toEqual(expect.arrayContaining([
      "flutterwave", "moniepoint", "opay", "kuda-microfinance-bank", "leadway-assurance-company",
      "busha-digital", "quidax-technologies", "paystack-payment", "united-bank-for-africa",
      "palmpay", "fairmoney-microfinance-bank", "vfd-microfinance-bank",
      "central-bank-of-nigeria", "securities-and-exchange-commission-nigeria",
      "nigeria-deposit-insurance-corporation", "federal-competition-and-consumer-protection-commission",
      "national-insurance-commission", "investnow", "piggyvest", "risevest", "trove-finance",
      "union-bank-of", "signature-bank", "meristem-securities", "cardinalstone-securities",
      "chapel-hill-denham", "afrinvest-securities", "arm-securities", "cordros-securities"
    ]));
  });

  it("maps shared institution brands to accepted logos", () => {
    const slugs = new Set(logoCatalog.map((logo) => logo.slug));
    for (const logoSlug of Object.values(institutionLogoLinks)) {
      expect(slugs.has(logoSlug)).toBe(true);
    }
  });

  it("has no validation issues", () => {
    expect(validateCatalog()).toEqual([]);
  });

  it("provides PNG and WebP for every accepted logo and preserves available SVGs", () => {
    for (const logo of logoCatalog) {
      expect(logo.formats.map((format) => format.type)).toEqual(expect.arrayContaining(["png", "webp"]));
      expect(logo.formats.some((format) => format.type === "svg")).toBe(Boolean(logo.svg_path));
    }
  });
});

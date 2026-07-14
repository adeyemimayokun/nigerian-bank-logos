import { describe, expect, it } from "vitest";
import { catalogItems } from "./catalog-data";
import { searchScore } from "./catalog-search";

function resultsFor(query: string) {
  return catalogItems
    .map((item) => ({ item, score: searchScore(item, query) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => a.score - b.score || a.item.displayName.localeCompare(b.item.displayName))
    .map(({ item }) => item.displayName);
}

describe("catalog search ranking", () => {
  it("orders direct public-name matches before secondary metadata matches", () => {
    expect(resultsFor("rem").slice(0, 3)).toEqual([
      "Remita Payment Service",
      "REMEDIUM INSURANCE BROKER",
      "NOVAC REMIT"
    ]);
  });

  it("still finds an institution through a merged legal name", () => {
    expect(resultsFor("flutterwave tech payments")[0]).toBe("Flutterwave");
  });
});

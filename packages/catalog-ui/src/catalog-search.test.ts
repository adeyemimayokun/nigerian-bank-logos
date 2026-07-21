import { describe, expect, it } from "vitest";
import { logoCatalogItems } from "./catalog-data";
import { compareCatalogResults, searchScore, type CatalogSortDirection } from "./catalog-search";

function resultsFor(query: string, direction: CatalogSortDirection = "asc") {
  return logoCatalogItems
    .map((item) => ({ item, score: searchScore(item, query) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => compareCatalogResults(a, b, direction))
    .map(({ item }) => item.displayName);
}

describe("catalog search ranking", () => {
  it("orders direct public-name matches first and excludes pending assets", () => {
    const results = resultsFor("rem");

    expect(results[0]).toBe("Remita Payment Service");
    expect(results).not.toContain("REMITIX LIMITED (MUKURU)");
    expect(results).not.toContain("REMITLY");
  });

  it("still finds an institution through a merged legal name", () => {
    expect(resultsFor("flutterwave tech payments")[0]).toBe("Flutterwave");
  });

  it("reverses alphabetical order when descending is selected", () => {
    const ascending = resultsFor("");
    const descending = resultsFor("", "desc");

    expect(descending).toEqual([...ascending].reverse());
  });
});

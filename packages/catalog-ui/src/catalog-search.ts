import type { CatalogItem } from "./catalog-data";

export type CatalogSortDirection = "asc" | "desc";

export function compareCatalogResults(
  a: { item: CatalogItem; score: number },
  b: { item: CatalogItem; score: number },
  direction: CatalogSortDirection
): number {
  const nameOrder = a.item.displayName.localeCompare(b.item.displayName);
  return a.score - b.score || (direction === "asc" ? nameOrder : -nameOrder);
}

export function searchScore(item: CatalogItem, query: string): number {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return 0;

  const brandNames = item.institutions.map((institution) => institution.brand_name);
  const identityTerms = item.institutions.flatMap((institution) => [
    institution.legal_name ?? "",
    institution.slug,
    ...institution.aliases
  ]);
  const regulatoryTerms = item.institutions.flatMap((institution) => [
    ...institution.licence_types,
    ...institution.regulators
  ]);

  return Math.min(
    fieldScore(item.displayName, normalizedQuery, 0),
    ...brandNames.map((value) => fieldScore(value, normalizedQuery, 40)),
    ...identityTerms.map((value) => fieldScore(value, normalizedQuery, 80)),
    ...regulatoryTerms.map((value) => fieldScore(value, normalizedQuery, 120))
  );
}

function fieldScore(value: string, query: string, base: number): number {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return Number.POSITIVE_INFINITY;
  if (normalizedValue === query) return base;
  if (normalizedValue.startsWith(query)) {
    return base + 10 + lengthPenalty(normalizedValue.split(" ")[0], query);
  }

  const words = normalizedValue.split(" ");
  const wordIndex = words.findIndex((word) => word.startsWith(query));
  if (wordIndex >= 0) return base + 20 + wordIndex + lengthPenalty(words[wordIndex], query);

  const phraseIndex = normalizedValue.indexOf(query);
  if (phraseIndex >= 0) return base + 30 + phraseIndex;

  const queryWords = query.split(" ");
  if (queryWords.every((word) => words.some((candidate) => candidate.startsWith(word)))) {
    return base + 35 + Math.abs(words.length - queryWords.length);
  }
  return Number.POSITIVE_INFINITY;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function lengthPenalty(value: string, query: string): number {
  return Math.min(Math.max(value.length - query.length, 0), 9);
}

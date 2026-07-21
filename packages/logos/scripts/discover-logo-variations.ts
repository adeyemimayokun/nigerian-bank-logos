import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import sharp from "sharp";
import { logoCatalog } from "../src/catalog";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcingRoot = join(packageRoot, "sourcing");
const candidateRoot = join(sourcingRoot, "variation-candidates");
const cachePath = join(sourcingRoot, "variation-discovery-cache.json");
const reportPath = join(sourcingRoot, "variation-discovery-report.json");
const options = parseOptions(process.argv.slice(2));
const userAgent = "Mozilla/5.0 (compatible; Awalogo/0.1; +https://awalogo.com/)";
const variationPattern = /\b(?:alternate|alt|black|brandmark|compact|dark|horizontal|icon|inverse|inverted|light|logomark|mark|mono|monochrome|primary|secondary|stacked|symbol|vertical|white|wordmark)\b/i;
const excludedPattern = /\b(?:award|badge|certif|client|compliance|customer|footer-partner|partner|sponsor|testimonial)\b/i;

type Candidate = {
  source_url: string;
  descriptor: string;
  suggested_id: string;
  suggested_name: string;
  format?: "svg" | "png" | "webp" | "jpeg" | "avif";
  local_path?: string;
  sha256?: string;
  visual_sha256?: string;
  width?: number | null;
  height?: number | null;
  distinct_from_primary?: boolean;
  duplicate_of?: string;
  error?: string;
};
type CacheEntry = {
  crawled_at: string;
  website: string;
  resolved_url: string | null;
  status: "candidates" | "none" | "unavailable";
  candidates: Candidate[];
  error?: string;
};
type Cache = Record<string, CacheEntry>;

await mkdir(candidateRoot, { recursive: true });
const cache = await readJson<Cache>(cachePath, {});
const eligible = logoCatalog.filter((logo) => logo.source_type !== "community-catalog");
const selected = eligible.slice(options.offset, options.offset + options.limit);
let completed = 0;

await mapWithConcurrency(selected, options.concurrency, async (logo) => {
  if (!options.refresh && cache[logo.slug]) {
    completed += 1;
    progress();
    return;
  }
  cache[logo.slug] = await discoverVariations(logo);
  completed += 1;
  if (completed % 5 === 0 || completed === selected.length) await writeCache(cache);
  progress();
});

await writeCache(cache);
const entries = eligible.map((logo) => ({
  logo_slug: logo.slug,
  logo_name: logo.name,
  website: logo.website,
  existing_variations: (logo.variations ?? []).map((variation) => variation.id),
  ...(cache[logo.slug] ?? { crawled_at: null, resolved_url: null, status: "unavailable", candidates: [] })
}));
const reviewed = entries.filter((entry) => entry.crawled_at);
const distinct = reviewed.flatMap((entry) => entry.candidates).filter((candidate) => candidate.local_path && candidate.distinct_from_primary && !candidate.duplicate_of);
const report = {
  generated_at: new Date().toISOString(),
  policy: "Variation candidates come from the logo owner's official website and remain review-only until visually confirmed.",
  summary: {
    eligible_official_logos: eligible.length,
    crawled: reviewed.length,
    websites_reached: reviewed.filter((entry) => entry.resolved_url).length,
    logos_with_distinct_candidates: reviewed.filter((entry) => entry.candidates.some((candidate) => candidate.local_path && candidate.distinct_from_primary && !candidate.duplicate_of)).length,
    distinct_candidate_files: distinct.length,
    unavailable: reviewed.filter((entry) => entry.status === "unavailable").length
  },
  entries
};
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(`\nFound ${distinct.length} distinct variation candidates for ${report.summary.logos_with_distinct_candidates} logos.`);

async function discoverVariations(logo: (typeof logoCatalog)[number]): Promise<CacheEntry> {
  await rm(join(candidateRoot, logo.slug), { recursive: true, force: true });
  try {
    const page = await fetchHtml(logo.website);
    const discovered = extractCandidates(page.html, page.url, logo.name);
    const baselineBytes = await readFile(join(packageRoot, "src", logo.source_path));
    const baselineVisual = await visualFingerprint(baselineBytes);
    const saved: Candidate[] = [];
    for (const candidate of discovered.slice(0, 16)) {
      saved.push(await saveCandidate(candidate, logo.slug, saved.length, baselineVisual.pixels, saved));
    }
    return {
      crawled_at: new Date().toISOString(),
      website: logo.website,
      resolved_url: page.url,
      status: saved.some((candidate) => candidate.local_path && candidate.distinct_from_primary && !candidate.duplicate_of) ? "candidates" : "none",
      candidates: saved
    };
  } catch (error) {
    return {
      crawled_at: new Date().toISOString(), website: logo.website, resolved_url: null,
      status: "unavailable", candidates: [], error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function fetchHtml(url: string): Promise<{ url: string; html: string }> {
  const response = await fetch(url, {
    headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml" },
    redirect: "follow", signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`page HTTP ${response.status}`);
  if (!/html/i.test(response.headers.get("content-type") ?? "")) throw new Error("source is not HTML");
  const html = await response.text();
  if (html.length > 6_000_000) throw new Error("page exceeds 6 MB");
  return { url: response.url, html };
}

function extractCandidates(html: string, baseUrl: string, logoName: string): Candidate[] {
  const $ = load(html);
  const found = new Map<string, Candidate>();
  const brand = normalize(logoName);

  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      for (const value of findJsonLogos(JSON.parse($(element).text()))) add(value, "structured data primary logo");
    } catch {
      // Invalid JSON-LD should not stop discovery.
    }
  });

  $("img[src], source[srcset], meta[property='og:logo'][content]").each((_, element) => {
    const node = $(element);
    const raw = node.attr("src") ?? node.attr("content") ?? node.attr("srcset")?.split(/[ ,]/)[0];
    if (!raw) return;
    const assetPath = safePath(raw, baseUrl);
    const identityDescriptor = [node.attr("alt"), node.attr("class"), node.attr("id"), node.attr("aria-label"), assetPath]
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    const descriptor = [identityDescriptor, raw]
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (excludedPattern.test(descriptor)) return;
    if (!/logo|wordmark|logomark|brandmark|symbol/i.test(descriptor)) return;
    const strongVariation = /\b(?:black|brandmark|compact|dark|horizontal|inverse|inverted|light|logomark|mono|monochrome|stacked|symbol|vertical|white|wordmark)\b/i.test(descriptor);
    if (!normalize(identityDescriptor).includes(brand) && !strongVariation) return;
    add(raw, descriptor);
  });

  $("svg").each((index, element) => {
    const node = $(element);
    const descriptor = [node.attr("class"), node.attr("id"), node.attr("aria-label"), node.find("title").first().text()]
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (!/logo|wordmark|logomark|brandmark|symbol/i.test(descriptor) || excludedPattern.test(descriptor)) return;
    const strongVariation = /\b(?:black|brandmark|compact|dark|horizontal|inverse|inverted|light|logomark|mono|monochrome|stacked|symbol|vertical|white|wordmark)\b/i.test(descriptor);
    if (!normalize(descriptor).includes(brand) && !strongVariation) return;
    const markup = $.html(element);
    if (!markup || !isSafeSvg(markup)) return;
    add(`data:image/svg+xml;base64,${Buffer.from(markup).toString("base64")}`, `${descriptor} inline-${index}`);
  });
  return [...found.values()].sort((a, b) => candidateRank(a) - candidateRank(b));

  function add(raw: string, descriptor: string): void {
    try {
      const sourceUrl = raw.startsWith("data:") ? raw : new URL(raw, baseUrl).href;
      if (!raw.startsWith("data:") && !/^https?:/i.test(sourceUrl)) return;
      const label = classifyVariation(descriptor);
      const key = raw.startsWith("data:") ? createHash("sha1").update(raw).digest("hex") : sourceUrl;
      found.set(key, { source_url: sourceUrl, descriptor: descriptor.slice(0, 260), ...label });
    } catch {
      // Ignore malformed references.
    }
  }
}

function safePath(raw: string, baseUrl: string): string {
  try { return new URL(raw, baseUrl).pathname; } catch { return raw; }
}

async function saveCandidate(candidate: Candidate, slug: string, index: number, baselineVisual: Buffer, saved: Candidate[]): Promise<Candidate> {
  try {
    const bytes = candidate.source_url.startsWith("data:image/svg+xml;base64,")
      ? Buffer.from(candidate.source_url.split(",", 2)[1], "base64")
      : await download(candidate.source_url);
    const metadata = await sharp(bytes, { failOn: "error" }).metadata();
    const format = normalizeFormat(metadata.format);
    const inferred = inferVariation(candidate, metadata.width ?? null, metadata.height ?? null);
    const visual = await visualFingerprint(bytes);
    const duplicate = saved.find((item) => item.visual_sha256 === visual.hash);
    const directory = join(candidateRoot, slug);
    await mkdir(directory, { recursive: true });
    const extension = format === "jpeg" ? "jpg" : format;
    const fileName = `${String(index + 1).padStart(2, "0")}-${inferred.suggested_id}.${extension}`;
    await writeFile(join(directory, fileName), bytes);
    return {
      ...candidate,
      ...inferred,
      source_url: candidate.source_url.startsWith("data:") ? `inline:${slug}:${index + 1}` : candidate.source_url,
      format,
      local_path: `variation-candidates/${slug}/${fileName}`,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      visual_sha256: visual.hash,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      distinct_from_primary: meanDifference(visual.pixels, baselineVisual) >= 3,
      ...(duplicate?.local_path ? { duplicate_of: duplicate.local_path } : {})
    };
  } catch (error) {
    return { ...candidate, error: error instanceof Error ? error.message : String(error) };
  }
}

function inferVariation(candidate: Candidate, width: number | null, height: number | null): Pick<Candidate, "suggested_id" | "suggested_name"> {
  if (candidate.suggested_id !== "alternate" || !width || !height) {
    return { suggested_id: candidate.suggested_id, suggested_name: candidate.suggested_name };
  }
  const ratio = width / height;
  if (ratio <= 1.35) return { suggested_id: "symbol", suggested_name: "Symbol" };
  if (ratio >= 2.4) return { suggested_id: "wordmark", suggested_name: "Wordmark" };
  return { suggested_id: "alternate", suggested_name: "Alternate" };
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { "user-agent": userAgent, accept: "image/*,*/*;q=0.5" },
    redirect: "follow", signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`asset HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 6_000_000) throw new Error("asset exceeds 6 MB");
  return bytes;
}

async function visualFingerprint(bytes: Buffer): Promise<{ hash: string; pixels: Buffer }> {
  const pixels = await sharp(bytes, { density: 200 })
    .trim({ background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .resize(128, 128, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .ensureAlpha().raw().toBuffer();
  return { hash: createHash("sha256").update(pixels).digest("hex"), pixels };
}

function meanDifference(a: Buffer, b: Buffer): number {
  if (a.length !== b.length) return 255;
  let total = 0;
  for (let index = 0; index < a.length; index += 1) total += Math.abs(a[index] - b[index]);
  return total / a.length;
}

function classifyVariation(descriptor: string): { suggested_id: string; suggested_name: string } {
  const value = descriptor.toLowerCase();
  const labels = ["symbol", "logomark", "brandmark", "wordmark", "horizontal", "vertical", "stacked", "compact", "light", "white", "dark", "black", "mono", "monochrome", "secondary", "alternate"];
  const match = labels.find((label) => value.includes(label));
  const id = match === "logomark" || match === "brandmark" ? "symbol"
    : match === "white" || match === "inverse" ? "light"
      : match === "black" ? "dark" : match ?? "alternate";
  return { suggested_id: id, suggested_name: id.charAt(0).toUpperCase() + id.slice(1) };
}

function candidateRank(candidate: Candidate): number {
  return Number(!variationPattern.test(candidate.descriptor)) * 10 + Number(!/\.svg(?:$|[?#])/i.test(candidate.source_url));
}

function findJsonLogos(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(findJsonLogos);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    if (key.toLowerCase() === "logo") {
      if (typeof child === "string") return [child];
      if (child && typeof child === "object" && typeof (child as { url?: unknown }).url === "string") return [(child as { url: string }).url];
    }
    return findJsonLogos(child);
  });
}

function normalizeFormat(format?: string): NonNullable<Candidate["format"]> {
  if (format === "jpg") return "jpeg";
  if (format === "svg" || format === "png" || format === "webp" || format === "jpeg" || format === "avif") return format;
  throw new Error(`unsupported image format: ${format ?? "unknown"}`);
}

function isSafeSvg(value: string): boolean {
  return !/<script|<foreignObject|\son[a-z]+\s*=|(?:href|src)\s*=\s*["']https?:/i.test(value);
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

async function writeCache(cache: Cache): Promise<void> {
  await writeFile(cachePath, JSON.stringify(Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b))), null, 2) + "\n");
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  return existsSync(path) ? JSON.parse(await readFile(path, "utf8")) as T : fallback;
}

function parseOptions(args: string[]): { limit: number; offset: number; concurrency: number; refresh: boolean } {
  const value = (name: string, fallback: number) => {
    const index = args.indexOf(name);
    return index >= 0 ? Number(args[index + 1]) : fallback;
  };
  return { limit: value("--limit", Number.POSITIVE_INFINITY), offset: value("--offset", 0), concurrency: Math.max(1, value("--concurrency", 6)), refresh: args.includes("--refresh") };
}

async function mapWithConcurrency<T, R>(values: T[], limit: number, mapper: (value: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  async function worker() { while (next < values.length) { const index = next++; results[index] = await mapper(values[index]); } }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

function progress(): void {
  if (completed % 10 === 0 || completed === selected.length) process.stdout.write(`\rProcessed ${completed}/${selected.length}`);
}

import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LogoFormat, LogoVariation } from "../src/schema";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const promotions = JSON.parse(await readFile(join(packageRoot, "sourcing/variation-promotions.json"), "utf8")) as Promotion[];
const variationPath = join(packageRoot, "src/variations.json");
const existing = JSON.parse(await readFile(variationPath, "utf8")) as Record<string, LogoVariation[]>;
const assetsRoot = join(packageRoot, "src/assets");
const sourcesRoot = join(packageRoot, "src/sources");
await mkdir(assetsRoot, { recursive: true });
await mkdir(sourcesRoot, { recursive: true });

for (const promotion of promotions) {
  const sourceExtension = normalizeExtension(extname(promotion.candidate_path));
  const baseName = `${promotion.logo_slug}-${promotion.id}`;
  const sourcePath = `sources/${baseName}.${sourceExtension}`;
  const candidateFile = join(packageRoot, "sourcing", promotion.candidate_path);
  if (!existsSync(candidateFile)) throw new Error(`Missing variation candidate: ${promotion.candidate_path}`);
  const bytes = await readFile(candidateFile);
  const normalizedBytes = sourceExtension === "svg"
    ? Buffer.from(normalizeSvg(bytes.toString("utf8"), promotion.logo_slug, promotion.id))
    : bytes;
  await writeFile(join(packageRoot, "src", sourcePath), normalizedBytes);

  const formats: LogoFormat[] = [];
  let svgPath: string | null = null;
  if (sourceExtension === "svg") {
    svgPath = `assets/${baseName}.svg`;
    await writeFile(join(packageRoot, "src", svgPath), normalizedBytes);
    formats.push({ type: "svg", path: svgPath, mime_type: "image/svg+xml", width: null, height: null });
  }
  formats.push(
    { type: "png", path: `assets/${baseName}.png`, mime_type: "image/png", width: null, height: null },
    { type: "webp", path: `assets/${baseName}.webp`, mime_type: "image/webp", width: null, height: null }
  );
  if (sourceExtension === "jpg") {
    const jpegPath = `assets/${baseName}.jpg`;
    await copyFile(candidateFile, join(packageRoot, "src", jpegPath));
    formats.push({ type: "jpeg", path: jpegPath, mime_type: "image/jpeg", width: null, height: null });
  }

  const variation: LogoVariation = {
    id: promotion.id,
    name: promotion.name,
    source_url: promotion.source_url,
    source_path: sourcePath,
    svg_path: svgPath,
    formats
  };
  existing[promotion.logo_slug] = [
    ...(existing[promotion.logo_slug] ?? []).filter((entry) => entry.id !== promotion.id),
    variation
  ].sort((a, b) => a.name.localeCompare(b.name));
}

const sorted = Object.fromEntries(Object.entries(existing).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(variationPath, JSON.stringify(sorted, null, 2) + "\n");
console.log(`Staged ${promotions.length} reviewed variations across ${new Set(promotions.map((entry) => entry.logo_slug)).size} logos.`);

function normalizeExtension(extension: string): "svg" | "png" | "webp" | "jpg" {
  const value = extension.toLowerCase().replace(/^\./, "");
  if (value === "jpeg") return "jpg";
  if (value === "svg" || value === "png" || value === "webp" || value === "jpg") return value;
  throw new Error(`Unsupported variation format: ${extension}`);
}

function normalizeSvg(value: string, slug: string, id: string): string {
  const svgStart = value.search(/<svg[\s>]/i);
  if (svgStart < 0) throw new Error(`Invalid SVG variation: ${slug}/${id}`);
  const normalized = value.slice(svgStart);
  if (!/<svg[^>]*\bviewBox\s*=/i.test(normalized)) throw new Error(`SVG variation has no viewBox: ${slug}/${id}`);
  if (/<script|<foreignObject|\son[a-z]+\s*=|(?:href|src)\s*=\s*["']https?:/i.test(normalized)) {
    throw new Error(`Unsafe SVG variation: ${slug}/${id}`);
  }
  return normalized;
}

type Promotion = {
  logo_slug: string;
  candidate_path: string;
  source_url: string;
  id: string;
  name: string;
};

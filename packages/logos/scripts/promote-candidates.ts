import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { InstitutionCategory } from "../../institutions/src";
import { institutions } from "../../institutions/src";
import type { LogoCategory, LogoEntry, LogoFormat, SourceType } from "../src/schema";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const promotions = JSON.parse(await readFile(join(packageRoot, "sourcing/promotions.json"), "utf8")) as Array<{
  institution_slug: string;
  candidate_path: string;
  source_url?: string;
  source_type?: SourceType;
  website?: string;
  added_at?: string;
  updated_at?: string;
}>;
const queue = JSON.parse(await readFile(join(packageRoot, "sourcing/queue.json"), "utf8")) as {
  entries: Array<{
    institution_slug: string;
    website: string | null;
    candidate_assets: Array<{ source_url: string; local_path?: string }>;
  }>;
};
const previousCatalog = JSON.parse(await readFile(join(packageRoot, "src/promoted-catalog.json"), "utf8")) as LogoEntry[];
const assetsRoot = join(packageRoot, "src/assets");
const sourcesRoot = join(packageRoot, "src/sources");
await mkdir(assetsRoot, { recursive: true });
await mkdir(sourcesRoot, { recursive: true });

const catalog: LogoEntry[] = [];
for (const promotion of promotions) {
  const institution = institutions.find((entry) => entry.slug === promotion.institution_slug);
  const queued = queue.entries.find((entry) => entry.institution_slug === promotion.institution_slug);
  const candidate = queued?.candidate_assets.find((asset) => asset.local_path === promotion.candidate_path);
  const previous = previousCatalog.find((entry) => entry.slug === promotion.institution_slug);
  const website = promotion.website ?? queued?.website ?? previous?.website ?? institution?.website;
  const sourceUrl = promotion.source_url ?? candidate?.source_url ?? previous?.source_url;
  if (!institution || !website || !sourceUrl) throw new Error(`Incomplete promotion: ${promotion.institution_slug}`);

  const sourceExtension = normalizeExtension(extname(promotion.candidate_path));
  const sourceRelativePath = `sources/${institution.slug}.${sourceExtension}`;
  const candidateFile = join(packageRoot, "sourcing", promotion.candidate_path);
  const stableSourceFile = join(packageRoot, "src", sourceRelativePath);
  if (existsSync(candidateFile)) await copyFile(candidateFile, stableSourceFile);
  else if (!existsSync(stableSourceFile)) throw new Error(`Missing promoted source: ${promotion.institution_slug}`);

  if (sourceExtension === "svg") {
    const source = await readFile(stableSourceFile, "utf8");
    const svgStart = source.search(/<svg[\s>]/i);
    if (svgStart < 0) throw new Error(`Missing SVG root: ${promotion.institution_slug}`);
    await writeFile(stableSourceFile, source.slice(svgStart));
  }

  const formats: LogoFormat[] = [];
  let svgPath: string | null = null;
  if (sourceExtension === "svg") {
    svgPath = `assets/${institution.slug}.svg`;
    await copyFile(join(packageRoot, "src", sourceRelativePath), join(packageRoot, "src", svgPath));
    formats.push({ type: "svg", path: svgPath, mime_type: "image/svg+xml", width: null, height: null });
  }
  formats.push(
    { type: "png", path: `assets/${institution.slug}.png`, mime_type: "image/png", width: null, height: null },
    { type: "webp", path: `assets/${institution.slug}.webp`, mime_type: "image/webp", width: null, height: null }
  );
  if (sourceExtension === "jpg") {
    const jpegPath = `assets/${institution.slug}.jpg`;
    await copyFile(join(packageRoot, "src", sourceRelativePath), join(packageRoot, "src", jpegPath));
    formats.push({ type: "jpeg", path: jpegPath, mime_type: "image/jpeg", width: null, height: null });
  }

  catalog.push({
    name: institution.brand_name,
    slug: institution.slug,
    category: logoCategory(institution.primary_category),
    aliases: institution.aliases,
    website,
    source_url: sourceUrl.startsWith("data:") ? website : sourceUrl,
    source_type: promotion.source_type ?? previous?.source_type ?? "official-website",
    source_path: sourceRelativePath,
    svg_path: svgPath,
    formats,
    added_at: promotion.added_at ?? previous?.added_at ?? "2026-07-13",
    updated_at: promotion.updated_at ?? previous?.updated_at ?? "2026-07-13",
    status: "verified"
  });
}

await writeFile(join(packageRoot, "src/promoted-catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
console.log(`Promoted ${catalog.length} reviewed official logo sources.`);

function normalizeExtension(extension: string): "svg" | "png" | "webp" | "jpg" {
  const value = extension.toLowerCase().replace(/^\./, "");
  if (value === "jpeg") return "jpg";
  if (value === "svg" || value === "png" || value === "webp" || value === "jpg") return value;
  throw new Error(`Unsupported promotion format: ${extension}`);
}

function logoCategory(category: InstitutionCategory): LogoCategory {
  if (category === "commercial-bank") return "commercial-bank";
  if (category === "microfinance-bank") return "microfinance-bank";
  if (category === "merchant-bank") return "merchant-bank";
  if (category === "payment-service-bank") return "payment-bank";
  if (["fintech", "crypto-vasp", "digital-lender", "mobile-money-operator"].includes(category)) return "fintech";
  return "other";
}

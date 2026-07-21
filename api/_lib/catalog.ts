import { createHash } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { logoCatalogSchema, logoEntrySchema, logoVariationSchema } from "../../packages/logos/src/schema.js";
import type { FileChange } from "./github.js";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const svgUpload = z.string().min(20).max(1_500_000);
const mutationBase = z.object({ operation: z.string() });

export const mutationSchema = z.discriminatedUnion("operation", [
  mutationBase.extend({
    operation: z.literal("add-logo"),
    name: z.string().trim().min(2).max(100),
    slug,
    category: z.enum(["commercial-bank", "microfinance-bank", "merchant-bank", "payment-bank", "fintech", "other"]),
    aliases: z.array(z.string().trim().min(1).max(100)).max(20),
    website: z.string().url(),
    sourceUrl: z.string().url(),
    sourceType: z.enum(["official-brand-page", "official-website", "annual-report", "verified-pdf", "other-official"]),
    svgBase64: svgUpload
  }),
  mutationBase.extend({ operation: z.literal("remove-logo"), slug, confirmation: z.string() }),
  mutationBase.extend({
    operation: z.literal("add-variation"),
    slug,
    variationId: slug,
    name: z.string().trim().min(2).max(80),
    sourceUrl: z.string().url(),
    svgBase64: svgUpload
  }),
  mutationBase.extend({ operation: z.literal("remove-variation"), slug, variationId: slug, confirmation: z.string() })
]);

export type CatalogMutation = z.infer<typeof mutationSchema>;
type LogoEntry = z.infer<typeof logoEntrySchema>;
type LogoVariation = z.infer<typeof logoVariationSchema>;
type Variations = Record<string, LogoVariation[]>;
type FormatManifest = { version: number; render_settings: unknown; source_sha256: Record<string, string> };

const ROOT = "packages/logos/src/";
const CATALOG_PATH = `${ROOT}promoted-catalog.json`;
const VARIATIONS_PATH = `${ROOT}variations.json`;
const MANIFEST_PATH = `${ROOT}formats-manifest.json`;

function prettyJson(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function decodeSvg(base64: string): Buffer {
  const value = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const buffer = Buffer.from(value, "base64");
  const text = buffer.toString("utf8").trim();
  if (!/^<svg[\s>]/i.test(text) && !/^<\?xml[\s\S]*?<svg[\s>]/i.test(text)) throw new Error("The uploaded file is not an SVG");
  if (!/\bviewBox\s*=\s*["'][^"']+["']/i.test(text)) throw new Error("SVG must include a viewBox");
  if (/<script\b|<foreignObject\b|<!doctype\b|<!entity\b|\bon[a-z]+\s*=|javascript:|data:text\/html/i.test(text)) {
    throw new Error("SVG contains scripts or unsafe embedded content");
  }
  const externalReference = /(?:href|src)\s*=\s*["']\s*(?:https?:)?\/\//i;
  if (externalReference.test(text) || /url\s*\(\s*["']?(?:https?:)?\/\//i.test(text)) throw new Error("SVG cannot load external resources");
  return Buffer.from(text);
}

async function renderedFormats(svg: Buffer): Promise<{ png: Buffer; webp: Buffer }> {
  const pipeline = sharp(svg, { density: 300 }).resize({
    width: 1024,
    height: 1024,
    fit: "inside",
    withoutEnlargement: false
  });
  const [png, webp] = await Promise.all([
    pipeline.clone().png({ compressionLevel: 9, palette: true }).toBuffer(),
    pipeline.clone().webp({ lossless: true, effort: 6 }).toBuffer()
  ]);
  return { png, webp };
}

function formats(fileStem: string) {
  return [
    { type: "svg" as const, path: `assets/${fileStem}.svg`, mime_type: "image/svg+xml" as const, width: null, height: null },
    { type: "png" as const, path: `assets/${fileStem}.png`, mime_type: "image/png" as const, width: null, height: null },
    { type: "webp" as const, path: `assets/${fileStem}.webp`, mime_type: "image/webp" as const, width: null, height: null }
  ];
}

function fileChanges(fileStem: string, svg: Buffer, png: Buffer, webp: Buffer): FileChange[] {
  return [
    { path: `${ROOT}sources/${fileStem}.svg`, content: svg },
    { path: `${ROOT}assets/${fileStem}.svg`, content: svg },
    { path: `${ROOT}assets/${fileStem}.png`, content: png },
    { path: `${ROOT}assets/${fileStem}.webp`, content: webp }
  ];
}

function allReferencedPaths(catalog: LogoEntry[], variations: Variations): Set<string> {
  const paths = new Set<string>();
  for (const logo of catalog) {
    paths.add(logo.source_path);
    for (const format of logo.formats) paths.add(format.path);
  }
  for (const items of Object.values(variations)) {
    for (const variation of items) {
      paths.add(variation.source_path);
      for (const format of variation.formats) paths.add(format.path);
    }
  }
  return paths;
}

function deletionChanges(paths: string[], references: Set<string>): FileChange[] {
  return [...new Set(paths)].filter((path) => !references.has(path)).map((path) => ({ path: `${ROOT}${path}`, content: null }));
}

function variationPaths(variation: LogoVariation): string[] {
  return [variation.source_path, ...variation.formats.map((format) => format.path)];
}

export async function buildMutationChanges(
  mutation: CatalogMutation,
  inputCatalog: unknown,
  inputVariations: unknown,
  inputManifest: FormatManifest
): Promise<{ changes: FileChange[]; title: string; body: string }> {
  const catalog = logoCatalogSchema.parse(inputCatalog);
  const variations = z.record(z.array(logoVariationSchema)).parse(inputVariations);
  const manifest = structuredClone(inputManifest);
  const today = new Date().toISOString().slice(0, 10);
  const changes: FileChange[] = [];

  if (mutation.operation === "add-logo") {
    if (catalog.some((entry) => entry.slug === mutation.slug)) throw new Error(`Logo "${mutation.slug}" already exists`);
    const svg = decodeSvg(mutation.svgBase64);
    const rendered = await renderedFormats(svg);
    const entry = logoEntrySchema.parse({
      name: mutation.name,
      slug: mutation.slug,
      category: mutation.category,
      aliases: mutation.aliases,
      website: mutation.website,
      source_url: mutation.sourceUrl,
      source_type: mutation.sourceType,
      source_path: `sources/${mutation.slug}.svg`,
      svg_path: `assets/${mutation.slug}.svg`,
      formats: formats(mutation.slug),
      added_at: today,
      updated_at: today,
      status: "needs-review"
    });
    catalog.push(entry);
    catalog.sort((a, b) => a.name.localeCompare(b.name));
    manifest.source_sha256[mutation.slug] = createHash("sha256").update(svg).digest("hex");
    changes.push(...fileChanges(mutation.slug, svg, rendered.png, rendered.webp));
  }

  if (mutation.operation === "add-variation") {
    if (!catalog.some((entry) => entry.slug === mutation.slug) && !["moniepoint", "opay", "flutterwave"].includes(mutation.slug)) {
      throw new Error(`Logo "${mutation.slug}" does not exist`);
    }
    const existing = variations[mutation.slug] ?? [];
    if (existing.some((entry) => entry.id === mutation.variationId)) throw new Error(`Variation "${mutation.variationId}" already exists`);
    const fileStem = `${mutation.slug}-${mutation.variationId}`;
    const svg = decodeSvg(mutation.svgBase64);
    const rendered = await renderedFormats(svg);
    existing.push(logoVariationSchema.parse({
      id: mutation.variationId,
      name: mutation.name,
      source_url: mutation.sourceUrl,
      source_path: `sources/${fileStem}.svg`,
      svg_path: `assets/${fileStem}.svg`,
      formats: formats(fileStem)
    }));
    existing.sort((a, b) => a.name.localeCompare(b.name));
    variations[mutation.slug] = existing;
    const catalogEntry = catalog.find((entry) => entry.slug === mutation.slug);
    if (catalogEntry) catalogEntry.updated_at = today;
    manifest.source_sha256[`${mutation.slug}/${mutation.variationId}`] = createHash("sha256").update(svg).digest("hex");
    changes.push(...fileChanges(fileStem, svg, rendered.png, rendered.webp));
  }

  if (mutation.operation === "remove-logo") {
    if (mutation.confirmation !== mutation.slug) throw new Error("Confirmation does not match the logo slug");
    const index = catalog.findIndex((entry) => entry.slug === mutation.slug);
    if (index < 0) throw new Error("This logo is a locked core entry or does not exist in the managed catalog");
    const [removed] = catalog.splice(index, 1);
    const removedVariations = variations[mutation.slug] ?? [];
    delete variations[mutation.slug];
    delete manifest.source_sha256[mutation.slug];
    for (const variation of removedVariations) delete manifest.source_sha256[`${mutation.slug}/${variation.id}`];
    const paths = [removed.source_path, ...removed.formats.map((format) => format.path), ...removedVariations.flatMap(variationPaths)];
    changes.push(...deletionChanges(paths, allReferencedPaths(catalog, variations)));
  }

  if (mutation.operation === "remove-variation") {
    if (mutation.confirmation !== mutation.variationId) throw new Error("Confirmation does not match the variation ID");
    const existing = variations[mutation.slug] ?? [];
    const index = existing.findIndex((entry) => entry.id === mutation.variationId);
    if (index < 0) throw new Error("Variation not found");
    const [removed] = existing.splice(index, 1);
    if (existing.length) variations[mutation.slug] = existing;
    else delete variations[mutation.slug];
    const catalogEntry = catalog.find((entry) => entry.slug === mutation.slug);
    if (catalogEntry) catalogEntry.updated_at = today;
    delete manifest.source_sha256[`${mutation.slug}/${mutation.variationId}`];
    changes.push(...deletionChanges(variationPaths(removed), allReferencedPaths(catalog, variations)));
  }

  changes.push(
    { path: CATALOG_PATH, content: prettyJson(catalog) },
    { path: VARIATIONS_PATH, content: prettyJson(variations) },
    { path: MANIFEST_PATH, content: prettyJson(manifest) }
  );
  const actionLabel = mutation.operation.split("-").map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(" ");
  return {
    changes,
    title: `CMS: ${actionLabel} ${mutation.slug}`,
    body: `Created by the secured logo CMS.\n\n- Operation: \`${mutation.operation}\`\n- Institution: \`${mutation.slug}\`\n\nPlease verify the official source and rendered assets before merging.`
  };
}

export const catalogPaths = { catalog: CATALOG_PATH, variations: VARIATIONS_PATH, manifest: MANIFEST_PATH };

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import type { Plugin } from "vite";
import { logoCatalog } from "../../packages/logos/src/catalog";
import type { LogoEntry, LogoVariation } from "../../packages/logos/src/schema";

const virtualModuleId = "virtual:awalogo-plugin-assets";
const resolvedVirtualModuleId = `\0${virtualModuleId}`;
const root = dirname(fileURLToPath(import.meta.url));
const logoPackageRoot = resolve(root, "../../packages/logos/src");

type AssetEntry = LogoEntry | LogoVariation;
type PluginAssetPayload = { svg: string; raster_url: string };

function digest(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function rasterPayload(entry: AssetEntry) {
  const source = entry.formats.find((format) => format.type === "png") ??
    entry.formats.find((format) => format.type !== "svg");
  if (!source) throw new Error(`No raster source is available for ${entry.source_path}`);

  const input = await readFile(resolve(logoPackageRoot, source.path));
  const output = await sharp(input, { limitInputPixels: false })
    .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
    .toBuffer();
  return `data:image/png;base64,${output.toString("base64")}`;
}

async function buildAssetModule() {
  const assets: Record<string, PluginAssetPayload> = {};
  const entryAssets: Record<string, string> = {};

  async function addEntry(key: string, entry: AssetEntry) {
    let payload: PluginAssetPayload;
    if (entry.svg_path) {
      payload = {
        svg: await readFile(resolve(logoPackageRoot, entry.svg_path), "utf8"),
        raster_url: ""
      };
    } else {
      payload = { svg: "", raster_url: await rasterPayload(entry) };
    }

    const assetId = digest(payload.svg || payload.raster_url);
    assets[assetId] ??= payload;
    entryAssets[key] = assetId;
  }

  for (const logo of logoCatalog) {
    await addEntry(`logo:${logo.slug}`, logo);
    for (const variation of logo.variations ?? []) {
      await addEntry(`variation:${logo.slug}:${variation.id}`, variation);
    }
  }

  return [
    `export const pluginAssetPayloads = ${JSON.stringify(assets)};`,
    `export const pluginEntryAssets = ${JSON.stringify(entryAssets)};`
  ].join("\n");
}

export function pluginLogoAssets(): Plugin {
  let generatedModule: Promise<string> | undefined;

  return {
    name: "awalogo-plugin-assets",
    resolveId(id) {
      return id === virtualModuleId ? resolvedVirtualModuleId : null;
    },
    load(id) {
      if (id !== resolvedVirtualModuleId) return null;
      generatedModule ??= buildAssetModule();
      return generatedModule;
    }
  };
}

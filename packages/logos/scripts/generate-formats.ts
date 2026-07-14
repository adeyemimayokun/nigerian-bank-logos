import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { logoCatalog } from "../src/catalog";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(packageRoot, "src", "formats-manifest.json");
const check = process.argv.includes("--check");
const renderSettings = {
  density: 300,
  resize: {
    width: 1024,
    height: 1024,
    fit: "inside",
    withoutEnlargement: false
  },
  png: { compressionLevel: 9, palette: true },
  webp: { lossless: true, effort: 6 }
} as const;
const manifest = {
  version: 1,
  render_settings: renderSettings,
  source_sha256: {} as Record<string, string>
};
let stale = false;

for (const logo of logoCatalog) {
  const source = await readFile(join(packageRoot, "src", logo.source_path));
  manifest.source_sha256[logo.slug] = createHash("sha256").update(source).digest("hex");
  const outputs = new Map<string, Buffer>([
    ["png", await render(source, "png")],
    ["webp", await render(source, "webp")]
  ]);

  for (const format of logo.formats.filter((entry) => entry.type !== "svg")) {
    const expected = outputs.get(format.type);
    if (!expected) continue;
    const path = join(packageRoot, "src", format.path);
    if (check) {
      const current = existsSync(path) ? await readFile(path) : null;
      if (!current || !(await hasExpectedEncoding(current, expected))) {
        console.error(`Generated logo format is stale: ${format.path}`);
        stale = true;
      }
    } else {
      await writeFile(path, expected);
    }
  }
}

const serializedManifest = `${JSON.stringify(manifest, null, 2)}\n`;
if (check) {
  const currentManifest = existsSync(manifestPath) ? await readFile(manifestPath, "utf8") : null;
  if (currentManifest !== serializedManifest) {
    console.error("Generated logo format manifest is stale.");
    stale = true;
  }
} else {
  await writeFile(manifestPath, serializedManifest);
}

if (stale) process.exitCode = 1;
else console.log(check ? "Generated logo formats are current." : `Generated PNG and WebP for ${logoCatalog.length} logos.`);

async function render(source: Buffer, format: "png" | "webp"): Promise<Buffer> {
  const image = sharp(source, { density: renderSettings.density }).resize(renderSettings.resize);
  return format === "png"
    ? image.png(renderSettings.png).toBuffer()
    : image.webp(renderSettings.webp).toBuffer();
}

async function hasExpectedEncoding(current: Buffer, expected: Buffer): Promise<boolean> {
  try {
    const [currentMetadata, expectedMetadata] = await Promise.all([
      sharp(current).metadata(),
      sharp(expected).metadata()
    ]);
    await sharp(current).raw().toBuffer();

    return currentMetadata.format === expectedMetadata.format &&
      currentMetadata.width === expectedMetadata.width &&
      currentMetadata.height === expectedMetadata.height;
  } catch {
    return false;
  }
}

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { logoCatalog } from "../src/catalog";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
let stale = false;

for (const logo of logoCatalog) {
  const source = await readFile(join(packageRoot, "src", logo.source_path));
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
      if (!current || !(await imagesMatch(current, expected))) {
        console.error(`Generated logo format is stale: ${format.path}`);
        stale = true;
      }
    } else {
      await writeFile(path, expected);
    }
  }
}

if (stale) process.exitCode = 1;
else console.log(check ? "Generated logo formats are current." : `Generated PNG and WebP for ${logoCatalog.length} logos.`);

async function render(source: Buffer, format: "png" | "webp"): Promise<Buffer> {
  const image = sharp(source, { density: 300 }).resize({
    width: 1024,
    height: 1024,
    fit: "inside",
    withoutEnlargement: false
  });
  return format === "png"
    ? image.png({ compressionLevel: 9, palette: true }).toBuffer()
    : image.webp({ lossless: true, effort: 6 }).toBuffer();
}

async function imagesMatch(current: Buffer, expected: Buffer): Promise<boolean> {
  try {
    const [currentImage, expectedImage] = await Promise.all([
      inspectImage(current),
      inspectImage(expected)
    ]);

    return currentImage.format === expectedImage.format &&
      currentImage.width === expectedImage.width &&
      currentImage.height === expectedImage.height &&
      currentImage.channels === expectedImage.channels &&
      currentImage.pixels.equals(expectedImage.pixels);
  } catch {
    return false;
  }
}

async function inspectImage(buffer: Buffer) {
  const metadata = await sharp(buffer).metadata();
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  return {
    format: metadata.format,
    width: info.width,
    height: info.height,
    channels: info.channels,
    pixels: data
  };
}

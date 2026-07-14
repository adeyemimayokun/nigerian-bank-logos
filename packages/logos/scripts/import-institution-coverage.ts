import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { load } from "cheerio";
import sharp from "sharp";

const snapshotDate = "2026-07-14";
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);
const targets = [
  {
    institution_slug: "ab-microfinance-bank-nigeria",
    website: "https://ab-mfbnigeria.com/",
    source_url: "https://ab-mfbnigeria.com/assets/img/logo/ablogo.svg"
  },
  {
    institution_slug: "citizens-pensions",
    website: "https://citizenspensions.com/",
    source_url: "https://citizenspensions.com/wp-content/uploads/2025/03/CITIZENS-PENSIONS.png"
  },
  {
    institution_slug: "npf-pension-managers",
    website: "https://npfpensions.com.ng/",
    source_url: "https://npfpensions.com.ng/images/logo.png"
  },
  {
    institution_slug: "fcmb-pensions",
    website: "https://fcmbpensions.com/",
    source_url: "https://fcmbpensions.com/img/FCMBPensions-New-Logo-i.png"
  },
  {
    institution_slug: "premium-pension",
    website: "https://premiumpension.com/",
    source_url: "https://premiumpension.com/favicon.png"
  },
  {
    institution_slug: "guaranty-trust-pension-managers",
    website: "https://www.gtpensionmanagers.com/",
    source_url: "https://www.gtpensionmanagers.com/wp-content/uploads/2025/05/Pension-Managers-logo-new.png"
  },
  {
    institution_slug: "veritas-glanvills-pensions",
    website: "https://vgpensions.com/",
    source_url: "https://vgpensions.com/wp-content/uploads/2022/03/Veritas-Pensions-Logo-PNG-300x137-1.png"
  },
  {
    institution_slug: "cardinal-stone-pensions",
    website: "https://cardinalstonepensions.com/",
    source_url: "https://cardinalstonepensions.com/wp-content/uploads/2024/11/cardinalstone-Pensions-2Artboard-4.png"
  },
  {
    institution_slug: "parthian-pensions",
    website: "https://parthianpensions.com/",
    source_url: "https://parthianpensions.com/wp-content/uploads/2025/06/Logo1-PP.png"
  }
];

const promotions = [];
for (const target of targets) {
  const { stdout } = await execFileAsync(
    "curl",
    ["--location", "--insecure", "--fail", "--silent", "--show-error", target.source_url],
    { encoding: "buffer", maxBuffer: 8 * 1024 * 1024 }
  );
  const source = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
  const sourceExtension = extname(new URL(target.source_url).pathname).toLowerCase() === ".svg" ? "svg" : "png";
  let normalized: Buffer;
  if (sourceExtension === "svg") {
    const $ = load(source.toString("utf8"), { xmlMode: true });
    const svg = $("svg").first();
    if (!svg.length || !svg.attr("viewBox")) throw new Error(`${target.institution_slug} returned an invalid SVG.`);
    svg.find("script, foreignObject").remove();
    normalized = Buffer.from(`${$.xml(svg)}\n`);
  } else {
    const metadata = await sharp(source, { failOn: "error" }).metadata();
    if (!metadata.width || !metadata.height || metadata.width < 24 || metadata.height < 16) {
      throw new Error(`${target.institution_slug} returned an invalid raster logo.`);
    }
    normalized = await sharp(source).png().toBuffer();
  }
  const relativePath = `institution-coverage-candidates/${target.institution_slug}/${target.institution_slug}.${sourceExtension}`;
  const candidatePath = join(packageRoot, "sourcing", relativePath);
  await mkdir(dirname(candidatePath), { recursive: true });
  await writeFile(candidatePath, normalized);
  promotions.push({
    institution_slug: target.institution_slug,
    candidate_path: relativePath,
    website: target.website,
    source_url: target.source_url,
    source_type: "official-website",
    status: "verified",
    added_at: snapshotDate,
    updated_at: snapshotDate
  });
}

await writeFile(
  join(packageRoot, "sourcing/institution-coverage-promotions.json"),
  JSON.stringify(promotions, null, 2) + "\n"
);

console.log(`Imported ${promotions.length} official institution coverage assets.`);

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { optimize } from "svgo";
import { logoCatalog, logoCatalogSchema } from "../../logos/src";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");
const assetsRoot = join(repoRoot, "packages/logos/src");

export type ValidationIssue = {
  slug?: string;
  message: string;
};

export function validateCatalog(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const parsed = logoCatalogSchema.safeParse(logoCatalog);

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({ message: `${issue.path.join(".")}: ${issue.message}` });
    }
    return issues;
  }

  const slugs = new Set<string>();
  const assetPaths = new Set<string>();

  for (const entry of parsed.data) {
    if (slugs.has(entry.slug)) {
      issues.push({ slug: entry.slug, message: "Duplicate slug." });
    }
    slugs.add(entry.slug);

    const formatTypes = new Set<string>();
    for (const format of entry.formats) {
      if (formatTypes.has(format.type)) issues.push({ slug: entry.slug, message: `Duplicate format: ${format.type}.` });
      formatTypes.add(format.type);
      if (assetPaths.has(format.path)) issues.push({ slug: entry.slug, message: `Duplicate asset path: ${format.path}.` });
      assetPaths.add(format.path);
      const formatPath = join(assetsRoot, format.path);
      if (!existsSync(formatPath)) {
        issues.push({ slug: entry.slug, message: `Missing ${format.type.toUpperCase()} asset: ${format.path}` });
        continue;
      }
      const bytes = readFileSync(formatPath);
      if (format.type === "png" && !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        issues.push({ slug: entry.slug, message: `${format.path} is not a valid PNG.` });
      }
      if (format.type === "webp" && (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP")) {
        issues.push({ slug: entry.slug, message: `${format.path} is not a valid WebP.` });
      }
      if (format.type === "jpeg" && !(bytes[0] === 0xff && bytes[1] === 0xd8)) {
        issues.push({ slug: entry.slug, message: `${format.path} is not a valid JPEG.` });
      }
    }
    if (!formatTypes.has("png")) issues.push({ slug: entry.slug, message: "PNG format is required." });
    if (!formatTypes.has("webp")) issues.push({ slug: entry.slug, message: "WebP format is required." });
    const svgFormat = entry.formats.find((format) => format.type === "svg");
    if (entry.svg_path && svgFormat?.path !== entry.svg_path) issues.push({ slug: entry.slug, message: "svg_path must match the SVG format path." });
    if (!entry.svg_path && svgFormat) issues.push({ slug: entry.slug, message: "Raster-only logos cannot declare an SVG format." });

    const sourcePath = join(assetsRoot, entry.source_path);
    if (!existsSync(sourcePath)) {
      issues.push({ slug: entry.slug, message: `Missing source asset: ${entry.source_path}` });
    }

    if (!entry.svg_path) continue;
    const assetPath = join(assetsRoot, entry.svg_path);
    if (!existsSync(assetPath)) continue;
    const svg = readFileSync(assetPath, "utf8").trim();
    if (!svg.startsWith("<svg")) {
      issues.push({ slug: entry.slug, message: "SVG asset must start with an <svg> element." });
    }

    const rootSvgTag = svg.match(/^<svg\b[^>]*>/i)?.[0] ?? "";
    if (!/\bviewBox\s*=\s*["'][^"']+["']/i.test(rootSvgTag)) {
      issues.push({ slug: entry.slug, message: "Root SVG must declare a viewBox to prevent clipped previews." });
    }
    if (/preserveAspectRatio=["']none["']/i.test(rootSvgTag)) {
      issues.push({ slug: entry.slug, message: "Root SVG must preserve its aspect ratio." });
    }

    if (/<script[\s>]/i.test(svg)) {
      issues.push({ slug: entry.slug, message: "SVG asset contains a script tag." });
    }

    if (/\son[a-z]+\s*=/i.test(svg)) {
      issues.push({ slug: entry.slug, message: "SVG asset contains inline event handlers." });
    }

    if (/(href|src)=["']https?:\/\//i.test(svg)) {
      issues.push({ slug: entry.slug, message: "SVG asset references external network content." });
    }

    const result = optimize(svg, {
      path: assetPath,
      multipass: true,
      plugins: [
        {
          name: "preset-default",
          params: {
            overrides: {
              removeViewBox: false
            }
          }
        },
        "removeDimensions"
      ]
    });

    if ("error" in result) {
      issues.push({ slug: entry.slug, message: `SVGO failed: ${result.error}` });
    }
  }

  return issues;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const issues = validateCatalog();

  if (issues.length > 0) {
    console.error("Logo validation failed:");
    for (const issue of issues) {
      console.error(`- ${issue.slug ? `${issue.slug}: ` : ""}${issue.message}`);
    }
    process.exit(1);
  }

  console.log(`Validated ${logoCatalog.length} logo assets.`);
}

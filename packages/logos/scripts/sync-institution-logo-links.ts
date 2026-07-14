import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { institutionLogoLinks } from "../src/institution-links";
import promotedCatalog from "../src/promoted-catalog.json";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const logoSlugs = ["flutterwave", "moniepoint", "opay", ...promotedCatalog.map((logo) => logo.slug)];
const links = Object.fromEntries([
  ...logoSlugs.map((slug) => [slug, slug] as const),
  ...Object.entries(institutionLogoLinks)
].sort(([a], [b]) => a.localeCompare(b)));

await writeFile(
  join(packageRoot, "../institutions/data/logo-links.json"),
  JSON.stringify(links, null, 2) + "\n"
);

console.log(`Synced ${Object.keys(links).length} institution-to-logo links.`);

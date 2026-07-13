import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { excludedInstitutionsSchema, institutionCatalogSchema, type Institution } from "../src/schema";
import { generatedFiles } from "./generate";
import { packageRoot, readJson, snapshotDate } from "./lib";

const errors: string[] = [];
const exportsRoot = join(packageRoot, "exports");
const nigerian = institutionCatalogSchema.parse(await readJson(join(exportsRoot, "institutions-ng.json")));
const foreign = institutionCatalogSchema.parse(await readJson(join(exportsRoot, "foreign-authorized-ng.json")));
const candidates = institutionCatalogSchema.parse(await readJson(join(packageRoot, "data/community-candidates.json")));
excludedInstitutionsSchema.parse(await readJson(join(packageRoot, "data/excluded-inactive.json")));

const all = [...nigerian, ...foreign];
const slugs = new Set<string>();
const legalNames = new Map<string, string>();
for (const entry of all) {
  if (slugs.has(entry.slug)) errors.push(`Duplicate slug: ${entry.slug}`);
  slugs.add(entry.slug);
  if (entry.legal_name) {
    const key = entry.legal_name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const owner = legalNames.get(key);
    if (owner && owner !== entry.slug) errors.push(`Duplicate legal entity: ${entry.legal_name} (${owner}, ${entry.slug})`);
    legalNames.set(key, entry.slug);
  }
  if (entry.nigeria_presence === "foreign-authorized" && entry.country_code === "NG") errors.push(`Foreign record has NG country code: ${entry.slug}`);
  if (entry.nigeria_presence !== "foreign-authorized" && entry.country_code !== "NG") errors.push(`Nigerian export has non-NG country code: ${entry.slug}`);
  checkSources(entry);
  const aliases = new Set<string>();
  for (const alias of entry.aliases) {
    const key = alias.toLowerCase();
    if (aliases.has(key)) errors.push(`Duplicate alias on ${entry.slug}: ${alias}`);
    aliases.add(key);
  }
}
for (const entry of candidates) {
  if (entry.verification_status !== "community-candidate" || entry.regulatory_status !== "unverified") {
    errors.push(`Community candidate is presented as verified: ${entry.slug}`);
  }
}

const expected = await generatedFiles();
for (const [path, contents] of expected) {
  const current = await readFile(path, "utf8").catch(() => "");
  if (current !== contents) errors.push(`Generated file is stale: ${path.replace(`${packageRoot}/`, "")}`);
}

if (errors.length) {
  console.error("Institution validation failed:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log(`Validated ${nigerian.length} Nigerian and ${foreign.length} foreign-authorized institutions.`);

function checkSources(entry: Institution): void {
  const snapshot = Date.parse(snapshotDate);
  for (const source of entry.sources) {
    if (!source.url.startsWith("https://")) errors.push(`Source URL must use HTTPS: ${entry.slug}`);
    const ageDays = (snapshot - Date.parse(source.retrieved_at)) / 86_400_000;
    if (ageDays > 180) errors.push(`Source is older than 180 days: ${entry.slug}`);
  }
}

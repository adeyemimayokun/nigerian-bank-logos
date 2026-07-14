import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { institutionCatalogSchema, type Institution } from "../../institutions/src/schema";

const importDate = "2026-07-14";
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const candidatesPath = join(packageRoot, "../institutions/data/community-candidates.json");
const promotionsPath = join(packageRoot, "sourcing/fintech-discovery-promotions.json");
const candidatesRoot = join(packageRoot, "sourcing/fintech-discovery-candidates");

const discoveries = [
  {
    slug: "pawapay",
    website: "https://www.pawapay.io/",
    sourcePage: "https://www.pawapay.io/media-branding",
    assetUrl: "https://cdn.prod.website-files.com/62824591015aa314fd308df1/698b52078dc51e0ef339b55c_pawapay_logo_black.svg",
    sourceType: "official-brand-page" as const
  },
  {
    slug: "grey",
    website: "https://grey.co/",
    sourcePage: "https://grey.co/",
    assetUrl: "https://cdn.prod.website-files.com/6360022338a81bd6fdbb1145/6563c15e45db91a91be06020_Grey%20Logo%20Lockup%20White%201.svg",
    sourceType: "official-website" as const
  },
  {
    slug: "onafriq",
    website: "https://onafriq.com/",
    sourcePage: "https://onafriq.com/",
    assetUrl: "https://onafriq.com/assets/images/onafriq-logo-black.webp",
    sourceType: "official-website" as const
  }
];

async function main(): Promise<void> {
  const candidates = institutionCatalogSchema.parse(
    JSON.parse(await readFile(candidatesPath, "utf8")) as Institution[]
  );
  const bySlug = new Map(candidates.map((record) => [record.slug, record]));
  const promotions = [];

  for (const discovery of discoveries) {
    const institution = bySlug.get(discovery.slug);
    if (!institution) throw new Error(`Missing community institution: ${discovery.slug}`);

    const response = await fetch(discovery.assetUrl, { redirect: "follow" });
    if (!response.ok) throw new Error(`${discovery.assetUrl} returned ${response.status}.`);
    const extension = extname(new URL(discovery.assetUrl).pathname).toLowerCase().slice(1);
    if (!new Set(["svg", "png", "webp", "jpg"]).has(extension)) {
      throw new Error(`Unsupported source format for ${discovery.slug}: ${extension}`);
    }
    const relativePath = `fintech-discovery-candidates/${discovery.slug}/${discovery.slug}.${extension}`;
    const filePath = join(packageRoot, "sourcing", relativePath);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, Buffer.from(await response.arrayBuffer()));

    bySlug.set(discovery.slug, {
      ...institution,
      nigeria_presence: "market-only",
      verification_status: "community-candidate",
      website: discovery.website,
      sources: [
        ...institution.sources.filter((source) => source.url !== discovery.sourcePage),
        { url: discovery.sourcePage, source_type: "official-website", retrieved_at: importDate }
      ],
      logo_slug: discovery.slug,
      updated_at: importDate
    });
    promotions.push({
      institution_slug: discovery.slug,
      candidate_path: relativePath,
      source_url: discovery.assetUrl,
      source_type: discovery.sourceType,
      website: discovery.website,
      status: "verified",
      added_at: importDate,
      updated_at: importDate
    });
  }

  const nextCandidates = [...bySlug.values()].sort((a, b) => a.brand_name.localeCompare(b.brand_name));
  await writeFile(candidatesPath, `${JSON.stringify(institutionCatalogSchema.parse(nextCandidates), null, 2)}\n`);
  await writeFile(promotionsPath, `${JSON.stringify(promotions, null, 2)}\n`);
  console.log(`Imported ${promotions.length} official fintech logo sources.`);
}

await main();

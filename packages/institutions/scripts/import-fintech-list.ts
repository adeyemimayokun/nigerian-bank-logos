import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  institutionCatalogSchema,
  type Institution,
  type InstitutionCategory
} from "../src/schema";
import { packageRoot, readJson } from "./lib";

const repositoryRoot = join(packageRoot, "../..");
const sourcePath = join(repositoryRoot, "docs/research/nigerian-fintech-companies.md");
const candidatesPath = join(packageRoot, "data/community-candidates.json");
const reportPath = join(packageRoot, "exports/fintech-list-comparison.json");
const sourceUrl = "https://github.com/adeyemimayokun/nigerian-bank-logos/blob/main/docs/research/nigerian-fintech-companies.md";
const importDate = "2026-07-14";

type CategoryRule = {
  primary: InstitutionCategory;
  categories: InstitutionCategory[];
};

const categoryRules: Record<string, CategoryRule> = {
  "Fintech Infrastructure, BaaS and TechFin": {
    primary: "fintech",
    categories: ["fintech", "payment-solution-service-provider"]
  },
  "Payments Processing, Switching and Infrastructure": {
    primary: "switching-processing",
    categories: ["switching-processing", "payment-solution-service-provider", "fintech"]
  },
  "Mobile Money, PSB, Agency and Informal Banking": {
    primary: "mobile-money-operator",
    categories: ["mobile-money-operator", "finance-app", "fintech"]
  },
  "Consumer Payments, Digital Wallets and Super Apps": {
    primary: "finance-app",
    categories: ["finance-app", "fintech"]
  },
  "Spend Management, Merchant Solutions, BNPL and Loyalty": {
    primary: "fintech",
    categories: ["fintech", "finance-app"]
  },
  "Personal Finance, Wealth and Asset Management": {
    primary: "finance-app",
    categories: ["finance-app", "investment-manager", "fintech"]
  },
  "Digital Insurance, Pensions, Health-Tech and HR": {
    primary: "fintech",
    categories: ["fintech", "finance-app"]
  },
  "Crowdfunding, Agritech and Proptech": {
    primary: "crowdfunding-platform",
    categories: ["crowdfunding-platform", "fintech"]
  },
  "Crypto and Web3": {
    primary: "crypto-vasp",
    categories: ["crypto-vasp", "fintech"]
  },
  "Digital Lenders and Credit Infrastructure": {
    primary: "digital-lender",
    categories: ["digital-lender", "fintech"]
  },
  "Digital Banks": {
    primary: "finance-app",
    categories: ["finance-app", "fintech"]
  },
  "FX, B2B and Cross-Border Payments and Remittances": {
    primary: "remittance-imto",
    categories: ["remittance-imto", "fintech"]
  }
};

// These are verified brand/legal-name relationships, not fuzzy string guesses.
const knownAliases: Record<string, string> = {
  "3line": "3line-card-management",
  "9psb": "9-payment-service-bank",
  "akilaph": "akilaah-solution",
  "alat": "alat-by-wema",
  "accelerex": "global-accelerex",
  "arca": "arca-payments-company",
  "branch": "branch-international-financial",
  "carbon": "carbon-microfinance-bank",
  "corebank": "corestepmicrofinance-banklimited",
  "etops": "etop",
  "etranzact": "etranzact-international",
  "eyowo": "eyowo-integrated-payments",
  "fairmoney": "fairmoney-microfinance-bank",
  "fincra": "fincra-technologies",
  "hopebank": "hope-payment-service-bank",
  "hxafrica": "housingexchange-ng",
  "itex": "itex-integrated-services",
  "kiakia": "kiakia-bits",
  "kongapay": "kongapay-technologies",
  "kora": "kora-payments",
  "kuda": "kuda-microfinance-bank",
  "kwikpay": "trafalgar-association",
  "lendsqr": "essential-finance",
  "moneymasterpsb": "money-master-payment-service-bank",
  "moneta": "moneta-technology",
  "momopsb": "momo-payment-service-bank",
  "nownow": "nownow-digital-systems",
  "onepipe": "onepipe-io-services",
  "okra": "okra-technologies",
  "optimus": "optimus-by-afrinvest",
  "palmpay": "palmpay",
  "payaza": "payaza-africa",
  "payu": "payu-payments",
  "qrios": "qrios-networks",
  "remita": "remita-payment-service",
  "renmoney": "renmoney-microfinance-bank",
  "rise": "risevest",
  "routepay": "routepay-fintech",
  "seamlesshr": "seamlesshr-com",
  "sproutly": "sproutly-tech",
  "sterling": "sterling-bank",
  "traction": "traction-payments",
  "trove": "trove-finance",
  "umba": "umba-digital-solutions",
  "vendyz": "vendy",
  "vfd": "vfd-microfinance-bank",
  "verve": "verve-international",
  "xchangebox": "xchange-box-solutions",
  "xpress": "xpress-payments-solution",
  "yellowcard": "yellowcard",
  "zest": "zest-payments-limited-stanbic-financial-services-limited"
};

function identity(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseSource(markdown: string): Array<{ name: string; heading: string; rule: CategoryRule }> {
  const entries: Array<{ name: string; heading: string; rule: CategoryRule }> = [];
  let heading = "";

  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      heading = line.slice(3).trim();
      continue;
    }
    if (!line.startsWith("- ")) continue;
    const rule = categoryRules[heading];
    if (!rule) throw new Error(`No category rule configured for heading: ${heading}`);
    entries.push({ name: line.slice(2).trim(), heading, rule });
  }

  return entries;
}

function recordKeys(record: Institution): string[] {
  return [record.slug, record.brand_name, record.legal_name ?? "", ...record.aliases]
    .map(identity)
    .filter(Boolean);
}

function uniqueCategories(values: InstitutionCategory[]): InstitutionCategory[] {
  return [...new Set(values)];
}

async function loadMasterRecords(): Promise<Institution[]> {
  const nigerian = await readJson<Institution[]>(join(packageRoot, "exports/institutions-ng.json"));
  const foreign = await readJson<Institution[]>(join(packageRoot, "exports/foreign-authorized-ng.json"));
  return institutionCatalogSchema.parse([...nigerian, ...foreign]);
}

async function main(): Promise<void> {
  const markdown = await readFile(sourcePath, "utf8");
  const sourceEntries = parseSource(markdown);
  const master = await loadMasterRecords();
  const existingCandidates = institutionCatalogSchema.parse(
    await readJson<Institution[]>(candidatesPath)
  );
  const preservedCandidates = existingCandidates.filter((record) => {
    const cameFromThisList = record.sources.some((source) => source.url === sourceUrl);
    const hasVerifiedEnrichment = Boolean(record.logo_slug || record.website) ||
      record.sources.some((source) => source.source_type === "official-website");
    return !cameFromThisList || hasVerifiedEnrichment;
  });
  const allExisting = [...master, ...preservedCandidates];
  const byKey = new Map<string, Institution>();
  const bySlug = new Map(allExisting.map((record) => [record.slug, record]));

  for (const record of allExisting) {
    for (const key of recordKeys(record)) {
      if (!byKey.has(key)) byKey.set(key, record);
    }
  }

  const matched: Array<{ source_name: string; source_category: string; institution_slug: string }> = [];
  const additions = new Map<string, {
    displayName: string;
    headings: Set<string>;
    categories: InstitutionCategory[];
    primary: InstitutionCategory;
  }>();

  for (const entry of sourceEntries) {
    const key = identity(entry.name);
    const aliasSlug = knownAliases[key];
    const match = (aliasSlug ? bySlug.get(aliasSlug) : undefined) ?? byKey.get(key);

    if (match) {
      matched.push({
        source_name: entry.name,
        source_category: entry.heading,
        institution_slug: match.slug
      });
      continue;
    }

    const pending = additions.get(key);
    if (pending) {
      pending.headings.add(entry.heading);
      pending.categories = uniqueCategories([...pending.categories, ...entry.rule.categories]);
    } else {
      additions.set(key, {
        displayName: entry.name,
        headings: new Set([entry.heading]),
        categories: [...entry.rule.categories],
        primary: entry.rule.primary
      });
    }
  }

  const usedSlugs = new Set(allExisting.map((record) => record.slug));
  const newCandidates = [...additions.values()]
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map((entry): Institution => {
      const baseSlug = slugify(entry.displayName);
      let slug = baseSlug;
      let suffix = 2;
      while (usedSlugs.has(slug)) slug = `${baseSlug}-fintech-${suffix++}`;
      usedSlugs.add(slug);

      return {
        slug,
        legal_name: null,
        brand_name: entry.displayName,
        aliases: [],
        primary_category: entry.primary,
        categories: uniqueCategories(entry.categories),
        country_code: "NG",
        nigeria_presence: "market-only",
        regulators: [],
        licence_types: [],
        regulatory_status: "unverified",
        verification_status: "community-candidate",
        website: null,
        sources: [{
          url: sourceUrl,
          source_type: "community",
          retrieved_at: importDate
        }],
        logo_slug: null,
        added_at: importDate,
        updated_at: importDate
      };
    });

  const candidates = institutionCatalogSchema.parse(
    [...preservedCandidates, ...newCandidates].sort((a, b) => a.brand_name.localeCompare(b.brand_name))
  );

  const report = {
    compared_at: importDate,
    source_file: "docs/research/nigerian-fintech-companies.md",
    source_entries: sourceEntries.length,
    unique_source_names: new Set(sourceEntries.map((entry) => identity(entry.name))).size,
    matched_existing_entries: matched.length,
    matched_existing_unique_names: new Set(matched.map((entry) => identity(entry.source_name))).size,
    added_community_candidates: newCandidates.length,
    duplicate_source_entries_collapsed: sourceEntries.length - new Set(
      sourceEntries.map((entry) => identity(entry.name))
    ).size,
    master_records_unchanged: master.length,
    community_candidates_total: candidates.length,
    matched,
    added: newCandidates.map((record) => ({
      slug: record.slug,
      brand_name: record.brand_name,
      primary_category: record.primary_category,
      categories: record.categories,
      source_headings: [...(additions.get(identity(record.brand_name))?.headings ?? [])]
    }))
  };

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(candidatesPath, `${JSON.stringify(candidates, null, 2)}\n`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `Compared ${sourceEntries.length} entries: ${matched.length} matched, ` +
    `${newCandidates.length} added, ${candidates.length} community candidates total.`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();

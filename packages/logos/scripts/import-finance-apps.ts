import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import type { Institution } from "../../institutions/src";

const snapshotDate = "2026-07-14";
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const curatedPath = join(packageRoot, "../institutions/data/curated.json");
const promotionsPath = join(packageRoot, "sourcing/finance-app-promotions.json");
const candidatesRoot = join(packageRoot, "sourcing/finance-app-candidates");

type AppSource = {
  institution_slug: string;
  page_url: string;
  resolve: (page: string) => Promise<{ svg: string; source_url: string }>;
};

const sources: AppSource[] = [
  {
    institution_slug: "abeg-technologies",
    page_url: "https://pocketapp.com/",
    resolve: async (page) => {
      const $ = load(page);
      const logo = $("svg.Footer_logo__xLcg0, footer svg[viewBox='0 0 696 263']").first();
      if (!logo.length) throw new Error("PocketApp logo was not found on its official website.");
      return { svg: $.html(logo), source_url: "https://pocketapp.com/" };
    }
  },
  {
    institution_slug: "investnaija",
    page_url: "https://investnaija.com/",
    resolve: assetFromPage(/assets\/logowhite-[A-Za-z0-9_-]+\.svg/, "https://investnaija.com/")
  },
  {
    institution_slug: "i-invest",
    page_url: "https://www.i-investng.com/",
    resolve: directAsset("https://www.i-investng.com/brand/i-invest-logo.svg")
  },
  {
    institution_slug: "getequity",
    page_url: "https://www.getequity.io/",
    resolve: assetFromPage(/\/_nuxt\/img\/logo-dark\.[A-Za-z0-9_-]+\.svg/, "https://www.getequity.io/")
  },
  {
    institution_slug: "wahed",
    page_url: "https://www.wahed.com/nga/",
    resolve: assetFromPage(
      /https:\/\/cdn\.prod\.website-files\.com\/[^"']+\/[^"']*wahed-color-logo\.svg/,
      "https://www.wahed.com/nga/"
    )
  },
  {
    institution_slug: "chaka-technologies",
    page_url: "https://hisa.co/",
    resolve: async (page) => {
      const $ = load(page);
      const logo = $("a[aria-label='Hisa home'] svg").first();
      if (!logo.length) throw new Error("Hisa logo was not found on its official website.");
      logo.attr("fill", "#875df3").removeAttr("class");
      return { svg: $.html(logo), source_url: "https://hisa.co/" };
    }
  }
];

async function main(): Promise<void> {
  const promotions = [];
  for (const source of sources) {
    const page = await fetchText(source.page_url);
    const resolved = await source.resolve(page);
    const svg = normalizeSvg(resolved.svg, source.institution_slug);
    const relativePath = `finance-app-candidates/${source.institution_slug}/${source.institution_slug}.svg`;
    const candidatePath = join(packageRoot, "sourcing", relativePath);
    await mkdir(dirname(candidatePath), { recursive: true });
    await writeFile(candidatePath, svg);
    promotions.push({
      institution_slug: source.institution_slug,
      candidate_path: relativePath,
      source_url: resolved.source_url,
      source_type: "official-website",
      status: "verified",
      added_at: snapshotDate,
      updated_at: snapshotDate
    });
  }

  await writeFile(promotionsPath, JSON.stringify(promotions, null, 2) + "\n");

  const curated = JSON.parse(await readFile(curatedPath, "utf8")) as Institution[];
  const appSlugs = new Set(appInstitutions.map((institution) => institution.slug));
  const nextCurated = [...curated.filter((institution) => !appSlugs.has(institution.slug)), ...appInstitutions]
    .sort((a, b) => a.brand_name.localeCompare(b.brand_name));
  await writeFile(curatedPath, JSON.stringify(nextCurated, null, 2) + "\n");

  console.log(`Imported ${promotions.length} official finance-app logos.`);
}

function directAsset(url: string): AppSource["resolve"] {
  return async () => ({ svg: await fetchText(url), source_url: url });
}

function assetFromPage(pattern: RegExp, baseUrl: string): AppSource["resolve"] {
  return async (page) => {
    const match = page.match(pattern)?.[0];
    if (!match) throw new Error(`Official asset matching ${pattern} was not found.`);
    const url = new URL(match, baseUrl).href;
    return { svg: await fetchText(url), source_url: url };
  };
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${url} returned ${response.status}.`);
  return response.text();
}

function normalizeSvg(source: string, slug: string): string {
  const start = source.search(/<svg[\s>]/i);
  if (start < 0) throw new Error(`${slug} did not return an SVG.`);
  const $ = load(source.slice(start), { xmlMode: true });
  const svg = $("svg").first();
  if (!svg.length || !svg.attr("viewBox")) throw new Error(`${slug} SVG requires a viewBox.`);
  svg.attr("xmlns", "http://www.w3.org/2000/svg");
  svg.find("script, foreignObject").remove();
  $("*").each((_, node) => {
    for (const attribute of Object.keys(node.attribs ?? {})) {
      if (/^on/i.test(attribute)) $(node).removeAttr(attribute);
    }
  });
  return `${$.xml(svg)}\n`;
}

const appInstitutions: Institution[] = [
  {
    slug: "abeg-technologies",
    legal_name: "Abeg Technologies Limited",
    brand_name: "PocketApp",
    aliases: ["Abeg", "Abeg Technologies", "Pocket", "Pocket by PiggyVest"],
    primary_category: "mobile-money-operator",
    categories: ["mobile-money-operator", "finance-app", "fintech"],
    country_code: "NG",
    nigeria_presence: "nigerian-company",
    regulators: ["CBN"],
    licence_types: ["Mobile Money Operator"],
    regulatory_status: "active",
    verification_status: "officially-verified",
    website: "https://pocketapp.com/",
    sources: [
      { url: "https://www.cbn.gov.ng/PaymentsSystem/PSPs.html", source_type: "regulator", retrieved_at: snapshotDate },
      { url: "https://pocketapp.com/", source_type: "official-website", retrieved_at: snapshotDate }
    ],
    logo_slug: "abeg-technologies",
    added_at: snapshotDate,
    updated_at: snapshotDate
  },
  {
    slug: "investnaija",
    legal_name: "InvestIN Limited",
    brand_name: "InvestNaija",
    aliases: ["Invest Naija", "InvestNaija by Chapel Hill Denham"],
    primary_category: "finance-app",
    categories: ["finance-app", "investment-manager"],
    country_code: "NG",
    nigeria_presence: "nigerian-company",
    regulators: [],
    licence_types: [],
    regulatory_status: "status-unknown",
    verification_status: "market-verified",
    website: "https://investnaija.com/",
    sources: [{ url: "https://investnaija.com/", source_type: "official-website", retrieved_at: snapshotDate }],
    logo_slug: "investnaija",
    added_at: snapshotDate,
    updated_at: snapshotDate
  },
  {
    slug: "i-invest",
    legal_name: "Parthian Partners Limited",
    brand_name: "i-invest",
    aliases: ["I-Invest", "i-invest by Parthian Partners"],
    primary_category: "finance-app",
    categories: ["finance-app", "digital-broker"],
    country_code: "NG",
    nigeria_presence: "nigerian-company",
    regulators: ["SEC Nigeria"],
    licence_types: ["Inter Dealer Broker", "Issuing House"],
    regulatory_status: "active",
    verification_status: "officially-verified",
    website: "https://www.i-investng.com/",
    sources: [
      { url: "https://home.sec.gov.ng/for-investors/find-a-registered-operator/?page=34", source_type: "regulator", retrieved_at: snapshotDate },
      { url: "https://www.i-investng.com/about-us", source_type: "official-website", retrieved_at: snapshotDate }
    ],
    logo_slug: "i-invest",
    added_at: snapshotDate,
    updated_at: snapshotDate
  },
  {
    slug: "getequity",
    legal_name: "GetEquity Limited",
    brand_name: "GetEquity",
    aliases: ["Get Equity"],
    primary_category: "finance-app",
    categories: ["finance-app", "crowdfunding-platform", "fintech"],
    country_code: "NG",
    nigeria_presence: "nigerian-company",
    regulators: [],
    licence_types: [],
    regulatory_status: "unverified",
    verification_status: "market-verified",
    website: "https://www.getequity.io/",
    sources: [
      { url: "https://www.getequity.io/", source_type: "official-website", retrieved_at: snapshotDate },
      { url: "https://www.getequity.io/terms/", source_type: "official-website", retrieved_at: snapshotDate }
    ],
    logo_slug: "getequity",
    added_at: snapshotDate,
    updated_at: snapshotDate
  },
  {
    slug: "wahed",
    legal_name: "Wahed Limited",
    brand_name: "Wahed",
    aliases: ["Wahed Invest"],
    primary_category: "robo-adviser",
    categories: ["robo-adviser", "finance-app", "investment-manager"],
    country_code: "NG",
    nigeria_presence: "nigerian-company",
    regulators: ["SEC Nigeria"],
    licence_types: ["Corporate Investment Adviser"],
    regulatory_status: "active",
    verification_status: "officially-verified",
    website: "https://www.wahed.com/nga/",
    sources: [
      { url: "https://home.sec.gov.ng/for-investors/find-a-registered-operator/?page=47", source_type: "regulator", retrieved_at: snapshotDate },
      { url: "https://www.wahed.com/nga/", source_type: "official-website", retrieved_at: snapshotDate }
    ],
    logo_slug: "wahed",
    added_at: snapshotDate,
    updated_at: snapshotDate
  },
  {
    slug: "chaka-technologies",
    legal_name: "Chaka Technologies Ltd",
    brand_name: "Hisa",
    aliases: ["Chaka", "Chaka Technologies", "HISA"],
    primary_category: "digital-broker",
    categories: ["digital-broker", "finance-app"],
    country_code: "NG",
    nigeria_presence: "nigerian-company",
    regulators: ["SEC Nigeria"],
    licence_types: ["Digital Sub-Broker"],
    regulatory_status: "active",
    verification_status: "officially-verified",
    website: "https://hisa.co/",
    sources: [
      { url: "https://home.sec.gov.ng/fintech-and-innovation-hub-finport/registered-fintech-operators/", source_type: "regulator", retrieved_at: snapshotDate },
      { url: "https://hisa.co/", source_type: "official-website", retrieved_at: snapshotDate }
    ],
    logo_slug: "chaka-technologies",
    added_at: snapshotDate,
    updated_at: snapshotDate
  }
];

await main();

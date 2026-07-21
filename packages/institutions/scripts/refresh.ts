import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { load, type CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import * as XLSX from "xlsx";
import type { Institution, InstitutionCategory } from "../src/schema";
import {
  cbnImtoUrl, cbnPaymentsUrl, cleanText, makeInstitution, mergeCatalog,
  fccpcLendersUrl, naicomBrokersUrl, naicomInsurersUrl, packageRoot, pencomPfaUrl,
  pencomPfcUrl, secFintechUrl, snapshotDate
} from "./lib";

type RefreshResult = { source: string; records: Institution[] };

const paymentHeadings: Array<[RegExp, InstitutionCategory, string]> = [
  [/CARD\/PAYMENT SCHEMES/i, "card-scheme", "Card/payment scheme"],
  [/MOBILE MONEY OPERATOR/i, "mobile-money-operator", "Mobile money operator"],
  [/SWITCHING.*PROCESSING/i, "switching-processing", "Switching and processing"],
  [/PAYMENT SOLUTION SERVICE PROVIDER/i, "payment-solution-service-provider", "PSSP"],
  [/PAYMENT TERMINAL SERVICES PROVIDER/i, "payment-terminal-service-provider", "PTSP"],
  [/SUPER-AGENT/i, "super-agent", "Super-agent"],
  [/PAYMENTS SERVICE HOLDING/i, "payment-service-holding-company", "Payment service holding company"],
  [/PAYMENTS TERMINAL SERVICE AGGREGATOR/i, "clearing-house", "Payment terminal service aggregator"]
];

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: { "user-agent": "awalogo/0.1 (+https://awalogo.com; open-source data refresh)" } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

function rowCells($: CheerioAPI, row: Element): string[] {
  return $(row).find("th,td").map((_, cell) => cleanText($(cell).text())).get();
}

async function refreshCbnPayments(): Promise<RefreshResult> {
  const $ = load(await fetchHtml(cbnPaymentsUrl));
  const records: Institution[] = [];
  let heading = "";
  $("h3,h4,table").each((_, element) => {
    if (element.tagName !== "table") {
      heading = cleanText($(element).text());
      return;
    }
    const mapping = paymentHeadings.find(([pattern]) => pattern.test(heading));
    if (!mapping) return;
    $(element).find("tr").each((__, row) => {
      const cells = rowCells($, row);
      const name = cells.find((cell, index) => index > 0 && !/^(licen[cs]e|licen[cs]ee)$/i.test(cell));
      if (!name || !/\p{L}/u.test(name)) return;
      records.push(makeInstitution({ name, category: mapping[1], sourceUrl: cbnPaymentsUrl, regulator: "CBN", licenceType: mapping[2] }));
    });
  });
  return { source: "cbn-payments", records: mergeCatalog(records) };
}

function countryFromAddress(address: string): { code: string; presence: Institution["nigeria_presence"] } {
  if (/Nigeria|Lagos|Abuja|Abeokuta|Port Harcourt|Gwarimpa|Ikoyi|Lekki|Victoria Island/i.test(address)) {
    return { code: "NG", presence: "nigerian-company" };
  }
  const countries: Array<[RegExp, string]> = [
    [/United States|\bUSA\b|New York|Delaware|Texas|Maryland|New Jersey/i, "US"],
    [/United Kingdom|\bUK\b|London|England|Scotland|Manchester|Bristol|Kent|Essex/i, "GB"],
    [/Canada|Ontario|Toronto|Calgary|British Columbia/i, "CA"],
    [/Rwanda|Kigali/i, "RW"], [/Uruguay/i, "UY"], [/Senegal|Dakar/i, "SN"],
    [/Morocco|Casablanca/i, "MA"], [/Spain|Madrid/i, "ES"]
  ];
  return { code: countries.find(([pattern]) => pattern.test(address))?.[1] ?? "ZZ", presence: "foreign-authorized" };
}

async function refreshCbnImtos(): Promise<RefreshResult> {
  const $ = load(await fetchHtml(cbnImtoUrl));
  const records: Institution[] = [];
  $("table tr").each((_, row) => {
    const cells = rowCells($, row);
    if (cells.length < 3 || !/^\d+\.?$/.test(cells[0])) return;
    const country = countryFromAddress(cells.slice(2).join(" "));
    records.push(makeInstitution({
      name: cells[1], category: "remittance-imto", sourceUrl: cbnImtoUrl,
      regulator: "CBN", licenceType: "International money transfer operator",
      countryCode: country.code, presence: country.presence
    }));
  });
  return { source: "cbn-imtos", records: mergeCatalog(records) };
}

function secCategory(label: string): InstitutionCategory {
  if (/crowdfunding/i.test(label)) return "crowdfunding-platform";
  if (/robo/i.test(label)) return "robo-adviser";
  if (/sub-broker/i.test(label)) return "digital-broker";
  if (/investment/i.test(label)) return "investment-manager";
  return "fintech";
}

function companyAndBrand(value: string): { company: string; brand?: string } {
  const text = cleanText(value);
  const [company, trading] = text.split(/Trading Name:/i).map(cleanText);
  return { company, brand: trading || undefined };
}

async function refreshSecFintech(): Promise<RefreshResult> {
  const $ = load(await fetchHtml(secFintechUrl));
  const records: Institution[] = [];
  $("table").each((_, table) => {
    const caption = cleanText($(table).find("caption").text());
    const headers = $(table).find("thead th").map((__, cell) => cleanText($(cell).text())).get();
    if (/by Category/i.test(caption)) {
      $(table).find("tbody tr").each((__, row) => {
        rowCells($, row).forEach((name, index) => {
          if (!name) return;
          records.push(makeInstitution({ name, category: secCategory(headers[index] ?? "FinTech"), sourceUrl: secFintechUrl, regulator: "SEC Nigeria", licenceType: headers[index] ?? "Registered FinTech operator" }));
        });
      });
      return;
    }
    if (!/Regulatory Incubation|ARIP/i.test(caption)) return;
    $(table).find("tbody tr").each((__, row) => {
      const cells = rowCells($, row);
      if (cells.length < 3) return;
      const named = companyAndBrand(cells[1]);
      const solution = cells[2];
      const category: InstitutionCategory = /digital asset|VASP/i.test(solution) ? "crypto-vasp" : "fintech";
      records.push(makeInstitution({
        name: named.company, brandName: named.brand, aliases: named.brand ? [named.brand] : [],
        category, sourceUrl: secFintechUrl, regulator: "SEC Nigeria",
        licenceType: /ARIP/i.test(caption) ? "ARIP participant" : "Regulatory Incubation participant",
        status: /ARIP/i.test(caption) ? "approval-in-principle" : "sandbox"
      }));
    });
  });
  return { source: "sec-fintech", records: mergeCatalog(records) };
}

async function refreshFccpcLenders(): Promise<RefreshResult> {
  const $ = load(await fetchHtml(fccpcLendersUrl));
  const records: Institution[] = [];
  $("table").each((_, table) => {
    const headers = rowCells($, $(table).find("thead tr").get(0) as Element);
    const companyIndex = headers.findIndex((header) => /NAME OF COMPANY/i.test(header));
    const appIndex = headers.findIndex((header) => /NAME OF APP/i.test(header));
    if (companyIndex < 0) return;
    $(table).find("tbody tr").each((__, row) => {
      const cells = rowCells($, row);
      const company = cleanText(cells[companyIndex] ?? "").replace(/,+$/, "");
      if (!company) return;
      const apps = (cells[appIndex] ?? "").split(/,|\band\b/i)
        .map((app) => cleanText(app).replace(/\s+APPS?$/i, "")).filter(Boolean);
      records.push(makeInstitution({
        name: company, brandName: apps[0], aliases: apps,
        category: "digital-lender", sourceUrl: fccpcLendersUrl,
        regulator: "FCCPC", licenceType: "Digital money lender approval"
      }));
    });
  });
  return { source: "fccpc-digital-lenders", records: mergeCatalog(records) };
}

async function refreshPencom(url: string, category: "pension-fund-administrator" | "pension-fund-custodian", source: string): Promise<RefreshResult> {
  const $ = load(await fetchHtml(url));
  const records: Institution[] = [];
  $("h2").each((_, heading) => {
    const name = cleanText($(heading).text());
    if (!/Limited|Company|NUPEMCO/i.test(name) || !$(heading).nextAll("p").first().text().match(/MANAGING DIRECTOR/i)) return;
    records.push(makeInstitution({
      name, category, sourceUrl: url, regulator: "PenCom",
      licenceType: category === "pension-fund-administrator" ? "Pension fund administrator" : "Pension fund custodian"
    }));
  });
  return { source, records: mergeCatalog(records) };
}

async function refreshNaicom(url: string, source: string, broker: boolean): Promise<RefreshResult> {
  const response = await fetch(url, { headers: { "user-agent": "awalogo/0.1 (+https://awalogo.com; open-source data refresh)" } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const workbook = XLSX.read(await response.arrayBuffer());
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const records = rows.filter((row) => String(broker ? row.BrokerStatus : row.CompanyStatus) === "0" && cleanText(String(broker ? row.BrokerName : row.CompanyName))).map((row) => {
    const name = cleanText(String(broker ? row.BrokerName : row.CompanyName));
    const category: InstitutionCategory = broker ? "insurance-broker" : /reinsurance|retakaful/i.test(name) ? "reinsurer" : "insurer";
    const acronym = cleanText(String(broker ? row.BrokerCode : row.CompanyAcronyms));
    return makeInstitution({
      name, aliases: acronym ? [acronym] : [], category, sourceUrl: url,
      regulator: "NAICOM", licenceType: broker ? "Insurance broker" : category === "reinsurer" ? "Reinsurance company" : "Insurance company"
    });
  });
  return { source, records: mergeCatalog(records) };
}

const stagingRoot = join(packageRoot, "staging");
await mkdir(stagingRoot, { recursive: true });
const settled = await Promise.allSettled([
  refreshCbnPayments(), refreshCbnImtos(), refreshSecFintech(), refreshFccpcLenders(),
  refreshPencom(pencomPfaUrl, "pension-fund-administrator", "pencom-pfas"),
  refreshPencom(pencomPfcUrl, "pension-fund-custodian", "pencom-pfcs"),
  refreshNaicom(naicomInsurersUrl, "naicom-insurers", false),
  refreshNaicom(naicomBrokersUrl, "naicom-brokers", true)
]);
const report: Array<Record<string, unknown>> = [];
for (const result of settled) {
  if (result.status === "rejected") {
    report.push({ status: "failed", error: String(result.reason) });
    continue;
  }
  const path = join(stagingRoot, `${result.value.source}.candidates.json`);
  await writeFile(path, JSON.stringify(result.value.records, null, 2) + "\n");
  report.push({ source: result.value.source, status: "staged", records: result.value.records.length, path: path.replace(`${packageRoot}/`, "") });
}
await writeFile(join(stagingRoot, "refresh-report.json"), JSON.stringify({ refreshed_at: snapshotDate, results: report }, null, 2) + "\n");
console.log("Regulator candidates staged for review. Accepted imports were not modified.");
for (const entry of report) console.log(`- ${entry.source ?? "source"}: ${entry.status}${entry.records ? ` (${entry.records})` : ""}`);

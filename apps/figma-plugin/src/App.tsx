import { useEffect, useLayoutEffect, useMemo, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  ArrowUp,
  ArrowUpRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  ChartLine,
  Check,
  Copy,
  FileCode2,
  FileImage,
  GitFork,
  History,
  Image as ImageIcon,
  Images,
  Landmark,
  Layers3,
  LayoutGrid,
  Monitor,
  MessageSquarePlus,
  Moon,
  Network,
  RadioTower,
  RefreshCw,
  Search,
  Send,
  Scale,
  ShieldCheck,
  Smartphone,
  Sun,
  WalletCards,
  X,
  type LucideIcon
} from "lucide-react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import type { LogoFormatType } from "@nigerian-bank-logos/core";
import type { InstitutionCategory } from "@nigerian-bank-logos/institutions";
import {
  availableInstitutionCategories,
  availableLogoCount,
  canonicalLogoCount,
  categoryLabel,
  logoCatalogItems,
  type CatalogItem
} from "./catalog-data";
import { searchScore } from "./catalog-search";
import { buildCompanyLogoSubmissionUrl, buildLogoRequestUrl } from "./logo-request";
import type { LogoAsset } from "./logo-data";
import "./styles.css";

type PluginMessage =
  | { type: "inserted"; name: string }
  | { type: "error"; message: string };

type ProjectPanel = "changelog" | "contribute" | "request" | "trademarks";
type ThemeMode = "system" | "light" | "dark";

const PAGE_SIZE = 48;
const THEME_STORAGE_KEY = "nigerian-bank-logos-theme";
const categoryIcons: Partial<Record<InstitutionCategory, LucideIcon>> = {
  "commercial-bank": Landmark,
  "development-finance-institution": Building2,
  "digital-broker": ChartLine,
  "digital-lender": BadgeDollarSign,
  "financial-holding-company": Layers3,
  "finance-app": Smartphone,
  "insurance-broker": BriefcaseBusiness,
  "insurer": ShieldCheck,
  "investment-manager": WalletCards,
  "merchant-bank": Landmark,
  "microfinance-bank": Building2,
  "mobile-money-operator": Smartphone,
  "non-interest-bank": Landmark,
  "payment-service-holding-company": Layers3,
  "payment-service-bank": WalletCards,
  "remittance-imto": Send,
  "regulator": Scale,
  "super-agent": Network,
  "switching-processing": RefreshCw,
  "stockbroker": ChartLine
};
const darkPreviewSlugs = new Set([
  "busha-digital-light",
  "grey",
  "union-bank-of",
  "meristem-securities",
  "cardinalstone-securities",
  "chapel-hill-denham",
  "investnaija"
]);
const formatIcons: Record<LogoFormatType, LucideIcon> = {
  svg: FileCode2,
  png: FileImage,
  webp: Images,
  jpeg: ImageIcon
};
const categoryCounts = new Map(availableInstitutionCategories.map((category) => [
  category,
  logoCatalogItems.filter((item) => item.categories.includes(category)).length
]));
const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lagos"
});

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00+01:00`));
}

function getSourceDomain(sourceUrl: string) {
  return new URL(sourceUrl).hostname.replace(/^www\./, "");
}

function getAvailableFormats(logo: LogoAsset) {
  return logo.formats.map((format) => format.type.toUpperCase()).join(" · ");
}

function getCategorySummary(categories: InstitutionCategory[]) {
  return categories.map(categoryLabel).join(" · ");
}

function getInstitutionInitials(name: string) {
  const words = name
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "NG";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function previewUrl(logo: LogoAsset) {
  return logo.asset_urls.png ?? logo.asset_urls.webp ?? logo.asset_urls.jpeg ?? "";
}

function getInitialTheme(): ThemeMode {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") return storedTheme;
  } catch {
    // Figma or browser privacy settings may disable storage.
  }
  return "system";
}

function App() {
  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<InstitutionCategory[]>([]);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<LogoFormatType>("svg");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [toast, setToast] = useState("");
  const [projectPanel, setProjectPanel] = useState<ProjectPanel | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);

  useLayoutEffect(() => {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme = themeMode === "system" ? (systemTheme.matches ? "dark" : "light") : themeMode;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.dataset.themeMode = themeMode;
    };

    applyTheme();
    if (themeMode === "system") systemTheme.addEventListener("change", applyTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // Keep the active session theme when persistence is unavailable.
    }

    return () => systemTheme.removeEventListener("change", applyTheme);
  }, [themeMode]);

  useEffect(() => {
    function handlePluginMessage(event: MessageEvent<{ pluginMessage?: PluginMessage }>) {
      const message = event.data.pluginMessage;
      if (!message) return;
      setToast(message.type === "inserted" ? `${message.name} inserted` : message.message);
    }
    window.addEventListener("message", handlePluginMessage);
    return () => window.removeEventListener("message", handlePluginMessage);
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedItem(null);
        setProjectPanel(null);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => setVisibleLimit(PAGE_SIZE), [selectedCategories, query]);

  const filteredItems = useMemo(() => logoCatalogItems
    .map((item) => ({ item, score: searchScore(item, query) }))
    .filter(({ item, score }) => {
      const categoryMatches = selectedCategories.length === 0 ||
        selectedCategories.some((category) => item.categories.includes(category));
      return categoryMatches && Number.isFinite(score);
    })
    .sort((a, b) => a.score - b.score || a.item.displayName.localeCompare(b.item.displayName))
    .map(({ item }) => item), [selectedCategories, query]);

  const visibleItems = filteredItems.slice(0, visibleLimit);

  function insertLogo(logo: LogoAsset) {
    parent.postMessage({
      pluginMessage: { type: "insert-logo", name: logo.name, svg: logo.svg }
    }, "*");
  }

  async function copySvg(logo: LogoAsset) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(logo.svg);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = logo.svg;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("Copy command was rejected");
      }
      setToast(`${logo.name} SVG copied`);
    } catch {
      setToast("Unable to copy SVG");
    }
  }

  function openDetails(item: CatalogItem) {
    setSelectedFormat(item.logo?.formats[0]?.type ?? "png");
    setSelectedItem(item);
  }

  function toggleCategory(category: InstitutionCategory) {
    setSelectedCategories((current) => current.includes(category)
      ? current.filter((value) => value !== category)
      : [...current, category]);
  }

  function resetCatalog() {
    setQuery("");
    setSelectedCategories([]);
    setVisibleLimit(PAGE_SIZE);
    setProjectPanel(null);
    requestAnimationFrame(() => {
      document.getElementById("catalog-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function downloadCatalog() {
    const data = logoCatalogItems.map(({ institution, institutions, logo, displayName, categories }) => ({
      name: displayName,
      slug: institution.slug,
      institution_slugs: institutions.map((entry) => entry.slug),
      logo_slug: logo?.slug ?? null,
      categories,
      aliases: [...new Set(institutions.flatMap((entry) => entry.aliases))],
      website: logo.website,
      source_url: logo.source_url,
      formats: logo.formats.map((format) => format.type),
      logo_status: logo.status,
      added_at: logo.added_at
    }));
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "nigerian-financial-logo-catalog.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setToast("Catalog JSON downloaded");
  }

  function completeLogoRequest() {
    setProjectPanel(null);
    setToast("Submission prepared on GitHub");
  }

  function downloadLogo(logo: LogoAsset, formatType: LogoFormatType) {
    const format = logo.formats.find((entry) => entry.type === formatType);
    if (!format) return;
    const blobUrl = formatType === "svg"
      ? URL.createObjectURL(new Blob([logo.svg], { type: "image/svg+xml;charset=utf-8" }))
      : null;
    const downloadUrl = blobUrl ?? logo.asset_urls[formatType];
    if (!downloadUrl) {
      setToast(`${formatType.toUpperCase()} is unavailable`);
      return;
    }
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${logo.slug}.${formatType}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setToast(`${logo.name} ${formatType.toUpperCase()} downloaded`);
  }

  return (
    <main className="plugin-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">NG</span>
          <div>
            <strong>Nigerian Bank Logos</strong>
            <small>Open source financial brand directory</small>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="theme-toggle" role="group" aria-label="Color theme">
            <button
              type="button"
              aria-label="Use system theme"
              aria-pressed={themeMode === "system"}
              title="System theme"
              onClick={() => setThemeMode("system")}
            >
              <Monitor aria-hidden="true" size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label="Use light theme"
              aria-pressed={themeMode === "light"}
              title="Light theme"
              onClick={() => setThemeMode("light")}
            >
              <Sun aria-hidden="true" size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label="Use dark theme"
              aria-pressed={themeMode === "dark"}
              title="Dark theme"
              onClick={() => setThemeMode("dark")}
            >
              <Moon aria-hidden="true" size={14} strokeWidth={1.75} />
            </button>
          </div>
          <span className="asset-count" title={`${availableLogoCount.toLocaleString("en-NG")} available logos`}>
            {availableLogoCount.toLocaleString("en-NG")}
          </span>
        </div>
      </header>

      <section className="catalog-intro">
        <p className="eyebrow">Institution explorer</p>
        <h1>Find the right mark.</h1>
        <p>Browse Nigerian financial institutions and use cataloged brand assets.</p>
      </section>

      <section className="catalog-controls" aria-label="Catalog controls">
        <label className="search-box">
          <span>Search institutions</span>
          <Search className="search-icon" aria-hidden="true" size={18} strokeWidth={1.75} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) setQuery("");
            }}
            placeholder="Search name, alias, licence, or regulator"
          />
          {query ? (
            <button
              className="search-clear"
              type="button"
              aria-label="Clear search"
              title="Clear search"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setQuery("")}
            >
              <X aria-hidden="true" size={17} strokeWidth={1.75} />
            </button>
          ) : null}
        </label>

        <div className="catalog-toolbar">
          <div className="category-capsules" role="group" aria-label="Filter by category">
            <button
              className={`category-capsule${selectedCategories.length === 0 ? " selected" : ""}`}
              type="button"
              aria-pressed={selectedCategories.length === 0}
              onClick={() => setSelectedCategories([])}
            >
              <LayoutGrid aria-hidden="true" size={15} strokeWidth={1.75} />
              <span>All categories</span>
              <small>{availableLogoCount.toLocaleString("en-NG")}</small>
              <span className="capsule-check">{selectedCategories.length === 0 ? <Check aria-hidden="true" size={13} /> : null}</span>
            </button>
            {availableInstitutionCategories.map((category) => {
              const Icon = categoryIcons[category] ?? RadioTower;
              const selected = selectedCategories.includes(category);
              return (
                <button
                  className={`category-capsule${selected ? " selected" : ""}`}
                  key={category}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleCategory(category)}
                >
                  <Icon aria-hidden="true" size={15} strokeWidth={1.75} />
                  <span>{categoryLabel(category)}</span>
                  <small>{categoryCounts.get(category)}</small>
                  <span className="capsule-check">{selected ? <Check aria-hidden="true" size={13} /> : null}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="results-summary" id="catalog-results" aria-live="polite">
        <span>{filteredItems.length.toLocaleString("en-NG")} {filteredItems.length === 1 ? "result" : "results"}</span>
        <span>{availableLogoCount.toLocaleString("en-NG")} logo-linked institutions</span>
      </div>

      {filteredItems.length === 0 ? (
        <section className="empty-state">
          <span aria-hidden="true">0</span>
          <h2>No matching institution</h2>
          <p>Try another search or request the missing logo.</p>
          <button className="empty-state-action" type="button" onClick={() => setProjectPanel("request")}>
            <MessageSquarePlus aria-hidden="true" size={15} strokeWidth={1.8} /> Request this logo
          </button>
        </section>
      ) : (
        <>
          <section className="logo-grid" aria-label="Financial institutions">
            {visibleItems.map((item, index) => {
              const { logo, displayName, categories } = item;
              return (
                <button
                  className={`logo-tile${logo ? "" : " logo-pending"}`}
                  key={item.institution.slug}
                  type="button"
                  onClick={() => openDetails(item)}
                  style={{ animationDelay: `${(index % 12) * 30}ms` }}
                  aria-label={`View ${displayName} details`}
                >
                  <span className={`tile-preview${logo && darkPreviewSlugs.has(logo.slug) ? " logo-preview-dark" : ""}`}>
                    {logo ? <img src={previewUrl(logo)} alt="" /> : (
                      <span className="pending-preview" aria-hidden="true">
                        <span className="pending-monogram">{getInstitutionInitials(displayName)}</span>
                        <span>Awaiting verified asset</span>
                      </span>
                    )}
                  </span>
                  <span className="tile-copy">
                    <strong>{displayName}</strong>
                    <small>{getCategorySummary(categories)}</small>
                  </span>
                  <span className="tile-meta">
                    <span className={logo ? "" : "pending-badge"}>{logo ? getAvailableFormats(logo) : "Asset pending"}</span>
                    <time dateTime={logo?.added_at ?? item.institution.added_at}>
                      {formatDate(logo?.added_at ?? item.institution.added_at)}
                    </time>
                  </span>
                </button>
              );
            })}
          </section>
          {visibleItems.length < filteredItems.length ? (
            <div className="load-more-row">
              <button type="button" onClick={() => setVisibleLimit((limit) => limit + PAGE_SIZE)}>
                Show more <span>{visibleItems.length} / {filteredItems.length.toLocaleString("en-NG")}</span>
              </button>
            </div>
          ) : null}
        </>
      )}

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-topbar">
            <div className="footer-brand">
              <Landmark aria-hidden="true" size={17} strokeWidth={1.7} />
              <strong>Nigerian Bank Logos</strong>
            </div>
            <nav className="footer-nav" aria-label="Project links">
              <button type="button" onClick={() => setProjectPanel("contribute")} aria-haspopup="dialog">Contribute</button>
              <button type="button" onClick={() => setProjectPanel("changelog")} aria-haspopup="dialog">Changelog</button>
              <button type="button" onClick={() => setProjectPanel("trademarks")} aria-haspopup="dialog">Trademark policy</button>
            </nav>
            <div className="footer-cta">
              <button type="button" onClick={downloadCatalog} title="Download catalog metadata as JSON">
                <ArrowDownToLine aria-hidden="true" size={15} /> Download JSON
              </button>
              <button type="button" onClick={() => setProjectPanel("request")} aria-haspopup="dialog" title="Request an unavailable logo">
                <MessageSquarePlus aria-hidden="true" size={15} /> Request a logo
              </button>
              <button className="footer-cta-primary" type="button" onClick={() => setProjectPanel("contribute")} aria-haspopup="dialog">
                Submit a logo
              </button>
            </div>
          </div>

          <div className="footer-body">
            <section className="footer-intro" aria-labelledby="footer-intro-title">
              <span className="footer-kicker">Open source · Nigeria</span>
              <h2 id="footer-intro-title">Logo infrastructure for Nigeria's financial ecosystem.</h2>
              <p>A community-maintained collection of verified assets for product designers, developers, and design systems.</p>
              <dl className="footer-stats">
                <div><dt>Listings</dt><dd>{availableLogoCount.toLocaleString("en-NG")}</dd></div>
                <div><dt>Canonical assets</dt><dd>{canonicalLogoCount}</dd></div>
              </dl>
            </section>

            <div className="footer-details">
              <div className="footer-detail-grid">
                <section>
                  <h3>Catalog</h3>
                  <p>Banks, fintechs, payment providers, insurers, investment firms, and other Nigerian financial institutions.</p>
                </section>
                <section>
                  <h3>Built for</h3>
                  <p>Figma workflows, websites, apps, documentation, and reusable design systems.</p>
                </section>
              </div>
              <section className="footer-disclosure">
                <h3>Asset notice</h3>
                <p>Verified assets are reviewed against institution-owned websites, official brand pages, annual reports, or other authoritative sources. Community imports remain marked for review until their provenance is confirmed.</p>
                <p>Code, metadata, and project tooling are available under the MIT License. Logo artwork and company names remain trademarks of their respective owners and are not relicensed by this project.</p>
              </section>
            </div>
          </div>

          <div className="footer-bottom">
            <div className="footer-meta-links">
              <a href="https://github.com/adeyemimayokun/nigerian-bank-logos" target="_blank" rel="noreferrer">
                <GitFork aria-hidden="true" size={15} /> GitHub
              </a>
              <span>MIT licensed tooling</span>
              <span>Updated 14 July 2026</span>
            </div>
            <div className="footer-copyright">
              <span>© 2026 Nigerian Bank Logos</span>
              <button
                type="button"
                aria-label="Back to top"
                title="Back to top"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                <ArrowUp aria-hidden="true" size={15} />
              </button>
            </div>
          </div>
        </div>
      </footer>

      {selectedItem ? (
        <DetailSheet
          item={selectedItem}
          selectedFormat={selectedFormat}
          onClose={() => setSelectedItem(null)}
          onFormatChange={setSelectedFormat}
          onCopySvg={copySvg}
          onDownload={downloadLogo}
          onInsert={insertLogo}
          onRequest={() => {
            setQuery(selectedItem.displayName);
            setSelectedItem(null);
            setProjectPanel("request");
          }}
        />
      ) : null}

      {projectPanel ? (
        <ProjectInfoSheet
          panel={projectPanel}
          initialRequestName={query}
          onClose={() => setProjectPanel(null)}
          onRequestSubmitted={completeLogoRequest}
        />
      ) : null}

      {toast ? <div className="toast" role="status" onAnimationEnd={() => setToast("")}>{toast}</div> : null}
      <SpeedInsights />
    </main>
  );
}

function ProjectInfoSheet({
  panel,
  initialRequestName,
  onClose,
  onRequestSubmitted
}: {
  panel: ProjectPanel;
  initialRequestName: string;
  onClose: () => void;
  onRequestSubmitted: () => void;
}) {
  const isContributionGuide = panel === "contribute";
  const isChangelog = panel === "changelog";
  const isRequest = panel === "request";
  const title = isContributionGuide
    ? "Submit your company logo"
    : isChangelog
      ? "Changelog"
      : isRequest
        ? "Request a logo"
        : "Trademark policy";
  const description = isContributionGuide
    ? "Send current official artwork for maintainer review."
    : isChangelog
      ? "New assets, features, and catalog improvements."
      : isRequest
        ? "Tell us which financial brand is missing."
      : "Logo ownership and acceptable use.";

  return (
    <div className="detail-backdrop project-backdrop" onMouseDown={onClose}>
      <aside
        className="detail-sheet project-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <header className="detail-header">
          <div>
            <span className="verified-label">Open source project</span>
            <h2 id="project-sheet-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Close" title="Close">×</button>
        </header>

        <div className="project-sheet-content">
          {isContributionGuide ? (
            <CompanyLogoSubmissionForm onSubmitted={onRequestSubmitted} />
          ) : isRequest ? (
            <LogoRequestForm
              initialName={initialRequestName}
              onSubmitted={onRequestSubmitted}
            />
          ) : isChangelog ? (
            <div className="changelog-list">
              <article className="changelog-entry">
                <header>
                  <div>
                    <time dateTime="2026-07-14">14 July 2026</time>
                    <h3>Catalog expansion</h3>
                  </div>
                  <span>Latest</span>
                </header>
                <ul>
                  <li>Added unavailable-logo requests with optional GitHub issue notifications.</li>
                  <li>Audited all 202 Nigeria Logos entries and added 41 financial assets as clearly marked community sources.</li>
                  <li>Added PocketApp, InvestNaija, i-invest, GetEquity, Wahed, and Hisa from official product sources.</li>
                  <li>Added AB Microfinance Bank and backfilled institution-to-logo links across the regulator exports.</li>
                  <li>Expanded the regulated directory with a categorized community fintech research list, keeping unverified candidates clearly separated and using explicit pending states where verified artwork is unavailable.</li>
                  <li>Added PNG and WebP downloads alongside available SVG files.</li>
                  <li>Merged duplicate institution brands under familiar display names.</li>
                  <li>Added relevance-ranked search and multi-category filtering.</li>
                  <li>Added official website links, theme controls, and floating project panels.</li>
                </ul>
              </article>
              <article className="changelog-entry">
                <header>
                  <div>
                    <time dateTime="2026-07-13">13 July 2026</time>
                    <h3>Initial release</h3>
                  </div>
                </header>
                <ul>
                  <li>Launched the searchable Nigerian financial institution logo catalog.</li>
                  <li>Added verified source metadata and logo detail previews.</li>
                  <li>Introduced editable SVG insertion for the Figma plugin.</li>
                  <li>Added catalog validation and an open source contribution workflow.</li>
                </ul>
              </article>
            </div>
          ) : (
            <>
              <p>Code, metadata, and project tooling are MIT licensed. Logo artwork is not included in that licence.</p>
              <p>Each institution retains ownership of its trademarks. Using an asset from this catalog does not grant ownership or permission to imply endorsement, partnership, or affiliation.</p>
              <p>Maintainers may remove artwork when its source cannot be verified, it becomes outdated, or its owner requests removal.</p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function CompanyLogoSubmissionForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [companyName, setCompanyName] = useState("");
  const [officialWebsite, setOfficialWebsite] = useState("");
  const [category, setCategory] = useState("Fintech");
  const [submitterRole, setSubmitterRole] = useState("");
  const [logoFormat, setLogoFormat] = useState("SVG");
  const [logoAssetUrl, setLogoAssetUrl] = useState("");
  const [brandGuidelinesUrl, setBrandGuidelinesUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [error, setError] = useState("");

  function isValidUrl(value: string) {
    try {
      return /^https?:$/.test(new URL(value).protocol);
    } catch {
      return false;
    }
  }

  function submitLogo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (companyName.trim().length < 2) {
      setError("Enter your company name.");
      return;
    }
    if (!isValidUrl(officialWebsite.trim())) {
      setError("Enter your complete official website URL beginning with http:// or https://.");
      return;
    }
    if (logoAssetUrl.trim() && !isValidUrl(logoAssetUrl.trim())) {
      setError("Enter a complete logo or brand-kit URL, or leave it blank to attach the file on GitHub.");
      return;
    }
    if (brandGuidelinesUrl.trim() && !isValidUrl(brandGuidelinesUrl.trim())) {
      setError("Enter a complete brand guidelines URL beginning with http:// or https://.");
      return;
    }
    if (!rightsConfirmed) {
      setError("Confirm that you are authorized to submit the company artwork.");
      return;
    }

    setError("");
    const submissionUrl = buildCompanyLogoSubmissionUrl({
      companyName,
      officialWebsite,
      category,
      submitterRole,
      logoFormat,
      logoAssetUrl,
      brandGuidelinesUrl,
      notes,
      rightsConfirmed
    });
    const link = document.createElement("a");
    link.href = submissionUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    onSubmitted();
  }

  return (
    <form className="logo-request-form" onSubmit={submitLogo} noValidate>
      <label className="request-field">
        <span>Company name <strong aria-hidden="true">*</strong></span>
        <input
          autoFocus
          value={companyName}
          onChange={(event) => {
            setCompanyName(event.target.value);
            setError("");
          }}
          placeholder="e.g. Example Financial Services"
          autoComplete="organization"
        />
      </label>

      <label className="request-field">
        <span>Official website <strong aria-hidden="true">*</strong></span>
        <input
          type="url"
          value={officialWebsite}
          onChange={(event) => {
            setOfficialWebsite(event.target.value);
            setError("");
          }}
          placeholder="https://yourcompany.com"
          autoComplete="url"
        />
      </label>

      <div className="request-field-row">
        <label className="request-field">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>Bank</option>
            <option>Fintech</option>
            <option>Insurance</option>
            <option>Investment platform</option>
            <option>Payments</option>
            <option>Remittance</option>
            <option>Other</option>
          </select>
        </label>
        <label className="request-field">
          <span>Your role</span>
          <input
            value={submitterRole}
            onChange={(event) => setSubmitterRole(event.target.value)}
            placeholder="e.g. Brand manager"
            autoComplete="organization-title"
          />
        </label>
      </div>

      <div className="request-field-row">
        <label className="request-field">
          <span>Primary format</span>
          <select value={logoFormat} onChange={(event) => setLogoFormat(event.target.value)}>
            <option>SVG</option>
            <option>PNG</option>
            <option>WebP</option>
            <option>Multiple formats</option>
            <option>Brand kit</option>
          </select>
        </label>
        <label className="request-field">
          <span>Logo or brand-kit URL</span>
          <input
            type="url"
            value={logoAssetUrl}
            onChange={(event) => {
              setLogoAssetUrl(event.target.value);
              setError("");
            }}
            placeholder="https://"
          />
        </label>
      </div>

      <label className="request-field">
        <span>Brand guidelines URL</span>
        <input
          type="url"
          value={brandGuidelinesUrl}
          onChange={(event) => {
            setBrandGuidelinesUrl(event.target.value);
            setError("");
          }}
          placeholder="https://"
        />
      </label>

      <label className="request-field">
        <span>Notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Tell maintainers which logo lockup and color variant should be treated as primary."
          rows={3}
        />
      </label>

      <label className="request-consent">
        <input
          type="checkbox"
          checked={rightsConfirmed}
          onChange={(event) => {
            setRightsConfirmed(event.target.checked);
            setError("");
          }}
        />
        <span>
          <strong>I am authorized to submit this artwork</strong>
          <small>I confirm that this is the company's current official logo and may be reviewed for inclusion in the public catalog.</small>
        </span>
      </label>

      {error ? <p className="request-error" role="alert">{error}</p> : null}

      <div className="request-submit-row">
        <p>GitHub opens with these details prefilled. Attach the logo file there before submitting when no public asset URL is available.</p>
        <button className="project-sheet-action" type="submit">
          Continue on GitHub <ArrowUpRight aria-hidden="true" size={15} strokeWidth={1.8} />
        </button>
      </div>
    </form>
  );
}

function LogoRequestForm({
  initialName,
  onSubmitted
}: {
  initialName: string;
  onSubmitted: () => void;
}) {
  const [institutionName, setInstitutionName] = useState(initialName.trim());
  const [officialWebsite, setOfficialWebsite] = useState("");
  const [category, setCategory] = useState("Finance app");
  const [notes, setNotes] = useState("");
  const [notificationConsent, setNotificationConsent] = useState(false);
  const [error, setError] = useState("");

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (institutionName.trim().length < 2) {
      setError("Enter the institution or product name.");
      return;
    }
    if (officialWebsite.trim()) {
      try {
        const url = new URL(officialWebsite.trim());
        if (!/^https?:$/.test(url.protocol)) throw new Error();
      } catch {
        setError("Enter a complete website URL beginning with http:// or https://.");
        return;
      }
    }

    setError("");
    const requestUrl = buildLogoRequestUrl({
      institutionName,
      officialWebsite,
      category,
      notes,
      notificationConsent
    });
    const link = document.createElement("a");
    link.href = requestUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    onSubmitted();
  }

  return (
    <form className="logo-request-form" onSubmit={submitRequest} noValidate>
      <label className="request-field">
        <span>Institution or product name <strong aria-hidden="true">*</strong></span>
        <input
          autoFocus
          value={institutionName}
          onChange={(event) => {
            setInstitutionName(event.target.value);
            setError("");
          }}
          placeholder="e.g. PocketApp"
          autoComplete="organization"
          aria-invalid={Boolean(error && institutionName.trim().length < 2)}
        />
      </label>

      <div className="request-field-row">
        <label className="request-field">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>Bank</option>
            <option>Finance app</option>
            <option>Fintech</option>
            <option>Insurance</option>
            <option>Investment platform</option>
            <option>Payments</option>
            <option>Other</option>
          </select>
        </label>
        <label className="request-field">
          <span>Official website</span>
          <input
            type="url"
            value={officialWebsite}
            onChange={(event) => {
              setOfficialWebsite(event.target.value);
              setError("");
            }}
            placeholder="https://"
            autoComplete="url"
            aria-invalid={Boolean(error && officialWebsite.trim())}
          />
        </label>
      </div>

      <label className="request-field">
        <span>Notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Where can maintainers find the current brand artwork?"
          rows={3}
        />
      </label>

      <label className="request-consent">
        <input
          type="checkbox"
          checked={notificationConsent}
          onChange={(event) => setNotificationConsent(event.target.checked)}
        />
        <span>
          <strong>Notify me when it is added</strong>
          <small>I consent to updates through the GitHub issue. GitHub controls delivery, and I can unsubscribe at any time.</small>
        </span>
      </label>

      {error ? <p className="request-error" role="alert">{error}</p> : null}

      <div className="request-submit-row">
        <p>No email address is collected. You will review the request before submitting it on GitHub.</p>
        <button className="project-sheet-action" type="submit">
          Continue on GitHub <ArrowUpRight aria-hidden="true" size={15} strokeWidth={1.8} />
        </button>
      </div>
    </form>
  );
}

function DetailSheet({
  item,
  selectedFormat,
  onClose,
  onFormatChange,
  onCopySvg,
  onDownload,
  onInsert,
  onRequest
}: {
  item: CatalogItem;
  selectedFormat: LogoFormatType;
  onClose: () => void;
  onFormatChange: (format: LogoFormatType) => void;
  onCopySvg: (logo: LogoAsset) => void;
  onDownload: (logo: LogoAsset, format: LogoFormatType) => void;
  onInsert: (logo: LogoAsset) => void;
  onRequest: () => void;
}) {
  const { logo, displayName, categories } = item;
  const [selectedVariationId, setSelectedVariationId] = useState("primary");
  if (!logo) {
    const institutionSource = item.institution.sources[0]?.url;
    return (
      <div className="detail-backdrop" onMouseDown={onClose}>
        <aside className="detail-sheet" aria-label={`${displayName} details`} onMouseDown={(event) => event.stopPropagation()}>
          <div className="sheet-handle" aria-hidden="true" />
          <header className="detail-header">
            <div>
              <span className="verified-label pending"><span aria-hidden="true" /> Asset pending</span>
              <h2>{displayName}</h2>
              <p>{getCategorySummary(categories)}</p>
            </div>
            <button className="close-button" type="button" onClick={onClose} aria-label="Close details" title="Close">×</button>
          </header>

          <div className="detail-media pending-detail-media">
            <div className="detail-preview pending-detail-preview">
              <span className="pending-monogram large" aria-hidden="true">{getInstitutionInitials(displayName)}</span>
              <span>Awaiting a verified official source</span>
            </div>
          </div>

          <dl className="detail-facts">
            <div>
              <dt>Logo status</dt>
              <dd>Pending verified asset</dd>
            </div>
            <div>
              <dt>Institution added</dt>
              <dd>{formatDate(item.institution.added_at)}</dd>
            </div>
            {institutionSource ? (
              <div className="source-row">
                <dt>Institution source</dt>
                <dd><a href={institutionSource} target="_blank" rel="noreferrer">{getSourceDomain(institutionSource)}</a></dd>
              </div>
            ) : null}
          </dl>

          <div className="detail-actions single">
            <button className="insert-button" type="button" onClick={onRequest}>
              <MessageSquarePlus aria-hidden="true" size={15} strokeWidth={1.8} /> Request verified logo
            </button>
          </div>
        </aside>
      </div>
    );
  }
  const websiteUrl = logo.website;
  const variationAssets: Array<{ id: string; label: string; asset: LogoAsset }> = [
    {
      id: "primary",
      label: "Primary",
      asset: logo
    },
    ...logo.variations.map((variation) => ({
      id: variation.id,
      label: variation.name,
      asset: {
        name: `${logo.name} ${variation.name}`,
        slug: `${logo.slug}-${variation.id}`,
        formats: variation.formats,
        svg: variation.svg,
        asset_urls: variation.asset_urls
      }
    }))
  ];
  const activeVariation = variationAssets.find((variation) => variation.id === selectedVariationId) ?? variationAssets[0];
  const activeLogo = activeVariation.asset;

  function selectVariation(id: string) {
    const variation = variationAssets.find((entry) => entry.id === id);
    if (!variation) return;
    setSelectedVariationId(id);
    if (!variation.asset.formats.some((format) => format.type === selectedFormat)) {
      onFormatChange(variation.asset.formats[0].type);
    }
  }

  return (
    <div className="detail-backdrop" onMouseDown={onClose}>
      <aside className="detail-sheet" aria-label={`${displayName} details`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="detail-header">
          <div>
            <span className={`verified-label${logo.status === "verified" ? "" : " community"}`}>
              <span aria-hidden="true" /> {logo.status === "verified" ? "Verified source" : logo.status === "deprecated" ? "Deprecated asset" : "Community source"}
            </span>
            <h2>{displayName}</h2>
            <p>{getCategorySummary(categories)}</p>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Close details" title="Close">×</button>
        </header>

        {variationAssets.length > 1 ? (
          <div className="variation-picker">
            <span>Variation</span>
            <div role="group" aria-label="Logo variation">
              {variationAssets.map((variation) => (
                <button
                  key={variation.id}
                  type="button"
                  className={activeVariation.id === variation.id ? "active" : ""}
                  onClick={() => selectVariation(variation.id)}
                  aria-pressed={activeVariation.id === variation.id}
                >
                  {variation.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="detail-media">
          <div className="format-picker" aria-label="Download format">
            {activeLogo.formats.map((format) => {
              const FormatIcon = formatIcons[format.type];
              const label = format.type.toUpperCase();
              return (
                <button
                  key={format.type}
                  type="button"
                  className={selectedFormat === format.type ? "active" : ""}
                  onClick={() => onFormatChange(format.type)}
                  aria-label={`Select ${label} format`}
                  aria-pressed={selectedFormat === format.type}
                  title={label}
                >
                  <FormatIcon aria-hidden="true" size={15} strokeWidth={1.8} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <div className={`detail-preview${darkPreviewSlugs.has(activeLogo.slug) ? " logo-preview-dark" : ""}`}>
            <img src={previewUrl(activeLogo)} alt="" />
          </div>
        </div>

        <dl className="detail-facts">
          <div>
            <dt>Available formats</dt>
            <dd>{getAvailableFormats(activeLogo)}</dd>
          </div>
          <div>
            <dt>Added</dt>
            <dd>{formatDate(logo.added_at)}</dd>
          </div>
          <div className="source-row">
            <dt>Official website</dt>
            <dd>
              <a href={websiteUrl} target="_blank" rel="noreferrer" title={`Visit ${displayName} website`}>
                {getSourceDomain(websiteUrl)}
              </a>
            </dd>
          </div>
        </dl>

        <div className={`detail-actions${activeLogo.svg ? "" : " single"}`}>
          <button className="download-button" type="button" onClick={() => onDownload(activeLogo, selectedFormat)}>
            Download {selectedFormat.toUpperCase()}
          </button>
          {activeLogo.svg ? (
            <>
              <button className="copy-button" type="button" onClick={() => onCopySvg(activeLogo)}>
                <Copy aria-hidden="true" size={15} strokeWidth={1.8} /> Copy SVG
              </button>
              <button className="insert-button" type="button" onClick={() => onInsert(activeLogo)}>
                Insert {activeVariation.id === "primary" ? displayName : activeVariation.label}
              </button>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

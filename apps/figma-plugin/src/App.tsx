import { useEffect, useLayoutEffect, useMemo, useState } from "react";
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
  History,
  Image as ImageIcon,
  Images,
  Landmark,
  Layers3,
  LayoutGrid,
  Monitor,
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
import type { LogoFormatType } from "@nigerian-bank-logos/core";
import type { InstitutionCategory } from "@nigerian-bank-logos/institutions";
import {
  availableInstitutionCategories,
  availableLogoCount,
  canonicalLogoCount,
  catalogItems,
  categoryLabel,
  type CatalogItem
} from "./catalog-data";
import { searchScore } from "./catalog-search";
import type { LogoWithSvg } from "./logo-data";
import "./styles.css";

type PluginMessage =
  | { type: "inserted"; name: string }
  | { type: "error"; message: string };

type ProjectPanel = "changelog" | "contribute" | "trademarks";
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
  "union-bank-of",
  "meristem-securities",
  "cardinalstone-securities",
  "chapel-hill-denham"
]);
const formatIcons: Record<LogoFormatType, LucideIcon> = {
  svg: FileCode2,
  png: FileImage,
  webp: Images,
  jpeg: ImageIcon
};
const categoryCounts = new Map(availableInstitutionCategories.map((category) => [
  category,
  catalogItems.filter((item) => item.categories.includes(category)).length
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

function getAvailableFormats(logo: LogoWithSvg) {
  return logo.formats.map((format) => format.type.toUpperCase()).join(" · ");
}

function getCategorySummary(categories: InstitutionCategory[]) {
  return categories.map(categoryLabel).join(" · ");
}

function previewUrl(logo: LogoWithSvg) {
  return logo.asset_urls.png ?? logo.asset_urls.webp ?? logo.asset_urls.jpeg;
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

  const filteredItems = useMemo(() => catalogItems
    .map((item) => ({ item, score: searchScore(item, query) }))
    .filter(({ item, score }) => {
      const categoryMatches = selectedCategories.length === 0 ||
        selectedCategories.some((category) => item.categories.includes(category));
      return categoryMatches && Number.isFinite(score);
    })
    .sort((a, b) => a.score - b.score || a.item.displayName.localeCompare(b.item.displayName))
    .map(({ item }) => item), [selectedCategories, query]);

  const visibleItems = filteredItems.slice(0, visibleLimit);

  function insertLogo(logo: LogoWithSvg) {
    parent.postMessage({
      pluginMessage: { type: "insert-logo", name: logo.name, svg: logo.svg }
    }, "*");
  }

  async function copySvg(logo: LogoWithSvg) {
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
    setSelectedFormat(item.logo.formats[0]?.type ?? "png");
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
    const data = catalogItems.map(({ institutions, logo, displayName, categories }) => ({
      name: displayName,
      slug: logo.slug,
      institution_slugs: institutions.map((institution) => institution.slug),
      categories,
      aliases: [...new Set(institutions.flatMap((institution) => [institution.brand_name, ...institution.aliases]))],
      website: logo.website,
      source_url: logo.source_url,
      formats: logo.formats.map((format) => format.type),
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

  async function copySourcingCommand() {
    try {
      await navigator.clipboard.writeText("pnpm logos:source");
      setToast("Sourcing command copied");
    } catch {
      setToast("Run pnpm logos:source to prepare logo candidates");
    }
  }

  function downloadLogo(logo: LogoWithSvg, formatType: LogoFormatType) {
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
          <span className="asset-count" title={`${availableLogoCount} approved logos`}>
            {catalogItems.length}
          </span>
        </div>
      </header>

      <section className="catalog-intro">
        <p className="eyebrow">Institution explorer</p>
        <h1>Find the right mark.</h1>
        <p>Browse Nigerian financial institutions and use approved brand assets.</p>
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
              <small>{catalogItems.length}</small>
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
        <span>{availableLogoCount} approved logos</span>
      </div>

      {filteredItems.length === 0 ? (
        <section className="empty-state">
          <span aria-hidden="true">0</span>
          <h2>No matching institution</h2>
          <p>Clear the search or choose another category.</p>
        </section>
      ) : (
        <>
          <section className="logo-grid" aria-label="Financial institutions">
            {visibleItems.map((item, index) => {
              const { logo, displayName, categories } = item;
              return (
                <button
                  className="logo-tile"
                  key={logo.slug}
                  type="button"
                  onClick={() => openDetails(item)}
                  style={{ animationDelay: `${(index % 12) * 30}ms` }}
                  aria-label={`View ${displayName} details`}
                >
                  {logo.svg ? (
                    <span className={`tile-preview${darkPreviewSlugs.has(logo.slug) ? " logo-preview-dark" : ""}`} dangerouslySetInnerHTML={{ __html: logo.svg }} />
                  ) : (
                    <span className={`tile-preview${darkPreviewSlugs.has(logo.slug) ? " logo-preview-dark" : ""}`}><img src={previewUrl(logo)} alt="" /></span>
                  )}
                  <span className="tile-copy">
                    <strong>{displayName}</strong>
                    <small>{getCategorySummary(categories)}</small>
                  </span>
                  <span className="tile-meta">
                    <span>{getAvailableFormats(logo)}</span>
                    <time dateTime={logo.added_at}>
                      {formatDate(logo.added_at)}
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
        <nav className="footer-links" aria-label="Project links">
          <button type="button" onClick={resetCatalog} title="Browse the complete logo catalog">
            <ArrowUpRight aria-hidden="true" size={18} strokeWidth={1.6} />
            <span>Browse all {availableLogoCount} logos</span>
          </button>
          <button type="button" onClick={downloadCatalog} title="Download catalog metadata as JSON">
            <ArrowDownToLine aria-hidden="true" size={18} strokeWidth={1.6} />
            <span>Download catalog JSON</span>
          </button>
          <button type="button" onClick={() => setProjectPanel("contribute")} aria-haspopup="dialog" title="Open the contribution guide">
            <ArrowUpRight aria-hidden="true" size={18} strokeWidth={1.6} />
            <span>Contribute a logo</span>
          </button>
          <button type="button" onClick={() => setProjectPanel("trademarks")} aria-haspopup="dialog" title="Read the trademark policy">
            <ArrowUpRight aria-hidden="true" size={18} strokeWidth={1.6} />
            <span>Trademark policy</span>
          </button>
          <button type="button" onClick={() => setProjectPanel("changelog")} aria-haspopup="dialog" title="View project updates">
            <History aria-hidden="true" size={18} strokeWidth={1.6} />
            <span>Changelog</span>
          </button>
        </nav>

        <div className="footer-outro">
          <button
            className="back-to-top"
            type="button"
            aria-label="Back to top"
            title="Back to top"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <ArrowUp aria-hidden="true" size={30} strokeWidth={1.5} />
          </button>
          <div className="footer-copy">
            <p className="footer-lead">Nigerian Bank Logos is a community-maintained collection for designers and developers.</p>
            <p>Every asset is reviewed against an official source before it reaches the catalog. Code and tooling are MIT licensed; logo trademarks remain the property of their respective institutions.</p>
            <div className="footer-actions">
              <button type="button" onClick={downloadCatalog} title="Download catalog metadata as JSON">
                <ArrowDownToLine aria-hidden="true" size={16} /> Download catalog
              </button>
              <button type="button" onClick={() => setProjectPanel("contribute")} aria-haspopup="dialog" title="Open the contribution guide">
                <ArrowUpRight aria-hidden="true" size={16} /> Contribute a logo
              </button>
            </div>
            <small>{availableLogoCount} institution listings · {canonicalLogoCount} canonical assets · Updated 14 July 2026</small>
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
        />
      ) : null}

      {projectPanel ? (
        <ProjectInfoSheet
          panel={projectPanel}
          onClose={() => setProjectPanel(null)}
          onCopySourcingCommand={copySourcingCommand}
        />
      ) : null}

      {toast ? <div className="toast" role="status" onAnimationEnd={() => setToast("")}>{toast}</div> : null}
    </main>
  );
}

function ProjectInfoSheet({
  panel,
  onClose,
  onCopySourcingCommand
}: {
  panel: ProjectPanel;
  onClose: () => void;
  onCopySourcingCommand: () => void;
}) {
  const isContributionGuide = panel === "contribute";
  const isChangelog = panel === "changelog";
  const title = isContributionGuide ? "Contribute a logo" : isChangelog ? "Changelog" : "Trademark policy";
  const description = isContributionGuide
    ? "Help keep the catalog accurate and current."
    : isChangelog
      ? "New assets, features, and catalog improvements."
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
            <>
              <p>Only submit current artwork from an institution-owned website, official media kit, annual report, investor document, or another verifiable official source.</p>
              <ol>
                <li>Add the original SVG or raster file under <code>packages/logos/src</code>.</li>
                <li>Add its metadata and official source URL to the logo catalog.</li>
                <li>Generate available formats and run validation before opening a pull request.</li>
              </ol>
              <button className="project-sheet-action" type="button" onClick={onCopySourcingCommand}>
                Copy sourcing command
              </button>
            </>
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
                  <li>Expanded the verified catalog to 139 listings, including banks, stockbrokers, regulators, and consumer finance apps.</li>
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

function DetailSheet({
  item,
  selectedFormat,
  onClose,
  onFormatChange,
  onCopySvg,
  onDownload,
  onInsert
}: {
  item: CatalogItem;
  selectedFormat: LogoFormatType;
  onClose: () => void;
  onFormatChange: (format: LogoFormatType) => void;
  onCopySvg: (logo: LogoWithSvg) => void;
  onDownload: (logo: LogoWithSvg, format: LogoFormatType) => void;
  onInsert: (logo: LogoWithSvg) => void;
}) {
  const { logo, displayName, categories } = item;
  const websiteUrl = logo.website;
  return (
    <div className="detail-backdrop" onMouseDown={onClose}>
      <aside className="detail-sheet" aria-label={`${displayName} details`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="detail-header">
          <div>
            <span className="verified-label">
              <span aria-hidden="true" /> Verified source
            </span>
            <h2>{displayName}</h2>
            <p>{getCategorySummary(categories)}</p>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Close details" title="Close">×</button>
        </header>

        <div className="detail-media">
          <div className="format-picker" aria-label="Download format">
            {logo.formats.map((format) => {
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
          {logo.svg ? (
            <div className={`detail-preview${darkPreviewSlugs.has(logo.slug) ? " logo-preview-dark" : ""}`} dangerouslySetInnerHTML={{ __html: logo.svg }} />
          ) : (
            <div className={`detail-preview${darkPreviewSlugs.has(logo.slug) ? " logo-preview-dark" : ""}`}><img src={previewUrl(logo)} alt="" /></div>
          )}
        </div>

        <dl className="detail-facts">
          <div>
            <dt>Available formats</dt>
            <dd>{getAvailableFormats(logo)}</dd>
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

        <div className={`detail-actions${logo.svg ? "" : " single"}`}>
          <button className="download-button" type="button" onClick={() => onDownload(logo, selectedFormat)}>
            Download {selectedFormat.toUpperCase()}
          </button>
          {logo.svg ? (
            <>
              <button className="copy-button" type="button" onClick={() => onCopySvg(logo)}>
                <Copy aria-hidden="true" size={15} strokeWidth={1.8} /> Copy SVG
              </button>
              <button className="insert-button" type="button" onClick={() => onInsert(logo)}>Insert {displayName}</button>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

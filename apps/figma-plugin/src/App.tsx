import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  ChartLine,
  Check,
  Landmark,
  Layers3,
  LayoutGrid,
  Network,
  RadioTower,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  WalletCards,
  X,
  type LucideIcon
} from "lucide-react";
import type { LogoFormatType } from "@nigerian-bank-logos/core";
import type { InstitutionCategory } from "@nigerian-bank-logos/institutions";
import {
  availableInstitutionCategories,
  availableLogoCount,
  catalogItems,
  categoryLabel,
  type CatalogItem
} from "./catalog-data";
import type { LogoWithSvg } from "./logo-data";
import "./styles.css";

type PluginMessage =
  | { type: "inserted"; name: string }
  | { type: "error"; message: string };

const PAGE_SIZE = 48;
const categoryIcons: Partial<Record<InstitutionCategory, LucideIcon>> = {
  "commercial-bank": Landmark,
  "development-finance-institution": Building2,
  "digital-broker": ChartLine,
  "digital-lender": BadgeDollarSign,
  "financial-holding-company": Layers3,
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
  "super-agent": Network,
  "switching-processing": RefreshCw
};
const categoryCounts = new Map(availableInstitutionCategories.map((category) => [
  category,
  catalogItems.filter((item) => item.institution.categories.includes(category)).length
]));
const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Lagos"
});

function matchesQuery(item: CatalogItem, query: string) {
  const institution = item.institution;
  const haystack = [
    institution.brand_name,
    institution.legal_name ?? "",
    institution.slug,
    ...institution.aliases,
    ...institution.regulators,
    ...institution.licence_types
  ].join(" ").toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00+01:00`));
}

function getSourceDomain(sourceUrl: string) {
  return new URL(sourceUrl).hostname.replace(/^www\./, "");
}

function getAvailableFormats(logo: LogoWithSvg) {
  return logo.formats.map((format) => format.type.toUpperCase()).join(" · ");
}

function previewUrl(logo: LogoWithSvg) {
  return logo.asset_urls.png ?? logo.asset_urls.webp ?? logo.asset_urls.jpeg;
}

function App() {
  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<InstitutionCategory[]>([]);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<LogoFormatType>("svg");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [toast, setToast] = useState("");

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
      if (event.key === "Escape") setSelectedItem(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => setVisibleLimit(PAGE_SIZE), [selectedCategories, query]);

  const filteredItems = useMemo(() => catalogItems.filter((item) => {
    const categoryMatches = selectedCategories.length === 0 ||
      selectedCategories.some((category) => item.institution.categories.includes(category));
    return categoryMatches && matchesQuery(item, query);
  }), [selectedCategories, query]);

  const visibleItems = filteredItems.slice(0, visibleLimit);

  function insertLogo(logo: LogoWithSvg) {
    parent.postMessage({
      pluginMessage: { type: "insert-logo", name: logo.name, svg: logo.svg }
    }, "*");
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
        <span className="asset-count" title={`${availableLogoCount} approved logos`}>
          {catalogItems.length}
        </span>
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

      <div className="results-summary" aria-live="polite">
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
              const { institution, logo } = item;
              return (
                <button
                  className="logo-tile"
                  key={institution.slug}
                  type="button"
                  onClick={() => openDetails(item)}
                  style={{ animationDelay: `${(index % 12) * 30}ms` }}
                  aria-label={`View ${institution.brand_name} details`}
                >
                  {logo.svg ? (
                    <span className="tile-preview" dangerouslySetInnerHTML={{ __html: logo.svg }} />
                  ) : (
                    <span className="tile-preview"><img src={previewUrl(logo)} alt="" /></span>
                  )}
                  <span className="tile-copy">
                    <strong>{institution.brand_name}</strong>
                    <small>{categoryLabel(institution.primary_category)}</small>
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

      {selectedItem ? (
        <DetailSheet
          item={selectedItem}
          selectedFormat={selectedFormat}
          onClose={() => setSelectedItem(null)}
          onFormatChange={setSelectedFormat}
          onDownload={downloadLogo}
          onInsert={insertLogo}
        />
      ) : null}

      {toast ? <div className="toast" role="status" onAnimationEnd={() => setToast("")}>{toast}</div> : null}
    </main>
  );
}

function DetailSheet({
  item,
  selectedFormat,
  onClose,
  onFormatChange,
  onDownload,
  onInsert
}: {
  item: CatalogItem;
  selectedFormat: LogoFormatType;
  onClose: () => void;
  onFormatChange: (format: LogoFormatType) => void;
  onDownload: (logo: LogoWithSvg, format: LogoFormatType) => void;
  onInsert: (logo: LogoWithSvg) => void;
}) {
  const { institution, logo } = item;
  const sourceUrl = logo.source_url;
  return (
    <div className="detail-backdrop" onMouseDown={onClose}>
      <aside className="detail-sheet" aria-label={`${institution.brand_name} details`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="detail-header">
          <div>
            <span className="verified-label">
              <span aria-hidden="true" /> Verified source
            </span>
            <h2>{institution.brand_name}</h2>
            <p>{categoryLabel(institution.primary_category)}</p>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Close details" title="Close">×</button>
        </header>

        {logo.svg ? (
          <div className="detail-preview" dangerouslySetInnerHTML={{ __html: logo.svg }} />
        ) : (
          <div className="detail-preview"><img src={previewUrl(logo)} alt="" /></div>
        )}

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
            <dt>Official brand source</dt>
            <dd><a href={sourceUrl} target="_blank" rel="noreferrer">{getSourceDomain(sourceUrl)}</a></dd>
          </div>
        </dl>

        <div
          className="format-picker"
          aria-label="Download format"
          style={{ gridTemplateColumns: `repeat(${logo.formats.length}, minmax(0, 1fr))` }}
        >
          {logo.formats.map((format) => (
            <button
              key={format.type}
              type="button"
              className={selectedFormat === format.type ? "active" : ""}
              onClick={() => onFormatChange(format.type)}
              aria-pressed={selectedFormat === format.type}
            >
              {format.type.toUpperCase()}
            </button>
          ))}
        </div>
        <div className={`detail-actions${logo.svg ? "" : " single"}`}>
          <button className="download-button" type="button" onClick={() => onDownload(logo, selectedFormat)}>
            Download {selectedFormat.toUpperCase()}
          </button>
          {logo.svg ? (
            <button className="insert-button" type="button" onClick={() => onInsert(logo)}>Insert {logo.name}</button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

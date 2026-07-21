import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUp,
  ArrowUpRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  ChartLine,
  Check,
  ChevronDown,
  Copy,
  FileCode2,
  FileImage,
  GitFork,
  GitPullRequest,
  Globe2,
  History,
  Image as ImageIcon,
  Images,
  Landmark,
  Layers3,
  LayoutGrid,
  Lock,
  LockOpen,
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
import type { LogoFormatType } from "@awalogo/core";
import type { InstitutionCategory } from "@awalogo/institutions";
import {
  availableInstitutionCategories,
  availableLogoCount,
  categoryLabel,
  logoCatalogItems,
  type CatalogItem
} from "./catalog-data";
import { searchScore } from "./catalog-search";
import { buildCompanyLogoSubmissionUrl, buildLogoRequestUrl } from "./logo-request";
import { postToFigma, subscribeToFigma } from "./figma-bridge";
import type { LogoAsset } from "./logo-data";
import awalogoLogoUrl from "../community-assets/awalogo-logo.svg";
import "./styles.css";

type ProjectPanel = "changelog" | "contribute" | "request" | "trademarks";
type ThemeMode = "system" | "light" | "dark";
type LogoDimensions = { width: number; height: number };

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

const svgPreviewUrls = new Map<string, string>();

function previewUrl(logo: LogoAsset) {
  if (!logo.svg) return logo.asset_urls.png ?? logo.asset_urls.webp ?? logo.asset_urls.jpeg ?? "";
  const cachedUrl = svgPreviewUrls.get(logo.svg);
  if (cachedUrl) return cachedUrl;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logo.svg)}`;
  svgPreviewUrls.set(logo.svg, url);
  return url;
}

async function copyTextToClipboard(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Text clipboard is unavailable");
}

function svgAtDimensions(svg: string, dimensions: LogoDimensions) {
  const documentNode = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (documentNode.querySelector("parsererror")) throw new Error("SVG is malformed");
  const root = documentNode.documentElement;
  if (root.tagName.toLowerCase() !== "svg") throw new Error("SVG root is missing");

  if (!root.hasAttribute("viewBox")) {
    const sourceWidth = Number.parseFloat(root.getAttribute("width") ?? "");
    const sourceHeight = Number.parseFloat(root.getAttribute("height") ?? "");
    if (Number.isFinite(sourceWidth) && sourceWidth > 0 && Number.isFinite(sourceHeight) && sourceHeight > 0) {
      root.setAttribute("viewBox", `0 0 ${sourceWidth} ${sourceHeight}`);
    }
  }

  root.setAttribute("width", String(dimensions.width));
  root.setAttribute("height", String(dimensions.height));
  return new XMLSerializer().serializeToString(root);
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
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [draftCategories, setDraftCategories] = useState<InstitutionCategory[]>([]);
  const [categoryQuery, setCategoryQuery] = useState("");
  const categoryPickerRef = useRef<HTMLDivElement>(null);

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
    return subscribeToFigma((message) => {
      setToast(message.type === "inserted"
        ? `${message.name} inserted`
        : message.type === "inserted-in-frame"
          ? `${message.name} inserted into selected frame`
          : message.type === "replaced"
            ? `Selected logo replaced with ${message.name}`
            : message.type === "clipped"
              ? `${message.name} clipped to selected shape`
              : message.message);
    });
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedItem(null);
        setProjectPanel(null);
        setCategoryPickerOpen(false);
        setCategoryQuery("");
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    if (!categoryPickerOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!categoryPickerRef.current?.contains(event.target as Node)) {
        setCategoryPickerOpen(false);
        setCategoryQuery("");
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [categoryPickerOpen]);

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
  const visibleCategories = useMemo(() => {
    const normalizedQuery = categoryQuery.trim().toLocaleLowerCase("en-NG");
    return normalizedQuery
      ? availableInstitutionCategories.filter((category) => categoryLabel(category)
        .toLocaleLowerCase("en-NG")
        .includes(normalizedQuery))
      : availableInstitutionCategories;
  }, [categoryQuery]);
  const draftResultCount = useMemo(() => logoCatalogItems.filter((item) => {
    const categoryMatches = draftCategories.length === 0 ||
      draftCategories.some((category) => item.categories.includes(category));
    return categoryMatches && Number.isFinite(searchScore(item, query));
  }).length, [draftCategories, query]);
  const categorySelectionLabel = selectedCategories.length === 0
    ? "All categories"
    : selectedCategories.length === 1
      ? categoryLabel(selectedCategories[0])
      : `${selectedCategories.length} categories`;
  const categorySelectionSummary = selectedCategories.length === 0
    ? "Browse every available institution"
    : selectedCategories.map(categoryLabel).join(", ");

  async function convertRaster(source: string, formatType: LogoFormatType): Promise<Blob | null> {
    if (formatType !== "png" && formatType !== "webp" && formatType !== "jpeg") return null;
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
    const mimeType = formatType === "jpeg" ? "image/jpeg" : `image/${formatType}`;
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.94));
  }

  async function logoBlob(logo: LogoAsset, formatType: LogoFormatType): Promise<Blob | null> {
    if (formatType === "svg") {
      return logo.svg ? new Blob([logo.svg], { type: "image/svg+xml;charset=utf-8" }) : null;
    }
    const exactAsset = logo.asset_urls[formatType];
    if (exactAsset) return fetch(exactAsset).then((response) => response.blob());
    const preview = previewUrl(logo);
    return preview ? convertRaster(preview, formatType) : null;
  }

  async function insertLogo(logo: LogoAsset, formatType: LogoFormatType, dimensions: LogoDimensions) {
    if (formatType === "svg" && logo.svg) {
      postToFigma({ type: "insert-logo", name: logo.name, svg: logo.svg, ...dimensions });
      return;
    }
    try {
      const sourceBlob = await logoBlob(logo, formatType);
      if (!sourceBlob) throw new Error("Asset unavailable");
      const blob = sourceBlob.type === "image/webp"
        ? await convertRaster(previewUrl(logo), "png")
        : sourceBlob;
      if (!blob) throw new Error("Image conversion failed");
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
      const mimeType = blob.type as "image/png" | "image/webp" | "image/jpeg";
      postToFigma({ type: "insert-image", name: logo.name, mimeType, bytes, ...dimensions });
    } catch {
      setToast(`Unable to insert ${formatType.toUpperCase()}`);
    }
  }

  async function copyLogo(logo: LogoAsset, formatType: LogoFormatType, dimensions: LogoDimensions) {
    try {
      if (formatType === "svg") {
        if (!logo.svg) throw new Error("SVG is unavailable");
        await copyTextToClipboard(svgAtDimensions(logo.svg, dimensions));
      } else {
        const blob = await logoBlob(logo, formatType);
        if (!blob || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
          throw new Error("Image clipboard is unavailable");
        }
        const clipboardBlob = blob.type === "image/png"
          ? blob
          : await convertRaster(previewUrl(logo), "png");
        if (!clipboardBlob) throw new Error("Image clipboard conversion failed");
        await navigator.clipboard.write([new ClipboardItem({ "image/png": clipboardBlob })]);
      }
      setToast(`${logo.name} ${formatType.toUpperCase()} copied`);
    } catch {
      setToast(`Unable to copy ${formatType.toUpperCase()}`);
    }
  }

  function openDetails(item: CatalogItem) {
    setSelectedFormat(item.logo?.formats[0]?.type ?? "png");
    setSelectedItem(item);
  }

  function toggleCategory(category: InstitutionCategory) {
    setDraftCategories((current) => current.includes(category)
      ? current.filter((value) => value !== category)
      : [...current, category]);
  }

  function toggleCategoryPicker() {
    if (!categoryPickerOpen) {
      setDraftCategories(selectedCategories);
      setCategoryQuery("");
    }
    setCategoryPickerOpen((current) => !current);
  }

  function applyCategoryFilter() {
    setSelectedCategories(draftCategories);
    setCategoryPickerOpen(false);
    setCategoryQuery("");
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
          <span className="brand-mark" aria-hidden="true"><img src={awalogoLogoUrl} alt="" /></span>
          <div>
            <strong>awalogo</strong>
            <small>Nigerian Bank Logos</small>
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
            placeholder={'Search logos  — try "Sycamore", "Kuda" ...'}
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

        <div className="catalog-toolbar" ref={categoryPickerRef}>
          <div className={`category-picker${categoryPickerOpen ? " open" : ""}`}>
            <button
              className="category-picker-trigger"
              type="button"
              aria-expanded={categoryPickerOpen}
              aria-controls="category-picker-panel"
              aria-haspopup="dialog"
              onClick={toggleCategoryPicker}
            >
              <span className="category-picker-icon" aria-hidden="true">
                <LayoutGrid size={18} strokeWidth={1.75} />
              </span>
              <span className="category-picker-copy">
                <strong>{categorySelectionLabel}</strong>
                <small title={categorySelectionSummary}>{categorySelectionSummary}</small>
              </span>
              <span className="category-picker-result-count">
                {filteredItems.length.toLocaleString("en-NG")}
              </span>
              <ChevronDown className="category-picker-chevron" aria-hidden="true" size={17} strokeWidth={1.75} />
            </button>

            {categoryPickerOpen ? (
              <div className="category-picker-panel" id="category-picker-panel" role="dialog" aria-label="Choose categories">
                <header className="category-picker-header">
                  <div>
                    <strong>Categories</strong>
                    <small>Select one or more</small>
                  </div>
                  <div className="category-picker-header-actions">
                    <span>{draftCategories.length === 0 ? "All" : `${draftCategories.length} selected`}</span>
                    <button
                      type="button"
                      aria-label="Close category picker"
                      onClick={() => {
                        setCategoryPickerOpen(false);
                        setCategoryQuery("");
                      }}
                    >
                      <X aria-hidden="true" size={15} strokeWidth={1.75} />
                    </button>
                  </div>
                </header>

                <label className="category-search">
                  <Search aria-hidden="true" size={15} strokeWidth={1.75} />
                  <span>Search categories</span>
                  <input
                    autoFocus
                    value={categoryQuery}
                    onChange={(event) => setCategoryQuery(event.target.value)}
                    placeholder="Find a category"
                  />
                  {categoryQuery ? (
                    <button type="button" aria-label="Clear category search" onClick={() => setCategoryQuery("")}>
                      <X aria-hidden="true" size={14} strokeWidth={1.75} />
                    </button>
                  ) : null}
                </label>

                <div className="category-options" role="group" aria-label="Available categories">
                  {categoryQuery === "" ? (
                    <button
                      className={`category-option all-categories${draftCategories.length === 0 ? " selected" : ""}`}
                      type="button"
                      aria-pressed={draftCategories.length === 0}
                      onClick={() => setDraftCategories([])}
                    >
                      <LayoutGrid aria-hidden="true" size={16} strokeWidth={1.75} />
                      <span>All categories</span>
                      <small>{availableLogoCount.toLocaleString("en-NG")}</small>
                      <span className="category-option-check" aria-hidden="true">
                        {draftCategories.length === 0 ? <Check size={14} strokeWidth={2} /> : null}
                      </span>
                    </button>
                  ) : null}

                  {visibleCategories.map((category) => {
                    const Icon = categoryIcons[category] ?? RadioTower;
                    const selected = draftCategories.includes(category);
                    const label = categoryLabel(category);
                    return (
                      <button
                        className={`category-option${selected ? " selected" : ""}`}
                        key={category}
                        type="button"
                        title={label}
                        aria-pressed={selected}
                        onClick={() => toggleCategory(category)}
                      >
                        <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
                        <span>{label}</span>
                        <small>{categoryCounts.get(category)}</small>
                        <span className="category-option-check" aria-hidden="true">
                          {selected ? <Check size={14} strokeWidth={2} /> : null}
                        </span>
                      </button>
                    );
                  })}

                  {visibleCategories.length === 0 ? (
                    <p className="category-no-results">No matching category</p>
                  ) : null}
                </div>

                <footer className="category-picker-actions">
                  <button
                    className="category-clear-button"
                    type="button"
                    disabled={draftCategories.length === 0}
                    onClick={() => setDraftCategories([])}
                  >
                    Clear
                  </button>
                  <button className="category-apply-button" type="button" onClick={applyCategoryFilter}>
                    Show {draftResultCount.toLocaleString("en-NG")} {draftResultCount === 1 ? "result" : "results"}
                  </button>
                </footer>
              </div>
            ) : null}
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
          <span className="frame-register frame-register-top-left" aria-hidden="true" />
          <span className="frame-register frame-register-top-right" aria-hidden="true" />
          <span className="frame-register frame-register-bottom-left" aria-hidden="true" />
          <span className="frame-register frame-register-bottom-right" aria-hidden="true" />
          <div className="footer-topbar">
            <div className="footer-brand">
              <img className="footer-brand-logo" src={awalogoLogoUrl} alt="" />
              <strong>awalogo</strong>
            </div>
            <nav className="footer-nav" aria-label="Project links">
              <button type="button" onClick={() => setProjectPanel("contribute")} aria-haspopup="dialog">Contribute</button>
              <button type="button" onClick={() => setProjectPanel("changelog")} aria-haspopup="dialog">Changelog</button>
              <button type="button" onClick={() => setProjectPanel("trademarks")} aria-haspopup="dialog">Trademark policy</button>
            </nav>
          </div>

          <div className="footer-bottom">
            <div className="footer-meta-links">
              <a href="https://github.com/adeyemimayokun/awalogo" target="_blank" rel="noreferrer">
                <GitFork aria-hidden="true" size={15} /> GitHub
              </a>
              <a href="https://awalogo.com" target="_blank" rel="noreferrer" title="Visit awalogo.com">
                <Globe2 aria-hidden="true" size={15} /> Website
              </a>
              <a
                href="https://github.com/adeyemimayokun/awalogo/blob/main/CONTRIBUTING.md"
                target="_blank"
                rel="noreferrer"
                title="Contribute to awalogo"
              >
                <GitPullRequest aria-hidden="true" size={15} /> Contribute
              </a>
              <span>MIT licensed tooling</span>
            </div>
            <div className="footer-copyright">
              <span>Built for convenience — check each brand&apos;s guidelines before use.</span>
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
          onCopy={copyLogo}
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
  onCopy,
  onInsert,
  onRequest
}: {
  item: CatalogItem;
  selectedFormat: LogoFormatType;
  onClose: () => void;
  onFormatChange: (format: LogoFormatType) => void;
  onCopy: (logo: LogoAsset, format: LogoFormatType, dimensions: LogoDimensions) => void;
  onInsert: (logo: LogoAsset, format: LogoFormatType, dimensions: LogoDimensions) => void;
  onRequest: () => void;
}) {
  const { logo, displayName, categories } = item;
  const [selectedVariationId, setSelectedVariationId] = useState("primary");
  const [dimensions, setDimensions] = useState<LogoDimensions>({ width: 512, height: 512 });
  const [aspectRatio, setAspectRatio] = useState(1);
  const [aspectLocked, setAspectLocked] = useState(true);
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

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled || !image.naturalWidth || !image.naturalHeight) return;
      const ratio = image.naturalWidth / image.naturalHeight;
      const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
      setAspectRatio(ratio);
      setDimensions({
        width: Math.max(1, Math.round(image.naturalWidth * scale)),
        height: Math.max(1, Math.round(image.naturalHeight * scale))
      });
    };
    image.src = previewUrl(activeLogo);
    return () => {
      cancelled = true;
    };
  }, [activeLogo.slug]);

  function updateDimension(axis: keyof LogoDimensions, nextValue: number) {
    const value = Math.min(8192, Math.max(1, Math.round(nextValue || 1)));
    setDimensions((current) => {
      if (!aspectLocked) return { ...current, [axis]: value };
      if (axis === "width") {
        const height = Math.max(1, Math.round(value / aspectRatio));
        return height <= 8192
          ? { width: value, height }
          : { width: Math.max(1, Math.round(8192 * aspectRatio)), height: 8192 };
      }
      const width = Math.max(1, Math.round(value * aspectRatio));
      return width <= 8192
        ? { width, height: value }
        : { width: 8192, height: Math.max(1, Math.round(8192 / aspectRatio)) };
    });
  }

  function toggleAspectLock() {
    setAspectLocked((current) => {
      const next = !current;
      if (next) {
        setDimensions((size) => ({
          width: size.width,
          height: Math.min(8192, Math.max(1, Math.round(size.width / aspectRatio)))
        }));
      }
      return next;
    });
  }

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

        <div className="dimension-control">
          <span className="dimension-title">Insert size</span>
          <label className="dimension-field">
            <span>W</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="8192"
              value={dimensions.width}
              onChange={(event) => updateDimension("width", event.currentTarget.valueAsNumber)}
              aria-label="Logo width in pixels"
            />
            <small>px</small>
          </label>
          <button
            className="aspect-lock"
            type="button"
            onClick={toggleAspectLock}
            aria-label={aspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
            aria-pressed={aspectLocked}
            title={aspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
          >
            {aspectLocked
              ? <Lock aria-hidden="true" size={14} strokeWidth={1.8} />
              : <LockOpen aria-hidden="true" size={14} strokeWidth={1.8} />}
          </button>
          <label className="dimension-field">
            <span>H</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="8192"
              value={dimensions.height}
              onChange={(event) => updateDimension("height", event.currentTarget.valueAsNumber)}
              aria-label="Logo height in pixels"
            />
            <small>px</small>
          </label>
        </div>

        <div className="detail-actions plugin-actions">
          <button className="copy-button" type="button" onClick={() => onCopy(activeLogo, selectedFormat, dimensions)}>
            <Copy aria-hidden="true" size={15} strokeWidth={1.8} /> Copy {selectedFormat.toUpperCase()}
          </button>
          <button className="insert-button" type="button" onClick={() => onInsert(activeLogo, selectedFormat, dimensions)}>
            Insert {activeVariation.id === "primary" ? displayName : activeVariation.label}
          </button>
        </div>
      </aside>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

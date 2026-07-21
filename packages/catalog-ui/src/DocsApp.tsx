import { useLayoutEffect, useState } from "react";
import {
  BookOpen,
  Check,
  Copy,
  FileCode2,
  GitPullRequest,
  Landmark,
  PackageOpen,
  Puzzle,
  ShieldCheck
} from "lucide-react";
import { ProjectInfoSheet, type ProjectPanel } from "./CatalogApp";
import { FIGMA_PLUGIN_URL, SiteFooter, SiteHeader, type ThemeMode } from "./SiteChrome";
import "./styles.css";

const THEME_STORAGE_KEY = "awalogo-theme";
const GITHUB_URL = "https://github.com/adeyemimayokun/awalogo";

const sections = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "website", label: "Using the website", icon: Landmark },
  { id: "developer", label: "Developer setup", icon: PackageOpen },
  { id: "figma", label: "Figma plugin", icon: Puzzle },
  { id: "contributing", label: "Contributing", icon: GitPullRequest },
  { id: "verification", label: "Verification and use", icon: ShieldCheck }
] as const;

function getInitialTheme(): ThemeMode {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") return storedTheme;
  } catch {
    // Keep the system theme when browser storage is unavailable.
  }
  return "system";
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="docs-code-block">
      <div className="docs-code-header">
        <span>{label}</span>
        <button type="button" onClick={copyCode} aria-label={`Copy ${label}`} title={`Copy ${label}`}>
          {copied ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

export function DocsApp({ aboutMarkdown = "" }: { aboutMarkdown?: string }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);
  const [projectPanel, setProjectPanel] = useState<ProjectPanel | null>(null);

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
      // Keep the selected theme for this session when persistence is unavailable.
    }

    document.title = "Docs | awalogo";
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = "Documentation for using and contributing to awalogo, the Nigerian financial logo library.";

    return () => systemTheme.removeEventListener("change", applyTheme);
  }, [themeMode]);

  return (
    <main className="plugin-shell docs-shell">
      <SiteHeader
        currentPage="docs"
        pluginMode={false}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        onCatalog={() => { window.location.href = "/"; }}
        onAbout={() => setProjectPanel("about")}
        onChangelog={() => setProjectPanel("changelog")}
      />

      <header className="docs-hero">
        <span className="frame-register frame-register-top-left" aria-hidden="true" />
        <span className="frame-register frame-register-top-right" aria-hidden="true" />
        <span className="frame-register frame-register-bottom-left" aria-hidden="true" />
        <span className="frame-register frame-register-bottom-right" aria-hidden="true" />
        <p className="eyebrow"><FileCode2 aria-hidden="true" size={13} strokeWidth={1.75} /> Documentation</p>
        <h1>Build with awalogo.</h1>
        <p>Use verified Nigerian financial logos on the web, in product interfaces, and inside Figma. Learn how the catalog is structured and how to contribute safely.</p>
        <nav className="docs-jump-links" aria-label="Documentation sections">
          {sections.slice(1, 4).map(({ id, label }) => <a key={id} href={`#${id}`}>{label}</a>)}
        </nav>
      </header>

      <div className="docs-layout">
        <aside className="docs-sidebar">
          <div>
            <span className="docs-sidebar-label">On this page</span>
            <nav aria-label="Documentation table of contents">
              {sections.map(({ id, label, icon: Icon }) => (
                <a key={id} href={`#${id}`}>
                  <Icon aria-hidden="true" size={15} strokeWidth={1.65} />
                  <span>{label}</span>
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <article className="docs-content">
          <section id="overview" className="docs-section">
            <h2>Overview</h2>
            <p>awalogo is an open source catalog of Nigerian banks, fintechs, payment providers, insurers, investment firms, regulators, and related financial institutions.</p>
            <p>Each accepted record connects recognizable brand metadata to reviewed SVG or raster assets. The website is the public browsing and download surface. The Figma plugin and repository packages use the same underlying catalog.</p>
            <div className="docs-note">
              <strong>Distribution status</strong>
              <p>The website and Figma Community plugin are available now. The public npm release is still pending, while <code>@awalogo/core</code> can be built from this repository today.</p>
            </div>
          </section>

          <section id="website" className="docs-section">
            <h2>Using the website</h2>
            <ol className="docs-steps">
              <li><strong>Search</strong><span>Find an institution by its public name, legal name, abbreviation, or known alias.</span></li>
              <li><strong>Filter</strong><span>Select one or more financial categories, then choose alphabetical order when needed.</span></li>
              <li><strong>Inspect</strong><span>Open a logo to review its source status, available variations, formats, and official website.</span></li>
              <li><strong>Use</strong><span>Download SVG, PNG, or WebP. SVG can also be copied directly when a verified vector source is available.</span></li>
            </ol>
            <div className="docs-format-grid" aria-label="Available logo formats">
              <div><strong>SVG</strong><p>Best for editable vectors, interfaces, and design systems.</p></div>
              <div><strong>PNG</strong><p>Best for documents and tools that need broad raster support.</p></div>
              <div><strong>WebP</strong><p>Best for compact web delivery when vector artwork is unnecessary.</p></div>
            </div>
          </section>

          <section id="developer" className="docs-section">
            <h2>Developer setup</h2>
            <p>Clone the monorepo to use the current typed catalog, run the website, or work on asset tooling.</p>
            <CodeBlock
              label="Terminal"
              code={`git clone ${GITHUB_URL}.git\ncd awalogo\npnpm install\npnpm dev:web`}
            />
            <h3>Read catalog metadata</h3>
            <p>The core package exports the validated catalog, typed helpers, schemas, format types, and institution links.</p>
            <CodeBlock
              label="TypeScript"
              code={`import { findLogoBySlug, getLogosByCategory } from "@awalogo/core";\n\nconst access = findLogoBySlug("access-bank");\nconst commercialBanks = getLogosByCategory("commercial-bank");\n\nconsole.log(access?.formats);\nconsole.log(commercialBanks.length);`}
            />
            <h3>Catalog record</h3>
            <CodeBlock
              label="TypeScript"
              code={`type LogoEntry = {\n  name: string;\n  slug: string;\n  category: LogoCategory;\n  aliases: string[];\n  website: string;\n  source_url: string;\n  source_type: SourceType;\n  formats: LogoFormat[];\n  variations?: LogoVariation[];\n  status: "verified" | "needs-review" | "deprecated";\n};`}
            />
          </section>

          <section id="figma" className="docs-section">
            <h2>Figma plugin</h2>
            <p>The offline plugin bundles approved metadata and assets locally. It does not require runtime network access, and SVG insertion creates editable vector layers.</p>
            <CodeBlock label="Build the plugin" code={`pnpm build:plugin`} />
            <ol className="docs-steps docs-steps-compact">
              <li><strong>Open Figma desktop</strong><span>Go to Plugins, Development, then Import plugin from manifest.</span></li>
              <li><strong>Select the manifest</strong><span>Choose <code>apps/figma-plugin/manifest.json</code> from the cloned repository.</span></li>
              <li><strong>Run awalogo</strong><span>Open it from Plugins, Development. Rebuild and relaunch after packaged changes.</span></li>
            </ol>
            <div className="docs-note">
              <strong>Community installation</strong>
              <p>Install awalogo from <a href={FIGMA_PLUGIN_URL} target="_blank" rel="noreferrer">Figma Community</a> to search and insert the catalog without leaving your design file.</p>
            </div>
          </section>

          <section id="contributing" className="docs-section">
            <h2>Contributing</h2>
            <p>Contributions should improve accuracy, provenance, coverage, or tooling. New logos require an official source and should never be recreated by tracing a raster image.</p>
            <h3>Add or update a logo</h3>
            <ol className="docs-steps docs-steps-compact">
              <li><strong>Add the source</strong><span>Place official artwork under <code>packages/logos/src</code> and keep the filename aligned with its slug.</span></li>
              <li><strong>Update metadata</strong><span>Record formats, aliases, website, source URL, source type, status, and dates.</span></li>
              <li><strong>Generate formats</strong><span>Run the format pipeline, then inspect each generated derivative.</span></li>
              <li><strong>Validate</strong><span>Run the repository checks before opening a pull request.</span></li>
            </ol>
            <CodeBlock
              label="Validation"
              code={`pnpm logos:formats\npnpm validate\npnpm logos:check-formats\npnpm typecheck\npnpm test`}
            />
            <a className="docs-primary-link" href={`${GITHUB_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer">
              <GitPullRequest aria-hidden="true" size={16} /> Read CONTRIBUTING.md
            </a>
          </section>

          <section id="verification" className="docs-section">
            <h2>Verification and acceptable use</h2>
            <div className="docs-definition-list">
              <div><dt>Verified</dt><dd>Artwork has a current institution-owned source such as an official website, media kit, annual report, or regulatory PDF.</dd></div>
              <div><dt>Needs review</dt><dd>Artwork may be useful for research but is not presented as officially verified until provenance is confirmed.</dd></div>
              <div><dt>Raster only</dt><dd>Official PNG, WebP, or JPEG artwork may be accepted when no official vector is published. It is never traced to manufacture an SVG.</dd></div>
            </div>
            <h3>Trademark notice</h3>
            <p>Code, metadata, and tooling are available under the MIT License. Logo artwork and company names remain trademarks of their respective owners and are not relicensed by awalogo.</p>
            <p>Downloading an asset does not grant permission to imply affiliation, partnership, or endorsement. Check each institution's current brand guidelines before use.</p>
          </section>
        </article>
      </div>

      <SiteFooter
        pluginMode={false}
        onAbout={() => setProjectPanel("about")}
        onChangelog={() => setProjectPanel("changelog")}
        onTrademark={() => setProjectPanel("trademarks")}
        onRequest={() => setProjectPanel("request")}
        onContribute={() => setProjectPanel("contribute")}
      />

      {projectPanel ? (
        <ProjectInfoSheet
          panel={projectPanel}
          aboutMarkdown={aboutMarkdown}
          initialRequestName=""
          onClose={() => setProjectPanel(null)}
          onRequestSubmitted={() => setProjectPanel(null)}
        />
      ) : null}
    </main>
  );
}

import {
  ArrowUp,
  GitFork,
  GitPullRequest,
  Globe2,
  Heart,
  MessageSquarePlus,
  Monitor,
  Moon,
  Puzzle,
  Sun
} from "lucide-react";
import awalogoLogoUrl from "./assets/awalogo-logo.svg";

export const FIGMA_PLUGIN_URL = "https://www.figma.com/community/plugin/1661356348996631383";

export type ThemeMode = "system" | "light" | "dark";
export type SitePage = "catalog" | "docs" | "not-found";

type SiteHeaderProps = {
  currentPage: SitePage;
  pluginMode: boolean;
  themeMode: ThemeMode;
  onThemeModeChange: (theme: ThemeMode) => void;
  onCatalog: () => void;
  onAbout: () => void;
  onChangelog: () => void;
};

type SiteFooterProps = {
  pluginMode: boolean;
  onAbout: () => void;
  onChangelog: () => void;
  onTrademark: () => void;
  onRequest: () => void;
  onContribute: () => void;
};

export function SiteHeader({
  currentPage,
  pluginMode,
  themeMode,
  onThemeModeChange,
  onCatalog,
  onAbout,
  onChangelog
}: SiteHeaderProps) {
  return (
    <header className="topbar">
      {pluginMode ? (
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><img src={awalogoLogoUrl} alt="" /></span>
          <strong>awalogo</strong>
        </div>
      ) : (
        <a className="brand site-brand-link" href="/" aria-label="awalogo catalog">
          <span className="brand-mark" aria-hidden="true"><img src={awalogoLogoUrl} alt="" /></span>
          <strong>awalogo</strong>
        </a>
      )}

      {!pluginMode ? (
        <nav className="topbar-nav" aria-label="Primary navigation">
          <button type="button" onClick={onCatalog} aria-current={currentPage === "catalog" ? "page" : undefined}>Home</button>
          <a href="/docs" aria-current={currentPage === "docs" ? "page" : undefined}>Docs</a>
          <button type="button" onClick={onAbout} aria-haspopup="dialog">About</button>
          <button type="button" onClick={onChangelog} aria-haspopup="dialog">Changelog</button>
        </nav>
      ) : null}

      <div className="topbar-actions">
        {!pluginMode ? (
          <>
            <a
              className="topbar-icon-link"
              href="https://github.com/adeyemimayokun/awalogo"
              target="_blank"
              rel="noreferrer"
              aria-label="Open the awalogo GitHub repository"
              title="GitHub repository"
            >
              <GitFork aria-hidden="true" size={15} strokeWidth={1.75} />
            </a>
            <a className="topbar-figma" href={FIGMA_PLUGIN_URL} target="_blank" rel="noreferrer" title="Open awalogo in Figma Community">
              <Puzzle aria-hidden="true" size={15} strokeWidth={1.75} />
              <span>Figma plugin</span>
            </a>
          </>
        ) : null}
        <div className="theme-toggle" role="group" aria-label="Color theme">
          <button type="button" aria-label="Use system theme" aria-pressed={themeMode === "system"} title="System theme" onClick={() => onThemeModeChange("system")}>
            <Monitor aria-hidden="true" size={14} strokeWidth={1.75} />
          </button>
          <button type="button" aria-label="Use light theme" aria-pressed={themeMode === "light"} title="Light theme" onClick={() => onThemeModeChange("light")}>
            <Sun aria-hidden="true" size={14} strokeWidth={1.75} />
          </button>
          <button type="button" aria-label="Use dark theme" aria-pressed={themeMode === "dark"} title="Dark theme" onClick={() => onThemeModeChange("dark")}>
            <Moon aria-hidden="true" size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({
  pluginMode,
  onAbout,
  onChangelog,
  onTrademark,
  onRequest,
  onContribute
}: SiteFooterProps) {
  return (
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
            <a href="/docs">Docs</a>
            <button type="button" onClick={onAbout} aria-haspopup="dialog">About</button>
            <a href="https://github.com/adeyemimayokun/awalogo" target="_blank" rel="noreferrer">Contribute</a>
            <button type="button" onClick={onChangelog} aria-haspopup="dialog">Changelog</button>
            <button type="button" onClick={onTrademark} aria-haspopup="dialog">Trademark policy</button>
          </nav>
          <div className="footer-cta">
            <a href={FIGMA_PLUGIN_URL} target="_blank" rel="noreferrer" title="Open awalogo in Figma Community">
              <Puzzle aria-hidden="true" size={15} /> Figma Plugin
            </a>
            <button type="button" onClick={onRequest} aria-haspopup="dialog" title="Request an unavailable logo">
              <MessageSquarePlus aria-hidden="true" size={15} /> Request a logo
            </button>
            <button className="footer-cta-primary" type="button" onClick={onContribute} aria-haspopup="dialog">
              Submit a logo
            </button>
          </div>
        </div>

        <div className="footer-body">
          <section className="footer-intro" aria-labelledby="footer-intro-title">
            <span className="footer-kicker">Open source · Nigeria</span>
            <h2 id="footer-intro-title">Logo infrastructure for Nigeria's financial ecosystem.</h2>
            <p>A community-maintained collection of verified assets for product designers, developers, and design systems.</p>
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
            <a href="https://github.com/adeyemimayokun/awalogo" target="_blank" rel="noreferrer">
              <GitFork aria-hidden="true" size={15} /> GitHub
            </a>
            {pluginMode ? (
              <>
                <a href="https://awalogo.com" target="_blank" rel="noreferrer" title="Visit awalogo.com">
                  <Globe2 aria-hidden="true" size={15} /> Website
                </a>
                <a href="https://github.com/adeyemimayokun/awalogo/blob/main/CONTRIBUTING.md" target="_blank" rel="noreferrer" title="Contribute to awalogo">
                  <GitPullRequest aria-hidden="true" size={15} /> Contribute
                </a>
              </>
            ) : null}
            <span>MIT licensed tooling</span>
          </div>
          <div className="footer-copyright">
            {pluginMode ? (
              <span className="plugin-made-in-lagos">Made with <Heart aria-hidden="true" size={12} strokeWidth={1.8} /> in Lagos</span>
            ) : (
              <span>Built for convenience — check each brand&apos;s guidelines before use.</span>
            )}
            <button type="button" aria-label="Back to top" title="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <ArrowUp aria-hidden="true" size={15} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

import { useLayoutEffect, useState } from "react";
import { ArrowRight, Grid2X2, SearchX } from "lucide-react";
import { ProjectInfoSheet, type ProjectPanel } from "./CatalogApp";
import { SiteHeader, type ThemeMode } from "./SiteChrome";
import "./styles.css";

const THEME_STORAGE_KEY = "awalogo-theme";

function getInitialTheme(): ThemeMode {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") return storedTheme;
  } catch {
    // Keep the system theme when browser storage is unavailable.
  }
  return "system";
}

export function NotFoundApp({ aboutMarkdown = "" }: { aboutMarkdown?: string }) {
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

    document.title = "Page not found | awalogo";
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = "The requested awalogo page could not be found.";

    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const createdRobotsMeta = !robots;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = "noindex, nofollow";

    return () => {
      systemTheme.removeEventListener("change", applyTheme);
      if (createdRobotsMeta) robots?.remove();
    };
  }, [themeMode]);

  return (
    <main className="plugin-shell not-found-shell">
      <SiteHeader
        currentPage="not-found"
        pluginMode={false}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        onCatalog={() => { window.location.href = "/"; }}
        onAbout={() => setProjectPanel("about")}
        onChangelog={() => setProjectPanel("changelog")}
      />

      <section className="not-found-stage" aria-labelledby="not-found-title">
        <span className="frame-register frame-register-top-left" aria-hidden="true" />
        <span className="frame-register frame-register-top-right" aria-hidden="true" />
        <span className="frame-register frame-register-bottom-left" aria-hidden="true" />
        <span className="frame-register frame-register-bottom-right" aria-hidden="true" />

        <div className="not-found-copy">
          <p className="eyebrow"><SearchX aria-hidden="true" size={13} strokeWidth={1.75} /> Page not found</p>
          <h1 id="not-found-title">This page isn&apos;t in the catalog.</h1>
          <p>The address may have changed, or the page may no longer exist. Return home to browse verified Nigerian financial logos.</p>
          <div className="not-found-actions">
            <a className="not-found-primary" href="/">
              <Grid2X2 aria-hidden="true" size={16} strokeWidth={1.75} /> Browse logos
            </a>
            <a href="/docs">
              Read the docs <ArrowRight aria-hidden="true" size={15} strokeWidth={1.75} />
            </a>
          </div>
        </div>

        <div className="not-found-code" aria-hidden="true">
          <span>4</span>
          <span className="not-found-zero">0<i /></span>
          <span>4</span>
          <small>asset unavailable</small>
        </div>
      </section>

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

import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { CatalogApp, DocsApp, NotFoundApp } from "@awalogo/catalog-ui";
import aboutMarkdown from "../../../docs/content/about.md?raw";

const AdminApp = lazy(() => import("@awalogo/catalog-ui/admin").then((module) => ({
  default: module.AdminApp
})));

const isAdminRoute = window.location.pathname.startsWith("/admin");
const isDocsRoute = window.location.pathname === "/docs" || window.location.pathname.startsWith("/docs/");
const isCatalogRoute = window.location.pathname === "/";
if (isAdminRoute) document.documentElement.dataset.admin = "true";

createRoot(document.getElementById("root")!).render(
  <>
    {isAdminRoute ? (
      <Suspense fallback={<main style={{ display: "grid", minHeight: "100vh", placeItems: "center", fontSize: 12 }}>Loading admin</main>}>
        <AdminApp />
      </Suspense>
    ) : isDocsRoute ? (
      <DocsApp aboutMarkdown={aboutMarkdown} />
    ) : isCatalogRoute ? (
      <CatalogApp aboutMarkdown={aboutMarkdown} />
    ) : (
      <NotFoundApp aboutMarkdown={aboutMarkdown} />
    )}
    <Analytics />
  </>
);

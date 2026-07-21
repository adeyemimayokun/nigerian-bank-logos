import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { pluginLogoAssets } from "./vite.logo-assets";

const root = dirname(fileURLToPath(import.meta.url));

function inlineFigmaUi(): Plugin {
  return {
    name: "inline-figma-ui",
    enforce: "post",
    generateBundle(_options, bundle) {
      const htmlAsset = bundle["index.html"];
      if (!htmlAsset || htmlAsset.type !== "asset") throw new Error("Figma UI build did not emit index.html");

      let html = String(htmlAsset.source);
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type === "chunk" && output.isEntry) {
          const scriptPattern = new RegExp(`<script[^>]+src=["']\\/?${fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*><\\/script>`);
          const code = output.code.replace(/<\/script/gi, "<\\/script");
          html = html.replace(scriptPattern, () => `<script type="module">${code}</script>`);
          delete bundle[fileName];
        }
        if (output.type === "asset" && fileName.endsWith(".css")) {
          const stylePattern = new RegExp(`<link[^>]+href=["']\\/?${fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`);
          html = html.replace(stylePattern, () => `<style>${String(output.source)}</style>`);
          delete bundle[fileName];
        }
      }
      htmlAsset.source = html;
    }
  };
}

export default defineConfig({
  root,
  plugins: [react(), pluginLogoAssets(), inlineFigmaUi()],
  define: {
    __NBL_SURFACE__: JSON.stringify("plugin")
  },
  resolve: {
    alias: [
      { find: "@awalogo/core", replacement: resolve(root, "../../packages/logos/src/index.ts") },
      { find: "@awalogo/institutions", replacement: resolve(root, "../../packages/institutions/src/index.ts") },
      { find: "@logo-assets", replacement: resolve(root, "../../packages/logos/src/assets") }
    ]
  },
  build: {
    outDir: "figma-dist",
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: {
      output: { inlineDynamicImports: true }
    }
  }
});

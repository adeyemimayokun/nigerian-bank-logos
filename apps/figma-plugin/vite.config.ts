import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { pluginLogoAssets } from "./vite.logo-assets";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react(), pluginLogoAssets()],
  resolve: {
    alias: [
      { find: "@awalogo/core", replacement: resolve(root, "../../packages/logos/src/index.ts") },
      { find: "@awalogo/institutions", replacement: resolve(root, "../../packages/institutions/src/index.ts") },
      { find: "@logo-assets", replacement: resolve(root, "../../packages/logos/src/assets") }
    ]
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});

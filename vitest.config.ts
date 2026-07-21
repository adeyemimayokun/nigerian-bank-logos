import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { pluginLogoAssets } from "./apps/figma-plugin/vite.logo-assets";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [pluginLogoAssets()],
  resolve: {
    alias: {
      "@awalogo/core": resolve(root, "packages/logos/src/index.ts"),
      "@awalogo/institutions": resolve(root, "packages/institutions/src/index.ts")
    }
  }
});

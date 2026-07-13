import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  resolve: {
    alias: {
      "@nigerian-bank-logos/core": resolve(root, "../../packages/logos/src/index.ts"),
      "@nigerian-bank-logos/institutions": resolve(root, "../../packages/institutions/src/index.ts"),
      "@logo-assets": resolve(root, "../../packages/logos/src/assets")
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});

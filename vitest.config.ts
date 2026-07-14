import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@nigerian-bank-logos/core": resolve(root, "packages/logos/src/index.ts"),
      "@nigerian-bank-logos/institutions": resolve(root, "packages/institutions/src/index.ts")
    }
  }
});

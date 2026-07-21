import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  build: {
    outDir: "figma-dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(root, "src/main.ts"),
      formats: ["iife"],
      name: "AwalogoPlugin",
      fileName: () => "main.js"
    }
  }
});

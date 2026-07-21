import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifestPath = resolve(import.meta.dirname, "../manifest.json");

try {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const requiredFields = ["name", "api", "main", "ui", "editorType", "documentAccess"];
  const missing = requiredFields.filter((field) => !manifest[field]);
  if (missing.length) throw new Error(`Missing required fields: ${missing.join(", ")}`);
  if (manifest.documentAccess !== "dynamic-page") throw new Error('documentAccess must be "dynamic-page"');
  if (!Array.isArray(manifest.editorType) || !manifest.editorType.includes("figma")) {
    throw new Error('editorType must include "figma"');
  }
  console.log("Figma manifest is valid.");
} catch (error) {
  console.error(`Invalid Figma manifest: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}

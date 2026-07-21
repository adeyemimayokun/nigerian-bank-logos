import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirectory = resolve(import.meta.dirname, "../figma-dist");
const outputPath = resolve(outputDirectory, "index.html");
const controllerPath = resolve(outputDirectory, "main.js");
const html = await readFile(outputPath, "utf8");
const maxPluginSize = 15_000_000;

async function directorySize(directory) {
  let size = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    size += entry.isDirectory() ? await directorySize(path) : (await stat(path)).size;
  }
  return size;
}

await stat(controllerPath);
const totalSize = await directorySize(outputDirectory);

if (!html.includes('<div id="root"></div>')) throw new Error("Plugin UI root is missing");
if (!html.includes("<script type=\"module\">")) throw new Error("Plugin JavaScript was not inlined");
if (!html.includes("<style>")) throw new Error("Plugin CSS was not inlined");
if (/<script[^>]+src=|<link[^>]+rel=["']stylesheet/i.test(html)) {
  throw new Error("Plugin UI still contains external script or stylesheet references");
}
if (totalSize > maxPluginSize) {
  throw new Error(`Plugin code is ${(totalSize / 1_000_000).toFixed(1)} MB; Figma allows at most 15 MB`);
}

console.log(`Self-contained Figma plugin is valid (${(totalSize / 1_000_000).toFixed(1)} MB of 15 MB).`);

import {
  logoCatalog,
  type LogoEntry,
  type LogoFormatType
} from "@nigerian-bank-logos/core";

const svgModules = import.meta.glob("../../../packages/logos/src/assets/*.svg", {
  eager: true,
  query: "?raw",
  import: "default"
}) as Record<string, string>;
const rasterModules = import.meta.glob("../../../packages/logos/src/assets/*.{png,webp,jpg}", {
  eager: true,
  query: "?url",
  import: "default"
}) as Record<string, string>;

function assetByPath(modules: Record<string, string>, path: string) {
  const fileName = path.split("/").pop();
  return Object.entries(modules).find(([modulePath]) => modulePath.endsWith(`/${fileName}`))?.[1];
}

export type LogoWithSvg = LogoEntry & {
  svg: string;
  asset_urls: Partial<Record<LogoFormatType, string>>;
};

export const logos: LogoWithSvg[] = logoCatalog.map((logo) => ({
  ...logo,
  svg: logo.svg_path ? assetByPath(svgModules, logo.svg_path) ?? "" : "",
  asset_urls: Object.fromEntries(logo.formats
    .filter((format) => format.type !== "svg")
    .map((format) => [format.type, assetByPath(rasterModules, format.path)]))
}));

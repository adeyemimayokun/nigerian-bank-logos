import {
  logoCatalog,
  type LogoEntry,
  type LogoFormat,
  type LogoFormatType
} from "@awalogo/core";

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

export type LogoAsset = {
  name: string;
  slug: string;
  formats: LogoFormat[];
  svg: string;
  asset_urls: Partial<Record<LogoFormatType, string>>;
};

export type LogoVariationWithSvg = NonNullable<LogoEntry["variations"]>[number] & {
  svg: string;
  asset_urls: Partial<Record<LogoFormatType, string>>;
};

export type LogoWithSvg = Omit<LogoEntry, "variations"> & LogoAsset & {
  variations: LogoVariationWithSvg[];
};

function assetUrls(formats: LogoFormat[]) {
  return Object.fromEntries(formats
    .filter((format) => format.type !== "svg")
    .map((format) => [format.type, assetByPath(rasterModules, format.path)]));
}

export const logos: LogoWithSvg[] = logoCatalog.map((logo) => ({
  ...logo,
  svg: logo.svg_path ? assetByPath(svgModules, logo.svg_path) ?? "" : "",
  asset_urls: assetUrls(logo.formats),
  variations: (logo.variations ?? []).map((variation) => ({
    ...variation,
    svg: variation.svg_path ? assetByPath(svgModules, variation.svg_path) ?? "" : "",
    asset_urls: assetUrls(variation.formats)
  }))
}));

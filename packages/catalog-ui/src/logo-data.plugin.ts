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
const webpModules = import.meta.glob("../../../packages/logos/src/assets/*.webp", {
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

function previewAsset(formats: LogoFormat[]) {
  const webp = formats.find((format) => format.type === "webp");
  return webp ? { webp: assetByPath(webpModules, webp.path) } : {};
}

export const logos: LogoWithSvg[] = logoCatalog.map((logo) => ({
  ...logo,
  svg: logo.svg_path ? assetByPath(svgModules, logo.svg_path) ?? "" : "",
  asset_urls: previewAsset(logo.formats),
  variations: (logo.variations ?? []).map((variation) => ({
    ...variation,
    svg: variation.svg_path ? assetByPath(svgModules, variation.svg_path) ?? "" : "",
    asset_urls: previewAsset(variation.formats)
  }))
}));

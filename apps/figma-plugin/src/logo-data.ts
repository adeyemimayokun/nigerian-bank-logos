import {
  logoCatalog,
  type LogoEntry,
  type LogoFormat,
  type LogoFormatType
} from "@awalogo/core";
import { pluginAssetPayloads, pluginEntryAssets } from "virtual:awalogo-plugin-assets";

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

function assetFor(key: string) {
  const assetId = pluginEntryAssets[key];
  return assetId ? pluginAssetPayloads[assetId] : undefined;
}

function hydrateAsset(key: string) {
  const asset = assetFor(key);
  return {
    svg: asset?.svg ?? "",
    asset_urls: asset?.raster_url ? { png: asset.raster_url } : {}
  } satisfies Pick<LogoAsset, "svg" | "asset_urls">;
}

export const logos: LogoWithSvg[] = logoCatalog.map((logo) => ({
  ...logo,
  ...hydrateAsset(`logo:${logo.slug}`),
  variations: (logo.variations ?? []).map((variation) => ({
    ...variation,
    ...hydrateAsset(`variation:${logo.slug}:${variation.id}`)
  }))
}));

declare module "virtual:awalogo-plugin-assets" {
  export type PluginAssetPayload = {
    svg: string;
    raster_url: string;
  };

  export const pluginAssetPayloads: Record<string, PluginAssetPayload>;
  export const pluginEntryAssets: Record<string, string>;
}

import promotedCatalog from "./promoted-catalog.json";
import variationCatalog from "./variations.json";
import { logoCatalogSchema, type LogoEntry } from "./schema";

const seedCatalog = [
  {
    name: "Moniepoint",
    slug: "moniepoint",
    category: "microfinance-bank",
    aliases: ["Moniepoint MFB", "TeamApt"],
    website: "https://moniepoint.com/",
    source_url: "https://moniepoint.com/icon.svg",
    source_type: "official-website",
    source_path: "assets/moniepoint.svg",
    svg_path: "assets/moniepoint.svg",
    formats: [
      { type: "svg", path: "assets/moniepoint.svg", mime_type: "image/svg+xml", width: null, height: null },
      { type: "png", path: "assets/moniepoint.png", mime_type: "image/png", width: null, height: null },
      { type: "webp", path: "assets/moniepoint.webp", mime_type: "image/webp", width: null, height: null }
    ],
    added_at: "2026-06-23",
    updated_at: "2026-06-23",
    status: "verified"
  },
  {
    name: "OPay",
    slug: "opay",
    category: "fintech",
    aliases: ["OPay Nigeria", "Opera Pay"],
    website: "https://www.opayweb.com/",
    source_url: "https://gstatic.opayweb.com/website-ng/img/opay-logo.684aa98.svg",
    source_type: "official-website",
    source_path: "assets/opay.svg",
    svg_path: "assets/opay.svg",
    formats: [
      { type: "svg", path: "assets/opay.svg", mime_type: "image/svg+xml", width: null, height: null },
      { type: "png", path: "assets/opay.png", mime_type: "image/png", width: null, height: null },
      { type: "webp", path: "assets/opay.webp", mime_type: "image/webp", width: null, height: null }
    ],
    added_at: "2026-06-23",
    updated_at: "2026-06-23",
    status: "verified"
  },
  {
    name: "Flutterwave",
    slug: "flutterwave",
    category: "fintech",
    aliases: ["Flutterwave Nigeria", "Flutterwave Payments"],
    website: "https://flutterwave.com/ng/",
    source_url: "https://flutterwave.com/images/logo/full.svg",
    source_type: "official-website",
    source_path: "assets/flutterwave.svg",
    svg_path: "assets/flutterwave.svg",
    formats: [
      { type: "svg", path: "assets/flutterwave.svg", mime_type: "image/svg+xml", width: null, height: null },
      { type: "png", path: "assets/flutterwave.png", mime_type: "image/png", width: null, height: null },
      { type: "webp", path: "assets/flutterwave.webp", mime_type: "image/webp", width: null, height: null }
    ],
    added_at: "2026-06-23",
    updated_at: "2026-06-23",
    status: "verified"
  }
] satisfies LogoEntry[];

const entries = [...seedCatalog, ...promotedCatalog].map((entry) => ({
  ...entry,
  variations: variationCatalog[entry.slug as keyof typeof variationCatalog] ?? []
}));

export const logoCatalog = logoCatalogSchema.parse(entries);

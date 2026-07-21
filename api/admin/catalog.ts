import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdmin } from "../_lib/auth.js";
import { catalogPaths } from "../_lib/catalog.js";
import { readRepositoryJson } from "../_lib/github.js";
import { jsonError, methodNotAllowed } from "../_lib/http.js";

const coreEntries = [
  { name: "Moniepoint", slug: "moniepoint", category: "microfinance-bank", website: "https://moniepoint.com/", source_url: "https://moniepoint.com/icon.svg", svg_path: "assets/moniepoint.svg", formats: [{ type: "svg", path: "assets/moniepoint.svg" }], status: "verified" },
  { name: "OPay", slug: "opay", category: "fintech", website: "https://www.opayweb.com/", source_url: "https://gstatic.opayweb.com/website-ng/img/opay-logo.684aa98.svg", svg_path: "assets/opay.svg", formats: [{ type: "svg", path: "assets/opay.svg" }], status: "verified" },
  { name: "Flutterwave", slug: "flutterwave", category: "fintech", website: "https://flutterwave.com/ng/", source_url: "https://flutterwave.com/images/logo/full.svg", svg_path: "assets/flutterwave.svg", formats: [{ type: "svg", path: "assets/flutterwave.svg" }], status: "verified" }
];

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);
  if (!requireAdmin(request, response)) return;
  response.setHeader("Cache-Control", "no-store");
  try {
    const [catalog, variations] = await Promise.all([
      readRepositoryJson(catalogPaths.catalog),
      readRepositoryJson(catalogPaths.variations)
    ]);
    response.status(200).json({ catalog: [...coreEntries, ...(catalog as object[])], variations, lockedSlugs: coreEntries.map((entry) => entry.slug) });
  } catch (error) {
    jsonError(response, error);
  }
}

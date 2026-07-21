import { describe, expect, it } from "vitest";
import { buildMutationChanges } from "./catalog.js";

const safeSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#111" d="M2 2h20v20H2z"/></svg>').toString("base64");
const manifest = {
  version: 1,
  render_settings: {},
  source_sha256: {} as Record<string, string>
};

describe("CMS catalog mutations", () => {
  it("creates normalized source and derivative changes for a new logo", async () => {
    const result = await buildMutationChanges({
      operation: "add-logo",
      name: "Example Finance",
      slug: "example-finance",
      category: "fintech",
      aliases: ["Example"],
      website: "https://example.com",
      sourceUrl: "https://example.com/brand",
      sourceType: "official-brand-page",
      svgBase64: safeSvg
    }, [], {}, structuredClone(manifest));

    const paths = result.changes.map((change) => change.path);
    expect(paths).toContain("packages/logos/src/assets/example-finance.svg");
    expect(paths).toContain("packages/logos/src/assets/example-finance.png");
    expect(paths).toContain("packages/logos/src/assets/example-finance.webp");
    const catalog = JSON.parse(result.changes.find((change) => change.path.endsWith("promoted-catalog.json"))!.content!.toString());
    expect(catalog[0]).toMatchObject({ slug: "example-finance", status: "needs-review" });
  });

  it("rejects SVG files with executable content", async () => {
    const unsafe = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><script>alert(1)</script></svg>').toString("base64");
    await expect(buildMutationChanges({
      operation: "add-logo",
      name: "Unsafe Finance",
      slug: "unsafe-finance",
      category: "fintech",
      aliases: [],
      website: "https://example.com",
      sourceUrl: "https://example.com/brand",
      sourceType: "official-website",
      svgBase64: unsafe
    }, [], {}, structuredClone(manifest))).rejects.toThrow("unsafe embedded content");
  });
});

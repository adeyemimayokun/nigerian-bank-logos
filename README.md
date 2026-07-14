# Nigerian Bank Logos

Open source logo catalog for Nigerian banks, fintechs, and payment providers,
with SVG, PNG, and WebP downloads.

The first public surface is a Figma plugin, backed by a reusable TypeScript logo
catalog so the same source data can later power npm packages, React components,
Iconify exports, and generated docs.

## Status

This repo is in early foundation work. The seed catalog includes only assets
that were pulled from official web properties and passed local validation.

Initial verified seed:

| Name | Category | Source |
| --- | --- | --- |
| Moniepoint | Microfinance bank | <https://moniepoint.com/icon.svg> |
| OPay | Fintech | <https://gstatic.opayweb.com/website-ng/img/opay-logo.684aa98.svg> |
| Flutterwave | Fintech | <https://flutterwave.com/images/logo/full.svg> |

The catalog now contains 119 reviewed official logos. Coverage expands through an
institution-driven sourcing queue. Raster sources are preserved and never traced
or redrawn into SVG.

## Repository Structure

```txt
apps/figma-plugin      Figma plugin UI and plugin controller
packages/logos         Typed catalog, official sources, generated formats, sourcing queue
packages/institutions  Institution data, regulator imports, and CSV/JSON exports
packages/validator     Catalog and SVG validation scripts
docs                   Product, contribution, and release notes
```

## Local Setup

```bash
corepack enable
pnpm install
pnpm logos:formats
pnpm validate
pnpm test
pnpm build:plugin
```

Refresh institution registers into a review-only staging area and regenerate committed exports with:

```bash
pnpm institutions:refresh
pnpm institutions:generate
pnpm institutions:check
```

The snapshot coverage and known regulator-source gaps are recorded in `packages/institutions/exports/source-report.json`. Institutions remain separate from the logo catalog until official artwork is reviewed.

Refresh logo candidates from institution websites with:

```bash
pnpm logos:source
```

The command only updates `packages/logos/sourcing/queue.json`; it never accepts
or replaces catalog artwork automatically.

Import matching SVG and PNG review candidates from Nigeria Logos with:

```bash
pnpm logos:source:nigeria-logos
```

This writes a provenance report to `packages/logos/sourcing/nigeria-logos.json`
and files to `packages/logos/sourcing/nigeria-logos-candidates`. Nigeria Logos is
a third-party discovery source, so these candidates cannot enter the approved
catalog until the artwork is confirmed on an institution-owned official source.

If Corepack cannot write to your user cache, install pnpm directly and rerun the
same commands.

## Figma Plugin Development

```bash
pnpm build:plugin
```

Then import `apps/figma-plugin/manifest.json` in Figma:

1. Open Figma desktop.
2. Go to Plugins > Development > Import plugin from manifest.
3. Select `apps/figma-plugin/manifest.json`.

The plugin is offline-first and declares `allowedDomains: ["none"]`.

The explorer bundles the complete Nigerian institution dataset. Approved logos
appear first and support available-format downloads; official SVGs also support
editable insertion. Records
without approved official artwork remain searchable with a `Logo pending` state;
the interface never substitutes an unrelated page image or generated mark.

## Adding Logos

Every logo needs:

- An official SVG or raster source in `packages/logos/src/sources` or `packages/logos/src/assets`.
- A catalog entry in `packages/logos/src/catalog.ts`.
- An official source URL owned by the institution or present in an official PDF.
- Generated PNG and WebP files created with `pnpm logos:formats`.
- A passing `pnpm validate` run.

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [TRADEMARKS.md](./TRADEMARKS.md).

## License

Code and tooling are MIT licensed.

Logo assets are trademarks of their respective owners and are not relicensed as
MIT. See [TRADEMARKS.md](./TRADEMARKS.md).

# @awalogo/core

Typed metadata and downloadable assets for Nigerian financial institution logos.

Verified entries preserve an official SVG or raster source. Community-catalog
imports remain clearly marked `needs-review` until an institution-owned source
confirms the artwork. Every entry includes generated PNG and WebP variants. The
Figma plugin enables editable insertion when an SVG exists and lets users
download every available format.

## Asset Pipeline

```bash
pnpm logos:formats        # generate PNG and WebP assets from accepted sources
pnpm logos:check-formats  # fail when committed derivatives are stale
pnpm logos:source         # refresh the institution-driven review queue
pnpm logos:import:nigerialogos # audit and import community review assets
pnpm logos:import:finance-apps # refresh selected official consumer-app assets
pnpm logos:import:coverage # refresh official assets from the coverage queue
pnpm logos:import:naicom   # discover assets from NAICOM-registered domains
pnpm logos:sync-links     # link matching institution rows to canonical logos
pnpm logos:promote        # rebuild reviewed promotions and their formats
```

`logos:source` visits official websites recorded in `@awalogo/institutions`
and writes candidates to `sourcing/queue.json`. Candidates are never accepted
automatically. A maintainer must confirm that an asset is the current canonical
logo and comes from an official source.

Official raster-only artwork can be accepted for preview and download, but it is
never traced into an SVG and does not enable editable Figma insertion.

Reviewed alternate lockups, symbols, and color versions are registered in
`src/variations.json`. Each variation keeps its own source path and format list,
inherits the parent logo's institution metadata, and is processed by
`logos:formats`. The plugin only shows the variation selector when a catalog
entry has at least one reviewed alternate.

`logos:import:nigerialogos` audits the complete upstream Nigeria Logos index,
filters financial entries, records exclusions and missing files, and imports new
artwork as `community-catalog` sources with `needs-review` status. It never marks
community artwork as officially verified.

`logos:import:finance-apps` refreshes the maintained official-source set for
PocketApp, InvestNaija, i-invest, GetEquity, Wahed, and Hisa. It also updates
their curated institution metadata without discarding regulator provenance.

`logos:import:naicom` reads active NAICOM workbooks, derives organization-owned
domains from regulator-listed websites and email addresses, and accepts only
logo assets whose official-page paths contain the institution identity. Rejected
and unavailable domains are recorded in `sourcing/naicom-directory-report.json`.

Institution logo coverage is exported to
`packages/institutions/exports/logo-coverage-report.json` and
`logo-coverage-unresolved.csv`. Missing records remain unresolved until an
official website and current artwork can be verified; the pipeline never
generates substitute marks.

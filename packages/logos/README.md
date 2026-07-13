# @nigerian-bank-logos/core

Typed metadata and downloadable assets for verified Nigerian financial institution logos.

Each accepted catalog entry preserves an official SVG or raster source and
includes generated PNG and WebP variants. The Figma plugin enables editable
insertion when an official SVG exists and lets users download every available format.

## Asset Pipeline

```bash
pnpm logos:formats        # generate PNG and WebP assets from accepted sources
pnpm logos:check-formats  # fail when committed derivatives are stale
pnpm logos:source         # refresh the institution-driven review queue
pnpm logos:promote        # rebuild reviewed promotions and their formats
```

`logos:source` visits official websites recorded in `@nigerian-bank-logos/institutions`
and writes candidates to `sourcing/queue.json`. Candidates are never accepted
automatically. A maintainer must confirm that an asset is the current canonical
logo and comes from an official source.

Official raster-only artwork can be accepted for preview and download, but it is
never traced into an SVG and does not enable editable Figma insertion.

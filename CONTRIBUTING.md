# Contributing

Thanks for helping make Nigerian financial brand assets easier to use.

## Logo Acceptance Rules

Accepted sources:

- Official bank, fintech, or payment provider website.
- Official brand/media kit.
- Official annual report, investor presentation, or regulatory PDF.
- Other official domains controlled by the institution.

Not accepted by default:

- Unofficial logo aggregators.
- Raster-to-vector traces.
- Hand-drawn approximations.
- Social media avatars unless they point to an official downloadable asset.

## Add a Logo

1. Add the official SVG or raster source under `packages/logos/src`.
2. Add metadata to `packages/logos/src/catalog.ts`.
3. Add every available source and generated format to the catalog entry.
4. Run `pnpm logos:formats` to generate the raster variants.
5. Use `status: "verified"` only when the source is official and current.
6. Run `pnpm validate` and `pnpm logos:check-formats`.
7. Include the source URL and any notes in your pull request.

Run `pnpm logos:source` to refresh candidates from official institution websites.
Review `packages/logos/sourcing/queue.json` manually; discovery does not prove
that an asset is the current canonical logo.

## Naming Rules

- Use lowercase slugs with hyphens, for example `first-bank`.
- Keep asset file names aligned with slugs.
- Prefer the institution's public brand name for `name`.
- Add aliases for old names, abbreviations, and common search terms.

## Add an Institution

- Review the output of `pnpm institutions:refresh` before replacing an accepted regulator import.
- Add independently reviewed market records to `packages/institutions/data/curated.json`.
- Add unreviewed submissions to `data/community-candidates.json` as `community-candidate` and `unverified`.
- Never mark a company officially verified without a regulator source.
- Run `pnpm institutions:generate`, `pnpm validate`, `pnpm institutions:check`, and `pnpm test`.

## SVG Rules

- SVG must start with `<svg`.
- No scripts, inline event handlers, or external network references.
- Keep `viewBox` intact.
- Prefer official vector assets over optimized redraws.
- Do not trace an official PNG or WebP to manufacture a vector source.

Raster-only logos may be accepted when the institution publishes no official
vector. They must retain the official source URL and cannot enable Figma insertion.

## Review Checklist

- [ ] Official source URL is included.
- [ ] Official source file exists and matches the slug.
- [ ] PNG and WebP derivatives match the catalog metadata.
- [ ] Metadata is complete.
- [ ] `pnpm validate` passes.
- [ ] `pnpm logos:check-formats` passes.
- [ ] Trademark note is respected.

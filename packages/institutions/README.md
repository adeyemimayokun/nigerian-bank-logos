# @nigerian-bank-logos/institutions

Typed, source-aware data for Nigerian financial institutions and foreign operators authorized to serve Nigeria.

## Files

- `data/regulator-imports/`: accepted snapshots from supported regulator registers.
- `data/curated.json`: reviewed records sourced from official reports or company websites.
- `data/community-candidates.json`: unverified community submissions.
- `data/excluded-inactive.json`: revoked, closed, and superseded institutions.
- `exports/`: deterministic JSON/CSV files and the source coverage report.
- `staging/`: review candidates created by `pnpm institutions:refresh`.

## Updating

1. Run `pnpm institutions:refresh`.
2. Review files in `staging/`; the command never changes accepted data.
3. Copy reviewed candidate snapshots into `data/regulator-imports/`.
4. Run `pnpm institutions:generate` and inspect the export diff.
5. Run `pnpm validate`, `pnpm institutions:check`, and `pnpm test`.

An `officially-verified` record must have a regulator source. Market-only institutions must not imply a licence. Community candidates must retain `regulatory_status: "unverified"` until reviewed.

## Usage

```ts
import {
  findInstitution,
  getInstitutionsByCategory,
  institutions
} from "@nigerian-bank-logos/institutions";

const banks = getInstitutionsByCategory("commercial-bank");
const opay = findInstitution("opay-digital-services");
```

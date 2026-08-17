# US Solutions Utilization Dashboard

An executive utilization & billing dashboard for monthly Excel exports. Business
rules are **configuration-driven** — WBS billability rules, the four-character
development code master, categories, team membership and KPI metadata are all
maintained in the Admin UI, never in code. The same classification and metric
engines power the interactive dashboard, drilldowns, validation reports and the
self-contained executive HTML snapshot.

```text
Raw Excel → Normalization → Classification Engine → Derived Dataset
          → Metric Engine → Dashboard / Filters / Charts → HTML Snapshot
```

## Quick start

```bash
npm install
npm run dev          # builds the snapshot template, then starts Next.js on :3000
```

Open http://localhost:3000, go to **Import**, upload the monthly `.xlsx` export,
review the validation summary, confirm — the dashboard is live.

### Monthly operating cycle

1. **Import** — upload the export. Columns are detected by header name
   (initially `WBS Element`, `Name of Employee or Applicant`, `Number (unit)`,
   `Short Text`, `Date`); adjust the mapping if headers change — it is
   validated and persisted.
2. **Validate** — record count, date range, totals, unknown codes, missing
   values and duplicates are shown *before* anything is stored.
3. **Confirm** — the detected reporting period (dominant month in the data) is
   confirmed or edited; re-importing an existing period requires an explicit
   replace. Each dataset stores the configuration version it was classified
   with, plus a frozen copy of that configuration.
4. **Analyze** — Overview, Team Utilization, IP & Accelerators, Activities,
   Detailed Analysis, Data Quality. All KPIs, charts, tables and drilldowns
   respond to the shared filter bar (period, team, employee, category, code,
   date range) with active filters shown as chips.
5. **Generate Executive Snapshot** — see below.

## Executive snapshots

Click **Generate Executive Snapshot** and choose:

- **Current view** — bakes the active filters in as the initial state;
- **Entire dashboard** — unfiltered.

The download (e.g. `Utilization_Executive_Snapshot_July_2026.html`) is one
self-contained HTML file: data, charts, styling and interaction are embedded.
Senior management just opens it — no upload, server, login or network. The
snapshot is frozen at generation time; later changes to data or configuration
do not affect it. The snapshot bundle physically excludes admin, import,
dataset and configuration components (verified by E2E test).

## Configuration & versioning

Admin → WBS Rules / Code Master / Categories / Teams / KPI Definitions. Every
save bumps the configuration version (v1.0 → v1.1 → …). Datasets keep the
version they were processed with — changing rules never silently rewrites
history. To apply new rules to an existing month, use **Datasets → Reprocess**
(explicit, warned). Initial business rules ship as the seed configuration:
billable = WBS starting `0004A`/`0004C`, next character ≠ `9`, minus two
explicit exclusions; development = WBS starting `0004I`; 53 development codes;
IP Delivery Team membership.

Codes are matched by *trim → uppercase → first four characters* of the Short
Description; configured codes shorter than four characters (e.g. `2PC`) match
when followed by a delimiter. Unknown codes appear on the Data Quality page
with full drill-through and can be added to the code master without touching
code.

## Architecture

```text
src/core/            Pure TypeScript engines (no React):
  config/            Zod schema, versioning, seed configuration
  ingest/            Excel parsing, header-based column mapping, validation
  classify/          Configuration-driven classification (single source of truth)
  metrics/           KPI formula registry + aggregations (ratios of sums, never
                     averaged percentages)
  filters/           Filter model applied identically to every KPI/chart/table
  snapshot/          Snapshot payload assembly + template injection
src/store/           Zustand store + IndexedDB persistence (config, datasets)
src/components/      Mode-aware React UI (interactive & snapshot share views)
src/snapshot/        Vite entry for the single-file snapshot viewer
src/app/             Next.js shell (fully client-side)
tests/               Vitest unit tests for the engines
e2e/                 Playwright: import→KPI→filter→drilldown, admin config
                     changes, snapshot offline verification
scripts/             Synthetic fixture generator, screenshot utility
```

The interactive app (Next.js) and the snapshot viewer (Vite single-file build →
`public/snapshot/index.html`) compile the same view components against the same
engines; generation injects the frozen JSON payload into the template's
placeholder script tag.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Snapshot template build + dev server |
| `npm run build` | Production build (`npm start` to serve) |
| `npm run build:snapshot` | Rebuild the snapshot viewer template only |
| `npm test` | Unit tests (Vitest) |
| `npm run e2e` | End-to-end tests (Playwright; generates a synthetic fixture) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run make:fixture` | Regenerate the synthetic E2E fixture |

To verify against a real export (never committed):
`SAMPLE_XLSX_PATH="C:\path\to\EXPORT.xlsx" npx playwright test real-sample`

## Notes & decisions

- **Persistence** is browser IndexedDB — pragmatic for an internal local tool;
  `src/store/db.ts` is the thin seam a backend/database can replace later.
- **SheetJS** is vendored (`vendor/xlsx-0.20.3.tgz`) because the current
  release is distributed via the SheetJS CDN, not the npm registry (and the
  registry copy is outdated).
- **No source data is committed**: `*.xlsx`, `e2e/fixtures/` and `data/` are
  gitignored; E2E tests use a generated fixture with fictional employees.
- Deployment: any Node 20+ host — `npm ci && npm run build && npm start`
  (or export behind a reverse proxy). No environment variables or secrets are
  required.

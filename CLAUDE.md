# Claude Context Document

## Project Overview

**CSV Report Generator** — consolidated financial reporting across multiple
business locations for a coffee-roaster client (6 cafés). Upload a CSV per
location; the app produces a combined P&L, per-location comparison, trends over
time and a category breakdown.

Built by repurposing a personal zero-based budgeting app. **The budgeting domain
model was removed entirely** (Sep 2026) — no budgets, categories-with-planned-
amounts, buffers, cash flow scheduling, bank sync, recurring payments, auth, or
iOS app. Only the chassis was kept: Next.js + Drizzle + Tailwind + the UI
primitives.

Runs entirely locally. **No authentication and no external services** — this is
a client demo.

## Instructions for Claude

- **Do NOT commit** unless explicitly authorized by the user
- Wait for user approval before running `git commit`, `git push`, or similar

## Tech Stack

Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Drizzle ORM, SQLite via
better-sqlite3, papaparse, lucide-react. No auth layer, no ORM-adjacent cloud
services.

## Database

SQLite file at `data/demo.db`, path from `DATABASE_URL` (`file:` prefix
optional, resolved in `db/path.ts`, which throws a clear error if handed a
`postgres://` URL).

| Table | Key columns | Notes |
|---|---|---|
| locations | id, name, **code**, active | `code` is what the importer matches against the CSV's location column |
| imports | id, filename, status, rowsTotal/Imported/Duplicate/Failed, errors | One row per upload — audit trail |
| transactions | id, locationId, importId, date, **period**, category, description, **amountCents**, type, **rowHash** | `period` is a denormalized YYYY-MM; `type` is 'revenue'\|'expense' |

Indexes: `(location_id, period)`, `period`, `category`, `type`.

### Critical invariants

**Money is INTEGER CENTS.** Never float, never text. Reports are `SUM()`s and
integers keep them exact. Convert at the edges via `lib/money.ts`. `amountCents`
is always a positive magnitude — direction lives in `type`.

**`PRAGMA foreign_keys = ON`** is set in `db/index.ts`. SQLite disables FK
enforcement per-connection by default, which would silently break the cascade
from `locations` → `transactions`.

**Row hashing / idempotency.** `rowHash` = SHA-256 of the normalized row plus a
per-file occurrence counter (`#1`, `#2`, …). This makes re-importing the same
file a no-op while preserving genuinely duplicate rows within one file. Inserts
use `onConflictDoNothing({ target: transactions.rowHash })`; duplicates are
counted as `rowsImported` minus what came back from `.returning()`.

**Date parsing never falls back to `new Date(string)`** (`lib/csvImport.ts`).
That reinterprets ambiguous dates against the server timezone and can shift them
across a month boundary — silent corruption in a monthly report. Unparseable
dates become reported row errors instead.

## Chart colours — do not edit casually

`lib/palette.ts` holds a palette **validated for the dark panel surface
(`#383838`)** with the dataviz skill's validator, not hand-picked:

- Lightness band, chroma floor, CVD separation and normal-vision floor all PASS.
- Two slots sit below 3:1 contrast, so the **relief rule** applies — every chart
  using them ships direct labels and a table view. The location comparison chart
  has a matching "Location detail" table for exactly this reason.
- **The slot ORDER is the colourblind-safety mechanism.** Candidate orderings
  were enumerated; the one in use scores worst-adjacent ΔE 13.2 versus 8.4 for
  the obvious ordering. Re-run the validator before reordering.
- Expenses-by-category uses a **single** brand hue, not a ramp: with 8
  categories no single-hue ramp clears the adjacent-ΔL floor on this surface,
  and bar length plus direct labels already encode magnitude.

## Theme

Sourced from the client's site (Jitter Bean Coffee Co.) — dark warm "tin"
surfaces, cream label text, spot orange accent, Archivo + Bevan typefaces.
Tokens live in `app/globals.css`.

Two brand colours are **deliberately not used as-is**: `--ok` (#1d6b3f) and
`--spot-red` (#9b2a18) are tuned for the site's cream panels and measure 1.80:1
and 1.53:1 against this app's dark panel. They're lightened to `#6cc78d` and
`#f28a72`. Likewise, text on the orange primary is **ink `#1c1a18`** (6.15:1),
never white (2.82:1 — fails).

## Key files

- `lib/csvImport.ts` — header aliasing, amount/date parsing, row hashing
- `lib/importService.ts` — location resolution (auto-creates unknown codes), dedupe, chunked insert
- `lib/reports.ts` — all aggregation SQL; one payload powers the whole dashboard
- `lib/money.ts` — cents parsing/formatting (string surgery, not parseFloat)
- `lib/palette.ts` — validated chart colours
- `db/path.ts` — shared DATABASE_URL resolution for app and drizzle-kit
- `scripts/seed-demo.ts` — generates sample CSVs then imports them **through the real pipeline**, so seeding exercises the same code path a live upload takes

## Commands

```bash
npm run dev          # dev server
npm run db:init      # schema + demo data
npm run db:seed      # regenerate + import demo CSVs
npm run db:push      # apply schema changes
npm run build        # production build
```

Reset: `rm -rf data/ && npm run db:init`

## Current state & next steps

Working: CSV import with alias matching and error reporting, idempotent
re-import, location management, and the four reports (consolidated P&L, location
comparison, trends, category breakdown). Theme matched to the client site.

**Open items:**
- The CSV format is inferred, not confirmed — the client hasn't supplied a real
  export yet. Tighten `FIELD_ALIASES` once one arrives.
- Demo locations use generic names (Downtown, Westside…). The client's actual
  cafés are Plaza and Valley West (Arcata), Broadway, 5th Street, Harris
  (Eureka), and Fortuna.
- No date-level drill-down; reports are monthly (`period`).
- Mobile is blocked by `MobileBlockScreen`; desktop only.
- `components/ui/Modal`, `CurrencyInput`, `MonthNavigator`, `MonthYearPicker`,
  `charts/ChartEmptyState`, `charts/ChartTooltip` and the Toast system are built
  but currently unused — kept intentionally as a kit for upcoming features.

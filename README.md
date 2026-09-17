# CSV Report Generator

Consolidated financial reporting across multiple business locations. Upload a
CSV per location, get a combined P&L, per-location comparison, trends over time
and a category breakdown.

Runs entirely locally: SQLite on disk, no authentication, no external services.

## Quick start

```bash
npm install
npm run db:init   # create the schema and load demo data
npm run dev       # http://localhost:3000
```

`db:init` also writes six sample CSVs to `sample-data/` — drop one on the
Import page to see the importer work.

## How it works

### Importing

The import pipeline is deliberately forgiving, because real finance exports are
messy:

- **Headers are matched by alias, not exact string.** `Date` / `Transaction
  Date` / `Trans Date` / `Posted Date` all map to the date field; `Store` /
  `Site` / `Branch` / `Unit` all map to location. Unrecognised columns are
  reported, not silently dropped.
- **Amounts** accept `$1,234.56`, `1234.56`, `(123.45)` (accounting negative),
  `-123.45` and `1,250`.
- **Dates** accept `YYYY-MM-DD`, `MM/DD/YYYY` and `M/D/YY`. There is no
  `new Date(string)` fallback on purpose — it reinterprets ambiguous dates
  against the server timezone and can shift them across a month boundary, which
  would quietly corrupt a monthly report.
- **Unknown location codes create a location** and say so in the result.
- **Bad rows are reported with their spreadsheet line number** and the offending
  value; the rest of the file still imports.
- **A file missing a required column is refused outright** rather than importing
  a partial guess.

Required columns (after aliasing): date, location, category, amount.
Optional: description, type.

If there's no `type` column, a negative amount is treated as an expense.

### Re-importing is safe

Every row gets a SHA-256 hash of its normalised content plus an occurrence
counter. Uploading the same file twice imports nothing the second time, while
two genuinely identical rows in one file are both kept. The `imports` table
records what each upload did.

### Money

Amounts are stored as **integer cents**, never floats or text. Reports are
almost entirely `SUM()`s, and integers make those exact — a float column
accumulates drift across thousands of rows. Conversion happens at the edges in
`lib/money.ts`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run db:init` | Create schema + seed demo data |
| `npm run db:push` | Apply schema changes from `db/schema.ts` |
| `npm run db:seed` | Regenerate and import the demo CSVs |
| `npm run db:studio` | Drizzle Studio |

To start over: `rm -rf data/ && npm run db:init`

## Configuration

One variable, in `.env`:

```
DATABASE_URL=file:./data/demo.db
```

The `file:` prefix is optional and the directory is created automatically.
Defaults to `./data/demo.db` when unset.

## Layout

```
app/
  page.tsx            Reports dashboard
  import/             CSV upload + history
  locations/          Location management
  api/                reports, import, locations
components/
  charts/             TrendChart, BarRows
  ui/                 Button, Card, Input, Select, Modal, Skeleton, ...
lib/
  csvImport.ts        Parsing, header aliasing, row hashing
  importService.ts    Location resolution, dedupe, insert
  reports.ts          Aggregation queries
  money.ts            Cents <-> display
  palette.ts          Validated chart colours
db/
  schema.ts           locations, imports, transactions
scripts/
  seed-demo.ts        Generates sample CSVs, imports them through the real path
```

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Drizzle ORM · SQLite
(better-sqlite3) · papaparse · lucide-react

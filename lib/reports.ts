import { sql } from 'drizzle-orm';
import { db } from '@/db';

/**
 * Report queries.
 *
 * All aggregation happens in SQL over INTEGER cents, so totals are exact and
 * the work stays in SQLite rather than pulling every row into JS.
 *
 * `from`/`to` are inclusive YYYY-MM periods.
 */

export interface ReportFilters {
  from: string;
  to: string;
  locationId?: number | null;
}

export interface Totals {
  revenueCents: number;
  expenseCents: number;
  netCents: number;
  transactionCount: number;
}

export interface LocationRow extends Totals {
  locationId: number;
  name: string;
  code: string;
}

export interface PeriodRow extends Totals {
  period: string;
}

export interface CategoryRow {
  category: string;
  type: 'revenue' | 'expense';
  amountCents: number;
  transactionCount: number;
}

export interface PeriodLocationRow {
  period: string;
  locationId: number;
  netCents: number;
  revenueCents: number;
  expenseCents: number;
}

export interface ReportPayload {
  range: { from: string; to: string };
  totals: Totals;
  byLocation: LocationRow[];
  byPeriod: PeriodRow[];
  byPeriodLocation: PeriodLocationRow[];
  byCategory: CategoryRow[];
  locations: { id: number; name: string; code: string }[];
  availablePeriods: string[];
}

// Reused SUM CASE expressions — amount_cents is a positive magnitude, so the
// direction has to come from `type`.
const REVENUE = sql`COALESCE(SUM(CASE WHEN type = 'revenue' THEN amount_cents ELSE 0 END), 0)`;
const EXPENSE = sql`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents ELSE 0 END), 0)`;

function locationFilter(locationId?: number | null) {
  return locationId ? sql`AND t.location_id = ${locationId}` : sql``;
}

export async function getReport(filters: ReportFilters): Promise<ReportPayload> {
  const { from, to, locationId } = filters;
  const loc = locationFilter(locationId);

  const totals = db.all(sql`
    SELECT ${REVENUE} AS revenueCents,
           ${EXPENSE} AS expenseCents,
           COUNT(*)   AS transactionCount
    FROM transactions t
    WHERE t.period BETWEEN ${from} AND ${to} ${loc}
  `)[0] as { revenueCents: number; expenseCents: number; transactionCount: number };

  const byLocation = db.all(sql`
    SELECT l.id AS locationId, l.name, l.code,
           ${REVENUE} AS revenueCents,
           ${EXPENSE} AS expenseCents,
           COUNT(t.id) AS transactionCount
    FROM locations l
    LEFT JOIN transactions t
      ON t.location_id = l.id AND t.period BETWEEN ${from} AND ${to}
    GROUP BY l.id, l.name, l.code
    ORDER BY (${REVENUE} - ${EXPENSE}) DESC
  `) as Omit<LocationRow, 'netCents'>[];

  const byPeriod = db.all(sql`
    SELECT t.period,
           ${REVENUE} AS revenueCents,
           ${EXPENSE} AS expenseCents,
           COUNT(*)   AS transactionCount
    FROM transactions t
    WHERE t.period BETWEEN ${from} AND ${to} ${loc}
    GROUP BY t.period
    ORDER BY t.period
  `) as Omit<PeriodRow, 'netCents'>[];

  const byPeriodLocation = db.all(sql`
    SELECT t.period, t.location_id AS locationId,
           ${REVENUE} AS revenueCents,
           ${EXPENSE} AS expenseCents
    FROM transactions t
    WHERE t.period BETWEEN ${from} AND ${to} ${loc}
    GROUP BY t.period, t.location_id
    ORDER BY t.period
  `) as Omit<PeriodLocationRow, 'netCents'>[];

  const byCategory = db.all(sql`
    SELECT t.category, t.type,
           COALESCE(SUM(t.amount_cents), 0) AS amountCents,
           COUNT(*) AS transactionCount
    FROM transactions t
    WHERE t.period BETWEEN ${from} AND ${to} ${loc}
    GROUP BY t.category, t.type
    ORDER BY amountCents DESC
  `) as CategoryRow[];

  const locations = db.all(sql`
    SELECT id, name, code FROM locations WHERE active = 1 ORDER BY name
  `) as { id: number; name: string; code: string }[];

  const availablePeriods = (db.all(sql`
    SELECT DISTINCT period FROM transactions ORDER BY period
  `) as { period: string }[]).map(r => r.period);

  return {
    range: { from, to },
    totals: {
      revenueCents: totals?.revenueCents ?? 0,
      expenseCents: totals?.expenseCents ?? 0,
      netCents: (totals?.revenueCents ?? 0) - (totals?.expenseCents ?? 0),
      transactionCount: totals?.transactionCount ?? 0,
    },
    byLocation: byLocation.map(r => ({ ...r, netCents: r.revenueCents - r.expenseCents })),
    byPeriod: byPeriod.map(r => ({ ...r, netCents: r.revenueCents - r.expenseCents })),
    byPeriodLocation: byPeriodLocation.map(r => ({ ...r, netCents: r.revenueCents - r.expenseCents })),
    byCategory,
    locations,
    availablePeriods,
  };
}

/** Full period span present in the data, for defaulting the date range. */
export async function getPeriodBounds(): Promise<{ min: string; max: string } | null> {
  const row = db.all(sql`
    SELECT MIN(period) AS min, MAX(period) AS max FROM transactions
  `)[0] as { min: string | null; max: string | null };
  if (!row?.min || !row?.max) return null;
  return { min: row.min, max: row.max };
}

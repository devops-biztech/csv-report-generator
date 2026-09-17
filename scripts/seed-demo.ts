/**
 * Demo seed for the multi-location reporting app.
 *
 * Generates one CSV per location under sample-data/ and then imports them
 * through the real import pipeline (lib/importService). Seeding therefore
 * exercises exactly the code path a live demo upload takes — if the seed
 * works, the demo upload works.
 *
 * Usage: npm run db:seed
 */
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { locations as locationsTable } from '../db/schema';
import { importCsvText } from '../lib/importService';

// Deterministic PRNG so the demo numbers are stable across re-seeds.
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260917);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);

interface Loc {
  code: string;
  name: string;
  scale: number;        // relative volume
  foodCostDrift: number; // monthly food-cost creep, tells a story in the trend
  note: string;
}

const LOCATIONS: Loc[] = [
  { code: 'DTN', name: 'Downtown',      scale: 1.35, foodCostDrift: 0.0000, note: 'flagship, highest volume' },
  { code: 'WSD', name: 'Westside',      scale: 1.05, foodCostDrift: 0.0018, note: 'food cost creeping up' },
  { code: 'NPT', name: 'Northpoint',    scale: 0.95, foodCostDrift: 0.0000, note: 'steady' },
  { code: 'EGT', name: 'Eastgate',      scale: 0.80, foodCostDrift: 0.0006, note: 'smaller, stable' },
  { code: 'SHR', name: 'Southridge',    scale: 0.62, foodCostDrift: 0.0028, note: 'underperformer — thin margins' },
  { code: 'APT', name: 'Airport Plaza', scale: 1.15, foodCostDrift: 0.0000, note: 'high rent, high traffic' },
];

const PERIODS: string[] = [];
for (let i = 11; i >= 0; i--) {
  const d = new Date(Date.UTC(2026, 8 - i, 1)); // 12 months ending Aug 2026
  PERIODS.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
}

// Seasonal multiplier by calendar month (1-12): summer + December peak.
const SEASON = [0.92, 0.90, 0.97, 1.00, 1.05, 1.12, 1.15, 1.13, 1.02, 1.00, 1.03, 1.18];

function daysInMonth(period: string): number {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

type Row = { date: string; location: string; category: string; description: string; amount: string; type: string };

function generateRows(loc: Loc): Row[] {
  const rows: Row[] = [];

  PERIODS.forEach((period, monthIndex) => {
    const [y, m] = period.split('-').map(Number);
    const season = SEASON[m - 1];
    const dim = daysInMonth(period);
    let monthRevenue = 0;

    for (let day = 1; day <= dim; day++) {
      const date = `${period}-${String(day).padStart(2, '0')}`;
      const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
      // Fri/Sat lift, Monday dip.
      const dowFactor = dow === 5 || dow === 6 ? 1.35 : dow === 1 ? 0.78 : 1.0;

      const food = between(2100, 3400) * loc.scale * season * dowFactor;
      const bev = food * between(0.22, 0.31);
      monthRevenue += food + bev;

      rows.push({ date, location: loc.code, category: 'Food Sales', description: 'Daily food sales', amount: food.toFixed(2), type: 'Revenue' });
      rows.push({ date, location: loc.code, category: 'Beverage Sales', description: 'Daily beverage sales', amount: bev.toFixed(2), type: 'Revenue' });

      // Catering lands on scattered weekdays.
      if (dow !== 0 && rand() < 0.12) {
        const catering = between(600, 2800) * loc.scale;
        monthRevenue += catering;
        rows.push({ date, location: loc.code, category: 'Catering', description: 'Catering order', amount: catering.toFixed(2), type: 'Revenue' });
      }
    }

    // Month-end expenses, mostly as a share of the revenue actually earned.
    const eom = `${period}-${String(dim).padStart(2, '0')}`;
    const foodCostPct = 0.288 + loc.foodCostDrift * monthIndex + between(-0.006, 0.006);
    const laborPct = 0.301 + between(-0.012, 0.012);

    const expenses: [string, number, string][] = [
      ['Food Cost',   monthRevenue * foodCostPct, 'Food & beverage COGS'],
      ['Labor',       monthRevenue * laborPct,    'Wages and payroll taxes'],
      ['Rent',        (loc.code === 'APT' ? 21500 : 9200 + loc.scale * 4200), 'Monthly lease'],
      ['Utilities',   between(1450, 2900) * loc.scale, 'Electric, gas, water'],
      ['Marketing',   between(480, 2100) * loc.scale, 'Local advertising'],
      ['Supplies',    between(760, 1950) * loc.scale, 'Paper goods and smallwares'],
      ['Maintenance', between(180, 1700) * loc.scale, 'Repairs and upkeep'],
      ['Insurance',   between(640, 1180), 'Liability and property'],
    ];

    for (const [category, amount, description] of expenses) {
      rows.push({ date: eom, location: loc.code, category, description, amount: amount.toFixed(2), type: 'Expense' });
    }
  });

  return rows;
}

function toCsv(rows: Row[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const header = 'Date,Location,Category,Description,Amount,Type';
  const body = rows.map(r => [r.date, r.location, r.category, r.description, r.amount, r.type].map(esc).join(','));
  return [header, ...body].join('\n') + '\n';
}

async function seed() {
  console.log('Seeding multi-location demo data\n');

  // Clear in FK-safe order.
  await db.run(sql`DELETE FROM transactions`);
  await db.run(sql`DELETE FROM imports`);
  await db.run(sql`DELETE FROM locations`);
  await db.run(sql`DELETE FROM sqlite_sequence WHERE name IN ('transactions','imports','locations')`);
  console.log('Cleared existing data');

  // Create locations with real names up front. The importer would otherwise
  // auto-create them from the CSV's code column and name them "DTN".
  await db.insert(locationsTable).values(
    LOCATIONS.map(l => ({ name: l.name, code: l.code }))
  );
  console.log(`Created ${LOCATIONS.length} locations`);

  const outDir = resolve(process.cwd(), 'sample-data');
  mkdirSync(outDir, { recursive: true });

  let grandTotal = 0;
  for (const loc of LOCATIONS) {
    const rows = generateRows(loc);
    const csv = toCsv(rows);
    const filename = `${loc.code.toLowerCase()}-${PERIODS[0]}-to-${PERIODS[PERIODS.length - 1]}.csv`;
    writeFileSync(resolve(outDir, filename), csv, 'utf8');

    const summary = await importCsvText(filename, csv);
    grandTotal += summary.rowsImported;
    console.log(
      `  ${loc.code} ${loc.name.padEnd(14)} ${String(summary.rowsImported).padStart(5)} rows ` +
      `(${summary.rowsDuplicate} dupe, ${summary.rowsFailed} failed)  → sample-data/${filename}`
    );
  }

  const [{ n }] = db.all(sql`SELECT COUNT(*) AS n FROM transactions`) as { n: number }[];
  console.log(`\nImported ${grandTotal} rows across ${LOCATIONS.length} locations (${n} in database)`);
  console.log(`Periods: ${PERIODS[0]} to ${PERIODS[PERIODS.length - 1]}`);
  console.log(`\nSample CSVs are in sample-data/ — upload one live to demo the importer.`);
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });

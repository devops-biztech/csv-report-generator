import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { locations, imports, transactions } from '@/db/schema';
import { parseCsv, type CanonicalRow, type RowError } from './csvImport';

export interface ImportSummary {
  importId: number | null;
  status: 'complete' | 'failed';
  filename: string;
  rowsTotal: number;
  rowsImported: number;
  rowsDuplicate: number;
  rowsFailed: number;
  errors: RowError[];
  newLocations: string[];
  unmappedHeaders: string[];
  missingRequired: string[];
}

// SQLite caps bound parameters per statement; chunking keeps big files safe.
const CHUNK = 400;

/** Resolve location codes/names to ids, creating any we haven't seen before. */
async function resolveLocations(rows: CanonicalRow[]): Promise<{
  map: Map<string, number>;
  created: string[];
}> {
  const existing = await db.select().from(locations);
  const map = new Map<string, number>();
  for (const l of existing) {
    map.set(l.code.toLowerCase(), l.id);
    map.set(l.name.toLowerCase(), l.id);
  }

  const created: string[] = [];
  const unknown = [...new Set(
    rows.map(r => r.locationRaw).filter(raw => !map.has(raw.toLowerCase()))
  )];

  for (const raw of unknown) {
    const [row] = await db
      .insert(locations)
      .values({ name: raw, code: raw.toUpperCase().slice(0, 16) })
      .returning();
    map.set(raw.toLowerCase(), row.id);
    map.set(row.code.toLowerCase(), row.id);
    created.push(raw);
  }

  return { map, created };
}

export async function importCsvText(filename: string, text: string): Promise<ImportSummary> {
  const parsed = parseCsv(text);

  // Headers we couldn't map means we'd be guessing at the numbers — refuse.
  if (parsed.missingRequired.length > 0) {
    const [record] = await db.insert(imports).values({
      filename,
      status: 'failed',
      rowsTotal: 0,
      errors: JSON.stringify([{
        row: 1,
        message: `Missing required column(s): ${parsed.missingRequired.join(', ')}. Found: ${parsed.headers.join(', ') || '(none)'}`,
      }]),
    }).returning();

    return {
      importId: record.id,
      status: 'failed',
      filename,
      rowsTotal: 0,
      rowsImported: 0,
      rowsDuplicate: 0,
      rowsFailed: 0,
      errors: [],
      newLocations: [],
      unmappedHeaders: parsed.unmappedHeaders,
      missingRequired: parsed.missingRequired,
    };
  }

  const { map, created } = await resolveLocations(parsed.rows);

  const [record] = await db.insert(imports).values({
    filename,
    status: 'complete',
    rowsTotal: parsed.rows.length + parsed.errors.length,
  }).returning();

  let inserted = 0;
  for (let i = 0; i < parsed.rows.length; i += CHUNK) {
    const chunk = parsed.rows.slice(i, i + CHUNK);
    const values = chunk.map(r => ({
      locationId: map.get(r.locationRaw.toLowerCase())!,
      importId: record.id,
      date: r.date,
      period: r.period,
      category: r.category,
      description: r.description,
      amountCents: r.amountCents,
      type: r.type,
      rowHash: r.rowHash,
    }));

    // Duplicate rowHash => this exact row was already imported; skip quietly.
    const result = await db
      .insert(transactions)
      .values(values)
      .onConflictDoNothing({ target: transactions.rowHash })
      .returning({ id: transactions.id });

    inserted += result.length;
  }

  const duplicates = parsed.rows.length - inserted;

  await db.update(imports).set({
    rowsImported: inserted,
    rowsDuplicate: duplicates,
    rowsFailed: parsed.errors.length,
    errors: parsed.errors.length ? JSON.stringify(parsed.errors.slice(0, 100)) : null,
  }).where(eq(imports.id, record.id));

  return {
    importId: record.id,
    status: 'complete',
    filename,
    rowsTotal: parsed.rows.length + parsed.errors.length,
    rowsImported: inserted,
    rowsDuplicate: duplicates,
    rowsFailed: parsed.errors.length,
    errors: parsed.errors.slice(0, 100),
    newLocations: created,
    unmappedHeaders: parsed.unmappedHeaders,
    missingRequired: [],
  };
}
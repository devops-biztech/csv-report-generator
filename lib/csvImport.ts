import Papa from 'papaparse';
import { createHash } from 'crypto';
import { parseAmountToCents } from './money';

/**
 * CSV ingest for multi-location financial data.
 *
 * The client's exact export format isn't known yet, so headers are matched by
 * alias rather than by exact string, and anything unmatched is reported back
 * instead of being dropped silently.
 */

export interface CanonicalRow {
  date: string;        // YYYY-MM-DD
  period: string;      // YYYY-MM
  locationRaw: string;
  category: string;
  description: string;
  amountCents: number; // positive magnitude
  type: 'revenue' | 'expense';
  rowHash: string;
}

export interface RowError {
  row: number;      // 1-based, as the user sees it in a spreadsheet
  message: string;
  raw?: string;
}

export interface ParseResult {
  rows: CanonicalRow[];
  errors: RowError[];
  headers: string[];
  unmappedHeaders: string[];
  missingRequired: string[];
}

/** Header aliases, lowercase. Extend freely as real exports turn up. */
const FIELD_ALIASES: Record<string, string[]> = {
  date: ['date', 'transaction date', 'trans date', 'txn date', 'posted date', 'post date', 'day'],
  location: ['location', 'location code', 'site', 'store', 'store #', 'store number', 'branch', 'unit', 'shop'],
  category: ['category', 'account', 'gl account', 'gl code', 'class', 'expense type', 'line item'],
  description: ['description', 'memo', 'details', 'detail', 'notes', 'note', 'payee', 'vendor', 'name'],
  amount: ['amount', 'amt', 'total', 'value', 'net', 'net amount', 'debit/credit'],
  type: ['type', 'direction', 'kind', 'dr/cr', 'debit/credit type', 'entry type'],
};

const REQUIRED = ['date', 'location', 'category', 'amount'];

function normalizeHeader(h: string): string {
  return h.replace(/^﻿/, '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

/** Map the file's headers onto canonical field names. */
export function mapHeaders(headers: string[]): {
  mapping: Record<string, string>;
  unmapped: string[];
  missing: string[];
} {
  const mapping: Record<string, string> = {};
  const unmapped: string[] = [];

  for (const header of headers) {
    const norm = normalizeHeader(header);
    const field = Object.keys(FIELD_ALIASES).find(f => FIELD_ALIASES[f].includes(norm));
    if (field && !(field in mapping)) mapping[field] = header;
    else unmapped.push(header);
  }

  const missing = REQUIRED.filter(f => !(f in mapping));
  return { mapping, unmapped, missing };
}

/**
 * Normalize a date cell to YYYY-MM-DD.
 * Accepts YYYY-MM-DD, MM/DD/YYYY, M/D/YY and YYYY/MM/DD. Deliberately does NOT
 * fall back to `new Date(string)` — that silently reinterprets ambiguous input
 * against the server's timezone and would shift dates across month boundaries,
 * which is exactly the kind of error a financial report must not make.
 */
export function normalizeDate(raw: string): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/);
  if (m) {
    let year = +m[3];
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return iso(year, +m[1], +m[2]); // US convention: MM/DD/YYYY
  }
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const REVENUE_WORDS = ['revenue', 'income', 'sale', 'sales', 'credit', 'cr', 'deposit'];
const EXPENSE_WORDS = ['expense', 'expenses', 'cost', 'debit', 'dr', 'purchase', 'payment'];

function resolveType(typeCell: string | undefined, cents: number): 'revenue' | 'expense' {
  const t = String(typeCell ?? '').trim().toLowerCase();
  if (t) {
    if (REVENUE_WORDS.includes(t)) return 'revenue';
    if (EXPENSE_WORDS.includes(t)) return 'expense';
  }
  // No usable type column: negative amounts are expenses.
  return cents < 0 ? 'expense' : 'revenue';
}

/**
 * Parse a CSV into canonical rows.
 *
 * Row hashes get an occurrence suffix (#1, #2, ...) per identical row within a
 * file. Two genuinely identical $5.00 sales on the same day both survive, while
 * re-uploading the same file still produces the same hashes and is a clean
 * no-op rather than doubling the numbers.
 */
export function parseCsv(text: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: h => h.replace(/^﻿/, '').trim(),
  });

  const headers = parsed.meta.fields ?? [];
  const { mapping, unmapped, missing } = mapHeaders(headers);

  if (missing.length > 0) {
    return { rows: [], errors: [], headers, unmappedHeaders: unmapped, missingRequired: missing };
  }

  const rows: CanonicalRow[] = [];
  const errors: RowError[] = [];
  const seen = new Map<string, number>();

  parsed.data.forEach((record, i) => {
    const lineNo = i + 2; // +1 for header, +1 for 1-based

    const date = normalizeDate(record[mapping.date]);
    if (!date) {
      errors.push({ row: lineNo, message: `Unrecognized date`, raw: record[mapping.date] });
      return;
    }

    const locationRaw = String(record[mapping.location] ?? '').trim();
    if (!locationRaw) {
      errors.push({ row: lineNo, message: 'Missing location' });
      return;
    }

    const cents = parseAmountToCents(record[mapping.amount]);
    if (cents === null) {
      errors.push({ row: lineNo, message: 'Unrecognized amount', raw: record[mapping.amount] });
      return;
    }

    const category = String(record[mapping.category] ?? '').trim() || 'Uncategorized';
    const description = String(mapping.description ? record[mapping.description] ?? '' : '').trim();
    const type = resolveType(mapping.type ? record[mapping.type] : undefined, cents);

    const base = [locationRaw.toLowerCase(), date, category.toLowerCase(), description.toLowerCase(), Math.abs(cents), type].join('|');
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);

    rows.push({
      date,
      period: date.slice(0, 7),
      locationRaw,
      category,
      description,
      amountCents: Math.abs(cents),
      type,
      rowHash: createHash('sha256').update(`${base}#${occurrence}`).digest('hex'),
    });
  });

  return { rows, errors, headers, unmappedHeaders: unmapped, missingRequired: missing };
}

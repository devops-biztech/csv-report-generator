import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

/**
 * Multi-location financial reporting.
 *
 * Money is stored as INTEGER CENTS, never text or float. Reports are almost
 * entirely SUM()s, and integer cents makes those exact in SQL; a float column
 * would accumulate drift across thousands of rows, and a text column would be
 * silently coerced to float by SUM() anyway. Convert at the edges with
 * lib/money.ts.
 */

export const locations = sqliteTable('locations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  // Short code as it appears in the CSV's location column (e.g. "DTN").
  code: text('code').notNull().unique(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

/**
 * One row per uploaded file — an audit trail, and what makes a re-import
 * reviewable ("this file added 412 rows, skipped 3 duplicates").
 */
export const imports = sqliteTable('imports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename').notNull(),
  status: text('status').notNull().$type<'complete' | 'failed'>(),
  rowsTotal: integer('rows_total').notNull().default(0),
  rowsImported: integer('rows_imported').notNull().default(0),
  rowsDuplicate: integer('rows_duplicate').notNull().default(0),
  rowsFailed: integer('rows_failed').notNull().default(0),
  // JSON array of {row, message} for rows we couldn't parse.
  errors: text('errors'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  locationId: integer('location_id').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  // Keep rows if their import record is ever deleted — the data is still real.
  importId: integer('import_id').references(() => imports.id, { onDelete: 'set null' }),
  date: text('date').notNull(), // YYYY-MM-DD
  // Denormalized YYYY-MM. Every report groups by month; deriving it per query
  // would mean a substr() scan instead of an index hit.
  period: text('period').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull().default(''),
  // Always a positive magnitude; direction lives in `type`.
  amountCents: integer('amount_cents').notNull(),
  type: text('type').notNull().$type<'revenue' | 'expense'>(),
  // sha256 of the normalized source row — makes re-importing the same file a
  // no-op instead of doubling the numbers.
  rowHash: text('row_hash').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (t) => [
  index('tx_location_period_idx').on(t.locationId, t.period),
  index('tx_period_idx').on(t.period),
  index('tx_category_idx').on(t.category),
  index('tx_type_idx').on(t.type),
]);

export const locationsRelations = relations(locations, ({ many }) => ({
  transactions: many(transactions),
}));

export const importsRelations = relations(imports, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  location: one(locations, {
    fields: [transactions.locationId],
    references: [locations.id],
  }),
  import: one(imports, {
    fields: [transactions.importId],
    references: [imports.id],
  }),
}));

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { resolveDbPath } from './path';
import * as schema from './schema';

// SQLite (better-sqlite3) — local file database for the demo.
// See db/path.ts for how DATABASE_URL is interpreted.

function createClient(): Database.Database {
  const client = new Database(resolveDbPath());
  // SQLite disables FK enforcement per-connection by default. The schema
  // relies on it: deleting a budget must cascade to its categories, items,
  // splits, and detach transactions (onDelete: 'set null').
  client.pragma('foreign_keys = ON');
  // WAL lets reads proceed during writes — Next.js runs many concurrent handlers.
  client.pragma('journal_mode = WAL');
  return client;
}

// Next.js dev hot-reloads modules; without a singleton every reload would
// open another handle to the same file.
const globalForDb = globalThis as unknown as { __sqliteClient?: Database.Database };
const client = globalForDb.__sqliteClient ?? createClient();
if (process.env.NODE_ENV !== 'production') globalForDb.__sqliteClient = client;

export const db = drizzle(client, { schema });

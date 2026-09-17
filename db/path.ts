import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

/**
 * Resolve DATABASE_URL to a SQLite file path and make sure its folder exists.
 *
 * Accepts a plain path or a `file:` URL:
 *   file:./data/demo.db   ./data/demo.db   /absolute/path/demo.db
 * Defaults to ./data/demo.db when unset.
 *
 * Shared by the app (db/index.ts) and drizzle-kit (drizzle.config.ts) so the
 * two can never disagree about which file they are talking to.
 */
export function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL?.trim() || './data/demo.db';

  // Catch a leftover Postgres/MySQL URL early — otherwise it gets treated as a
  // relative path and silently creates nonsense directories.
  const scheme = raw.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1].toLowerCase();
  if (scheme && scheme !== 'file') {
    throw new Error(
      `DATABASE_URL is a "${scheme}://" URL, but this app now uses SQLite. ` +
      `Set it to a file path, e.g. DATABASE_URL=file:./data/demo.db`
    );
  }

  const path = resolve(process.cwd(), raw.replace(/^file:(\/\/)?/, ''));
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

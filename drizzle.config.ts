import { config } from 'dotenv';
// Match Next.js precedence: .env.local wins over .env (dotenv won't overwrite
// a var that's already set, so loading .env.local first gives it priority).
config({ path: '.env.local' });
config({ path: '.env' });
import type { Config } from 'drizzle-kit';
import { resolveDbPath } from './db/path';

export default {
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: { url: resolveDbPath() },
} satisfies Config;

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __workhubDb?: Db };

/**
 * Lazily-created Drizzle client. Lazy so `next build` succeeds without a
 * DATABASE_URL, and cached on globalThis so dev hot reloads don't leak
 * connections.
 */
export function getDb(): Db {
  if (globalForDb.__workhubDb) return globalForDb.__workhubDb;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill in your Supabase connection string.",
    );
  }
  const client = postgres(url, {
    // Supabase's transaction pooler (port 6543) does not support prepared statements.
    prepare: false,
    max: 5,
  });
  const db = drizzle(client, { schema });
  globalForDb.__workhubDb = db;
  return db;
}

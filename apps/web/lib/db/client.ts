// Postgres connection + schema bootstrap. Active only when DATABASE_URL is
// set; otherwise the store falls back to its in-memory maps (fine for local
// dev and the credential-free demo, non-durable). The store logic is written
// against the minimal `Queryable` shape below so it can run against either a
// real `pg.Pool` (prod) or an in-process PGlite instance (tests) unchanged.

import { Pool } from "pg";
import { SCHEMA_SQL } from "./schema";

export interface Queryable {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
}

const g = globalThis as unknown as { __vantagePool?: Pool; __vantageSchema?: Promise<void> };

export function pgConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

/** Lazily create a shared pool. Neon/Supabase need SSL; a plain
 *  connection string is assumed local (no SSL). */
export function getPool(): Pool | null {
  if (!pgConfigured()) return null;
  if (!g.__vantagePool) {
    const url = process.env.DATABASE_URL!;
    const needsSsl = /supabase|neon|render|amazonaws|sslmode=require/i.test(url);
    g.__vantagePool = new Pool({
      connectionString: url,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
  }
  return g.__vantagePool;
}

/** Idempotently create the schema, once per process. */
export async function ensureSchema(q: Queryable): Promise<void> {
  await q.query(SCHEMA_SQL);
}

/** Get the live pool with its schema ensured, or null if unconfigured. */
export async function db(): Promise<Queryable | null> {
  const pool = getPool();
  if (!pool) return null;
  if (!g.__vantageSchema) {
    g.__vantageSchema = ensureSchema(pool).catch((err) => {
      // Reset so a later request can retry rather than caching the failure.
      g.__vantageSchema = undefined;
      throw err;
    });
  }
  await g.__vantageSchema;
  return pool;
}

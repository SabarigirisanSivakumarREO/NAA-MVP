/**
 * Phase 4 T070 — Drizzle + pg client + migration runner.
 *
 * Canonical: spec.md AC-05 + tasks.md T070 + impact.md (PostgresStorage adapter).
 * R9: this file is one of the two locations allowed to import `pg` / `drizzle-orm`
 * (the other is `adapters/PostgresStorage.ts`, T074).
 * R7.1: Drizzle is the ORM; raw `query()` here is for migrations + conformance
 * tests + admin tooling only — domain code goes through Drizzle.
 *
 * Env contract:
 *   - DATABASE_URL is the canonical Phase 4 env var (matches conformance tests).
 *   - POSTGRES_URL is the Phase 0 stub env var; honored as fallback for
 *     docker-compose compatibility.
 *
 * Singleton pattern: a single Pool per process. Vitest beforeAll/afterAll
 * lifecycle reuses the pool; `getDbClient().end()` shuts it down at suite end.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema.js';

const { Pool } = pg;

export type DbPool = pg.Pool;
export type DbDrizzle = ReturnType<typeof drizzle<typeof schema>>;

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

let pool: DbPool | undefined;
let db: DbDrizzle | undefined;

const resolveConnectionString = (): string => {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'DB connection unset: set DATABASE_URL (or Phase 0 POSTGRES_URL) before calling getDbClient()/runMigrations().',
    );
  }
  return url;
};

const ensurePool = (): DbPool => {
  if (pool === undefined) {
    pool = new Pool({
      connectionString: resolveConnectionString(),
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
};

/**
 * Raw `pg.Pool` accessor — required by `PostgresStorage` (T074) so it can
 * call `pool.connect()` and BEGIN a transaction on a single checked-out
 * connection (the only way to scope `SET LOCAL app.client_id` correctly
 * per R7.2). Domain code should NOT use this — prefer `getDb()` (Drizzle
 * builder) or `getDbClient()` (raw `query` wrapper).
 *
 * R9: this accessor is the seam through which `PostgresStorage.ts` shares
 * the singleton pool — without it, the adapter would have to create a
 * second pool, leaving connections open after the singleton is closed.
 */
export const getPool = (): DbPool => ensurePool();

/**
 * Drizzle ORM client — domain code uses this. Single instance per process.
 */
export const getDb = (): DbDrizzle => {
  if (db === undefined) {
    db = drizzle(ensurePool(), { schema });
  }
  return db;
};

/**
 * Raw pg pool wrapper exposed for conformance tests + migration runner.
 * `query<T>(text, params?)` returns `{ rows: T[] }` (pg's native shape).
 * `end()` shuts down the pool; safe to call in afterAll.
 */
export interface RawDbClient {
  query<T = unknown>(text: string, params?: ReadonlyArray<unknown>): Promise<{ rows: T[] }>;
  end(): Promise<void>;
}

export const getDbClient = (): RawDbClient => {
  const p = ensurePool();
  return {
    query: async <T = unknown>(
      text: string,
      params?: ReadonlyArray<unknown>,
    ): Promise<{ rows: T[] }> => {
      const result = await p.query(text, params as unknown[] | undefined);
      return { rows: result.rows as T[] };
    },
    end: async (): Promise<void> => {
      if (pool !== undefined) {
        await pool.end();
        pool = undefined;
        db = undefined;
      }
    },
  };
};

/**
 * Apply migrations in lexical order (0001_*, 0002_*, ...). Idempotent —
 * each SQL file uses CREATE TABLE IF NOT EXISTS / OR REPLACE / DROP-then-CREATE
 * patterns. Safe to run repeatedly.
 *
 * Returns the count of migration files applied (informational; all files run
 * every time, but the SQL itself is the idempotency layer).
 */
export const runMigrations = async (): Promise<number> => {
  const p = ensurePool();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
    await p.query(sql);
  }
  return files.length;
};

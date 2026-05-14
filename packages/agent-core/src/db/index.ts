/**
 * Phase 4 T070 — db barrel.
 *
 * Re-exports the Drizzle schema (15 tables), the Drizzle client, the raw pg
 * client, the migration runner, and the append-only brand type. Consumers
 * import `@neural/agent-core/db` or `from '../../db/index.js'`.
 *
 * R10.2 named exports only. R9: this barrel is the allowed import surface;
 * code outside `db/` and `adapters/PostgresStorage.ts` must NOT directly
 * import `pg` / `drizzle-orm`.
 */
export * from './schema.js';
export {
  getDb,
  getDbClient,
  runMigrations,
  type DbPool,
  type DbDrizzle,
  type RawDbClient,
} from './client.js';

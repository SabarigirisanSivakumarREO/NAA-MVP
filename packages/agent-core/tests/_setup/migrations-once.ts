/**
 * Vitest globalSetup — apply Drizzle migrations ONCE before any worker spawns.
 *
 * Canonical: Phase 5 T-PHASE5-TESTINFRA-DEADLOCK; addresses Phase 4 act-005
 *            W1A parallel-migration deadlock (`--no-file-parallelism` workaround
 *            cost ~30s per test run).
 *
 * # Why this exists
 *
 * Before this hook, each DB-touching test file called `runMigrations()` in its
 * own `beforeAll`. With `vitest run` spawning multiple workers in parallel, the
 * cold-start race on DROP TRIGGER / CREATE TRIGGER DDL in `0001_initial.sql`
 * intermittently deadlocked on `pg_class` row locks. The workaround was
 * `--no-file-parallelism`, which serialized ALL test files (~30s overhead).
 *
 * globalSetup runs ONCE in the vitest controller process before any worker
 * spawns. By pre-applying migrations against a hot DB, subsequent worker-level
 * `beforeAll(runMigrations)` calls re-execute idempotent SQL on already-migrated
 * state — fast enough to avoid the cold-DDL race.
 *
 * # Constraints
 *
 * - R9 adapter pattern: imports `runMigrations` from `src/db/client.ts`; no
 *   direct `pg` import in tests/_setup.
 * - DATABASE_URL is OPTIONAL — most unit tests don't need DB. When unset,
 *   this setup silently skips and DB-dependent tests fail/skip as they
 *   already do (carry-forward from Phase 4/4b).
 * - Idempotent: vitest may invoke globalSetup multiple times across `vitest run`
 *   invocations; underlying migration SQL is idempotent (CREATE TABLE IF NOT
 *   EXISTS / DROP TRIGGER IF EXISTS).
 *
 * # Logging
 *
 * Uses Pino via `createLogger` (R13: no console.log). Logs are informational
 * — silent success path keeps test output clean.
 */
import { createLogger } from '../../src/observability/logger.js';
import { runMigrations } from '../../src/db/client.js';

const log = createLogger('test-setup-migrations');

export default async function setup(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (dbUrl === undefined || dbUrl === '') {
    log.debug(
      { component: 'migrations-once' },
      'DATABASE_URL unset; skipping pre-suite migration apply (DB-dependent tests will handle individually)',
    );
    return;
  }

  const startedAt = Date.now();
  const fileCount = await runMigrations();
  const durationMs = Date.now() - startedAt;

  log.info(
    {
      component: 'migrations-once',
      migration_files: fileCount,
      duration_ms: durationMs,
    },
    'Pre-suite migrations applied — workers can now run in parallel',
  );
}

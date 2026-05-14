#!/usr/bin/env node
/**
 * scripts/db-migrate.mjs — Phase 4 T070 replacement for Phase 0's db-migrate-stub.
 *
 * Spec sources:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T070
 *     ("`pnpm db:migrate` replaces Phase 0's stub")
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-05
 *
 * What it does (idempotent):
 *   1. Resolve DATABASE_URL (or fall back to POSTGRES_URL for Phase 0 envs).
 *   2. CREATE EXTENSION IF NOT EXISTS vector (carry-over from Phase 0 stub).
 *   3. Apply every .sql file in packages/agent-core/src/db/migrations in
 *      lexical order (0001_initial.sql, 0002_master_extensions.sql).
 *   4. Print a summary line.
 *
 * Idempotency contract: every CREATE in the migration files uses IF NOT
 * EXISTS / OR REPLACE / DROP-then-CREATE. Safe to run repeatedly without
 * error (Phase 4 T070 kill criterion).
 *
 * Why this lives at scripts/ instead of packages/agent-core/:
 *   Same R9 carve-out as Phase 0's stub (per phase-0 spec §Assumptions).
 *   Infrastructure tooling = build/dev script, not production code.
 *
 * Exit codes: 0 OK, 1 env missing, 3 connection/query error.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) {
  process.stderr.write(
    'ERROR: DATABASE_URL (or Phase 0 POSTGRES_URL) not set. Copy .env.example to .env first.\n',
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'packages', 'agent-core', 'src', 'db', 'migrations');

const client = new pg.Client({ connectionString: url });

try {
  await client.connect();

  // Phase 0 carry-over: ensure pgvector is loaded (no domain table uses it
  // yet, but Phase 6 heuristic_catalog will — keeping the extension creation
  // here means the dev env is always ready).
  await client.query('CREATE EXTENSION IF NOT EXISTS vector');

  // Apply all .sql files in lexical order.
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), 'utf8');
    process.stdout.write(`> applying ${f}\n`);
    await client.query(sql);
  }

  // Sanity probe — list the 15 Phase 4 tables.
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`,
  );
  process.stdout.write(`OK applied ${files.length} migration(s); ${rows.length} tables in public.\n`);
} catch (err) {
  process.stderr.write(`ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(3);
} finally {
  await client.end();
}

#!/usr/bin/env node
/**
 * scripts/db-migrate-stub.mjs — Phase 0 db:migrate stub.
 *
 * Source: docs/specs/mvp/phases/phase-0-setup/{spec,plan,tasks}.md
 *         (T005 + AC-05 + spec §Assumptions infrastructure-tooling carve-out).
 *
 * Why this lives at scripts/ instead of packages/agent-core/:
 *   spec.md §Assumptions codifies the R9 adapter-boundary exemption for
 *   infrastructure tooling — build/dev scripts that don't run in the
 *   production customer flow. Three exemption criteria, all met:
 *     (a) only invoked manually or via pnpm script during dev / CI / setup
 *     (b) does NOT run in production at customer request
 *     (c) is NOT imported as a module by application code
 *   Direct `pg` import here is therefore OK and traced to spec per R22.2.
 *
 * What this script does (Phase 0 minimal):
 *   1. Read POSTGRES_URL from process.env (loaded via Node 22
 *      --env-file-if-exists=.env in the pnpm db:migrate script).
 *   2. Connect to Postgres.
 *   3. Run CREATE EXTENSION IF NOT EXISTS vector (idempotent).
 *   4. Query installed extension version, print `OK pgvector vN.N.N`.
 *
 * What it does NOT do:
 *   - No Drizzle invocation (Drizzle lands Phase 4 alongside the schema).
 *   - No domain-table migrations (no domain entities exist yet).
 *   - No transaction wrapping (CREATE EXTENSION is auto-committed in
 *     Postgres; nothing else runs).
 *
 * Exit codes:
 *   0  — OK; pgvector version printed to stdout
 *   1  — POSTGRES_URL not set in env
 *   2  — extension missing after CREATE (should never happen; defense)
 *   3  — connection / query error (message on stderr)
 */
import pg from 'pg';

const url = process.env.POSTGRES_URL;
if (!url) {
  process.stderr.write(
    'ERROR: POSTGRES_URL not set. Copy .env.example to .env first, or export POSTGRES_URL.\n',
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  await client.query('CREATE EXTENSION IF NOT EXISTS vector');
  const { rows } = await client.query(
    "SELECT extversion FROM pg_extension WHERE extname='vector'",
  );
  if (rows.length === 0) {
    process.stderr.write('ERROR: pgvector extension not found after CREATE.\n');
    process.exit(2);
  }
  process.stdout.write(`OK pgvector v${rows[0].extversion}\n`);
} catch (err) {
  process.stderr.write(`ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(3);
} finally {
  await client.end();
}

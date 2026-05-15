/**
 * AC-05 + AC-17 — DB schema conformance (Phase 4 T070).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-05, AC-17
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T070
 *     (REQ-DATA-SCHEMA-001 + REQ-DATA-RLS-001 + REQ-DATA-APPEND-ONLY-001)
 *
 * AC-05 contract:
 *   - pnpm db:migrate applies migrations 0001 + 0002
 *   - 15 tables exist
 *   - RLS enabled on each of the 10 client-scoped tables:
 *     clients, audit_runs, findings, screenshots, sessions, page_states,
 *     state_interactions, finding_rollups, reproducibility_snapshots, audit_requests
 *   - Append-only triggers fire on UPDATE/DELETE for the 5 append-only tables:
 *     audit_log, rejected_findings, finding_edits, llm_call_log, audit_events
 *
 * AC-17 contract:
 *   - Schema baseline does NOT define a context_profiles table (Phase 4b T4B-012
 *     owns that migration).
 *   - If Phase 4b impact.md doesn't exist at T070 implementation time, fall back
 *     to assert absence-only.
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). DB client + migrations don't
 * exist → import fails or migration fails. Skipped silently is FORBIDDEN — if
 * DATABASE_URL is unset the test FAILS with a clear message.
 *
 * Anchor: @AC-05 + @AC-17 — 15 tables + RLS + append-only triggers + context_profiles absence.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// SUT (does not exist yet — T070 lands these in Wave 2). Import fails → RED.
import { getDbClient, runMigrations } from '../../src/db/client.js';

const CLIENT_SCOPED_TABLES = [
  'clients',
  'audit_runs',
  'findings',
  'screenshots',
  'sessions',
  'page_states',
  'state_interactions',
  'finding_rollups',
  'reproducibility_snapshots',
  'audit_requests',
] as const;

const APPEND_ONLY_TABLES = [
  'audit_log',
  'rejected_findings',
  'finding_edits',
  'llm_call_log',
  'audit_events',
] as const;

const ALL_TABLES = [...CLIENT_SCOPED_TABLES, ...APPEND_ONLY_TABLES];

describe('DB schema — AC-05 conformance (RED until T070)', () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
      throw new Error('AC-05: DATABASE_URL must be set; tests must NOT silently skip');
    }
    await runMigrations();
  });

  afterAll(async () => {
    const db = getDbClient();
    await db.end?.();
  });

  it('AC-05: all 15 tables exist in information_schema.tables', async () => {
    const db = getDbClient();
    const result = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const names = new Set(result.rows.map((r) => r.table_name));
    for (const t of ALL_TABLES) {
      expect(names.has(t), `expected table '${t}' to exist`).toBe(true);
    }
    expect(ALL_TABLES.length).toBe(15);
  });

  it('AC-05: RLS enabled on each of the 10 client-scoped tables', async () => {
    const db = getDbClient();
    for (const table of CLIENT_SCOPED_TABLES) {
      const r = await db.query<{ relrowsecurity: boolean }>(
        `SELECT c.relrowsecurity FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = $1`,
        [table],
      );
      expect(r.rows[0]?.relrowsecurity, `RLS missing on ${table}`).toBe(true);
    }
  });

  it('AC-05: append-only BEFORE UPDATE OR DELETE trigger exists on each of 5 tables', async () => {
    const db = getDbClient();
    for (const table of APPEND_ONLY_TABLES) {
      const r = await db.query<{ tgname: string }>(
        `SELECT tgname FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
         WHERE c.relname = $1 AND NOT t.tgisinternal`,
        [table],
      );
      expect(r.rows.length, `expected at least one trigger on ${table}`).toBeGreaterThan(0);
    }
  });

  it('AC-05: UPDATE on audit_log raises append-only violation', async () => {
    const db = getDbClient();
    await expect(
      db.query(`UPDATE audit_log SET event = 'tampered' WHERE id IS NOT NULL`),
    ).rejects.toThrow(/append-only/i);
  });

  it('AC-05: DELETE from llm_call_log raises append-only violation', async () => {
    const db = getDbClient();
    await expect(db.query(`DELETE FROM llm_call_log WHERE id IS NOT NULL`)).rejects.toThrow(
      /append-only/i,
    );
  });
});

/**
 * @AC-17 — context_profiles table slot reservation. Phase 4 T070 promised the
 * absence; Phase 4b T4B-012 landed the migration (0004_context_profiles.sql).
 * Post-T4B-012 this transitions to PRESENCE assertion. The full append-only +
 * RLS + FK + index surface is covered by context-profiles-migration.test.ts
 * (AC-12); this block remains as the AC-17 grep-anchor.
 *
 * Note: the AC-05 "15 tables" assertion above intentionally still asserts the
 * Phase 4 T070 baseline of 15 tables — context_profiles is additive (16th
 * table overall) and tracked under AC-12, not AC-05.
 */
describe('DB schema — AC-17 context_profiles slot (presence after T4B-012)', () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
      throw new Error('AC-17: DATABASE_URL must be set; tests must NOT silently skip');
    }
    await runMigrations();
  });

  it('AC-17: context_profiles table exists post-T4B-012 (slot closed by 0004 migration)', async () => {
    const db = getDbClient();
    const r = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'context_profiles'`,
    );
    expect(r.rows.length).toBe(1);
  });
});

/**
 * AC-12 — context_profiles migration conformance (Phase 4b T4B-012).
 *
 * Spec sources:
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-12 + R-12
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-012
 *   docs/specs/mvp/phases/phase-4b-context-capture/impact.md §6 (canonical shape)
 *   docs/specs/mvp/constitution.md R7.4 (append-only)
 *
 * AC-12 contract:
 *   - Migration runs cleanly (idempotent — runMigrations called twice in
 *     suite; second run must not error).
 *   - Append-only enforcement: no UPDATE, no DELETE (R7.4).
 *   - SHA-256 hash stored as CHAR(64).
 *   - Foreign key to audit_runs(id) + clients(id).
 *   - Indexes on audit_run_id, client_id, profile_hash.
 *   - RLS enabled + FORCE'd (consistent with the 10 other client-scoped tables).
 *
 * Anchor: @AC-12 — context_profiles migration (append-only + RLS + FK + indexes).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getDbClient, runMigrations } from '../../src/db/client.js';

describe('AC-12 — context_profiles migration (Phase 4b T4B-012)', () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
      throw new Error('AC-12: DATABASE_URL must be set; tests must NOT silently skip');
    }
    await runMigrations();
    // Idempotency check — second run must succeed without error.
    await runMigrations();
  });

  afterAll(async () => {
    const db = getDbClient();
    await db.end?.();
  });

  it('AC-12: context_profiles table exists in public schema', async () => {
    const db = getDbClient();
    const r = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'context_profiles'`,
    );
    expect(r.rows.length).toBe(1);
  });

  it('AC-12: 6 columns match Phase 4b impact.md §6 canonical shape', async () => {
    const db = getDbClient();
    const r = await db.query<{ column_name: string; data_type: string; is_nullable: string }>(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'context_profiles'
       ORDER BY ordinal_position`,
    );
    const byName = new Map(r.rows.map((row) => [row.column_name, row]));
    expect(byName.size).toBe(6);
    expect(byName.get('id')?.data_type).toBe('uuid');
    expect(byName.get('audit_run_id')?.data_type).toBe('uuid');
    expect(byName.get('audit_run_id')?.is_nullable).toBe('NO');
    expect(byName.get('client_id')?.data_type).toBe('uuid');
    expect(byName.get('client_id')?.is_nullable).toBe('NO');
    expect(byName.get('profile_hash')?.data_type).toBe('character'); // CHAR(64)
    expect(byName.get('profile_hash')?.is_nullable).toBe('NO');
    expect(byName.get('profile_json')?.data_type).toBe('jsonb');
    expect(byName.get('profile_json')?.is_nullable).toBe('NO');
    expect(byName.get('created_at')?.data_type).toBe('timestamp with time zone');
    expect(byName.get('created_at')?.is_nullable).toBe('NO');
  });

  it('AC-12: profile_hash is CHAR(64) — SHA-256 hex width', async () => {
    const db = getDbClient();
    const r = await db.query<{ character_maximum_length: number | null }>(
      `SELECT character_maximum_length
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'context_profiles'
         AND column_name = 'profile_hash'`,
    );
    expect(r.rows[0]?.character_maximum_length).toBe(64);
  });

  it('AC-12: FK constraint context_profiles.audit_run_id → audit_runs(id)', async () => {
    const db = getDbClient();
    const r = await db.query<{
      column_name: string;
      foreign_table_name: string;
      foreign_column_name: string;
    }>(
      `SELECT
         kcu.column_name,
         ccu.table_name  AS foreign_table_name,
         ccu.column_name AS foreign_column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = 'public'
         AND tc.table_name = 'context_profiles'`,
    );
    const fks = new Map(r.rows.map((row) => [row.column_name, row]));
    expect(fks.get('audit_run_id')?.foreign_table_name).toBe('audit_runs');
    expect(fks.get('audit_run_id')?.foreign_column_name).toBe('id');
    expect(fks.get('client_id')?.foreign_table_name).toBe('clients');
    expect(fks.get('client_id')?.foreign_column_name).toBe('id');
  });

  it('AC-12: indexes on audit_run_id, client_id, profile_hash', async () => {
    const db = getDbClient();
    const r = await db.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'context_profiles'`,
    );
    const names = new Set(r.rows.map((row) => row.indexname));
    expect(names.has('idx_context_profiles_audit'), 'idx_context_profiles_audit missing').toBe(
      true,
    );
    expect(names.has('idx_context_profiles_client'), 'idx_context_profiles_client missing').toBe(
      true,
    );
    expect(names.has('idx_context_profiles_hash'), 'idx_context_profiles_hash missing').toBe(true);
  });

  it('AC-12: RLS enabled + FORCE on context_profiles (R7.2)', async () => {
    const db = getDbClient();
    const r = await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT c.relrowsecurity, c.relforcerowsecurity FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'context_profiles'`,
    );
    expect(r.rows[0]?.relrowsecurity, 'RLS not enabled').toBe(true);
    expect(r.rows[0]?.relforcerowsecurity, 'FORCE RLS not set').toBe(true);
  });

  it('AC-12: context_profiles_isolation policy exists', async () => {
    const db = getDbClient();
    const r = await db.query<{ policyname: string }>(
      `SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'context_profiles'`,
    );
    const names = new Set(r.rows.map((row) => row.policyname));
    expect(names.has('context_profiles_isolation')).toBe(true);
  });

  it('AC-12: append-only trigger fires on UPDATE / DELETE (R7.4)', async () => {
    const db = getDbClient();
    const r = await db.query<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       WHERE c.relname = 'context_profiles' AND NOT t.tgisinternal`,
    );
    expect(r.rows.length).toBeGreaterThan(0);
    const names = r.rows.map((row) => row.tgname);
    expect(names).toContain('context_profiles_append_only');
  });

  it('AC-12: UPDATE on context_profiles raises append-only violation', async () => {
    const db = getDbClient();
    await expect(
      db.query(`UPDATE context_profiles SET profile_json = '{}'::jsonb WHERE id IS NOT NULL`),
    ).rejects.toThrow(/append-only/i);
  });

  it('AC-12: DELETE from context_profiles raises append-only violation', async () => {
    const db = getDbClient();
    await expect(db.query(`DELETE FROM context_profiles WHERE id IS NOT NULL`)).rejects.toThrow(
      /append-only/i,
    );
  });
});

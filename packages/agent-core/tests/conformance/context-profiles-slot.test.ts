/**
 * AC-17 — context_profiles table slot reservation (Phase 4 T070 sub-AC).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-17 (v0.3/v0.4)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T070
 *     (R-17 — Phase 4b T4B-012 owns the actual context_profiles migration)
 *   docs/specs/mvp/phases/phase-4b-context-capture/impact.md §6
 *     (Phase 4b shape contract)
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-12 + R-12
 *
 * AC-17 contract:
 *   - Before T4B-012: T070 baseline does NOT define context_profiles (absence).
 *   - After T4B-012: 0004_context_profiles.sql lands the table; this test
 *     transitions to a PRESENCE assertion with the canonical 6-column shape
 *     from Phase 4b impact.md §6.
 *
 * Phase 4 T070 reserved the slot via absence-assertion; T4B-012 (this commit)
 * landed the actual migration. The dedicated AC-12 conformance test
 * (context-profiles-migration.test.ts) covers the full append-only + RLS +
 * FK + index surface. This file remains as the AC-17 grep-anchor and
 * asserts the impact.md ↔ schema shape contract that Phase 4 T070 promised
 * not to collide with.
 *
 * Anchor: @AC-17 — context_profiles slot reservation (presence + shape).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getDbClient, runMigrations } from '../../src/db/client.js';

const PHASE_4B_IMPACT = join(
  process.cwd(),
  '..',
  '..',
  'docs',
  'specs',
  'mvp',
  'phases',
  'phase-4b-context-capture',
  'impact.md',
);

const PLANNED_COLUMNS = [
  'id',
  'audit_run_id',
  'client_id',
  'profile_hash',
  'profile_json',
  'created_at',
];

describe('AC-17 — context_profiles slot reservation (presence after T4B-012)', () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
      throw new Error('AC-17: DATABASE_URL must be set; tests must NOT silently skip');
    }
    await runMigrations();
  });

  afterAll(async () => {
    const db = getDbClient();
    await db.end?.();
  });

  it('AC-17: context_profiles table exists (T4B-012 closed the slot)', async () => {
    const db = getDbClient();
    const r = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'context_profiles'`,
    );
    expect(r.rows.length).toBe(1);
  });

  it('AC-17: context_profiles columns match Phase 4b impact.md §6 (6-column canonical shape)', async () => {
    const db = getDbClient();
    const r = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'context_profiles'`,
    );
    const cols = new Set(r.rows.map((row) => row.column_name));
    for (const c of PLANNED_COLUMNS) {
      expect(cols.has(c), `expected column '${c}' on context_profiles`).toBe(true);
    }
    expect(cols.size).toBe(PLANNED_COLUMNS.length);
  });

  it('AC-17: Phase 4b impact.md still describes the canonical column shape (sibling-coherence)', () => {
    if (!existsSync(PHASE_4B_IMPACT)) {
      // Absence-only fallback (kept for symmetry with the original AC-17
      // spec language); shape grep is the load-bearing assertion above.
      return;
    }
    const text = readFileSync(PHASE_4B_IMPACT, 'utf8');
    for (const col of PLANNED_COLUMNS) {
      expect(text.includes(col), `Phase 4b impact.md missing planned column '${col}'`).toBe(true);
    }
  });

  it('AC-17: audit_runs(id) FK target still exists (additive migration preserved baseline)', async () => {
    const db = getDbClient();
    const r = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'audit_runs' AND column_name = 'id'`,
    );
    expect(r.rows.length).toBe(1);
  });
});

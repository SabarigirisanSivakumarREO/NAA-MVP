/**
 * AC-17 — context_profiles table slot reservation (Phase 4 T070 sub-AC).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-17 (v0.3/v0.4)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T070
 *     (R-17 — Phase 4b T4B-012 owns the actual context_profiles migration)
 *   docs/specs/mvp/phases/phase-4b-context-capture/impact.md §6
 *     (Phase 4b shape contract)
 *
 * AC-17 contract:
 *   - T070 schema baseline does NOT define a `context_profiles` table.
 *   - If Phase 4b impact.md exists at T070 implementation time, the baseline
 *     does NOT collide with the planned column shapes (id, audit_run_id,
 *     client_id, profile_hash, profile_json, created_at).
 *   - Otherwise, fall back to absence-only assertion.
 *
 * This file is the dedicated AC-17 sub-acceptance — db-schema.test.ts also
 * carries an absence assertion. Splitting AC-17 into its own file makes the
 * Phase 4b coordination contract grep-friendly (search for "AC-17").
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). Drizzle schema absent → import
 * fails.
 *
 * Anchor: @AC-17 — context_profiles slot reservation.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// SUT (does not exist yet — T070 lands these in Wave 2). Import fails → RED.
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

describe('AC-17 — context_profiles slot reservation (RED until T070)', () => {
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

  it('AC-17: schema baseline does NOT define a context_profiles table', async () => {
    const db = getDbClient();
    const r = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'context_profiles'`,
    );
    expect(r.rows.length).toBe(0);
  });

  it('AC-17: Phase 4b impact.md describes the planned column shape (sanity check)', () => {
    if (!existsSync(PHASE_4B_IMPACT)) {
      // Absence-only fallback (spec language: "full collision assertion gated
      // on Phase 4b artifact landing").
      return;
    }
    const text = readFileSync(PHASE_4B_IMPACT, 'utf8');
    for (const col of PLANNED_COLUMNS) {
      expect(text.includes(col), `Phase 4b impact.md missing planned column '${col}'`).toBe(true);
    }
  });

  it('AC-17: schema baseline can support adding context_profiles without rewrite (audit_runs FK target exists)', async () => {
    // Phase 4b T4B-012 will reference audit_runs(id). The baseline must
    // expose that target so the future migration is additive.
    const db = getDbClient();
    const r = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'audit_runs' AND column_name = 'id'`,
    );
    expect(r.rows.length).toBe(1);
  });
});

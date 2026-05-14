/**
 * AC-06 — AuditLogger conformance (Phase 4 T071).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-06
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T071
 *     (REQ-OBSERVE-AUDIT-LOG-001)
 *
 * AC-06 contract:
 *   - AuditLogger.log(entry) appends a row to `audit_log` via PostgresStorage.
 *   - UPDATE/DELETE attempts on audit_log fail at DB level (append-only trigger).
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). Modules absent → import fails.
 *
 * Anchor: @AC-06 — append-only audit_log writes via AuditLogger.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditLogger } from '../../src/observability/AuditLogger.js';
import { getDbClient, runMigrations } from '../../src/db/client.js';

// Canonical AC-06 scope. Seeded in beforeAll so FK constraints on audit_log
// (audit_run_id → audit_runs, client_id → clients) are satisfied. Mirrors the
// integration-test seed pattern from tests/integration/phase4.test.ts.
const AC06_AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000300';
const AC06_CLIENT_ID = '00000000-0000-4000-8000-000000000301';

describe('AuditLogger — AC-06 conformance (RED until T071)', () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
      throw new Error('AC-06: DATABASE_URL must be set; tests must NOT silently skip');
    }
    await runMigrations();
    // Seed FK targets via raw client (dev superuser bypasses RLS — same as
    // tests/integration/phase4.test.ts L94-110). Idempotent ON CONFLICT.
    const db = getDbClient();
    await db.query(`INSERT INTO clients (id) VALUES ($1) ON CONFLICT DO NOTHING`, [AC06_CLIENT_ID]);
    await db.query(
      `INSERT INTO audit_runs (id, client_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [AC06_AUDIT_RUN_ID, AC06_CLIENT_ID],
    );
  });

  afterAll(async () => {
    const db = getDbClient();
    await db.end?.();
  });

  it('AC-06: log(entry) appends a row to audit_log', async () => {
    const logger = new AuditLogger();
    await logger.log({
      audit_run_id: AC06_AUDIT_RUN_ID,
      client_id: AC06_CLIENT_ID,
      event: 'phase4_ac06_test_event',
      payload: { hello: 'world' },
    });
    const db = getDbClient();
    const r = await db.query<{ event: string }>(
      `SELECT event FROM audit_log WHERE audit_run_id = $1`,
      [AC06_AUDIT_RUN_ID],
    );
    expect(r.rows.some((row) => row.event === 'phase4_ac06_test_event')).toBe(true);
  });

  it('AC-06: UPDATE on audit_log fails at the DB level (append-only enforced)', async () => {
    const db = getDbClient();
    await expect(
      db.query(`UPDATE audit_log SET event = 'tampered' WHERE event = 'phase4_ac06_test_event'`),
    ).rejects.toThrow(/append-only/i);
  });

  it('AC-06: DELETE from audit_log fails at the DB level', async () => {
    const db = getDbClient();
    await expect(
      db.query(`DELETE FROM audit_log WHERE event = 'phase4_ac06_test_event'`),
    ).rejects.toThrow(/append-only/i);
  });
});

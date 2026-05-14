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

describe('AuditLogger — AC-06 conformance (RED until T071)', () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
      throw new Error('AC-06: DATABASE_URL must be set; tests must NOT silently skip');
    }
    await runMigrations();
  });

  afterAll(async () => {
    const db = getDbClient();
    await db.end?.();
  });

  it('AC-06: log(entry) appends a row to audit_log', async () => {
    const logger = new AuditLogger();
    const auditRunId = '00000000-0000-4000-8000-000000000300';
    const clientId = '00000000-0000-4000-8000-000000000301';
    await logger.log({
      audit_run_id: auditRunId,
      client_id: clientId,
      event: 'phase4_ac06_test_event',
      payload: { hello: 'world' },
    });
    const db = getDbClient();
    const r = await db.query<{ event: string }>(
      `SELECT event FROM audit_log WHERE audit_run_id = $1`,
      [auditRunId],
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

/**
 * AC-07 — SessionRecorder conformance (Phase 4 T072).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-07
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T072 + T-PHASE4-TYPES
 *     (REQ-OBSERVE-SESSION-RECORDER-001)
 *
 * AC-07 contract:
 *   - SessionRecorder.recordEvent(event) writes to `audit_events` (append-only).
 *   - Supports all 22 §34.4 REQ-OBS-012 event types — validated by Zod enum.
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). Modules absent → import fails.
 *
 * Anchor: @AC-07 — 22-type audit_events emitter.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SessionRecorder } from '../../src/observability/SessionRecorder.js';
import { AuditEventTypeEnum } from '../../src/types/audit-events.js';
import { getDbClient, runMigrations } from '../../src/db/client.js';

const ALL_22_EVENT_TYPES = [
  'audit_started',
  'audit_completed',
  'audit_failed',
  'page_browse_started',
  'page_browse_completed',
  'page_browse_failed',
  'page_analyze_started',
  'page_analyze_completed',
  'page_analyze_skipped',
  'finding_produced',
  'finding_grounding_rejected',
  'finding_critique_rejected',
  'finding_published',
  'budget_warning',
  'budget_exceeded',
  'llm_call_completed',
  'llm_call_failed',
  'llm_provider_fallback',
  'perception_quality_low',
  'hitl_requested',
  'cross_page_analysis_completed',
  'overlay_dismissed',
] as const;

// Canonical AC-07 scope. Seeded in beforeAll so the FK on audit_events
// (audit_run_id → audit_runs, client_id → clients) is satisfied for the
// happy-path recordEvent INSERT. Mirrors tests/integration/phase4.test.ts.
const AC07_AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000400';
const AC07_CLIENT_ID = '00000000-0000-4000-8000-000000000401';

describe('SessionRecorder — AC-07 conformance (RED until T072)', () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
      throw new Error('AC-07: DATABASE_URL must be set; tests must NOT silently skip');
    }
    await runMigrations();
    const db = getDbClient();
    await db.query(`INSERT INTO clients (id) VALUES ($1) ON CONFLICT DO NOTHING`, [AC07_CLIENT_ID]);
    await db.query(
      `INSERT INTO audit_runs (id, client_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [AC07_AUDIT_RUN_ID, AC07_CLIENT_ID],
    );
  });

  afterAll(async () => {
    const db = getDbClient();
    await db.end?.();
  });

  it('AC-07: AuditEventTypeEnum accepts each of the 22 canonical event types', () => {
    for (const event_type of ALL_22_EVENT_TYPES) {
      expect(() => AuditEventTypeEnum.parse(event_type)).not.toThrow();
    }
  });

  it('AC-07: AuditEventTypeEnum rejects an unknown event_type', () => {
    expect(() => AuditEventTypeEnum.parse('not_a_real_event_type')).toThrow();
  });

  it('AC-07: SessionRecorder.recordEvent writes one row to audit_events for "audit_started"', async () => {
    const recorder = new SessionRecorder();
    await recorder.recordEvent({
      audit_run_id: AC07_AUDIT_RUN_ID,
      client_id: AC07_CLIENT_ID,
      event_type: 'audit_started',
      page_url: null,
      metadata: {},
    });
    const db = getDbClient();
    const r = await db.query<{ event_type: string }>(
      `SELECT event_type FROM audit_events WHERE audit_run_id = $1`,
      [AC07_AUDIT_RUN_ID],
    );
    expect(r.rows.some((row) => row.event_type === 'audit_started')).toBe(true);
  });

  it('AC-07: recordEvent rejects unknown event_types via Zod parse', async () => {
    const recorder = new SessionRecorder();
    await expect(
      recorder.recordEvent({
        audit_run_id: '00000000-0000-4000-8000-000000000402',
        client_id: '00000000-0000-4000-8000-000000000403',
        event_type: 'unknown_event_type' as never,
        page_url: null,
        metadata: {},
      }),
    ).rejects.toThrow();
  });
});

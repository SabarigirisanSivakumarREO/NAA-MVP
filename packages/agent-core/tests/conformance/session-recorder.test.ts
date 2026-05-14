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
import { AuditEventKindSchema } from '../../src/types/audit-events.js';
import { getDbClient, runMigrations } from '../../src/db/client.js';

const ALL_22_EVENT_KINDS = [
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

describe('SessionRecorder — AC-07 conformance (RED until T072)', () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
      throw new Error('AC-07: DATABASE_URL must be set; tests must NOT silently skip');
    }
    await runMigrations();
  });

  afterAll(async () => {
    const db = getDbClient();
    await db.end?.();
  });

  it('AC-07: AuditEventKindSchema accepts each of the 22 canonical kinds', () => {
    for (const kind of ALL_22_EVENT_KINDS) {
      expect(() => AuditEventKindSchema.parse(kind)).not.toThrow();
    }
  });

  it('AC-07: AuditEventKindSchema rejects an unknown kind', () => {
    expect(() => AuditEventKindSchema.parse('not_a_real_kind')).toThrow();
  });

  it('AC-07: SessionRecorder.recordEvent writes one row to audit_events for "audit_started"', async () => {
    const recorder = new SessionRecorder();
    const auditRunId = '00000000-0000-4000-8000-000000000400';
    await recorder.recordEvent({
      audit_run_id: auditRunId,
      client_id: '00000000-0000-4000-8000-000000000401',
      kind: 'audit_started',
      payload: {},
    });
    const db = getDbClient();
    const r = await db.query<{ kind: string }>(
      `SELECT kind FROM audit_events WHERE audit_run_id = $1`,
      [auditRunId],
    );
    expect(r.rows.some((row) => row.kind === 'audit_started')).toBe(true);
  });

  it('AC-07: recordEvent rejects unknown kinds via Zod parse', async () => {
    const recorder = new SessionRecorder();
    await expect(
      recorder.recordEvent({
        audit_run_id: '00000000-0000-4000-8000-000000000402',
        client_id: '00000000-0000-4000-8000-000000000403',
        kind: 'unknown_kind' as never,
        payload: {},
      }),
    ).rejects.toThrow();
  });
});

// AC-18 — Audit-level wall-clock cap (60-min MVP hardcode)
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-18 v0.4
// REQ-IDs: R-05 + R8.1 (Phase 4b R20 amendment for configurable wiring is v1.1)
// Linked task: T086

import { describe, expect, it, vi } from 'vitest';

import type { StorageAdapter } from '../../src/adapters/StorageAdapter.js';
import { SessionRecorder } from '../../src/observability/SessionRecorder.js';
import { createLogger } from '../../src/observability/logger.js';
import { type AuditStateBrowseSubset } from '../../src/orchestration/AuditState.js';
import { createAuditCompleteNode } from '../../src/orchestration/nodes/AuditCompleteNode.js';

describe('AC-18 — Audit wall-clock timeout (60 min MVP)', () => {
  it('backstop: state with undefined completion_reason + created_at >60min ago → finalizes timeout + audit_failed/wall_clock_timeout', async () => {
    const finalizeAuditRun = vi.fn().mockResolvedValue(undefined);
    const appendAuditEvent = vi.fn().mockResolvedValue(undefined);
    const storage = { finalizeAuditRun, appendAuditEvent } as unknown as StorageAdapter;
    const recorder = new SessionRecorder({ storage, logger: createLogger('t') });
    const now = new Date('2026-05-16T01:01:00Z'); // 61 min past created_at
    const node = createAuditCompleteNode({
      storage,
      recorder,
      logger: createLogger('t'),
      clock: () => now,
    });

    const state: AuditStateBrowseSubset = {
      audit_run_id: '33333333-3333-3333-3333-333333333333',
      client_id: '44444444-4444-4444-4444-444444444444',
      current_node: 'browse',
      node_status: 'running',
      context_profile_id: null,
      context_profile_hash: null,
      pending_questions: [],
      created_at: new Date('2026-05-16T00:00:00Z'),
      updated_at: new Date('2026-05-16T00:30:00Z'),
      urls_remaining: ['https://example.com'],
      budget_remaining_usd: 10,
      business_type: 'unknown',
      page_state_models: [],
      session_confidence: 1.0,
      analysis_cost_usd: 0,
    } as AuditStateBrowseSubset;

    const slice = await node(state);

    expect(finalizeAuditRun).toHaveBeenCalledWith(
      '33333333-3333-3333-3333-333333333333',
      {
        client_id: '44444444-4444-4444-4444-444444444444',
        completion_reason: 'timeout',
      },
    );
    const row = appendAuditEvent.mock.calls[0]![0] as {
      event_type: string;
      metadata: { cause_class: string };
    };
    expect(row.event_type).toBe('audit_failed');
    expect(row.metadata.cause_class).toBe('wall_clock_timeout');
    expect(slice.completion_reason).toBe('timeout');
  });
});

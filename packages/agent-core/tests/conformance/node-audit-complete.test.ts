// AC-05 — audit_complete LangGraph node
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-05 v0.4
// REQ-IDs: REQ-BROWSE-NODE-002 + R-05 + R-06
// Linked task: T086

import { describe, expect, it, vi } from 'vitest';

import type { StorageAdapter } from '../../src/adapters/StorageAdapter.js';
import { SessionRecorder } from '../../src/observability/SessionRecorder.js';
import { createLogger } from '../../src/observability/logger.js';
import { type AuditStateBrowseSubset } from '../../src/orchestration/AuditState.js';
import { createAuditCompleteNode } from '../../src/orchestration/nodes/AuditCompleteNode.js';

function makeState(
  overrides: Partial<AuditStateBrowseSubset> = {},
): AuditStateBrowseSubset {
  return {
    audit_run_id: '11111111-1111-1111-1111-111111111111',
    client_id: '22222222-2222-2222-2222-222222222222',
    current_node: 'browse',
    node_status: 'complete',
    context_profile_id: null,
    context_profile_hash: null,
    pending_questions: [],
    created_at: new Date('2026-05-16T00:00:00Z'),
    updated_at: new Date('2026-05-16T00:00:00Z'),
    urls_remaining: [],
    budget_remaining_usd: 10,
    business_type: 'unknown',
    page_state_models: [],
    session_confidence: 1.0,
    analysis_cost_usd: 0,
    ...overrides,
  } as AuditStateBrowseSubset;
}

function makeStorageStub(): {
  storage: StorageAdapter;
  finalizeAuditRun: ReturnType<typeof vi.fn>;
  appendAuditEvent: ReturnType<typeof vi.fn>;
} {
  const finalizeAuditRun = vi.fn().mockResolvedValue(undefined);
  const appendAuditEvent = vi.fn().mockResolvedValue(undefined);
  const storage = {
    finalizeAuditRun,
    appendAuditEvent,
  } as unknown as StorageAdapter;
  return { storage, finalizeAuditRun, appendAuditEvent };
}

describe('AC-05 — audit_complete node', () => {
  it('completion_reason=success emits audit_completed (no cause_class) + finalizeAuditRun', async () => {
    const { storage, finalizeAuditRun, appendAuditEvent } = makeStorageStub();
    const recorder = new SessionRecorder({ storage, logger: createLogger('t') });
    const node = createAuditCompleteNode({
      storage,
      recorder,
      logger: createLogger('t'),
    });

    const slice = await node(makeState({ completion_reason: 'success' }));

    expect(finalizeAuditRun).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      {
        client_id: '22222222-2222-2222-2222-222222222222',
        completion_reason: 'success',
      },
    );
    expect(appendAuditEvent).toHaveBeenCalledTimes(1);
    const row = appendAuditEvent.mock.calls[0]![0] as {
      event_type: string;
      page_url: unknown;
      metadata: unknown;
    };
    expect(row.event_type).toBe('audit_completed');
    expect(row.page_url).toBeNull();
    expect(row.metadata).toBeUndefined();
    expect(slice.current_node).toBe('audit_complete');
    expect(slice.node_status).toBe('complete');
    expect(slice.completion_reason).toBe('success');
  });

  it('completion_reason=budget_exceeded emits audit_failed + cause_class=budget_exceeded', async () => {
    const { storage, finalizeAuditRun, appendAuditEvent } = makeStorageStub();
    const recorder = new SessionRecorder({ storage, logger: createLogger('t') });
    const node = createAuditCompleteNode({ storage, recorder, logger: createLogger('t') });

    await node(makeState({ completion_reason: 'budget_exceeded' }));

    expect(finalizeAuditRun.mock.calls[0]![1]).toMatchObject({
      completion_reason: 'budget_exceeded',
    });
    const row = appendAuditEvent.mock.calls[0]![0] as {
      event_type: string;
      metadata: { cause_class: string };
    };
    expect(row.event_type).toBe('audit_failed');
    expect(row.metadata.cause_class).toBe('budget_exceeded');
  });

  it('completion_reason=aborted reads cause_class from _phase8_extensions and emits audit_failed', async () => {
    const { storage, appendAuditEvent } = makeStorageStub();
    const recorder = new SessionRecorder({ storage, logger: createLogger('t') });
    const node = createAuditCompleteNode({ storage, recorder, logger: createLogger('t') });

    await node(
      makeState({
        completion_reason: 'aborted',
        _phase8_extensions: { cause_class: 'safety_blocked' },
      }),
    );

    const row = appendAuditEvent.mock.calls[0]![0] as {
      event_type: string;
      metadata: { cause_class: string };
    };
    expect(row.event_type).toBe('audit_failed');
    expect(row.metadata.cause_class).toBe('safety_blocked');
  });

  it('completion_reason=timeout emits audit_failed + cause_class=wall_clock_timeout', async () => {
    const { storage, appendAuditEvent } = makeStorageStub();
    const recorder = new SessionRecorder({ storage, logger: createLogger('t') });
    const node = createAuditCompleteNode({ storage, recorder, logger: createLogger('t') });

    await node(makeState({ completion_reason: 'timeout' }));

    const row = appendAuditEvent.mock.calls[0]![0] as {
      event_type: string;
      metadata: { cause_class: string };
    };
    expect(row.event_type).toBe('audit_failed');
    expect(row.metadata.cause_class).toBe('wall_clock_timeout');
  });
});

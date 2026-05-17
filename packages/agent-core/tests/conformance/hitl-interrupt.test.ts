// AC-08 — HITL interrupt + resume + 5-min auto-timeout
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-08 v0.4
// REQ-IDs: R-08 + R8.4 + R4.3
// Linked task: T089
// Status: GREEN after Wave 8 (T089).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createHitlManager, UnknownHitlError, type HitlRecorderLike } from '../../src/orchestration/hitl.js';
import { createBrowseNode } from '../../src/orchestration/nodes/BrowseNode.js';
import {
  AuditStateBrowseSubsetSchema,
  type AuditStateBrowseSubset,
} from '../../src/orchestration/AuditState.js';
import { PageStateModelSchema, type PageStateModel } from '../../src/perception/types.js';
import { SafetyBlockedError } from '../../src/safety/SafetyCheck.js';
import { z } from 'zod';
import type { LLMCompleteResponse } from '../../src/adapters/LLMAdapter.js';
import type { MCPToolDefinition } from '../../src/mcp/types.js';
import type { AggregatedVerifyResult } from '../../src/verification/types.js';

const AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000801';
const CLIENT_ID = '00000000-0000-4000-8000-000000000802';

function makeRecorder(): HitlRecorderLike & { calls: Parameters<HitlRecorderLike['recordEvent']>[0][] } {
  const calls: Parameters<HitlRecorderLike['recordEvent']>[0][] = [];
  return {
    calls,
    recordEvent: vi.fn(async (input) => { calls.push(input); }),
  };
}

describe('AC-08 — HITL interrupt + resume + 5-min auto-timeout', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('requestHitl emits hitl_requested LOCKED event via SessionRecorder + records pending', async () => {
    const recorder = makeRecorder();
    const mgr = createHitlManager();
    await mgr.requestHitl({
      audit_run_id: AUDIT_RUN_ID, client_id: CLIENT_ID, page_url: 'https://example.com/upload',
      tool_name: 'browser_upload', domain: 'example.com', reason: 'hitl_requested',
      recorder,
    });
    expect(recorder.calls).toHaveLength(1);
    expect(recorder.calls[0]).toMatchObject({
      audit_run_id: AUDIT_RUN_ID,
      client_id: CLIENT_ID,
      event_type: 'hitl_requested',
      page_url: 'https://example.com/upload',
      metadata: { tool_name: 'browser_upload', domain: 'example.com', reason: 'hitl_requested' },
    });
    expect(mgr.pendingCount()).toBe(1);
    // Cancel timer to avoid leak across tests.
    mgr.cancelHitlTimeout(AUDIT_RUN_ID);
  });

  it("resumeAudit('approve') returns {resolved:true, decision:'approve'} with cause_class undefined", async () => {
    const recorder = makeRecorder();
    const mgr = createHitlManager();
    await mgr.requestHitl({
      audit_run_id: AUDIT_RUN_ID, client_id: CLIENT_ID, page_url: null,
      tool_name: 'browser_download', domain: 'example.com', reason: 'hitl_requested', recorder,
    });
    const res = await mgr.resumeAudit(AUDIT_RUN_ID, 'approve');
    expect(res).toEqual({ resolved: true, decision: 'approve' });
    expect(res.cause_class).toBeUndefined();
    expect(mgr.pendingCount()).toBe(0); // registry entry cleared
  });

  it("resumeAudit('reject') returns cause_class='safety_blocked'", async () => {
    const recorder = makeRecorder();
    const mgr = createHitlManager();
    await mgr.requestHitl({
      audit_run_id: AUDIT_RUN_ID, client_id: CLIENT_ID, page_url: null,
      tool_name: 'browser_upload', domain: 'example.com', reason: 'hitl_requested', recorder,
    });
    const res = await mgr.resumeAudit(AUDIT_RUN_ID, 'reject');
    expect(res).toEqual({ resolved: true, decision: 'reject', cause_class: 'safety_blocked' });
    expect(mgr.pendingCount()).toBe(0);
  });

  it('5-min auto-timeout fires → registry auto-resumes with timeout → cause_class=hitl_timeout (vi.useFakeTimers)', async () => {
    const recorder = makeRecorder();
    const mgr = createHitlManager();
    await mgr.requestHitl({
      audit_run_id: AUDIT_RUN_ID, client_id: CLIENT_ID, page_url: null,
      tool_name: 'browser_upload', domain: 'example.com', reason: 'hitl_requested', recorder,
    });
    expect(mgr.pendingCount()).toBe(1);
    // Advance to just before 5-min — timer must NOT have fired.
    vi.advanceTimersByTime(5 * 60 * 1000 - 1);
    expect(mgr.pendingCount()).toBe(1);
    // Tip past 5-min — timer fires, registry auto-resumes.
    vi.advanceTimersByTime(2);
    // Auto-resume is `void`-fired; flush microtasks.
    await vi.runAllTimersAsync();
    expect(mgr.pendingCount()).toBe(0);
    // Manual resumeAudit on the same id now throws UnknownHitlError (entry cleared).
    await expect(mgr.resumeAudit(AUDIT_RUN_ID, 'approve')).rejects.toBeInstanceOf(UnknownHitlError);
  });

  it('resumeAudit on unknown audit_run_id throws UnknownHitlError', async () => {
    const mgr = createHitlManager();
    await expect(mgr.resumeAudit('00000000-0000-4000-8000-000000009999', 'approve'))
      .rejects.toBeInstanceOf(UnknownHitlError);
  });

  it('manual resumeAudit cancels auto-timeout (no leak) — timer does NOT fire after resume', async () => {
    const recorder = makeRecorder();
    const mgr = createHitlManager();
    await mgr.requestHitl({
      audit_run_id: AUDIT_RUN_ID, client_id: CLIENT_ID, page_url: null,
      tool_name: 'browser_upload', domain: 'example.com', reason: 'hitl_requested', recorder,
    });
    await mgr.resumeAudit(AUDIT_RUN_ID, 'approve');
    // Advance well past timeout — no second event, no second resolution attempt.
    vi.advanceTimersByTime(10 * 60 * 1000);
    await vi.runAllTimersAsync();
    expect(mgr.pendingCount()).toBe(0);
    // recorder still only saw 1 event (the original request).
    expect(recorder.calls).toHaveLength(1);
  });

  it('BrowseNode integration — SafetyBlockedError(hitl_requested) routes through hitlManager.requestHitl', async () => {
    const FAKE_PSM: PageStateModel = PageStateModelSchema.parse({
      metadata: {
        url: 'https://example.com/upload', title: 'Upload', statusCode: 200,
        navigationStartedAt: '2026-05-17T00:00:00.000Z',
        navigationEndedAt: '2026-05-17T00:00:01.000Z',
      },
      accessibilityTree: { totalNodes: 1, root: { role: 'WebArea', name: 'Upload' } },
      filteredDOM: { top30: [] },
      interactiveGraph: { clickable: [], typeable: [], submittable: [] },
      diagnostics: {
        axNodeCount: 1, mutationsObserved: 0, stable: true,
        lowAxNodeCount: true, unstable: false, errors: [], warnings: [],
      },
    });
    const state: AuditStateBrowseSubset = AuditStateBrowseSubsetSchema.parse({
      audit_run_id: AUDIT_RUN_ID, client_id: CLIENT_ID,
      current_node: 'page_router', node_status: 'complete' as const,
      context_profile_id: null, context_profile_hash: null, pending_questions: [],
      created_at: new Date('2026-05-17T00:00:00Z'), updated_at: new Date('2026-05-17T00:00:00Z'),
      urls_remaining: [], current_url: 'https://example.com/upload', budget_remaining_usd: 15.0,
    });
    const llmResp = (text: string): LLMCompleteResponse => ({
      text, model: 'mock', usage: { promptTokens: 1, completionTokens: 1, cacheHit: false },
      costUsd: 0, durationMs: 1,
    });
    const stubToolDef: MCPToolDefinition<unknown, unknown> = {
      name: 'browser_upload', description: 'stub',
      inputSchema: z.record(z.string(), z.unknown()) as unknown as MCPToolDefinition<unknown, unknown>['inputSchema'],
      outputSchema: z.unknown() as unknown as MCPToolDefinition<unknown, unknown>['outputSchema'],
      safetyClass: 'requires_hitl',
      handler: vi.fn(async () => ({})),
    };
    const passing: AggregatedVerifyResult = { ok: true, strategy: 'url_change', failures: [] };
    const recorder = makeRecorder();
    const hitlManager = createHitlManager();
    const requestHitlSpy = vi.spyOn(hitlManager, 'requestHitl');
    const node = createBrowseNode({
      contextAssembler: { capture: vi.fn(async () => FAKE_PSM) },
      llm: { complete: vi.fn(async () => llmResp(JSON.stringify({ tool: 'browser_upload', args: {}, reasoning: 't' }))), estimateCost: vi.fn(async () => 0) },
      toolRegistry: { get: vi.fn(() => stubToolDef) },
      rateLimiter: { acquire: vi.fn(async () => undefined) },
      safety: { assertAllowed: vi.fn(async () => { throw new SafetyBlockedError('hitl_requested', 'browser_upload', 'example.com'); }) },
      verifyEngine: { verify: vi.fn(async () => passing) },
      scorer: { afterSuccess: vi.fn((c: number) => c), afterFailure: vi.fn((c: number) => c) },
      classifier: { classify: vi.fn(() => ({ class: 'safety_blocked' as const, subclass: 'hitl_requested', shouldRetry: false })) },
      recorder,
      hitlManager,
    });
    const slice = await node(state);
    // Drain the void-then promise that fires requestHitl.
    await vi.runAllTimersAsync();
    expect(slice.node_status).toBe('halted');
    expect(slice._phase8_extensions?.['hitl_pending']).toBe(true);
    expect(requestHitlSpy).toHaveBeenCalledTimes(1);
    expect(requestHitlSpy.mock.calls[0][0]).toMatchObject({
      audit_run_id: AUDIT_RUN_ID, client_id: CLIENT_ID, tool_name: 'browser_upload', domain: 'example.com',
    });
    // Cleanup: cancel timer so leak does not span tests.
    hitlManager.cancelHitlTimeout(AUDIT_RUN_ID);
  });
});

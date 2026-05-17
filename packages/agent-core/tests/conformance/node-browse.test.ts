// AC-04 — BrowseNode (action selection + verify+route)
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-04 v0.4
// REQ-IDs: REQ-BROWSE-NODE-003 + R-04 + R-06
// Linked tasks: T084 (action selection) + T085 (verify+route)
// Status: GREEN after Wave 4 (T084 + T085).
//
// AC-04 contract:
//   actionSelection — capture PageStateModel via ContextAssembler (R4.1
//     perception-first) BEFORE LLM call; call LLMAdapter operation='other'
//     temp=0.5; Zod-parse ActionProposalSchema; up to 2 corrective retries
//     (operation='classify') on parse failure; ≤3 LLM calls; abort if all
//     fail.
//   verifyAndRoute — SafetyCheck → RateLimiter → ToolRegistry dispatch →
//     VerifyEngine.verify → ConfidenceScorer.afterSuccess|Failure (R4.4
//     multiplicative) → FailureClassifier on failure; emits page_browse_*
//     AuditEvents (AC-17 covered separately).

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createBrowseNode } from '../../src/orchestration/nodes/BrowseNode.js';
import {
  AuditStateBrowseSubsetSchema,
  type AuditStateBrowseSubset,
} from '../../src/orchestration/AuditState.js';
import { PageStateModelSchema, type PageStateModel } from '../../src/perception/types.js';
import { SafetyBlockedError } from '../../src/safety/SafetyCheck.js';
import type { LLMCompleteRequest, LLMCompleteResponse } from '../../src/adapters/LLMAdapter.js';
import type { MCPToolDefinition } from '../../src/mcp/types.js';
import type { AggregatedVerifyResult } from '../../src/verification/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000601';
const CLIENT_ID = '00000000-0000-4000-8000-000000000602';

const FAKE_PSM: PageStateModel = PageStateModelSchema.parse({
  metadata: {
    url: 'https://example.com/page',
    title: 'Example',
    statusCode: 200,
    navigationStartedAt: '2026-05-16T00:00:00.000Z',
    navigationEndedAt: '2026-05-16T00:00:01.000Z',
  },
  accessibilityTree: { totalNodes: 1, root: { role: 'WebArea', name: 'Example' } },
  filteredDOM: { top30: [] },
  interactiveGraph: { clickable: [], typeable: [], submittable: [] },
  diagnostics: {
    axNodeCount: 1,
    mutationsObserved: 0,
    stable: true,
    lowAxNodeCount: true,
    unstable: false,
    errors: [],
    warnings: [],
  },
});

function baseState(overrides: Partial<AuditStateBrowseSubset> = {}): AuditStateBrowseSubset {
  return AuditStateBrowseSubsetSchema.parse({
    audit_run_id: AUDIT_RUN_ID,
    client_id: CLIENT_ID,
    current_node: 'page_router',
    node_status: 'complete' as const,
    context_profile_id: null,
    context_profile_hash: null,
    pending_questions: [],
    created_at: new Date('2026-05-16T00:00:00Z'),
    updated_at: new Date('2026-05-16T00:00:00Z'),
    urls_remaining: [],
    current_url: 'https://example.com/page',
    budget_remaining_usd: 15.0,
    ...overrides,
  });
}

function okProposalText(tool = 'browser_get_state', args: Record<string, unknown> = {}): string {
  return JSON.stringify({ tool, args, reasoning: 'test capture' });
}

function llmResponse(text: string): LLMCompleteResponse {
  return {
    text,
    model: 'mock-claude',
    usage: { promptTokens: 100, completionTokens: 50, cacheHit: false },
    costUsd: 0.001,
    durationMs: 50,
  };
}

function makeStubToolDef(name = 'browser_get_state'): MCPToolDefinition<unknown, unknown> {
  return {
    name,
    description: 'stub',
    inputSchema: z.record(z.string(), z.unknown()) as unknown as MCPToolDefinition<unknown, unknown>['inputSchema'],
    outputSchema: z.unknown() as unknown as MCPToolDefinition<unknown, unknown>['outputSchema'],
    safetyClass: 'safe',
    handler: vi.fn(async () => ({ ok: true })),
  };
}

function passingVerify(): AggregatedVerifyResult {
  return { ok: true, strategy: 'url_change', failures: [] };
}
function failingVerify(): AggregatedVerifyResult {
  return {
    ok: false,
    attemptedStrategies: ['url_change'],
    failures: [{ ok: false, strategy: 'url_change', error: 'no match' }],
  };
}

function makeDeps(over: Partial<Parameters<typeof createBrowseNode>[0]> = {}) {
  const contextAssembler = { capture: vi.fn(async () => FAKE_PSM) };
  const llm = {
    complete: vi.fn(async () => llmResponse(okProposalText())),
    estimateCost: vi.fn(async () => 0),
  };
  const toolRegistry = { get: vi.fn(() => makeStubToolDef()) };
  const rateLimiter = { acquire: vi.fn(async () => undefined) };
  const safety = { assertAllowed: vi.fn(async () => undefined) };
  const verifyEngine = { verify: vi.fn(async () => passingVerify()) };
  const scorer = {
    afterSuccess: vi.fn((c: number) => Math.min(1, c * 1.01)),
    afterFailure: vi.fn((c: number) => c * 0.97),
  };
  const classifier = {
    classify: vi.fn(() => ({ class: 'verify_failed' as const, subclass: 'navigation_did_not_complete', shouldRetry: true })),
  };
  const recorder = { recordEvent: vi.fn(async () => undefined) };
  return {
    contextAssembler, llm, toolRegistry, rateLimiter, safety,
    verifyEngine, scorer, classifier, recorder, ...over,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AC-04 — BrowseNode', () => {
  describe('actionSelection (T084)', () => {
    it('captures PageStateModel BEFORE calling LLMAdapter (R4.1 perception-first)', async () => {
      const callOrder: string[] = [];
      const deps = makeDeps();
      deps.contextAssembler.capture = vi.fn(async () => {
        callOrder.push('capture');
        return FAKE_PSM;
      });
      deps.llm.complete = vi.fn(async () => {
        callOrder.push('llm');
        return llmResponse(okProposalText());
      });
      const node = createBrowseNode(deps);
      await node(baseState());
      expect(callOrder[0]).toBe('capture');
      expect(callOrder[1]).toBe('llm');
    });

    it('invokes LLMAdapter with operation="other" temp=0.5 systemPrompt=BROWSE_AGENT_SYSTEM_PROMPT', async () => {
      const deps = makeDeps();
      const node = createBrowseNode(deps);
      await node(baseState());
      expect(deps.llm.complete).toHaveBeenCalled();
      const req = deps.llm.complete.mock.calls[0][0] as LLMCompleteRequest;
      expect(req.operation).toBe('other');
      expect(req.temperature).toBe(0.5);
      expect(req.systemPrompt).toMatch(/PERCEPTION FIRST/);
      expect(req.audit_run_id).toBe(AUDIT_RUN_ID);
      expect(req.client_id).toBe(CLIENT_ID);
    });

    it('retries with operation="classify" up to 2 times on Zod parse failure, then aborts (≤3 LLM calls)', async () => {
      const deps = makeDeps();
      deps.llm.complete = vi.fn(async () => llmResponse('{"tool": "made_up_tool", "args": {}, "reasoning": "x"}'));
      const node = createBrowseNode(deps);
      const slice = await node(baseState());
      expect(deps.llm.complete).toHaveBeenCalledTimes(3);
      const ops = deps.llm.complete.mock.calls.map((c) => (c[0] as LLMCompleteRequest).operation);
      expect(ops).toEqual(['other', 'classify', 'classify']);
      expect(slice.node_status).toBe('failed');
      expect(slice.completion_reason).toBe('aborted');
    });

    it('produces last_action_proposal in _phase8_extensions on success', async () => {
      const deps = makeDeps();
      const node = createBrowseNode(deps);
      const slice = await node(baseState());
      const ext = slice._phase8_extensions ?? {};
      expect(ext['last_action_proposal']).toEqual({
        tool: 'browser_get_state',
        args: {},
        reasoning: 'test capture',
      });
      expect(ext['browse_loop_iteration']).toBe(1);
    });

    it('R23 STOP — loop_iteration > 5 aborts with audit_failed + cause_class=loop_runaway', async () => {
      const deps = makeDeps();
      const node = createBrowseNode(deps);
      const state = baseState({ _phase8_extensions: { browse_loop_iteration: 5 } });
      const slice = await node(state);
      expect(slice.node_status).toBe('failed');
      expect(slice.completion_reason).toBe('aborted');
      const ext = slice._phase8_extensions ?? {};
      expect(ext['cause_class']).toBe('loop_runaway');
      const auditFailedCall = deps.recorder.recordEvent.mock.calls.find(
        (c) => (c[0] as { event_type: string }).event_type === 'audit_failed',
      );
      expect(auditFailedCall).toBeDefined();
      expect(deps.contextAssembler.capture).not.toHaveBeenCalled();
    });
  });

  describe('verifyAndRoute (T085)', () => {
    it('runs SafetyCheck → RateLimiter → tool dispatch → VerifyEngine in that order', async () => {
      const order: string[] = [];
      const deps = makeDeps();
      deps.safety.assertAllowed = vi.fn(async () => { order.push('safety'); });
      deps.rateLimiter.acquire = vi.fn(async () => { order.push('rate'); });
      const def = makeStubToolDef();
      def.handler = vi.fn(async () => { order.push('tool'); return {}; });
      deps.toolRegistry.get = vi.fn(() => def);
      deps.verifyEngine.verify = vi.fn(async () => { order.push('verify'); return passingVerify(); });
      const node = createBrowseNode(deps);
      await node(baseState());
      expect(order).toEqual(['safety', 'rate', 'tool', 'verify']);
    });

    it('on verify success — calls scorer.afterSuccess (NOT afterFailure) and skips classifier', async () => {
      const deps = makeDeps();
      const node = createBrowseNode(deps);
      const slice = await node(baseState({ session_confidence: 0.8 }));
      expect(deps.scorer.afterSuccess).toHaveBeenCalledWith(0.8);
      expect(deps.scorer.afterFailure).not.toHaveBeenCalled();
      expect(deps.classifier.classify).not.toHaveBeenCalled();
      expect(slice.node_status).toBe('complete');
      expect(slice.session_confidence).toBeCloseTo(0.808, 3);
    });

    it('on verify failure — calls scorer.afterFailure (multiplicative R4.4) AND classifier', async () => {
      const deps = makeDeps();
      deps.verifyEngine.verify = vi.fn(async () => failingVerify());
      const node = createBrowseNode(deps);
      const slice = await node(baseState({ session_confidence: 0.8 }));
      expect(deps.scorer.afterFailure).toHaveBeenCalledWith(0.8);
      expect(deps.classifier.classify).toHaveBeenCalled();
      const ext = slice._phase8_extensions ?? {};
      expect(ext['last_failure_class']).toBe('verify_failed');
      // multiplicative decay 0.8 * 0.97 = 0.776 (NOT additive 0.8 - 0.97)
      expect(slice.session_confidence).toBeCloseTo(0.776, 3);
    });

    it('SafetyBlockedError with reason=hitl_requested → node_status=halted + hitl_pending=true', async () => {
      const deps = makeDeps();
      deps.safety.assertAllowed = vi.fn(async () => {
        throw new SafetyBlockedError('hitl_requested', 'browser_upload', 'example.com');
      });
      const node = createBrowseNode(deps);
      const slice = await node(baseState());
      expect(slice.node_status).toBe('halted');
      const ext = slice._phase8_extensions ?? {};
      expect(ext['hitl_pending']).toBe(true);
      expect(ext['cause_class']).toBe('safety_blocked');
    });

    it('SafetyBlockedError with reason=domain_blocked → aborted + page_browse_failed emitted', async () => {
      const deps = makeDeps();
      deps.safety.assertAllowed = vi.fn(async () => {
        throw new SafetyBlockedError('domain_blocked', 'browser_navigate', 'example.com');
      });
      const node = createBrowseNode(deps);
      const slice = await node(baseState());
      expect(slice.node_status).toBe('failed');
      expect(slice.completion_reason).toBe('aborted');
      // Wait a microtask for the void-then logging
      await new Promise((r) => setTimeout(r, 0));
      const failEvt = deps.recorder.recordEvent.mock.calls.find(
        (c) => (c[0] as { event_type: string }).event_type === 'page_browse_failed',
      );
      expect(failEvt).toBeDefined();
    });

    it('tool not registered (R4.5 exact-name miss) → failure path (NOT kill criterion) with FailureClassifier called', async () => {
      const deps = makeDeps();
      deps.toolRegistry.get = vi.fn(() => undefined);
      const node = createBrowseNode(deps);
      const slice = await node(baseState());
      expect(slice.node_status).toBe('complete');
      expect(deps.classifier.classify).toHaveBeenCalled();
    });
  });
});

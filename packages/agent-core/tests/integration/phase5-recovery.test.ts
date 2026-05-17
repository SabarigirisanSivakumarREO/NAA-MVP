// AC-14 — Integration test: recovery from synthetic verify_failed
//
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-14 v0.4
// REQ-IDs: R-11 + R-07 (FailureClass routing)
// Linked task: T095 (Wave 12 GREEN)
//
// Contract (AC-14 v0.4):
//   Synthetic verify_failed on action 2 of 4 via mocked VerifyEngine returning
//   {ok:false} on first call. FailureClassifier routes to:
//     retry (1x — second attempt on same page) → replan (LLM picks alternate
//     action) → success → audit_complete
//
//   Asserts:
//     - After 1 retry + 1 replan, action 2 alternate succeeds
//     - Remaining actions (3, 4) succeed too
//     - Final completion_reason='success'
//     - AuditEvent stream has 1 page_browse_failed (the attempt that failed) +
//       page_browse_completed events for the eventual successes
//
// Approach (R9 — mocks only; no real Playwright, no real LLM):
//   - 4 URLs queued: navigate → URL1 success → URL2 (verify_failed, retry,
//     replan, success) → URL3 success → URL4 success → agent_complete.
//   - MockLLMAdapter returns scripted actions across browse iterations. The
//     LLM call AFTER the failure returns an ALTERNATE action (different
//     selector) — proving replan rather than re-issue.
//   - MockVerifyEngine returns {ok:false} on its 2nd call (URL2 first attempt)
//     and {ok:true} on all other calls — driving the LOCKED 5-row router
//     into the verify_failed → retry → browse loop exactly once.
//   - MockFailureClassifier returns class='verify_failed', shouldRetry=true
//     on the only failure; routeFromBrowse sees iter(2)<BROWSE_RETRY_CAP(3) →
//     'browse' (retry on same URL) → selectAction runs again → replan succeeds.
//
// NF-Phase5-02 boundary check: BrowseNode.MAX_ITER === 5. The recovery
//   workflow runs at most 3 browse iterations on the failure path (URL1 +
//   URL2 attempt-1 + URL2 attempt-2 replan) before the Bug-B routing defect
//   short-circuits the post-recovery URL3/URL4 traversal — see Bug-B note.
//
// Known integration bugs (do NOT fix; assert observed behavior):
//   - Bug-A (T092 batch A): page_state_models slice from selectAction is
//     silently dropped by the LangGraph state channel. We assert mock CALL
//     COUNTS (contextAssembler.capture, llm.complete, verifyEngine.verify)
//     instead of state.page_state_models.length.
//   - Bug-B (NEW; surfaced by this T095 case; same family as F-015 SPEC_GAP):
//     BrowseNode.success() spreads `state._phase8_extensions` without
//     CLEARING `last_failure_class` from the prior failure iteration. On the
//     successful RETRY iteration, the stale `last_failure_class='verify_failed'`
//     survives — routeFromBrowse re-enters the failure row (`iter < CAP` check
//     is now FALSE since iter has incremented past the cap) and dispatches to
//     `audit_complete` WITHOUT a `completion_reason`. AuditCompleteNode then
//     throws (same F-015 pattern as T093 amazon CAPTCHA test L590-595).
//     This test surfaces Bug-B explicitly via try/catch — when fixed (success
//     slice clears `last_failure_class`), the alternate-scenario branch below
//     asserts the FULLY happy terminal contract (4 successes + 1 retry +
//     completion_reason='success').

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { buildBrowseGraph, type BrowseGraphDeps } from '../../src/orchestration/index.js';
import {
  AuditStateBrowseSubsetSchema,
  type AuditStateBrowseSubset,
} from '../../src/orchestration/AuditState.js';
import { PageStateModelSchema, type PageStateModel } from '../../src/perception/types.js';
import type {
  LLMAdapter,
  LLMCompleteRequest,
  LLMCompleteResponse,
} from '../../src/adapters/LLMAdapter.js';
import type {
  AuditLogInsert,
  AuditRunInsert,
  FindingInsert,
  ReproducibilitySnapshotInsert,
  StorageAdapter,
  StorageTx,
} from '../../src/adapters/StorageAdapter.js';
import type { AuditEvent } from '../../src/types/audit-events.js';
import type { LLMCallRecord } from '../../src/types/llm.js';
import type { FindingRow } from '../../src/db/index.js';
import type { ContextAssembler } from '../../src/perception/ContextAssembler.js';
import type { RateLimiter } from '../../src/browser-runtime/RateLimiter.js';
import type { SafetyCheck } from '../../src/safety/SafetyCheck.js';
import type { DomainPolicy } from '../../src/safety/DomainPolicy.js';
import type { CircuitBreaker } from '../../src/safety/CircuitBreaker.js';
import type { ToolRegistry } from '../../src/mcp/ToolRegistry.js';
import type { MCPToolDefinition } from '../../src/mcp/types.js';
import type { VerifyEngine } from '../../src/verification/VerifyEngine.js';
import type { ConfidenceScorer } from '../../src/verification/ConfidenceScorer.js';
import type { FailureClassifier } from '../../src/verification/FailureClassifier.js';
import type {
  AggregatedVerifyResult,
  FailureClassification,
} from '../../src/verification/types.js';
import type { SessionRecorder } from '../../src/observability/SessionRecorder.js';
import type { HitlManager } from '../../src/orchestration/hitl.js';

// ---------------------------------------------------------------------------
// Fixture — 4-URL workflow; URL #2 fails on first verify attempt, succeeds
// after retry+replan on the second attempt.
// ---------------------------------------------------------------------------

const AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000c14';
const CLIENT_ID = '00000000-0000-4000-8000-000000000c15';
const FIXED_RUN_ID = '00000000-0000-4000-8000-000000000c16';

const WORKFLOW_URLS = [
  'https://shop.example.com/',
  'https://shop.example.com/cart',
  'https://shop.example.com/checkout',
  'https://shop.example.com/confirmation',
] as const;

/**
 * LLM action script. 5 calls expected total because URL2 sees TWO selectAction
 * passes (first attempt verify_failed → routeFromBrowse → 'browse' → second
 * selectAction is the replan):
 *
 *   Call idx 0 → URL1 first action          (browser_navigate)  succeeds
 *   Call idx 1 → URL2 FIRST attempt action  (browser_click on PRIMARY selector) FAILS
 *   Call idx 2 → URL2 REPLAN (alternate)    (browser_click on FALLBACK selector) succeeds
 *   Call idx 3 → URL3                       (browser_type)      succeeds
 *   Call idx 4 → URL4                       (browser_get_state) succeeds
 */
const ACTION_SCRIPT = [
  {
    tool: 'browser_navigate',
    args: { url: WORKFLOW_URLS[0] },
    reasoning: 'URL1: open landing page',
  },
  {
    tool: 'browser_click',
    args: { selector: '#cart-primary-cta' },
    reasoning: 'URL2 attempt 1: click primary cart CTA (will fail verify)',
  },
  {
    tool: 'browser_click',
    args: { selector: '[data-test=cart-fallback-btn]' },
    reasoning: 'URL2 attempt 2 (replan): click fallback selector after retry',
  },
  {
    tool: 'browser_type',
    args: { selector: '#email', text: 'buyer@example.com' },
    reasoning: 'URL3: enter checkout email',
  },
  {
    tool: 'browser_get_state',
    args: {},
    reasoning: 'URL4: verify confirmation page reached',
  },
] as const;

function makePsmFor(url: string): PageStateModel {
  return PageStateModelSchema.parse({
    metadata: {
      url,
      title: `Shop — ${new URL(url).pathname}`,
      statusCode: 200,
      navigationStartedAt: '2026-05-17T00:00:00.000Z',
      navigationEndedAt: '2026-05-17T00:00:01.000Z',
    },
    accessibilityTree: { totalNodes: 18, root: { role: 'WebArea', name: 'Shop' } },
    filteredDOM: { top30: [] },
    interactiveGraph: { clickable: [], typeable: [], submittable: [] },
    diagnostics: {
      axNodeCount: 18,
      mutationsObserved: 0,
      stable: true,
      lowAxNodeCount: false,
      unstable: false,
      errors: [],
      warnings: [],
    },
  });
}

function makeInitialState(): AuditStateBrowseSubset {
  return AuditStateBrowseSubsetSchema.parse({
    audit_run_id: AUDIT_RUN_ID,
    client_id: CLIENT_ID,
    current_node: 'page_router',
    node_status: 'pending' as const,
    context_profile_id: null,
    context_profile_hash: null,
    pending_questions: [],
    // `created_at: new Date()` keeps the 60-min AC-18 wall-clock backstop
    // dormant (matches T093 amazon-test fixture pattern).
    created_at: new Date(),
    updated_at: new Date(),
    urls_remaining: [...WORKFLOW_URLS],
    budget_remaining_usd: 15.0,
  });
}

function llmResponse(text: string): LLMCompleteResponse {
  return {
    text,
    model: 'mock-claude',
    usage: { promptTokens: 110, completionTokens: 35, cacheHit: false },
    costUsd: 0.001,
    durationMs: 5,
  };
}

function makeStubToolDef(name: string): MCPToolDefinition<unknown, unknown> {
  return {
    name,
    description: `mock ${name}`,
    inputSchema: z.record(z.string(), z.unknown()) as unknown as MCPToolDefinition<
      unknown,
      unknown
    >['inputSchema'],
    outputSchema: z.unknown() as unknown as MCPToolDefinition<unknown, unknown>['outputSchema'],
    safetyClass: 'safe',
    handler: vi.fn(async () => ({ ok: true })),
  };
}

function makeFakeStorage(): StorageAdapter {
  return {
    withClient: async <T,>(_clientId: string, fn: (tx: StorageTx) => Promise<T>): Promise<T> => {
      const tx: StorageTx = {
        query: async () => ({ rows: [] }),
        appendAuditLog: async () => undefined,
        appendAuditEvent: async () => undefined,
        appendLLMCallLog: async () => undefined,
      };
      return fn(tx);
    },
    appendAuditLog: async (_e: AuditLogInsert): Promise<void> => undefined,
    appendAuditEvent: async (_e: AuditEvent): Promise<void> => undefined,
    appendLLMCallLog: async (_r: LLMCallRecord): Promise<void> => undefined,
    createAuditRun: async (_e: AuditRunInsert): Promise<string> => FIXED_RUN_ID,
    finalizeAuditRun: async (): Promise<void> => undefined,
    getFindings: async (): Promise<readonly FindingRow[]> => [],
    appendFinding: async (_e: FindingInsert): Promise<string> => 'unused',
    writeReproducibilitySnapshot: async (_e: ReproducibilitySnapshotInsert): Promise<void> =>
      undefined,
  };
}

interface ScriptedDeps {
  readonly deps: BrowseGraphDeps;
  readonly llmCalls: { count: number };
  readonly verifyCalls: { count: number };
  readonly classifyCalls: { count: number };
  readonly recordedEvents: Array<{ event_type: string; metadata: unknown }>;
}

/**
 * Build deps where:
 *   - LLM scripted via ACTION_SCRIPT (5 calls).
 *   - VerifyEngine returns {ok:false} on call #2 (URL2 first attempt); ok on
 *     all others — drives one trip through routeFromBrowse's verify_failed row.
 *   - FailureClassifier returns class='verify_failed', shouldRetry=true on the
 *     only failure (iter==2 < BROWSE_RETRY_CAP==3 → router picks 'browse').
 */
function makeRecoveryDeps(): ScriptedDeps {
  const llmCalls = { count: 0 };
  const verifyCalls = { count: 0 };
  const classifyCalls = { count: 0 };
  const recordedEvents: Array<{ event_type: string; metadata: unknown }> = [];

  const llm: LLMAdapter = {
    complete: vi.fn(async (_req: LLMCompleteRequest) => {
      const idx = Math.min(llmCalls.count, ACTION_SCRIPT.length - 1);
      const action = ACTION_SCRIPT[idx];
      llmCalls.count += 1;
      return llmResponse(JSON.stringify(action));
    }),
    estimateCost: vi.fn(async () => 0),
  };
  const contextAssembler = {
    capture: vi.fn(async (url: string) => makePsmFor(url)),
  } as unknown as ContextAssembler;
  const toolRegistry = {
    get: vi.fn((name: string) => makeStubToolDef(name)),
    list: vi.fn(() => []),
    register: vi.fn(),
    getSafetyClass: vi.fn(() => 'safe' as const),
  } as unknown as ToolRegistry;
  const rateLimiter = { acquire: vi.fn(async () => undefined) } as unknown as RateLimiter;
  const safety = {
    assertAllowed: vi.fn(async () => undefined),
  } as unknown as SafetyCheck;
  // VerifyEngine: 2nd call (URL2 first attempt) returns failure; everything
  // else returns success. Failure shape mirrors AggregatedVerifyResult (R23
  // LOCKED contract from verification/types.ts L155-198).
  const verifyEngine = {
    verify: vi.fn(async (): Promise<AggregatedVerifyResult> => {
      verifyCalls.count += 1;
      if (verifyCalls.count === 2) {
        return {
          ok: false,
          attemptedStrategies: ['element_appears'],
          failures: [
            {
              ok: false,
              strategy: 'element_appears',
              error: 'primary selector did not appear within 10s',
            },
          ],
          reason: 'verify_failed_synthetic',
        };
      }
      return { ok: true, strategy: 'url_change', failures: [] };
    }),
  } as unknown as VerifyEngine;
  const scorer = {
    afterSuccess: vi.fn((c: number) => Math.min(1, c * 1.01)),
    afterFailure: vi.fn((c: number) => c * 0.97),
  } as unknown as ConfidenceScorer;
  const classifier = {
    classify: vi.fn((): FailureClassification => {
      classifyCalls.count += 1;
      return {
        class: 'verify_failed',
        subclass: 'element_did_not_appear',
        shouldRetry: true,
      };
    }),
  } as unknown as FailureClassifier;
  const recorder = {
    recordEvent: vi.fn(async (input: { event_type: string; metadata?: unknown }) => {
      recordedEvents.push({
        event_type: input.event_type,
        metadata: input.metadata ?? null,
      });
    }),
  } as unknown as SessionRecorder;
  const domainPolicy = {
    classify: vi.fn(() => 'unknown' as const),
  } as unknown as DomainPolicy;
  const circuitBreaker = { isOpen: vi.fn(() => false) } as unknown as CircuitBreaker;
  const hitlManager: HitlManager = {
    requestHitl: vi.fn(async () => undefined),
    resumeAudit: vi.fn(async () => ({ resolved: true, decision: 'approve' as const })),
    cancelHitlTimeout: vi.fn(),
    pendingCount: vi.fn(() => 0),
  };

  return {
    deps: {
      llm,
      storage: makeFakeStorage(),
      contextAssembler,
      toolRegistry,
      rateLimiter,
      safety,
      verifyEngine,
      scorer,
      classifier,
      recorder,
      domainPolicy,
      circuitBreaker,
      hitlManager,
    },
    llmCalls,
    verifyCalls,
    classifyCalls,
    recordedEvents,
  };
}

// ---------------------------------------------------------------------------
// AC-14 Test
// ---------------------------------------------------------------------------

describe('AC-14 — Phase 5 recovery integration', () => {
  it('synthetic verify_failed on action 2 of 4: FailureClassifier routes retry (1x) → replan (LLM picks alternate action) → success → audit_complete', async () => {
    const scripted = makeRecoveryDeps();
    const graph = buildBrowseGraph(scripted.deps);
    const initial = makeInitialState();

    // Post Bug-B fix (Wave 8): BrowseNode.success() now clears stale
    // last_failure_class, so routeFromBrowse takes happy path after the retry.
    // Full 5-iteration traversal: URL1 + URL2 attempt 1 (verify_failed) +
    // URL2 attempt 2 REPLAN (success) + URL3 + URL4.
    const final = (await graph.invoke(initial, {
      configurable: { thread_id: 'ac14-recovery' },
    })) as AuditStateBrowseSubset;

    // ----- RECOVERY INVARIANTS — proves verify_failed -> retry -> replan ----
    // 5 browse iterations: 4 URLs + 1 retry on URL2.
    expect(scripted.deps.contextAssembler.capture).toHaveBeenCalledTimes(5);
    expect(scripted.llmCalls.count).toBe(5);
    expect(scripted.verifyCalls.count).toBe(5);

    // Perception ran on URL2 TWICE — R4.1 perception-first applies to every
    // browse iteration including the retry. THE proof of recovery: the retry
    // didn't reuse stale state; it re-perceived and re-prompted. Post Bug-B
    // fix: traversal continues to URL3 + URL4.
    const captureCalls = (scripted.deps.contextAssembler.capture as unknown as {
      mock: { calls: ReadonlyArray<readonly [string]> };
    }).mock.calls.map(([url]) => url);
    expect(captureCalls).toEqual([
      WORKFLOW_URLS[0], // URL1
      WORKFLOW_URLS[1], // URL2 first attempt (verify will fail)
      WORKFLOW_URLS[1], // URL2 second attempt (REPLAN)
      WORKFLOW_URLS[2], // URL3
      WORKFLOW_URLS[3], // URL4
    ]);

    // LLM replan: 3 calls total. The 3rd call (REPLAN on URL2) is the proof
    // that the agent picked an ALTERNATE action — script idx 2 returns the
    // FALLBACK selector `[data-test=cart-fallback-btn]`, distinct from the
    // failed primary selector `#cart-primary-cta` in script idx 1.
    // ToolRegistry.get shows the dispatched tool names per attempt.
    const toolGetCalls = (scripted.deps.toolRegistry.get as unknown as {
      mock: { calls: ReadonlyArray<readonly [string]> };
    }).mock.calls.map(([name]) => name);
    expect(toolGetCalls).toEqual([
      'browser_navigate',  // URL1
      'browser_click',     // URL2 attempt 1 (primary CTA — verify fails)
      'browser_click',     // URL2 attempt 2 (REPLAN — alternate selector)
      'browser_type',      // URL3
      'browser_get_state', // URL4
    ]);

    // FailureClassifier invoked exactly once — on the single verify_failed.
    // shouldRetry=true triggered the routeFromBrowse 'verify_failed' row →
    // returned 'browse' (iter 2 < BROWSE_RETRY_CAP 3) → retry happened.
    expect(scripted.classifyCalls.count).toBe(1);

    // ConfidenceScorer: 4 successes (URL1 + URL2 retry + URL3 + URL4) + 1 failure (URL2
    // attempt 1). R4.4 multiplicative — failure scaled by ~0.97, successes
    // capped at 1.0.
    expect(scripted.deps.scorer.afterSuccess).toHaveBeenCalledTimes(4);
    expect(scripted.deps.scorer.afterFailure).toHaveBeenCalledTimes(1);

    // ----- AuditEvent stream invariants (LOCKED-22) ------------------------
    // 5 page_browse_started (one per browse iteration).
    // 4 page_browse_completed (URL1 + URL2 retry + URL3 + URL4 — all SUCCESS).
    // 1 page_browse_failed (URL2 attempt 1 with failure_class metadata).
    const types = scripted.recordedEvents.map((e) => e.event_type);
    expect(types.filter((t) => t === 'page_browse_started')).toHaveLength(5);
    expect(types.filter((t) => t === 'page_browse_completed')).toHaveLength(4);
    expect(types.filter((t) => t === 'page_browse_failed')).toHaveLength(1);
    expect(types).toContain('audit_started');

    // The single page_browse_failed event carries failure_class='verify_failed'
    // per BrowseNode.failure() (L200). Verifies LOCKED-22 audit-event
    // contract for the recovery row.
    const failedEvent = scripted.recordedEvents.find(
      (e) => e.event_type === 'page_browse_failed',
    );
    expect(failedEvent).toBeDefined();
    expect(failedEvent?.metadata).toMatchObject({
      failure_class: 'verify_failed',
      subclass: 'element_did_not_appear',
    });

    // ----- Happy terminal — Bug-B fix applied (Wave 8) ---------------------
    // BrowseNode.success() now clears stale last_failure_class so the
    // recovery iteration routes cleanly to page_router -> URL3 -> URL4 ->
    // audit_complete.
    expect(final.completion_reason).toBe('success');
    expect(final.current_node).toBe('audit_complete');
    expect(final.urls_remaining).toEqual([]);

    // Full traversal: 5 browse iterations (4 URLs + 1 retry on URL2),
    // landing AT MAX_ITER=5 without tripping iter>5.
    const ext = final._phase8_extensions ?? {};
    expect(ext['browse_loop_iteration']).toBe(5);
    expect(ext['cause_class']).toBeUndefined();
    expect(types).toContain('audit_completed');
    expect(types).not.toContain('audit_failed');

    // Confidence after 4 successes + 1 failure stays above 0.85 floor:
    // 1.0 * 0.97 (failure) * 1.01^4 (successes, clamped <=1.0) ~ 0.97.
    expect(final.session_confidence).toBeGreaterThan(0.85);
    expect(final.session_confidence).toBeLessThanOrEqual(1.0);
  }, 35_000);
});

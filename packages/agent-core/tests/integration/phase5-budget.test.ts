// AC-15 — Integration test: budget exhaustion
//
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-15 v0.4 (L163)
// REQ-IDs: R-11 + R-13 + R8.1
// Linked task: T096 (Wave 12 GREEN — Stage 2 Wave 7 batch B)
//
// Contract (AC-15 v0.4):
//   audit_run with budget_remaining_usd=0.05; LLM calls debit > $0.05 across
//   pages (MockLLMAdapter cost_per_call_usd=0.03; deterministic). The 2nd
//   call exhausts the budget. Audit terminates with completion_reason
//   ='budget_exceeded'. Remaining pages NOT entered. audit_failed event
//   emitted with metadata.cause_class='budget_exceeded'.
//
// SPEC GAP (discovered Wave 7 batch B):
//   BrowseNode (T084/T085 — src/orchestration/nodes/BrowseNode.ts) does NOT
//   debit state.budget_remaining_usd on LLM call completion. The success()
//   slice (L183-193) returns session_confidence + _phase8_extensions, but
//   never writes back budget_remaining_usd. PageRouterNode (T083) IS the
//   gate (L121-128: `if (state.budget_remaining_usd <= 0) terminate
//   'budget_exceeded'`) per R8.1 — but no upstream node ever reduces the
//   counter, so the gate cannot fire from a real LLM-call cost stream alone.
//
//   This is a Wave 4/5 spec gap (T084 brief omitted the debit; T085
//   inherited the omission). Filed as integration-bug post-test; do NOT fix
//   in this task per Wave 7 batch B scope (Master/Wave 8+ owns hardening).
//
//   Workaround per T096 brief: "test pre-seeds reduced budget on iteration
//   2 via state mutation". We do this by running the graph in TWO phases on
//   ONE thread (LangGraph MemorySaver checkpoints retain state, and the
//   second invoke is seeded with a pre-debited budget that the budget gate
//   in PageRouterNode then trips on the 3rd URL pop).
//
// Approach (R9 — mocks only):
//   - 3 URLs queued. budget_remaining_usd=0.06 initial; MockLLMAdapter
//     reports costUsd=0.03 per call AND increments a closure-tracked debit
//     counter (the SUT does not consume costUsd, but the test does — to
//     prove the cost-per-call accounting is observable).
//   - Phase A: graph.invoke() with the initial 3-URL state. BrowseNode does
//     NOT debit budget (spec gap above), so all 3 URLs would complete in a
//     naive single-shot run. We intercept after the first 2 LLM calls by
//     short-circuiting URL #3: shrink urls_remaining to [URL_3] AFTER
//     2 successful pages, then run Phase B with a pre-debited budget=0.
//   - Mechanically: we invoke twice. Phase A runs URL_1 + URL_2 with
//     budget=0.06. Phase B runs URL_3 with budget=0 (simulated post-debit
//     of 0.06 - 2*0.03 = 0); PageRouterNode trips the R8.1 gate
//     immediately on entry, routes audit_complete, AuditCompleteNode emits
//     audit_failed + cause_class='budget_exceeded'.
//   - Assertions cover both phases: 2 LLM calls in Phase A (no 3rd in
//     Phase B), URL_3 contextAssembler.capture NEVER invoked, terminal
//     completion_reason='budget_exceeded', audit_failed emitted with
//     metadata.cause_class='budget_exceeded'.
//
// Known integration bugs accepted (from T092 batch A header):
//   - Bug-A: BrowseNode page_state_models silently dropped — do not assert
//     state.page_state_models.length.

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
// Fixtures
// ---------------------------------------------------------------------------

const AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000c25';
const CLIENT_ID = '00000000-0000-4000-8000-000000000c26';
const FIXED_RUN_ID = '00000000-0000-4000-8000-000000000c27';

const URL_1 = 'https://example.com/page-1';
const URL_2 = 'https://example.com/page-2';
const URL_3 = 'https://example.com/page-3';

/** Deterministic LLM cost per call (matches T096 brief). */
const COST_PER_CALL_USD = 0.03;
/** Initial budget — 2 calls fit (0.06), 3rd would overflow. */
const INITIAL_BUDGET_USD = 0.06;

function makePsmFor(url: string): PageStateModel {
  return PageStateModelSchema.parse({
    metadata: {
      url,
      title: `Mock — ${url}`,
      statusCode: 200,
      navigationStartedAt: '2026-05-17T00:00:00.000Z',
      navigationEndedAt: '2026-05-17T00:00:01.000Z',
    },
    accessibilityTree: { totalNodes: 1, root: { role: 'WebArea', name: 'Mock' } },
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
}

/** Phase A — start with 2 URLs + non-zero budget; both pages browse cleanly. */
function makeInitialStatePhaseA(): AuditStateBrowseSubset {
  return AuditStateBrowseSubsetSchema.parse({
    audit_run_id: AUDIT_RUN_ID,
    client_id: CLIENT_ID,
    current_node: 'page_router',
    node_status: 'pending' as const,
    context_profile_id: null,
    context_profile_hash: null,
    pending_questions: [],
    created_at: new Date('2026-05-17T00:00:00Z'),
    updated_at: new Date('2026-05-17T00:00:00Z'),
    urls_remaining: [URL_1, URL_2],
    budget_remaining_usd: INITIAL_BUDGET_USD,
  });
}

/**
 * Phase B — simulates the "iter 3" state after the spec-gap workaround:
 * URL_3 queued, but budget pre-debited to 0 (representing the cumulative
 * cost of the 2 LLM calls from Phase A: 2 * 0.03 = 0.06; remaining = 0).
 * PageRouterNode's R8.1 gate trips on entry (`<= 0` branch).
 */
function makeInitialStatePhaseB(): AuditStateBrowseSubset {
  return AuditStateBrowseSubsetSchema.parse({
    audit_run_id: AUDIT_RUN_ID,
    client_id: CLIENT_ID,
    current_node: 'page_router',
    node_status: 'pending' as const,
    context_profile_id: null,
    context_profile_hash: null,
    pending_questions: [],
    created_at: new Date('2026-05-17T00:00:00Z'),
    updated_at: new Date('2026-05-17T00:00:02Z'),
    urls_remaining: [URL_3],
    budget_remaining_usd: 0,
  });
}

function agentCompleteText(): string {
  return JSON.stringify({
    tool: 'agent_complete',
    args: { status: 'no_action_needed' },
    reasoning: 'page conveys all needed info; no action required',
  });
}

function llmResponse(text: string, costUsd: number): LLMCompleteResponse {
  return {
    text,
    model: 'mock-claude',
    usage: { promptTokens: 100, completionTokens: 40, cacheHit: false },
    costUsd,
    durationMs: 5,
  };
}

function makeStubToolDef(name: string): MCPToolDefinition<unknown, unknown> {
  return {
    name,
    description: 'stub',
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

interface BudgetTestHarness {
  deps: BrowseGraphDeps;
  /** Cumulative LLM cost as reported by LLMAdapter.costUsd. */
  cumulativeCostUsd: () => number;
  /** URLs passed to ContextAssembler.capture across both phases. */
  capturedUrls: () => readonly string[];
}

function makeDeps(): BudgetTestHarness {
  let totalCost = 0;
  const captured: string[] = [];

  const llm: LLMAdapter = {
    complete: vi.fn(async (_req: LLMCompleteRequest) => {
      totalCost += COST_PER_CALL_USD;
      return llmResponse(agentCompleteText(), COST_PER_CALL_USD);
    }),
    estimateCost: vi.fn(async () => COST_PER_CALL_USD),
  };
  const contextAssembler = {
    capture: vi.fn(async (url: string) => {
      captured.push(url);
      return makePsmFor(url);
    }),
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
  const verifyEngine = {
    verify: vi.fn(
      async (): Promise<AggregatedVerifyResult> => ({
        ok: true,
        strategy: 'url_change',
        failures: [],
      }),
    ),
  } as unknown as VerifyEngine;
  const scorer = {
    afterSuccess: vi.fn((c: number) => Math.min(1, c * 1.01)),
    afterFailure: vi.fn((c: number) => c * 0.97),
  } as unknown as ConfidenceScorer;
  const classifier = {
    classify: vi.fn(
      (): FailureClassification => ({
        class: 'verify_failed',
        subclass: 'unused_in_budget_path',
        shouldRetry: false,
      }),
    ),
  } as unknown as FailureClassifier;
  const recorder = {
    recordEvent: vi.fn(async () => undefined),
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
  const deps: BrowseGraphDeps = {
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
  };
  return {
    deps,
    cumulativeCostUsd: () => totalCost,
    capturedUrls: () => captured,
  };
}

// ---------------------------------------------------------------------------
// AC-15 Test
// ---------------------------------------------------------------------------

describe('AC-15 — Phase 5 budget exhaustion integration (T096)', () => {
  it(
    'budget_remaining_usd=0.06 with 0.03/call: 2 calls fit; on 3rd-page entry the budget gate (R8.1) trips → completion_reason=budget_exceeded; audit_failed emitted with cause_class=budget_exceeded; URL_3 never browsed',
    async () => {
      const harness = makeDeps();
      const { deps } = harness;

      // --- Phase A: 2 URLs under budget --------------------------------------
      // Initial budget 0.06; MockLLM costUsd=0.03. Both pages browse cleanly.
      // Spec-gap acknowledgement: BrowseNode does NOT debit budget, so this
      // run terminates with completion_reason='success' (urls_remaining empty)
      // after 2 LLM calls. The cumulative LLM cost (tracked outside the SUT)
      // is 0.06 — matching the initial budget — but the SUT's
      // budget_remaining_usd is still 0.06 because of the gap.
      const graphA = buildBrowseGraph(deps);
      const finalA = (await graphA.invoke(makeInitialStatePhaseA(), {
        configurable: { thread_id: 'ac15-phase-a' },
      })) as AuditStateBrowseSubset;

      // 2 successful page browses; both URLs captured; 2 LLM calls.
      expect(finalA.completion_reason).toBe('success');
      expect(deps.llm.complete).toHaveBeenCalledTimes(2);
      expect(deps.contextAssembler.capture).toHaveBeenCalledTimes(2);
      expect(harness.capturedUrls()).toEqual([URL_1, URL_2]);
      expect(harness.cumulativeCostUsd()).toBeCloseTo(0.06, 6);

      // --- Phase B: budget exhausted; gate trips on next page ----------------
      // Phase A's 2 calls cost 0.06; simulate the post-debit state by feeding
      // budget=0 to a fresh thread. URL_3 queued. PageRouterNode (T083 L122)
      // sees budget_remaining_usd <= 0 → terminate slice with completion_reason
      // ='budget_exceeded' → routeFromPageRouter → audit_complete →
      // AuditCompleteNode emits audit_failed + metadata.cause_class
      // ='budget_exceeded' (L121-128 of AuditCompleteNode).
      const graphB = buildBrowseGraph(deps);
      const finalB = (await graphB.invoke(makeInitialStatePhaseB(), {
        configurable: { thread_id: 'ac15-phase-b' },
      })) as AuditStateBrowseSubset;

      // ----- Terminal classifier + node --------------------------------------
      expect(finalB.completion_reason).toBe('budget_exceeded');
      expect(finalB.current_node).toBe('audit_complete');

      // ----- URL_3 NEVER browsed (the brief's key assertion) -----------------
      // No additional LLM calls beyond Phase A's 2; no additional perception
      // capture; the URL_3 page_browse_started event is never emitted.
      expect(deps.llm.complete).toHaveBeenCalledTimes(2);
      expect(deps.contextAssembler.capture).toHaveBeenCalledTimes(2);
      expect(harness.capturedUrls()).not.toContain(URL_3);

      // ----- AuditEvent stream — Phase B emits audit_failed/budget_exceeded -
      // Recorder is shared across both phases; collect all events and assert
      // on the Phase B subset (events after Phase A's audit_completed).
      const allEvents = (deps.recorder.recordEvent as unknown as {
        mock: { calls: ReadonlyArray<readonly [AuditEvent]> };
      }).mock.calls.map(([e]) => e);

      // Phase A emissions: audit_started + 2x page_browse_started + 2x
      // page_browse_completed + audit_completed.
      const phaseATypes = allEvents.map((e) => e.event_type);
      expect(phaseATypes.filter((t) => t === 'page_browse_started')).toHaveLength(2);
      expect(phaseATypes.filter((t) => t === 'page_browse_completed')).toHaveLength(2);
      expect(phaseATypes).toContain('audit_started');
      expect(phaseATypes).toContain('audit_completed');

      // Phase B emissions: NO 3rd page_browse_started; audit_failed with
      // cause_class='budget_exceeded' (AC-05 v0.4 branch table row 2).
      // Total page_browse_started count across BOTH phases must remain 2.
      expect(phaseATypes.filter((t) => t === 'page_browse_started')).toHaveLength(2);

      const failedEvents = allEvents.filter((e) => e.event_type === 'audit_failed');
      expect(failedEvents.length).toBeGreaterThanOrEqual(1);
      const budgetExhaustEvent = failedEvents.find((e) => {
        const meta = e.metadata as Record<string, unknown> | undefined;
        return meta?.['cause_class'] === 'budget_exceeded';
      });
      expect(budgetExhaustEvent).toBeDefined();
      // Audit-level event → page_url is null per audit-events contract L96.
      expect(budgetExhaustEvent?.page_url).toBeNull();
    },
    30_000,
  );
});

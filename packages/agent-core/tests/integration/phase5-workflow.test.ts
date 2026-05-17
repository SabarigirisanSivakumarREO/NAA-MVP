// AC-13 — Integration test: 5-action workflow (navigate → click → type → submit → verify)
//
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-13 v0.4
// REQ-IDs: R-11 + R-04
// Linked task: T094 (Wave 12 GREEN)
//
// Contract (AC-13 v0.4):
//   Multi-step workflow against a synthetic Shopify-demo-equivalent /
//   login-form-equivalent fixture: navigate → click → type → submit → verify.
//   All 5 actions pass. Final completion_reason='success'.
//
// Approach (R9 — mocks only; no real Playwright, no real LLM):
//   - 5 URLs queued (one per workflow step) so the page_router → browse
//     cycle fires 5 times. Each browse loop_iteration consumes one URL.
//   - MockLLMAdapter returns 5 DIFFERENT actions across the 5 LLM calls
//     using the EXACT v3.1 tool names from BROWSE_TOOL_NAMES (b165844):
//       1. browser_navigate (go to login page)
//       2. browser_click    (open login form)
//       3. browser_type     (enter credentials)
//       4. browser_click    (submit form)
//       5. browser_get_state (verify dashboard reached)
//   - MockContextAssembler returns a PageStateModel per URL.
//   - MockVerifyEngine returns ok=true for every action.
//   - After action #5: page_router pops empty queue → completion_reason
//     ='success' → routes to audit_complete.
//
// NF-Phase5-02 boundary check: BrowseNode.MAX_ITER === 5 (see
//   src/orchestration/nodes/BrowseNode.ts L65). The 5 browse iterations
//   land exactly AT the cap (iter=1..5; the `iter > MAX_ITER` STOP fires
//   only at iter=6). This test verifies the happy path runs exactly to the
//   limit without tripping the runaway abort.

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
// Workflow fixture — 5 sequential URLs representing a Shopify-equivalent
// login workflow. Each URL is an "action step" in the user journey.
// ---------------------------------------------------------------------------

const AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000c13';
const CLIENT_ID = '00000000-0000-4000-8000-000000000c14';
const FIXED_RUN_ID = '00000000-0000-4000-8000-000000000c15';

const WORKFLOW_URLS = [
  'https://shop.example.com/',
  'https://shop.example.com/account',
  'https://shop.example.com/login',
  'https://shop.example.com/login#submit',
  'https://shop.example.com/account?logged-in=1',
] as const;

/** Exact tool names from BROWSE_TOOL_NAMES (b165844) — 1 per workflow step. */
const WORKFLOW_ACTIONS = [
  { tool: 'browser_navigate', args: { url: WORKFLOW_URLS[1] }, reasoning: 'step 1: navigate to account page' },
  { tool: 'browser_click', args: { selector: '#sign-in-link' }, reasoning: 'step 2: open login form' },
  { tool: 'browser_type', args: { selector: '#email', text: 'user@example.com' }, reasoning: 'step 3: enter credentials' },
  { tool: 'browser_click', args: { selector: 'button[type="submit"]' }, reasoning: 'step 4: submit form' },
  { tool: 'browser_get_state', args: {}, reasoning: 'step 5: verify dashboard reached' },
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
    accessibilityTree: { totalNodes: 12, root: { role: 'WebArea', name: 'Shop' } },
    filteredDOM: { top30: [] },
    interactiveGraph: { clickable: [], typeable: [], submittable: [] },
    diagnostics: {
      axNodeCount: 12,
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
    created_at: new Date('2026-05-17T00:00:00Z'),
    updated_at: new Date('2026-05-17T00:00:00Z'),
    urls_remaining: [...WORKFLOW_URLS],
    budget_remaining_usd: 15.0,
  });
}

function llmResponse(text: string): LLMCompleteResponse {
  return {
    text,
    model: 'mock-claude',
    usage: { promptTokens: 120, completionTokens: 40, cacheHit: false },
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

/** Build deps with action-sequence-aware LLM mock + URL-aware perception. */
function makeDeps(): BrowseGraphDeps {
  let llmCallIndex = 0;
  const llm: LLMAdapter = {
    complete: vi.fn(async (_req: LLMCompleteRequest) => {
      const idx = Math.min(llmCallIndex, WORKFLOW_ACTIONS.length - 1);
      const action = WORKFLOW_ACTIONS[idx];
      llmCallIndex += 1;
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
        subclass: 'unused_in_happy_path',
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
  return {
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
}

// ---------------------------------------------------------------------------
// AC-13 Test
// ---------------------------------------------------------------------------

describe('AC-13 — Phase 5 5-action workflow integration', () => {
  it('multi-step workflow: navigate → click → type → submit → verify; all 5 actions verified; final state captured', async () => {
    const deps = makeDeps();
    const graph = buildBrowseGraph(deps);
    const initial = makeInitialState();

    const final = (await graph.invoke(initial, {
      configurable: { thread_id: 'ac13-workflow' },
    })) as AuditStateBrowseSubset;

    // ----- Terminal-state assertions ---------------------------------------
    expect(final.completion_reason).toBe('success');
    expect(final.current_node).toBe('audit_complete');
    expect(final.urls_remaining).toEqual([]);

    // ----- Iteration / loop-runaway boundary (NF-Phase5-02) ----------------
    // BrowseNode MAX_ITER === 5; 5 actions land EXACTLY at the cap without
    // tripping the iter>5 STOP. Iteration is tracked on _phase8_extensions.
    const ext = final._phase8_extensions ?? {};
    expect(ext['browse_loop_iteration']).toBe(5);
    expect(ext['cause_class']).toBeUndefined(); // no abort path taken

    // ----- 5 iteration assertions (one per workflow step) ------------------
    // Each iteration: 1 perception call + 1 LLM call + 1 tool dispatch +
    // 1 verify call + 1 confidence-success update.
    expect(deps.contextAssembler.capture).toHaveBeenCalledTimes(5);
    expect(deps.llm.complete).toHaveBeenCalledTimes(5);
    expect(deps.verifyEngine.verify).toHaveBeenCalledTimes(5);
    expect(deps.scorer.afterSuccess).toHaveBeenCalledTimes(5);
    expect(deps.scorer.afterFailure).not.toHaveBeenCalled();

    // ContextAssembler.capture invoked with each workflow URL in order.
    const captureCalls = (deps.contextAssembler.capture as unknown as {
      mock: { calls: ReadonlyArray<readonly [string]> };
    }).mock.calls.map(([url]) => url);
    expect(captureCalls).toEqual([...WORKFLOW_URLS]);

    // ToolRegistry.get invoked with the 5 EXACT BROWSE_TOOL_NAMES, in order.
    const toolGetCalls = (deps.toolRegistry.get as unknown as {
      mock: { calls: ReadonlyArray<readonly [string]> };
    }).mock.calls.map(([name]) => name);
    expect(toolGetCalls).toEqual([
      'browser_navigate',
      'browser_click',
      'browser_type',
      'browser_click',
      'browser_get_state',
    ]);

    // PageStateModels accumulated across iterations — post Bug-A fix
    // (Wave 8 BrowseNode merges selectAction's slice with verifyAndRoute's
    // before returning to LangGraph state channel), the 5 captured PSMs
    // now survive on terminal state.
    expect(final.page_state_models).toHaveLength(5);

    // ----- Confidence floor — 5 successes monotonically non-decreasing -----
    expect(final.session_confidence).toBeGreaterThan(0.85);
    expect(final.session_confidence).toBeLessThanOrEqual(1.0);

    // ----- AuditEvent emissions: page_browse_started × 5 + completed × 5 ---
    const recorderCalls = (deps.recorder.recordEvent as unknown as {
      mock: { calls: ReadonlyArray<readonly [AuditEvent]> };
    }).mock.calls.map(([e]) => e.event_type);
    expect(recorderCalls.filter((t) => t === 'page_browse_started')).toHaveLength(5);
    expect(recorderCalls.filter((t) => t === 'page_browse_completed')).toHaveLength(5);
    expect(recorderCalls).toContain('audit_started');
    expect(recorderCalls).toContain('audit_completed');
    expect(recorderCalls).not.toContain('audit_failed'); // no runaway / abort
  }, 30_000);
});

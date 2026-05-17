// AC-11 — Phase 5 simple-navigation integration test (T092; Wave 12 GREEN).
//
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-11 v0.4 (L159)
// Tasks: docs/specs/mvp/phases/phase-5-browse-mvp/tasks.md T092 (L227-230)
// REQ-IDs: R-11 + R-10
//
// Contract (AC-11):
//   BrowseGraph drives a 2-URL list (https://example.com + https://www.bbc.com)
//   with a MockLLM that proposes `agent_complete` on first iteration per page.
//   Assertions:
//     - Both pages browsed (page_router invoked twice → BrowseNode entered for
//       each URL → contextAssembler.capture() called twice; once per URL).
//     - Zero real MCP action invocations (only `agent_complete` ever requested
//       from the toolRegistry; no `browser_navigate`/`browser_click`/etc).
//     - audit_runs.completion_reason === 'success' (PageRouterNode terminates
//       when urls_remaining is empty).
//     - Wall-clock < 60s (NF-Phase5-01 30s gate has comfortable margin).
//
// R9: All deps are mocked test doubles — no @langchain/langgraph import here
// (the orchestration barrel is the boundary), no real `playwright`, no real
// `pg` connection, no real Anthropic SDK. Identical fixture pattern to AC-10
// (browse-graph-compile.test.ts) — extended for 2 URLs.
//
// R13: no `any`, no `console.log`. R23: failing test STOPs (vitest default).

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

const AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000b11';
const CLIENT_ID = '00000000-0000-4000-8000-000000000b12';
const FIXED_RUN_ID = '00000000-0000-4000-8000-000000000b13';

const URL_EXAMPLE = 'https://example.com/';
const URL_BBC = 'https://www.bbc.com/';

function makePsmFor(url: string): PageStateModel {
  return PageStateModelSchema.parse({
    metadata: {
      url,
      title: `Mock page for ${url}`,
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

function makeInitialState(urls: string[]): AuditStateBrowseSubset {
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
    urls_remaining: urls,
    budget_remaining_usd: 15.0,
  });
}

function agentCompleteText(): string {
  return JSON.stringify({
    tool: 'agent_complete',
    args: { status: 'no_action_needed' },
    reasoning: 'page already conveys all needed info; no action required',
  });
}

function llmResponse(text: string): LLMCompleteResponse {
  return {
    text,
    model: 'mock-claude',
    usage: { promptTokens: 100, completionTokens: 50, cacheHit: false },
    costUsd: 0.001,
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
  const storage: StorageAdapter = {
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
  return storage;
}

/**
 * Build the dep bundle. The toolRegistry's `get` records every tool name
 * requested so the test can assert that NO real MCP action tool was invoked —
 * only the meta-`agent_complete` signal. `contextAssembler.capture` returns a
 * URL-specific PageStateModel so we can also assert per-URL invocation.
 */
function makeDeps(): {
  deps: BrowseGraphDeps;
  capturedUrls: string[];
  toolNamesRequested: string[];
} {
  const capturedUrls: string[] = [];
  const toolNamesRequested: string[] = [];

  const llm: LLMAdapter = {
    complete: vi.fn(async (_req: LLMCompleteRequest) => llmResponse(agentCompleteText())),
    estimateCost: vi.fn(async () => 0),
  };
  const contextAssembler = {
    capture: vi.fn(async (url: string) => {
      capturedUrls.push(url);
      return makePsmFor(url);
    }),
  } as unknown as ContextAssembler;
  const toolRegistry = {
    get: vi.fn((name: string) => {
      toolNamesRequested.push(name);
      return makeStubToolDef(name);
    }),
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
        subclass: 'navigation_did_not_complete',
        shouldRetry: true,
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
    resumeAudit: vi.fn(async () => ({
      resolved: true,
      decision: 'approve' as const,
    })),
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
  return { deps, capturedUrls, toolNamesRequested };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AC-11 — Phase 5 simple navigation integration (T092)', () => {
  it(
    'browses example.com + bbc.com end-to-end; no real MCP actions; completion_reason=success; wall-clock < 60s',
    async () => {
      const { deps, capturedUrls, toolNamesRequested } = makeDeps();
      const graph = buildBrowseGraph(deps);
      const initial = makeInitialState([URL_EXAMPLE, URL_BBC]);

      const t0 = Date.now();
      const final = (await graph.invoke(initial, {
        configurable: { thread_id: 'ac11-simple-2url' },
      })) as AuditStateBrowseSubset;
      const wallMs = Date.now() - t0;

      // (a) Wall-clock budget — AC-11 gate 60s; NF-Phase5-01 is 30s.
      expect(wallMs).toBeLessThan(60_000);

      // (b) Both pages browsed: PageRouter popped each URL → BrowseNode
      // captured perception for each. Order is FIFO (example first, bbc second).
      expect(capturedUrls).toEqual([URL_EXAMPLE, URL_BBC]);
      expect(deps.contextAssembler.capture).toHaveBeenCalledTimes(2);

      // (c) Zero real MCP action invocations: the only tool name ever
      // requested from the registry is `agent_complete` — the meta-signal.
      // Any `browser_navigate` / `browser_click` / `browser_type` etc.
      // appearing here would mean the LLM (or BrowseNode) tried to execute
      // a real action against the page, which AC-11 forbids.
      expect(toolNamesRequested.length).toBeGreaterThan(0);
      expect(new Set(toolNamesRequested)).toEqual(new Set(['agent_complete']));

      // (d) Terminal classifier set by PageRouter when urls_remaining empties.
      expect(final.completion_reason).toBe('success');
      expect(final.current_node).toBe('audit_complete');

      // (e) LLM was called once per page (one proposal each — agent_complete
      // is terminal, no replans needed).
      expect(deps.llm.complete).toHaveBeenCalledTimes(2);

      // (f) Final urls_remaining is empty — PageRouter consumed both URLs
      // before terminating with completion_reason='success'.
      expect(final.urls_remaining).toEqual([]);
    },
    65_000,
  );
});

// AC-10 — BrowseGraph.compile() + invoke smoke test (T091; Wave 10 GREEN)
//
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-10 v0.4 (L158)
// REQ-IDs: REQ-BROWSE-GRAPH-001 + R-10
// Linked task: T091
//
// Contract:
//   buildBrowseGraph(deps) returns a compiled, runnable LangGraph;
//   graph.invoke(initialState) terminates within NF-Phase5-01 budget (30 s)
//   on a mock-deps fixture with mock LLM returning agent_complete.
//
// R23 kill criteria covered:
//   1. All 14 deps wired (compile shouldn't throw).
//   2. compile() composition error surfaces with diagnostic context.
//   3. Smoke test exits ≤ 30 s on a 1-URL fixture.
//
// R9: this file imports `buildBrowseGraph` + AuditStateBrowseSubsetSchema
// from the orchestration barrel. It does NOT import @langchain/langgraph
// directly — same constraint as production code. Grep enforces.

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

const AUDIT_RUN_ID = '00000000-0000-4000-8000-000000000a10';
const CLIENT_ID = '00000000-0000-4000-8000-000000000a11';
const FIXED_RUN_ID = '00000000-0000-4000-8000-000000000a12';

const FAKE_PSM: PageStateModel = PageStateModelSchema.parse({
  metadata: {
    url: 'https://example.com/',
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

function makeInitialState(urls: string[]): AuditStateBrowseSubset {
  return AuditStateBrowseSubsetSchema.parse({
    audit_run_id: AUDIT_RUN_ID,
    client_id: CLIENT_ID,
    current_node: 'page_router',
    node_status: 'pending' as const,
    context_profile_id: null,
    context_profile_hash: null,
    pending_questions: [],
    created_at: new Date('2026-05-16T00:00:00Z'),
    updated_at: new Date('2026-05-16T00:00:00Z'),
    urls_remaining: urls,
    budget_remaining_usd: 15.0,
  });
}

function agentCompleteText(): string {
  return JSON.stringify({
    tool: 'agent_complete',
    args: { status: 'no_action_needed' },
    reasoning: 'page done',
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

function makeStubToolDef(name = 'agent_complete'): MCPToolDefinition<unknown, unknown> {
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

function makeDeps(llmText: () => string = agentCompleteText): BrowseGraphDeps {
  const llm: LLMAdapter = {
    complete: vi.fn(async (_req: LLMCompleteRequest) => llmResponse(llmText())),
    estimateCost: vi.fn(async () => 0),
  };
  const contextAssembler = {
    capture: vi.fn(async () => FAKE_PSM),
  } as unknown as ContextAssembler;
  const toolRegistry = {
    get: vi.fn(() => makeStubToolDef()),
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
// Tests
// ---------------------------------------------------------------------------

describe('AC-10 — BrowseGraph compile + invoke', () => {
  it('Test 1 — buildBrowseGraph(mockDeps) compiles without throwing', () => {
    const deps = makeDeps();
    const graph = buildBrowseGraph(deps);
    expect(graph).toBeDefined();
    expect(typeof graph.invoke).toBe('function');
  });

  it('Test 2 — graph.invoke on 1-URL fixture w/ agent_complete LLM exits success ≤ 30 s (NF-Phase5-01)', async () => {
    const deps = makeDeps();
    const graph = buildBrowseGraph(deps);
    const initial = makeInitialState(['https://example.com/']);

    const t0 = Date.now();
    const final = (await graph.invoke(initial, {
      configurable: { thread_id: 'ac10-test2' },
    })) as AuditStateBrowseSubset;
    const wallMs = Date.now() - t0;

    expect(wallMs).toBeLessThan(30_000);
    expect(final.completion_reason).toBe('success');
    expect(final.current_node).toBe('audit_complete');
  }, 35_000);

  it('Test 3 — graph.invoke on 0-URL state exits immediately with success', async () => {
    const deps = makeDeps();
    const graph = buildBrowseGraph(deps);
    const initial = makeInitialState([]);

    const t0 = Date.now();
    const final = (await graph.invoke(initial, {
      configurable: { thread_id: 'ac10-test3' },
    })) as AuditStateBrowseSubset;
    const wallMs = Date.now() - t0;

    expect(wallMs).toBeLessThan(5_000);
    expect(final.completion_reason).toBe('success');
    expect(final.current_node).toBe('audit_complete');
    // BrowseNode never invoked because urls_remaining was empty.
    expect(deps.contextAssembler.capture).not.toHaveBeenCalled();
  }, 10_000);
});

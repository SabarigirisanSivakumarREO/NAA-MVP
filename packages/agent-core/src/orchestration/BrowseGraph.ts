/**
 * BrowseGraph — Phase 5 T091 (AC-10, REQ-BROWSE-GRAPH-001).
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-10 v0.4 (L158)
 *   docs/specs/mvp/phases/phase-5-browse-mvp/tasks.md T091 (L214-223)
 *   docs/specs/mvp/phases/phase-5-browse-mvp/impact.md §"BrowseSubGraph"
 *     (L149-172) — buildBrowseGraph(deps) → CompiledStateGraph
 *
 * SOLE LangGraph runtime boundary (R9 adapter pattern):
 *   This is the ONLY file in `packages/agent-core/src/` that imports from
 *   `@langchain/langgraph`. Nodes/edges/HITL helpers are authored as pure TS
 *   in sibling files; composition happens here. Callers MUST NOT import
 *   @langchain/langgraph themselves. Grep-verified at CI time (Done #5).
 *
 * Graph shape:
 *   START → audit_setup → page_router → (cond)
 *                                       ├→ browse → (cond)
 *                                       │           ├→ page_router (happy)
 *                                       │           ├→ browse      (rate-limited)
 *                                       │           ├→ hitl_pause  (HITL gate)
 *                                       │           └→ audit_complete (terminal)
 *                                       ├→ page_router (drop)
 *                                       └→ audit_complete → END
 *
 *   `hitl_pause` calls LangGraph's `interrupt()` to pause; on resume via
 *   `graph.invoke(Command({resume}))` the decision routes back to browse
 *   (`approve`) or audit_complete (`reject`|`timeout` → completion_reason=aborted).
 *
 * R23 extended kill criteria (tasks.md T091 L216-219):
 *   1. All 14 Phase 1-4+4b+5 contracts injected as deps (R9).
 *   2. .compile() MUST NOT throw at module-load on a fixture deps bundle.
 *      Catch + rethrow with diagnostic context.
 *   3. Compiled graph exits ≤ 30 s (NF-Phase5-01) on 1-URL mock fixture.
 *
 * Constitution: R2 no `any` except at LangGraph channel boundary (eslint-
 *   disabled + TODO documented); R9 sole vendor SDK import; R10.1 ≤ 300 LOC;
 *   R10.2 named exports; R10.3 ≤ 50/fn; R13 no console.log; R14 Pino fields.
 */
import {
  Annotation,
  CompiledStateGraph,
  END,
  MemorySaver,
  START,
  StateGraph,
  interrupt,
} from '@langchain/langgraph';

import type { LLMAdapter } from '../adapters/LLMAdapter.js';
import type { StorageAdapter } from '../adapters/StorageAdapter.js';
import type { ContextAssembler } from '../perception/ContextAssembler.js';
import type { RateLimiter } from '../browser-runtime/RateLimiter.js';
import type { SafetyCheck } from '../safety/SafetyCheck.js';
import type { DomainPolicy } from '../safety/DomainPolicy.js';
import type { CircuitBreaker } from '../safety/CircuitBreaker.js';
import type { ToolRegistry } from '../mcp/ToolRegistry.js';
import type { VerifyEngine } from '../verification/VerifyEngine.js';
import type { ConfidenceScorer } from '../verification/ConfidenceScorer.js';
import type { FailureClassifier } from '../verification/FailureClassifier.js';
import type { SessionRecorder } from '../observability/SessionRecorder.js';
import { createChildLogger, createLogger, type Logger } from '../observability/logger.js';

import { type AuditStateBrowseSubset } from './AuditState.js';
import { routeFromBrowse, routeFromPageRouter } from './edges.js';
import type { HitlManager } from './hitl.js';
import { createAuditSetupNode } from './nodes/AuditSetupNode.js';
import { createPageRouterNode } from './nodes/PageRouterNode.js';
import { createBrowseNode } from './nodes/BrowseNode.js';
import { createAuditCompleteNode } from './nodes/AuditCompleteNode.js';

// ---------------------------------------------------------------------------
// Public deps + types
// ---------------------------------------------------------------------------

/**
 * Aggregate of every Phase 1-4+4b+5 contract the BrowseGraph nodes need.
 * R9: every field is an interface-typed adapter — no vendor SDK. T091 R23 #1.
 */
export interface BrowseGraphDeps {
  readonly llm: LLMAdapter;
  readonly storage: StorageAdapter;
  readonly contextAssembler: ContextAssembler;
  readonly toolRegistry: ToolRegistry;
  readonly rateLimiter: RateLimiter;
  readonly safety: SafetyCheck;
  readonly verifyEngine: VerifyEngine;
  readonly scorer: ConfidenceScorer;
  readonly classifier: FailureClassifier;
  readonly recorder: SessionRecorder;
  readonly domainPolicy: DomainPolicy;
  readonly circuitBreaker: CircuitBreaker;
  readonly hitlManager: HitlManager;
  readonly logger?: Logger;
}

const NODE_AUDIT_SETUP = 'audit_setup' as const;
const NODE_PAGE_ROUTER = 'page_router' as const;
const NODE_BROWSE = 'browse' as const;
const NODE_HITL_PAUSE = 'hitl_pause' as const;
const NODE_AUDIT_COMPLETE = 'audit_complete' as const;

// ---------------------------------------------------------------------------
// State channel
// ---------------------------------------------------------------------------

/**
 * LangGraph state channels. Each field is a `LastValue` reducer (the default
 * `Annotation<T>()` shorthand): node return slices merge via last-writer-
 * wins, matching the Zod-`.partial()` slice semantics every node uses.
 * `page_state_models` is append-only inside BrowseNode itself — no reducer
 * needed at the channel layer.
 *
 * TODO: type this — LangGraph 1.x Annotation<T>() returns a loosely typed
 * channel; per-field types are enforced at the AuditStateBrowseSubset Zod
 * boundary inside each node (R2.2 / AC-06).
 */
type Field<K extends keyof AuditStateBrowseSubset> = AuditStateBrowseSubset[K];
const BrowseStateAnnotation = Annotation.Root({
  audit_run_id: Annotation<Field<'audit_run_id'>>(),
  client_id: Annotation<Field<'client_id'>>(),
  current_node: Annotation<Field<'current_node'>>(),
  node_status: Annotation<Field<'node_status'>>(),
  context_profile_id: Annotation<Field<'context_profile_id'>>(),
  context_profile_hash: Annotation<Field<'context_profile_hash'>>(),
  pending_questions: Annotation<Field<'pending_questions'>>(),
  created_at: Annotation<Field<'created_at'>>(),
  updated_at: Annotation<Field<'updated_at'>>(),
  business_type: Annotation<Field<'business_type'>>(),
  urls_remaining: Annotation<Field<'urls_remaining'>>(),
  current_url: Annotation<Field<'current_url'>>(),
  page_state_models: Annotation<Field<'page_state_models'>>(),
  session_confidence: Annotation<Field<'session_confidence'>>(),
  budget_remaining_usd: Annotation<Field<'budget_remaining_usd'>>(),
  analysis_cost_usd: Annotation<Field<'analysis_cost_usd'>>(),
  completion_reason: Annotation<Field<'completion_reason'>>(),
  _phase8_extensions: Annotation<Field<'_phase8_extensions'>>(),
});

// ---------------------------------------------------------------------------
// HITL pause virtual node
// ---------------------------------------------------------------------------

/** True when BrowseNode.handleSafety set hitl_pending=true on the escape hatch. */
function isHitlPending(state: AuditStateBrowseSubset): boolean {
  const ext = state._phase8_extensions ?? {};
  return ext['hitl_pending'] === true;
}

/**
 * Build the hitl_pause node. The node calls LangGraph's `interrupt()` —
 * when the graph is invoked WITHOUT a `Command({resume})`, this throws
 * `GraphInterrupt` which the runtime catches as the pause signal. On
 * resume, `interrupt()` returns the resume value; we use it to set
 * `completion_reason='aborted'` (reject/timeout) or clear hitl_pending
 * (approve, retry via routeOut → browse). MVP: HITL rejection terminates;
 * v1.1 may resume the action loop on approve.
 */
function createHitlPauseNode(
  logger: Logger,
): (state: AuditStateBrowseSubset) => Partial<AuditStateBrowseSubset> {
  return (state) => {
    const log = createChildLogger(logger, {
      audit_run_id: state.audit_run_id,
      client_id: state.client_id,
      node_name: NODE_HITL_PAUSE,
      subgraph: 'browse',
      loop_iteration: 0,
    });
    log.info('hitl_pause.entry');
    const resumeValue = interrupt<Record<string, string>, 'approve' | 'reject' | 'timeout'>({
      reason: 'hitl_required',
      audit_run_id: state.audit_run_id,
    });
    log.info({ decision: resumeValue }, 'hitl_pause.resumed');
    const ext = state._phase8_extensions ?? {};
    if (resumeValue === 'approve') {
      const { hitl_pending: _hp, ...rest } = ext as Record<string, unknown>;
      return { _phase8_extensions: rest, updated_at: new Date() };
    }
    return {
      completion_reason: 'aborted',
      _phase8_extensions: { ...ext, hitl_decision: resumeValue, cause_class: 'hitl_timeout' },
      updated_at: new Date(),
    };
  };
}

// ---------------------------------------------------------------------------
// Conditional edge wrappers
// ---------------------------------------------------------------------------

/**
 * Wraps `routeFromBrowse` with an HITL precheck. BrowseNode's handleSafety
 * sets `hitl_pending=true` WITHOUT `last_failure_class` (HITL is gated, not
 * failed) — so the LOCKED-5 table doesn't fire. We intercept here to route
 * to `hitl_pause` BEFORE delegating to the pure table-driven router.
 */
function routeFromBrowseWithHitl(
  state: AuditStateBrowseSubset,
): 'browse' | 'page_router' | 'audit_complete' | 'hitl_pause' {
  if (isHitlPending(state)) return NODE_HITL_PAUSE;
  return routeFromBrowse(state);
}

/** Route OUT of hitl_pause: terminal if reason set, else retry browse. */
function hitlPauseRouter(state: AuditStateBrowseSubset): 'browse' | 'audit_complete' {
  if (state.completion_reason !== undefined) return NODE_AUDIT_COMPLETE;
  return NODE_BROWSE;
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Build + compile the BrowseGraph. Returns a runnable for
 * `graph.invoke(initialState, { configurable: { thread_id } })`.
 *
 * R23 #2: `.compile()` is wrapped to surface composition errors with a
 * diagnostic frame (deps keys present) instead of the raw stack trace.
 *
 * TODO: type this — CompiledStateGraph generics widen to `unknown` because
 * AuditStateBrowseSubset is enforced inside each node via Zod, not at the
 * channel boundary. Runtime behaviour respects the typed state; the compile-
 * time generic is LangGraph's own.
 */
/**
 * Build the 5 node functions from the injected deps. Extracted to keep
 * buildBrowseGraph() under R10.3 50-LOC cap and to isolate the dep-wiring
 * shape from the LangGraph composition.
 */
function buildNodes(deps: BrowseGraphDeps, logger: Logger) {
  return {
    auditSetup: createAuditSetupNode({
      storage: deps.storage, recorder: deps.recorder, logger,
    }),
    pageRouter: createPageRouterNode({
      domainPolicy: deps.domainPolicy, circuitBreaker: deps.circuitBreaker, logger,
    }),
    browse: createBrowseNode({
      contextAssembler: deps.contextAssembler, llm: deps.llm,
      toolRegistry: deps.toolRegistry, rateLimiter: deps.rateLimiter,
      safety: deps.safety, verifyEngine: deps.verifyEngine,
      scorer: deps.scorer, classifier: deps.classifier,
      recorder: deps.recorder, hitlManager: deps.hitlManager, logger,
    }),
    auditComplete: createAuditCompleteNode({
      storage: deps.storage, recorder: deps.recorder, logger,
    }),
    hitlPause: createHitlPauseNode(logger),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildBrowseGraph(deps: BrowseGraphDeps): CompiledStateGraph<any, any, any, any, any, any, any> {
  const logger = deps.logger ?? createLogger('browse-graph');
  // Build-time log: no audit_run_id/client_id available yet — graph is
  // composed once at boot/factory time, not per-audit. R14 correlation
  // rule applies to per-audit runtime logs (emitted by nodes); `phase:
  // 'build'` annotation marks this line as factory-time so log consumers
  // can filter.
  const log = createChildLogger(logger, { node_name: 'browse_graph', subgraph: 'browse' });
  log.info({ phase: 'build' }, 'browse_graph.build.start');

  const { auditSetup, pageRouter, browse, auditComplete, hitlPause } = buildNodes(deps, logger);

  // LangGraph's conditional-edge router type is anchored to its own internal
  // StateType; we cast our typed routers via `unknown` to satisfy the
  // framework's loose channel-state typing without weakening our own
  // AuditStateBrowseSubset-bound functions. Runtime state IS the typed shape
  // — Zod-validated inside every node.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const routePageRouter = routeFromPageRouter as unknown as (s: any) => string;
  const routeBrowse = routeFromBrowseWithHitl as unknown as (s: any) => string;
  const routeHitl = hitlPauseRouter as unknown as (s: any) => string;

  const graph = new StateGraph(BrowseStateAnnotation as any)
    .addNode(NODE_AUDIT_SETUP, auditSetup)
    .addNode(NODE_PAGE_ROUTER, pageRouter)
    .addNode(NODE_BROWSE, browse)
    .addNode(NODE_HITL_PAUSE, hitlPause)
    .addNode(NODE_AUDIT_COMPLETE, auditComplete)
    .addEdge(START, NODE_AUDIT_SETUP)
    .addEdge(NODE_AUDIT_SETUP, NODE_PAGE_ROUTER)
    .addConditionalEdges(NODE_PAGE_ROUTER, routePageRouter, {
      browse: NODE_BROWSE,
      page_router: NODE_PAGE_ROUTER,
      audit_complete: NODE_AUDIT_COMPLETE,
    })
    .addConditionalEdges(NODE_BROWSE, routeBrowse, {
      browse: NODE_BROWSE,
      page_router: NODE_PAGE_ROUTER,
      audit_complete: NODE_AUDIT_COMPLETE,
      hitl_pause: NODE_HITL_PAUSE,
    })
    .addConditionalEdges(NODE_HITL_PAUSE, routeHitl, {
      browse: NODE_BROWSE,
      audit_complete: NODE_AUDIT_COMPLETE,
    })
    .addEdge(NODE_AUDIT_COMPLETE, END);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  try {
    const compiled = graph.compile({ checkpointer: new MemorySaver() });
    log.info({ phase: 'build' }, 'browse_graph.build.compiled');
    return compiled;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `buildBrowseGraph: LangGraph .compile() failed — ${msg}. ` +
      `deps keys: ${Object.keys(deps).sort().join(',')}`,
    );
  }
}

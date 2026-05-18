/**
 * AnalysisGraph (Phase 7 T133, AC-21, REQ-ANALYZE-GRAPH-001 + REQ-ANALYZE-EDGE-001..003).
 *
 * 5-node LangGraph state graph composing the Phase 7 analyze pipeline:
 *
 *   START → deep_perceive → evaluate → self_critique → ground → annotate_store → END
 *
 * Routing (per §7.3):
 *   - routeAfterEvaluate: → self_critique | retry_evaluate | end
 *   - routeAfterCritique: → ground | end
 *   - routeAfterGround:   → annotate | end
 *
 * Quality gate (§7.10) is wired as `routeAfterPerceive` between
 * deep_perceive and evaluate; routes to evaluate (proceed), evaluate_tier1
 * (partial — Tier-1 heuristics only), or end (skip with
 * `analysis_status='skipped_perception_quality_low'`).
 *
 * SOLE LangGraph runtime boundary inside `analysis/` (R9 adapter pattern).
 * Node implementations live in sibling files; this file only composes.
 *
 * R2 no `any` except at LangGraph channel boundary (eslint-disabled +
 * TODO documented per BrowseGraph precedent). R10.1 ≤ 300 LOC.
 */
import {
  Annotation,
  END,
  START,
  StateGraph,
  type CompiledStateGraph,
} from '@langchain/langgraph';

import {
  type AnalysisState,
  type AnalysisStatus,
  type RawFinding,
  type CritiqueFinding,
  type GroundedFinding,
  type RejectedFinding,
  type PageSignals,
} from '../orchestration/AnalysisState.js';
import {
  routeAfterEvaluate,
  routeAfterCritique,
  routeAfterGround,
} from './edges.js';
import {
  computePerceptionQuality,
  routeFromQuality,
} from './quality/PerceptionQualityScorer.js';

// ─── Node names (string-literal singletons; reused in tests) ────────────

export const NODE_DEEP_PERCEIVE = 'deep_perceive' as const;
export const NODE_EVALUATE = 'evaluate' as const;
export const NODE_EVALUATE_TIER1 = 'evaluate_tier1' as const;
export const NODE_SELF_CRITIQUE = 'self_critique' as const;
export const NODE_GROUND = 'ground' as const;
export const NODE_ANNOTATE_STORE = 'annotate_store' as const;

export const ANALYSIS_GRAPH_NODES = [
  NODE_DEEP_PERCEIVE,
  NODE_EVALUATE,
  NODE_EVALUATE_TIER1,
  NODE_SELF_CRITIQUE,
  NODE_GROUND,
  NODE_ANNOTATE_STORE,
] as const;

// ─── Deps surface — each node accepts injected dependencies ─────────────

/**
 * AnalysisGraphDeps — every external contract the 5 nodes need. Test
 * harnesses inject mocks; production wires real adapters. Kept opaque
 * (`unknown`) at the graph layer; individual node-wrapper closures
 * cast inside their own scopes. R9: no vendor SDK at graph boundary.
 */
export interface AnalysisGraphDeps {
  readonly deepPerceiveNode: (state: AnalysisState) => Promise<Partial<AnalysisState>>;
  readonly evaluateNode: (state: AnalysisState) => Promise<Partial<AnalysisState>>;
  readonly evaluateTier1Node?: (state: AnalysisState) => Promise<Partial<AnalysisState>>;
  readonly selfCritiqueNode: (state: AnalysisState) => Promise<Partial<AnalysisState>>;
  readonly groundNode: (state: AnalysisState) => Promise<Partial<AnalysisState>>;
  readonly annotateStoreNode: (state: AnalysisState) => Promise<Partial<AnalysisState>>;
}

// ─── State channel (LastValue reducer per BrowseGraph precedent) ────────

// LangGraph 1.x Annotation<T>() returns a loosely typed channel; per-
// field types are enforced at the AnalysisState Zod boundary inside each
// node. (R2.2 / AC-06 same caveat as BrowseGraph.)
type Field<K extends keyof AnalysisState> = AnalysisState[K];

const AnalysisStateAnnotation = Annotation.Root({
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
  // Phase 7 additions
  current_page_perception_bundle:
    Annotation<Field<'current_page_perception_bundle'>>(),
  current_page_type: Annotation<Field<'current_page_type'>>(),
  confidence_tier: Annotation<Field<'confidence_tier'>>(),
  evaluate_findings_raw: Annotation<RawFinding[]>(),
  critique_findings: Annotation<CritiqueFinding[]>(),
  grounded_findings: Annotation<GroundedFinding[]>(),
  rejected_findings: Annotation<RejectedFinding[]>(),
  analysis_status: Annotation<AnalysisStatus>(),
  current_page_signals: Annotation<PageSignals | undefined>(),
});

// ─── Quality-gate routing (§7.10) ───────────────────────────────────────

/**
 * routeAfterPerceive — REQ-ANALYZE-QUALITY-002/003 gate between
 * deep_perceive and evaluate. Reads current_page_perception_bundle →
 * computes 7-signal quality score → routes 'evaluate' (≥0.6) /
 * 'evaluate_tier1' (0.3-0.59) / 'end' (<0.3).
 *
 * Exported so quality-gate-routing.test.ts can exercise it in isolation.
 */
export function routeAfterPerceive(
  state: AnalysisState,
): typeof NODE_EVALUATE | typeof NODE_EVALUATE_TIER1 | typeof END {
  const bundle = state.current_page_perception_bundle;
  if (bundle === undefined) return END;
  // PerceptionBundle wraps the perception; the scorer accepts the
  // AnalyzePerception-shaped envelope. Defensive: unwrap if needed.
  const perception = (bundle as unknown as { perception?: unknown }).perception ?? bundle;
  const score = computePerceptionQuality(perception as never);
  const route = routeFromQuality(score);
  if (route === 'skip') return END;
  if (route === 'partial') return NODE_EVALUATE_TIER1;
  return NODE_EVALUATE;
}

// ─── Graph builder ──────────────────────────────────────────────────────

/**
 * buildAnalysisGraph — compose 5 nodes + 4 routing edges into a
 * CompiledStateGraph. T133 R23 #2: .compile() MUST NOT throw on a
 * fixture deps bundle (caught + rethrown with diagnostic context).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildAnalysisGraph(deps: AnalysisGraphDeps): CompiledStateGraph<any, any, any> {
  const tier1Node = deps.evaluateTier1Node ?? deps.evaluateNode;

  const graph = new StateGraph(AnalysisStateAnnotation)
    .addNode(NODE_DEEP_PERCEIVE, deps.deepPerceiveNode)
    .addNode(NODE_EVALUATE, deps.evaluateNode)
    .addNode(NODE_EVALUATE_TIER1, tier1Node)
    .addNode(NODE_SELF_CRITIQUE, deps.selfCritiqueNode)
    .addNode(NODE_GROUND, deps.groundNode)
    .addNode(NODE_ANNOTATE_STORE, deps.annotateStoreNode)
    .addEdge(START, NODE_DEEP_PERCEIVE)
    .addConditionalEdges(NODE_DEEP_PERCEIVE, routeAfterPerceive, {
      [NODE_EVALUATE]: NODE_EVALUATE,
      [NODE_EVALUATE_TIER1]: NODE_EVALUATE_TIER1,
      [END]: END,
    })
    .addConditionalEdges(NODE_EVALUATE, routeAfterEvaluate, {
      self_critique: NODE_SELF_CRITIQUE,
      retry_evaluate: NODE_EVALUATE,
      end: END,
    })
    .addEdge(NODE_EVALUATE_TIER1, NODE_GROUND)
    .addConditionalEdges(NODE_SELF_CRITIQUE, routeAfterCritique, {
      ground: NODE_GROUND,
      end: END,
    })
    .addConditionalEdges(NODE_GROUND, routeAfterGround, {
      annotate: NODE_ANNOTATE_STORE,
      end: END,
    })
    .addEdge(NODE_ANNOTATE_STORE, END);

  try {
    return graph.compile();
  } catch (err) {
    throw new Error(
      `AnalysisGraph.compile() failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

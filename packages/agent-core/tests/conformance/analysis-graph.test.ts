/**
 * AC-21 — AnalysisGraph (Phase 7 T133, REQ-ANALYZE-GRAPH-001 +
 * REQ-ANALYZE-EDGE-001..003).
 *
 * Asserts 5-step graph compiles + routing functions match §7.3 contract.
 */
import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_GRAPH_NODES,
  buildAnalysisGraph,
  routeAfterPerceive,
  NODE_EVALUATE,
  NODE_EVALUATE_TIER1,
} from '../../src/analysis/AnalysisGraph.js';
import {
  routeAfterEvaluate,
  routeAfterCritique,
  routeAfterGround,
} from '../../src/analysis/edges.js';
import type { AnalysisState } from '../../src/orchestration/AnalysisState.js';
import { END } from '@langchain/langgraph';

const noopNode = async (_: AnalysisState) => ({});

function baseDeps() {
  return {
    deepPerceiveNode: noopNode,
    evaluateNode: noopNode,
    evaluateTier1Node: noopNode,
    selfCritiqueNode: noopNode,
    groundNode: noopNode,
    annotateStoreNode: noopNode,
  };
}

describe('AC-21 AnalysisGraph compile', () => {
  it('compiles without throwing on noop deps', () => {
    const graph = buildAnalysisGraph(baseDeps());
    expect(graph).toBeDefined();
  });

  it('registers 6 nodes (5 pipeline + tier1 partial branch)', () => {
    expect(ANALYSIS_GRAPH_NODES).toEqual([
      'deep_perceive',
      'evaluate',
      'evaluate_tier1',
      'self_critique',
      'ground',
      'annotate_store',
    ]);
  });
});

describe('REQ-ANALYZE-EDGE-001 routeAfterEvaluate', () => {
  it('routes to self_critique when raw findings present', () => {
    const state = { evaluate_findings_raw: [{ heuristic_id: 'H' } as never] } as unknown as AnalysisState;
    expect(routeAfterEvaluate(state)).toBe('self_critique');
  });
  it('routes to end when raw findings empty', () => {
    const state = { evaluate_findings_raw: [] } as unknown as AnalysisState;
    expect(routeAfterEvaluate(state)).toBe('end');
  });
  it('routes to retry_evaluate when status=skipped_llm_output_invalid and retry < 2', () => {
    const state = {
      evaluate_findings_raw: [],
      analysis_status: 'skipped_llm_output_invalid',
      _phase8_extensions: { evaluate_retry_count: 0 },
    } as unknown as AnalysisState;
    expect(routeAfterEvaluate(state)).toBe('retry_evaluate');
  });
  it('routes to end when retry exhausted (≥ 2)', () => {
    const state = {
      evaluate_findings_raw: [],
      analysis_status: 'skipped_llm_output_invalid',
      _phase8_extensions: { evaluate_retry_count: 2 },
    } as unknown as AnalysisState;
    expect(routeAfterEvaluate(state)).toBe('end');
  });
});

describe('REQ-ANALYZE-EDGE-002 routeAfterCritique', () => {
  it('routes to ground when reviewed findings present', () => {
    expect(
      routeAfterCritique({ critique_findings: [{ heuristic_id: 'H' } as never] } as unknown as AnalysisState),
    ).toBe('ground');
  });
  it('routes to end when reviewed findings empty', () => {
    expect(routeAfterCritique({ critique_findings: [] } as unknown as AnalysisState)).toBe('end');
  });
});

describe('REQ-ANALYZE-EDGE-003 routeAfterGround', () => {
  it('routes to annotate when grounded findings present', () => {
    expect(
      routeAfterGround({ grounded_findings: [{ heuristic_id: 'H' } as never] } as unknown as AnalysisState),
    ).toBe('annotate');
  });
  it('routes to end when grounded findings empty', () => {
    expect(routeAfterGround({ grounded_findings: [] } as unknown as AnalysisState)).toBe('end');
  });
});

describe('§7.10 routeAfterPerceive (quality gate)', () => {
  function bundleWithScore(score: 'high' | 'mid' | 'low') {
    const perception =
      score === 'high'
        ? {
            metadata: { url: 'https://x' },
            textContent: { wordCount: 500 },
            ctas: [{}, {}],
            forms: [],
            headingHierarchy: [{ text: 'H1' }],
            navigation: { primaryNavItems: [{}, {}, {}, {}] },
            iframes: [],
            performance: { domContentLoaded: 100, resourceCount: 50 },
          }
        : score === 'mid'
          ? {
              // Mid fixture: content (0.25) + no_overlay (0.15) +
              // no_error (0.15) = 0.55 → partial band [0.3, 0.6).
              metadata: { url: 'https://x' },
              textContent: { wordCount: 500 },
              ctas: [],
              forms: [],
              headingHierarchy: [],
              navigation: { primaryNavItems: [] },
              iframes: [],
              performance: { domContentLoaded: 99999, resourceCount: 0 },
            }
          : {
              metadata: { url: 'https://x' },
              textContent: { wordCount: 0 },
              ctas: [],
              forms: [],
              headingHierarchy: [],
              navigation: { primaryNavItems: [] },
              iframes: [{ purposeGuess: 'cmp' }],
              performance: { domContentLoaded: 99999, resourceCount: 0 },
            };
    return { perception } as unknown as AnalysisState['current_page_perception_bundle'];
  }

  it('high score → evaluate', () => {
    const state = { current_page_perception_bundle: bundleWithScore('high') } as unknown as AnalysisState;
    expect(routeAfterPerceive(state)).toBe(NODE_EVALUATE);
  });
  it('mid score → evaluate_tier1', () => {
    const state = { current_page_perception_bundle: bundleWithScore('mid') } as unknown as AnalysisState;
    expect(routeAfterPerceive(state)).toBe(NODE_EVALUATE_TIER1);
  });
  it('low score → END (skip)', () => {
    const state = { current_page_perception_bundle: bundleWithScore('low') } as unknown as AnalysisState;
    expect(routeAfterPerceive(state)).toBe(END);
  });
});

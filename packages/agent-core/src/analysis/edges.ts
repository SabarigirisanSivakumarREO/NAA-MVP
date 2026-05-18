/**
 * AnalysisGraph routing functions (Phase 7 T133, REQ-ANALYZE-EDGE-001..003).
 *
 * Pure deterministic edges. State field names map to AnalysisState:
 *   - raw_findings        ≡ state.evaluate_findings_raw
 *   - reviewed_findings   ≡ state.critique_findings
 *   - grounded_findings   ≡ state.grounded_findings
 *
 * `evaluate_retry_count` is an OPTIONAL extension field read via the
 * `_phase8_extensions` escape hatch (additive forward-compat per R20).
 */
import type { AnalysisState } from '../orchestration/AnalysisState.js';

const MAX_EVALUATE_RETRIES = 2;

function readRetryCount(state: AnalysisState): number {
  const ext = (state as unknown as { _phase8_extensions?: Record<string, unknown> })
    ._phase8_extensions;
  const v = ext?.evaluate_retry_count;
  return typeof v === 'number' ? v : 0;
}

/**
 * REQ-ANALYZE-EDGE-001 — after evaluate node.
 * Routes: 'self_critique' (happy) | 'retry_evaluate' (malformed) | 'end' (no findings / retry exhausted).
 */
export function routeAfterEvaluate(
  state: AnalysisState,
): 'self_critique' | 'retry_evaluate' | 'end' {
  const raw = state.evaluate_findings_raw;
  if (!Array.isArray(raw)) {
    return readRetryCount(state) < MAX_EVALUATE_RETRIES ? 'retry_evaluate' : 'end';
  }
  if (state.analysis_status === 'skipped_llm_output_invalid') {
    return readRetryCount(state) < MAX_EVALUATE_RETRIES ? 'retry_evaluate' : 'end';
  }
  if (raw.length === 0) return 'end';
  return 'self_critique';
}

/**
 * REQ-ANALYZE-EDGE-002 — after self_critique node.
 * Routes: 'ground' (happy) | 'end' (all rejected/no surviving).
 */
export function routeAfterCritique(state: AnalysisState): 'ground' | 'end' {
  const reviewed = state.critique_findings;
  if (!Array.isArray(reviewed) || reviewed.length === 0) return 'end';
  return 'ground';
}

/**
 * REQ-ANALYZE-EDGE-003 — after ground node.
 * Routes: 'annotate' (happy) | 'end' (zero grounded findings).
 */
export function routeAfterGround(state: AnalysisState): 'annotate' | 'end' {
  const grounded = state.grounded_findings;
  if (!Array.isArray(grounded) || grounded.length === 0) return 'end';
  return 'annotate';
}

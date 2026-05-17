/**
 * Phase 6 heuristics barrel — typed public surface for upstream consumers
 * (Phase 7 DeepPerceiveNode, Phase 9 ReportGenerator, conformance tests).
 *
 * Source: docs/specs/mvp/phases/phase-6-heuristics/tasks.md T111.
 *
 * R10.3: named exports only.
 * R6 (IP boundary): re-exports the TYPED surface only. Does NOT re-export
 * raw heuristic content, body getters, test fixtures, or the decryption
 * shim (callers that need decryption import from adapters/ directly).
 */
export * from './types.js';
export * from './kb.js';
export * from './loader.js';
export {
  filterByBusinessType,
  filterByPageType,
  prioritizeHeuristics,
  type FilterOptions,
} from './filter.js';
export {
  TierValidator,
  TierValidationError,
  DEFAULT_CATEGORY_TIER_MAP,
  type Tier,
  type ClassifyResult,
} from './tier-validator.js';

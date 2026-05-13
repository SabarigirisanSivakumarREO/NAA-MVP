/**
 * Phase 3 verification barrel — public surface of
 * `packages/agent-core/src/verification/`.
 *
 * Consumers per impact.md §Forward Contract:
 *   - Phase 4 SafetyCheck (T066) imports FailureClassifier + FailureClass
 *   - Phase 5 BrowseNode (T081-T091) imports ActionContract, VerifyEngine,
 *     ConfidenceScorer, FailureClassifier
 *
 * Currently re-exports T051 + T052 shared types + T062 VerifyEngine;
 * T063-T065 implementation modules (classifier, scorer) extend this barrel
 * as they land in Wave 4 (R18 append-only).
 */
export * from './types.js';
export { VerifyEngine } from './VerifyEngine.js';
export { FailureClassifier } from './FailureClassifier.js';

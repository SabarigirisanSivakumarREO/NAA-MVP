/**
 * Phase 3 verification barrel — public surface of
 * `packages/agent-core/src/verification/`.
 *
 * Consumers per impact.md §Forward Contract:
 *   - Phase 4 SafetyCheck (T066) imports FailureClassifier + FailureClass
 *   - Phase 5 BrowseNode (T081-T091) imports ActionContract, VerifyEngine,
 *     ConfidenceScorer, FailureClassifier, plus the 3 MVP strategy classes
 *     (UrlChangeStrategy, ElementAppearsStrategy, ElementTextStrategy) to
 *     register against the engine at startup.
 *
 * Stage 2.5 review finding F-01 closure: strategy classes re-exported here
 * so Phase 5 consumers can `import { UrlChangeStrategy, ... } from '@neural/
 * agent-core/verification'` rather than deep-import from `./strategies/*.js`.
 */
export * from './types.js';
export { VerifyEngine } from './VerifyEngine.js';
export { ConfidenceScorer, type ConfidenceScorerConfig } from './ConfidenceScorer.js';
export { FailureClassifier } from './FailureClassifier.js';
export { UrlChangeStrategy } from './strategies/UrlChangeStrategy.js';
export {
  ElementAppearsStrategy,
  type MutationSettleWaiter,
} from './strategies/ElementAppearsStrategy.js';
export { ElementTextStrategy } from './strategies/ElementTextStrategy.js';

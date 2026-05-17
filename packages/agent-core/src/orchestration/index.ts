/**
 * orchestration barrel — Phase 5 T091.
 *
 * Re-exports the BrowseGraph factory + state schema + edge routing primitives
 * + HITL helpers + LOCKED CompletionReason / BusinessType enums. Callers
 * (Phase 8 orchestrator, CLI app, dashboard) import from this barrel; they
 * MUST NOT reach into `@langchain/langgraph` directly — `BrowseGraph.ts` is
 * the sole vendor SDK boundary (R9).
 */
export { buildBrowseGraph } from './BrowseGraph.js';
export type { BrowseGraphDeps } from './BrowseGraph.js';

export {
  AuditStateBrowseSubsetSchema,
  BusinessTypeEnum,
  CompletionReasonEnum,
} from './AuditState.js';
export type {
  AuditStateBrowseSubset,
  BusinessType,
  CompletionReason,
} from './AuditState.js';

export {
  BROWSE_EDGE_CONFIG,
  BROWSE_RETRY_CAP,
  routeFromBrowse,
  routeFromPageRouter,
} from './edges.js';
export type { BrowseDestination, PageRouterDestination } from './edges.js';

export {
  HITLResolutionSchema,
  UnknownHitlError,
  createHitlManager,
} from './hitl.js';
export type {
  HitlManager,
  HitlRecorderLike,
  HitlRequestOptions,
  HITLResolution,
} from './hitl.js';

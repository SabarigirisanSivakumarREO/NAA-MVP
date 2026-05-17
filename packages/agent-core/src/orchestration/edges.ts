/**
 * BrowseGraph conditional edges + routing — Phase 5 T088 (AC-07; REQ-BROWSE-GRAPH-001).
 *
 * CANONICAL AUTHORITY:
 *   spec.md AC-07 v0.4 (L155) + R-07; tasks.md T088 (L186-192); impact.md §"Affected modules" (L83).
 *
 * Pure routing — NO LangGraph runtime import. T091 (BrowseGraph.compile) hands
 * these functions to LangGraph's `addConditionalEdges()`. Keeping routing
 * outside the graph runtime keeps it unit-testable without a StateGraph.
 *
 * Surface:
 *   - Static edge `audit_setup → page_router` (BROWSE_EDGE_CONFIG).
 *   - `routeFromPageRouter(state)` — happy-path after PageRouterNode.
 *   - `routeFromBrowse(state)` — 5-row LOCKED FailureClass table
 *     (verification/types.ts L221-226) + per-page retry cap.
 *
 * FailureClass routing table (5 LOCKED rows — R20 forward-stability):
 *   1. verify_failed       → retry (BROWSE_RETRY_CAP=3 via
 *                            _phase8_extensions.browse_loop_iteration written
 *                            by BrowseNode Wave 4); cap exceeded → escalate.
 *   2. safety_blocked      → audit_complete (completion_reason='aborted').
 *   3. rate_limited        → loop back to browse same iter (Phase 2
 *                            RateLimiter.acquire() is the real gate; if we
 *                            see it here the limiter was bypassed — retry).
 *   4. unverifiable        → page_router (next URL; can't validate this one).
 *   5. bot_detected_likely → audit_complete (completion_reason='aborted').
 *
 * Happy path (no last_failure_class on state):
 *   - PageRouter → browse          IF state.current_url is set.
 *   - PageRouter → audit_complete  IF state.completion_reason is set.
 *   - PageRouter → page_router     drop slice (re-enter on shrunk queue per
 *                                  PageRouterNode L24-25 contract).
 *   - Browse     → page_router     on success (page complete, no fail class).
 *
 * Constitution: R2 no `any`; R9 adapter (zero vendor SDK imports — no
 *   @langchain/langgraph runtime); R10.1 ≤200 LOC; R10.2 named exports;
 *   R10.3 ≤50/fn; R13 no console.log. R23 kill: throw on last_failure_class
 *   outside the LOCKED 5-row enum; retry-cap exceeded always escalates.
 */
import type { FailureClass } from '../verification/types.js';
import type { AuditStateBrowseSubset } from './AuditState.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Per-page retry cap for `verify_failed` (AC-07 row 1: "retry up to 3 times").
 *
 * Distinct from NF-Phase5-02's loop-runaway cap (5) enforced in BrowseNode
 * MAX_ITER — that's the absolute kill switch for any pathological loop; this
 * is the recovery-strategy bound for verify_failed specifically.
 */
export const BROWSE_RETRY_CAP = 3 as const;

/**
 * Static edges for T091 BrowseGraph.compile() — the only edge NOT routed by
 * a conditional function is audit_setup → page_router (always taken after
 * AuditSetupNode succeeds).
 */
export const BROWSE_EDGE_CONFIG = {
  static: [
    { from: 'audit_setup', to: 'page_router' },
  ],
  conditional: {
    page_router: 'routeFromPageRouter',
    browse: 'routeFromBrowse',
  },
} as const;

/** Routing destinations from page_router. */
export type PageRouterDestination = 'browse' | 'audit_complete' | 'page_router';

/** Routing destinations from browse. */
export type BrowseDestination = 'browse' | 'page_router' | 'audit_complete';

/**
 * LOCKED 5-row FailureClass enum (verification/types.ts L221-226). Mirrored
 * here as a Set for runtime validation per R23 kill criterion #1: if a new
 * value appears on the state, the routing function throws rather than
 * silently misrouting.
 */
const KNOWN_FAILURE_CLASSES: ReadonlySet<FailureClass> = new Set<FailureClass>([
  'verify_failed',
  'safety_blocked',
  'rate_limited',
  'unverifiable',
  'bot_detected_likely',
]);

// ---------------------------------------------------------------------------
// Public routing fns
// ---------------------------------------------------------------------------

/**
 * Edge fn after PageRouterNode emits its slice. Reads only the two fields
 * PageRouter sets: `current_url` (URL accepted) and `completion_reason`
 * (terminated). Falls back to looping (`page_router`) on a drop slice — the
 * PageRouterNode contract (L24-25) says "neither (drop) → re-enter
 * page_router on shrunk queue".
 */
export function routeFromPageRouter(
  state: AuditStateBrowseSubset,
): PageRouterDestination {
  if (state.completion_reason !== undefined) {
    return 'audit_complete';
  }
  if (state.current_url !== undefined) {
    return 'browse';
  }
  return 'page_router';
}

/**
 * Edge fn after BrowseNode emits its slice. Branches on
 * `_phase8_extensions.last_failure_class` per the 5-row table.
 *
 * - No failure class present  → page success → page_router (next URL).
 * - completion_reason present → browse already terminated (e.g. abort) →
 *                              audit_complete.
 * - verify_failed             → retry until BROWSE_RETRY_CAP; then escalate.
 * - safety_blocked            → audit_complete.
 * - rate_limited              → browse (no-op transition; see header).
 * - unverifiable              → page_router.
 * - bot_detected_likely       → audit_complete.
 *
 * R23 kill: throws if last_failure_class is set but not in the LOCKED enum.
 */
export function routeFromBrowse(
  state: AuditStateBrowseSubset,
): BrowseDestination {
  // BrowseNode may set completion_reason directly on abort/loop_runaway paths.
  // Honor it first — those are terminal regardless of class.
  if (state.completion_reason !== undefined) {
    return 'audit_complete';
  }

  const ext = state._phase8_extensions ?? {};
  const rawClass = ext['last_failure_class'];

  if (rawClass === undefined) {
    // Happy path: page browse succeeded; loop back for next URL.
    return 'page_router';
  }

  // R23 kill criterion #1 — guard against drift in the LOCKED 5-row enum.
  if (typeof rawClass !== 'string' || !KNOWN_FAILURE_CLASSES.has(rawClass as FailureClass)) {
    throw new Error(
      `edges.routeFromBrowse: unknown last_failure_class=${String(rawClass)}; ` +
      'LOCKED enum is verify_failed | safety_blocked | rate_limited | unverifiable | bot_detected_likely',
    );
  }

  const fc = rawClass as FailureClass;
  const iter = readIter(ext);

  switch (fc) {
    case 'verify_failed':
      // Retry while iteration count ≤ cap; cap exceeded → escalate.
      // The Wave 4 BrowseNode increments browse_loop_iteration BEFORE the
      // attempt, so iter==BROWSE_RETRY_CAP means we've already tried 3 times.
      return iter < BROWSE_RETRY_CAP ? 'browse' : 'audit_complete';
    case 'safety_blocked':
      return 'audit_complete';
    case 'rate_limited':
      // Phase 2 RateLimiter.acquire() should have blocked. Treat as transient
      // retry — DO NOT escalate. Limiter applies real backoff next call.
      return 'browse';
    case 'unverifiable':
      return 'page_router';
    case 'bot_detected_likely':
      return 'audit_complete';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pull browse_loop_iteration off the typed escape hatch. Defaults to 0 when
 * absent (pre-Wave-4 states / never entered browse).
 */
function readIter(ext: Readonly<Record<string, unknown>>): number {
  const raw = ext['browse_loop_iteration'];
  return typeof raw === 'number' ? raw : 0;
}

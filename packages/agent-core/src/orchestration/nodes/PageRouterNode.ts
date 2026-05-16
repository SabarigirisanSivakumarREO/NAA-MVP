/**
 * Phase 5 T083 — PageRouterNode: pure URL routing for the BrowseGraph.
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-03 v0.4 (L151)
 *     + Constraints Inherited §R8.1 (L99, budget) + §R4.3 (L96, policy)
 *     + Edge Cases (L138, CircuitBreaker mid-loop).
 *   tasks.md T083 (L141-147); impact.md §1 (L80).
 *
 * Contract (AC-03):
 *   createPageRouterNode(deps) → (state) ⇒ Promise<Partial<AuditStateBrowseSubset>>
 *
 * Routing decision priority (one decision per call; edges loop back on drops):
 *   1. budget_remaining_usd ≤ 0       → terminate `budget_exceeded` (R8.1)
 *   2. urls_remaining.length === 0    → terminate `success`
 *   3. pop nextUrl
 *   4. domainPolicy.classify === 'blocked' → drop URL, shrink queue (R4.3)
 *      (trusted + unknown both pass; only blocked drops)
 *   5. circuitBreaker.isOpen(hostname) === true → drop URL, shrink queue
 *   6. all gates pass                 → route to browse (current_url = nextUrl)
 *
 * Slice shape signals edges (T088):
 *   - completion_reason present → audit_complete
 *   - current_url present       → browse
 *   - neither (drop)            → re-enter page_router on shrunk queue
 *
 * With `exactOptionalPropertyTypes: true`, we OMIT optional fields rather
 * than assign `undefined`; missing keys = "no update" — exactly the signal
 * edges need.
 *
 * Constitution: R3.1 TDD; R10.1 ≤200 LOC; R10.2 named exports;
 * R10.3 functions ≤50 LOC; R2 no `any`; R9 adapter pattern (zero vendor
 * SDK imports); R14 Pino correlation (audit_run_id, client_id, node_name,
 * subgraph='browse', loop_iteration=0); R23 — schema uses 'complete' (not
 * 'completed' as in T083 brief; brief typo, flagged in commit).
 */
import { CircuitBreaker } from '../../safety/CircuitBreaker.js';
import { DomainPolicy } from '../../safety/DomainPolicy.js';
import { createLogger, type Logger } from '../../observability/logger.js';
import {
  AuditStateBrowseSubsetSchema,
  type AuditStateBrowseSubset,
} from '../AuditState.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Dependencies — all DI seams; no concrete IO beyond these adapters. */
export interface PageRouterNodeDeps {
  readonly domainPolicy: DomainPolicy;
  readonly circuitBreaker: CircuitBreaker;
  /** Optional logger override (defaults to createLogger('page-router-node')). */
  readonly logger?: Logger;
}

/** Node fn signature — LangGraph merges the partial slice into state. */
export type PageRouterNodeFn = (
  state: AuditStateBrowseSubset,
) => Promise<Partial<AuditStateBrowseSubset>>;

const NODE_NAME = 'page_router';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build a PageRouterNode bound to the given safety adapters. Returns a pure
 * async function suitable for LangGraph node registration.
 */
export function createPageRouterNode(deps: PageRouterNodeDeps): PageRouterNodeFn {
  const rootLogger = deps.logger ?? createLogger('page-router-node');

  return async function pageRouter(state) {
    const child = rootLogger.child({
      audit_run_id: state.audit_run_id,
      client_id: state.client_id,
      node_name: NODE_NAME,
      subgraph: 'browse',
      loop_iteration: 0,
    });

    child.debug(
      {
        urls_remaining_count: state.urls_remaining.length,
        budget_remaining_usd: state.budget_remaining_usd,
      },
      'page_router.entry',
    );

    const slice = decideRoute(state, deps, child);
    // R2.2 — runtime invariant check. We discard the parser's return type
    // because Zod `.partial().parse()` types optionals as `T | undefined`,
    // which is narrower than `Partial<...>` (`?: T`) under
    // `exactOptionalPropertyTypes: true`. The typed builders below are the
    // type source; `.parse()` is the runtime gate.
    AuditStateBrowseSubsetSchema.partial().parse(slice);

    child.debug({ slice_keys: Object.keys(slice) }, 'page_router.exit');
    return slice;
  };
}

// ---------------------------------------------------------------------------
// Routing core
// ---------------------------------------------------------------------------

/**
 * Pure routing decision. ≤ 50 LOC body per R10.3.
 */
function decideRoute(
  state: AuditStateBrowseSubset,
  deps: PageRouterNodeDeps,
  log: Logger,
): Partial<AuditStateBrowseSubset> {
  // (1) Budget gate (R8.1).
  if (state.budget_remaining_usd <= 0) {
    log.info(
      { budget_remaining_usd: state.budget_remaining_usd },
      'page_router.budget_exhausted',
    );
    return terminateSlice('budget_exceeded');
  }

  // (2) URLs exhausted.
  if (state.urls_remaining.length === 0) {
    log.info({}, 'page_router.urls_empty');
    return terminateSlice('success');
  }

  // (3) Pop next URL (noUncheckedIndexedAccess-safe).
  const [nextUrl, ...rest] = state.urls_remaining;
  if (nextUrl === undefined) {
    log.info({}, 'page_router.urls_empty');
    return terminateSlice('success');
  }

  // (4) DomainPolicy gate (R4.3) — only 'blocked' triggers a drop.
  const classification = deps.domainPolicy.classify(nextUrl);
  if (classification === 'blocked') {
    log.warn({ url: nextUrl, classification }, 'page_router.domain_blocked');
    return dropSlice(rest);
  }

  // (5) CircuitBreaker gate. classify() returns 'unknown' on parse failure,
  // not 'blocked', so we still guard new URL() here, treating parse failure
  // as drop.
  let hostname: string;
  try {
    hostname = new URL(nextUrl).hostname;
  } catch {
    log.warn({ url: nextUrl }, 'page_router.unparseable_url');
    return dropSlice(rest);
  }
  if (deps.circuitBreaker.isOpen(hostname)) {
    log.warn({ url: nextUrl, domain: hostname }, 'page_router.circuit_open');
    return dropSlice(rest);
  }

  // (6) Happy path.
  log.info(
    { url: nextUrl, classification, urls_remaining_count: rest.length },
    'page_router.routing_to_browse',
  );
  return {
    current_node: NODE_NAME,
    node_status: 'complete',
    current_url: nextUrl,
    urls_remaining: rest,
    updated_at: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Slice builders
// ---------------------------------------------------------------------------

/** Terminate slice — edges fan to audit_complete. */
function terminateSlice(
  reason: 'budget_exceeded' | 'success',
): Partial<AuditStateBrowseSubset> {
  return {
    current_node: NODE_NAME,
    node_status: 'complete',
    completion_reason: reason,
    updated_at: new Date(),
  };
}

/** Drop slice — edges re-enter page_router on the shrunk queue. */
function dropSlice(rest: ReadonlyArray<string>): Partial<AuditStateBrowseSubset> {
  return {
    current_node: NODE_NAME,
    node_status: 'complete',
    urls_remaining: [...rest],
    updated_at: new Date(),
  };
}

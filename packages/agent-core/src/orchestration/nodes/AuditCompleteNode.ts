/**
 * AuditCompleteNode — Phase 5 terminal orchestration node (T086).
 *
 * REQ-BROWSE-NODE-002 — AC-05 (terminal state writeback + LOCKED event emit)
 *                     + AC-18 (60-min wall-clock backstop).
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-05 v0.4, AC-18 v0.4
 *   docs/specs/mvp/phases/phase-5-browse-mvp/tasks.md T086 (L168-174)
 *   docs/specs/mvp/phases/phase-5-browse-mvp/impact.md §"Affected modules" L75-87
 *   packages/agent-core/src/types/audit-events.ts L58-81 (22 LOCKED event_types)
 *
 * Branches (state.completion_reason → event_type + metadata.cause_class):
 *   - 'success'         → 'audit_completed', no cause_class
 *   - 'budget_exceeded' → 'audit_failed',    cause_class='budget_exceeded'
 *   - 'aborted'         → 'audit_failed',    cause_class read from state
 *                         ._phase8_extensions.cause_class ∈
 *                         {hitl_timeout, bot_detected, safety_blocked, circuit_open}
 *   - 'timeout'         → 'audit_failed',    cause_class='wall_clock_timeout'
 *
 * Wall-clock backstop: if state arrives with completion_reason=undefined AND
 * now - state.created_at > 60 min → set completion_reason='timeout' and emit
 * audit_failed/wall_clock_timeout. This is a SAFETY NET; primary detection
 * lives in PageRouterNode (T083). 60-min cap is hardcoded MVP; external
 * config (AuditRequest.max_wall_clock_ms) deferred to v1.1 per AC-18 v0.4
 * + Phase 4b R20 amendment.
 *
 * Constitution compliance:
 *   R3.1 TDD: AC-05 + AC-18 conformance tests authored first; this impl follows.
 *   R9 adapter pattern: StorageAdapter, SessionRecorder, Logger deps only.
 *   R10.1 file ≤ 100 LOC. R10.2 named exports only. R10.5 no console.log.
 *   R2: no `any`; clock is a typed test-double seam.
 *   R14 Pino correlation: audit_run_id, client_id, node_name='audit_complete',
 *     subgraph='browse', loop_iteration=0.
 *   R23 default kill criteria (test reveals spec defect → STOP + flag).
 */
import type { StorageAdapter } from '../../adapters/StorageAdapter.js';
import { createChildLogger, type Logger } from '../../observability/logger.js';
import type { SessionRecorder } from '../../observability/SessionRecorder.js';
import {
  AuditStateBrowseSubsetSchema,
  type AuditStateBrowseSubset,
  type CompletionReason,
} from '../AuditState.js';

const NODE_NAME = 'audit_complete';
const WALL_CLOCK_CAP_MS = 60 * 60 * 1000; // 60 min MVP hardcode (AC-18 v0.4)

export interface AuditCompleteNodeDeps {
  readonly storage: StorageAdapter;
  readonly recorder: SessionRecorder;
  readonly logger: Logger;
  /** Test seam for wall-clock determinism. Defaults to `() => new Date()`. */
  readonly clock?: () => Date;
}

/** Exposed for unit testing; pure function. */
export function isWallClockExceeded(
  state: AuditStateBrowseSubset,
  now: Date,
  maxMs: number = WALL_CLOCK_CAP_MS,
): boolean {
  return now.getTime() - new Date(state.created_at).getTime() > maxMs;
}

function resolveCauseClass(
  reason: Exclude<CompletionReason, 'success'>,
  state: AuditStateBrowseSubset,
): string {
  if (reason === 'budget_exceeded') return 'budget_exceeded';
  if (reason === 'timeout') return 'wall_clock_timeout';
  // 'aborted' — read from _phase8_extensions escape hatch (AC-05 v0.4).
  const ext = state._phase8_extensions;
  const cause = ext && typeof ext['cause_class'] === 'string' ? ext['cause_class'] : undefined;
  if (cause === undefined) {
    throw new Error(
      "AuditCompleteNode: completion_reason='aborted' requires _phase8_extensions.cause_class ∈ {hitl_timeout, bot_detected, safety_blocked, circuit_open}",
    );
  }
  return cause;
}

export function createAuditCompleteNode(
  deps: AuditCompleteNodeDeps,
): (state: AuditStateBrowseSubset) => Promise<Partial<AuditStateBrowseSubset>> {
  const clock = deps.clock ?? ((): Date => new Date());
  return async (state) => {
    const child = createChildLogger(deps.logger, {
      audit_run_id: state.audit_run_id,
      client_id: state.client_id,
      node_name: NODE_NAME,
      subgraph: 'browse',
      loop_iteration: 0,
    });
    child.info('audit_complete.entry');

    // 1. Resolve completion_reason — wall-clock backstop if upstream missed it.
    let reason = state.completion_reason;
    if (reason === undefined) {
      if (isWallClockExceeded(state, clock())) {
        reason = 'timeout';
      } else {
        throw new Error(
          'AuditCompleteNode: state.completion_reason undefined and wall-clock not exceeded — upstream router defect (spec R23 kill)',
        );
      }
    }

    // 2. Persist terminal state to audit_runs.
    await deps.storage.finalizeAuditRun(state.audit_run_id, {
      client_id: state.client_id,
      completion_reason: reason,
    });
    child.info({ completion_reason: reason }, 'audit_complete.finalized');

    // 3. Emit LOCKED event (AC-05 4-branch table).
    const eventType = reason === 'success' ? 'audit_completed' : 'audit_failed';
    const metadata = reason === 'success' ? undefined : { cause_class: resolveCauseClass(reason, state) };
    await deps.recorder.recordEvent({
      audit_run_id: state.audit_run_id,
      client_id: state.client_id,
      event_type: eventType,
      page_url: null,
      metadata,
    });
    child.info({ event_type: eventType }, 'audit_complete.event_emitted');

    // 4. Return state slice — R2.2 Zod gate at module boundary.
    const slice: Partial<AuditStateBrowseSubset> = {
      current_node: 'audit_complete',
      node_status: 'complete',
      completion_reason: reason,
      updated_at: clock(),
    };
    AuditStateBrowseSubsetSchema.partial().parse(slice);
    child.info('audit_complete.exit');
    return slice;
  };
}

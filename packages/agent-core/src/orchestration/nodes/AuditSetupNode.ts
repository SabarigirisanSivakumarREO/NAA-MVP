/**
 * AuditSetupNode — Phase 5 T082 (REQ-BROWSE-NODE-002, AC-02).
 *
 * Source: spec.md AC-02 v0.4; tasks.md T082 L133-139; impact.md §"Affected modules".
 *
 * Entry node of the browse subgraph. Three responsibilities:
 *   1. Persist a new `audit_runs` row via `StorageAdapter.createAuditRun`.
 *   2. Emit the canonical `audit_started` AuditEvent (one of the LOCKED 22
 *      enum values in `types/audit-events.ts` L58-81) via `SessionRecorder`.
 *   3. Return the AuditState patch slice — `audit_run_id` (newly minted),
 *      `current_node='audit_setup'`, `node_status='complete'`, fresh
 *      `updated_at`. Other browse-subset fields flow through unchanged.
 *
 * Factory: `createAuditSetupNode(deps)` → `(state) => Promise<patch>`. The
 * patch is the LangGraph merge target; we Zod-partial-parse before return
 * (R2.2) to guard against type drift.
 *
 * R20 sibling contracts: AuditStateBrowseSubsetSchema (T081),
 *   StorageAdapter.createAuditRun (Phase 4 T074),
 *   SessionRecorder.recordEvent (Phase 4 T072),
 *   AuditEventTypeEnum (Phase 4 T-PHASE4-TYPES; 22 LOCKED).
 *
 * Constitution: R2 no `any` (SessionRecorderLike = DI seam); R3.1 TDD (RED
 *   test in Wave 1, GREEN here); R9 zero vendor SDK imports; R10.1 ≤ 150
 *   LOC; R10.2 named exports only; R13 no console.log; R14 Pino correlation
 *   triple (Phase 5 fields pre-registered in observability/logger.ts).
 */
import { z } from 'zod';

import {
  AuditStateBrowseSubsetSchema,
  type AuditStateBrowseSubset,
} from '../AuditState.js';
import type { AuditRunInsert, StorageAdapter } from '../../adapters/StorageAdapter.js';
import type { AuditEventInput } from '../../observability/SessionRecorder.js';
import { createChildLogger, createLogger, type Logger } from '../../observability/logger.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Structural-typed shim around `SessionRecorder` so tests can inject a spy
 * that does NOT depend on `PostgresStorage` or pg at all. The real
 * `SessionRecorder` class (observability/SessionRecorder.ts) satisfies this
 * shape; tests inject a `{ recordEvent: vi.fn() }` double.
 */
export interface SessionRecorderLike {
  recordEvent(input: AuditEventInput): Promise<void>;
}

export interface AuditSetupNodeDeps {
  readonly storage: StorageAdapter;
  readonly recorder: SessionRecorderLike;
  readonly logger?: Logger;
}

/**
 * Patch type returned by the node — the LangGraph runtime merges this on top
 * of the incoming AuditState. Derived from `AuditStateBrowseSubsetSchema
 * .partial()` rather than `Partial<AuditStateBrowseSubset>` because the
 * Zod-partial shape uses `key?: T` (omittable) while TS `Partial<T>` under
 * `exactOptionalPropertyTypes: true` produces `key?: T | undefined`
 * (omittable OR explicit-undefined). The Zod shape is what the runtime
 * actually validates, so we mirror it in the static type.
 */
export type AuditSetupPatch = z.infer<ReturnType<typeof AuditStateBrowseSubsetSchema.partial>>;

export type AuditSetupNode = (state: AuditStateBrowseSubset) => Promise<AuditSetupPatch>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_NAME = 'audit_setup';
const SUBGRAPH = 'browse' as const;
const LOOP_ITERATION = 0;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build the audit_setup node bound to its deps. Returned function is
 * stateless (deps captured by closure); safe to register once per BrowseGraph
 * compile and invoke many times per audit run boundary.
 */
export function createAuditSetupNode(deps: AuditSetupNodeDeps): AuditSetupNode {
  const baseLogger = deps.logger ?? createLogger('audit-setup-node');

  return async function auditSetupNode(state) {
    const child = createChildLogger(baseLogger, {
      audit_run_id: state.audit_run_id,
      client_id: state.client_id,
      node_name: NODE_NAME,
      subgraph: SUBGRAPH,
      loop_iteration: LOOP_ITERATION,
    });

    child.info('audit_setup: node.entry');

    // 1. Persist a fresh audit_runs row. `rootUrl` mirrors the first queued
    //    URL — the canonical "starting point" for the run; downstream
    //    PageRouterNode pops from `urls_remaining` independently.
    const rootUrl = state.urls_remaining[0];
    const entry: AuditRunInsert = {
      clientId: state.client_id,
      ...(rootUrl !== undefined ? { rootUrl } : {}),
    };
    const newAuditRunId = await deps.storage.createAuditRun(entry);
    child.info({ new_audit_run_id: newAuditRunId }, 'audit_setup: audit_run.created');

    // 2. Emit the canonical `audit_started` event. Page-level scope is
    //    `null` per §34.4 emit-by column (audit-level lifecycle event).
    await deps.recorder.recordEvent({
      audit_run_id: newAuditRunId,
      client_id: state.client_id,
      event_type: 'audit_started',
      page_url: null,
      metadata: {
        urls_count: state.urls_remaining.length,
        business_type: state.business_type,
      },
    });
    child.info({ event_type: 'audit_started' }, 'audit_setup: event.emitted');

    // 3. Compose + R2.2 validate the patch slice. Partial schema accepts any
    //    subset of fields so long as those present satisfy the strict shape.
    const patch: AuditSetupPatch = {
      audit_run_id: newAuditRunId,
      current_node: NODE_NAME,
      node_status: 'complete',
      updated_at: new Date(),
    };
    const validated = AuditStateBrowseSubsetSchema.partial().parse(patch);

    child.info('audit_setup: node.exit');
    return validated;
  };
}

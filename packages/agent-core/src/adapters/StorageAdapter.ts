/**
 * StorageAdapter — R9 adapter interface for persistence (Phase 4 T074).
 *
 * Source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-12 + R-13
 *     (REQ-STORAGE-ADAPTER-001)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T074 brief
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/impact.md §"Forward Contract"
 *     (Phase 7 StoreNode, Phase 8 AuditCompleteNode, Phase 9 ReportGenerator)
 *   docs/specs/final-architecture/13-data-layer.md §13.6 (RLS transaction
 *     pattern — `SET LOCAL app.client_id` per transaction, NEVER per-statement)
 *
 * # R9 boundary
 *
 * This file is the PUBLIC interface — it has NO runtime dependency on `pg` or
 * `drizzle-orm`. Row types are imported as `import type` from the Drizzle
 * schema barrel; the `import type` form is erased at runtime, so this file
 * stays vendor-agnostic. The SOLE concrete implementation that imports
 * `pg` / `drizzle-orm` at runtime is `PostgresStorage.ts` (same folder).
 *
 * # RLS contract (R7.2)
 *
 * Every DB interaction MUST go through `withClient(clientId, fn)`, which:
 *   1. opens a Postgres transaction (BEGIN)
 *   2. issues `SET LOCAL app.client_id = $1` BEFORE any data SQL
 *   3. invokes `fn(tx)` with a transactional `StorageTx` handle
 *   4. commits on resolve / rolls back on throw
 *
 * The 10 RLS-protected client-scoped tables (AC-12) use this scope to filter
 * rows server-side. Cross-client queries with a different `app.client_id`
 * return empty — verified by the AC-12 conformance test.
 *
 * # Append-only tables (R7.4)
 *
 * Five tables (`audit_log`, `rejected_findings`, `finding_edits`,
 * `llm_call_log`, `audit_events`) are append-only. Writers expose INSERT-only
 * methods (`appendAuditLog`, `appendAuditEvent`, `appendLLMCallLog`); the
 * `AppendOnlyTable<T>` brand from T070 prevents `db.update()` / `db.delete()`
 * at compile time, and DB triggers reject UPDATE/DELETE at runtime.
 *
 * R10.1 ≤ 200 lines. R10.2 named exports only.
 */
import type { AuditEvent } from '../types/audit-events.js';
import type { LLMCallRecord } from '../types/llm.js';
import type {
  AuditLogInsert as DbAuditLogInsert,
  AuditRequestInsert as DbAuditRequestInsert,
  AuditRunInsert as DbAuditRunInsert,
  ClientInsert as DbClientInsert,
  FindingEditInsert as DbFindingEditInsert,
  FindingInsert as DbFindingInsert,
  FindingRollupInsert as DbFindingRollupInsert,
  FindingRow as DbFindingRow,
  PageStateInsert as DbPageStateInsert,
  RejectedFindingInsert as DbRejectedFindingInsert,
  ReproducibilitySnapshotInsert as DbReproducibilitySnapshotInsert,
  ScreenshotInsert as DbScreenshotInsert,
  SessionInsert as DbSessionInsert,
  StateInteractionInsert as DbStateInteractionInsert,
} from '../db/index.js';

/**
 * RawTxQuery — escape hatch for raw SQL inside a transaction. Used by
 * conformance tests (AC-12) and by RLS-sensitive admin operations. Domain
 * code SHOULD use the typed `StorageAdapter` methods (which compile down to
 * Drizzle builder calls under the same transaction) and NOT this method.
 *
 * Shape mirrors `RawDbClient.query` from `db/client.ts` so the conformance
 * test (which does `await tx.query('SELECT current_setting...')`) compiles.
 */
export interface StorageTx {
  query<T = unknown>(text: string, params?: ReadonlyArray<unknown>): Promise<{ rows: T[] }>;

  // Append-only writers (R7.4) — also exposed at tx scope so callers inside
  // withClient(...) can chain multiple appends in one BEGIN/COMMIT.
  appendAuditLog(entry: AuditLogInsert): Promise<void>;
  appendAuditEvent(event: AuditEvent): Promise<void>;
  appendLLMCallLog(record: LLMCallRecord): Promise<void>;
}

// ────────────────────────────────────────────────────────────────────────
// Row types — re-exported from `db/index.ts` where they are derived via
// Drizzle's InferInsertModel / InferSelectModel. This adapter file does NOT
// import `drizzle-orm` directly (R9 boundary; T073 grep test enforces); the
// db barrel is the SOLE outside-of-adapters file that touches drizzle types.
// Consumers (T071/T072/T073/Phase 7/Phase 8) re-import these from here.
// ────────────────────────────────────────────────────────────────────────

export type ClientInsert = DbClientInsert;
export type AuditRunInsert = DbAuditRunInsert;
export type FindingInsert = DbFindingInsert;
export type ScreenshotInsert = DbScreenshotInsert;
export type SessionInsert = DbSessionInsert;
export type PageStateInsert = DbPageStateInsert;
export type StateInteractionInsert = DbStateInteractionInsert;
export type FindingRollupInsert = DbFindingRollupInsert;
export type ReproducibilitySnapshotInsert = DbReproducibilitySnapshotInsert;
export type AuditRequestInsert = DbAuditRequestInsert;

// Append-only insert rows
export type AuditLogInsert = DbAuditLogInsert;
export type RejectedFindingInsert = DbRejectedFindingInsert;
export type FindingEditInsert = DbFindingEditInsert;

/**
 * StorageAdapter — the persistence boundary contract.
 *
 * Every method that touches the DB runs inside its own transaction with
 * `app.client_id` set; multi-statement workflows use `withClient(...)` to
 * batch under ONE transaction.
 *
 * The initial method set covers Phase 4 (the three append-only writers used
 * by T071/T072/T073) plus the four CRUD seams cited in impact.md's Forward
 * Contract (createAuditRun, getFindings, writeReproducibilitySnapshot,
 * finalizeAuditRun) consumed by Phase 7 + Phase 8. Phase 7 + Phase 8 may
 * extend this surface as needed — additions are non-breaking forward-compat;
 * renames/removals require an impact.md update (R20).
 */
export interface StorageAdapter {
  /**
   * Open a transactional scope with `SET LOCAL app.client_id = clientId`,
   * run `fn(tx)`, and commit on resolve / roll back on throw.
   *
   * `clientId` MUST be a UUID string; PostgresStorage relies on Postgres to
   * reject non-UUID values via the `clients.id` column type.
   */
  withClient<T>(clientId: string, fn: (tx: StorageTx) => Promise<T>): Promise<T>;

  // ── Append-only writers (R7.4) ──────────────────────────────────────
  // Convenience wrappers around `withClient(entry.client_id, tx => tx.append*)`
  // so callers (AuditLogger T071, SessionRecorder T072, AnthropicAdapter T073)
  // don't have to construct a transaction explicitly.

  /** REQ-OBSERVE-AUDIT-LOG-001 — append one row to `audit_log` (T071). */
  appendAuditLog(entry: AuditLogInsert): Promise<void>;

  /** REQ-OBSERVE-SESSION-RECORDER-001 — append one row to `audit_events` (T072). */
  appendAuditEvent(event: AuditEvent): Promise<void>;

  /** REQ-LLM-COST-LOG-001 / R14.1 — append one row to `llm_call_log` (T073). */
  appendLLMCallLog(record: LLMCallRecord): Promise<void>;

  // ── Audit-run lifecycle (Phase 5 + Phase 8 consumers) ───────────────
  /**
   * Insert one `audit_runs` row scoped to `entry.client_id`. Returns the
   * generated id. Phase 5 Gateway calls this at audit setup.
   */
  createAuditRun(entry: AuditRunInsert): Promise<string>;

  /**
   * Mark an `audit_runs` row as completed with the given completion reason.
   * Phase 8 AuditCompleteNode calls this at pipeline exit (impact.md L285).
   */
  finalizeAuditRun(
    auditRunId: string,
    opts: { client_id: string; completion_reason: string },
  ): Promise<void>;

  // ── Findings (Phase 7 + Phase 9 consumers) ──────────────────────────
  /**
   * List findings for an audit run under the caller's client scope (RLS
   * filters automatically). Phase 9 ReportGenerator reads via this method;
   * Phase 7 StoreNode writes via `appendFinding` (inverse seam).
   */
  getFindings(auditRunId: string, opts: { client_id: string }): Promise<readonly FindingRow[]>;

  /** Phase 7 StoreNode — insert one `findings` row. */
  appendFinding(entry: FindingInsert): Promise<string>;

  /**
   * Phase 7 T132 StoreNode — append one row to `rejected_findings`.
   * R7.4 append-only; rejection_reason + rejected_by_rule preserve
   * grounding-pipeline traceability.
   */
  appendRejectedFinding(entry: RejectedFindingInsert): Promise<string>;

  // ── Reproducibility (Phase 8 consumer) ──────────────────────────────
  /**
   * REQ-DATA-SCHEMA-001 / R10 — write one `reproducibility_snapshots` row.
   * Phase 8 AuditCompleteNode calls this (impact.md L284).
   */
  writeReproducibilitySnapshot(entry: ReproducibilitySnapshotInsert): Promise<void>;
}

/**
 * FindingRow — read-shape returned by `getFindings`. Yields the columns
 * as Postgres returns them (all server-side defaults already filled in,
 * vs `*Insert` shapes where defaulted columns are optional). Re-exported
 * from `db/index.ts` so Phase 9 consumers don't have to drill into
 * `db/schema.js` directly.
 */
export type FindingRow = DbFindingRow;

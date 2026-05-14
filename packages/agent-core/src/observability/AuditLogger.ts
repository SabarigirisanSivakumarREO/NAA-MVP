/**
 * AuditLogger — append-only writer to `audit_log` (Phase 4 T071).
 *
 * Source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-06
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T071
 *     (REQ-OBSERVE-AUDIT-LOG-001)
 *   docs/specs/final-architecture/13-data-layer.md §13.1 (audit_log shape)
 *
 * # Contract (AC-06 conformance test = canonical)
 *
 *   const logger = new AuditLogger();
 *   await logger.log({
 *     audit_run_id: '<uuid>',
 *     client_id:    '<uuid>',
 *     event:        '<event-name>',
 *     payload:      { ...optional },
 *   });
 *
 * The public API uses snake_case keys (column-name parity with the
 * Postgres `audit_log` table). Internally, this writer translates to
 * Drizzle's camelCase row shape (`AuditLogInsert`) before delegating
 * to `StorageAdapter.appendAuditLog()`, which:
 *   - opens a transaction under `withClient(client_id)` so RLS scope
 *     is set via `set_config('app.client_id', ..., true)` (R7.2);
 *   - inserts via the Drizzle `auditLog` table (R7.4 — INSERT-only;
 *     UPDATE/DELETE are blocked at the DB trigger level with the
 *     error message `append-only violation: ...`).
 *
 * # R9 boundary
 *
 * This file imports `StorageAdapter` (interface) and `PostgresStorage`
 * (concrete default). It does NOT import `pg` / `drizzle-orm` directly
 * — those stay confined to `db/**` + `adapters/PostgresStorage.ts`.
 *
 * # R14 Pino correlation
 *
 * Every `log()` invocation emits an `info`-level Pino line bound to
 * `audit_run_id` + `client_id` (both pre-registered in `logger.ts`
 * LogBindings) plus the row's `event` value. No raw `console.log`.
 *
 * R10.1 ≤ 150 lines (tasks.md L256). R10.2 named exports only.
 */
import type { StorageAdapter, AuditLogInsert } from '../adapters/StorageAdapter.js';
import { PostgresStorage } from '../adapters/PostgresStorage.js';

import { createChildLogger, createLogger, type Logger } from './logger.js';

/**
 * AuditLogEntry — public input shape for `AuditLogger.log()`.
 *
 * Snake_case mirrors the `audit_log` table column names exactly
 * (the AC-06 test constructs entries with these keys). Internally
 * we map to Drizzle's camelCase row shape before INSERT.
 *
 * - `audit_run_id` / `client_id`  — UUID strings; both required.
 * - `event`                       — short human-readable event name
 *                                   (e.g. `'audit_started'`, `'page_failed'`).
 * - `payload`                     — optional structured JSON; defaults to `{}`
 *                                   to match the schema's `jsonb` `default({})`.
 */
export interface AuditLogEntry {
  readonly audit_run_id: string;
  readonly client_id: string;
  readonly event: string;
  readonly payload?: unknown;
}

/**
 * Optional constructor deps. Defaults wire the production
 * `PostgresStorage` + a fresh Pino logger named `audit-logger`.
 * Tests may inject either (typically a fake storage).
 */
export interface AuditLoggerDeps {
  readonly storage?: StorageAdapter;
  readonly logger?: Logger;
}

export class AuditLogger {
  readonly #storage: StorageAdapter;
  readonly #logger: Logger;

  constructor(deps: AuditLoggerDeps = {}) {
    this.#storage = deps.storage ?? new PostgresStorage();
    this.#logger = deps.logger ?? createLogger('audit-logger');
  }

  /**
   * REQ-OBSERVE-AUDIT-LOG-001 — append one row to `audit_log`.
   *
   * INSERT-only: there is no `update` or `delete` method on this
   * class, and the underlying Drizzle table is brand-typed
   * `AppendOnlyTable<...>` so the compiler rejects update/delete
   * builder calls. DB triggers reject UPDATE/DELETE at runtime.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    const row = toInsertRow(entry);
    await this.#storage.appendAuditLog(row);
    createChildLogger(this.#logger, {
      audit_run_id: entry.audit_run_id,
      client_id: entry.client_id,
    }).info({ event: entry.event }, 'audit_log row appended');
  }
}

// ────────────────────────────────────────────────────────────────────────
// Internals — snake_case → Drizzle camelCase mapper
// ────────────────────────────────────────────────────────────────────────

/**
 * Map the AC-06 public input shape (snake_case) to the Drizzle insert
 * shape (camelCase). `id` + `createdAt` are filled in by Postgres
 * (`defaultRandom()` + `defaultNow()`); `payload` defaults to `{}`
 * matching the schema default.
 */
const toInsertRow = (entry: AuditLogEntry): AuditLogInsert => ({
  auditRunId: entry.audit_run_id,
  clientId: entry.client_id,
  event: entry.event,
  payload: (entry.payload ?? {}) as AuditLogInsert['payload'],
});

/**
 * SessionRecorder — append-only writer to `audit_events` (Phase 4 T072).
 *
 * Source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-07
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T072
 *     (REQ-OBSERVE-SESSION-RECORDER-001)
 *   docs/specs/final-architecture/34-observability.md §34.4 REQ-OBS-011/012
 *     (event schema + 22-type enum — LOCKED)
 *   docs/specs/final-architecture/13-data-layer.md §13.7 (audit_events shape)
 *
 * # Contract (AC-07 conformance test = canonical)
 *
 *   const recorder = new SessionRecorder();
 *   await recorder.recordEvent({
 *     audit_run_id: '<uuid>',
 *     client_id:    '<uuid>',
 *     event_type:   'audit_started',   // one of the 22 §34.4 enum values
 *     page_url:     null,              // nullable for audit-level events
 *     metadata:     { ...optional },
 *   });
 *
 * Server-generated fields `id` (uuid) + `timestamp` (TIMESTAMPTZ) are filled
 * in by this writer BEFORE Zod validation, so callers supply the five
 * domain-meaningful fields and let the boundary own row-identity. After
 * defaults are merged, the full row is parsed against `AuditEventSchema`
 * — that's the Zod gate covering the 22-type enum (R3 contract validation
 * at every external boundary). Invalid `event_type` values throw `ZodError`
 * synchronously inside the returned Promise (caught at call sites or surfaced
 * to test as `.rejects.toThrow()`).
 *
 * The schema is `.strict()`, so unknown keys would also throw — keeping the
 * audit_events surface honest as new code paths come online.
 *
 * # R9 boundary
 *
 * This file imports `StorageAdapter` (interface) and `PostgresStorage`
 * (concrete default). It does NOT import `pg` / `drizzle-orm` directly —
 * those stay confined to `db/**` + `adapters/PostgresStorage.ts`.
 *
 * # R7.4 append-only
 *
 * `recordEvent` is the SOLE method on this class. There is no `update`
 * or `delete`; `audit_events` rows are immutable once written (DB trigger
 * `enforce_append_only` rejects UPDATE/DELETE at runtime, and the
 * `AppendOnlyTable<T>` brand from T070 rejects them at compile time inside
 * PostgresStorage).
 *
 * # R14 Pino correlation
 *
 * Every `recordEvent` invocation emits an `info`-level Pino line bound to
 * `audit_run_id` + `client_id` + `event_type` — all three pre-registered
 * in `logger.ts` LogBindings (Phase 0 + Phase 4 blocks). No raw `console.log`.
 *
 * R10.1 ≤ 200 lines (tasks.md L264). R10.2 named exports only. R2 no `any`.
 */
import { randomUUID } from 'node:crypto';

import { PostgresStorage } from '../adapters/PostgresStorage.js';
import type { StorageAdapter } from '../adapters/StorageAdapter.js';
import {
  AuditEventSchema,
  type AuditEvent,
} from '../types/audit-events.js';

import { createChildLogger, createLogger, type Logger } from './logger.js';

/**
 * AuditEventInput — public input shape for `SessionRecorder.recordEvent()`.
 *
 * Mirrors `AuditEvent` MINUS the two server-generated fields (`id` + `timestamp`)
 * that this writer fills in. The AC-07 conformance test constructs events with
 * exactly these five keys (audit_run_id, client_id, event_type, page_url,
 * metadata) — keeping the input shape lean keeps call sites honest about which
 * fields are domain inputs vs row identity.
 *
 * `event_type` is typed as `AuditEvent['event_type']` (the 22-string union) so
 * TypeScript catches typos at compile time; Zod parse is still the runtime
 * gate (test path passes `'unknown_event_type' as never` to verify runtime
 * rejection — see AC-07 case 4).
 *
 * `page_url` MUST be `null` for audit-level events (audit_started,
 * audit_completed, audit_failed, budget_warning, budget_exceeded,
 * cross_page_analysis_completed) per §34.4 emit-by column; for page-scoped
 * events callers pass a URL string. Both shapes are accepted here; the schema
 * validates the URL format when non-null.
 */
export type AuditEventInput = Omit<AuditEvent, 'id' | 'timestamp'>;

/**
 * Optional constructor deps. Defaults wire production `PostgresStorage` +
 * a fresh Pino logger named `session-recorder`. Tests may inject either
 * (typically a fake storage).
 */
export interface SessionRecorderDeps {
  readonly storage?: StorageAdapter;
  readonly logger?: Logger;
}

export class SessionRecorder {
  readonly #storage: StorageAdapter;
  readonly #logger: Logger;

  constructor(deps: SessionRecorderDeps = {}) {
    this.#storage = deps.storage ?? new PostgresStorage();
    this.#logger = deps.logger ?? createLogger('session-recorder');
  }

  /**
   * REQ-OBSERVE-SESSION-RECORDER-001 — append one row to `audit_events`.
   *
   * Steps:
   *   1. Fill server-generated fields (`id` = randomUUID, `timestamp` = now).
   *   2. Validate the full row against `AuditEventSchema` (Zod) — the 22-type
   *      `event_type` enum check is the canonical gate for AC-07.
   *   3. Delegate to `StorageAdapter.appendAuditEvent`, which opens a
   *      transaction under `withClient(client_id)` (RLS) and INSERTs the row.
   *   4. Emit a Pino info line with the canonical correlation triple.
   *
   * INSERT-only: there is no `update` or `delete` method on this class, and
   * the underlying Drizzle table is brand-typed `AppendOnlyTable<...>` so
   * the compiler rejects update/delete builder calls. DB triggers reject
   * UPDATE/DELETE at runtime.
   */
  async recordEvent(input: AuditEventInput): Promise<void> {
    // 1. Fill defaults BEFORE Zod parse so the full row (incl. id + timestamp)
    //    validates against the strict schema in one shot.
    const candidate: AuditEvent = {
      id: randomUUID(),
      audit_run_id: input.audit_run_id,
      client_id: input.client_id,
      event_type: input.event_type,
      page_url: input.page_url,
      metadata: input.metadata,
      timestamp: new Date(),
    };

    // 2. R3 — validate at the boundary. ZodError surfaces synchronously inside
    //    this async method; AC-07 case 4 asserts `.rejects.toThrow()` on a bad
    //    event_type. Strict schema also rejects unknown extra keys.
    const event = AuditEventSchema.parse(candidate);

    // 3. Append via the adapter (R9 boundary; RLS via withClient internally).
    await this.#storage.appendAuditEvent(event);

    // 4. Pino correlation — audit_run_id + client_id + event_type are all
    //    registered LogBindings (Phase 0 + Phase 4).
    createChildLogger(this.#logger, {
      audit_run_id: event.audit_run_id,
      client_id: event.client_id,
      event_type: event.event_type,
    }).info('audit_events row appended');
  }
}

/**
 * PostgresStorage — Drizzle-backed concrete StorageAdapter (Phase 4 T074).
 *
 * Source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-12 + R-13
 *     (REQ-STORAGE-ADAPTER-001)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T074 brief
 *   docs/specs/final-architecture/13-data-layer.md §13.6 (RLS transaction
 *     pattern — `SET LOCAL app.client_id` at start of EVERY transaction)
 *
 * # R9 boundary (SOLE pg + drizzle runtime importer outside db/**)
 *
 * `pg` + `drizzle-orm` runtime imports are forbidden everywhere in
 * `packages/agent-core/src` EXCEPT `db/**` and this file. The Phase 4 T073
 * ESLint rule (lands with AnthropicAdapter) will mechanically enforce this;
 * until then code-review enforces. Pool ownership stays in `db/client.ts`
 * (singleton) — this adapter checks out connections via the `getPool()`
 * accessor (added to client.ts in this commit; purely additive).
 *
 * # RLS contract (R7.2)
 *
 * Every operation runs inside a transaction:
 *   1. `pool.connect()` → checkout a single PoolClient
 *   2. `BEGIN`
 *   3. `SET LOCAL ROLE app_user` — switch to a non-superuser, non-BYPASSRLS
 *      role so RLS policies actually fire. The connecting Postgres user
 *      (typically `neural` in dev) is a superuser that bypasses RLS
 *      regardless of `FORCE ROW LEVEL SECURITY`; `app_user` (created in
 *      migration 0003) is a regular role with DML grants but no bypass.
 *   4. `SELECT set_config('app.client_id', $1, true)` (parameterized; the
 *      `true` arg = LOCAL — scoped to this txn, cleared on COMMIT/ROLLBACK)
 *   5. work via Drizzle scoped to this single connection
 *   6. `COMMIT` (or `ROLLBACK` on throw) — both `SET LOCAL ROLE` and
 *      `set_config(..., true)` are auto-reset
 *   7. `client.release()` always (try/finally)
 *
 * `set_config(..., true)` is the parameterized equivalent of `SET LOCAL`.
 * `SET LOCAL` itself doesn't accept positional parameters (`SET LOCAL
 * app.client_id = $1` is a parse error), so we use `set_config` which does
 * — the `true` boolean enables LOCAL-scoping. This is critical for safety:
 * the setting CANNOT leak to subsequent transactions on the same pooled
 * connection, and the parameterized form prevents SQL injection of the
 * client_id.
 *
 * # Append-only writers (R7.4)
 *
 * Drizzle insert builders for the 3 append-only tables consumed by Phase 4
 * (audit_log via T071, audit_events via T072, llm_call_log via T073). The
 * `AppendOnlyTable<T>` brand from T070 prevents `db.update()` / `db.delete()`
 * on these tables at compile time; the matching DB triggers reject
 * UPDATE/DELETE at runtime with the message `append-only violation`
 * (asserted by AC-06 conformance).
 *
 * R10.1 ≤ 300 lines. R10.2 named exports only. R14: Pino correlation
 * (audit_run_id + client_id) on every log line.
 */
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type pg from 'pg';

import { getPool } from '../db/client.js';
import * as schema from '../db/schema.js';
import {
  auditEvents,
  auditLog,
  auditRuns,
  findings,
  llmCallLog,
  rejectedFindings,
  reproducibilitySnapshots,
} from '../db/schema.js';
import { createLogger } from '../observability/logger.js';
import type { AuditEvent } from '../types/audit-events.js';
import type { LLMCallRecord } from '../types/llm.js';
import type {
  AuditLogInsert,
  AuditRunInsert,
  FindingInsert,
  FindingRow,
  RejectedFindingInsert,
  ReproducibilitySnapshotInsert,
  StorageAdapter,
  StorageTx,
} from './StorageAdapter.js';

const log = createLogger('postgres-storage');

export interface PostgresStorageDeps {
  /** Optional injected pool — primarily for unit tests; defaults to the singleton. */
  pool?: pg.Pool;
}

/**
 * PostgresStorage — production StorageAdapter. Construct with no args in
 * normal use; tests may inject a custom pool via `{ pool }`.
 *
 *   const storage = new PostgresStorage();
 *   await storage.withClient(clientId, async (tx) => { ... });
 */
export class PostgresStorage implements StorageAdapter {
  readonly #pool: pg.Pool;

  constructor(deps: PostgresStorageDeps = {}) {
    this.#pool = deps.pool ?? getPool();
  }

  async withClient<T>(clientId: string, fn: (tx: StorageTx) => Promise<T>): Promise<T> {
    const child = log.child({ client_id: clientId });
    const client = await this.#pool.connect();
    try {
      await client.query('BEGIN');
      // R7.2 — RLS scope set ONCE per transaction (NEVER per-statement).
      // (a) SET LOCAL ROLE app_user — drop superuser/BYPASSRLS privileges
      //     so the policies installed by migration 0002 actually fire.
      //     `app_user` is created in migration 0003 with DML grants but
      //     no bypass. The role reverts to the connection's authenticated
      //     role on COMMIT/ROLLBACK (SET LOCAL semantics).
      await client.query('SET LOCAL ROLE app_user');
      // (b) `set_config(name, value, is_local=true)` = parameterized SET LOCAL.
      //     Sets the RLS scope read by `current_setting('app.client_id', true)`
      //     inside each policy's USING clause.
      await client.query("SELECT set_config('app.client_id', $1, true)", [clientId]);
      const tx = buildTx(client);
      const result = await fn(tx);
      await client.query('COMMIT');
      child.debug('tx committed');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        child.error({ err: rollbackErr }, 'ROLLBACK failed after tx error');
      }
      child.error({ err }, 'tx rolled back');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── Append-only writers (R7.4) — convenience wrappers ───────────────

  async appendAuditLog(entry: AuditLogInsert): Promise<void> {
    await this.withClient(entry.clientId, (tx) => tx.appendAuditLog(entry));
    log
      .child({ audit_run_id: entry.auditRunId, client_id: entry.clientId })
      .info({ event: entry.event }, 'audit_log row appended');
  }

  async appendAuditEvent(event: AuditEvent): Promise<void> {
    await this.withClient(event.client_id, (tx) => tx.appendAuditEvent(event));
    log
      .child({
        audit_run_id: event.audit_run_id,
        client_id: event.client_id,
        event_type: event.event_type,
      })
      .info('audit_events row appended');
  }

  async appendLLMCallLog(record: LLMCallRecord): Promise<void> {
    await this.withClient(record.client_id, (tx) => tx.appendLLMCallLog(record));
    log
      .child({
        audit_run_id: record.audit_run_id,
        client_id: record.client_id,
        llm_call_id: record.id,
      })
      .info({ outcome: record.outcome, model: record.model }, 'llm_call_log row appended');
  }

  // ── Audit-run lifecycle (Phase 5 + Phase 8) ─────────────────────────

  async createAuditRun(entry: AuditRunInsert): Promise<string> {
    return this.withClient(entry.clientId, async (tx) => {
      const drz = drizzle((tx as InternalTx).client, { schema });
      const inserted = await drz.insert(auditRuns).values(entry).returning({ id: auditRuns.id });
      const id = inserted[0]?.id;
      if (id === undefined) {
        throw new Error('createAuditRun: insert returned no row');
      }
      return id;
    });
  }

  async finalizeAuditRun(
    auditRunId: string,
    opts: { client_id: string; completion_reason: string },
  ): Promise<void> {
    await this.withClient(opts.client_id, async (tx) => {
      const drz = drizzle((tx as InternalTx).client, { schema });
      await drz
        .update(auditRuns)
        .set({
          status: 'completed',
          completionReason: opts.completion_reason,
          completedAt: new Date(),
        })
        .where(and(eq(auditRuns.id, auditRunId), eq(auditRuns.clientId, opts.client_id)));
    });
  }

  // ── Findings (Phase 7 + Phase 9) ────────────────────────────────────

  async getFindings(
    auditRunId: string,
    opts: { client_id: string },
  ): Promise<readonly FindingRow[]> {
    return this.withClient(opts.client_id, async (tx) => {
      const drz = drizzle((tx as InternalTx).client, { schema });
      const rows = await drz.select().from(findings).where(eq(findings.auditRunId, auditRunId));
      return rows;
    });
  }

  async appendFinding(entry: FindingInsert): Promise<string> {
    return this.withClient(entry.clientId, async (tx) => {
      const drz = drizzle((tx as InternalTx).client, { schema });
      const inserted = await drz.insert(findings).values(entry).returning({ id: findings.id });
      const id = inserted[0]?.id;
      if (id === undefined) {
        throw new Error('appendFinding: insert returned no row');
      }
      return id;
    });
  }

  async appendRejectedFinding(entry: RejectedFindingInsert): Promise<string> {
    return this.withClient(entry.clientId, async (tx) => {
      const drz = drizzle((tx as InternalTx).client, { schema });
      const inserted = await drz
        .insert(rejectedFindings)
        .values(entry)
        .returning({ id: rejectedFindings.id });
      const id = inserted[0]?.id;
      if (id === undefined) {
        throw new Error('appendRejectedFinding: insert returned no row');
      }
      return id;
    });
  }

  // ── Reproducibility (Phase 8) ───────────────────────────────────────

  async writeReproducibilitySnapshot(entry: ReproducibilitySnapshotInsert): Promise<void> {
    await this.withClient(entry.clientId, async (tx) => {
      const drz = drizzle((tx as InternalTx).client, { schema });
      await drz.insert(reproducibilitySnapshots).values(entry);
    });
  }
}

// ────────────────────────────────────────────────────────────────────────
// Internals — transactional handle builder
// ────────────────────────────────────────────────────────────────────────

/**
 * InternalTx extends StorageTx with the underlying PoolClient so the
 * outer PostgresStorage methods (which need to run Drizzle inside
 * `withClient`) can pull the live transactional connection back out.
 * Cast site is local to this file; consumers see only StorageTx.
 */
interface InternalTx extends StorageTx {
  readonly client: pg.PoolClient;
}

const buildTx = (client: pg.PoolClient): InternalTx => ({
  client,
  query: async <T = unknown>(text: string, params?: ReadonlyArray<unknown>) => {
    const r = await client.query(text, params as unknown[] | undefined);
    return { rows: r.rows as T[] };
  },
  appendAuditLog: async (entry) => {
    const drz = drizzle(client, { schema });
    await drz.insert(auditLog).values(entry);
  },
  appendAuditEvent: async (event) => {
    // Map W1C snake_case AuditEvent → Drizzle camelCase row columns.
    const drz = drizzle(client, { schema });
    await drz.insert(auditEvents).values({
      id: event.id,
      auditRunId: event.audit_run_id,
      clientId: event.client_id,
      eventType: event.event_type,
      pageUrl: event.page_url,
      metadata: event.metadata as Record<string, unknown>,
      timestamp: event.timestamp,
    });
  },
  appendLLMCallLog: async (record) => {
    const drz = drizzle(client, { schema });
    await drz.insert(llmCallLog).values({
      id: record.id,
      auditRunId: record.audit_run_id,
      clientId: record.client_id,
      operation: record.operation,
      model: record.model,
      promptTokens: record.prompt_tokens,
      completionTokens: record.completion_tokens,
      // Drizzle `numeric` columns are typed as `string`; .toString() on a
      // JS number gives lossless serialization for cost amounts here.
      costUsd: record.cost_usd.toString(),
      durationMs: record.duration_ms,
      cacheHit: record.cache_hit,
      outcome: record.outcome,
      errorClass: record.error_class,
      createdAt: record.created_at,
    });
  },
});

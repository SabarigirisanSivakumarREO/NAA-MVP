/**
 * BudgetMutex — Phase 5 T-PHASE5-CONCURRENCY-HARDEN.
 *
 * Addresses Phase 4 Stage 2.5 M3 finding (Budget concurrency serialization):
 * two concurrent LLM calls against the same audit_run must never double-debit
 * `audit_runs.budget_remaining_usd`. Current Phase 4 LLMAdapter uses a
 * per-transaction row lock (`SELECT ... FOR UPDATE` inside `withClient`),
 * which is serializable per-transaction but races across transactions when
 * Phase 8 lands parallel browse + analyze subgraphs against one audit_run.
 *
 * CHOICE: Option (b) — application-level mutex per `audit_run_id`.
 *
 * RATIONALE:
 *   - MVP is single-process (one CLI invocation per audit; LangGraph runs
 *     nodes sequentially within one graph.invoke). Cross-process concurrency
 *     does not exist yet.
 *   - PG advisory lock (option a) adds a DB round-trip per LLM call to defend
 *     a race that cannot occur in MVP — overkill.
 *   - When Phase 8 widens to parallel subgraphs in one process, this mutex
 *     serializes them at the application boundary BEFORE the LLMAdapter
 *     transaction even starts. No DB round-trip; no lock contention at PG.
 *   - When multi-process MVP arrives (Phase 9+ dashboard/CLI multiplex),
 *     option (a) PG advisory lock supersedes this helper; the wire-in site
 *     swaps `withLock` for `withBudgetLock` with no caller-side changes
 *     because the signature is identical.
 *
 * SCOPE NOTE:
 *   This file ships the helper only. It is NOT wired into BrowseNode or the
 *   BrowseGraph deps interface — that lands at Phase 7/8 alongside the
 *   LLMAdapter+BudgetGate integration (touching BrowseGraphDeps is a Stage 4
 *   risk for Phase 5). The conformance test exercises serialization +
 *   no-leak + concurrent-order guarantees standalone.
 *
 * Constitution compliance:
 *   R9 adapter pattern: zero vendor SDK imports (pure TS/Node).
 *   R10.1 file ≤ 100 LOC; R10.2 named exports only; R10.3 funcs ≤ 50 LOC.
 *   R13 no `any`; no `console.log`.
 *   R14 Pino correlation: `audit_run_id` bound on every emitted log line.
 *   R25 no judgment fields; this is orchestration plumbing only.
 */
import { createChildLogger, createLogger, type Logger } from '../observability/logger.js';

export interface BudgetMutexHandle {
  /** Serializes `fn` against any in-flight call for the same auditRunId.
   * Resolves with `fn()`'s return value (or rejects with its error). Errors
   * inside `fn` do NOT poison the queue — the next caller proceeds normally. */
  withLock<T>(auditRunId: string, fn: () => Promise<T>): Promise<T>;
  /** Test-only: count of audit_run_ids with a tail in flight. */
  inFlightCount(): number;
}

export function createBudgetMutex(logger?: Logger): BudgetMutexHandle {
  const base = logger ?? createLogger('budget-mutex');
  // Map<auditRunId, tail promise>. Tail is the promise of the LAST queued task;
  // new callers chain off it. Entries are deleted when their tail is also the
  // latest tail AND it settles — preventing memory leak under steady churn.
  const tails = new Map<string, Promise<unknown>>();

  async function withLock<T>(auditRunId: string, fn: () => Promise<T>): Promise<T> {
    const log = createChildLogger(base, { audit_run_id: auditRunId, node_name: 'budget_mutex' });
    const previous = tails.get(auditRunId) ?? Promise.resolve();
    // Suppress upstream rejections so one caller's failure cannot reject
    // downstream waiters before their `fn()` even runs.
    const gated: Promise<T> = previous.catch(() => undefined).then(() => fn());
    tails.set(auditRunId, gated);
    log.debug({ in_flight: tails.size }, 'budget_mutex.acquired');
    try {
      return await gated;
    } finally {
      // Only clear the entry if it still points at OUR tail — a later caller
      // may have already replaced it. This is the no-leak guarantee.
      if (tails.get(auditRunId) === gated) {
        tails.delete(auditRunId);
        log.debug({ in_flight: tails.size }, 'budget_mutex.released');
      }
    }
  }

  return { withLock, inFlightCount: () => tails.size };
}

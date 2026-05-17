/**
 * BudgetMutex conformance — Phase 5 T-PHASE5-CONCURRENCY-HARDEN.
 *
 * Source:
 *   packages/agent-core/src/orchestration/BudgetMutex.ts
 *   docs/specs/mvp/phases/phase-5-browse-mvp/tasks.md L268 (T-PHASE5-CONCURRENCY-HARDEN)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/phase-4-current.md §4 M3
 *
 * Contract under test:
 *   - Serialization: two concurrent withLock() calls on the same audit_run_id
 *     execute sequentially (the second starts only after the first resolves).
 *   - No leak: the internal Map<auditRunId, tail> empties after all tails
 *     settle (steady-state inFlightCount() == 0).
 *   - Order preservation: N concurrent calls produce results in submission order;
 *     a rejection from one caller does NOT block subsequent callers.
 *
 * GREEN-from-the-start (Phase 5 polish; no RED scaffold phase).
 */
import { describe, expect, it } from 'vitest';

import { createBudgetMutex } from '../../src/orchestration/BudgetMutex.js';

const AUDIT_RUN_A = '00000000-0000-4000-8000-000000000a01';
const AUDIT_RUN_B = '00000000-0000-4000-8000-000000000a02';

/** Resolves after `ms` ticks of the microtask queue + a real timer. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('BudgetMutex — Phase 5 T-PHASE5-CONCURRENCY-HARDEN', () => {
  it('serializes concurrent withLock() calls for the same audit_run_id', async () => {
    const mutex = createBudgetMutex();
    const events: string[] = [];

    const first = mutex.withLock(AUDIT_RUN_A, async () => {
      events.push('A1.start');
      await delay(20);
      events.push('A1.end');
      return 1;
    });
    const second = mutex.withLock(AUDIT_RUN_A, async () => {
      events.push('A2.start');
      await delay(5);
      events.push('A2.end');
      return 2;
    });

    const [r1, r2] = await Promise.all([first, second]);
    expect(r1).toBe(1);
    expect(r2).toBe(2);
    // Critical: A2 starts AFTER A1 ends — no interleaving.
    expect(events).toEqual(['A1.start', 'A1.end', 'A2.start', 'A2.end']);
  });

  it('does not leak tails — inFlightCount returns to 0 after all calls settle', async () => {
    const mutex = createBudgetMutex();
    expect(mutex.inFlightCount()).toBe(0);

    const tasks = [
      mutex.withLock(AUDIT_RUN_A, async () => { await delay(5); return 'a'; }),
      mutex.withLock(AUDIT_RUN_A, async () => { await delay(5); return 'b'; }),
      mutex.withLock(AUDIT_RUN_B, async () => { await delay(5); return 'c'; }),
    ];
    // While in-flight, both audit_run_ids should be tracked.
    expect(mutex.inFlightCount()).toBeGreaterThan(0);

    await Promise.all(tasks);
    expect(mutex.inFlightCount()).toBe(0);
  });

  it('preserves submission order even when an upstream caller rejects', async () => {
    const mutex = createBudgetMutex();
    const results: string[] = [];

    const t1 = mutex.withLock(AUDIT_RUN_A, async () => {
      await delay(5);
      throw new Error('t1-boom');
    });
    const t2 = mutex.withLock(AUDIT_RUN_A, async () => {
      results.push('t2');
      await delay(3);
      return 't2-ok';
    });
    const t3 = mutex.withLock(AUDIT_RUN_A, async () => {
      results.push('t3');
      return 't3-ok';
    });

    await expect(t1).rejects.toThrow('t1-boom');
    await expect(t2).resolves.toBe('t2-ok');
    await expect(t3).resolves.toBe('t3-ok');
    // t1 rejected, but t2 and t3 still ran in order behind it.
    expect(results).toEqual(['t2', 't3']);
    expect(mutex.inFlightCount()).toBe(0);
  });

  it('allows different audit_run_ids to proceed concurrently (no global lock)', async () => {
    const mutex = createBudgetMutex();
    const events: string[] = [];

    const a = mutex.withLock(AUDIT_RUN_A, async () => {
      events.push('A.start');
      await delay(20);
      events.push('A.end');
    });
    const b = mutex.withLock(AUDIT_RUN_B, async () => {
      events.push('B.start');
      await delay(5);
      events.push('B.end');
    });

    await Promise.all([a, b]);
    // B finishes BEFORE A — proves the lock is per-audit_run_id, not global.
    // Both start before either ends → concurrent.
    expect(events.indexOf('B.start')).toBeLessThan(events.indexOf('A.end'));
    expect(events.indexOf('B.end')).toBeLessThan(events.indexOf('A.end'));
  });
});

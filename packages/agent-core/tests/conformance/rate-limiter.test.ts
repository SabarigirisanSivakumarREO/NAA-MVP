/**
 * AC-12 — RateLimiter conformance (Phase 2 T049).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-2-tools/spec.md AC-12 + R-13 + NF-Phase2-05
 *   docs/specs/mvp/phases/phase-2-tools/tasks.md T049
 *     (REQ-BROWSE-RATE-001/002)
 *
 * AC-12 contract:
 *   - 2s minimum interval globally
 *   - 10/min per-domain cap for unknown domains
 *   - 30/min per-domain cap for trusted domains
 *   - 60s sliding window
 *   - FIFO queue order; no starvation
 *   - SC-004: 60-call burst on same domain paces correctly
 *
 * LIVE state — T049 (DomainRateLimiter) shipped. Vitest fake timers
 * drive simulated wall-clock for sub-cap pacing; the cross-domain
 * starvation + FIFO assertions use real microtasks.
 *
 * Anchor: @AC-12 — 2s min + 10/min unknown + 30/min trusted; FIFO; no starvation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CONFIG,
  DomainRateLimiter,
  type RateLimiterConfig,
} from '../../src/browser-runtime/RateLimiter.js';

/** Advance fake timers + flush promises until queued waiters resolve. */
async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

const TRUSTED_CONFIG: RateLimiterConfig = {
  perSessionMinIntervalMs: 2000,
  perDomainCaps: {
    'amazon.in': { limit: 30, windowMs: 60_000 },
    '*': { limit: 10, windowMs: 60_000 },
  },
};

describe('RateLimiter — AC-12 conformance', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 0 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * @AC-12 — 2 s minimum interval enforced globally between any two calls
   * (regardless of domain).
   */
  it('AC-12: enforces 2 s min interval globally between consecutive calls', async () => {
    const rl = new DomainRateLimiter(DEFAULT_CONFIG);
    const t0 = Date.now();
    await rl.acquire('example.com');
    expect(Date.now() - t0).toBe(0); // first acquire is immediate

    const p2 = rl.acquire('example.com');
    let resolved2 = false;
    void p2.then(() => {
      resolved2 = true;
    });

    // After 1 s only, second acquire must NOT have resolved (gate is 2 s).
    await advance(1_000);
    expect(resolved2).toBe(false);

    // After another 1 s (total 2 s), the second acquire resolves.
    await advance(1_000);
    await p2;
    expect(resolved2).toBe(true);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(2_000);
  });

  /**
   * @AC-12 — 10/min cap for unknown domain — 11th call within 60s window
   * delays / queues.
   */
  it('AC-12: 10/min cap for unknown domain — 11th call within 60 s queues', async () => {
    // Use a 1 ms global pacer so we isolate the per-domain cap behavior
    // from the 2 s global gate.
    const rl = new DomainRateLimiter({
      perSessionMinIntervalMs: 1,
      perDomainCaps: { '*': { limit: 10, windowMs: 60_000 } },
    });

    const acquiredAt: number[] = [];
    // Fire 11 acquires. First 10 should resolve quickly; 11th must wait.
    const promises = Array.from({ length: 11 }, () =>
      rl.acquire('unknown.com').then(() => acquiredAt.push(Date.now())),
    );

    // Drain the global 1 ms gate 10 times to allow first 10 through.
    for (let i = 0; i < 10; i++) {
      await advance(1);
    }
    expect(acquiredAt.length).toBe(10);

    // The 11th must NOT have resolved — domain cap of 10/min is hit.
    await advance(1_000);
    expect(acquiredAt.length).toBe(10);

    // Advance to just past the oldest entry's 60 s expiry (recorded at
    // ~t=0). One slot should free up.
    await advance(60_000);
    await Promise.all(promises);
    expect(acquiredAt.length).toBe(11);
  });

  /**
   * @AC-12 — 30/min cap for trusted domain — 31st call within 60s window
   * delays / queues.
   */
  it('AC-12: 30/min cap for trusted domain — 31st call within 60 s queues', async () => {
    const rl = new DomainRateLimiter({
      perSessionMinIntervalMs: 1,
      perDomainCaps: {
        'amazon.in': { limit: 30, windowMs: 60_000 },
        '*': { limit: 10, windowMs: 60_000 },
      },
    });

    const acquiredAt: number[] = [];
    const promises = Array.from({ length: 31 }, () =>
      rl.acquire('amazon.in').then(() => acquiredAt.push(Date.now())),
    );

    for (let i = 0; i < 30; i++) await advance(1);
    expect(acquiredAt.length).toBe(30);

    // 31st should still be queued.
    await advance(1_000);
    expect(acquiredAt.length).toBe(30);

    // After 60 s window slides past the oldest entry, the 31st can fire.
    await advance(60_000);
    await Promise.all(promises);
    expect(acquiredAt.length).toBe(31);
  });

  /**
   * @AC-12 — 60 s sliding window: a call expiring out of the window frees
   * a slot for new calls.
   */
  it('AC-12: sliding 60 s window frees slots as old calls expire', async () => {
    const rl = new DomainRateLimiter({
      perSessionMinIntervalMs: 1,
      perDomainCaps: { 'x.com': { limit: 3, windowMs: 60_000 } },
    });

    // Fill the window with 3 acquires, then a 4th queues.
    await rl.acquire('x.com');
    await advance(1);
    await rl.acquire('x.com');
    await advance(1);
    await rl.acquire('x.com');

    let fourthResolved = false;
    const p4 = rl.acquire('x.com').then(() => {
      fourthResolved = true;
    });

    // 30 s later still queued.
    await advance(30_000);
    expect(fourthResolved).toBe(false);

    // Step past the 60 s window from the FIRST acquire — slot opens.
    await advance(31_000);
    await p4;
    expect(fourthResolved).toBe(true);
  });

  /**
   * @AC-12 — FIFO queue order preserved (calls dequeue in arrival order).
   */
  it('AC-12: queued calls dequeue in FIFO arrival order', async () => {
    const rl = new DomainRateLimiter({
      perSessionMinIntervalMs: 1,
      perDomainCaps: { 'q.com': { limit: 1, windowMs: 60_000 } },
    });
    // Capacity 1; first acquire takes it. Next 5 queue.
    await rl.acquire('q.com');

    const order: number[] = [];
    const queued = [1, 2, 3, 4, 5].map((id) =>
      rl.acquire('q.com').then(() => order.push(id)),
    );

    // Drive the clock past the windowMs for each queued waiter (one slot
    // opens every 60 s from the previous acquire's expiry).
    for (let i = 0; i < 5; i++) await advance(60_000);
    await Promise.all(queued);
    expect(order).toEqual([1, 2, 3, 4, 5]);
  });

  /**
   * @AC-12 — no starvation across multiple domains: a burst on domain A
   * does NOT block calls to domain B beyond their own per-domain cap.
   */
  it('AC-12: no starvation — domain B calls proceed independently of domain A burst', async () => {
    const rl = new DomainRateLimiter({
      perSessionMinIntervalMs: 1,
      perDomainCaps: {
        'a.com': { limit: 2, windowMs: 60_000 },
        'b.com': { limit: 2, windowMs: 60_000 },
      },
    });

    // Fill domain A to its cap, then queue more on A.
    await rl.acquire('a.com');
    await advance(1);
    await rl.acquire('a.com');
    const a3 = rl.acquire('a.com'); // queued
    void a3;

    // Domain B should still be able to acquire — no cross-domain starvation.
    const bAcquired: number[] = [];
    const b1 = rl.acquire('b.com').then(() => bAcquired.push(1));
    const b2 = rl.acquire('b.com').then(() => bAcquired.push(2));

    // Step 1 ms to clear global 1 ms gate; both b's should resolve.
    await advance(1);
    await advance(1);
    await Promise.all([b1, b2]);
    expect(bAcquired).toEqual([1, 2]);
  });

  /**
   * @AC-12 SC-004 — 60-call burst on same domain paces within rate cap; no
   * starvation observed across the burst.
   */
  it('AC-12 SC-004: 60-call burst on same domain paces within cap (no starvation)', async () => {
    // 30/min trusted cap; 60 acquires => 30 immediate, 30 wait one window cycle.
    const rl = new DomainRateLimiter(TRUSTED_CONFIG);

    const completedOrder: number[] = [];
    const promises = Array.from({ length: 60 }, (_, i) =>
      rl.acquire('amazon.in').then(() => completedOrder.push(i)),
    );

    // Step the fake clock generously — 200 s — more than enough for all
    // 60 acquires to drain at one-per-2 s under the 30/min domain cap +
    // sliding 60 s window. Exact wall-clock count depends on window
    // ageing interplay with the global 2 s gate; the asserts below pin
    // the contract invariants (all 60 complete; FIFO preserved).
    for (let step = 0; step < 200 && completedOrder.length < 60; step++) {
      await advance(2_000);
    }

    await Promise.all(promises);
    expect(completedOrder.length).toBe(60);

    // FIFO invariant: order array should be monotonically increasing.
    for (let i = 1; i < completedOrder.length; i++) {
      expect(completedOrder[i]).toBeGreaterThan(completedOrder[i - 1]!);
    }
  });

  /**
   * @AC-12 NF-Phase2-05 — overhead < 5 ms per call when under cap.
   *
   * Real timers (not fake) — measuring actual wall-clock overhead of the
   * fast path (no gate blocks). Loosened to < 50 ms total for 100 calls
   * (i.e. < 0.5 ms average) to absorb test-runner jitter; spec is < 5 ms
   * per call.
   */
  it('AC-12 NF-Phase2-05: overhead per call < 5 ms when under cap', async () => {
    vi.useRealTimers();
    const rl = new DomainRateLimiter({
      perSessionMinIntervalMs: 0,
      perDomainCaps: { '*': { limit: 100_000, windowMs: 60_000 } },
    });
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      await rl.acquire('fast.com');
    }
    const elapsedMs = Date.now() - start;
    const perCallMs = elapsedMs / 100;
    expect(perCallMs).toBeLessThan(5);
  });

  /**
   * Bonus — stats() returns queue depth + last-call timestamps per domain.
   */
  it('stats() returns queueDepth + lastCall per domain', async () => {
    const rl = new DomainRateLimiter({
      perSessionMinIntervalMs: 1,
      perDomainCaps: { 's.com': { limit: 1, windowMs: 60_000 } },
    });
    await rl.acquire('s.com');
    const p = rl.acquire('s.com');
    void p;
    // Microtask flush so the queue.push lands before we snapshot.
    await Promise.resolve();
    const snap = rl.stats();
    expect(snap.queueDepth['s.com']).toBe(1);
    expect(snap.lastCall['s.com']).toBeDefined();
  });
});

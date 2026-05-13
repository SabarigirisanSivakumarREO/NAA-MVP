/**
 * RateLimiter — T049 Phase 2 structural rate limiter.
 *
 * Source: phases/phase-2-tools/spec.md AC-12 + R-13 + NF-Phase2-05;
 *   tasks.md T049 (REQ-BROWSE-RATE-001 + REQ-BROWSE-RATE-002).
 *
 * Enforces in CODE (R8.3 — NOT in prompts; LLM cannot bypass):
 *   - 2 s minimum interval globally between any two acquires.
 *   - Per-domain sliding 60 s window cap (default 10/min for unknown,
 *     configurable per-domain cap such as 30/min for trusted).
 *   - FIFO queue order per domain — no starvation across a burst.
 *
 * Used by Phase 5 BrowseNode + Phase 4 SafetyCheck. Pure JS timing
 * via `Date.now()` + setTimeout — no external timer libs.
 *
 * Adapter discipline (R9): RateLimiter is its own contract (see
 * impact.md §RateLimiter). Interface shape (RateLimiterConfig +
 * RateLimiter) is canonical from impact.md; this module implements.
 *
 * Semantics:
 *   - `acquire(domain)` resolves when BOTH (a) ≥ globalMin ms have
 *     elapsed since the last acquire-resolution globally, AND (b) the
 *     domain has < cap timestamps in the trailing windowMs. On
 *     resolution, the call's timestamp is recorded against that
 *     domain (consumes one slot). Callers that wait are queued in FIFO
 *     arrival order; later waiters NEVER overtake earlier waiters on
 *     the same domain (no starvation per AC-12).
 *   - `release(domain)` is a hint that the caller has finished its
 *     work. It does NOT free a slot (slots only free when timestamps
 *     age out of the 60 s window) but it nudges the queue scheduler
 *     to re-evaluate immediately. Exposed for API symmetry with the
 *     impact.md contract and forward-compat with future in-flight
 *     bounded-concurrency semantics.
 */
import { createLogger, type LogBindings, type Logger } from '../observability/logger.js';

/** Canonical config shape per phase-2-tools/impact.md §RateLimiter. */
export interface RateLimiterConfig {
  /** Default 2000 ms — applies to ALL acquires regardless of domain. */
  perSessionMinIntervalMs: number;
  /**
   * Per-domain caps. Keys are domain strings (e.g. `amazon.in`) or
   * the wildcard `'*'` (fallback when no exact-domain entry matches).
   * Example: `{ 'amazon.in': { limit: 30, windowMs: 60000 }, '*': { limit: 10, windowMs: 60000 } }`.
   */
  perDomainCaps: Record<string, { limit: number; windowMs: number }>;
}

/** Canonical interface per phase-2-tools/impact.md §RateLimiter. */
export interface RateLimiter {
  /** Resolve when this call may proceed; consumes one slot on resolution. */
  acquire(domain: string): Promise<void>;
  /** Release token / advance queue. Hint that work completed. */
  release(domain: string): void;
  /** Snapshot of queue depths + last-call timestamps per domain. */
  stats(): { queueDepth: Record<string, number>; lastCall: Record<string, number> };
}

/** Default 2 s global pacer + 10/min wildcard fallback. */
export const DEFAULT_CONFIG: RateLimiterConfig = {
  perSessionMinIntervalMs: 2000,
  perDomainCaps: {
    '*': { limit: 10, windowMs: 60_000 },
  },
};

interface Waiter {
  resolve: () => void;
  enqueuedAt: number;
}

const WILDCARD = '*';

export class DomainRateLimiter implements RateLimiter {
  private readonly cfg: RateLimiterConfig;
  private readonly log: Logger = createLogger('rate-limiter');

  /** FIFO queue per domain. Front of array = next to wake. */
  private readonly queues = new Map<string, Waiter[]>();
  /** Timestamps of resolved acquires per domain (sliding window). */
  private readonly windows = new Map<string, number[]>();
  /**
   * Last acquire-resolution timestamp globally (for 2 s min gate).
   * Initialized to `-Infinity` so the very first acquire is not gated
   * by the global pacer (covers fake-timer `Date.now() === 0` edge).
   */
  private lastGlobalAcquireMs = Number.NEGATIVE_INFINITY;
  /** Pending wake timer per domain — coalesces repeat schedules. */
  private readonly wakeTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(cfg: RateLimiterConfig = DEFAULT_CONFIG, logCtx?: LogBindings) {
    this.cfg = cfg;
    if (logCtx) this.log = this.log.child(logCtx);
  }

  async acquire(domain: string): Promise<void> {
    const cap = this.capFor(domain);
    const queue = this.getQueue(domain);
    // Fast path: queue empty AND both gates open right now → grant immediately.
    if (queue.length === 0 && this.gatesOpen(domain, cap)) {
      this.recordAcquire(domain);
      return;
    }
    // Slow path: enqueue + wait. FIFO is preserved because we ONLY wake
    // the front of the queue; later waiters never overtake earlier ones.
    return new Promise<void>((resolve) => {
      queue.push({ resolve, enqueuedAt: Date.now() });
      this.log.debug(
        { event: 'rate.queued', domain, queue_depth: queue.length },
        'rate limiter queued waiter',
      );
      this.scheduleWake(domain);
    });
  }

  release(domain: string): void {
    // Slots are not freed on release (sliding-window semantics — slots
    // free as timestamps age out of windowMs). We do nudge the queue
    // scheduler in case `lastGlobalAcquireMs` was the only thing
    // gating the next waiter and a subsequent caller's clock tick
    // would otherwise be the only trigger.
    this.scheduleWake(domain);
  }

  stats(): { queueDepth: Record<string, number>; lastCall: Record<string, number> } {
    const queueDepth: Record<string, number> = {};
    const lastCall: Record<string, number> = {};
    for (const [d, q] of this.queues) queueDepth[d] = q.length;
    for (const [d, ts] of this.windows) {
      if (ts.length > 0) lastCall[d] = ts[ts.length - 1]!;
    }
    return { queueDepth, lastCall };
  }

  // --- internals ----------------------------------------------------------

  private capFor(domain: string): { limit: number; windowMs: number } {
    return (
      this.cfg.perDomainCaps[domain] ??
      this.cfg.perDomainCaps[WILDCARD] ??
      DEFAULT_CONFIG.perDomainCaps[WILDCARD]!
    );
  }

  private getQueue(domain: string): Waiter[] {
    let q = this.queues.get(domain);
    if (!q) {
      q = [];
      this.queues.set(domain, q);
    }
    return q;
  }

  private getWindow(domain: string): number[] {
    let w = this.windows.get(domain);
    if (!w) {
      w = [];
      this.windows.set(domain, w);
    }
    return w;
  }

  /** Trim entries older than windowMs from the trailing edge. */
  private trim(domain: string, windowMs: number): void {
    const w = this.getWindow(domain);
    if (w.length === 0) return;
    const cutoff = Date.now() - windowMs;
    let i = 0;
    while (i < w.length && w[i]! <= cutoff) i++;
    if (i > 0) w.splice(0, i);
  }

  /** True iff both global-min and per-domain-cap gates are open NOW. */
  private gatesOpen(domain: string, cap: { limit: number; windowMs: number }): boolean {
    this.trim(domain, cap.windowMs);
    const now = Date.now();
    if (now - this.lastGlobalAcquireMs < this.cfg.perSessionMinIntervalMs) return false;
    return this.getWindow(domain).length < cap.limit;
  }

  /** Record a resolved acquire — update window + global clock. */
  private recordAcquire(domain: string): void {
    const now = Date.now();
    this.getWindow(domain).push(now);
    this.lastGlobalAcquireMs = now;
  }

  /**
   * Compute the earliest ms-from-now at which `domain`'s gates could open.
   * Returns 0 if open now. Drives setTimeout scheduling.
   */
  private msUntilOpen(domain: string, cap: { limit: number; windowMs: number }): number {
    const now = Date.now();
    const globalWaitMs = Math.max(0, this.lastGlobalAcquireMs + this.cfg.perSessionMinIntervalMs - now);
    this.trim(domain, cap.windowMs);
    const w = this.getWindow(domain);
    let domainWaitMs = 0;
    if (w.length >= cap.limit) {
      // Earliest slot opens when the oldest in-window timestamp ages out.
      const oldest = w[w.length - cap.limit]!;
      domainWaitMs = Math.max(0, oldest + cap.windowMs - now);
    }
    return Math.max(globalWaitMs, domainWaitMs);
  }

  /**
   * Schedule a wake attempt for `domain` at the earliest possible time
   * its gates could open. Coalesces repeat schedules — only ONE pending
   * timer per domain.
   */
  private scheduleWake(domain: string): void {
    if (this.wakeTimers.has(domain)) return;
    const queue = this.getQueue(domain);
    if (queue.length === 0) return;
    const cap = this.capFor(domain);
    const delay = this.msUntilOpen(domain, cap);
    const timer = setTimeout(() => {
      this.wakeTimers.delete(domain);
      this.tryDrain(domain);
    }, delay);
    this.wakeTimers.set(domain, timer);
  }

  /**
   * Try to wake the FRONT of the queue. If gates open, resolve it +
   * record + recurse (next waiter may also be ready, e.g. global gate
   * still allows). If not, reschedule.
   *
   * FIFO invariant: we ONLY ever dequeue from index 0. Later waiters
   * are blocked until earlier ones resolve.
   */
  private tryDrain(domain: string): void {
    const queue = this.getQueue(domain);
    if (queue.length === 0) return;
    const cap = this.capFor(domain);
    if (!this.gatesOpen(domain, cap)) {
      this.scheduleWake(domain);
      return;
    }
    const waiter = queue.shift()!;
    this.recordAcquire(domain);
    this.log.debug(
      {
        event: 'rate.granted',
        domain,
        queue_depth: queue.length,
        wait_ms: Date.now() - waiter.enqueuedAt,
      },
      'rate limiter granted',
    );
    waiter.resolve();
    // After a grant, the global 2 s gate WILL block the next waiter
    // on this domain; schedule a wake for them. Other domains are
    // similarly woken — their queues are independent map entries but
    // share the global clock, so nudge each.
    if (queue.length > 0) this.scheduleWake(domain);
    for (const otherDomain of this.queues.keys()) {
      if (otherDomain !== domain && this.getQueue(otherDomain).length > 0) {
        this.scheduleWake(otherDomain);
      }
    }
  }
}

/** Convenience factory matching the rest of browser-runtime exports. */
export function createRateLimiter(cfg?: RateLimiterConfig, logCtx?: LogBindings): RateLimiter {
  return new DomainRateLimiter(cfg, logCtx);
}

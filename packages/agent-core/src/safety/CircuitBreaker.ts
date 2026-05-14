/**
 * Phase 4 T069 — CircuitBreaker: per-domain consecutive-failure tripper.
 *
 * Source: phases/phase-4-safety-infra-cost/spec.md AC-04 (v0.4);
 *         phases/phase-4-safety-infra-cost/tasks.md T069
 *         (REQ-SAFETY-CIRCUIT-BREAKER-001).
 *
 * Contract (AC-04):
 *   - recordFailure(domain) — Nth consecutive failure (default N=3) trips
 *     the breaker: `blockedUntil = Date.now() + blockDurationMs` (default 1h).
 *   - isOpen(domain)        — true iff a non-expired `blockedUntil` exists.
 *     Expired state self-clears on read (lazy reset; no background timer).
 *   - reset(domain)         — drop all state for the domain immediately.
 *   - recordSuccess(domain) — clear the failure STREAK without affecting an
 *     in-flight block. Brief lists this in the public API; real callers
 *     (SafetyCheck T067, future BrowseNode) need a way to mark recovery
 *     without waiting an hour. AC-04 doesn't directly exercise it.
 *
 * "Consecutive" — a single success between failures resets the streak;
 * otherwise transient blips on healthy domains accrete unboundedly. This
 * module only sees recordFailure / recordSuccess; consecutiveness is
 * preserved by zeroing the counter on success / reset / window-expiry.
 *
 * Storage: in-memory `Map<domain, DomainState>` (MVP). Phase 8 swaps in
 * Redis-backed shared state across workers (tasks.md L229). No persistence
 * on restart — acceptable per the brief.
 *
 * Clock: `Date.now()` directly. Vitest's `vi.useFakeTimers({ now: 0 })` +
 * `vi.advanceTimersByTime()` mock the global Date, so the conformance test
 * verifies the 1-hour window without clock injection. Threading a clock
 * parameter would add API surface for zero MVP benefit (R10.3).
 *
 * R10.1: file ≤ 150 lines (tasks.md T069). R10.3: named exports only.
 */
import { createLogger, type Logger } from '../observability/logger.js';

const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_BLOCK_DURATION_MS = 3_600_000; // 1 hour — AC-04 window.

/**
 * Tunables for the breaker. Both fields optional; defaults match AC-04
 * (3 consecutive failures, 1-hour block window — tasks.md L228).
 */
export interface CircuitBreakerConfig {
  failureThreshold?: number;
  blockDurationMs?: number;
}

interface DomainState {
  /** Consecutive failures since last success / reset / window-expiry. */
  failureCount: number;
  /** Epoch ms when the current block ends; `null` if not currently blocked. */
  blockedUntil: number | null;
}

/**
 * Per-domain breaker. Pure logic; no IO. Thread-safety not required
 * (single-threaded Node + MVP scope per CLAUDE.md §11 + task brief).
 */
export class CircuitBreaker {
  readonly #failureThreshold: number;
  readonly #blockDurationMs: number;
  readonly #state = new Map<string, DomainState>();
  readonly #logger: Logger;

  constructor(config: CircuitBreakerConfig = {}) {
    this.#failureThreshold = config.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.#blockDurationMs = config.blockDurationMs ?? DEFAULT_BLOCK_DURATION_MS;
    this.#logger = createLogger('circuit-breaker');
  }

  /**
   * Record one failure for `domain`. If the resulting streak hits the
   * threshold, trip the breaker (set `blockedUntil = now + blockDurationMs`).
   * Idempotent on already-open breakers — additional failures during a
   * block do NOT extend the window (R11.x: predictable timing).
   */
  recordFailure(domain: string): void {
    const now = Date.now();
    const current = this.#getActiveState(domain, now);
    current.failureCount += 1;

    if (current.blockedUntil === null && current.failureCount >= this.#failureThreshold) {
      current.blockedUntil = now + this.#blockDurationMs;
      this.#logger.child({ domain }).warn(
        { failure_count: current.failureCount, blocked_until: current.blockedUntil },
        'circuit_breaker_tripped',
      );
    }
    this.#state.set(domain, current);
  }

  /**
   * Clear the consecutive-failure streak for `domain`. Does NOT close
   * an active block — once tripped the window must elapse (or `reset`
   * must be called explicitly). This mirrors classic circuit-breaker
   * "half-open" semantics minus the probe step (deferred post-MVP).
   */
  recordSuccess(domain: string): void {
    const existing = this.#state.get(domain);
    if (!existing) return;
    if (existing.failureCount > 0) {
      this.#logger.child({ domain }).debug(
        { failure_count: existing.failureCount },
        'circuit_breaker_streak_reset',
      );
      existing.failureCount = 0;
      this.#state.set(domain, existing);
    }
  }

  /**
   * True iff `domain` is currently inside an active block window. Lazily
   * expires + resets state on read once `Date.now() >= blockedUntil`.
   */
  isOpen(domain: string): boolean {
    const existing = this.#state.get(domain);
    if (!existing || existing.blockedUntil === null) return false;
    if (Date.now() >= existing.blockedUntil) {
      // Window elapsed — auto-reset per AC-04 "resets after window".
      this.#state.delete(domain);
      this.#logger.child({ domain }).info('circuit_breaker_window_expired');
      return false;
    }
    return true;
  }

  /** Drop all state for `domain` (force-close any active block). */
  reset(domain: string): void {
    if (this.#state.delete(domain)) {
      this.#logger.child({ domain }).info('circuit_breaker_reset');
    }
  }

  /**
   * Fetch the current `DomainState`, auto-expiring any stale block so
   * recordFailure starts a fresh streak after the window elapses.
   */
  #getActiveState(domain: string, now: number): DomainState {
    const existing = this.#state.get(domain);
    if (!existing) return { failureCount: 0, blockedUntil: null };
    if (existing.blockedUntil !== null && now >= existing.blockedUntil) {
      return { failureCount: 0, blockedUntil: null };
    }
    return existing;
  }
}

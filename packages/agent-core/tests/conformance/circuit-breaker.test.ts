/**
 * AC-04 — CircuitBreaker conformance (Phase 4 T069).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-04
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T069
 *     (REQ-SAFETY-CIRCUIT-BREAKER-001)
 *
 * AC-04 contract:
 *   - recordFailure(domain), isOpen(domain), reset(domain)
 *   - Trips after 3 consecutive failures on a domain
 *   - Blocks for 1 hour (3_600_000 ms) — window verifiable via fake timers
 *   - Resets after window
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). Module absent → import fails.
 *
 * Anchor: @AC-04 — 3-failure trip, 1-hour block window.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CircuitBreaker } from '../../src/safety/CircuitBreaker.js';

describe('CircuitBreaker — AC-04 conformance (RED until T069)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 0 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('AC-04: 0 failures → isOpen(domain) === false', () => {
    const breaker = new CircuitBreaker();
    expect(breaker.isOpen('example.com')).toBe(false);
  });

  it('AC-04: 2 failures (below threshold) → still closed', () => {
    const breaker = new CircuitBreaker();
    breaker.recordFailure('example.com');
    breaker.recordFailure('example.com');
    expect(breaker.isOpen('example.com')).toBe(false);
  });

  it('AC-04: 3 consecutive failures → isOpen returns true', () => {
    const breaker = new CircuitBreaker();
    breaker.recordFailure('example.com');
    breaker.recordFailure('example.com');
    breaker.recordFailure('example.com');
    expect(breaker.isOpen('example.com')).toBe(true);
  });

  it('AC-04: block window is per-domain — other domain still closed', () => {
    const breaker = new CircuitBreaker();
    for (let i = 0; i < 3; i++) breaker.recordFailure('a.example.com');
    expect(breaker.isOpen('a.example.com')).toBe(true);
    expect(breaker.isOpen('b.example.com')).toBe(false);
  });

  it('AC-04: 1-hour window elapses → breaker resets (isOpen=false)', () => {
    const breaker = new CircuitBreaker();
    for (let i = 0; i < 3; i++) breaker.recordFailure('example.com');
    expect(breaker.isOpen('example.com')).toBe(true);
    // Advance > 1 hour
    vi.advanceTimersByTime(3_600_001);
    expect(breaker.isOpen('example.com')).toBe(false);
  });

  it('AC-04: reset(domain) explicitly clears state without time advance', () => {
    const breaker = new CircuitBreaker();
    for (let i = 0; i < 3; i++) breaker.recordFailure('example.com');
    expect(breaker.isOpen('example.com')).toBe(true);
    breaker.reset('example.com');
    expect(breaker.isOpen('example.com')).toBe(false);
  });
});

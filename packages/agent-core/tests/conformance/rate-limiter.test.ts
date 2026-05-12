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
 * RED state — implementation lands at T049 (Wave 5+). All assertions
 *   `it.todo` until then.
 *
 * Anchor: @AC-12 — 2s min + 10/min unknown + 30/min trusted; FIFO; no starvation.
 */
import { describe, it } from 'vitest';

// NOTE (R3.1): import deliberately commented out so this file compiles +
// loads cleanly until T049 lands. Uncomment when RateLimiter.ts exists:
// import { DomainRateLimiter } from '../../src/browser-runtime/RateLimiter.js';

describe('RateLimiter — AC-12 conformance (Wave 0 RED)', () => {
  /**
   * @AC-12 — 2 s minimum interval enforced globally between any two calls
   * (regardless of domain).
   */
  it.todo('AC-12: enforces 2 s min interval globally between consecutive calls');

  /**
   * @AC-12 — 10/min cap for unknown domain — 11th call within 60s window
   * delays / queues.
   */
  it.todo('AC-12: 10/min cap for unknown domain — 11th call within 60 s queues');

  /**
   * @AC-12 — 30/min cap for trusted domain — 31st call within 60s window
   * delays / queues.
   */
  it.todo('AC-12: 30/min cap for trusted domain — 31st call within 60 s queues');

  /**
   * @AC-12 — 60 s sliding window: a call expiring out of the window frees
   * a slot for new calls.
   */
  it.todo('AC-12: sliding 60 s window frees slots as old calls expire');

  /**
   * @AC-12 — FIFO queue order preserved (calls dequeue in arrival order).
   */
  it.todo('AC-12: queued calls dequeue in FIFO arrival order');

  /**
   * @AC-12 — no starvation across multiple domains: a burst on domain A
   * does NOT block calls to domain B beyond their own per-domain cap.
   */
  it.todo('AC-12: no starvation — domain B calls proceed independently of domain A burst');

  /**
   * @AC-12 SC-004 — 60-call burst on same domain paces within rate cap; no
   * starvation observed across the burst.
   */
  it.todo('AC-12 SC-004: 60-call burst on same domain paces within cap (no starvation)');

  /**
   * @AC-12 NF-Phase2-05 — overhead < 5 ms per call when under cap.
   */
  it.todo('AC-12 NF-Phase2-05: overhead per call < 5 ms when under cap');
});

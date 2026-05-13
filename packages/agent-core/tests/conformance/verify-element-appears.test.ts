/**
 * AC-04 — ElementAppearsStrategy conformance (Phase 3 T054).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-3-verification/spec.md AC-04 + Edge cases (v0.3 F04 + F05)
 *   docs/specs/mvp/phases/phase-3-verification/tasks.md T054
 *     (REQ-VERIFY-003)
 *   docs/specs/mvp/phases/phase-3-verification/impact.md §ActionContract.elementAppears
 *
 * AC-04 contract — three-criterion visibility (ALL three required):
 *   (a) `querySelector(selector) !== null`
 *   (b) `boundingBox.width > 0 AND boundingBox.height > 0`
 *   (c) computed style `visibility !== 'hidden'` AND `display !== 'none'`
 *       AND `opacity > 0`
 *
 * Two-timer semantics (v0.3 F05):
 *   - Single shared ceiling = contract.expected.timeoutMs (default 10000ms).
 *   - MutationMonitor is a precondition GATE — unstable: true → strategy
 *     returns { ok:false, unstable:true } WITHOUT proceeding to visibility check.
 *   - Visibility check uses only the REMAINING budget; if exceeded →
 *     { ok:false, timedOut:true }.
 *
 * RED state — Phase 3 Wave 0 (T-PHASE3-TESTS). Module absent → import fails.
 *
 * Anchor: @AC-04 — 3-criterion visibility + 2 timer failure modes.
 */
import { describe, expect, it, vi } from 'vitest';

import { ElementAppearsStrategy } from '../../src/verification/strategies/ElementAppearsStrategy.js';
import type { ActionContract } from '../../src/verification/types.js';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';

interface VisibilityProbe {
  present: boolean;
  boundingBox: { width: number; height: number } | null;
  computedStyle: {
    visibility: string;
    display: string;
    opacity: string;
  } | null;
}

/**
 * Stub MutationMonitor mirroring the contract the ElementAppearsStrategy
 * consumes: `waitForSettle({ page, timeoutMs })` returns `{ stable }` on
 * success and `{ stable: false, unstable: true }` on instability.
 */
interface MutationMonitorLike {
  waitForSettle(opts: {
    page: unknown;
    timeoutMs: number;
  }): Promise<{ stable: boolean; unstable?: boolean }>;
}

function stubMonitor(behavior: 'stable' | 'unstable'): MutationMonitorLike {
  return {
    waitForSettle: vi.fn(async () =>
      behavior === 'stable'
        ? { stable: true }
        : { stable: false, unstable: true },
    ),
  };
}

/**
 * Stub session — exposes a page.evaluate() that returns a VisibilityProbe
 * payload. The strategy is expected to perform exactly one page.evaluate()
 * call (or equivalent) to gather the 3 visibility signals.
 */
function stubSession(probe: VisibilityProbe | { delayMs: number }): BrowserSession {
  const evaluate = vi.fn(async () => {
    if ('delayMs' in probe) {
      await new Promise<void>((resolve) => setTimeout(resolve, probe.delayMs));
      return {
        present: true,
        boundingBox: { width: 100, height: 50 },
        computedStyle: { visibility: 'visible', display: 'block', opacity: '1' },
      };
    }
    return probe;
  });
  return {
    id: 'stub-session',
    page: { evaluate },
  } as unknown as BrowserSession;
}

function makeContract(selector: string, timeoutMs = 10000): ActionContract {
  return {
    id: '00000000-0000-4000-8000-000000000020',
    type: 'click',
    expected: { kind: 'elementAppears', selector, timeoutMs },
    candidateStrategies: ['element_appears'],
  } as ActionContract;
}

describe('ElementAppearsStrategy — AC-04 conformance (RED until T054)', () => {
  it('AC-04: name === "element_appears" and applicable() gates on expected.kind', () => {
    const strategy = new ElementAppearsStrategy(stubMonitor('stable'));
    expect(strategy.name).toBe('element_appears');
    const contract = makeContract('.cart-count');
    expect(strategy.applicable(contract)).toBe(true);
  });

  it('AC-04 (a): absent element (querySelector null) → ok:false, failedCriterion:"a"', async () => {
    const strategy = new ElementAppearsStrategy(stubMonitor('stable'));
    const session = stubSession({
      present: false,
      boundingBox: null,
      computedStyle: null,
    });
    const result = await strategy.verify(makeContract('.cart-count'), session);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedCriterion).toBe('a');
    }
  });

  it('AC-04 (b): zero-dimension element (width=0 or height=0) → ok:false, failedCriterion:"b"', async () => {
    const strategy = new ElementAppearsStrategy(stubMonitor('stable'));
    const session = stubSession({
      present: true,
      boundingBox: { width: 0, height: 50 },
      computedStyle: { visibility: 'visible', display: 'block', opacity: '1' },
    });
    const result = await strategy.verify(makeContract('.cart-count'), session);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedCriterion).toBe('b');
    }
  });

  it('AC-04 (c): visibility:hidden element → ok:false, failedCriterion:"c"', async () => {
    const strategy = new ElementAppearsStrategy(stubMonitor('stable'));
    const session = stubSession({
      present: true,
      boundingBox: { width: 100, height: 50 },
      computedStyle: { visibility: 'hidden', display: 'block', opacity: '1' },
    });
    const result = await strategy.verify(makeContract('.cart-count'), session);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedCriterion).toBe('c');
    }
  });

  it('AC-04 (c): display:none element → ok:false, failedCriterion:"c"', async () => {
    const strategy = new ElementAppearsStrategy(stubMonitor('stable'));
    const session = stubSession({
      present: true,
      boundingBox: { width: 100, height: 50 },
      computedStyle: { visibility: 'visible', display: 'none', opacity: '1' },
    });
    const result = await strategy.verify(makeContract('.cart-count'), session);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedCriterion).toBe('c');
    }
  });

  it('AC-04 (c): opacity:0 element → ok:false, failedCriterion:"c"', async () => {
    const strategy = new ElementAppearsStrategy(stubMonitor('stable'));
    const session = stubSession({
      present: true,
      boundingBox: { width: 100, height: 50 },
      computedStyle: { visibility: 'visible', display: 'block', opacity: '0' },
    });
    const result = await strategy.verify(makeContract('.cart-count'), session);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedCriterion).toBe('c');
    }
  });

  it('AC-04: fully visible element passes all 3 criteria → ok:true, evidence populated', async () => {
    const strategy = new ElementAppearsStrategy(stubMonitor('stable'));
    const session = stubSession({
      present: true,
      boundingBox: { width: 100, height: 50 },
      computedStyle: { visibility: 'visible', display: 'block', opacity: '1' },
    });
    const result = await strategy.verify(makeContract('.cart-count'), session);
    expect(result.ok).toBe(true);
  });

  /**
   * @AC-04 — TWO-TIMER SEMANTICS (v0.3 F05) — MutationMonitor unstable
   * fires BEFORE visibility check; strategy returns { ok:false, unstable:true }
   * and does NOT inspect the visibility probe.
   */
  it('AC-04: MutationMonitor unstable → ok:false, unstable:true, NO visibility check', async () => {
    const monitor = stubMonitor('unstable');
    const strategy = new ElementAppearsStrategy(monitor);
    const session = stubSession({
      present: true,
      boundingBox: { width: 100, height: 50 },
      computedStyle: { visibility: 'visible', display: 'block', opacity: '1' },
    });
    const result = await strategy.verify(makeContract('.cart-count'), session);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unstable).toBe(true);
    }
    // visibility-check evaluate() must NOT have been called when MutationMonitor
    // returned unstable.
    const evaluate = (session.page as unknown as { evaluate: ReturnType<typeof vi.fn> }).evaluate;
    expect(evaluate).not.toHaveBeenCalled();
  });

  /**
   * @AC-04 — TWO-TIMER SEMANTICS (v0.3 F05) — visibility check exceeds
   * remaining budget within the SHARED ceiling. Force small timeoutMs +
   * slow evaluate() to trigger the timeout branch.
   */
  it('AC-04: visibility check exceeds remaining budget → ok:false, timedOut:true', async () => {
    const strategy = new ElementAppearsStrategy(stubMonitor('stable'));
    const session = stubSession({ delayMs: 200 }); // probe stalls 200ms
    const result = await strategy.verify(makeContract('.cart-count', 50), session);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.timedOut).toBe(true);
    }
  });
});

/**
 * Conformance test for AC-06 / T5B-006 PopupDismissibilityTester.
 *
 * Spec: docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/{spec.md AC-06, tasks.md T5B-006}.
 *
 * Asserts:
 *   1. isEscapeDismissible mutates null → boolean
 *   2. isClickOutsideDismissible mutates null → boolean
 *   3. State restoration kill-criterion: sha256(dom_outerHTML + scrollY +
 *      JSON.stringify(formStates)) hash is identical before & after each
 *      dismissibility test (R23 — failure aborts).
 *   4. Settle predicate (Phase 1c) gates capture — injected as callback.
 *
 * R3 TDD: written BEFORE PopupDismissibilityTester.ts exists.
 */
import { describe, it, expect, vi } from 'vitest';

import {
  testPopupDismissibility,
  type DismissibilityProbablePopup,
  type DismissibilityHarness,
  type StateSnapshot,
} from '../../src/browser-runtime/PopupDismissibilityTester.js';

function snap(html: string, scrollY = 0, formStates: Record<string, unknown> = {}): StateSnapshot {
  return { dom_outerHTML: html, scrollY, formStates };
}

/**
 * A scriptable harness that records calls + returns scripted responses.
 * Production wiring replaces this with a Playwright Page adapter.
 */
function makeHarness(opts: {
  escapeDismisses: boolean;
  clickOutsideDismisses: boolean;
  baselineSnapshot: StateSnapshot;
}): DismissibilityHarness & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async captureSnapshot() {
      calls.push('capture');
      return opts.baselineSnapshot;
    },
    async pressEscape() {
      calls.push('escape');
    },
    async clickOutside(_selector) {
      calls.push(`click-outside:${_selector}`);
    },
    async isPopupOpen(_selector) {
      calls.push(`isOpen:${_selector}`);
      // Inspect the most-recent dismiss action recorded.
      const escapeIdx = calls.lastIndexOf('escape');
      let clickIdx = -1;
      for (let i = calls.length - 1; i >= 0; i--) {
        if (calls[i]!.startsWith('click-outside')) { clickIdx = i; break; }
      }
      const lastAction = Math.max(escapeIdx, clickIdx);
      if (lastAction === -1) return true;
      if (calls[lastAction] === 'escape') return !opts.escapeDismisses;
      return !opts.clickOutsideDismisses;
    },
    async restore(_snapshot) {
      calls.push('restore');
    },
    async settle() {
      calls.push('settle');
    },
  };
}

describe('PopupDismissibilityTester — AC-06 conformance', () => {
  it('mutates isEscapeDismissible / isClickOutsideDismissible from null → true', async () => {
    const popups: DismissibilityProbablePopup[] = [
      {
        selector: '#p',
        isEscapeDismissible: null,
        isClickOutsideDismissible: null,
      },
    ];
    const baseline = snap('<body></body>');
    const harness = makeHarness({
      escapeDismisses: true,
      clickOutsideDismisses: true,
      baselineSnapshot: baseline,
    });
    await testPopupDismissibility({ popups, harness });
    expect(popups[0]!.isEscapeDismissible).toBe(true);
    expect(popups[0]!.isClickOutsideDismissible).toBe(true);
  });

  it('records false when popup persists after Escape / click-outside', async () => {
    const popups: DismissibilityProbablePopup[] = [
      {
        selector: '#stubborn',
        isEscapeDismissible: null,
        isClickOutsideDismissible: null,
      },
    ];
    const harness = makeHarness({
      escapeDismisses: false,
      clickOutsideDismisses: false,
      baselineSnapshot: snap('<body></body>'),
    });
    await testPopupDismissibility({ popups, harness });
    expect(popups[0]!.isEscapeDismissible).toBe(false);
    expect(popups[0]!.isClickOutsideDismissible).toBe(false);
  });

  it('R23 kill: throws when state restoration hash mismatches baseline', async () => {
    const popups: DismissibilityProbablePopup[] = [
      {
        selector: '#p',
        isEscapeDismissible: null,
        isClickOutsideDismissible: null,
      },
    ];
    const baseline = snap('<body>A</body>');
    let snapshotCallCount = 0;
    const harness: DismissibilityHarness = {
      async captureSnapshot() {
        snapshotCallCount += 1;
        // First call = baseline; subsequent calls return mismatched DOM
        if (snapshotCallCount === 1) return baseline;
        return snap('<body>B</body>');
      },
      async pressEscape() {},
      async clickOutside() {},
      async isPopupOpen() {
        return false;
      },
      async restore() {},
      async settle() {},
    };
    await expect(
      testPopupDismissibility({ popups, harness })
    ).rejects.toThrow(/state restoration/i);
  });

  it('invokes settle predicate before each capture', async () => {
    const popups: DismissibilityProbablePopup[] = [
      {
        selector: '#p',
        isEscapeDismissible: null,
        isClickOutsideDismissible: null,
      },
    ];
    const settle = vi.fn(async () => {});
    const harness: DismissibilityHarness = {
      async captureSnapshot() {
        return snap('<body>X</body>');
      },
      async pressEscape() {},
      async clickOutside() {},
      async isPopupOpen() {
        return false;
      },
      async restore() {},
      settle,
    };
    await testPopupDismissibility({ popups, harness });
    expect(settle).toHaveBeenCalled();
  });
});

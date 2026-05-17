/**
 * Conformance test AC-11 — T5B-011 ScrollPositionTrigger.
 *
 * Spec: phase-5b spec.md §20 + AC-11 (REQ-STATE-EXPL-TRIGGER-003).
 *   Detect IntersectionObserver + sticky elements; scroll to Y; capture
 *   sticky CTA changes + lazy-load reveal.
 *
 * @AC-11
 */
import { describe, expect, test, vi } from 'vitest';

import {
  ScrollPositionTrigger,
  type ScrollPage,
} from '../../src/browser-runtime/triggers/ScrollPositionTrigger.js';

function stubPage(): ScrollPage & { __calls: { eval: unknown[]; scrolls: number[] } } {
  const calls = { eval: [] as unknown[], scrolls: [] as number[] };
  return {
    url: () => 'https://example.test/',
    evaluate: vi.fn(async (fn: unknown, arg: unknown) => {
      calls.eval.push(fn);
      if (typeof arg === 'number') calls.scrolls.push(arg);
      return undefined;
    }),
    waitForTimeout: vi.fn(async () => undefined),
    __calls: calls,
  };
}

describe('ScrollPositionTrigger (AC-11)', () => {
  test('scrolls to given y and reports fired', async () => {
    const page = stubPage();
    const trigger = new ScrollPositionTrigger();
    const out = await trigger.fire(page, {
      element_id: 'lazy-1',
      target_y: 1200,
      viewport: { device_type: 'desktop' },
    });
    expect(out.fired).toBe(true);
    expect(page.__calls.scrolls).toContain(1200);
  });

  test('clamps negative target_y to 0', async () => {
    const page = stubPage();
    const trigger = new ScrollPositionTrigger();
    await trigger.fire(page, {
      element_id: 'x',
      target_y: -50,
      viewport: { device_type: 'mobile' },
    });
    expect(page.__calls.scrolls).toContain(0);
  });
});

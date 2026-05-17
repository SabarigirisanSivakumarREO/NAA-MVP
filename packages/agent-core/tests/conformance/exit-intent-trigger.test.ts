/**
 * Conformance AC-13 — T5B-013 ExitIntentTrigger.
 *
 * Spec: phase-5b spec §20 + AC-13 (REQ-STATE-EXPL-TRIGGER-005).
 *   Scan scripts for `mouseleave` listeners. Simulate mouse to (x, -1).
 *   Populate `popups[].triggerType: exit_intent`. No-op on mobile.
 *
 * @AC-13
 */
import { describe, expect, test, vi } from 'vitest';

import {
  ExitIntentTrigger,
  type ExitIntentPage,
} from '../../src/browser-runtime/triggers/ExitIntentTrigger.js';

function stubPage(opts: { hasMouseleave?: boolean; width?: number } = {}): ExitIntentPage & {
  __mouseMoves: Array<{ x: number; y: number }>;
} {
  const moves: Array<{ x: number; y: number }> = [];
  return {
    url: () => 'https://example.test/',
    evaluate: vi.fn(async (fn: unknown) => {
      const src = typeof fn === 'string' ? fn : String(fn);
      if (src.includes('mouseleave')) return opts.hasMouseleave ?? true;
      if (src.includes('innerWidth')) return opts.width ?? 1440;
      return null;
    }),
    mouse: {
      move: vi.fn(async (x: number, y: number) => {
        moves.push({ x, y });
      }),
    },
    __mouseMoves: moves,
  };
}

describe('ExitIntentTrigger (AC-13)', () => {
  test('fires when mouseleave listener detected on desktop', async () => {
    const page = stubPage({ hasMouseleave: true });
    const trigger = new ExitIntentTrigger();
    const out = await trigger.fire(page, { viewport: { device_type: 'desktop' } });
    expect(out.fired).toBe(true);
    expect(out.trigger_type).toBe('exit_intent');
    // Y must be -1 (exit-intent signature)
    expect(page.__mouseMoves.some((m) => m.y === -1)).toBe(true);
  });

  test('no-ops silently on mobile viewport', async () => {
    const page = stubPage({ hasMouseleave: true });
    const trigger = new ExitIntentTrigger();
    const out = await trigger.fire(page, { viewport: { device_type: 'mobile' } });
    expect(out.fired).toBe(false);
    expect(out.skipped_reason).toBe('mobile_viewport');
    expect(page.__mouseMoves.length).toBe(0);
  });

  test('skips when no mouseleave listener detected', async () => {
    const page = stubPage({ hasMouseleave: false });
    const trigger = new ExitIntentTrigger();
    const out = await trigger.fire(page, { viewport: { device_type: 'desktop' } });
    expect(out.fired).toBe(false);
    expect(out.skipped_reason).toBe('no_mouseleave_listener');
  });
});

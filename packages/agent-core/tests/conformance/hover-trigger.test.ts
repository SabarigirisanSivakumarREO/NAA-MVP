/**
 * Conformance test AC-10 — T5B-010 HoverTrigger.
 *
 * Spec: docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/spec.md
 *   §20 trigger taxonomy + AC-10 (REQ-STATE-EXPL-TRIGGER-002).
 *
 * R3.1 TDD: this file imports the module under test; until T5B-010 lands the
 *   import resolves to a freshly created stub or fails.
 *
 * Anchor: @AC-10 — fires mouseenter + dwell; settles within 1s; no-op on
 *   mobile viewport.
 */
import { describe, expect, test, vi } from 'vitest';

import { HoverTrigger, type HoverPage } from '../../src/browser-runtime/triggers/HoverTrigger.js';

function stubPage(opts: { settleMs?: number } = {}): HoverPage & {
  __calls: { hover: number; eval: number };
} {
  const calls = { hover: 0, eval: 0 };
  return {
    url: () => 'https://example.test/',
    hover: vi.fn(async (_sel: string) => {
      calls.hover++;
    }),
    waitForLoadState: vi.fn(async () => {
      if (opts.settleMs) await new Promise((r) => setTimeout(r, opts.settleMs));
    }),
    evaluate: vi.fn(async () => {
      calls.eval++;
      return undefined;
    }),
    __calls: calls,
  };
}

describe('HoverTrigger (AC-10)', () => {
  test('fires hover + settles within 1s on desktop viewport', async () => {
    const page = stubPage();
    const trigger = new HoverTrigger();
    const out = await trigger.fire(page, {
      element_id: 'n-1',
      selector: '.menu-item',
      viewport: { device_type: 'desktop' },
    });
    expect(out.fired).toBe(true);
    expect(out.skipped_reason).toBeUndefined();
    expect(page.__calls.hover).toBe(1);
  });

  test('settle timeout is capped at 1000ms', async () => {
    const trigger = new HoverTrigger();
    expect(trigger.settleTimeoutMs).toBe(1000);
  });

  test('no-ops silently on mobile viewport', async () => {
    const page = stubPage();
    const trigger = new HoverTrigger();
    const out = await trigger.fire(page, {
      element_id: 'n-2',
      selector: '.menu-item',
      viewport: { device_type: 'mobile' },
    });
    expect(out.fired).toBe(false);
    expect(out.skipped_reason).toBe('mobile_viewport');
    expect(page.__calls.hover).toBe(0);
  });
});

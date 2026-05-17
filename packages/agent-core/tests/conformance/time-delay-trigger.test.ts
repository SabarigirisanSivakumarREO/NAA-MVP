/**
 * Conformance AC-12 — T5B-012 TimeDelayTrigger.
 *
 * Spec: phase-5b spec §20 + AC-12 (REQ-STATE-EXPL-TRIGGER-004).
 *   Run page N seconds (default 5s, max 10s). Diff DOM. New nodes are
 *   time-triggered.
 *
 * @AC-12
 */
import { describe, expect, test, vi } from 'vitest';

import {
  TimeDelayTrigger,
  DEFAULT_DWELL_MS,
  MAX_DWELL_MS,
  type TimePage,
} from '../../src/browser-runtime/triggers/TimeDelayTrigger.js';

function stubPage(snapshots: string[]): TimePage {
  let i = 0;
  return {
    url: () => 'https://example.test/',
    waitForTimeout: vi.fn(async () => undefined),
    evaluate: vi.fn(async () => snapshots[Math.min(i++, snapshots.length - 1)] ?? ''),
  };
}

describe('TimeDelayTrigger (AC-12)', () => {
  test('default dwell is 5000ms', () => {
    expect(DEFAULT_DWELL_MS).toBe(5000);
  });

  test('caps dwell at 10000ms', async () => {
    const trigger = new TimeDelayTrigger();
    const page = stubPage(['<a>', '<a><b>']);
    const out = await trigger.fire(page, { dwell_ms: 999_999 });
    expect(out.dwell_ms).toBe(MAX_DWELL_MS);
    expect(MAX_DWELL_MS).toBe(10000);
  });

  test('detects DOM diff between before/after snapshots', async () => {
    const trigger = new TimeDelayTrigger();
    const page = stubPage(['<div>a</div>', '<div>a</div><div class="banner">new</div>']);
    const out = await trigger.fire(page, {});
    expect(out.fired).toBe(true);
    expect(out.dom_changed).toBe(true);
  });

  test('no diff returns dom_changed false', async () => {
    const trigger = new TimeDelayTrigger();
    const page = stubPage(['<a/>', '<a/>']);
    const out = await trigger.fire(page, { dwell_ms: 100 });
    expect(out.dom_changed).toBe(false);
  });
});

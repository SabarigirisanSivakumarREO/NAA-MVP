/**
 * Conformance test for AC-02 (T5B-002) — ViewportConfigService.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/tasks.md
 *     T5B-002 — Reads viewports from AuditRequest. Returns ordered list of
 *     viewport configs ({width, height, device_type}). MVP presets: desktop
 *     1440×900, mobile iPhone 11 375×812 (plan §2.2).
 *
 * Anchor: @AC-02 — ViewportConfigService presets + ordering (Phase 5b).
 */
import { describe, expect, test } from 'vitest';

import {
  ViewportConfigService,
  VIEWPORT_PRESETS,
} from '../../src/orchestration/ViewportConfigService.js';

describe('AC-02 — ViewportConfigService', () => {
  const svc = new ViewportConfigService();

  test('desktop preset is 1440×900', () => {
    expect(VIEWPORT_PRESETS.desktop).toEqual({
      width: 1440,
      height: 900,
      device_type: 'desktop',
    });
  });

  test('mobile preset is iPhone 11 375×812', () => {
    expect(VIEWPORT_PRESETS.mobile).toEqual({
      width: 375,
      height: 812,
      device_type: 'mobile',
    });
  });

  test('resolves single viewport ["desktop"] to one config', () => {
    const configs = svc.resolve(['desktop']);
    expect(configs).toHaveLength(1);
    expect(configs[0].device_type).toBe('desktop');
    expect(configs[0].width).toBe(1440);
    expect(configs[0].height).toBe(900);
  });

  test('resolves ["desktop","mobile"] preserving order', () => {
    const configs = svc.resolve(['desktop', 'mobile']);
    expect(configs.map((c) => c.device_type)).toEqual(['desktop', 'mobile']);
  });

  test('preserves reverse order ["mobile","desktop"]', () => {
    const configs = svc.resolve(['mobile', 'desktop']);
    expect(configs.map((c) => c.device_type)).toEqual(['mobile', 'desktop']);
  });

  test('rejects unknown viewport name at runtime', () => {
    // Cast through unknown since type-system rejects 'tablet'; runtime guard
    // is the secondary defense for callers bypassing Zod.
    expect(() => svc.resolve(['tablet' as unknown as 'desktop'])).toThrow();
  });
});

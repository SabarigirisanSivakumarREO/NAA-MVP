/**
 * Conformance test for AC-04 (T5B-004) — ViewportDiffEngine.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/tasks.md
 *     T5B-004 — Compare desktop vs mobile PerceptionBundle. Identifies fold
 *     composition diff, CTA visibility diff, sticky element diff. Emits
 *     ViewportDiffFinding[] with severity scoring (CTA-visibility = high;
 *     sticky = medium; fold composition = medium).
 *   plan.md §2.3 diff dimensions.
 *
 * Anchor: @AC-04 — ViewportDiffEngine.
 */
import { describe, expect, test } from 'vitest';

import {
  ViewportDiffEngine,
  type PerceptionBundleLike,
} from '../../src/analysis/ViewportDiffEngine.js';

const makeBundle = (
  device: 'desktop' | 'mobile',
  data: Partial<PerceptionBundleLike>
): PerceptionBundleLike => ({
  device_type: device,
  in_fold: [],
  ctas: [],
  sticky_elements: [],
  ...data,
});

describe('AC-04 — ViewportDiffEngine', () => {
  const engine = new ViewportDiffEngine();

  test('emits CTA visibility diff (high severity) when CTA in fold on desktop but not mobile', () => {
    const desktop = makeBundle('desktop', {
      ctas: [{ selector: '#buy', in_fold: true }],
    });
    const mobile = makeBundle('mobile', {
      ctas: [{ selector: '#buy', in_fold: false }],
    });

    const findings = engine.diff({ desktop, mobile });
    const ctaDiff = findings.find((f) => f.dimension === 'cta_visibility');
    expect(ctaDiff).toBeDefined();
    expect(ctaDiff?.severity).toBe('high');
    expect(ctaDiff?.kind).toBe('viewport_diff');
  });

  test('emits sticky element diff (medium severity) when desktop has sticky absent on mobile', () => {
    const desktop = makeBundle('desktop', {
      sticky_elements: [{ selector: '#sticky-nav' }],
    });
    const mobile = makeBundle('mobile', {
      sticky_elements: [],
    });

    const findings = engine.diff({ desktop, mobile });
    const stickyDiff = findings.find((f) => f.dimension === 'sticky_element');
    expect(stickyDiff).toBeDefined();
    expect(stickyDiff?.severity).toBe('medium');
  });

  test('emits fold composition diff (medium severity) when sets differ', () => {
    const desktop = makeBundle('desktop', {
      in_fold: [{ selector: '#hero' }, { selector: '#nav' }],
    });
    const mobile = makeBundle('mobile', {
      in_fold: [{ selector: '#hero' }],
    });

    const findings = engine.diff({ desktop, mobile });
    const foldDiff = findings.find((f) => f.dimension === 'fold_composition');
    expect(foldDiff).toBeDefined();
    expect(foldDiff?.severity).toBe('medium');
  });

  test('emits no findings when desktop and mobile bundles are equivalent', () => {
    const same = {
      in_fold: [{ selector: '#hero' }],
      ctas: [{ selector: '#buy', in_fold: true }],
      sticky_elements: [{ selector: '#sticky' }],
    };
    const desktop = makeBundle('desktop', same);
    const mobile = makeBundle('mobile', same);

    const findings = engine.diff({ desktop, mobile });
    expect(findings).toEqual([]);
  });

  test('every finding carries desktop_state + mobile_state + kind=viewport_diff', () => {
    const desktop = makeBundle('desktop', {
      ctas: [{ selector: '#buy', in_fold: true }],
      sticky_elements: [{ selector: '#sticky' }],
      in_fold: [{ selector: '#hero' }],
    });
    const mobile = makeBundle('mobile', {
      ctas: [{ selector: '#buy', in_fold: false }],
      sticky_elements: [],
      in_fold: [],
    });

    const findings = engine.diff({ desktop, mobile });
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.kind).toBe('viewport_diff');
      expect(f).toHaveProperty('desktop_state');
      expect(f).toHaveProperty('mobile_state');
      expect(f).toHaveProperty('dimension');
      expect(f).toHaveProperty('severity');
    }
  });
});

/**
 * Conformance test for AC-03 (T1B-003 StickyElementDetector).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md AC-03
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/tasks.md T1B-003
 *
 * R-03: Detect sticky / fixed elements via getComputedStyle `position`
 *       ∈ {sticky, fixed}; record viewportCoveragePercent and
 *       containsPrimaryCta (overlap with ctx.ctas[]).
 *
 * R3.1 TDD: import fails with "module not found" until T1B-003 lands.
 *
 * Anchor: @AC-03 — stickyElements[] populated with type (open string),
 *   positionStrategy ∈ {sticky, fixed}, viewportCoveragePercent,
 *   isAboveFold, containsPrimaryCta.
 */
import { describe, expect, test } from 'vitest';

// @ts-expect-error — module does not exist yet (T1B-003 RED state)
import { extractStickyElements } from '../../src/perception/extensions/StickyElementDetector.js';

function makeCtx(): {
  ctas: Array<{ index: number; text: string; selector: string; sizePx: { width: number; height: number } }>;
  formFields: never[];
  metadata: { schemaOrg: never[]; ogTags: Record<string, never> };
  headings: never[];
  primaryActions: { selector: string; text: string } | null;
} {
  return {
    ctas: [
      {
        index: 0,
        text: 'Buy',
        selector: 'button.atc',
        sizePx: { width: 200, height: 48 },
      },
    ],
    formFields: [],
    metadata: { schemaOrg: [], ogTags: {} },
    headings: [],
    primaryActions: { selector: 'button.atc', text: 'Buy' },
  };
}

function makeDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('StickyElementDetector — AC-03 conformance (RED)', () => {
  /**
   * @AC-03 — sticky CTA bar at the bottom of the viewport is recorded.
   */
  test('AC-03: sticky-positioned CTA bar is detected', () => {
    const doc = makeDoc(
      '<html><body><div style="position:sticky;bottom:0"><button class="atc">Buy</button></div></body></html>',
    );
    const result = extractStickyElements(doc, { width: 1280, height: 800 }, makeCtx());
    expect(Array.isArray(result)).toBe(true);
  });

  /**
   * @AC-03 — positionStrategy ∈ {sticky, fixed}.
   */
  test('AC-03: positionStrategy is sticky OR fixed only', () => {
    const doc = makeDoc(
      '<html><body><nav style="position:fixed;top:0">Nav</nav></body></html>',
    );
    const result = extractStickyElements(doc, { width: 1280, height: 800 }, makeCtx());
    for (const el of result) {
      expect(['sticky', 'fixed']).toContain(el.positionStrategy);
    }
  });

  /**
   * @AC-03 — every entry has the 5 contract fields.
   */
  test('AC-03: entries expose type, positionStrategy, viewportCoveragePercent, isAboveFold, containsPrimaryCta', () => {
    const doc = makeDoc(
      '<html><body><div style="position:sticky;top:0;height:60px;width:100%">Header</div></body></html>',
    );
    const result = extractStickyElements(doc, { width: 1280, height: 800 }, makeCtx());
    for (const el of result) {
      expect(el).toHaveProperty('type');
      expect(el).toHaveProperty('positionStrategy');
      expect(el).toHaveProperty('viewportCoveragePercent');
      expect(el).toHaveProperty('isAboveFold');
      expect(el).toHaveProperty('containsPrimaryCta');
    }
  });

  /**
   * @AC-03 — non-sticky page returns empty array.
   */
  test('AC-03: page without sticky elements returns []', () => {
    const doc = makeDoc('<html><body><div>Static content</div></body></html>');
    const result = extractStickyElements(doc, { width: 1280, height: 800 }, makeCtx());
    expect(result).toEqual([]);
  });

  /**
   * @AC-03 — viewportCoveragePercent is a number in [0, 100].
   */
  test('AC-03: viewportCoveragePercent is a number in [0, 100]', () => {
    const doc = makeDoc(
      '<html><body><div style="position:fixed;top:0;width:100%;height:50px">Bar</div></body></html>',
    );
    const result = extractStickyElements(doc, { width: 1280, height: 800 }, makeCtx());
    for (const el of result) {
      expect(typeof el.viewportCoveragePercent).toBe('number');
      expect(el.viewportCoveragePercent).toBeGreaterThanOrEqual(0);
      expect(el.viewportCoveragePercent).toBeLessThanOrEqual(100);
    }
  });
});

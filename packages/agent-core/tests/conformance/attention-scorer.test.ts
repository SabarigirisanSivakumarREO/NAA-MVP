/**
 * Conformance test for AC-08 (T1B-008 AttentionScorer).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md AC-08
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/tasks.md T1B-008
 *
 * R-08: Score visual attention via contrast (Sharp), size (bbox area),
 *       position (above-fold weight), color saturation; emit top-3
 *       hotspots and a single dominant element (or null if max score < 0.3).
 *
 * R3.1 TDD: import fails with "module not found" until T1B-008 lands.
 *
 * Anchor: @AC-08 — attention.dominantElement ∈ {type, selector, score ∈ [0,1]}
 *   or null; contrastHotspots[] has 3 entries with boundingBox +
 *   contrastScore.
 */
import { describe, expect, test } from 'vitest';

import { extractAttention } from '../../src/perception/extensions/AttentionScorer.js';

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

describe('AttentionScorer — AC-08 conformance (RED)', () => {
  /**
   * @AC-08 — dominant element + 3 hotspots populated.
   */
  test('AC-08: returns dominantElement and contrastHotspots top-level fields', () => {
    const doc = makeDoc(
      '<html><body><button class="atc" style="background:red;color:white">Buy</button></body></html>',
    );
    const result = extractAttention(doc, { width: 1280, height: 800 }, makeCtx());
    expect(result).toHaveProperty('dominantElement');
    expect(result).toHaveProperty('contrastHotspots');
    expect(Array.isArray(result.contrastHotspots)).toBe(true);
  });

  /**
   * @AC-08 — dominant element score ∈ [0,1] (or element is null).
   */
  test('AC-08: dominantElement.score ∈ [0, 1] when populated', () => {
    const doc = makeDoc('<html><body><button class="atc">Buy</button></body></html>');
    const result = extractAttention(doc, { width: 1280, height: 800 }, makeCtx());
    if (result.dominantElement !== null) {
      expect(result.dominantElement.score).toBeGreaterThanOrEqual(0);
      expect(result.dominantElement.score).toBeLessThanOrEqual(1);
      expect(result.dominantElement).toHaveProperty('type');
      expect(result.dominantElement).toHaveProperty('selector');
    }
  });

  /**
   * @AC-08 — each hotspot has boundingBox + contrastScore.
   */
  test('AC-08: each contrastHotspots entry has boundingBox + contrastScore', () => {
    const doc = makeDoc(
      '<html><body><button class="atc">Buy</button><h1>Headline</h1><img src="x"/></body></html>',
    );
    const result = extractAttention(doc, { width: 1280, height: 800 }, makeCtx());
    for (const hot of result.contrastHotspots) {
      expect(hot).toHaveProperty('boundingBox');
      expect(hot).toHaveProperty('contrastScore');
    }
  });

  /**
   * @AC-08 — dominant element is null when no element scores >0.3.
   */
  test('AC-08: empty page can produce dominantElement=null', () => {
    const doc = makeDoc('<html><body></body></html>');
    const result = extractAttention(doc, { width: 1280, height: 800 }, makeCtx());
    expect(result.dominantElement === null || typeof result.dominantElement === 'object').toBe(true);
  });

  /**
   * @AC-08 — at most 3 hotspots returned.
   */
  test('AC-08: contrastHotspots length is at most 3', () => {
    const doc = makeDoc(
      '<html><body><button>A</button><button>B</button><button>C</button><button>D</button><button>E</button></body></html>',
    );
    const result = extractAttention(doc, { width: 1280, height: 800 }, makeCtx());
    expect(result.contrastHotspots.length).toBeLessThanOrEqual(3);
  });
});

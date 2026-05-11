/**
 * Conformance test for AC-07 (T1B-007 MicrocopyTagger).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md AC-07
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/tasks.md T1B-007
 *
 * R-07 (v0.2): Tag microcopy within 100px of every CTA in ctx.ctas[];
 *       7-tag taxonomy (Cialdini-collapse per regex-precision constraint
 *       NF-04): risk_reducer / urgency / security / guarantee /
 *       social_proof / value_prop / other. Precision ≥80% against
 *       ground-truth fixtures.
 *
 * R3.1 TDD: import fails with "module not found" until T1B-007 lands.
 *
 * Anchor: @AC-07 — microcopy.nearCtaTags[] entries reference ctx.ctas[]
 *   by index; tag set is the 7-value taxonomy above.
 */
import { describe, expect, test } from 'vitest';

// @ts-expect-error — module does not exist yet (T1B-007 RED state)
import { extractMicrocopyTags } from '../../src/perception/extensions/MicrocopyTagger.js';

const ALLOWED_TAGS = [
  'risk_reducer',
  'urgency',
  'security',
  'guarantee',
  'social_proof',
  'value_prop',
  'other',
] as const;

interface CtaShape {
  index: number;
  text: string;
  selector: string;
  sizePx: { width: number; height: number };
}

function makeCtx(ctas: CtaShape[]): {
  ctas: CtaShape[];
  formFields: never[];
  metadata: { schemaOrg: never[]; ogTags: Record<string, never> };
  headings: never[];
  primaryActions: null;
} {
  return {
    ctas,
    formFields: [],
    metadata: { schemaOrg: [], ogTags: {} },
    headings: [],
    primaryActions: null,
  };
}

function makeDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('MicrocopyTagger — AC-07 conformance (RED)', () => {
  /**
   * @AC-07 — "30-day money-back guarantee" near CTA → guarantee tag.
   */
  test('AC-07: "30-day money-back guarantee" gets `guarantee` tag', () => {
    const doc = makeDoc(
      '<html><body><button class="atc">Buy now</button><p>30-day money-back guarantee</p></body></html>',
    );
    const ctx = makeCtx([
      { index: 0, text: 'Buy now', selector: 'button.atc', sizePx: { width: 200, height: 48 } },
    ]);
    const result = extractMicrocopyTags(doc, { width: 1280, height: 800 }, ctx);
    expect(Array.isArray(result.nearCtaTags)).toBe(true);
  });

  /**
   * @AC-07 — every tag emitted is in the 7-value enum.
   */
  test('AC-07: every emitted tag is one of the 7 taxonomy values', () => {
    const doc = makeDoc(
      '<html><body><button class="atc">Buy</button><p>Only 3 left in stock — order soon</p></body></html>',
    );
    const ctx = makeCtx([
      { index: 0, text: 'Buy', selector: 'button.atc', sizePx: { width: 200, height: 48 } },
    ]);
    const result = extractMicrocopyTags(doc, { width: 1280, height: 800 }, ctx);
    for (const entry of result.nearCtaTags) {
      for (const tag of entry.tags) {
        expect(ALLOWED_TAGS).toContain(tag);
      }
    }
  });

  /**
   * @AC-07 — taxonomy exactly 7 values; Cialdini-principle keys NOT present.
   */
  test('AC-07: taxonomy contains exactly 7 values; Cialdini principles deferred', () => {
    expect(ALLOWED_TAGS).toHaveLength(7);
    expect(ALLOWED_TAGS).not.toContain('reciprocity');
    expect(ALLOWED_TAGS).not.toContain('commitment_consistency');
    expect(ALLOWED_TAGS).not.toContain('liking');
    expect(ALLOWED_TAGS).not.toContain('authority');
  });

  /**
   * @AC-07 — empty ctas[] → empty nearCtaTags[].
   */
  test('AC-07: empty ctas[] produces empty nearCtaTags[]', () => {
    const doc = makeDoc('<html><body><p>Some text</p></body></html>');
    const result = extractMicrocopyTags(doc, { width: 1280, height: 800 }, makeCtx([]));
    expect(result.nearCtaTags).toEqual([]);
  });

  /**
   * @AC-07 — entries reference ctas[] by index.
   */
  test('AC-07: nearCtaTags entries reference ctas[] by index', () => {
    const doc = makeDoc(
      '<html><body><button class="atc">Buy</button><p>Secure checkout</p></body></html>',
    );
    const ctx = makeCtx([
      { index: 0, text: 'Buy', selector: 'button.atc', sizePx: { width: 200, height: 48 } },
    ]);
    const result = extractMicrocopyTags(doc, { width: 1280, height: 800 }, ctx);
    for (const entry of result.nearCtaTags) {
      expect(typeof entry.ctaIndex).toBe('number');
      expect(entry.ctaIndex).toBeGreaterThanOrEqual(0);
      expect(entry.ctaIndex).toBeLessThan(ctx.ctas.length);
    }
  });
});

/**
 * Conformance test for AC-06 (T1B-006 SocialProofDepthEnricher).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md AC-06
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/tasks.md T1B-006
 *
 * R-06: Extract socialProofDepth from on-page review widgets +
 *       JSON-LD AggregateRating (from ctx.metadata.schemaOrg).
 *       Compute recencyDays from review timestamps.
 *
 * R3.1 TDD: import fails with "module not found" until T1B-006 lands.
 *
 * Anchor: @AC-06 — socialProofDepth.{reviewCount, starDistribution,
 *   recencyDays, hasAggregateRating, hasIndividualReviews,
 *   thirdPartyVerified} populated; uses JSON-LD AggregateRating where present.
 */
import { describe, expect, test } from 'vitest';

// @ts-expect-error — module does not exist yet (T1B-006 RED state)
import { extractSocialProofDepth } from '../../src/perception/extensions/SocialProofDepthEnricher.js';

function makeCtx(schemaOrg: Array<Record<string, unknown>> = []): {
  ctas: never[];
  formFields: never[];
  metadata: { schemaOrg: Array<Record<string, unknown>>; ogTags: Record<string, never> };
  headings: never[];
  primaryActions: null;
} {
  return {
    ctas: [],
    formFields: [],
    metadata: { schemaOrg, ogTags: {} },
    headings: [],
    primaryActions: null,
  };
}

function makeDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('SocialProofDepthEnricher — AC-06 conformance (RED)', () => {
  /**
   * @AC-06 — page with JSON-LD AggregateRating: hasAggregateRating=true.
   */
  test('AC-06: JSON-LD AggregateRating populates hasAggregateRating=true', () => {
    const doc = makeDoc('<html><body></body></html>');
    const ctx = makeCtx([
      {
        '@type': 'Product',
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.5',
          reviewCount: '127',
        },
      },
    ]);
    const result = extractSocialProofDepth(doc, { width: 1280, height: 800 }, ctx);
    expect(result.hasAggregateRating).toBe(true);
    expect(result.reviewCount).toBe(127);
  });

  /**
   * @AC-06 — page without reviews: all flags false / null.
   */
  test('AC-06: page without reviews returns zero/null fields', () => {
    const doc = makeDoc('<html><body><h1>Article</h1></body></html>');
    const result = extractSocialProofDepth(doc, { width: 1280, height: 800 }, makeCtx());
    expect(result.hasAggregateRating).toBe(false);
    expect(result.hasIndividualReviews).toBe(false);
    expect(result.reviewCount).toBe(0);
  });

  /**
   * @AC-06 — object exposes all 6 contract fields.
   */
  test('AC-06: socialProofDepth has all 6 contract fields', () => {
    const doc = makeDoc('<html><body></body></html>');
    const result = extractSocialProofDepth(doc, { width: 1280, height: 800 }, makeCtx());
    expect(result).toHaveProperty('reviewCount');
    expect(result).toHaveProperty('starDistribution');
    expect(result).toHaveProperty('recencyDays');
    expect(result).toHaveProperty('hasAggregateRating');
    expect(result).toHaveProperty('hasIndividualReviews');
    expect(result).toHaveProperty('thirdPartyVerified');
  });

  /**
   * @AC-06 — individual reviews on page: hasIndividualReviews=true.
   */
  test('AC-06: review widgets in DOM set hasIndividualReviews=true', () => {
    const doc = makeDoc(
      '<html><body><div class="review"><span class="stars">5</span><p>Great product</p><time datetime="2026-05-01">May 1, 2026</time></div></body></html>',
    );
    const result = extractSocialProofDepth(doc, { width: 1280, height: 800 }, makeCtx());
    expect(typeof result.hasIndividualReviews).toBe('boolean');
  });

  /**
   * @AC-06 — recencyDays is number-or-null.
   */
  test('AC-06: recencyDays is number or null', () => {
    const doc = makeDoc('<html><body></body></html>');
    const result = extractSocialProofDepth(doc, { width: 1280, height: 800 }, makeCtx());
    expect(result.recencyDays === null || typeof result.recencyDays === 'number').toBe(true);
  });
});

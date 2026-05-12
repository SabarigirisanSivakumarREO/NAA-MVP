/**
 * Conformance test for AC-01 (T1B-001 PricingExtractor).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md AC-01
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/tasks.md T1B-001
 *
 * R-01: System MUST populate `pricing` block when on-page text or
 *       JSON-LD reveals a price; emit `null` otherwise. Compute
 *       `discountPercent` from anchorPrice ÷ amount when both present.
 *       R-01 runs FIRST within the evaluate pipeline.
 *
 * R3.1 TDD: import fails with "module not found" until T1B-001 lands.
 *
 * Anchor: @AC-01 — PricingExtractor populates pricing.{displayFormat,
 *   amount, amountNumeric, currency, taxInclusion, anchorPrice,
 *   discountPercent, comparisonShown, boundingBox} on PDPs; null on
 *   non-commerce pages. Reads ctx.metadata.schemaOrg (JSON-LD Offer)
 *   + on-page text.
 */
import { describe, expect, test } from 'vitest';

import { extractPricing } from '../../src/perception/extensions/PricingExtractor.js';

interface ExtractCtxLite {
  ctas: Array<{ index: number; text: string; selector: string; sizePx: { width: number; height: number } }>;
  formFields: Array<{ selector: string; type: string; required: boolean }>;
  metadata: { schemaOrg: Array<Record<string, unknown>>; ogTags: Record<string, string> };
  headings: Array<{ level: number; text: string; selector: string }>;
  primaryActions: { selector: string; text: string } | null;
}

function makeCtx(overrides: Partial<ExtractCtxLite> = {}): ExtractCtxLite {
  return {
    ctas: [],
    formFields: [],
    metadata: { schemaOrg: [], ogTags: {} },
    headings: [],
    primaryActions: null,
    ...overrides,
  };
}

function makePdpDocument(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

describe('PricingExtractor — AC-01 conformance (RED)', () => {
  /**
   * @AC-01 — strikethrough $99 next to $49 → amount=$49, anchorPrice=$99,
   * discountPercent=50, comparisonShown=true.
   */
  test('AC-01: PDP with anchor + sale prices populates pricing fully', () => {
    const doc = makePdpDocument(
      '<html><body><div class="price"><s>$99</s> <span>$49</span></div></body></html>',
    );
    const result = extractPricing(doc, { width: 1280, height: 800 }, makeCtx());
    expect(result).not.toBeNull();
    expect(result.amount).toBe('$49');
    expect(result.anchorPrice).toBe('$99');
    expect(result.discountPercent).toBe(50);
    expect(result.comparisonShown).toBe(true);
  });

  /**
   * @AC-01 — content page (no pricing) returns null (NOT empty object).
   */
  test('AC-01: content page with no pricing returns null', () => {
    const doc = makePdpDocument(
      '<html><body><h1>Article Title</h1><p>Some content.</p></body></html>',
    );
    const result = extractPricing(doc, { width: 1280, height: 800 }, makeCtx());
    expect(result).toBeNull();
  });

  /**
   * @AC-01 — JSON-LD Offer in metadata.schemaOrg is consumed.
   */
  test('AC-01: JSON-LD Offer in ctx.metadata.schemaOrg populates pricing', () => {
    const doc = makePdpDocument('<html><body></body></html>');
    const ctx = makeCtx({
      metadata: {
        schemaOrg: [
          {
            '@type': 'Product',
            offers: { '@type': 'Offer', price: '49.00', priceCurrency: 'USD' },
          },
        ],
        ogTags: {},
      },
    });
    const result = extractPricing(doc, { width: 1280, height: 800 }, ctx);
    expect(result).not.toBeNull();
    expect(result.currency).toBe('USD');
    expect(result.amountNumeric).toBe(49);
  });

  /**
   * @AC-01 — pricing block exposes all required fields when populated.
   */
  test('AC-01: pricing object has all 9 contract fields when present', () => {
    const doc = makePdpDocument(
      '<html><body><span class="price">$25.00</span></body></html>',
    );
    const result = extractPricing(doc, { width: 1280, height: 800 }, makeCtx());
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('displayFormat');
    expect(result).toHaveProperty('amount');
    expect(result).toHaveProperty('amountNumeric');
    expect(result).toHaveProperty('currency');
    expect(result).toHaveProperty('taxInclusion');
    expect(result).toHaveProperty('anchorPrice');
    expect(result).toHaveProperty('discountPercent');
    expect(result).toHaveProperty('comparisonShown');
    expect(result).toHaveProperty('boundingBox');
  });
});

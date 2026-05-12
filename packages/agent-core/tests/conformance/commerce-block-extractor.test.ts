/**
 * Conformance test for AC-09 (T1B-009 CommerceBlockExtractor).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md AC-09
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/tasks.md T1B-009
 *
 * R-09: Detect commerce signals via JSON-LD Offer/AggregateOffer +
 *       on-page text patterns. isCommerce requires Offer schema OR
 *       ATC/Add-to-bag CTA from ctx.primaryActions OR pricing block
 *       (R-01 result — runs first in same evaluate).
 *
 * R3.1 TDD: import fails with "module not found" until T1B-009 lands.
 *
 * Anchor: @AC-09 — commerce.{isCommerce, stockStatus, stockMessage,
 *   shippingSignals[], returnPolicyPresent, returnPolicyText,
 *   guaranteeText}; reads ctx.metadata.schemaOrg + ctx.primaryActions +
 *   ctx.pricing.
 */
import { describe, expect, test } from 'vitest';

import { extractCommerce } from '../../src/perception/extensions/CommerceBlockExtractor.js';

function makeCtx(opts: {
  schemaOrg?: Array<Record<string, unknown>>;
  primaryActions?: { selector: string; text: string } | null;
  pricing?: Record<string, unknown> | null;
} = {}): {
  ctas: never[];
  formFields: never[];
  metadata: { schemaOrg: Array<Record<string, unknown>>; ogTags: Record<string, never> };
  headings: never[];
  primaryActions: { selector: string; text: string } | null;
  pricing: Record<string, unknown> | null;
} {
  return {
    ctas: [],
    formFields: [],
    metadata: { schemaOrg: opts.schemaOrg ?? [], ogTags: {} },
    headings: [],
    primaryActions: opts.primaryActions ?? null,
    pricing: opts.pricing ?? null,
  };
}

function makeDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('CommerceBlockExtractor — AC-09 conformance (RED)', () => {
  /**
   * @AC-09 — JSON-LD Offer present → isCommerce=true.
   */
  test('AC-09: JSON-LD Offer in ctx → isCommerce=true', () => {
    const doc = makeDoc('<html><body></body></html>');
    const ctx = makeCtx({
      schemaOrg: [
        {
          '@type': 'Product',
          offers: { '@type': 'Offer', price: '49.00' },
        },
      ],
    });
    const result = extractCommerce(doc, { width: 1280, height: 800 }, ctx);
    expect(result.isCommerce).toBe(true);
  });

  /**
   * @AC-09 — primaryActions "Add to bag" → isCommerce=true.
   */
  test('AC-09: primaryActions "Add to bag" → isCommerce=true', () => {
    const doc = makeDoc('<html><body><button class="atc">Add to bag</button></body></html>');
    const ctx = makeCtx({ primaryActions: { selector: 'button.atc', text: 'Add to bag' } });
    const result = extractCommerce(doc, { width: 1280, height: 800 }, ctx);
    expect(result.isCommerce).toBe(true);
  });

  /**
   * @AC-09 — no commerce signals → isCommerce=false.
   */
  test('AC-09: content page with no commerce signals → isCommerce=false', () => {
    const doc = makeDoc('<html><body><h1>Article</h1></body></html>');
    const result = extractCommerce(doc, { width: 1280, height: 800 }, makeCtx());
    expect(result.isCommerce).toBe(false);
  });

  /**
   * @AC-09 — pricing block alone is sufficient to trigger isCommerce=true.
   */
  test('AC-09: pricing block alone (no Offer schema, no ATC) → isCommerce=true', () => {
    const doc = makeDoc('<html><body><span class="price">$10</span></body></html>');
    const ctx = makeCtx({ pricing: { amount: '$10', amountNumeric: 10 } });
    const result = extractCommerce(doc, { width: 1280, height: 800 }, ctx);
    expect(result.isCommerce).toBe(true);
  });

  /**
   * @AC-09 — object exposes all 7 contract fields.
   */
  test('AC-09: commerce object has all 7 contract fields', () => {
    const doc = makeDoc('<html><body></body></html>');
    const result = extractCommerce(doc, { width: 1280, height: 800 }, makeCtx());
    expect(result).toHaveProperty('isCommerce');
    expect(result).toHaveProperty('stockStatus');
    expect(result).toHaveProperty('stockMessage');
    expect(result).toHaveProperty('shippingSignals');
    expect(result).toHaveProperty('returnPolicyPresent');
    expect(result).toHaveProperty('returnPolicyText');
    expect(result).toHaveProperty('guaranteeText');
  });
});

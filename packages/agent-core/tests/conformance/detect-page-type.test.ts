/**
 * Conformance — detectPageType (T114).
 *
 * REQ-ID: REQ-ANALYZE-PERCEPTION-V23-001
 * AC: Phase 7 AC-02
 */
import { describe, expect, it } from 'vitest';

import { detectPageType } from '../../src/analysis/utils/detectPageType.js';

describe('detectPageType (AC-02)', () => {
  it('classifies product page from URL + CTA + schema', () => {
    const r = detectPageType({
      url: 'https://amazon.in/dp/B08X1234',
      cta_texts: ['Add to Cart'],
      schema_org_types: ['Product'],
    });
    expect(r.primary).toBe('product');
    // alternatives may be empty when all signals concur on a single type
    expect(r.alternatives.every((a) => a.confidence >= 0 && a.confidence <= 1)).toBe(true);
  });

  it('classifies checkout page from URL + form checkout keywords', () => {
    const r = detectPageType({
      url: 'https://shop.com/checkout',
      form_signals: { has_form: true, has_checkout_keywords: true },
    });
    expect(r.primary).toBe('checkout');
  });

  it('classifies pricing page from URL + Offer schema', () => {
    const r = detectPageType({
      url: 'https://example.com/pricing',
      schema_org_types: ['Offer'],
    });
    expect(r.primary).toBe('pricing');
  });

  it('classifies form page from URL + password input', () => {
    const r = detectPageType({
      url: 'https://example.com/signup',
      form_signals: {
        has_form: true,
        has_password_input: true,
        field_count: 3,
      },
    });
    expect(r.primary).toBe('form');
  });

  it('classifies homepage on root URL', () => {
    const r = detectPageType({ url: 'https://example.com/' });
    expect(r.primary).toBe('homepage');
  });

  it('falls back to `other` when no signals match', () => {
    const r = detectPageType({ url: 'https://example.com/random-blog-post' });
    expect(r.primary).toBe('other');
  });

  it('Phase 4b override short-circuits detection (REQ-CONTEXT-DOWNSTREAM-001)', () => {
    const r = detectPageType({
      url: 'https://example.com/random',
      context_profile_page_type: 'checkout',
    });
    expect(r.primary).toBe('checkout');
    expect(r.alternatives).toEqual([]);
    expect(r.signalsUsed).toEqual({
      url_score: 0,
      cta_score: 0,
      form_score: 0,
      schema_score: 0,
    });
  });

  it('signalsUsed components respect weight bounds [0, weight]', () => {
    const r = detectPageType({
      url: 'https://shop.com/checkout',
      cta_texts: ['Place Order'],
      form_signals: { has_form: true, has_checkout_keywords: true },
      schema_org_types: ['Product'],
    });
    expect(r.signalsUsed.url_score).toBeGreaterThanOrEqual(0);
    expect(r.signalsUsed.url_score).toBeLessThanOrEqual(0.4);
    expect(r.signalsUsed.cta_score).toBeLessThanOrEqual(0.3);
    expect(r.signalsUsed.form_score).toBeLessThanOrEqual(0.2);
    expect(r.signalsUsed.schema_score).toBeLessThanOrEqual(0.1);
  });
});

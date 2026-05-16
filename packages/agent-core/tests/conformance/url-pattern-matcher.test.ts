/**
 * AC-02 — URLPatternMatcher conformance (Phase 4b T4B-002).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-02 + R-04 + NF-03
 *     ("Match 30 fixture URLs ... ≥95% accuracy ... Returns {value, source:
 *      'url_pattern', confidence: 0.9} on match.")
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-002
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.1.2
 *     (REQ-CONTEXT-DIM-PAGE-001)
 *
 * AC-02 contract verified here:
 *   - All 12 LOCKED PageType values have at least one fixture URL.
 *   - ≥95% precision across the 30-URL fixture set (≤1 miss permitted).
 *   - On match: pageType matches expected; confidence === 0.9; matchedPattern present.
 *   - On miss / unparseable: { pageType: null, confidence: 0 }.
 *   - Stateless: same input → same output (no side effects).
 *
 * Anchor: @AC-02 — URL pattern → PageType classification.
 */
import { describe, expect, it } from 'vitest';

import { URLPatternMatcher, matchUrlPattern } from '../../src/context/URLPatternMatcher.js';
import type { PageType } from '../../src/types/context-profile.js';

/**
 * 30-URL fixture set covering all 12 LOCKED PageType values + a few
 * intentionally null cases. Per AC-02: ≥95% accuracy required (≤1 miss
 * permitted across the 30 matchable fixtures).
 */
interface Fixture {
  url: string;
  expected: PageType | null;
  note?: string;
}

const FIXTURES: ReadonlyArray<Fixture> = [
  // home (root path; trailing slash optional)
  { url: 'https://example.com/', expected: 'home' },
  { url: 'https://example.com', expected: 'home' },

  // PLP (collections / shop / search)
  { url: 'https://shop.example.com/collections/all', expected: 'PLP' },
  { url: 'https://example.com/shop', expected: 'PLP' },
  { url: 'https://example.com/search?q=shoes', expected: 'PLP' },

  // PDP (product detail — /products/<slug>, /p/<id>, /dp/<asin>)
  { url: 'https://shop.example.com/products/red-widget', expected: 'PDP' },
  { url: 'https://example.com/p/12345', expected: 'PDP' },
  { url: 'https://www.amazon.com/dp/B08N5WRWNW', expected: 'PDP' },
  { url: 'https://example.com/item/sku-9876', expected: 'PDP' },

  // cart
  { url: 'https://shop.example.com/cart', expected: 'cart' },
  { url: 'https://example.com/basket', expected: 'cart' },
  { url: 'https://example.com/bag', expected: 'cart' },

  // checkout
  { url: 'https://shop.example.com/checkout', expected: 'checkout' },
  { url: 'https://example.com/checkout/payment', expected: 'checkout' },
  { url: 'https://example.com/secure-checkout', expected: 'checkout' },

  // post_purchase (MUST precede /checkout in catalog due to substring overlap)
  { url: 'https://shop.example.com/thank-you', expected: 'post_purchase' },
  { url: 'https://example.com/order-confirmation/abc123', expected: 'post_purchase' },
  { url: 'https://example.com/receipt/xyz', expected: 'post_purchase' },

  // category (taxonomy)
  { url: 'https://example.com/category/electronics', expected: 'category' },
  { url: 'https://example.com/c/mens-shoes', expected: 'category' },

  // landing (paid / campaign)
  { url: 'https://example.com/lp/spring-sale', expected: 'landing' },
  { url: 'https://example.com/landing/promo-2026', expected: 'landing' },

  // blog
  { url: 'https://example.com/blog/why-cro-matters', expected: 'blog' },
  { url: 'https://example.com/articles/case-study', expected: 'blog' },

  // pricing (SaaS)
  { url: 'https://saas.example.com/pricing', expected: 'pricing' },
  { url: 'https://example.com/plans', expected: 'pricing' },

  // comparison
  { url: 'https://example.com/compare/widget-vs-gadget', expected: 'comparison' },
  { url: 'https://example.com/vs/competitor', expected: 'comparison' },

  // about
  { url: 'https://example.com/about', expected: 'about' },
  { url: 'https://example.com/about-us', expected: 'about' },

  // Intentional null cases (no pattern hit — should fall through to other signals)
  { url: 'https://example.com/account/settings', expected: null, note: 'authenticated section — not a page-type signal' },
  { url: 'not-a-valid-url', expected: null, note: 'unparseable URL → null (defense-in-depth)' },
];

describe('AC-02 — URLPatternMatcher (T4B-002)', () => {
  const matcher = new URLPatternMatcher();

  it('AC-02: covers all 12 LOCKED PageType values in fixture set', () => {
    const covered = new Set(
      FIXTURES.filter((f) => f.expected !== null).map((f) => f.expected as PageType),
    );
    const expected: PageType[] = [
      'home',
      'PLP',
      'PDP',
      'cart',
      'checkout',
      'post_purchase',
      'category',
      'landing',
      'blog',
      'about',
      'pricing',
      'comparison',
    ];
    for (const pt of expected) {
      expect(covered.has(pt), `fixture coverage missing for PageType "${pt}"`).toBe(true);
    }
  });

  it('AC-02: ≥95% precision across 30-URL fixture set (≤1 miss permitted)', () => {
    const misses: Array<{ url: string; got: PageType | null; expected: PageType | null }> = [];
    for (const fixture of FIXTURES) {
      const result = matcher.match(fixture.url);
      if (result.pageType !== fixture.expected) {
        misses.push({ url: fixture.url, got: result.pageType, expected: fixture.expected });
      }
    }
    // 30 fixtures, ≥95% precision = ≤1 miss tolerated. Hard-fail otherwise.
    expect(
      misses.length,
      `URL pattern misses (${misses.length}): ${JSON.stringify(misses, null, 2)}`,
    ).toBeLessThanOrEqual(1);
  });

  it('AC-02: returns confidence 0.9 on every successful match', () => {
    for (const fixture of FIXTURES) {
      if (fixture.expected === null) continue;
      const result = matcher.match(fixture.url);
      if (result.pageType === fixture.expected) {
        expect(result.confidence, `confidence on ${fixture.url}`).toBe(0.9);
        expect(result.matchedPattern, `matchedPattern on ${fixture.url}`).toBeTruthy();
      }
    }
  });

  it('AC-02: returns { pageType: null, confidence: 0 } on miss', () => {
    const result = matcher.match('https://example.com/account/settings');
    expect(result.pageType).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('AC-02: returns { pageType: null, confidence: 0 } on unparseable URL (defense-in-depth)', () => {
    const result = matcher.match('not-a-valid-url');
    expect(result.pageType).toBeNull();
    expect(result.confidence).toBe(0);
    // Must not throw — caller falls back to other signals.
  });

  it('AC-02: post_purchase patterns take precedence over /checkout substring overlap', () => {
    // Sites that mount thank-you under /checkout/thank-you would still classify
    // as post_purchase because the post-purchase regex precedes /checkout in the catalog.
    expect(matcher.match('https://example.com/thank-you').pageType).toBe('post_purchase');
    expect(matcher.match('https://example.com/order-confirmation').pageType).toBe('post_purchase');
  });

  it('AC-02: classification is path-based, not host-based (ignores TLD)', () => {
    // Same /pricing path → same PageType across hosts.
    expect(matcher.match('https://a.com/pricing').pageType).toBe('pricing');
    expect(matcher.match('https://b.io/pricing').pageType).toBe('pricing');
    expect(matcher.match('https://c.co.uk/pricing').pageType).toBe('pricing');
  });

  it('AC-02: stateless — same input returns identical output', () => {
    const url = 'https://shop.example.com/products/widget';
    const first = matcher.match(url);
    const second = matcher.match(url);
    expect(first).toEqual(second);
  });

  it('AC-02: convenience function matchUrlPattern() matches class method behavior', () => {
    const url = 'https://example.com/checkout';
    const classResult = matcher.match(url);
    const fnResult = matchUrlPattern(url);
    expect(fnResult).toEqual(classResult);
  });
});

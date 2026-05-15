/**
 * AC-06 — PageTypeInferrer conformance (Phase 4b T4B-006).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-06 + R-13 + NF-04
 *     ("Infer on 30 fixtures with ≥0.7 confidence on 90% of fixtures; emits
 *      `inferredPageType` shape backward-compatible with §07 §7.4.")
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-006 (L124-129)
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.1.2
 *     (REQ-CONTEXT-DIM-PAGE-001 — cascade: URL → JSON-LD → DOM → default)
 *   packages/agent-core/src/types/context-profile.ts — PageTypeEnum (LOCKED 12).
 *
 * AC-06 contract verified here:
 *   1. Cascade precedence: URL > JSON-LD > DOM > default ('home', conf 0)
 *   2. URL pattern hits return source:'url_pattern', confidence 0.9
 *   3. JSON-LD type mapping returns source:'schema_org', confidence 0.7-0.9
 *   4. DOM/copy heuristics return source:'layout_inference', confidence 0.5-0.7
 *   5. Default branch returns source:'default', confidence 0 (R25 silent-default ban)
 *   6. Provenance always shape-valid (Zod parse passes)
 *   7. ≥90% of archetype fixtures have confidence ≥0.7 (NF-04)
 *
 * Anchor: @AC-06 — PageTypeInferrer cascade inference.
 */
import { describe, expect, it } from 'vitest';

import { JsonLdParser } from '../../src/context/JsonLdParser.js';
import { PageTypeInferrer } from '../../src/context/PageTypeInferrer.js';
import {
  PageTypeEnum,
  ProvenanceEntrySchema,
  type PageType,
} from '../../src/types/context-profile.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const parser = new JsonLdParser();
const inferrer = new PageTypeInferrer();

function infer(url: string, html: string = '') {
  const { blocks } = parser.parse(html);
  return inferrer.infer({ url, html, jsonLdBlocks: blocks });
}

function jsonLdHtml(typeOrPayload: string | Record<string, unknown>): string {
  const payload =
    typeof typeOrPayload === 'string'
      ? { '@context': 'https://schema.org', '@type': typeOrPayload }
      : { '@context': 'https://schema.org', ...typeOrPayload };
  return `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify(payload)}</script></head><body></body></html>`;
}

interface ArchetypeFixture {
  name: string;
  url: string;
  html?: string;
  expectedType: PageType;
  expectedSource: 'url_pattern' | 'schema_org' | 'layout_inference';
  expectedConfidence: number; // exact match
}

// ---------------------------------------------------------------------------
// Archetype fixtures (18 — covers 12 LOCKED PageType values + cascade levels)
// ---------------------------------------------------------------------------

const ARCHETYPE_FIXTURES: ReadonlyArray<ArchetypeFixture> = [
  // -- URL-pattern hits (primary, conf 0.9) --
  {
    name: 'PDP via URL',
    url: 'https://shop.example.com/products/widget-x',
    expectedType: 'PDP',
    expectedSource: 'url_pattern',
    expectedConfidence: 0.9,
  },
  {
    name: 'PLP via URL',
    url: 'https://shop.example.com/collections/all',
    expectedType: 'PLP',
    expectedSource: 'url_pattern',
    expectedConfidence: 0.9,
  },
  {
    name: 'cart via URL',
    url: 'https://shop.example.com/cart',
    expectedType: 'cart',
    expectedSource: 'url_pattern',
    expectedConfidence: 0.9,
  },
  {
    name: 'checkout via URL',
    url: 'https://shop.example.com/checkout',
    expectedType: 'checkout',
    expectedSource: 'url_pattern',
    expectedConfidence: 0.9,
  },
  {
    name: 'post_purchase via URL',
    url: 'https://shop.example.com/thank-you',
    expectedType: 'post_purchase',
    expectedSource: 'url_pattern',
    expectedConfidence: 0.9,
  },
  {
    name: 'home via URL',
    url: 'https://example.com/',
    expectedType: 'home',
    expectedSource: 'url_pattern',
    expectedConfidence: 0.9,
  },
  {
    name: 'landing via URL',
    url: 'https://example.com/lp/spring-sale',
    expectedType: 'landing',
    expectedSource: 'url_pattern',
    expectedConfidence: 0.9,
  },
  {
    name: 'blog via URL',
    url: 'https://example.com/blog/intro-post',
    expectedType: 'blog',
    expectedSource: 'url_pattern',
    expectedConfidence: 0.9,
  },
  {
    name: 'about via URL',
    url: 'https://example.com/about-us',
    expectedType: 'about',
    expectedSource: 'url_pattern',
    expectedConfidence: 0.9,
  },
  {
    name: 'pricing via URL',
    url: 'https://saas.example.com/pricing',
    expectedType: 'pricing',
    expectedSource: 'url_pattern',
    expectedConfidence: 0.9,
  },
  {
    name: 'comparison via URL',
    url: 'https://example.com/compare/a-vs-b',
    expectedType: 'comparison',
    expectedSource: 'url_pattern',
    expectedConfidence: 0.9,
  },
  {
    name: 'category via URL',
    url: 'https://example.com/category/shoes',
    expectedType: 'category',
    expectedSource: 'url_pattern',
    expectedConfidence: 0.9,
  },

  // -- JSON-LD hits (secondary, conf 0.7-0.9) --
  {
    name: 'PDP via JSON-LD Product (URL no-match)',
    url: 'https://shop.example.com/x123/',
    html: jsonLdHtml('Product'),
    expectedType: 'PDP',
    expectedSource: 'schema_org',
    expectedConfidence: 0.85,
  },
  {
    name: 'PLP via JSON-LD ItemList (URL no-match)',
    url: 'https://shop.example.com/feed-9876/',
    html: jsonLdHtml('ItemList'),
    expectedType: 'PLP',
    expectedSource: 'schema_org',
    expectedConfidence: 0.7,
  },
  {
    name: 'blog via JSON-LD BlogPosting (URL no-match)',
    url: 'https://example.com/posts-archive/q42-2026/',
    html: jsonLdHtml('BlogPosting'),
    expectedType: 'blog',
    expectedSource: 'schema_org',
    expectedConfidence: 0.85,
  },

  // -- DOM/copy heuristics (tertiary, conf 0.5-0.7) --
  {
    name: 'checkout via DOM (cardnumber input)',
    url: 'https://example.com/secure/payment-form/',
    html: '<html><body><form><input name="cardnumber" /></form></body></html>',
    expectedType: 'checkout',
    expectedSource: 'layout_inference',
    expectedConfidence: 0.7,
  },
  {
    name: 'post_purchase via DOM (thank you copy)',
    url: 'https://example.com/order/success/',
    html: '<html><body><h1>Thank you for your order</h1></body></html>',
    expectedType: 'post_purchase',
    expectedSource: 'layout_inference',
    expectedConfidence: 0.7,
  },
  {
    name: 'pricing via DOM (multiple $X/mo)',
    url: 'https://example.com/plan-options/',
    html: '<html><body><h1>Pricing</h1><div>Choose a plan: $9/mo $19/mo $49/mo</div></body></html>',
    expectedType: 'pricing',
    expectedSource: 'layout_inference',
    expectedConfidence: 0.6,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AC-06 — PageTypeInferrer (T4B-006)', () => {
  describe('archetype fixtures (cascade precedence)', () => {
    for (const fx of ARCHETYPE_FIXTURES) {
      it(`AC-06: ${fx.name}`, () => {
        const result = infer(fx.url, fx.html ?? '');
        expect(result.type.value, `value mismatch for ${fx.name}`).toBe(fx.expectedType);
        expect(result.type.source, `source mismatch for ${fx.name}`).toBe(fx.expectedSource);
        expect(result.type.confidence, `confidence mismatch for ${fx.name}`).toBe(
          fx.expectedConfidence,
        );
        // Provenance always shape-valid.
        expect(() => ProvenanceEntrySchema.parse(result.provenance)).not.toThrow();
        expect(result.provenance.dimension).toBe('page');
        expect(result.provenance.source).toBe(fx.expectedSource);
        expect(result.provenance.inference_method).toBe('deterministic');
        expect(result.provenance.confidence).toBe(fx.expectedConfidence);
      });
    }
  });

  describe('default branch (R25 silent-default ban)', () => {
    it('AC-06: returns home + source:default + confidence 0 when no signal matches', () => {
      const result = infer('https://example.com/random/path/here', '');
      expect(result.type.value).toBe('home');
      expect(result.type.source).toBe('default');
      expect(result.type.confidence).toBe(0);
      expect(result.provenance.source).toBe('default');
      expect(result.provenance.confidence).toBe(0);
      expect(result.provenance.inference_method).toBe('deterministic');
      // Zod-validate the provenance row.
      expect(() => ProvenanceEntrySchema.parse(result.provenance)).not.toThrow();
    });

    it('AC-06: default branch on unparseable URL + empty inputs', () => {
      const result = infer('not-a-valid-url', '');
      expect(result.type.value).toBe('home');
      expect(result.type.source).toBe('default');
      expect(result.type.confidence).toBe(0);
    });
  });

  describe('cascade precedence', () => {
    it('AC-06: URL pattern wins over JSON-LD (PDP URL + BlogPosting JSON-LD → PDP)', () => {
      const result = infer(
        'https://shop.example.com/products/widget-x',
        jsonLdHtml('BlogPosting'),
      );
      expect(result.type.value).toBe('PDP');
      expect(result.type.source).toBe('url_pattern');
      expect(result.type.confidence).toBe(0.9);
    });

    it('AC-06: JSON-LD wins over DOM (no URL hit + Product JSON-LD + checkout form DOM → PDP)', () => {
      const result = infer(
        'https://shop.example.com/x999/',
        `<html><head><script type="application/ld+json">${JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
        })}</script></head><body><form><input name="cardnumber" /></form></body></html>`,
      );
      expect(result.type.value).toBe('PDP');
      expect(result.type.source).toBe('schema_org');
    });
  });

  describe('NF-04 aggregate', () => {
    it('AC-06: ≥90% of archetype fixtures have confidence ≥0.7', () => {
      let highConf = 0;
      for (const fx of ARCHETYPE_FIXTURES) {
        const result = infer(fx.url, fx.html ?? '');
        if (result.type.confidence >= 0.7) highConf += 1;
      }
      const ratio = highConf / ARCHETYPE_FIXTURES.length;
      expect(
        ratio,
        `only ${highConf}/${ARCHETYPE_FIXTURES.length} fixtures hit conf ≥0.7 (need ≥90%)`,
      ).toBeGreaterThanOrEqual(0.9);
    });

    it('AC-06: every PageType value resolves to a valid PageTypeEnum member', () => {
      for (const fx of ARCHETYPE_FIXTURES) {
        const result = infer(fx.url, fx.html ?? '');
        expect(() => PageTypeEnum.parse(result.type.value)).not.toThrow();
      }
    });
  });

  describe('determinism', () => {
    it('AC-06: same input → same output (stateless)', () => {
      const url = 'https://shop.example.com/products/widget-x';
      const a = infer(url);
      const b = infer(url);
      expect(a.type).toEqual(b.type);
      // Provenance.inferred_at varies (Date.now); compare structural fields only.
      expect(a.provenance.dimension).toBe(b.provenance.dimension);
      expect(a.provenance.source).toBe(b.provenance.source);
      expect(a.provenance.confidence).toBe(b.provenance.confidence);
    });
  });
});

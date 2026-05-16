/**
 * AC-05 — BusinessArchetypeInferrer conformance (Phase 4b T4B-005).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-05 + R-07
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-005 (L116-122)
 *   docs/specs/mvp/phases/phase-4b-context-capture/plan.md §2.6
 *     (signal weighting table — IMPLEMENTED VERBATIM)
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.1.1
 *     (REQ-CONTEXT-DIM-BUSINESS-001 — JSON-LD + CTA copy + TLD signals)
 *
 * AC-05 scope (this file):
 *   1. D2C confident: ATC CTA + JSON-LD Product → archetype:D2C, conf ≥0.9
 *   2. B2B confident: "Request a demo" CTA only → archetype:B2B, conf ≥0.4
 *   3. SaaS confident: "$29/mo" + "Start free trial" + JSON-LD SoftwareApp
 *      → archetype:SaaS, conf capped 0.95
 *   4. service confident: JSON-LD Service only → archetype:service, conf 0.4
 *   5. TLD-only signal: example.shop, empty HTML → archetype:D2C, conf 0.2,
 *      source:url_pattern
 *   6. High-price + no ATC: B2B fallback via +0.2 weight
 *   7. Mixed-signals tie: ATC + demo CTA → confidence forced to 0.5
 *   8. No signals: empty inputs → archetype:'service', source:'default',
 *      confidence:0 (R25 silent-default ban — every default tagged)
 *   9. Provenance shape: every result has valid ProvenanceEntry per Zod parse
 *
 * Anchor: @AC-05 — BusinessArchetypeInferrer deterministic archetype inference.
 */
import { describe, expect, it } from 'vitest';

import { BusinessArchetypeInferrer } from '../../src/context/BusinessArchetypeInferrer.js';
import { parseJsonLd } from '../../src/context/JsonLdParser.js';
import { ProvenanceEntrySchema } from '../../src/types/context-profile.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inferrer = new BusinessArchetypeInferrer();

function infer(url: string, html: string) {
  const { blocks } = parseJsonLd(html);
  return inferrer.infer({ url, html, jsonLdBlocks: blocks });
}

// ---------------------------------------------------------------------------
// AC-05 tests
// ---------------------------------------------------------------------------

describe('BusinessArchetypeInferrer — AC-05 deterministic archetype inference (Phase 4b T4B-005)', () => {
  it('AC-05 (1): D2C confident — ATC CTA + JSON-LD Product + .shop TLD → archetype D2C, conf ≥0.9 (capped 0.95), source schema_org', () => {
    // 0.4 (Product) + 0.4 (ATC) + 0.2 (.shop TLD) = 1.0 → capped to 0.95.
    // Without TLD, only 0.8 — spec.md AC-05 "≥0.9" requires all three.
    const html = `<!doctype html><html><head>
<script type="application/ld+json">
{ "@context": "https://schema.org/", "@type": "Product", "name": "Widget" }
</script></head><body>
<button>Add to cart</button>
</body></html>`;
    const result = infer('https://acme.shop/p/widget', html);
    expect(result.archetype.value).toBe('D2C');
    expect(result.archetype.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.archetype.confidence).toBeLessThanOrEqual(0.95);
    expect(result.archetype.source).toBe('schema_org');
    expect(result.provenance.dimension).toBe('business');
    expect(result.provenance.inference_method).toBe('deterministic');
  });

  it('AC-05 (2): B2B confident — "Request a demo" CTA only → archetype B2B, source copy_inference', () => {
    const html = `<!doctype html><html><body>
<a href="/demo">Request a demo</a>
</body></html>`;
    const result = infer('https://example.com/', html);
    expect(result.archetype.value).toBe('B2B');
    expect(result.archetype.confidence).toBeGreaterThanOrEqual(0.4);
    expect(result.archetype.source).toBe('copy_inference');
  });

  it('AC-05 (3): SaaS confident — $29/mo + Start free trial + JSON-LD SoftwareApplication → archetype SaaS, conf capped 0.95', () => {
    const html = `<!doctype html><html><head>
<script type="application/ld+json">
{ "@context": "https://schema.org/", "@type": "SoftwareApplication",
  "name": "Acme App" }
</script></head><body>
<span class="price">$29/mo</span>
<button>Start free trial</button>
</body></html>`;
    const result = infer('https://example.com/pricing', html);
    expect(result.archetype.value).toBe('SaaS');
    expect(result.archetype.confidence).toBe(0.95); // capped
    expect(result.archetype.source).toBe('schema_org');
  });

  it('AC-05 (4): service confident — JSON-LD Service only → archetype service, conf 0.4, source schema_org', () => {
    const html = `<!doctype html><html><head>
<script type="application/ld+json">
{ "@context": "https://schema.org/", "@type": "Service", "name": "Consulting" }
</script></head><body><p>We help.</p></body></html>`;
    const result = infer('https://example.com/', html);
    expect(result.archetype.value).toBe('service');
    expect(result.archetype.confidence).toBeCloseTo(0.4, 5);
    expect(result.archetype.source).toBe('schema_org');
  });

  it('AC-05 (5): TLD signal alone — .shop domain, empty HTML → archetype D2C, conf 0.2, source url_pattern', () => {
    const result = infer('https://example.shop/', '<!doctype html><html><body></body></html>');
    expect(result.archetype.value).toBe('D2C');
    expect(result.archetype.confidence).toBeCloseTo(0.2, 5);
    expect(result.archetype.source).toBe('url_pattern');
  });

  it('AC-05 (6): high-price ($2,499) without ATC → B2B contributes +0.2 and wins', () => {
    const html = `<!doctype html><html><body>
<h1>Enterprise solution</h1>
<span>$2,499</span>
<p>Contact sales for details.</p>
</body></html>`;
    const result = infer('https://example.com/', html);
    expect(result.archetype.value).toBe('B2B');
    expect(result.archetype.confidence).toBeGreaterThanOrEqual(0.2);
  });

  it('AC-05 (7): mixed signals tie — ATC CTA + demo CTA → confidence forced to 0.5 (close-call rule)', () => {
    const html = `<!doctype html><html><body>
<button>Add to cart</button>
<a href="/demo">Request a demo</a>
</body></html>`;
    const result = infer('https://example.com/', html);
    // Both D2C (+0.4) and B2B (+0.4) tie; gap = 0 < 0.15 → confidence 0.5
    expect(result.archetype.confidence).toBe(0.5);
    // Winner is whichever the deterministic algorithm picks; assert it's one of them.
    expect(['D2C', 'B2B']).toContain(result.archetype.value);
  });

  it('AC-05 (8): no signals → archetype service, source default, confidence 0 (R25 silent-default ban)', () => {
    const html = `<!doctype html><html><body><p>Hello.</p></body></html>`;
    const result = infer('https://example.com/', html);
    expect(result.archetype.value).toBe('service');
    expect(result.archetype.source).toBe('default');
    expect(result.archetype.confidence).toBe(0);
    expect(result.provenance.source).toBe('default');
    expect(result.provenance.confidence).toBe(0);
  });

  it('AC-05 (9): provenance shape — every result has a valid ProvenanceEntry per Zod parse', () => {
    const cases: Array<[string, string]> = [
      ['https://example.com/', '<button>Add to cart</button>'],
      ['https://example.com/', '<a>Request a demo</a>'],
      ['https://example.shop/', ''],
      ['https://example.com/', ''],
    ];
    for (const [url, html] of cases) {
      const result = infer(url, html);
      // Will throw if ProvenanceEntry shape is invalid.
      expect(() => ProvenanceEntrySchema.parse(result.provenance)).not.toThrow();
      expect(result.provenance.confidence).toBe(result.archetype.confidence);
    }
  });

  it('AC-05: "Add to bag" copy variant also triggers D2C (regex tolerance)', () => {
    const html = `<!doctype html><html><body><button>Add to bag</button></body></html>`;
    const result = infer('https://example.com/', html);
    expect(result.archetype.value).toBe('D2C');
    expect(result.archetype.source).toBe('copy_inference');
  });

  it('AC-05: "per month" pricing copy triggers SaaS signal', () => {
    const html = `<!doctype html><html><body>
<span>Just $99 per month, billed annually.</span>
</body></html>`;
    const result = infer('https://example.com/', html);
    expect(result.archetype.value).toBe('SaaS');
  });

  it('AC-05: .store TLD also triggers D2C TLD signal', () => {
    const result = infer('https://acme.store/', '<!doctype html><html><body></body></html>');
    expect(result.archetype.value).toBe('D2C');
    expect(result.archetype.confidence).toBeCloseTo(0.2, 5);
    expect(result.archetype.source).toBe('url_pattern');
  });

  it('AC-05: malformed URL does not throw — TLD signal silently skipped', () => {
    // Inputs with an invalid URL should still yield a result (TLD branch defends).
    const html = `<button>Add to cart</button>`;
    const result = inferrer.infer({ url: 'not-a-url', html, jsonLdBlocks: [] });
    expect(result.archetype.value).toBe('D2C');
  });

  it('AC-05: provenance.inferred_value carries debug scores + matched signals', () => {
    const html = `<button>Add to cart</button>`;
    const result = infer('https://example.com/', html);
    const debug = result.provenance.inferred_value as {
      candidate_scores: Record<string, number>;
      matched_signals: string[];
    };
    expect(debug.candidate_scores).toBeDefined();
    expect(debug.candidate_scores.D2C).toBeGreaterThan(0);
    expect(debug.matched_signals.length).toBeGreaterThan(0);
  });
});

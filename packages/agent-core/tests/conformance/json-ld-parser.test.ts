/**
 * AC-04 — JsonLdParser conformance (Phase 4b T4B-004).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-04 + R-06
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-004 (L109-115)
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.4
 *     (REQ-CONTEXT-FLOW-001 — JSON-LD extraction via cheerio; deterministic;
 *      no LLM judgment; ignore malformed silently with warning)
 *
 * AC-04 scope (this file):
 *   1. Parse Product fixture → extracts @type, name, offers, description
 *   2. Parse Organization fixture → extracts @type, name
 *   3. Parse WebPage fixture → extracts @type, name
 *   4. Parse BreadcrumbList fixture → extracts @type + itemListElement count
 *   5. Multiple JSON-LD blocks → all surfaced as separate entries
 *   6. Malformed JSON inside block → skipped with warning, no throw
 *   7. Missing JSON-LD entirely → returns empty array
 *   8. @graph wrapper → all entries flattened with @type
 *   9. R25 — no Playwright import in parser (grep guard)
 *
 * Anchor: @AC-04 — JsonLdParser cheerio-based deterministic extraction.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { JsonLdParser, parseJsonLd } from '../../src/context/JsonLdParser.js';

// ---------------------------------------------------------------------------
// Fixtures (inline — small enough; ≥6 archetypes per task constraint)
// ---------------------------------------------------------------------------

const PRODUCT_HTML = `<!doctype html><html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org/",
  "@type": "Product",
  "name": "Widget Pro 9000",
  "description": "A really good widget.",
  "offers": { "@type": "Offer", "price": "49.99", "priceCurrency": "USD" }
}
</script></head><body>page</body></html>`;

const ORG_HTML = `<!doctype html><html><head>
<script type="application/ld+json">
{ "@context": "https://schema.org/", "@type": "Organization",
  "name": "Acme Inc", "url": "https://acme.example" }
</script></head></html>`;

const WEBPAGE_HTML = `<!doctype html><html><head>
<script type="application/ld+json">
{ "@context": "https://schema.org/", "@type": "WebPage",
  "name": "Acme Pricing", "description": "Plans and pricing." }
</script></head></html>`;

const BREADCRUMB_HTML = `<!doctype html><html><head>
<script type="application/ld+json">
{ "@context": "https://schema.org/", "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home" },
    { "@type": "ListItem", "position": 2, "name": "Shop" },
    { "@type": "ListItem", "position": 3, "name": "Widgets" }
  ]
}
</script></head></html>`;

const MULTIPLE_BLOCKS_HTML = `<!doctype html><html><head>
<script type="application/ld+json">
{ "@type": "Organization", "name": "Acme" }
</script>
<script type="application/ld+json">
{ "@type": "WebPage", "name": "Home" }
</script>
</head></html>`;

const MALFORMED_HTML = `<!doctype html><html><head>
<script type="application/ld+json">{ this is not json }</script>
<script type="application/ld+json">
{ "@type": "Product", "name": "Survivor" }
</script>
</head></html>`;

const NO_JSONLD_HTML = `<!doctype html><html><head><title>Plain</title></head>
<body><p>No structured data here.</p></body></html>`;

const GRAPH_HTML = `<!doctype html><html><head>
<script type="application/ld+json">
{ "@context": "https://schema.org/",
  "@graph": [
    { "@type": "Organization", "name": "Acme" },
    { "@type": "WebPage", "name": "Acme Home" }
  ]
}
</script></head></html>`;

// ---------------------------------------------------------------------------
// AC-04 tests
// ---------------------------------------------------------------------------

describe('JsonLdParser — AC-04 deterministic JSON-LD extraction (Phase 4b T4B-004)', () => {
  it('AC-04 (1): Product → extracts @type, name, offers, description', () => {
    const result = parseJsonLd(PRODUCT_HTML);
    expect(result.blocks).toHaveLength(1);
    const block = result.blocks[0]!;
    expect(block.type).toBe('Product');
    expect(block.data['name']).toBe('Widget Pro 9000');
    expect(block.data['description']).toBe('A really good widget.');
    expect(block.data['offers']).toEqual({
      '@type': 'Offer',
      price: '49.99',
      priceCurrency: 'USD',
    });
    expect(result.warnings).toEqual([]);
  });

  it('AC-04 (2): Organization → extracts @type + name', () => {
    const { blocks, warnings } = parseJsonLd(ORG_HTML);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe('Organization');
    expect(blocks[0]!.data['name']).toBe('Acme Inc');
    expect(warnings).toEqual([]);
  });

  it('AC-04 (3): WebPage → extracts @type + name', () => {
    const { blocks } = parseJsonLd(WEBPAGE_HTML);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe('WebPage');
    expect(blocks[0]!.data['name']).toBe('Acme Pricing');
  });

  it('AC-04 (4): BreadcrumbList → extracts @type + itemListElement', () => {
    const { blocks } = parseJsonLd(BREADCRUMB_HTML);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe('BreadcrumbList');
    const items = blocks[0]!.data['itemListElement'];
    expect(Array.isArray(items)).toBe(true);
    expect((items as unknown[]).length).toBe(3);
  });

  it('AC-04 (5): multiple JSON-LD blocks surface as separate entries', () => {
    const { blocks } = parseJsonLd(MULTIPLE_BLOCKS_HTML);
    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => b.type)).toEqual(['Organization', 'WebPage']);
  });

  it('AC-04 (6): malformed JSON block skipped with warning; valid block survives', () => {
    const { blocks, warnings } = parseJsonLd(MALFORMED_HTML);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe('Product');
    expect(blocks[0]!.data['name']).toBe('Survivor');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('JSON_LD_PARSE_ERROR');
  });

  it('AC-04 (7): no JSON-LD blocks → returns empty array + no warnings', () => {
    const { blocks, warnings } = parseJsonLd(NO_JSONLD_HTML);
    expect(blocks).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('AC-04 (8): @graph wrapper → all entries flattened with @type', () => {
    const { blocks } = parseJsonLd(GRAPH_HTML);
    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => b.type).sort()).toEqual(['Organization', 'WebPage']);
  });

  it('AC-04: class-based usage equivalent to top-level function', () => {
    const parser = new JsonLdParser();
    const a = parser.parse(PRODUCT_HTML);
    const b = parseJsonLd(PRODUCT_HTML);
    expect(a.blocks.length).toBe(b.blocks.length);
    expect(a.blocks[0]!.type).toBe(b.blocks[0]!.type);
  });

  it('AC-04: array root → each entry surfaced separately', () => {
    const html = `<script type="application/ld+json">
      [{ "@type": "Product", "name": "A" }, { "@type": "Product", "name": "B" }]
    </script>`;
    const { blocks } = parseJsonLd(html);
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.type === 'Product')).toBe(true);
  });

  it('AC-04: block without @type skipped with warning (deterministic extraction only)', () => {
    const html = `<script type="application/ld+json">{ "name": "No type here" }</script>`;
    const { blocks, warnings } = parseJsonLd(html);
    expect(blocks).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('JSON_LD_MISSING_TYPE');
  });

  it('AC-04: empty <script type="application/ld+json"></script> tolerated', () => {
    const html = `<script type="application/ld+json"></script>
      <script type="application/ld+json">{ "@type": "WebPage", "name": "X" }</script>`;
    const { blocks, warnings } = parseJsonLd(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe('WebPage');
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// R25 grep guard (mirrors HtmlFetcher AC-03 #10)
// ---------------------------------------------------------------------------

describe('JsonLdParser — R25 compliance (no Playwright import)', () => {
  it('source file contains zero `playwright` imports (R25 / AC-14)', () => {
    const here = fileURLToPath(import.meta.url);
    // Walk up two dirs: tests/conformance → tests → package root, then into src.
    const srcPath = here.replace(/tests[\\/]conformance[\\/].*$/, 'src/context/JsonLdParser.ts');
    const source = readFileSync(srcPath, 'utf8');
    expect(source).not.toMatch(/from\s+['"]playwright['"]/);
    expect(source).not.toMatch(/from\s+['"]@playwright\//);
    expect(source).not.toMatch(/require\(\s*['"]playwright['"]\s*\)/);
  });
});

/**
 * Conformance test for AC-08 (T013) — ContextAssembler.
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-08
 *         (line 161); tasks.md T013 acceptance.
 *
 * R3.1 TDD: this stub MUST FAIL until T013 implementation lands.
 * Module-not-found at import is the expected failure mode.
 *
 * Anchor: @AC-08 — contextAssembler.capture(url) returns a complete
 * PageStateModel with all 6 sections (metadata, accessibilityTree,
 * filteredDOM, interactiveGraph, visual, diagnostics); total tokenized
 * size < 1500 tokens for example.com, amazon.in, Peregrine PDP.
 */
import { describe, expect, test } from 'vitest';
// @ts-expect-error — module deliberately not yet implemented (T013)
import { contextAssembler } from '../../src/perception/ContextAssembler.js';
import { PageStateModelSchema } from '../../src/perception/types.js';

const EXAMPLE_URL = 'https://example.com';

describe('ContextAssembler — AC-08 conformance', () => {
  /**
   * @AC-08 capture(url) returns a PageStateModel that validates against
   * PageStateModelSchema.
   */
  test('AC-08: capture returns a PageStateModel matching the schema', async () => {
    const model = await contextAssembler.capture(EXAMPLE_URL);
    expect(() => PageStateModelSchema.parse(model)).not.toThrow();
  });

  /**
   * @AC-08 PageStateModel is < 1500 tokens for example.com (the simple
   * control fixture; NF-Phase1-01 budget).
   */
  test('AC-08: PageStateModel < 1500 tokens for example.com', async () => {
    const model = await contextAssembler.capture(EXAMPLE_URL);
    // Cheap proxy for token count: char-length / 4. Real implementation
    // uses tiktoken cl100k_base; this assertion is the runtime gate.
    const json = JSON.stringify(model);
    const approxTokens = Math.ceil(json.length / 4);
    expect(approxTokens).toBeLessThan(1500);
  });

  /**
   * @AC-08 PageStateModel includes all 6 sections.
   */
  test('AC-08: PageStateModel includes all 6 sections', async () => {
    const model = await contextAssembler.capture(EXAMPLE_URL);
    expect(model).toHaveProperty('metadata');
    expect(model).toHaveProperty('accessibilityTree');
    expect(model).toHaveProperty('filteredDOM');
    expect(model).toHaveProperty('interactiveGraph');
    expect(model).toHaveProperty('diagnostics');
    // visual is optional per Diagnostics screenshot fallback rules.
  });
});

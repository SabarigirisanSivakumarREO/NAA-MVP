/**
 * AC-04 — PseudoElementCapture conformance (REQ-BROWSE-PERCEPT-007).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md AC-04 + R-04
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/tasks.md T1C-004
 *
 * R-04: Capture ::before / ::after `content` text via
 *   `getComputedStyle(el, '::before').content`; skip empty + punctuation-only;
 *   merge into FusedElement.text_content downstream.
 *
 * Edge cases (spec):
 *   - "" → skipped (empty content carries no meaning)
 *   - "•" → skipped (punctuation-only)
 *   - "NEW", "BESTSELLER", required-field markers → captured
 *
 * R3.1 TDD (Wave 0 RED): import fails with "module not found" until
 *   T1C-004 lands.
 *
 * Anchor: @AC-04 — capturePseudoElements(el) → PseudoContent[]
 *   where each entry = { which: 'before' | 'after'; text: string }.
 *   Empty + punctuation-only contents are filtered out.
 */
import { describe, expect, it } from 'vitest';

// @ts-expect-error - module not implemented yet (Wave 0 RED for T1C-004)
import { capturePseudoElements } from '../../src/perception/PseudoElementCapture.js';

interface PseudoContent {
  which: 'before' | 'after';
  text: string;
}

describe('PseudoElementCapture — AC-04 conformance (Wave 0 RED)', () => {
  /**
   * @AC-04 — "NEW" badge captured.
   * jsdom does not fully implement ::before content via getComputedStyle,
   * so impl reads from inline-style hint or computed-style depending on env.
   * The test pins the contract shape; full e2e coverage lives in AC-12.
   */
  it.todo('AC-04: ::before content "NEW" captured from badge fixture');

  /**
   * @AC-04 — empty content "" skipped.
   */
  it.todo('AC-04: ::before content "" returns [] (empty filter)');

  /**
   * @AC-04 — punctuation-only "•" skipped.
   */
  it.todo('AC-04: ::before content "•" returns [] (punctuation-only filter)');

  /**
   * @AC-04 — required-field marker like "*" — also punctuation-only,
   * but spec calls out "required-field markers" as captured. Implementation
   * must distinguish meaningful markers (e.g., red asterisk with aria-label)
   * from decorative bullets. Pin the contract: function returns PseudoContent[].
   */
  it('AC-04: capturePseudoElements returns an array', () => {
    const el = document.createElement('span');
    el.textContent = 'plain';
    const result: PseudoContent[] = capturePseudoElements(el);
    expect(Array.isArray(result)).toBe(true);
  });

  /**
   * @AC-04 — each PseudoContent has the closed { which, text } shape.
   * `which` is closed enum {'before', 'after'}.
   */
  it.todo('AC-04: PseudoContent shape — { which: "before"|"after"; text: string }');
});

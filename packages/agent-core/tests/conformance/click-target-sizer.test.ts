/**
 * Conformance test for AC-02 (T1B-002 ClickTargetSizer).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md AC-02
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/tasks.md T1B-002
 *
 * R-02: WCAG 2.5.5 (≥44×44 CSS px AAA; spec uses ≥48×48 to match
 *       Google's mobile-friendly recommendation).
 *
 * R3.1 TDD: import fails with "module not found" until T1B-002 lands.
 *
 * Anchor: @AC-02 — ClickTargetSizer emits clickTargets[] with
 *   isMobileTapFriendly = (sizePx.width >= 48 && sizePx.height >= 48);
 *   elementType ∈ {cta, link, form_control, icon_button}; reads ctx.ctas[].
 */
import { describe, expect, test } from 'vitest';

import { extractClickTargets } from '../../src/perception/extensions/ClickTargetSizer.js';

interface CtaShape {
  index: number;
  text: string;
  selector: string;
  sizePx: { width: number; height: number };
}

interface ExtractCtxLite {
  ctas: CtaShape[];
  formFields: Array<{ selector: string; type: string; required: boolean }>;
  metadata: { schemaOrg: Array<Record<string, unknown>>; ogTags: Record<string, string> };
  headings: Array<{ level: number; text: string; selector: string }>;
  primaryActions: { selector: string; text: string } | null;
}

function makeCtx(ctas: CtaShape[]): ExtractCtxLite {
  return {
    ctas,
    formFields: [],
    metadata: { schemaOrg: [], ogTags: {} },
    headings: [],
    primaryActions: null,
  };
}

function makeDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('ClickTargetSizer — AC-02 conformance (RED)', () => {
  /**
   * @AC-02 — 64×64 primary CTA → isMobileTapFriendly: true.
   */
  test('AC-02: 64x64 element is mobile-tap-friendly', () => {
    const ctx = makeCtx([
      { index: 0, text: 'Buy', selector: 'a.primary', sizePx: { width: 64, height: 64 } },
    ]);
    const doc = makeDoc('<html><body><a class="primary">Buy</a></body></html>');
    const result = extractClickTargets(doc, { width: 1280, height: 800 }, ctx);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const cta = result.find((t: { selector: string }) => t.selector === 'a.primary');
    expect(cta).toBeDefined();
    expect(cta.isMobileTapFriendly).toBe(true);
  });

  /**
   * @AC-02 — 32×32 icon button → isMobileTapFriendly: false.
   */
  test('AC-02: 32x32 icon button is NOT mobile-tap-friendly', () => {
    const ctx = makeCtx([
      { index: 0, text: '', selector: 'button.icon', sizePx: { width: 32, height: 32 } },
    ]);
    const doc = makeDoc('<html><body><button class="icon"></button></body></html>');
    const result = extractClickTargets(doc, { width: 1280, height: 800 }, ctx);
    const icon = result.find((t: { selector: string }) => t.selector === 'button.icon');
    expect(icon).toBeDefined();
    expect(icon.isMobileTapFriendly).toBe(false);
  });

  /**
   * @AC-02 — elementType classified into 4-type coarse enum.
   */
  test('AC-02: elementType is one of the 4 allowed values', () => {
    const ctx = makeCtx([
      { index: 0, text: 'Buy', selector: 'button.atc', sizePx: { width: 200, height: 48 } },
    ]);
    const doc = makeDoc('<html><body><button class="atc">Buy</button></body></html>');
    const result = extractClickTargets(doc, { width: 1280, height: 800 }, ctx);
    const allowed = ['cta', 'link', 'form_control', 'icon_button'];
    for (const t of result) {
      expect(allowed).toContain(t.elementType);
    }
  });

  /**
   * @AC-02 — empty ctx.ctas[] yields empty clickTargets[].
   */
  test('AC-02: empty ctas[] produces empty clickTargets[]', () => {
    const doc = makeDoc('<html><body></body></html>');
    const result = extractClickTargets(doc, { width: 1280, height: 800 }, makeCtx([]));
    expect(result).toEqual([]);
  });

  /**
   * @AC-02 — exactly-48×48 is the inclusive boundary (mobile-friendly).
   */
  test('AC-02: 48x48 exactly is mobile-tap-friendly (inclusive threshold)', () => {
    const ctx = makeCtx([
      { index: 0, text: 'OK', selector: 'button.ok', sizePx: { width: 48, height: 48 } },
    ]);
    const doc = makeDoc('<html><body><button class="ok">OK</button></body></html>');
    const result = extractClickTargets(doc, { width: 1280, height: 800 }, ctx);
    const ok = result.find((t: { selector: string }) => t.selector === 'button.ok');
    expect(ok.isMobileTapFriendly).toBe(true);
  });
});

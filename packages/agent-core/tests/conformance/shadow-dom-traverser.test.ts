/**
 * AC-02 — ShadowDomTraverser conformance (REQ-BROWSE-PERCEPT-007).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md AC-02 + R-02
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/tasks.md T1C-002
 *
 * R-02: Recursive shadow-root traversal up to depth 5. Halt at depth 5
 *   and emit SHADOW_DOM_NOT_TRAVERSED warning; traversal continues at root.
 *
 * R3.1 TDD (Wave 0 RED): import fails with "module not found" until
 *   T1C-002 lands.
 *
 * Anchor: @AC-02 — traverseShadowDom(rootEl, maxDepth=5) → ShadowDomResult
 *   { elements: Element[]; warnings: WarningEntry[] }. Walks all open
 *   shadow roots recursively; closed shadow roots are unreachable by design.
 */
import { describe, expect, it } from 'vitest';

// @ts-expect-error - module not implemented yet (Wave 0 RED for T1C-002)
import {
  traverseShadowDom,
  SHADOW_DOM_MAX_DEPTH,
} from '../../src/perception/ShadowDomTraverser.js';

interface ShadowWarning {
  code: 'SHADOW_DOM_NOT_TRAVERSED';
  message: string;
  severity: 'info' | 'warn' | 'error';
}

interface ShadowDomResult {
  elements: Element[];
  warnings: ShadowWarning[];
}

function makeNestedShadowHost(depth: number): HTMLElement {
  const root = document.createElement('div');
  root.id = 'shadow-root-0';
  let current: Element = root;
  for (let i = 1; i <= depth; i += 1) {
    const shadow = (current as HTMLElement).attachShadow({ mode: 'open' });
    const inner = document.createElement('div');
    inner.id = `shadow-inner-${i}`;
    inner.textContent = `level-${i}`;
    shadow.appendChild(inner);
    current = inner;
  }
  document.body.appendChild(root);
  return root;
}

describe('ShadowDomTraverser — AC-02 conformance (Wave 0 RED)', () => {
  /**
   * @AC-02 — Depth cap pinned to 5 (R-02 hard contract).
   */
  it('AC-02: SHADOW_DOM_MAX_DEPTH pinned to 5', () => {
    expect(SHADOW_DOM_MAX_DEPTH).toBe(5);
  });

  /**
   * @AC-02 — 3 nested shadow roots → all elements captured, no warning.
   */
  it('AC-02: 3 nested shadow roots captured fully without warning', () => {
    const host = makeNestedShadowHost(3);
    const result: ShadowDomResult = traverseShadowDom(host, SHADOW_DOM_MAX_DEPTH);
    expect(result.elements.length).toBeGreaterThanOrEqual(3);
    expect(result.warnings).toEqual([]);
    host.remove();
  });

  /**
   * @AC-02 — 7-level shadow nest → halt at depth 5 + emit SHADOW_DOM_NOT_TRAVERSED
   * (acceptance scenario from User Story 2 #2).
   */
  it('AC-02: 7-level shadow nest emits SHADOW_DOM_NOT_TRAVERSED at depth >5', () => {
    const host = makeNestedShadowHost(7);
    const result: ShadowDomResult = traverseShadowDom(host, SHADOW_DOM_MAX_DEPTH);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain('SHADOW_DOM_NOT_TRAVERSED');
    const w = result.warnings.find((x) => x.code === 'SHADOW_DOM_NOT_TRAVERSED');
    expect(w?.severity).toBe('warn');
    host.remove();
  });

  /**
   * @AC-02 — flat DOM (no shadow root) → no elements captured (subject
   * traverses ONLY shadow content; light DOM is consumed elsewhere).
   */
  it('AC-02: non-shadow host returns empty elements list', () => {
    const host = document.createElement('div');
    host.innerHTML = '<span>plain light DOM</span>';
    document.body.appendChild(host);
    const result: ShadowDomResult = traverseShadowDom(host, SHADOW_DOM_MAX_DEPTH);
    expect(result.elements).toEqual([]);
    expect(result.warnings).toEqual([]);
    host.remove();
  });
});

/**
 * AC-06 — HiddenElementCapture conformance (REQ-BROWSE-PERCEPT-008).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md AC-06 + R-06
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/tasks.md T1C-006
 *
 * R-06 (v0.2): Capture hidden elements with `{selector, reason}` from the
 *   closed 7-case HiddenReason enum:
 *     {display_none, aria_hidden, visibility_hidden, offscreen,
 *      zero_dimension, opacity_zero, html_hidden_attr}
 *   `clip_path_inset` + `inert_attr` are DEFERRED to v0.3.
 *   These do NOT contribute to ElementGraph but ARE recorded for
 *   heuristic visibility.
 *
 * R3.1 TDD (Wave 0 RED): import fails with "module not found" until
 *   T1C-006 lands.
 *
 * Anchor: @AC-06 — captureHiddenElements(root) → HiddenEntry[]
 *   { selector: string; reason: HiddenReason }.
 */
import { describe, expect, it } from 'vitest';

import {
  captureHiddenElements,
  HIDDEN_REASON_ENUM,
} from '../../src/perception/HiddenElementCapture.js';

type HiddenReason =
  | 'display_none'
  | 'aria_hidden'
  | 'visibility_hidden'
  | 'offscreen'
  | 'zero_dimension'
  | 'opacity_zero'
  | 'html_hidden_attr';

interface HiddenEntry {
  selector: string;
  reason: HiddenReason;
}

const EXPECTED_REASONS: HiddenReason[] = [
  'display_none',
  'aria_hidden',
  'visibility_hidden',
  'offscreen',
  'zero_dimension',
  'opacity_zero',
  'html_hidden_attr',
];

describe('HiddenElementCapture — AC-06 conformance (Wave 0 RED)', () => {
  /**
   * @AC-06 — Closed 7-case enum pinned exactly. v0.1 had 5; v0.2 added
   * opacity_zero + html_hidden_attr.
   */
  it('AC-06: HIDDEN_REASON_ENUM is the closed 7-case set', () => {
    expect(Array.isArray(HIDDEN_REASON_ENUM)).toBe(true);
    expect([...HIDDEN_REASON_ENUM].sort()).toEqual([...EXPECTED_REASONS].sort());
    expect(HIDDEN_REASON_ENUM).toHaveLength(7);
  });

  /**
   * @AC-06 — display:none detected.
   */
  it('AC-06: display:none → reason=display_none', () => {
    document.body.innerHTML = '';
    const el = document.createElement('div');
    el.id = 'd-none';
    el.style.display = 'none';
    document.body.appendChild(el);
    const result: HiddenEntry[] = captureHiddenElements(document.body);
    expect(result.some((e) => e.reason === 'display_none')).toBe(true);
  });

  /**
   * @AC-06 — aria-hidden="true" detected.
   */
  it('AC-06: aria-hidden="true" → reason=aria_hidden', () => {
    document.body.innerHTML = '';
    const el = document.createElement('div');
    el.id = 'aria-h';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    const result: HiddenEntry[] = captureHiddenElements(document.body);
    expect(result.some((e) => e.reason === 'aria_hidden')).toBe(true);
  });

  /**
   * @AC-06 — HTML5 `hidden` attribute (v0.2 NEW reason).
   */
  it('AC-06: HTML5 hidden attribute → reason=html_hidden_attr', () => {
    document.body.innerHTML = '';
    const el = document.createElement('div');
    el.id = 'h-attr';
    el.setAttribute('hidden', '');
    document.body.appendChild(el);
    const result: HiddenEntry[] = captureHiddenElements(document.body);
    expect(result.some((e) => e.reason === 'html_hidden_attr')).toBe(true);
  });

  /**
   * @AC-06 — opacity:0 (v0.2 NEW reason).
   */
  it('AC-06: opacity:0 → reason=opacity_zero', () => {
    document.body.innerHTML = '';
    const el = document.createElement('div');
    el.id = 'op0';
    el.style.opacity = '0';
    el.style.width = '10px';
    el.style.height = '10px';
    document.body.appendChild(el);
    const result: HiddenEntry[] = captureHiddenElements(document.body);
    expect(result.some((e) => e.reason === 'opacity_zero')).toBe(true);
  });

  /**
   * @AC-06 — HiddenEntry contract — { selector, reason }.
   */
  it('AC-06: each entry has selector + reason from the closed enum', () => {
    document.body.innerHTML = '';
    const el = document.createElement('span');
    el.setAttribute('aria-hidden', 'true');
    el.id = 'span-aria';
    document.body.appendChild(el);
    const result: HiddenEntry[] = captureHiddenElements(document.body);
    expect(result.length).toBeGreaterThanOrEqual(1);
    for (const entry of result) {
      expect(typeof entry.selector).toBe('string');
      expect(EXPECTED_REASONS).toContain(entry.reason);
    }
  });
});

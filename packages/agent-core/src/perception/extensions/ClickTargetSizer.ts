/**
 * ClickTargetSizer — Phase 1b T1B-002 (AC-02, REQ-ANALYZE-PERCEPTION-V24-001).
 *
 * Source: spec.md R-02 + AC-02; plan.md §2.1-2.2; tasks.md T1B-002.
 *
 * Maps T1B-000 substrate `ctx.ctas[]` into `clickTargets[]` with:
 *   - isMobileTapFriendly : sizePx.width ≥ 48 AND sizePx.height ≥ 48 (R-02 v0.2
 *     uses ≥48 — Google mobile-friendly — vs WCAG 2.5.5 literal ≥44; 48 inclusive).
 *   - elementType : coarse 4-enum (cta/link/form_control/icon_button) per
 *     spec §Out of Scope v0.2 (finer taxonomy deferred).
 *   - isAboveFold : Wave 3 simplification — substrate carries only sizePx,
 *     not y. Re-querying live DOM per CTA would re-introduce the per-element
 *     cost substrate avoids. Approximation: first N=5 CTAs by document order
 *     (typical PDP hero + primary ATC + 2-3 in-fold supporting CTAs). Queued
 *     for T1B-002 v2 polish: extend SizePxSchema with `y` so above-fold becomes
 *     `y < viewport.height` per AC-02 scenario 3.
 *
 * R10: file ≤150 LOC, functions ≤50 LOC, named exports, no `any`.
 * R24: pure factual capture — 48×48 is the WCAG threshold (NOT "too small"
 * judgment); elementType is structural classification (NOT quality).
 */

import type { Cta, FormField, Heading, PrimaryAction } from '../types.js';

// Minimal DOM surface — agent-core's tsconfig excludes the DOM lib.
// Wave 3 accepts `doc` for ExtractCtx signature uniformity (plan §2.2) but
// does not depend on it — substrate `ctas[]` already encodes everything
// AC-02 verifies.
interface DocumentLike {
  querySelector?(selectors: string): unknown;
}

/** Viewport size in CSS pixels — passed in from ContextAssembler. */
export interface Viewport {
  width: number;
  height: number;
}

/** ExtractCtx subset this extractor reads (plan.md §2.2). */
export interface ExtractCtx {
  ctas: Cta[];
  formFields: FormField[];
  metadata: {
    schemaOrg: Array<Record<string, unknown>>;
    ogTags: Record<string, string>;
  };
  headings: Heading[];
  primaryActions: PrimaryAction | null;
}

/** Spec R-02 / AC-02 element-type taxonomy (coarse 4-type enum). */
export type ClickTargetElementType = 'cta' | 'link' | 'form_control' | 'icon_button';

/** Single click-target record emitted into PageStateModel.clickTargets[]. */
export interface ClickTarget {
  index: number;
  selector: string;
  text: string;
  sizePx: { width: number; height: number };
  isMobileTapFriendly: boolean;
  elementType: ClickTargetElementType;
  isAboveFold: boolean;
}

/** R-02 WCAG-mobile threshold (≥48 inclusive — 48×48 PASSES per AC-02). */
const MOBILE_TAP_FRIENDLY_MIN_PX = 48;
/** Icon-button width cap: empty/iconic text + width <64 → icon_button. */
const ICON_BUTTON_MAX_WIDTH_PX = 64;
/** Wave 3 isAboveFold approximation cutoff (document order). */
const ABOVE_FOLD_INDEX_CUTOFF = 5;
/** Icon-only text predicate — empty, single char, or 1-3 non-word chars. */
const ICON_ONLY_TEXT_PATTERN = /^[\W_]{1,3}$/;

/**
 * Classify a substrate CTA into the 4-type coarse enum (AC-02 + R-02 v0.2).
 * Order is significant (first match wins). Structural classification only
 * (R24); not a quality assessment.
 *   1. form_control : selector hints at <input>/<select>/<textarea>
 *   2. icon_button  : width < 64 px AND text is empty/single-char/iconic
 *   3. link         : selector starts with 'a' / role=link
 *   4. cta          : default — branded buttons + large prominent CTAs
 */
function classifyElementType(cta: Cta): ClickTargetElementType {
  const sel = cta.selector.toLowerCase();
  const role = (cta.role ?? '').toLowerCase();
  const text = cta.text.trim();

  // 1. form_control — selector starts with input/select/textarea tag.
  if (
    sel.startsWith('input') ||
    sel.startsWith('select') ||
    sel.startsWith('textarea')
  ) {
    return 'form_control';
  }

  // 2. icon_button — small + iconic-text. Detected BEFORE link because an
  // icon-only <a> (e.g., hamburger menu link) is more useful as icon_button.
  const isIconText =
    text.length === 0 || text.length === 1 || ICON_ONLY_TEXT_PATTERN.test(text);
  if (cta.sizePx.width < ICON_BUTTON_MAX_WIDTH_PX && isIconText) {
    return 'icon_button';
  }

  // 3. link — <a> tag in selector or role=link.
  if (sel.startsWith('a.') || sel.startsWith('a[') || sel === 'a' || role === 'link') {
    return 'link';
  }

  // 4. cta — default fallback.
  return 'cta';
}

/** Map a single substrate Cta into a ClickTarget record. */
function makeClickTarget(cta: Cta): ClickTarget {
  return {
    index: cta.index,
    selector: cta.selector,
    text: cta.text,
    sizePx: { width: cta.sizePx.width, height: cta.sizePx.height },
    isMobileTapFriendly:
      cta.sizePx.width >= MOBILE_TAP_FRIENDLY_MIN_PX &&
      cta.sizePx.height >= MOBILE_TAP_FRIENDLY_MIN_PX,
    elementType: classifyElementType(cta),
    isAboveFold: cta.index < ABOVE_FOLD_INDEX_CUTOFF,
  };
}

/**
 * Map ExtractCtx.ctas[] into ClickTarget[]. Pure function — synchronous,
 * no side effects, no logging. Signature follows plan.md §2.2:
 * `(doc, viewport, ctx) => Result`. `doc` and `viewport` are reserved
 * for signature uniformity; Wave 3 reads substrate `ctas[]` only.
 */
export function extractClickTargets(
  _doc: DocumentLike,
  _viewport: Viewport,
  ctx: ExtractCtx,
): ClickTarget[] {
  return ctx.ctas.map(makeClickTarget);
}

/**
 * DarkPatternDetector — Phase 5b T5B-007.
 *
 * Detects 5 dark-pattern flags on detected popups (R-06 v0.2 taxonomy):
 *
 *   weighted_default — pre-checked consent input inside popup/CMP banner
 *                      with consent-related label text
 *   forced_action    — popup blocks primary content AND has no dismiss path
 *   deceptive_close  — close button is sub-22^2 px target OR opacity < 0.3
 *   hidden_dismiss   — has close button but no accessible name
 *   no_close_button  — no close button at all
 *
 * Priority (highest wins): weighted_default > forced_action > deceptive_close
 *                          > hidden_dismiss > no_close_button.
 *
 * R24 compliance: emits factual flag tags, NOT predicted conversion delta.
 * R6: no heuristic content, no LLM call.
 *
 * Why a separate weighted_default regex per spec R-06: universally present
 * in CMP cookie banners; in-MVP scope since cookie-banner detection is
 * Phase 5b. Textual dark patterns (confirmshaming / friend-spam /
 * false_urgency) deferred to v1.1 (require NLP).
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/spec.md AC-07 + R-06
 *   docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/tasks.md T5B-007
 *   docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/plan.md §2.5
 *
 * Constitution compliance: R10.1 ≤ 300 LOC. R10.2 named exports. R2 no `any`.
 *
 * Anchor: @T5B-007 — DarkPatternDetector.
 */

export type DarkPatternFlag =
  | 'weighted_default'
  | 'forced_action'
  | 'deceptive_close'
  | 'hidden_dismiss'
  | 'no_close_button';

/**
 * Minimal popup shape DarkPatternDetector inspects. Caller is responsible
 * for assembling these signals from PopupPresenceDetector output + a
 * lightweight DOM query (offset area, computed opacity, inner HTML
 * fragment scoped to the popup root).
 */
export interface PopupCandidate {
  readonly selector: string;
  readonly hasCloseButton: boolean;
  readonly closeButtonAccessibleName: string | null;
  /** Close-button bounding area in px² (width * height). Null if no close btn. */
  readonly closeButtonAreaPx2: number | null;
  /** Close-button computed opacity (0..1). Null if no close btn. */
  readonly closeButtonOpacity: number | null;
  /** True when popup overlay blocks user from interacting with page content. */
  readonly blocksPrimaryContent: boolean;
  /** Popup root innerHTML — scanned for weighted_default signals. */
  readonly innerHtml: string;
  readonly isInitiallyOpen: boolean;
}

// Minimum acceptable close-button tap target: 22 x 22 px = 484 px²
// (44px is mobile-recommended; we relax to 22px to flag only egregiously
// sub-spec dismiss targets as deceptive).
const MIN_CLOSE_BUTTON_AREA_PX2 = 484;

// Below this opacity, the close button is functionally invisible.
const MIN_CLOSE_BUTTON_OPACITY = 0.3;

// Label regex from tasks.md T5B-007: consent-related text near the
// pre-checked input.
const CONSENT_LABEL_REGEX = /(allow|accept|consent|track|cookie|sell)/i;

// Matches a checked checkbox/radio input element followed within the same
// popup innerHTML by a consent-related label. Two-step scan: find the
// checked element, then test for consent term in the surrounding markup.
const CHECKED_INPUT_REGEX =
  /<input\b[^>]*\btype\s*=\s*["'](?:checkbox|radio)["'][^>]*\bchecked\b[^>]*>/i;

function hasWeightedDefault(innerHtml: string): boolean {
  const m = innerHtml.match(CHECKED_INPUT_REGEX);
  if (!m) return false;
  // Pull markup within +/- 200 chars of the matched input to look for the
  // consent label nearby (covers `<label>` neighbours + aria-label values).
  const idx = m.index ?? 0;
  const window = innerHtml.slice(Math.max(0, idx - 200), idx + m[0].length + 200);
  return CONSENT_LABEL_REGEX.test(window);
}

/**
 * Apply priority ordering: return the highest-priority flag that fires,
 * or null if none.
 */
export function detectDarkPatterns(popup: PopupCandidate): DarkPatternFlag | null {
  // 1. weighted_default
  if (hasWeightedDefault(popup.innerHtml)) {
    return 'weighted_default';
  }

  const noDismissPath =
    !popup.hasCloseButton ||
    popup.closeButtonAccessibleName === null ||
    (popup.closeButtonAreaPx2 !== null && popup.closeButtonAreaPx2 < MIN_CLOSE_BUTTON_AREA_PX2) ||
    (popup.closeButtonOpacity !== null && popup.closeButtonOpacity < MIN_CLOSE_BUTTON_OPACITY);

  // 2. forced_action — blocks primary content + no usable dismiss
  if (popup.blocksPrimaryContent && noDismissPath) {
    return 'forced_action';
  }

  // 3. deceptive_close — close exists but is tiny or near-invisible
  if (popup.hasCloseButton) {
    const area = popup.closeButtonAreaPx2;
    const opacity = popup.closeButtonOpacity;
    if (
      (area !== null && area < MIN_CLOSE_BUTTON_AREA_PX2) ||
      (opacity !== null && opacity < MIN_CLOSE_BUTTON_OPACITY)
    ) {
      return 'deceptive_close';
    }
  }

  // 4. hidden_dismiss — close button has no accessible name
  if (popup.hasCloseButton && popup.closeButtonAccessibleName === null) {
    return 'hidden_dismiss';
  }

  // 5. no_close_button
  if (!popup.hasCloseButton) {
    return 'no_close_button';
  }

  return null;
}

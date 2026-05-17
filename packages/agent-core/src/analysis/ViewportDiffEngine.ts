/**
 * ViewportDiffEngine — Phase 5b T5B-004.
 *
 * Compares desktop vs mobile PerceptionBundles and emits ViewportDiffFinding[]
 * across 3 diff dimensions (plan.md §2.3):
 *
 *   1. fold_composition  — set diff of `in_fold` elements (medium severity)
 *   2. cta_visibility    — per-CTA `in_fold` flag diff (high severity)
 *   3. sticky_element    — set diff of `sticky_elements` (medium severity)
 *
 * Severity ordering rationale (tasks.md T5B-004 acceptance):
 *   CTA-visibility = HIGH — fold-hidden mobile CTA is a direct conversion
 *     blocker.
 *   Sticky = MEDIUM — sticky element changes affect nav/CTA reachability.
 *   Fold composition = MEDIUM — set differences signal layout shifts.
 *
 * Matching strategy (plan.md §2.3): match by `selector` (element_id is
 * per-viewport-unstable per §07.7.9.3). Bbox proximity matching deferred to
 * v1.1 — MVP keeps selector equality as the join key.
 *
 * Output shape (`ViewportDiffFinding`) is defined inline per tasks.md
 * T5B-004 — final Finding-lifecycle integration arrives Phase 7 when the
 * canonical Finding type lands; until then this file declares the kind:
 * "viewport_diff" record so downstream code can typecheck against it.
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/plan.md §2.3
 *   docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/tasks.md
 *     T5B-004 — acceptance.
 *   docs/specs/final-architecture/07-analyze-mode.md §7.9.2 multi-viewport
 *     diff.
 *
 * Constitution compliance:
 *   R10.1 file ≤ 300 LOC. R10.2 named exports. R2 no `any`.
 *   R25 emits objective diff data; severity is a 3-level enum (info | medium |
 *     high) NOT a predicted conversion delta.
 *
 * Anchor: @T5B-004 — ViewportDiffEngine.
 */

/**
 * Phase-5b-local minimal PerceptionBundle shape. Phase 7 (T117) will land
 * the canonical PerceptionBundle Zod schema; this interface declares only
 * the 3 sub-shapes ViewportDiffEngine inspects.
 */
export interface CtaRef {
  readonly selector: string;
  readonly in_fold: boolean;
}

export interface ElementRef {
  readonly selector: string;
}

export interface PerceptionBundleLike {
  readonly device_type: 'desktop' | 'mobile';
  readonly in_fold: readonly ElementRef[];
  readonly ctas: readonly CtaRef[];
  readonly sticky_elements: readonly ElementRef[];
}

export type DiffDimension = 'fold_composition' | 'cta_visibility' | 'sticky_element';
export type DiffSeverity = 'info' | 'medium' | 'high';

export interface ViewportDiffFinding {
  readonly kind: 'viewport_diff';
  readonly dimension: DiffDimension;
  readonly severity: DiffSeverity;
  readonly desktop_state: unknown;
  readonly mobile_state: unknown;
}

export interface ViewportDiffInput {
  readonly desktop: PerceptionBundleLike;
  readonly mobile: PerceptionBundleLike;
}

export class ViewportDiffEngine {
  diff(input: ViewportDiffInput): ViewportDiffFinding[] {
    const findings: ViewportDiffFinding[] = [];

    const foldDiff = this.diffFoldComposition(input.desktop, input.mobile);
    if (foldDiff !== null) findings.push(foldDiff);

    findings.push(...this.diffCtaVisibility(input.desktop, input.mobile));

    const stickyDiff = this.diffStickyElements(input.desktop, input.mobile);
    if (stickyDiff !== null) findings.push(stickyDiff);

    return findings;
  }

  private diffFoldComposition(
    desktop: PerceptionBundleLike,
    mobile: PerceptionBundleLike
  ): ViewportDiffFinding | null {
    const d = new Set(desktop.in_fold.map((e) => e.selector));
    const m = new Set(mobile.in_fold.map((e) => e.selector));
    const desktopOnly = [...d].filter((s) => !m.has(s));
    const mobileOnly = [...m].filter((s) => !d.has(s));
    if (desktopOnly.length === 0 && mobileOnly.length === 0) return null;
    return {
      kind: 'viewport_diff',
      dimension: 'fold_composition',
      severity: 'medium',
      desktop_state: { in_fold_only: desktopOnly },
      mobile_state: { in_fold_only: mobileOnly },
    };
  }

  private diffCtaVisibility(
    desktop: PerceptionBundleLike,
    mobile: PerceptionBundleLike
  ): ViewportDiffFinding[] {
    const findings: ViewportDiffFinding[] = [];
    const mobileBySelector = new Map(mobile.ctas.map((c) => [c.selector, c]));
    for (const dCta of desktop.ctas) {
      const mCta = mobileBySelector.get(dCta.selector);
      if (mCta === undefined) continue;
      if (dCta.in_fold !== mCta.in_fold) {
        findings.push({
          kind: 'viewport_diff',
          dimension: 'cta_visibility',
          severity: 'high',
          desktop_state: { selector: dCta.selector, in_fold: dCta.in_fold },
          mobile_state: { selector: mCta.selector, in_fold: mCta.in_fold },
        });
      }
    }
    return findings;
  }

  private diffStickyElements(
    desktop: PerceptionBundleLike,
    mobile: PerceptionBundleLike
  ): ViewportDiffFinding | null {
    const d = new Set(desktop.sticky_elements.map((e) => e.selector));
    const m = new Set(mobile.sticky_elements.map((e) => e.selector));
    const desktopOnly = [...d].filter((s) => !m.has(s));
    const mobileOnly = [...m].filter((s) => !d.has(s));
    if (desktopOnly.length === 0 && mobileOnly.length === 0) return null;
    return {
      kind: 'viewport_diff',
      dimension: 'sticky_element',
      severity: 'medium',
      desktop_state: { sticky_only: desktopOnly },
      mobile_state: { sticky_only: mobileOnly },
    };
  }
}

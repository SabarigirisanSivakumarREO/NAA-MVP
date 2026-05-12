/**
 * HiddenElementCapture — Phase 1c T1C-006 (AC-06, R-06, REQ-BROWSE-PERCEPT-008).
 *
 * Source: phase-1c spec.md AC-06 + R-06 (v0.2); tasks.md T1C-006.
 *
 * Captures DOM elements that are hidden from sighted users along the closed
 * 7-case reason enum:
 *   {display_none, aria_hidden, visibility_hidden, offscreen, zero_dimension,
 *    opacity_zero, html_hidden_attr}
 *
 * `clip_path_inset` + `inert_attr` are DEFERRED to v0.3 (NOT scope here).
 *
 * Hidden elements do NOT contribute to ElementGraph but ARE recorded for
 * heuristic visibility (e.g. coupon-on-load, off-screen CTAs, hidden privacy
 * banners).
 *
 * Detector priority (most-specific authorial intent first; resolves AI
 * Reviewer Pass 2 N2 overlap when multiple reasons match same element):
 *   html_hidden_attr > display_none > visibility_hidden > opacity_zero
 *     > aria_hidden > offscreen > zero_dimension
 *
 * Rationale for placing `aria_hidden` ABOVE `offscreen`/`zero_dimension`
 * (deviating from the task-description suggestion): aria_hidden is explicit
 * authorial a11y intent (an attribute), same family as `[hidden]`. Bbox-based
 * reasons (offscreen, zero_dimension) are computed-layout fallout and should
 * be considered LESS specific than authorial attributes. This ordering also
 * means a layout-engine-less environment (e.g. jsdom which always returns
 * zero rects) correctly attributes aria-hidden elements to `aria_hidden`,
 * not to the catch-all `zero_dimension`.
 *
 * Note: HTML5 `[hidden]` sets `display:none` via UA default stylesheet, so a
 * [hidden] element matches BOTH detectors — we return `html_hidden_attr` since
 * authorial intent is more specific than the computed-style fallout.
 *
 * Note: `opacity:0` is included per CRO definition of hidden = invisible to
 * sighted user. opacity:0 IS hidden under this definition even though AX tree
 * retains the element (it remains focusable + announced to screen readers).
 *
 * Pure + synchronous. R10: ≤300 LOC, functions ≤50 LOC, no `any`. R24:
 * capture-only — no mutation.
 */

/** Closed 7-case enum per R-06 v0.2. */
export type HiddenReason =
  | 'display_none'
  | 'aria_hidden'
  | 'visibility_hidden'
  | 'offscreen'
  | 'zero_dimension'
  | 'opacity_zero'
  | 'html_hidden_attr';

/** Constant array form for runtime iteration + Zod-style validation. */
export const HIDDEN_REASON_ENUM: readonly HiddenReason[] = [
  'display_none',
  'aria_hidden',
  'visibility_hidden',
  'offscreen',
  'zero_dimension',
  'opacity_zero',
  'html_hidden_attr',
] as const;

/** Output entry per AC-06 contract. */
export interface HiddenElement {
  selector: string;
  reason: HiddenReason;
}

/** Optional viewport for `offscreen` detection. Defaults to window.innerWidth/Height. */
export interface Viewport {
  width: number;
  height: number;
}

interface DOMRectLike {
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
}
interface ElementLike {
  readonly tagName: string;
  readonly id: string;
  readonly parentElement: ElementLike | null;
  readonly children: ArrayLike<ElementLike>;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  getBoundingClientRect(): DOMRectLike;
}
interface ComputedStyleLike {
  readonly display: string;
  readonly visibility: string;
  readonly opacity: string;
}
interface RootLike {
  querySelectorAll(selectors: string): ArrayLike<ElementLike>;
  readonly defaultView?: {
    getComputedStyle(el: ElementLike): ComputedStyleLike;
    readonly innerWidth?: number;
    readonly innerHeight?: number;
  } | null;
  readonly ownerDocument?: {
    readonly defaultView?: {
      getComputedStyle(el: ElementLike): ComputedStyleLike;
      readonly innerWidth?: number;
      readonly innerHeight?: number;
    } | null;
  } | null;
}
declare const CSS: { escape(value: string): string } | undefined;

function escapeCss(value: string): string {
  return typeof CSS !== 'undefined' && CSS ? CSS.escape(value) : value;
}

/** Build a best-effort CSS selector for an element. */
function buildSelector(el: ElementLike): string {
  if (el.id) return `#${escapeCss(el.id)}`;
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (!parent) return tag;
  const sibs: ElementLike[] = [];
  for (let i = 0; i < parent.children.length; i += 1) {
    const c = parent.children[i];
    if (c && c.tagName === el.tagName) sibs.push(c);
  }
  if (sibs.length === 1) return tag;
  return `${tag}:nth-of-type(${sibs.indexOf(el) + 1})`;
}

/** Resolve a `defaultView` from a Document or Element root. */
function resolveView(
  root: RootLike,
): {
  getComputedStyle(el: ElementLike): ComputedStyleLike;
  readonly innerWidth?: number;
  readonly innerHeight?: number;
} | null {
  if (root.defaultView) return root.defaultView;
  if (root.ownerDocument && root.ownerDocument.defaultView) {
    return root.ownerDocument.defaultView;
  }
  return null;
}

/**
 * Classify a single element. Returns the FIRST matching reason in priority
 * order (most-specific authorial intent first) or `null` if visible.
 * Priority: html_hidden_attr > display_none > visibility_hidden > opacity_zero
 *           > aria_hidden > offscreen > zero_dimension
 */
function classifyHidden(
  el: ElementLike,
  style: ComputedStyleLike | null,
  vp: Viewport,
): HiddenReason | null {
  if (el.hasAttribute('hidden')) return 'html_hidden_attr';
  if (style && style.display === 'none') return 'display_none';
  if (style && style.visibility === 'hidden') return 'visibility_hidden';
  if (style && style.opacity === '0') return 'opacity_zero';
  if (el.getAttribute('aria-hidden') === 'true') return 'aria_hidden';
  const rect = el.getBoundingClientRect();
  if (
    rect.bottom < 0 ||
    rect.right < 0 ||
    rect.top > vp.height ||
    rect.left > vp.width
  ) {
    return 'offscreen';
  }
  if (rect.width === 0 || rect.height === 0) return 'zero_dimension';
  return null;
}

/**
 * Top-level entry. Pure + synchronous.
 *
 * @param root  Document or Element to scan (uses `querySelectorAll('*')`).
 * @param viewport  CSS-px viewport for offscreen detection. Defaults to the
 *   document's `defaultView` innerWidth/innerHeight, then 1280×800.
 */
export function captureHiddenElements(
  root: RootLike,
  viewport?: Viewport,
): HiddenElement[] {
  const view = resolveView(root);
  const vp: Viewport = viewport ?? {
    width: view?.innerWidth ?? 1280,
    height: view?.innerHeight ?? 800,
  };
  const all = root.querySelectorAll('*');
  const out: HiddenElement[] = [];
  for (let i = 0; i < all.length; i += 1) {
    const el = all[i];
    if (!el) continue;
    const style =
      view && typeof view.getComputedStyle === 'function' ? view.getComputedStyle(el) : null;
    const reason = classifyHidden(el, style, vp);
    if (reason !== null) {
      out.push({ selector: buildSelector(el), reason });
    }
  }
  return out;
}

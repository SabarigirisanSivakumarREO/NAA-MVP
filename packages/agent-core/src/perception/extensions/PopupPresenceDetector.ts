/**
 * PopupPresenceDetector — Phase 1b T1B-004 (AC-04, R-04, REQ-ANALYZE-PERCEPTION-V24-001).
 *
 * Source: phase-1b spec.md AC-04 + R-04 (v0.2); plan.md §2.2 (ExtractCtx).
 *
 * Detects popup PRESENCE at page load. Classifies `type` into the 11-value
 * enum locked by Gate 1 REVISE (popup option a): modal | lightbox | drawer
 * | toast | cookie_banner | consent_form | slide_in_panel |
 * exit_intent_overlay | chat_widget | paywall | other.
 *
 * R5.3 / R24 PERCEPTION MUST NOT: pure structural capture — no judgement,
 * no conversion predictions, no behavior probing. `isEscapeDismissible` and
 * `isClickOutsideDismissible` are emitted as literal `null`; Phase 5b owns
 * runtime-probed dismissibility.
 *
 * Pure + synchronous. R10: file ≤250 LOC, functions ≤50 LOC, no `any`,
 * named exports only. Local DOM types mirror SubstrateExtension /
 * StickyElementDetector (agent-core tsconfig excludes DOM lib by design).
 */

// ── minimal DOM types (local) ────────────────────────────────────────────
interface DOMRectLike {
  readonly width: number; readonly height: number;
  readonly top: number; readonly left: number;
  readonly right: number; readonly bottom: number;
}
interface ElementLike {
  readonly tagName: string;
  readonly id: string;
  readonly textContent: string | null;
  readonly parentElement: ElementLike | null;
  readonly children: ArrayLike<ElementLike>;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  getBoundingClientRect(): DOMRectLike;
  querySelector(selector: string): ElementLike | null;
  querySelectorAll(selectors: string): ArrayLike<ElementLike>;
}
interface ComputedStyleLike {
  position: string; display: string; visibility: string; opacity: string; transform: string;
}
interface DocumentLike {
  querySelectorAll(selectors: string): ArrayLike<ElementLike>;
  defaultView?: { getComputedStyle(el: ElementLike): ComputedStyleLike } | null;
}
declare const CSS: { escape(value: string): string } | undefined;

// ── public contract ──────────────────────────────────────────────────────
export interface Viewport { width: number; height: number }

/** Subset of ExtractCtx (plan.md §2.2). T1B-004 is substrate-light. */
export interface PopupExtractCtx {
  ctas: ReadonlyArray<unknown>;
  formFields: ReadonlyArray<unknown>;
  metadata: { schemaOrg: ReadonlyArray<unknown>; ogTags: Record<string, unknown> };
  headings: ReadonlyArray<unknown>;
  primaryActions: unknown;
}

/** 11-value enum locked by Gate 1 REVISE (popup option a). */
export type PopupType =
  | 'modal' | 'lightbox' | 'drawer' | 'toast'
  | 'cookie_banner' | 'consent_form' | 'slide_in_panel'
  | 'exit_intent_overlay' | 'chat_widget' | 'paywall' | 'other';

/** AC-04 output shape. Behavior fields are literal null. */
export interface Popup {
  type: PopupType;
  selector: string;
  isInitiallyOpen: boolean;
  hasCloseButton: boolean;
  closeButtonAccessibleName: string | null;
  viewportCoveragePercent: number;
  blocksPrimaryContent: boolean;
  isEscapeDismissible: null;
  isClickOutsideDismissible: null;
}

// ── constants ────────────────────────────────────────────────────────────
const BLOCKS_PRIMARY_CONTENT_COVERAGE_PCT = 40;
const CHAT_WIDGET_MAX_WIDTH_FRACTION = 0.35;
const CHAT_WIDGET_EDGE_TOLERANCE_FRACTION = 0.1;
const TOAST_MAX_HEIGHT_PX = 80;
const DRAWER_MAX_WIDTH_FRACTION = 0.4;
const MIN_POPUP_AREA_PX = 100;
const PAYWALL_PATTERN = /subscribe to (read|continue|unlock)|paywall/i;
const CONSENT_PATTERN = /(privacy|consent|gdpr).{0,30}(preferences|choices|settings)/i;
const COOKIE_PATTERN = /cookie|tracking.{0,30}(policy|preference)/i;
const CENTER_TRANSFORM_PATTERN = /translate\(\s*-50%\s*,\s*-50%\s*\)|translate\(-50%,-50%\)/i;
const CLOSE_GLYPH_PATTERN = /^[×✕✖⨯⤫⨉xX]$/;
const SEMANTIC_CLS_PATTERN =
  /modal|popup|lightbox|drawer|toast|snackbar|paywall|consent|cookie|chat/;

// ── helpers ──────────────────────────────────────────────────────────────
function buildSelector(el: ElementLike): string {
  const esc = (s: string): string => (typeof CSS !== 'undefined' && CSS ? CSS.escape(s) : s);
  if (el.id) return `#${esc(el.id)}`;
  const tag = el.tagName.toLowerCase();
  const name = el.getAttribute('name');
  if (name) return `${tag}[name="${esc(name)}"]`;
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

function readStyle(doc: DocumentLike, el: ElementLike): ComputedStyleLike {
  const view = doc.defaultView;
  if (view && typeof view.getComputedStyle === 'function') return view.getComputedStyle(el);
  return { position: '', display: '', visibility: '', opacity: '1', transform: '' };
}

function isVisible(s: ComputedStyleLike): boolean {
  if (s.display === 'none') return false;
  if (s.visibility === 'hidden' || s.visibility === 'collapse') return false;
  const op = Number.parseFloat(s.opacity || '1');
  return Number.isNaN(op) ? true : op > 0;
}

function textOf(el: ElementLike): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function findCloseButton(el: ElementLike): ElementLike | null {
  const direct = el.querySelector(
    'button[aria-label*="close" i], button[aria-label*="dismiss" i], ' +
      '[role="button"][aria-label*="close" i], [role="button"][aria-label*="dismiss" i], ' +
      'button[class*="close" i], [data-dismiss], [data-close]',
  );
  if (direct) return direct;
  const buttons = el.querySelectorAll('button, [role="button"]');
  for (let i = 0; i < buttons.length; i += 1) {
    const b = buttons[i];
    if (!b) continue;
    const t = textOf(b);
    if (CLOSE_GLYPH_PATTERN.test(t) || /^close$|^dismiss$/i.test(t)) return b;
  }
  return null;
}

function accessibleName(btn: ElementLike): string | null {
  const aria = btn.getAttribute('aria-label');
  if (aria && aria.trim()) return aria.trim();
  const t = textOf(btn);
  return t || null;
}

/**
 * NN-LL2 RESOLUTION — deterministic fall-through priority (highest first):
 *   1. paywall            — paywall class/id or paywall copy
 *   2. consent_form       — privacy/consent/gdpr preferences phrasing
 *   3. cookie_banner      — cookie/tracking copy near top/bottom edge
 *   4. exit_intent_overlay — exit-intent class or data attribute
 *   5. slide_in_panel     — slide-in class
 *   6. chat_widget        — chat class + bottom-right + narrow
 *   7. toast              — role=alert/status or toast/snackbar + short
 *   8. drawer             — drawer/sidebar + narrow
 *   9. lightbox           — lightbox class or full-coverage with <img>
 *  10. modal              — role=dialog / aria-modal / modal class
 *  11. other              — fallback
 *
 * Rationale: paywall + consent + cookie outrank `modal` because most
 * regulatory dialogs ALSO carry role="dialog"; modal must be last among
 * concrete classifiers to act as the default-centered fallback.
 */
function classifyPopup(
  el: ElementLike, rect: DOMRectLike, viewport: Viewport, coverage: number,
): PopupType {
  const cls = (el.getAttribute('class') ?? '').toLowerCase();
  const id = el.id.toLowerCase();
  const role = (el.getAttribute('role') ?? '').toLowerCase();
  const ariaModal = (el.getAttribute('aria-modal') ?? '').toLowerCase() === 'true';
  const dataExit = el.hasAttribute('data-exit-intent') ||
    (el.getAttribute('data-trigger') ?? '').toLowerCase().includes('exit');
  const text = textOf(el);
  if (/paywall/.test(cls) || /paywall/.test(id) || PAYWALL_PATTERN.test(text)) return 'paywall';
  if ((role === 'dialog' || /consent/.test(cls)) && CONSENT_PATTERN.test(text)) return 'consent_form';
  const nearTop = rect.top <= 10;
  const nearBottom = rect.bottom >= viewport.height - 10;
  if (COOKIE_PATTERN.test(text) && (nearTop || nearBottom)) return 'cookie_banner';
  if (/exit-?intent/.test(cls) || dataExit) return 'exit_intent_overlay';
  if (/slide-?in/.test(cls)) return 'slide_in_panel';
  const nearBottomRight =
    rect.right >= viewport.width * (1 - CHAT_WIDGET_EDGE_TOLERANCE_FRACTION) &&
    rect.bottom >= viewport.height * (1 - CHAT_WIDGET_EDGE_TOLERANCE_FRACTION);
  if (/chat/.test(cls) && nearBottomRight && rect.width < viewport.width * CHAT_WIDGET_MAX_WIDTH_FRACTION) {
    return 'chat_widget';
  }
  if ((role === 'alert' || role === 'status' || /toast|snackbar/.test(cls)) && rect.height <= TOAST_MAX_HEIGHT_PX) {
    return 'toast';
  }
  if (/drawer|sidebar/.test(cls) && rect.width < viewport.width * DRAWER_MAX_WIDTH_FRACTION) return 'drawer';
  if (/lightbox/.test(cls)) return 'lightbox';
  if (coverage >= 95 && el.querySelector('img')) return 'lightbox';
  if (role === 'dialog' || ariaModal || /modal/.test(cls)) return 'modal';
  return 'other';
}

/**
 * Entry point. Pure + synchronous. Returns `[]` when no candidates match
 * (never `null`). Behavior fields are always literal `null` (Phase 5b owns
 * runtime probing).
 */
export function extractPopups(
  doc: DocumentLike, viewport: Viewport, _ctx: PopupExtractCtx,
): Popup[] {
  void _ctx; // reserved for forward-compat; not consumed by presence layer
  const candidates = doc.querySelectorAll(
    'div, aside, section, dialog, [role="dialog"], [role="alert"], [role="status"], [aria-modal="true"]',
  );
  const out: Popup[] = [];
  const vpArea = Math.max(1, viewport.width * viewport.height);
  for (let i = 0; i < candidates.length; i += 1) {
    const el = candidates[i];
    if (!el) continue;
    const style = readStyle(doc, el);
    const role = (el.getAttribute('role') ?? '').toLowerCase();
    const ariaModal = (el.getAttribute('aria-modal') ?? '').toLowerCase() === 'true';
    const cls = (el.getAttribute('class') ?? '').toLowerCase();
    const positioned =
      style.position === 'fixed' || style.position === 'sticky' || style.position === 'absolute';
    const semanticPopup =
      role === 'dialog' || role === 'alert' || role === 'status' || ariaModal ||
      SEMANTIC_CLS_PATTERN.test(cls);
    if (!positioned && !semanticPopup) continue;
    const rect = el.getBoundingClientRect();
    const area = Math.max(0, rect.width) * Math.max(0, rect.height);
    if (area < MIN_POPUP_AREA_PX && !semanticPopup) continue;
    const coverage = Math.min(100, (area / vpArea) * 100);
    const closeBtn = findCloseButton(el);
    const isCentered = CENTER_TRANSFORM_PATTERN.test(style.transform);
    out.push({
      type: classifyPopup(el, rect, viewport, coverage),
      selector: buildSelector(el),
      isInitiallyOpen: isVisible(style),
      hasCloseButton: closeBtn !== null,
      closeButtonAccessibleName: closeBtn ? accessibleName(closeBtn) : null,
      viewportCoveragePercent: coverage,
      blocksPrimaryContent: coverage > BLOCKS_PRIMARY_CONTENT_COVERAGE_PCT || isCentered,
      isEscapeDismissible: null,
      isClickOutsideDismissible: null,
    });
  }
  return out;
}

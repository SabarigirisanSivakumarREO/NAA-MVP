/**
 * CookieBannerDetector — Phase 5b T5B-016 (AC-16, REQ-BROWSE-COOKIE-001).
 *
 * Source: phase-5b spec.md §4.4 + AC-16; plan.md §2.6 (7-library signature
 *   table); tasks.md T5B-016 (NF-06 precision ≥95% on 8-fixture set).
 *
 * Detects cookie / consent banners by selector signature (7 named CMP
 * libraries) plus a relaxed Generic fallback (fixed-position element,
 * cookie/consent/privacy/preferences copy, >5% fold coverage, accept
 * button present). Returns a BannerDescriptor with library tag, CSS
 * selector, and dismissibility metadata (accept_selector, optional
 * reject_selector + settings_selector) — consumed by CookieBannerPolicy
 * (T5B-017).
 *
 * R5.3 / R24 PERCEPTION MUST NOT: structural-only detection. No judgment.
 *   Dismissibility selectors are STATIC CSS strings; no clicks fired here.
 * R10: file ≤300 LOC, functions ≤50 LOC, no `any`, named exports only.
 * R9: zero vendor deps; pure-DOM (operates on local DocumentLike contract).
 */

// ── minimal DOM types (local — agent-core tsconfig excludes DOM lib) ─────
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
  position: string;
  display: string;
  visibility: string;
  opacity: string;
}
interface DocumentLike {
  querySelector(selectors: string): ElementLike | null;
  querySelectorAll(selectors: string): ArrayLike<ElementLike>;
  defaultView?: { getComputedStyle(el: ElementLike): ComputedStyleLike } | null;
}
declare const CSS: { escape(value: string): string } | undefined;

// ── public contract ──────────────────────────────────────────────────────
export interface Viewport {
  width: number;
  height: number;
}

/** 7 named libraries per plan §2.6 + "generic" fallback. */
export type CookieBannerLibrary =
  | 'OneTrust'
  | 'Cookiebot'
  | 'TrustArc'
  | 'Quantcast Choice'
  | 'Didomi'
  | 'Iubenda'
  | 'Sourcepoint'
  | 'generic';

export interface BannerDismissibility {
  /** CSS selector for the Accept / Allow / Agree button. */
  accept_selector: string | null;
  /** CSS selector for the Reject / Decline button (if present). */
  reject_selector?: string | null;
  /** CSS selector for the cookie settings / preferences button. */
  settings_selector?: string | null;
}

export interface BannerDescriptor {
  library: CookieBannerLibrary;
  /** CSS selector resolving to the banner root element. */
  selector: string;
  /** % of viewport fold (height) covered by the banner (0..100). */
  foldCoveragePercent: number;
  dismissibility: BannerDismissibility;
}

// ── constants ────────────────────────────────────────────────────────────
const COOKIE_TEXT_PATTERN = /(cookie|consent|privacy|preferences)/i;
const ACCEPT_PATTERN = /\b(accept|allow|got it|ok|agree|continue|i accept|i agree)\b/i;
const REJECT_PATTERN = /\b(reject|decline|refuse|deny|disagree)\b/i;
const SETTINGS_PATTERN = /\b(settings|preferences|manage|customi[sz]e|options)\b/i;
const GENERIC_MIN_FOLD_PERCENT = 5; // relaxed from 20% per act-018

/**
 * Library signature table — order matters (most-specific FIRST). Each entry
 * supplies the root selector(s) tried in turn; the first match wins.
 */
interface LibrarySignature {
  library: CookieBannerLibrary;
  rootSelectors: string[];
}
const SIGNATURES: ReadonlyArray<LibrarySignature> = [
  { library: 'OneTrust', rootSelectors: ['#onetrust-banner-sdk', '#onetrust-pc-sdk', '[id^="onetrust-"]'] },
  { library: 'Cookiebot', rootSelectors: ['#CybotCookiebotDialog', '[id^="Cybot"]'] },
  { library: 'TrustArc', rootSelectors: ['#truste-consent-track', 'iframe[src*="trustarc.com"]'] },
  { library: 'Quantcast Choice', rootSelectors: ['#qc-cmp2-container', '[class^="qc-cmp"]', 'iframe[id^="cmp"]'] },
  { library: 'Didomi', rootSelectors: ['#didomi-notice', '#didomi-popup', '[class*="didomi"]'] },
  { library: 'Iubenda', rootSelectors: ['#iubenda-cs-banner', '[class^="iubenda-cs"]', 'iframe[src*="iubenda.com"]'] },
  { library: 'Sourcepoint', rootSelectors: ['iframe[id^="sp_message"]', '[class*="sp_message_container"]'] },
];

// ── helpers ──────────────────────────────────────────────────────────────
function buildSelector(el: ElementLike): string {
  const esc = (s: string): string => (typeof CSS !== 'undefined' && CSS ? CSS.escape(s) : s);
  if (el.id) return `#${esc(el.id)}`;
  const cls = el.getAttribute('class');
  if (cls) {
    const first = cls.split(/\s+/).filter(Boolean)[0];
    if (first) return `${el.tagName.toLowerCase()}.${esc(first)}`;
  }
  return el.tagName.toLowerCase();
}

function readStyle(doc: DocumentLike, el: ElementLike): ComputedStyleLike {
  const view = doc.defaultView;
  if (view && typeof view.getComputedStyle === 'function') return view.getComputedStyle(el);
  return { position: '', display: '', visibility: '', opacity: '1' };
}

function isFixedAndVisible(s: ComputedStyleLike): boolean {
  if (s.display === 'none') return false;
  if (s.visibility === 'hidden' || s.visibility === 'collapse') return false;
  const op = Number.parseFloat(s.opacity || '1');
  if (!Number.isNaN(op) && op === 0) return false;
  return s.position === 'fixed' || s.position === 'sticky' || s.position === '';
}

function foldCoverage(rect: DOMRectLike, viewport: Viewport): number {
  if (viewport.height <= 0) return 0;
  const visibleH = Math.max(0, Math.min(rect.bottom, viewport.height) - Math.max(rect.top, 0));
  return (visibleH / viewport.height) * 100;
}

function findButton(el: ElementLike, pattern: RegExp): ElementLike | null {
  const buttons = el.querySelectorAll(
    'button, [role="button"], a[role="button"], input[type="button"], input[type="submit"]',
  );
  for (let i = 0; i < buttons.length; i += 1) {
    const b = buttons[i];
    if (!b) continue;
    const txt = (b.textContent ?? '').trim();
    const aria = b.getAttribute('aria-label') ?? '';
    if (pattern.test(txt) || pattern.test(aria)) return b;
  }
  return null;
}

function buildButtonSelector(root: ElementLike, btn: ElementLike): string {
  const rootSel = buildSelector(root);
  const btnSel = buildSelector(btn);
  return rootSel === btnSel ? btnSel : `${rootSel} ${btnSel}`;
}

function collectDismissibility(root: ElementLike): BannerDismissibility {
  const accept = findButton(root, ACCEPT_PATTERN);
  const reject = findButton(root, REJECT_PATTERN);
  const settings = findButton(root, SETTINGS_PATTERN);
  return {
    accept_selector: accept ? buildButtonSelector(root, accept) : null,
    reject_selector: reject ? buildButtonSelector(root, reject) : null,
    settings_selector: settings ? buildButtonSelector(root, settings) : null,
  };
}

function matchLibrary(doc: DocumentLike): { library: CookieBannerLibrary; root: ElementLike } | null {
  for (const sig of SIGNATURES) {
    for (const sel of sig.rootSelectors) {
      const el = doc.querySelector(sel);
      if (el) return { library: sig.library, root: el };
    }
  }
  return null;
}

function matchGeneric(doc: DocumentLike, viewport: Viewport): ElementLike | null {
  const candidates = doc.querySelectorAll('div, section, aside, header, footer');
  for (let i = 0; i < candidates.length; i += 1) {
    const el = candidates[i];
    if (!el) continue;
    const style = readStyle(doc, el);
    if (!isFixedAndVisible(style)) continue;
    const txt = (el.textContent ?? '').slice(0, 2000);
    if (!COOKIE_TEXT_PATTERN.test(txt)) continue;
    const rect = el.getBoundingClientRect();
    if (foldCoverage(rect, viewport) < GENERIC_MIN_FOLD_PERCENT) continue;
    if (!findButton(el, ACCEPT_PATTERN)) continue;
    return el;
  }
  return null;
}

// ── public API ───────────────────────────────────────────────────────────

/**
 * Detect a cookie / consent banner present in the page. Returns null when
 * neither a named-library signature nor the relaxed Generic heuristic
 * matches.
 *
 * @param doc Document under inspection (jsdom in tests, page DOM in prod).
 * @param viewport Viewport size (used for fold-coverage gate).
 */
export function detectCookieBanner(
  doc: DocumentLike,
  viewport: Viewport,
): BannerDescriptor | null {
  const lib = matchLibrary(doc);
  if (lib) {
    const rect = lib.root.getBoundingClientRect();
    return {
      library: lib.library,
      selector: buildSelector(lib.root),
      foldCoveragePercent: foldCoverage(rect, viewport),
      dismissibility: collectDismissibility(lib.root),
    };
  }
  const generic = matchGeneric(doc, viewport);
  if (generic) {
    const rect = generic.getBoundingClientRect();
    return {
      library: 'generic',
      selector: buildSelector(generic),
      foldCoveragePercent: foldCoverage(rect, viewport),
      dismissibility: collectDismissibility(generic),
    };
  }
  return null;
}

/**
 * NondeterminismDetector — Phase 1c T1C-008 (AC-08, R-08, REQ-ANALYZE-PERCEPTION-V25-001).
 *
 * Source: phase-1c spec.md AC-08 + R-08 (v0.2); phase-1c tasks.md T1C-008.
 *
 * Detects client-observable sources of page non-determinism (per-visit
 * variability that would invalidate a frozen PerceptionBundle reproducibility
 * baseline). Emits a closed 9-value `NondeterminismFlag` set:
 *
 *   - optimizely_active, vwo_active, google_optimize_active, adobe_target_active
 *       → A/B testing engines (script-presence probe)
 *   - session_replay_active
 *       → DOM-injection-hook session-replay vendors
 *         (Hotjar / FullStory / Mouseflow / CrazyEgg / Smartlook)
 *   - ad_auction_detected, privacy_sandbox_active
 *       → JS-API-presence (navigator.runAdAuction, document.browsingTopics,
 *         navigator.joinAdInterestGroup)
 *   - personalization_cookies_detected
 *       → cookie-pattern catch-all for visitor-segment / persona / abtest /
 *         Optimizely `_o*` / VWO `_vwo_*` style cookies
 *   - countdown_timer_detected
 *       → DOM scan for "ends in" / "expires" copy adjacent to a clock-format
 *         timer (heuristic: same DOMRect cluster)
 *
 * OUT OF SCOPE per R-08 v0.2: Server-side / CDN-edge personalization
 * (Akamai EdgeWorkers, Cloudflare Workers, Vercel edge middleware) is
 * UNDETECTABLE from the client and intentionally not probed. Flagging it
 * here would produce false negatives that look authoritative.
 *
 * R5.3 / R24 PERCEPTION MUST NOT: pure capture — no judgement, no LLM, no
 * state mutation, no network calls. Returns the detected flag set; downstream
 * (analysis / scoring) decides what to do with it.
 *
 * R10: file ≤300 LOC, functions ≤50 LOC, no `any`, named exports only. DOM
 * types are local (agent-core tsconfig excludes the DOM lib by design).
 */

import { z } from 'zod';

// ── minimal DOM types (local) ────────────────────────────────────────────
interface DOMRectLike {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}
interface ElementLike {
  readonly tagName: string;
  readonly textContent: string | null;
  getAttribute(name: string): string | null;
  getBoundingClientRect?(): DOMRectLike;
}
interface DocumentLike {
  readonly cookie?: string;
  querySelectorAll(selectors: string): ArrayLike<ElementLike>;
  // Privacy Sandbox: document.browsingTopics()
  browsingTopics?: unknown;
}
interface WindowLike {
  optimizely?: unknown;
  VWO?: unknown;
  adobe?: { target?: unknown } | unknown;
  mbox?: unknown;
  _gaq?: unknown;
  // Privacy Sandbox / Protected Audience APIs live on `navigator`
  navigator?: {
    runAdAuction?: unknown;
    joinAdInterestGroup?: unknown;
  };
}

// ── public contract ──────────────────────────────────────────────────────
/** Closed 9-value enum per AC-08 + R-08 (v0.2). */
export const NONDETERMINISM_FLAG_ENUM = [
  'optimizely_active',
  'vwo_active',
  'google_optimize_active',
  'adobe_target_active',
  'personalization_cookies_detected',
  'session_replay_active',
  'ad_auction_detected',
  'privacy_sandbox_active',
  'countdown_timer_detected',
] as const;

export type NondeterminismFlag = (typeof NONDETERMINISM_FLAG_ENUM)[number];

export const NondeterminismFlagSchema = z.enum(NONDETERMINISM_FLAG_ENUM);

// ── probe constants ──────────────────────────────────────────────────────
const SESSION_REPLAY_SRC_PATTERNS: readonly RegExp[] = [
  /static\.hotjar\.com/i,
  /cdn\.mouseflow\.com/i,
  /(?:^|\W)fullstory\.com/i,
  /script\.crazyegg\.com/i,
  /cdn\.smartlook\.com/i,
];
const OPTIMIZELY_SRC = /cdn\.optimizely\.com/i;
const VWO_SRC = /visualwebsiteoptimizer\.com/i;
const GOOGLE_OPTIMIZE_SRC = /optimize\.google\.com/i;
const PERSONALIZATION_COOKIE_PATTERN =
  /(?:^|;|\s)\s*(?:_(?:visitor_segment|uid|user_segment|persona|abtest)\b|_o[a-z]+\b|_vwo[_a-z0-9]*\b)/i;
const COUNTDOWN_COPY_PATTERN = /(?:ends|expires?|deal\s+ends|sale\s+ends)\s+in\b/i;
const COUNTDOWN_TIMER_PATTERN = /\b\d{1,2}\s*[:hm]\s*\d{1,2}\b/;
const COUNTDOWN_PROXIMITY_PX = 100;

// ── helpers ──────────────────────────────────────────────────────────────
function hasScriptSrc(doc: DocumentLike, pattern: RegExp): boolean {
  const scripts = doc.querySelectorAll('script[src]');
  for (let i = 0; i < scripts.length; i += 1) {
    const s = scripts[i];
    const src = s ? s.getAttribute('src') : null;
    if (src && pattern.test(src)) return true;
  }
  return false;
}

function detectOptimizely(win: WindowLike, doc: DocumentLike): boolean {
  if (typeof win.optimizely !== 'undefined') return true;
  return hasScriptSrc(doc, OPTIMIZELY_SRC);
}

function detectVwo(win: WindowLike, doc: DocumentLike): boolean {
  if (typeof win.VWO !== 'undefined') return true;
  return hasScriptSrc(doc, VWO_SRC);
}

function detectGoogleOptimize(win: WindowLike, doc: DocumentLike): boolean {
  // Sunset Sep 2023; legacy containers still common. Probe residual globals
  // + script src (no false-positive on GA4 — GA4 doesn't load optimize.google.com).
  if (typeof win._gaq !== 'undefined' && hasScriptSrc(doc, GOOGLE_OPTIMIZE_SRC)) return true;
  return hasScriptSrc(doc, GOOGLE_OPTIMIZE_SRC);
}

function detectAdobeTarget(win: WindowLike): boolean {
  const adobe = win.adobe as { target?: unknown } | undefined;
  if (adobe && typeof adobe === 'object' && typeof adobe.target !== 'undefined') return true;
  return typeof win.mbox !== 'undefined';
}

function detectSessionReplay(doc: DocumentLike): boolean {
  const scripts = doc.querySelectorAll('script[src]');
  for (let i = 0; i < scripts.length; i += 1) {
    const s = scripts[i];
    const src = s ? s.getAttribute('src') : null;
    if (!src) continue;
    for (const pat of SESSION_REPLAY_SRC_PATTERNS) {
      if (pat.test(src)) return true;
    }
  }
  return false;
}

function detectAdAuction(win: WindowLike): boolean {
  const nav = win.navigator;
  return !!nav && typeof nav.runAdAuction === 'function';
}

function detectPrivacySandbox(win: WindowLike, doc: DocumentLike): boolean {
  if (typeof doc.browsingTopics === 'function') return true;
  const nav = win.navigator;
  return !!nav && typeof nav.joinAdInterestGroup === 'function';
}

function detectPersonalizationCookies(doc: DocumentLike): boolean {
  const cookie = typeof doc.cookie === 'string' ? doc.cookie : '';
  if (!cookie) return false;
  return PERSONALIZATION_COOKIE_PATTERN.test(cookie);
}

function rectsNear(a: DOMRectLike, b: DOMRectLike): boolean {
  const dx = Math.max(0, Math.max(a.left - b.right, b.left - a.right));
  const dy = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom));
  return dx <= COUNTDOWN_PROXIMITY_PX && dy <= COUNTDOWN_PROXIMITY_PX;
}

function findRectsByPattern(
  doc: DocumentLike,
  pattern: RegExp,
): DOMRectLike[] {
  const out: DOMRectLike[] = [];
  const candidates = doc.querySelectorAll('span, div, p, time, b, strong, em, h1, h2, h3, h4, h5, h6');
  for (let i = 0; i < candidates.length; i += 1) {
    const el = candidates[i];
    if (!el) continue;
    const text = (el.textContent ?? '').trim();
    if (!text || !pattern.test(text)) continue;
    if (typeof el.getBoundingClientRect !== 'function') {
      // Layout unavailable (jsdom default) — fall back to "exists" proxy.
      out.push({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
      continue;
    }
    out.push(el.getBoundingClientRect());
  }
  return out;
}

function detectCountdownTimer(doc: DocumentLike): boolean {
  const copyRects = findRectsByPattern(doc, COUNTDOWN_COPY_PATTERN);
  if (copyRects.length === 0) return false;
  const timerRects = findRectsByPattern(doc, COUNTDOWN_TIMER_PATTERN);
  if (timerRects.length === 0) return false;
  // Heuristic: if layout is unavailable for either side (all zero rects),
  // pair existence is enough to flag.
  const noLayout = (r: DOMRectLike): boolean =>
    r.width === 0 && r.height === 0 && r.top === 0 && r.left === 0;
  if (copyRects.every(noLayout) || timerRects.every(noLayout)) return true;
  for (const c of copyRects) {
    for (const t of timerRects) {
      if (rectsNear(c, t)) return true;
    }
  }
  return false;
}

// ── public entry point ───────────────────────────────────────────────────
/**
 * Detect client-observable non-determinism sources.
 *
 * Signature pinned by AC-08 test: `(window, document) → NondeterminismFlag[]`.
 * Both parameters are accepted as typed structural references for jsdom +
 * node testability (avoids global access; safe under nodejs runtime).
 *
 * Stage 2.5 fix F-008-1c — parameters narrowed to structural Like types.
 * Real browser `Window` / `Document` from jsdom + Playwright satisfy these
 * structurally; the previous `Window | WindowLike` union relied on a
 * global DOM lib reference (in ShadowDomTraverser) that polluted build-wide
 * types — now removed.
 */
export function detectNondeterminism(
  windowRef: WindowLike,
  doc: DocumentLike,
): NondeterminismFlag[] {
  const win = windowRef;
  const document_ = doc;
  const flags: NondeterminismFlag[] = [];

  if (detectOptimizely(win, document_)) flags.push('optimizely_active');
  if (detectVwo(win, document_)) flags.push('vwo_active');
  if (detectGoogleOptimize(win, document_)) flags.push('google_optimize_active');
  if (detectAdobeTarget(win)) flags.push('adobe_target_active');
  if (detectPersonalizationCookies(document_)) flags.push('personalization_cookies_detected');
  if (detectSessionReplay(document_)) flags.push('session_replay_active');
  if (detectAdAuction(win)) flags.push('ad_auction_detected');
  if (detectPrivacySandbox(win, document_)) flags.push('privacy_sandbox_active');
  if (detectCountdownTimer(document_)) flags.push('countdown_timer_detected');

  return flags;
}

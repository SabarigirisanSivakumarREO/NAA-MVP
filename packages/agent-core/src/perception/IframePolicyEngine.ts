/**
 * IframePolicyEngine — Phase 1c T1C-005 (AC-05, R-05, REQ-BROWSE-PERCEPT-007).
 *
 * Source: phase-1c spec.md AC-05 + R-05 (v0.2); plan.md §2.6 (v0.2 purpose
 * table); tasks.md T1C-005.
 *
 * Classifies an iframe by purpose into a closed 9-value enum plus the
 * `cross_origin` security override. Returns a decision object the caller
 * (ElementGraphBuilder / WarningEmitter / DeepPerceiveNode) uses to:
 *   • descend into same-origin checkout / chat iframes (perception extends
 *     into them), or
 *   • skip everything else and emit a typed warning so downstream
 *     analysis knows why content was not captured.
 *
 * CLASSIFIER ORDER (SECURITY-CRITICAL — v0.2 plan.md §2.6):
 *   1. cross_origin check FIRST — security override; supersedes hostname
 *      patterns. A cross-origin iframe is always skipped with IFRAME_SKIPPED
 *      (warn) regardless of what its hostname matches.
 *   2. Security-sensitive purposes — captcha → cmp → payment_3ds — BEFORE
 *      checkout / chat. This prevents a nested reCAPTCHA-inside-Stripe-flow
 *      from being misclassified as `checkout` and descended into (user
 *      challenge content is a security boundary; never descend).
 *   3. checkout / chat — only reached after step 2 confirms not security
 *      sensitive. Descend (same-origin only — step 1 has already filtered).
 *   4. video / analytics / social_embed — non-security non-revenue
 *      content; skip with IFRAME_SKIPPED.
 *   5. other — fallthrough; skip with IFRAME_SKIPPED warn.
 *
 * Optional `ctx.isCommerce` (from T1B-009 CommerceBlockExtractor) downgrades
 * a checkout match obtained only via the Offer-schema probe (NOT via a
 * direct vendor hostname) to `other` on a non-commerce page — a same-origin
 * iframe on, say, a homepage is unlikely to be checkout even if it
 * accidentally references an Offer.
 *
 * R10: ≤300 LOC; functions ≤50 LOC; named exports only; no `any`.
 * R24 PERCEPTION MUST NOT: capture-only — classifier never mutates iframe
 * state, never navigates, never reads cross-origin content.
 *
 * Pure + synchronous. jsdom-friendly. Uses local DOM types (agent-core
 * tsconfig excludes DOM lib by design).
 */

import { z } from 'zod';

// ── minimal DOM types (local) ────────────────────────────────────────────
interface IframeLike {
  readonly src: string;
  getAttribute(name: string): string | null;
}

// ── public contract ──────────────────────────────────────────────────────

/**
 * Closed 9-value enum of named iframe purposes (R-05 v0.2). The `cross_origin`
 * security override is a distinct `purpose` value on the decision but is NOT
 * a member of `IframePurpose` — it never appears in heuristic-facing rollups.
 */
export const IFRAME_PURPOSE_ENUM = [
  'checkout',
  'chat',
  'video',
  'analytics',
  'social_embed',
  'captcha',
  'cmp',
  'payment_3ds',
  'other',
] as const;

export type IframePurpose = (typeof IFRAME_PURPOSE_ENUM)[number];

export const IframePurposeSchema = z.enum(IFRAME_PURPOSE_ENUM);

/** Warning codes emitted by the classifier (subset of R-09 12-code enum). */
export type IframeWarningCode =
  | 'IFRAME_SKIPPED'
  | 'CAPTCHA_DETECTED'
  | 'CMP_DETECTED'
  | 'PAYMENT_3DS_DETECTED';

export type WarningSeverity = 'info' | 'warn' | 'error';

export interface IframeWarning {
  readonly code: IframeWarningCode;
  readonly severity: WarningSeverity;
}

export interface IframePolicyDecision {
  /** Closed 9-value enum OR `cross_origin` security override. */
  readonly purpose: IframePurpose | 'cross_origin';
  readonly action: 'descend' | 'skip';
  /** `null` only when descending (checkout / chat same-origin). */
  readonly warning: IframeWarning | null;
}

/** Classifier context — caller threads pageOrigin + optional hints. */
export interface IframePolicyCtx {
  /** Page origin (scheme + host + optional port) for cross-origin comparison. */
  readonly pageOrigin: string;
  /**
   * Optional hostname override (e.g., the real vendor hostname when the
   * iframe `src` is a same-origin shim that internally redirects to a
   * third-party). When omitted, classifier uses the iframe `src` hostname.
   */
  readonly hostnameHint?: string;
  /**
   * Optional commerce context from T1B-009 CommerceBlockExtractor. If
   * `false` and a checkout match came only from Offer-schema probe (not
   * a direct vendor hostname), classifier downgrades to `other` to avoid
   * false-positive descent on non-commerce pages.
   */
  readonly isCommerce?: boolean;
}

// ── classifier internals ────────────────────────────────────────────────

interface HostnameMatch {
  readonly purpose: IframePurpose;
  /** Whether match is via a direct vendor hostname (vs. Offer probe). */
  readonly viaVendorHostname: boolean;
}

/**
 * Hostname pattern table — order within each tier reflects plan.md §2.6
 * v0.2. Patterns are tested as substrings against the combined
 * `hostname + pathname` of the classification target.
 */
// Bare hostnames (no leading dot) so substring match works for both
// apex domains (e.g. `3dsecure.io`) and subdomains (e.g. `js.stripe.com`).
const CAPTCHA_PATTERNS = [
  'google.com/recaptcha',
  'hcaptcha.com',
  'cloudflare.com/turnstile',
  'arkoselabs.com',
];

const CMP_PATTERNS = [
  'cookielaw.org',
  'cookiebot.com',
  'trustarc.com',
  'usercentrics.eu',
  'consensu.org',
];

const PAYMENT_3DS_PATTERNS = [
  '3dsecure.io',
  'verifiedbyvisa.com',
  'maestrocard.com',
  'securecode.com',
];

const CHECKOUT_PATTERNS = [
  'stripe.com',
  'adyen.com',
  'paypal.com',
  'braintreepayments.com',
  'razorpay.com',
  'ccavenue.com',
];

const CHAT_PATTERNS = [
  'intercom.io',
  'crisp.chat',
  'drift.com',
  'zendesk.com',
  'freshchat.com',
  'tawk.to',
  'olark.com',
];

const VIDEO_PATTERNS = [
  'youtube.com/embed',
  'youtube-nocookie.com',
  'vimeo.com',
  'wistia.com',
  'brightcove.net',
];

const ANALYTICS_PATTERNS = [
  'googletagmanager.com',
  'google-analytics.com',
  'doubleclick.net',
  'bat.bing.com',
  'linkedin.com/li/track',
];

const SOCIAL_EMBED_PATTERNS = [
  'twitter.com',
  'instagram.com',
  'tiktok.com',
  'facebook.com',
  'pinterest.com',
  'linkedin.com/embed',
];

/**
 * Heuristic for 3DS2 challenge iframes hosted under issuer-bank domains
 * (per plan.md §2.6 v0.2 payment_3ds row).
 */
function looksLikeIssuer3DS(target: string): boolean {
  if (!target.includes('3ds')) return false;
  return (
    target.includes('bank') ||
    target.includes('issuer') ||
    target.includes('acs') ||
    target.includes('challenge')
  );
}

/**
 * Try matching `target` (hostname + pathname, lowercased) against a
 * substring pattern table. Returns the first match in list order.
 */
function matchPattern(target: string, patterns: readonly string[]): boolean {
  for (const pat of patterns) {
    if (target.includes(pat)) return true;
  }
  return false;
}

/**
 * Resolve the classification target string from the iframe + ctx. When a
 * `hostnameHint` is provided, prefer it (same-origin shim case); otherwise
 * parse the iframe `src` directly. Returns a lower-cased `hostname +
 * pathname` for substring matching.
 */
function resolveClassificationTarget(iframe: IframeLike, ctx: IframePolicyCtx): string {
  if (ctx.hostnameHint !== undefined && ctx.hostnameHint.length > 0) {
    return ctx.hostnameHint.toLowerCase();
  }
  try {
    const u = new URL(iframe.src);
    return (u.hostname + u.pathname).toLowerCase();
  } catch {
    return iframe.src.toLowerCase();
  }
}

/** Compare iframe src origin to page origin. */
function isCrossOrigin(src: string, pageOrigin: string): boolean {
  let pageOriginNorm: string;
  try {
    pageOriginNorm = new URL(pageOrigin).origin;
  } catch {
    return false;
  }
  // about:blank / data: / javascript: / empty → same-origin (inherits parent).
  if (src.length === 0) return false;
  if (
    src.startsWith('about:') ||
    src.startsWith('data:') ||
    src.startsWith('javascript:') ||
    src.startsWith('blob:')
  ) {
    return false;
  }
  try {
    return new URL(src).origin !== pageOriginNorm;
  } catch {
    // Relative URL → same origin.
    return false;
  }
}

/**
 * Run the hostname pattern tiers in classifier order (security-sensitive
 * before revenue tiers). Returns `null` on fallthrough.
 */
function classifyByHostname(target: string): HostnameMatch | null {
  // Tier 2 — security-sensitive (BEFORE checkout / chat).
  if (matchPattern(target, CAPTCHA_PATTERNS)) {
    return { purpose: 'captcha', viaVendorHostname: true };
  }
  if (matchPattern(target, CMP_PATTERNS)) {
    return { purpose: 'cmp', viaVendorHostname: true };
  }
  if (matchPattern(target, PAYMENT_3DS_PATTERNS) || looksLikeIssuer3DS(target)) {
    return { purpose: 'payment_3ds', viaVendorHostname: true };
  }
  // Tier 3 — revenue (descend, same-origin).
  if (matchPattern(target, CHECKOUT_PATTERNS)) {
    return { purpose: 'checkout', viaVendorHostname: true };
  }
  if (matchPattern(target, CHAT_PATTERNS)) {
    return { purpose: 'chat', viaVendorHostname: true };
  }
  // Tier 4 — non-security non-revenue.
  if (matchPattern(target, VIDEO_PATTERNS)) {
    return { purpose: 'video', viaVendorHostname: true };
  }
  if (matchPattern(target, ANALYTICS_PATTERNS)) {
    return { purpose: 'analytics', viaVendorHostname: true };
  }
  if (matchPattern(target, SOCIAL_EMBED_PATTERNS)) {
    return { purpose: 'social_embed', viaVendorHostname: true };
  }
  return null;
}

/** Map a classified purpose to its skip/descend decision + warning. */
function decisionForPurpose(purpose: IframePurpose): IframePolicyDecision {
  switch (purpose) {
    case 'checkout':
    case 'chat':
      return { purpose, action: 'descend', warning: null };
    case 'captcha':
      return { purpose, action: 'skip', warning: { code: 'CAPTCHA_DETECTED', severity: 'warn' } };
    case 'cmp':
      return { purpose, action: 'skip', warning: { code: 'CMP_DETECTED', severity: 'info' } };
    case 'payment_3ds':
      return {
        purpose,
        action: 'skip',
        warning: { code: 'PAYMENT_3DS_DETECTED', severity: 'warn' },
      };
    case 'analytics':
      return { purpose, action: 'skip', warning: { code: 'IFRAME_SKIPPED', severity: 'info' } };
    case 'video':
    case 'social_embed':
    case 'other':
      return { purpose, action: 'skip', warning: { code: 'IFRAME_SKIPPED', severity: 'warn' } };
  }
}

// ── public API ────────────────────────────────────────────────────────────

/**
 * Classify an iframe and return the perception-layer decision.
 *
 * @param iframe - The iframe element (jsdom or real DOM). Only `src` is read.
 * @param ctx - Required `pageOrigin`; optional `hostnameHint` (same-origin
 *   shim case) and `isCommerce` (T1B-009 context for false-positive
 *   suppression on non-commerce pages).
 */
export function classifyIframe(
  iframe: IframeLike,
  ctx: IframePolicyCtx,
): IframePolicyDecision {
  // STEP 1 — cross_origin security override. Returns FIRST, before any
  // hostname match. A cross-origin iframe is always skipped (R-05 v0.2).
  if (isCrossOrigin(iframe.src, ctx.pageOrigin)) {
    return {
      purpose: 'cross_origin',
      action: 'skip',
      warning: { code: 'IFRAME_SKIPPED', severity: 'warn' },
    };
  }

  // STEP 2-4 — hostname pattern table. Security-sensitive tier checked
  // before checkout/chat (see plan.md §2.6 v0.2 "Captcha-vs-checkout
  // disambiguation" — prevents nested reCAPTCHA-inside-Stripe-checkout
  // from being misclassified as `checkout`).
  const target = resolveClassificationTarget(iframe, ctx);
  const match = classifyByHostname(target);

  if (match === null) {
    return decisionForPurpose('other');
  }

  // T1B-009 commerce-context downgrade: only applies to checkout matches
  // obtained via NON-vendor hostname (e.g. Offer-schema probe). Direct
  // vendor matches stay as `checkout` even on non-commerce pages because
  // the vendor hostname is high-precision.
  if (
    match.purpose === 'checkout' &&
    !match.viaVendorHostname &&
    ctx.isCommerce === false
  ) {
    return decisionForPurpose('other');
  }

  return decisionForPurpose(match.purpose);
}

/**
 * IframePolicyEngine — Phase 1c T1C-005 (AC-05, R-05, REQ-BROWSE-PERCEPT-007).
 *
 * Source: phase-1c spec.md AC-05 + R-05 (v0.2); plan.md §2.6 (v0.2 purpose
 * table); tasks.md T1C-005.
 *
 * Classifies an iframe into a closed 9-value purpose enum plus `cross_origin`
 * security override. Caller uses the decision to (a) descend into same-origin
 * {checkout, chat} iframes or (b) skip everything else and emit a typed warning.
 *
 * CLASSIFIER ORDER (SECURITY-CRITICAL — v0.2 plan.md §2.6):
 *   1. cross_origin FIRST — security override; supersedes all hostname matches.
 *   2. Security-sensitive {captcha → cmp → payment_3ds} BEFORE checkout/chat.
 *      Prevents nested reCAPTCHA-inside-Stripe-flow from being misclassified
 *      as `checkout` and descended into (user challenge content is a security
 *      boundary; never descend).
 *   3. checkout / chat — only after step 2 confirms not security sensitive.
 *   4. video / analytics / social_embed — non-security non-revenue.
 *   5. other — fallthrough.
 *
 * Optional `ctx.isCommerce` (from T1B-009 CommerceBlockExtractor) downgrades a
 * checkout match obtained only via Offer-schema probe (NOT a direct vendor
 * hostname) to `other` on a non-commerce page — suppresses false-positive
 * descent.
 *
 * R10: file ≤300 LOC; functions ≤50 LOC; named exports only; no `any`.
 * R24 PERCEPTION MUST NOT: capture-only; never mutates iframe state, never
 * navigates, never reads cross-origin content.
 *
 * Pure + synchronous. jsdom-friendly. Uses local DOM types (agent-core
 * tsconfig excludes DOM lib by design).
 */

import { z } from 'zod';

interface IframeLike {
  readonly src: string;
  getAttribute(name: string): string | null;
}

// ── public contract ──────────────────────────────────────────────────────

/**
 * Closed 9-value enum (R-05 v0.2). `cross_origin` is a distinct decision
 * `purpose` value but is NOT a member of `IframePurpose` (security override
 * is not a content type).
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

/** Classifier context. */
export interface IframePolicyCtx {
  /** Page origin (scheme + host + optional port) for cross-origin check. */
  readonly pageOrigin: string;
  /**
   * Optional hostname override (e.g., real vendor hostname when iframe `src`
   * is a same-origin shim). When omitted, uses parsed `iframe.src` hostname.
   */
  readonly hostnameHint?: string;
  /**
   * Optional T1B-009 commerce context. If `false` AND checkout match came
   * only via Offer-schema probe (not direct vendor hostname), downgrades to
   * `other` — suppresses false-positive descent on non-commerce pages.
   */
  readonly isCommerce?: boolean;
}

// ── hostname pattern tables ──────────────────────────────────────────────
// Bare hostnames (no leading dot) — substring match works for both apex
// (`3dsecure.io`) and subdomains (`js.stripe.com`).
// prettier-ignore
const CAPTCHA_PATTERNS = ['google.com/recaptcha', 'hcaptcha.com', 'cloudflare.com/turnstile', 'arkoselabs.com'];
// prettier-ignore
const CMP_PATTERNS = ['cookielaw.org', 'cookiebot.com', 'trustarc.com', 'usercentrics.eu', 'consensu.org'];
// prettier-ignore
const PAYMENT_3DS_PATTERNS = ['3dsecure.io', 'verifiedbyvisa.com', 'maestrocard.com', 'securecode.com'];
// prettier-ignore
const CHECKOUT_PATTERNS = ['stripe.com', 'adyen.com', 'paypal.com', 'braintreepayments.com', 'razorpay.com', 'ccavenue.com'];
// prettier-ignore
const CHAT_PATTERNS = ['intercom.io', 'crisp.chat', 'drift.com', 'zendesk.com', 'freshchat.com', 'tawk.to', 'olark.com'];
// prettier-ignore
const VIDEO_PATTERNS = ['youtube.com/embed', 'youtube-nocookie.com', 'vimeo.com', 'wistia.com', 'brightcove.net'];
// prettier-ignore
const ANALYTICS_PATTERNS = ['googletagmanager.com', 'google-analytics.com', 'doubleclick.net', 'bat.bing.com', 'linkedin.com/li/track'];
// prettier-ignore
const SOCIAL_EMBED_PATTERNS = ['twitter.com', 'instagram.com', 'tiktok.com', 'facebook.com', 'pinterest.com', 'linkedin.com/embed'];

// ── classifier internals ─────────────────────────────────────────────────

interface HostnameMatch {
  readonly purpose: IframePurpose;
  /** Match obtained via direct vendor hostname (vs. Offer-schema probe). */
  readonly viaVendorHostname: boolean;
}

/** 3DS2 challenge iframe hosted under an issuer-bank domain (plan §2.6). */
function looksLikeIssuer3DS(target: string): boolean {
  if (!target.includes('3ds')) return false;
  return (
    target.includes('bank') ||
    target.includes('issuer') ||
    target.includes('acs') ||
    target.includes('challenge')
  );
}

function matchPattern(target: string, patterns: readonly string[]): boolean {
  for (const pat of patterns) {
    if (target.includes(pat)) return true;
  }
  return false;
}

/**
 * Resolve classification target: lower-cased `hostname + pathname`. Prefers
 * `ctx.hostnameHint` (same-origin shim case) over parsed `iframe.src`.
 */
function resolveClassificationTarget(
  iframe: IframeLike,
  ctx: IframePolicyCtx,
): string {
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

/** Cross-origin check. about:/data:/javascript:/blob:/empty → same-origin. */
function isCrossOrigin(src: string, pageOrigin: string): boolean {
  if (src.length === 0) return false;
  if (
    src.startsWith('about:') ||
    src.startsWith('data:') ||
    src.startsWith('javascript:') ||
    src.startsWith('blob:')
  ) {
    return false;
  }
  let pageOriginNorm: string;
  try {
    pageOriginNorm = new URL(pageOrigin).origin;
  } catch {
    return false;
  }
  try {
    return new URL(src).origin !== pageOriginNorm;
  } catch {
    return false;
  }
}

/**
 * Run hostname tiers in classifier order: security-sensitive
 * {captcha → cmp → payment_3ds} BEFORE {checkout → chat} BEFORE
 * {video → analytics → social_embed}. Returns `null` on fallthrough.
 */
function classifyByHostname(target: string): HostnameMatch | null {
  if (matchPattern(target, CAPTCHA_PATTERNS)) {
    return { purpose: 'captcha', viaVendorHostname: true };
  }
  if (matchPattern(target, CMP_PATTERNS)) {
    return { purpose: 'cmp', viaVendorHostname: true };
  }
  if (matchPattern(target, PAYMENT_3DS_PATTERNS) || looksLikeIssuer3DS(target)) {
    return { purpose: 'payment_3ds', viaVendorHostname: true };
  }
  if (matchPattern(target, CHECKOUT_PATTERNS)) {
    return { purpose: 'checkout', viaVendorHostname: true };
  }
  if (matchPattern(target, CHAT_PATTERNS)) {
    return { purpose: 'chat', viaVendorHostname: true };
  }
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
      return { purpose, action: 'skip', warning: { code: 'PAYMENT_3DS_DETECTED', severity: 'warn' } };
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
 *   shim case) and `isCommerce` (T1B-009 false-positive suppression).
 */
export function classifyIframe(
  iframe: IframeLike,
  ctx: IframePolicyCtx,
): IframePolicyDecision {
  // STEP 1 — cross_origin security override (R-05 v0.2). Returns FIRST,
  // before any hostname match. Always skip with IFRAME_SKIPPED/warn.
  if (isCrossOrigin(iframe.src, ctx.pageOrigin)) {
    return {
      purpose: 'cross_origin',
      action: 'skip',
      warning: { code: 'IFRAME_SKIPPED', severity: 'warn' },
    };
  }

  // STEPS 2-4 — hostname tiers in security-first order (plan §2.6
  // "Captcha-vs-checkout disambiguation"): a reCAPTCHA nested in a Stripe
  // checkout flow MUST classify as `captcha` (skipped) not `checkout`
  // (descended).
  const target = resolveClassificationTarget(iframe, ctx);
  const match = classifyByHostname(target);

  if (match === null) {
    return decisionForPurpose('other');
  }

  // T1B-009 commerce-context downgrade: only applies when checkout match
  // came via non-vendor hostname (Offer-schema probe). Direct vendor
  // matches stay as checkout — vendor hostname is high-precision.
  if (
    match.purpose === 'checkout' &&
    !match.viaVendorHostname &&
    ctx.isCommerce === false
  ) {
    return decisionForPurpose('other');
  }

  return decisionForPurpose(match.purpose);
}

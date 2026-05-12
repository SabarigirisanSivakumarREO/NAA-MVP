/**
 * AC-05 — IframePolicyEngine conformance (REQ-BROWSE-PERCEPT-007).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md AC-05 + R-05
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/plan.md §2.6 (v0.2 table)
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/tasks.md T1C-005
 *
 * R-05 (v0.2): Closed 9-value IframePurpose enum + cross_origin security
 *   override. Descend on same-origin {checkout, chat}. Skip + IFRAME_SKIPPED
 *   for {video, social_embed, other} (warn) and {analytics} (info). Skip +
 *   distinct security-sensitive warning for {captcha → CAPTCHA_DETECTED (warn),
 *   cmp → CMP_DETECTED (info), payment_3ds → PAYMENT_3DS_DETECTED (warn)}.
 *   Classifier order: cross_origin FIRST → captcha/cmp/payment_3ds BEFORE
 *   checkout/chat (prevents nested-captcha-inside-checkout misclassification).
 *
 * R3.1 TDD (Wave 0 RED): import fails with "module not found" until
 *   T1C-005 lands.
 *
 * Anchor: @AC-05 — classifyIframe(iframe, ctx) → IframePolicyDecision
 *   { purpose: IframePurpose | 'cross_origin'; action: 'descend' | 'skip';
 *     warning: { code, severity } | null }.
 */
import { describe, expect, it } from 'vitest';

import {
  classifyIframe,
  IFRAME_PURPOSE_ENUM,
} from '../../src/perception/IframePolicyEngine.js';

type IframePurpose =
  | 'checkout'
  | 'chat'
  | 'video'
  | 'analytics'
  | 'social_embed'
  | 'captcha'
  | 'cmp'
  | 'payment_3ds'
  | 'other';

interface IframePolicyDecision {
  purpose: IframePurpose | 'cross_origin';
  action: 'descend' | 'skip';
  warning: { code: string; severity: 'info' | 'warn' | 'error' } | null;
}

const EXPECTED_PURPOSES: IframePurpose[] = [
  'checkout',
  'chat',
  'video',
  'analytics',
  'social_embed',
  'captcha',
  'cmp',
  'payment_3ds',
  'other',
];

function makeIframe(src: string): HTMLIFrameElement {
  const ifr = document.createElement('iframe');
  ifr.src = src;
  document.body.appendChild(ifr);
  return ifr;
}

describe('IframePolicyEngine — AC-05 conformance (Wave 0 RED)', () => {
  /**
   * @AC-05 — Closed 9-value enum pinned exactly (v0.2 R-05).
   */
  it('AC-05: IFRAME_PURPOSE_ENUM is the closed 9-value set', () => {
    expect(Array.isArray(IFRAME_PURPOSE_ENUM)).toBe(true);
    expect([...IFRAME_PURPOSE_ENUM].sort()).toEqual([...EXPECTED_PURPOSES].sort());
    expect(IFRAME_PURPOSE_ENUM).toHaveLength(9);
  });

  /**
   * @AC-05 — cross_origin override ALWAYS skips with IFRAME_SKIPPED/warn,
   * regardless of hostname pattern.
   */
  it('AC-05: cross_origin iframe → action=skip + IFRAME_SKIPPED warn', () => {
    const ifr = makeIframe('https://example.com/embed');
    const result: IframePolicyDecision = classifyIframe(ifr, {
      pageOrigin: 'https://my-store.test',
    });
    expect(result.action).toBe('skip');
    expect(result.purpose).toBe('cross_origin');
    expect(result.warning).not.toBeNull();
    expect(result.warning?.code).toBe('IFRAME_SKIPPED');
    expect(result.warning?.severity).toBe('warn');
    ifr.remove();
  });

  /**
   * @AC-05 — same-origin Stripe checkout iframe DESCENDS.
   */
  it('AC-05: same-origin Stripe checkout → action=descend, no warning', () => {
    const ifr = makeIframe('https://my-store.test/checkout/stripe-shim');
    const result: IframePolicyDecision = classifyIframe(ifr, {
      pageOrigin: 'https://my-store.test',
      hostnameHint: 'js.stripe.com',
    });
    expect(result.purpose).toBe('checkout');
    expect(result.action).toBe('descend');
    expect(result.warning).toBeNull();
    ifr.remove();
  });

  /**
   * @AC-05 — analytics iframe → skip + IFRAME_SKIPPED INFO (not warn).
   * Severity routing per plan.md §2.6 v0.2 table.
   */
  it('AC-05: analytics iframe → IFRAME_SKIPPED severity=info', () => {
    const ifr = makeIframe('https://my-store.test/gtm-shim');
    const result: IframePolicyDecision = classifyIframe(ifr, {
      pageOrigin: 'https://my-store.test',
      hostnameHint: 'www.googletagmanager.com',
    });
    expect(result.purpose).toBe('analytics');
    expect(result.action).toBe('skip');
    expect(result.warning?.code).toBe('IFRAME_SKIPPED');
    expect(result.warning?.severity).toBe('info');
    ifr.remove();
  });

  /**
   * @AC-05 — captcha → CAPTCHA_DETECTED warn (security-sensitive; distinct
   * code, not IFRAME_SKIPPED). v0.2 classifier order: captcha BEFORE checkout
   * so a recaptcha nested in a Stripe flow is classified captcha, not checkout.
   */
  it('AC-05: captcha iframe → CAPTCHA_DETECTED severity=warn, action=skip', () => {
    const ifr = makeIframe('https://my-store.test/captcha-shim');
    const result: IframePolicyDecision = classifyIframe(ifr, {
      pageOrigin: 'https://my-store.test',
      hostnameHint: 'www.google.com/recaptcha',
    });
    expect(result.purpose).toBe('captcha');
    expect(result.action).toBe('skip');
    expect(result.warning?.code).toBe('CAPTCHA_DETECTED');
    expect(result.warning?.severity).toBe('warn');
    ifr.remove();
  });

  /**
   * @AC-05 — cmp → CMP_DETECTED info (Phase 5b owns consent dismissal).
   */
  it('AC-05: cmp iframe → CMP_DETECTED severity=info, action=skip', () => {
    const ifr = makeIframe('https://my-store.test/cookielaw-shim');
    const result: IframePolicyDecision = classifyIframe(ifr, {
      pageOrigin: 'https://my-store.test',
      hostnameHint: 'cdn.cookielaw.org',
    });
    expect(result.purpose).toBe('cmp');
    expect(result.action).toBe('skip');
    expect(result.warning?.code).toBe('CMP_DETECTED');
    expect(result.warning?.severity).toBe('info');
    ifr.remove();
  });

  /**
   * @AC-05 — payment_3ds → PAYMENT_3DS_DETECTED warn (auth challenge content,
   * security boundary).
   */
  it('AC-05: payment_3ds iframe → PAYMENT_3DS_DETECTED severity=warn, action=skip', () => {
    const ifr = makeIframe('https://my-store.test/3ds-shim');
    const result: IframePolicyDecision = classifyIframe(ifr, {
      pageOrigin: 'https://my-store.test',
      hostnameHint: '3dsecure.io',
    });
    expect(result.purpose).toBe('payment_3ds');
    expect(result.action).toBe('skip');
    expect(result.warning?.code).toBe('PAYMENT_3DS_DETECTED');
    expect(result.warning?.severity).toBe('warn');
    ifr.remove();
  });

  /**
   * @AC-05 — unknown iframe → "other" purpose with IFRAME_SKIPPED warn.
   */
  it('AC-05: unmatched iframe → purpose=other + IFRAME_SKIPPED severity=warn', () => {
    const ifr = makeIframe('https://my-store.test/random-widget');
    const result: IframePolicyDecision = classifyIframe(ifr, {
      pageOrigin: 'https://my-store.test',
      hostnameHint: 'unknown-vendor.example',
    });
    expect(result.purpose).toBe('other');
    expect(result.action).toBe('skip');
    expect(result.warning?.code).toBe('IFRAME_SKIPPED');
    expect(result.warning?.severity).toBe('warn');
    ifr.remove();
  });
});

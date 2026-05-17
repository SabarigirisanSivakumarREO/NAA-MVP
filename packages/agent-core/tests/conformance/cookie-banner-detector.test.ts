/**
 * Conformance test for AC-16 (T5B-016) — CookieBannerDetector.
 *
 * Source: docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/
 *         spec.md AC-16 + §4.4; plan.md §2.6 (7-library signature table);
 *         tasks.md T5B-016 (NF-06 precision ≥95%).
 *
 * R3.1 TDD (RED): module-not-found at import is the expected failure mode
 * until T5B-016 implementation lands.
 *
 * 8-fixture suite: 7 named libraries + 1 generic. Each fixture asserts
 *   (a) detector returns a BannerDescriptor (not null),
 *   (b) library tag matches the expected value, and
 *   (c) dismissibility metadata exposes an accept_selector that resolves.
 *
 * Anchor: @AC-16 — detectCookieBanner(doc, viewport) → BannerDescriptor | null
 */
import { describe, expect, test } from 'vitest';
import { detectCookieBanner } from '../../src/browser-runtime/CookieBannerDetector.js';

/** Renders a fixture HTML string into the jsdom document. */
function load(html: string): Document {
  document.documentElement.innerHTML = `<head></head><body>${html}</body>`;
  // Force fixed-position + size on banner via inline style (jsdom does
  // not run real layout — getBoundingClientRect needs help).
  return document;
}

const VIEWPORT = { width: 1440, height: 900 };

/** Inline style snippet to make jsdom report a fold-covering rect. */
const BIG_FIXED =
  'style="position:fixed;left:0;bottom:0;width:1440px;height:200px;"';

const FIXTURES: Array<{
  name: string;
  library: string;
  html: string;
}> = [
  {
    name: 'OneTrust',
    library: 'OneTrust',
    html: `<div id="onetrust-banner-sdk" ${BIG_FIXED}>
      <p>We use cookies to improve your experience.</p>
      <button id="onetrust-accept-btn-handler">Accept All Cookies</button>
      <button id="onetrust-reject-all-handler">Reject All</button>
    </div>`,
  },
  {
    name: 'Cookiebot',
    library: 'Cookiebot',
    html: `<div id="CybotCookiebotDialog" ${BIG_FIXED}>
      <p>This site uses cookies for consent.</p>
      <button id="CybotCookiebotDialogBodyLevelButtonAccept">Allow All</button>
    </div>`,
  },
  {
    name: 'TrustArc',
    library: 'TrustArc',
    html: `<div id="truste-consent-track" ${BIG_FIXED}>
      <p>Your privacy preferences.</p>
      <button class="truste-consent-button">Agree and Proceed</button>
    </div>`,
  },
  {
    name: 'Quantcast Choice',
    library: 'Quantcast Choice',
    html: `<div id="qc-cmp2-container" ${BIG_FIXED}>
      <p>Manage cookie consent.</p>
      <button class="qc-cmp2-summary-buttons">I Accept</button>
    </div>`,
  },
  {
    name: 'Didomi',
    library: 'Didomi',
    html: `<div id="didomi-notice" ${BIG_FIXED}>
      <p>Cookie consent.</p>
      <button class="didomi-continue-without-agreeing">Continue</button>
      <button id="didomi-notice-agree-button">Agree</button>
    </div>`,
  },
  {
    name: 'Iubenda',
    library: 'Iubenda',
    html: `<div id="iubenda-cs-banner" ${BIG_FIXED}>
      <p>This website uses cookies.</p>
      <button class="iubenda-cs-accept-btn">Accept</button>
    </div>`,
  },
  {
    name: 'Sourcepoint',
    library: 'Sourcepoint',
    html: `<div class="sp_message_container" ${BIG_FIXED}>
      <p>Consent preferences.</p>
      <iframe id="sp_message_iframe_1"></iframe>
      <button class="sp_choice_type_11">Accept All</button>
    </div>`,
  },
  {
    name: 'generic',
    library: 'generic',
    html: `<div class="banner-generic-cc" ${BIG_FIXED}>
      <p>We use cookies and similar tracking technologies for your privacy.</p>
      <button class="cc-accept">OK, got it</button>
    </div>`,
  },
];

/**
 * jsdom layout shim — make every fixed-positioned element with width/height
 * inline-styles report a rect matching those dimensions (default jsdom
 * returns 0×0). We patch the prototype once per test run.
 */
function patchLayout(): void {
  const proto = (globalThis as unknown as {
    Element: { prototype: { getBoundingClientRect(): DOMRect } };
  }).Element.prototype;
  proto.getBoundingClientRect = function thisRect(this: Element): DOMRect {
    const s = (this as HTMLElement).style;
    const w = Number.parseInt(s.width || '0', 10);
    const h = Number.parseInt(s.height || '0', 10);
    const left = Number.parseInt(s.left || '0', 10);
    const bottom = Number.parseInt(s.bottom || '0', 10);
    const top = bottom ? VIEWPORT.height - h : Number.parseInt(s.top || '0', 10);
    return {
      x: left, y: top, width: w, height: h,
      top, left, right: left + w, bottom: top + h,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

describe('CookieBannerDetector — AC-16 conformance', () => {
  patchLayout();

  for (const fx of FIXTURES) {
    test(`AC-16: detects ${fx.name}`, () => {
      const doc = load(fx.html);
      const result = detectCookieBanner(doc, VIEWPORT);
      expect(result, `${fx.name} returned null`).not.toBeNull();
      expect(result!.library).toBe(fx.library);
      expect(result!.selector).toBeTruthy();
      expect(result!.dismissibility.accept_selector).toBeTruthy();
      // Accept selector must resolve to an actual element in the doc.
      expect(doc.querySelector(result!.dismissibility.accept_selector!)).not.toBeNull();
    });
  }

  test('AC-16: returns null on banner-less page', () => {
    const doc = load('<div>Hello world</div>');
    expect(detectCookieBanner(doc, VIEWPORT)).toBeNull();
  });

  test('AC-16: precision ≥95% across 8-fixture suite (NF-06)', () => {
    let hits = 0;
    for (const fx of FIXTURES) {
      const r = detectCookieBanner(load(fx.html), VIEWPORT);
      if (r && r.library === fx.library) hits += 1;
    }
    expect(hits / FIXTURES.length).toBeGreaterThanOrEqual(0.95);
  });
});

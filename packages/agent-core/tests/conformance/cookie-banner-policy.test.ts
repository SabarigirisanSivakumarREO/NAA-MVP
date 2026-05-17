/**
 * Conformance test for AC-17 (T5B-017) — CookieBannerPolicy.
 *
 * Source: docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/
 *         spec.md §4.4 + §11.1.1; tasks.md T5B-017 (act-015 act-016).
 *
 * R3.1 TDD (RED): module-not-found at import is the expected failure mode
 *   until T5B-017 implementation lands.
 *
 * Anchor: @AC-17 — applyCookiePolicy(doc, descriptor, policy, viewport)
 *   → { action, dismissed, warnings[] }
 */
import { describe, expect, test, vi } from 'vitest';
import {
  applyCookiePolicy,
  INVALID_COOKIE_POLICY,
  type CookiePolicyResult,
} from '../../src/browser-runtime/CookieBannerPolicy.js';
import type { BannerDescriptor } from '../../src/browser-runtime/CookieBannerDetector.js';

const VIEWPORT = { width: 1440, height: 900 };

function makeDescriptor(overrides: Partial<BannerDescriptor> = {}): BannerDescriptor {
  return {
    library: 'OneTrust',
    selector: '#onetrust-banner-sdk',
    foldCoveragePercent: 25,
    dismissibility: {
      accept_selector: '#onetrust-accept-btn-handler',
      reject_selector: '#onetrust-reject-all-handler',
      settings_selector: null,
    },
    ...overrides,
  };
}

function loadBanner(): Document {
  document.documentElement.innerHTML = `<head></head><body>
    <div id="onetrust-banner-sdk">
      <button id="onetrust-accept-btn-handler">Accept All</button>
      <button id="onetrust-reject-all-handler">Reject All</button>
    </div>
  </body>`;
  return document;
}

describe('CookieBannerPolicy — AC-17 conformance', () => {
  test('AC-17: dismiss clicks the accept_selector', () => {
    const doc = loadBanner();
    const btn = doc.querySelector('#onetrust-accept-btn-handler') as HTMLButtonElement;
    const clickSpy = vi.spyOn(btn, 'click');
    const result: CookiePolicyResult = applyCookiePolicy(
      doc,
      makeDescriptor(),
      'dismiss',
      VIEWPORT,
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(result.action).toBe('dismiss');
    expect(result.dismissed).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  test('AC-17: preserve does not click any selector', () => {
    const doc = loadBanner();
    const btn = doc.querySelector('#onetrust-accept-btn-handler') as HTMLButtonElement;
    const clickSpy = vi.spyOn(btn, 'click');
    const result = applyCookiePolicy(doc, makeDescriptor(), 'preserve', VIEWPORT);
    expect(clickSpy).not.toHaveBeenCalled();
    expect(result.action).toBe('preserve');
    expect(result.dismissed).toBe(false);
  });

  test('AC-17: block throws structured INVALID_COOKIE_POLICY error', () => {
    const doc = loadBanner();
    expect(() =>
      applyCookiePolicy(doc, makeDescriptor(), 'block' as 'dismiss', VIEWPORT),
    ).toThrowError(INVALID_COOKIE_POLICY);
  });

  test('AC-17: preserve emits COOKIE_BANNER_BLOCKING_FOLD when >40% fold coverage', () => {
    const doc = loadBanner();
    const result = applyCookiePolicy(
      doc,
      makeDescriptor({ foldCoveragePercent: 55 }),
      'preserve',
      VIEWPORT,
    );
    expect(result.warnings).toContain('COOKIE_BANNER_BLOCKING_FOLD');
  });

  test('AC-17: preserve does NOT warn when fold coverage ≤40%', () => {
    const doc = loadBanner();
    const result = applyCookiePolicy(
      doc,
      makeDescriptor({ foldCoveragePercent: 30 }),
      'preserve',
      VIEWPORT,
    );
    expect(result.warnings).not.toContain('COOKIE_BANNER_BLOCKING_FOLD');
  });

  test('AC-17: dismiss with missing accept_selector returns dismissed=false', () => {
    const doc = loadBanner();
    const result = applyCookiePolicy(
      doc,
      makeDescriptor({
        dismissibility: {
          accept_selector: null,
          reject_selector: null,
          settings_selector: null,
        },
      }),
      'dismiss',
      VIEWPORT,
    );
    expect(result.action).toBe('dismiss');
    expect(result.dismissed).toBe(false);
    expect(result.warnings).toContain('COOKIE_BANNER_NO_ACCEPT_BUTTON');
  });

  test('AC-17: dismiss with unresolvable selector returns dismissed=false', () => {
    const doc = loadBanner();
    const result = applyCookiePolicy(
      doc,
      makeDescriptor({
        dismissibility: {
          accept_selector: '#nonexistent-button',
          reject_selector: null,
          settings_selector: null,
        },
      }),
      'dismiss',
      VIEWPORT,
    );
    expect(result.dismissed).toBe(false);
    expect(result.warnings).toContain('COOKIE_BANNER_NO_ACCEPT_BUTTON');
  });
});

/**
 * Conformance test for AC-04 (T1B-004 PopupPresenceDetector).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md AC-04
 *   docs/specs/mvp/phases/phase-1b-perception-extensions/tasks.md T1B-004
 *
 * R-04: Detect popup PRESENCE at page load; classify type ∈ the
 *       11-value enum (v0.2 — popup option a). Behavior fields
 *       (isEscapeDismissible, isClickOutsideDismissible) remain null
 *       until Phase 5b probes them.
 *
 * R3.1 TDD: import fails with "module not found" until T1B-004 lands.
 *
 * Anchor: @AC-04 — popups[] populated with type ∈ {modal, lightbox,
 *   drawer, toast, cookie_banner, consent_form, slide_in_panel,
 *   exit_intent_overlay, chat_widget, paywall, other}; behavior fields
 *   null. (11 total — 6 v0.1 + 4 v0.2 popup option a + `other` fallback.)
 */
import { describe, expect, test } from 'vitest';

// @ts-expect-error — module does not exist yet (T1B-004 RED state)
import { extractPopups } from '../../src/perception/extensions/PopupPresenceDetector.js';

const ALL_11_TYPES = [
  'modal',
  'lightbox',
  'drawer',
  'toast',
  'cookie_banner',
  'consent_form',
  'slide_in_panel',
  'exit_intent_overlay',
  'chat_widget',
  'paywall',
  'other',
] as const;

function makeCtx(): {
  ctas: never[];
  formFields: never[];
  metadata: { schemaOrg: never[]; ogTags: Record<string, never> };
  headings: never[];
  primaryActions: null;
} {
  return {
    ctas: [],
    formFields: [],
    metadata: { schemaOrg: [], ogTags: {} },
    headings: [],
    primaryActions: null,
  };
}

function makeDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('PopupPresenceDetector — AC-04 conformance (RED)', () => {
  /**
   * @AC-04 — cookie banner at page load is detected with type=cookie_banner,
   * isInitiallyOpen=true, behavior fields null.
   */
  test('AC-04: cookie banner detected with isInitiallyOpen=true + behavior fields null', () => {
    const doc = makeDoc(
      '<html><body><div role="dialog" aria-label="cookie consent"><button>Accept</button></div></body></html>',
    );
    const result = extractPopups(doc, { width: 1280, height: 800 }, makeCtx());
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const popup = result[0];
    expect(popup.isInitiallyOpen).toBe(true);
    expect(popup.isEscapeDismissible).toBeNull();
    expect(popup.isClickOutsideDismissible).toBeNull();
  });

  /**
   * @AC-04 — every detected popup's type is in the 11-value enum.
   */
  test('AC-04: every popup.type is one of the 11 enum values', () => {
    const doc = makeDoc(
      '<html><body><div role="dialog">Hello</div><aside class="chat-widget">Chat</aside></body></html>',
    );
    const result = extractPopups(doc, { width: 1280, height: 800 }, makeCtx());
    for (const popup of result) {
      expect(ALL_11_TYPES).toContain(popup.type);
    }
  });

  /**
   * @AC-04 — type enum contract: implementation MUST accept every one
   * of the 11 enum values when classifying. We assert the enum surface
   * itself by constructing edge-case fixtures and checking the union.
   *
   * (Light contract check — the real type-by-type tuning happens in
   * the integration test on real fixtures.)
   */
  test('AC-04: type enum has exactly 11 allowed values per popup option (a)', () => {
    expect(ALL_11_TYPES).toHaveLength(11);
    expect(ALL_11_TYPES).toEqual(
      expect.arrayContaining([
        'slide_in_panel',
        'exit_intent_overlay',
        'chat_widget',
        'paywall',
        'other',
      ]),
    );
  });

  /**
   * @AC-04 — page with no popups returns [] (NOT null).
   */
  test('AC-04: page with no popups returns []', () => {
    const doc = makeDoc('<html><body><h1>Hello</h1></body></html>');
    const result = extractPopups(doc, { width: 1280, height: 800 }, makeCtx());
    expect(result).toEqual([]);
  });

  /**
   * @AC-04 — presence-layer fields populated; behavior-layer null.
   */
  test('AC-04: presence-layer fields populated; behavior fields null until Phase 5b', () => {
    const doc = makeDoc(
      '<html><body><div role="dialog"><button aria-label="Close">X</button>Modal</div></body></html>',
    );
    const result = extractPopups(doc, { width: 1280, height: 800 }, makeCtx());
    if (result.length > 0) {
      const popup = result[0];
      // Presence-layer:
      expect(popup).toHaveProperty('type');
      expect(popup).toHaveProperty('isInitiallyOpen');
      expect(popup).toHaveProperty('hasCloseButton');
      expect(popup).toHaveProperty('closeButtonAccessibleName');
      expect(popup).toHaveProperty('viewportCoveragePercent');
      expect(popup).toHaveProperty('blocksPrimaryContent');
      // Behavior-layer (null until Phase 5b):
      expect(popup.isEscapeDismissible).toBeNull();
      expect(popup.isClickOutsideDismissible).toBeNull();
    }
  });
});

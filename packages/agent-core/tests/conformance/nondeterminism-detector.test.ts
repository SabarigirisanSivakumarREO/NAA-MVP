/**
 * AC-08 — NondeterminismDetector conformance (REQ-ANALYZE-PERCEPTION-V25-001).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md AC-08 + R-08
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/tasks.md T1C-008
 *
 * R-08 (v0.2): Closed 9-value NondeterminismFlag enum
 *   {optimizely_active, vwo_active, google_optimize_active, adobe_target_active,
 *    personalization_cookies_detected, session_replay_active, ad_auction_detected,
 *    privacy_sandbox_active, countdown_timer_detected}.
 *
 * Probe strategy per category:
 *   - script-presence: window.optimizely / window.VWO / window._gaq / window.adobe.target
 *   - DOM-injection-hook: Hotjar / FullStory / Mouseflow script-tag patterns
 *   - JS-API-presence: navigator.runAdAuction / browsingTopics
 *   - cookie-pattern: personalization_cookies catch-all
 *   - runtime-probe: visible countdown + "ends in" / "expires" text
 *
 * Server-side / CDN-edge personalization is OUT-OF-SCOPE (not client-detectable).
 *
 * R3.1 TDD (Wave 0 RED): import fails with "module not found" until
 *   T1C-008 lands.
 *
 * Anchor: @AC-08 — detectNondeterminism(window, document) →
 *   NondeterminismFlag[].
 */
import { describe, expect, it } from 'vitest';

// @ts-expect-error - module not implemented yet (Wave 0 RED for T1C-008)
import {
  detectNondeterminism,
  NONDETERMINISM_FLAG_ENUM,
} from '../../src/perception/NondeterminismDetector.js';

type NondeterminismFlag =
  | 'optimizely_active'
  | 'vwo_active'
  | 'google_optimize_active'
  | 'adobe_target_active'
  | 'personalization_cookies_detected'
  | 'session_replay_active'
  | 'ad_auction_detected'
  | 'privacy_sandbox_active'
  | 'countdown_timer_detected';

const EXPECTED_FLAGS: NondeterminismFlag[] = [
  'optimizely_active',
  'vwo_active',
  'google_optimize_active',
  'adobe_target_active',
  'personalization_cookies_detected',
  'session_replay_active',
  'ad_auction_detected',
  'privacy_sandbox_active',
  'countdown_timer_detected',
];

describe('NondeterminismDetector — AC-08 conformance (Wave 0 RED)', () => {
  /**
   * @AC-08 — Closed 9-value enum pinned exactly. v0.1 was 6; v0.2 added
   * session_replay_active + privacy_sandbox_active + countdown_timer_detected.
   */
  it('AC-08: NONDETERMINISM_FLAG_ENUM is the closed 9-value set', () => {
    expect(Array.isArray(NONDETERMINISM_FLAG_ENUM)).toBe(true);
    expect([...NONDETERMINISM_FLAG_ENUM].sort()).toEqual([...EXPECTED_FLAGS].sort());
    expect(NONDETERMINISM_FLAG_ENUM).toHaveLength(9);
  });

  /**
   * @AC-08 — window.optimizely script presence → optimizely_active flag
   * (User Story 2 scenario 1).
   */
  it('AC-08: window.optimizely present → optimizely_active flag emitted', () => {
    const fakeWin = { optimizely: { state: {} } } as unknown as Window;
    const flags: NondeterminismFlag[] = detectNondeterminism(fakeWin, document);
    expect(flags).toContain('optimizely_active');
  });

  /**
   * @AC-08 — clean page → no flags.
   */
  it('AC-08: clean window/document → no flags emitted', () => {
    const fakeWin = {} as unknown as Window;
    const flags: NondeterminismFlag[] = detectNondeterminism(fakeWin, document);
    expect(flags).toEqual([]);
  });

  /**
   * @AC-08 — VWO + adobe.target script presence detected.
   */
  it('AC-08: window.VWO present → vwo_active', () => {
    const fakeWin = { VWO: { v: '2' } } as unknown as Window;
    const flags: NondeterminismFlag[] = detectNondeterminism(fakeWin, document);
    expect(flags).toContain('vwo_active');
  });

  it('AC-08: window.adobe.target present → adobe_target_active', () => {
    const fakeWin = { adobe: { target: { getOffer: () => {} } } } as unknown as Window;
    const flags: NondeterminismFlag[] = detectNondeterminism(fakeWin, document);
    expect(flags).toContain('adobe_target_active');
  });

  /**
   * @AC-08 — flags are members of the closed enum (no string drift).
   */
  it('AC-08: every emitted flag is a member of the closed 9-value enum', () => {
    const fakeWin = { optimizely: {}, VWO: {} } as unknown as Window;
    const flags: NondeterminismFlag[] = detectNondeterminism(fakeWin, document);
    for (const f of flags) {
      expect(EXPECTED_FLAGS).toContain(f);
    }
  });
});

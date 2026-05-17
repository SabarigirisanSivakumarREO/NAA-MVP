/**
 * Conformance test for AC-07 / T5B-007 DarkPatternDetector.
 *
 * Spec: docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/{spec.md AC-07, tasks.md T5B-007}.
 *
 * 5 flags (R-06 v0.2):
 *   - weighted_default (highest priority)
 *   - forced_action
 *   - deceptive_close
 *   - hidden_dismiss
 *   - no_close_button (lowest priority)
 *
 * Single dark_pattern_flag per popup — highest-priority flag wins.
 */
import { describe, it, expect } from 'vitest';

import { detectDarkPatterns, type PopupCandidate } from '../../src/analysis/DarkPatternDetector.js';

function candidate(o: Partial<PopupCandidate>): PopupCandidate {
  return {
    selector: '#p',
    hasCloseButton: true,
    closeButtonAccessibleName: 'Close',
    closeButtonAreaPx2: 1024,
    closeButtonOpacity: 1,
    blocksPrimaryContent: false,
    innerHtml: '',
    isInitiallyOpen: true,
    ...o,
  };
}

describe('DarkPatternDetector — AC-07 conformance', () => {
  it('flags no_close_button when popup has no close button', () => {
    const flag = detectDarkPatterns(candidate({ hasCloseButton: false, closeButtonAccessibleName: null }));
    expect(flag).toBe('no_close_button');
  });

  it('flags hidden_dismiss when close button has no accessible name', () => {
    const flag = detectDarkPatterns(candidate({ hasCloseButton: true, closeButtonAccessibleName: null }));
    expect(flag).toBe('hidden_dismiss');
  });

  it('flags deceptive_close when close-button area < 22^2 px or opacity < 0.3', () => {
    const small = detectDarkPatterns(candidate({ closeButtonAreaPx2: 100, closeButtonOpacity: 1 }));
    expect(small).toBe('deceptive_close');
    const transparent = detectDarkPatterns(candidate({ closeButtonAreaPx2: 1024, closeButtonOpacity: 0.1 }));
    expect(transparent).toBe('deceptive_close');
  });

  it('flags forced_action when popup blocks primary content + no dismiss path', () => {
    const flag = detectDarkPatterns(candidate({
      hasCloseButton: false,
      closeButtonAccessibleName: null,
      blocksPrimaryContent: true,
    }));
    // forced_action > no_close_button per priority
    expect(flag).toBe('forced_action');
  });

  it('flags weighted_default when popup contains pre-checked consent checkbox', () => {
    const html = '<input type="checkbox" checked><label>Accept all cookies</label>';
    const flag = detectDarkPatterns(candidate({ innerHtml: html }));
    expect(flag).toBe('weighted_default');
  });

  it('flags weighted_default with checked radio + tracking label', () => {
    const html = '<input type="radio" checked /><label>Allow tracking</label>';
    const flag = detectDarkPatterns(candidate({ innerHtml: html }));
    expect(flag).toBe('weighted_default');
  });

  it('priority: weighted_default beats forced_action', () => {
    const html = '<input type="checkbox" checked><label>Consent</label>';
    const flag = detectDarkPatterns(candidate({
      innerHtml: html,
      hasCloseButton: false,
      blocksPrimaryContent: true,
    }));
    expect(flag).toBe('weighted_default');
  });

  it('returns null when no dark patterns present', () => {
    const flag = detectDarkPatterns(candidate({}));
    expect(flag).toBeNull();
  });

  it('weighted_default ignores unchecked inputs', () => {
    const html = '<input type="checkbox"><label>Accept</label>';
    const flag = detectDarkPatterns(candidate({ innerHtml: html }));
    expect(flag).toBeNull();
  });

  it('weighted_default ignores checked input WITHOUT consent-related label', () => {
    const html = '<input type="checkbox" checked><label>Subscribe to newsletter</label>';
    const flag = detectDarkPatterns(candidate({ innerHtml: html }));
    expect(flag).toBeNull();
  });
});

/**
 * Conformance test for AC-05 / T5B-005 PopupBehaviorProbe.
 *
 * Spec: docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/{spec.md AC-05, tasks.md T5B-005}.
 *
 * The probe watches a popup's trigger condition and writes back:
 *   - triggerType: 'load' | 'time' | 'scroll' | 'exit_intent'
 *   - timingMs:   number (ms after page nav until popup became visible)
 *
 * Both fields are namespaced under `popups[i]._probe` to avoid colliding with
 * the canonical PopupSchema (which is .strict()). Phase 5b mutates the live
 * popups[] reference in place — see plan §2.5.
 *
 * R3 TDD: written BEFORE PopupBehaviorProbe.ts exists.
 */
import { describe, it, expect } from 'vitest';

import {
  probePopupBehavior,
  type PopupProbeRecord,
  type ProbablePopup,
} from '../../src/browser-runtime/PopupBehaviorProbe.js';

function makePopup(overrides: Partial<ProbablePopup> = {}): ProbablePopup {
  return {
    type: 'modal',
    selector: '#popup',
    isInitiallyOpen: false,
    isEscapeDismissible: null,
    isClickOutsideDismissible: null,
    ...overrides,
  };
}

describe('PopupBehaviorProbe — AC-05 conformance', () => {
  it('records load trigger when popup is initially open (timingMs ~0)', async () => {
    const popups: ProbablePopup[] = [makePopup({ isInitiallyOpen: true })];
    await probePopupBehavior({
      popups,
      navigatedAt: 1000,
      observations: [
        { selector: '#popup', firstVisibleAt: 1000, triggerHint: null },
      ],
    });
    const probe = (popups[0] as ProbablePopup & { _probe?: PopupProbeRecord })._probe!;
    expect(probe).toBeDefined();
    expect(probe.triggerType).toBe('load');
    expect(probe.timingMs).toBe(0);
  });

  it('records time trigger when popup appears > 500ms after nav with no scroll/exit hint', async () => {
    const popups: ProbablePopup[] = [makePopup()];
    await probePopupBehavior({
      popups,
      navigatedAt: 1000,
      observations: [
        { selector: '#popup', firstVisibleAt: 4000, triggerHint: null },
      ],
    });
    const probe = (popups[0] as ProbablePopup & { _probe?: PopupProbeRecord })._probe!;
    expect(probe.triggerType).toBe('time');
    expect(probe.timingMs).toBe(3000);
  });

  it('records scroll trigger when observation triggerHint=scroll', async () => {
    const popups: ProbablePopup[] = [makePopup()];
    await probePopupBehavior({
      popups,
      navigatedAt: 1000,
      observations: [
        { selector: '#popup', firstVisibleAt: 1500, triggerHint: 'scroll' },
      ],
    });
    const probe = (popups[0] as ProbablePopup & { _probe?: PopupProbeRecord })._probe!;
    expect(probe.triggerType).toBe('scroll');
    expect(probe.timingMs).toBe(500);
  });

  it('records exit_intent trigger when observation triggerHint=exit_intent', async () => {
    const popups: ProbablePopup[] = [makePopup({ type: 'exit_intent_overlay' })];
    await probePopupBehavior({
      popups,
      navigatedAt: 1000,
      observations: [
        { selector: '#popup', firstVisibleAt: 8000, triggerHint: 'exit_intent' },
      ],
    });
    const probe = (popups[0] as ProbablePopup & { _probe?: PopupProbeRecord })._probe!;
    expect(probe.triggerType).toBe('exit_intent');
    expect(probe.timingMs).toBe(7000);
  });

  it('mutates popups[] in place across multiple popups', async () => {
    const popups: ProbablePopup[] = [
      makePopup({ selector: '#a', isInitiallyOpen: true }),
      makePopup({ selector: '#b' }),
    ];
    await probePopupBehavior({
      popups,
      navigatedAt: 0,
      observations: [
        { selector: '#a', firstVisibleAt: 0, triggerHint: null },
        { selector: '#b', firstVisibleAt: 6000, triggerHint: 'scroll' },
      ],
    });
    expect((popups[0] as ProbablePopup & { _probe?: PopupProbeRecord })._probe?.triggerType).toBe('load');
    expect((popups[1] as ProbablePopup & { _probe?: PopupProbeRecord })._probe?.triggerType).toBe('scroll');
  });

  it('leaves _probe undefined for popups with no observation match', async () => {
    const popups: ProbablePopup[] = [makePopup({ selector: '#orphan' })];
    await probePopupBehavior({
      popups,
      navigatedAt: 0,
      observations: [],
    });
    expect((popups[0] as ProbablePopup & { _probe?: PopupProbeRecord })._probe).toBeUndefined();
  });
});

/**
 * PopupBehaviorProbe — Phase 5b T5B-005.
 *
 * Watches popup trigger conditions on test fixtures and writes triggerType +
 * timingMs back to Phase 1b's popups[] array (mutates in place — see plan
 * §2.5 + tasks.md T5B-005 acceptance). The canonical Popup Zod schema is
 * .strict() so we attach the probe record under a `_probe` namespace; this
 * non-breaking approach (R20 widening at T5B-PRE-001 made behavior fields
 * boolean|null; trigger metadata is additive on top).
 *
 * Trigger classification rules (plan §2.5):
 *   - load        : popup.isInitiallyOpen === true OR firstVisibleAt === navigatedAt
 *   - exit_intent : observation.triggerHint === 'exit_intent'
 *   - scroll      : observation.triggerHint === 'scroll'
 *   - time        : default (popup appeared post-nav with no scroll/exit hint)
 *
 * Production wiring (Phase 7 / browser-runtime integration): a MutationObserver
 * + scroll/mouseleave listener subroutine in the browser context emits one
 * `PopupObservation` per detected popup, then this function reconciles to the
 * Phase 1b popups[] presence layer. Tests inject observations directly.
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/spec.md AC-05 + R-04
 *   docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/tasks.md T5B-005
 *   docs/specs/final-architecture/07-analyze-mode.md §7.9.2 popup behavior fields
 *
 * Constitution compliance:
 *   R10.1 file ≤ 300 LOC. R10.2 named exports. R2 no `any`. R24 captures
 *   factual trigger metadata; severity / dark-pattern judgement is T5B-007.
 *
 * Anchor: @T5B-005 — PopupBehaviorProbe.
 */
import { z } from 'zod';

/**
 * Probable popup shape — subset of canonical PopupSchema this probe needs.
 * We avoid importing the full strict Zod type to keep this module decoupled
 * from PageStateModel internals (R10.4 contract surface).
 */
export interface ProbablePopup {
  type: string;
  selector: string;
  isInitiallyOpen: boolean;
  isEscapeDismissible: boolean | null;
  isClickOutsideDismissible: boolean | null;
}

export const PopupTriggerTypeSchema = z.enum([
  'load',
  'time',
  'scroll',
  'exit_intent',
]);

export type PopupTriggerType = z.infer<typeof PopupTriggerTypeSchema>;

export const PopupProbeRecordSchema = z
  .object({
    triggerType: PopupTriggerTypeSchema,
    timingMs: z.number().int().min(0),
  })
  .strict();

export type PopupProbeRecord = z.infer<typeof PopupProbeRecordSchema>;

/**
 * One observation per detected popup, captured by a browser-context listener
 * subroutine (production) or fixture (tests).
 */
export interface PopupObservation {
  readonly selector: string;
  /** Wall-clock ms timestamp (same epoch as navigatedAt) the popup became visible. */
  readonly firstVisibleAt: number;
  /** Trigger hint from the browser-context listener; null = no scroll/exit signal. */
  readonly triggerHint: 'scroll' | 'exit_intent' | null;
}

export interface ProbeInput {
  readonly popups: ProbablePopup[];
  /** Wall-clock ms timestamp of page navigation start. */
  readonly navigatedAt: number;
  readonly observations: readonly PopupObservation[];
}

/**
 * Classify a single observation against the navigation baseline.
 * Pure function, easy to unit-test in isolation if needed.
 */
function classify(
  observation: PopupObservation,
  navigatedAt: number,
  isInitiallyOpen: boolean,
): PopupProbeRecord {
  const timingMs = Math.max(0, observation.firstVisibleAt - navigatedAt);

  if (isInitiallyOpen || timingMs === 0) {
    return { triggerType: 'load', timingMs };
  }
  if (observation.triggerHint === 'exit_intent') {
    return { triggerType: 'exit_intent', timingMs };
  }
  if (observation.triggerHint === 'scroll') {
    return { triggerType: 'scroll', timingMs };
  }
  return { triggerType: 'time', timingMs };
}

/**
 * Mutate popups[] in place: attach `_probe` record where an observation
 * matches by selector. Popups without a matching observation are left
 * untouched (no _probe attached) — production caller decides whether absence
 * implies the popup never opened or the listener missed it.
 */
export async function probePopupBehavior(input: ProbeInput): Promise<void> {
  const obsBySelector = new Map<string, PopupObservation>();
  for (const obs of input.observations) {
    obsBySelector.set(obs.selector, obs);
  }

  for (const popup of input.popups) {
    const obs = obsBySelector.get(popup.selector);
    if (!obs) continue;
    const probe = classify(obs, input.navigatedAt, popup.isInitiallyOpen);
    (popup as ProbablePopup & { _probe: PopupProbeRecord })._probe = probe;
  }
}

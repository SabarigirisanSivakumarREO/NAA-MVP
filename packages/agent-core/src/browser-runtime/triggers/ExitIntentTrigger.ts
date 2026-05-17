/**
 * ExitIntentTrigger — T5B-013 Phase 5b trigger taxonomy.
 *
 * Source: phase-5b spec.md §20 + AC-13 + R-11
 *   (REQ-STATE-EXPL-TRIGGER-005). Detect `mouseleave` listeners on
 *   document/window/body via in-page evaluation; if present, simulate
 *   mouse motion to (x, -1) — the canonical exit-intent gesture. Caller
 *   (PopupBehaviorProbe / state-graph) wires the observed popup back to
 *   `popups[i].triggerType: "exit_intent"`.
 *
 * Mobile policy: no native exit-intent on touch → no-op silently when
 *   viewport.device_type === 'mobile' (AC-13 + R-11).
 *
 * Anchor: @T5B-013 — ExitIntentTrigger.
 */
import type { DeviceType } from '../../orchestration/ViewportConfigService.js';
import { createLogger } from '../../observability/logger.js';

export interface ExitIntentMouse {
  move(x: number, y: number, opts?: { steps?: number }): Promise<void>;
}

export interface ExitIntentPage {
  url(): string;
  evaluate(fn: string | ((...a: unknown[]) => unknown), ...args: unknown[]): Promise<unknown>;
  mouse: ExitIntentMouse;
}

export interface ExitIntentInput {
  readonly viewport: { readonly device_type: DeviceType };
}

export interface ExitIntentOutput {
  readonly fired: boolean;
  readonly trigger_type: 'exit_intent';
  readonly skipped_reason?: 'mobile_viewport' | 'no_mouseleave_listener' | 'simulate_failed';
}

/**
 * In-page detector: walks all <script> text for a literal `mouseleave`
 * reference. False positives possible (e.g. a comment containing the word)
 * but acceptable per R-11 spec — exit-intent is a runtime SIGNAL not a
 * proof. The downstream PopupBehaviorProbe confirms the popup actually
 * fires within the dwell window.
 */
const DETECT_FN_SRC = `() => {
  const scripts = Array.from(document.querySelectorAll('script'));
  for (const s of scripts) {
    if (s.textContent && s.textContent.indexOf('mouseleave') !== -1) return true;
  }
  return false;
}`;

const VIEWPORT_WIDTH_FN_SRC = `() => (window.innerWidth || 1024)`;

export class ExitIntentTrigger {
  private readonly log = createLogger('exit-intent-trigger');

  async fire(page: ExitIntentPage, input: ExitIntentInput): Promise<ExitIntentOutput> {
    if (input.viewport.device_type === 'mobile') {
      this.log.debug({ event: 'exit.skip', trigger_type: 'exit_intent' }, 'exit-intent no-op on mobile');
      return { fired: false, trigger_type: 'exit_intent', skipped_reason: 'mobile_viewport' };
    }
    const has = await page.evaluate(DETECT_FN_SRC);
    if (has !== true) {
      return { fired: false, trigger_type: 'exit_intent', skipped_reason: 'no_mouseleave_listener' };
    }
    try {
      const widthRaw = await page.evaluate(VIEWPORT_WIDTH_FN_SRC);
      const width = typeof widthRaw === 'number' && widthRaw > 0 ? widthRaw : 1024;
      const midX = Math.floor(width / 2);
      // Step 1: start mid-page so the leave motion is realistic.
      await page.mouse.move(midX, 200);
      // Step 2: shoot to y = -1 — canonical exit-intent signal.
      await page.mouse.move(midX, -1);
      return { fired: true, trigger_type: 'exit_intent' };
    } catch {
      return { fired: false, trigger_type: 'exit_intent', skipped_reason: 'simulate_failed' };
    }
  }
}

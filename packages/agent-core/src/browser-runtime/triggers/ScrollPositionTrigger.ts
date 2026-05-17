/**
 * ScrollPositionTrigger — T5B-011 Phase 5b trigger taxonomy.
 *
 * Source: phase-5b spec.md §20 + AC-11 (REQ-STATE-EXPL-TRIGGER-003).
 *   Detect IntersectionObserver / sticky patterns; scroll the page to a
 *   target Y so sticky CTA changes + IntersectionObserver lazy-load reveals
 *   are captured downstream.
 *
 * R26: read-only scroll; no destructive ops; works on either viewport.
 *
 * Anchor: @T5B-011 — ScrollPositionTrigger.
 */
import type { DeviceType } from '../../orchestration/ViewportConfigService.js';
import { createLogger } from '../../observability/logger.js';

export interface ScrollPage {
  url(): string;
  evaluate(fn: string | ((...a: unknown[]) => unknown), ...args: unknown[]): Promise<unknown>;
  waitForTimeout?(ms: number): Promise<void>;
}

export interface ScrollCandidate {
  readonly element_id: string;
  readonly target_y: number;
  readonly viewport: { readonly device_type: DeviceType };
}

export interface ScrollTriggerOutput {
  readonly fired: boolean;
  readonly settled_y: number;
  readonly elapsed_ms: number;
}

const SETTLE_MS = 400;

export class ScrollPositionTrigger {
  private readonly log = createLogger('scroll-position-trigger');

  async fire(page: ScrollPage, c: ScrollCandidate): Promise<ScrollTriggerOutput> {
    const start = Date.now();
    const y = Math.max(0, Math.floor(c.target_y));
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- string arg crosses the page boundary
    await page.evaluate('(y) => window.scrollTo({ top: y, behavior: "instant" })', y);
    if (page.waitForTimeout) await page.waitForTimeout(SETTLE_MS);
    this.log.debug(
      { event: 'scroll.fire', element_id: c.element_id, trigger_type: 'scroll', y },
      'scroll trigger fired',
    );
    return { fired: true, settled_y: y, elapsed_ms: Date.now() - start };
  }
}

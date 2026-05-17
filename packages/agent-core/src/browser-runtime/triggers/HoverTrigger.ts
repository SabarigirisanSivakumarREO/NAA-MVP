/**
 * HoverTrigger — T5B-010 Phase 5b trigger taxonomy.
 *
 * Source: docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/
 *   spec.md §20 + AC-10 (REQ-STATE-EXPL-TRIGGER-002).
 *
 * Behavior: detect `:hover` rules + `aria-haspopup`, fire mouseenter event +
 *   dwell, capture tooltips / dropdown previews. Settle within 1s.
 *
 * R3.1 TDD pair: tests/conformance/hover-trigger.test.ts.
 * R10: file ≤300 LOC. R26: no destructive actions; no cross-origin.
 *
 * Mobile policy: hover has no native equivalent on touch viewports → no-op
 *   silently when viewport.device_type === 'mobile' (AC-10 + R-10 spec).
 *
 * Anchor: @T5B-010 — HoverTrigger.
 */
import type { DeviceType } from '../../orchestration/ViewportConfigService.js';
import { createLogger } from '../../observability/logger.js';

export interface HoverPage {
  url(): string;
  hover(selector: string, opts?: { timeout?: number }): Promise<void>;
  waitForLoadState?(state: 'load' | 'domcontentloaded' | 'networkidle', opts?: { timeout?: number }): Promise<void>;
  evaluate?(fn: string | ((...a: unknown[]) => unknown), ...args: unknown[]): Promise<unknown>;
}

export interface HoverCandidate {
  readonly element_id: string;
  readonly selector: string;
  readonly viewport: { readonly device_type: DeviceType };
}

export interface HoverTriggerOutput {
  readonly fired: boolean;
  readonly elapsed_ms: number;
  readonly skipped_reason?: 'mobile_viewport' | 'hover_failed';
}

export class HoverTrigger {
  /** Settle cap per AC-10 (1s). */
  readonly settleTimeoutMs = 1000;
  private readonly log = createLogger('hover-trigger');

  async fire(page: HoverPage, c: HoverCandidate): Promise<HoverTriggerOutput> {
    const start = Date.now();
    if (c.viewport.device_type === 'mobile') {
      this.log.debug(
        { event: 'hover.skip', element_id: c.element_id, trigger_type: 'hover' },
        'hover no-op on mobile viewport',
      );
      return { fired: false, elapsed_ms: Date.now() - start, skipped_reason: 'mobile_viewport' };
    }
    try {
      await page.hover(c.selector, { timeout: this.settleTimeoutMs });
      if (page.waitForLoadState) {
        await page.waitForLoadState('networkidle', { timeout: this.settleTimeoutMs }).catch(() => undefined);
      }
      return { fired: true, elapsed_ms: Date.now() - start };
    } catch {
      return { fired: false, elapsed_ms: Date.now() - start, skipped_reason: 'hover_failed' };
    }
  }
}

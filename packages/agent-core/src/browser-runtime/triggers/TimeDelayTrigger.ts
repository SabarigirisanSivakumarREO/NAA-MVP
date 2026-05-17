/**
 * TimeDelayTrigger — T5B-012 Phase 5b trigger taxonomy.
 *
 * Source: phase-5b spec.md §20 + AC-12 (REQ-STATE-EXPL-TRIGGER-004).
 *   Run page N seconds (default 5s, max 10s). Diff body innerHTML
 *   before/after. New nodes are evidence of time-triggered banners /
 *   announcements.
 *
 * R26: read-only dwell + DOM read; no destructive ops.
 *
 * Anchor: @T5B-012 — TimeDelayTrigger.
 */
import { createLogger } from '../../observability/logger.js';

export const DEFAULT_DWELL_MS = 5000;
export const MAX_DWELL_MS = 10000;

export interface TimePage {
  url(): string;
  waitForTimeout(ms: number): Promise<void>;
  evaluate(fn: string | ((...a: unknown[]) => unknown), ...args: unknown[]): Promise<unknown>;
}

export interface TimeDelayInput {
  readonly dwell_ms?: number;
}

export interface TimeDelayOutput {
  readonly fired: boolean;
  readonly dwell_ms: number;
  readonly dom_changed: boolean;
  readonly before_hash: string;
  readonly after_hash: string;
}

export class TimeDelayTrigger {
  private readonly log = createLogger('time-delay-trigger');

  async fire(page: TimePage, input: TimeDelayInput): Promise<TimeDelayOutput> {
    const dwellRaw = input.dwell_ms ?? DEFAULT_DWELL_MS;
    const dwell_ms = Math.max(0, Math.min(MAX_DWELL_MS, dwellRaw));
    const before = await this.snapshot(page);
    await page.waitForTimeout(dwell_ms);
    const after = await this.snapshot(page);
    const dom_changed = before !== after;
    this.log.debug(
      { event: 'time.fire', trigger_type: 'time', dwell_ms, dom_changed },
      'time-delay trigger fired',
    );
    return {
      fired: true,
      dwell_ms,
      dom_changed,
      before_hash: hash(before),
      after_hash: hash(after),
    };
  }

  private async snapshot(page: TimePage): Promise<string> {
    const v = await page.evaluate('() => document.body ? document.body.innerHTML : ""');
    return typeof v === 'string' ? v : '';
  }
}

/** Cheap non-crypto hash. Only used as a stable shorthand for the snapshot. */
function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return `h${(h >>> 0).toString(16)}_${s.length}`;
}

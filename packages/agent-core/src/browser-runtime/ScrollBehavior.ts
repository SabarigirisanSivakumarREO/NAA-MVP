/**
 * ScrollBehavior — Phase 2 T018 variable-momentum scroll module.
 *
 * Source: docs/specs/mvp/phases/phase-2-tools/spec.md AC-03 + R-03;
 *         docs/specs/mvp/phases/phase-2-tools/tasks.md T018.
 *
 * Emits a series of `page.mouse.wheel` deltas along an ease-out cubic
 * curve so the resulting motion looks like real-user momentum scrolling
 * (big initial flick decaying to zero) rather than a single
 * `window.scrollBy(...)` jump. The cadenced deltas reliably tick
 * `IntersectionObserver` callbacks for off-screen lazy-load images
 * inside one scroll cycle (AC-03 fixture contract). Consumed by
 * `browser_scroll` (T030).
 *
 * Design:
 *   - NO new external deps. Pure JS easing math; falls back to
 *     `window.scrollBy` via `page.evaluate` when `mouse.wheel` is
 *     unavailable on the supplied page surface.
 *   - Structural `ScrollPage` interface — Playwright `Page` satisfies
 *     it; mirrors the MouseBehavior / TypingBehavior adapter pattern
 *     (Phase 2 R9 adapter discipline).
 *   - Default opts: 1000 px scroll yields ~16 wheel events at 16 ms /
 *     frame, satisfying AC-03 "at least 8 wheel events for 1000 px".
 *
 * R10.1: file < 200 LOC. R10.6: Pino logger. R13: no bare `any`.
 */
import { randomUUID } from 'node:crypto';
import { createLogger, createChildLogger, type Logger } from '../observability/logger.js';

/**
 * Minimal page surface ScrollBehavior consumes. Playwright `Page`
 * satisfies this structurally. Kept narrow on purpose (R9 adapter).
 */
export interface ScrollPage {
  url(): string;
  mouse: {
    wheel(deltaX: number, deltaY: number): Promise<void>;
  };
  evaluate<T>(fn: (arg: T) => void, arg: T): Promise<void>;
}

export type ScrollDirection = 'down' | 'up';

export interface ScrollOpts {
  /** Multiplier on default per-frame delta (1.0 = normal). Default 1.0. */
  velocityFactor?: number;
  /** Inter-frame delay in ms (animation cadence). Default 16 (~60 fps). */
  frameMs?: number;
  /** Upper bound on total |distancePx| accepted (safety). Default 5000. */
  maxScrollPx?: number;
  /** Pino correlation field — exact v3.1 tool name (e.g. `browser_scroll`). */
  tool_name?: string;
  /** Pino correlation field — per-invocation uuid/short-id. */
  tool_call_id?: string;
  /** Pino correlation field — calling MCP client session id. */
  client_session_id?: string;
}

const DEFAULTS = Object.freeze({
  velocityFactor: 1.0,
  frameMs: 16,
  maxScrollPx: 5000,
});

/**
 * Compute eased per-frame deltas summing (approximately) to `distance`.
 *
 * Ease-out cubic: f(t) = 1 - (1 - t)^3, t in [0, 1].
 * Per-frame delta = (f(t_i) - f(t_{i-1})) * distance, which produces a
 * big-flick → tapering profile (variable momentum, not linear).
 *
 * Frame count scales with distance so a 1000 px scroll always emits
 * >= 8 wheel events (AC-03 contract). Frames are clamped >= 10 and
 * <= 30 so very short / very long scrolls remain well-behaved.
 */
export function computeEasedDeltas(distance: number): number[] {
  const abs = Math.abs(distance);
  const sign = distance < 0 ? -1 : 1;
  // ~1 frame per 60 px scroll, clamped to [10, 30]. For 1000 px → ~16 frames.
  const frames = Math.min(30, Math.max(10, Math.round(abs / 60)));
  const deltas: number[] = [];
  let prev = 0;
  for (let i = 1; i <= frames; i++) {
    const t = i / frames;
    const eased = 1 - (1 - t) ** 3;
    const next = eased * abs;
    deltas.push(sign * (next - prev));
    prev = next;
  }
  return deltas;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class ScrollBehaviorImpl {
  private readonly root: Logger = createLogger('scroll-behavior');

  async scroll(
    page: ScrollPage,
    direction: ScrollDirection,
    distancePx: number,
    opts: ScrollOpts = {},
  ): Promise<void> {
    if (!Number.isFinite(distancePx) || distancePx < 0) {
      throw new Error(`ScrollBehavior.scroll: distancePx must be a non-negative finite number, got ${distancePx}`);
    }
    const maxPx = opts.maxScrollPx ?? DEFAULTS.maxScrollPx;
    const clamped = Math.min(distancePx, maxPx);
    const velocityFactor = opts.velocityFactor ?? DEFAULTS.velocityFactor;
    const frameMs = opts.frameMs ?? DEFAULTS.frameMs;

    const tool_call_id = opts.tool_call_id ?? randomUUID();
    const log: Logger = createChildLogger(this.root, {
      page_url: page.url(),
      tool_call_id,
      ...(opts.tool_name !== undefined ? { tool_name: opts.tool_name } : {}),
      ...(opts.client_session_id !== undefined
        ? { client_session_id: opts.client_session_id }
        : {}),
    });

    const sign = direction === 'down' ? 1 : -1;
    const signedDistance = sign * clamped * velocityFactor;
    const deltas = computeEasedDeltas(signedDistance);
    const start = Date.now();

    let usedFallback = false;
    for (const dy of deltas) {
      try {
        await page.mouse.wheel(0, dy);
      } catch {
        // Fallback: some Playwright contexts (CDP-less, certain mobile
        // emulators) reject mouse.wheel — emit window.scrollBy instead.
        // Still multi-step, still respects the eased profile.
        usedFallback = true;
        await page.evaluate<number>((d) => {
          // Browser context — `window` exists at runtime. Access via the
          // ambient global without a DOM-lib reference so Node-typecheck
          // stays clean (we don't pull `lib: ["dom"]` into agent-core).
          const w = globalThis as { scrollBy?: (x: number, y: number) => void };
          w.scrollBy?.(0, d);
        }, dy);
      }
      await sleep(frameMs);
    }

    log.info(
      {
        event: 'scroll.completed',
        direction,
        distancePx: clamped,
        requestedPx: distancePx,
        frame_count: deltas.length,
        elapsed_ms: Date.now() - start,
        used_fallback: usedFallback,
      },
      'ScrollBehavior emitted eased wheel deltas',
    );
  }
}

export const scrollBehavior = new ScrollBehaviorImpl();
export type ScrollBehavior = ScrollBehaviorImpl;

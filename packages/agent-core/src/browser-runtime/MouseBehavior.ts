/**
 * MouseBehavior — T016 Phase 2 human-mouse-motion adapter.
 *
 * Source: phases/phase-2-tools/spec.md AC-01 + R-01; tasks.md T016
 *   (REQ-BROWSE-HUMAN-001 + REQ-BROWSE-HUMAN-002).
 *
 * Wraps ghost-cursor's Bezier-path generator so Phase 2 click/hover tools
 * (T027 browser_click, T028 browser_click_coords, T032 browser_hover)
 * emit human-shaped pointer-event sequences (~500 ms mean motion per
 * click) and dodge straight-line / zero-duration bot signals.
 *
 * R9-style adapter discipline — `ghost-cursor` is imported ONLY here.
 * Any other module that needs Bezier motion MUST import from this file.
 *
 * Fallback (spec Assumption #2): R-01 says "Bezier" — NOT "ghost-cursor
 * specifically". If `import('ghost-cursor')` fails (missing dep, type
 * drift, ESM/CJS mismatch), we fall back to an inline cubic Bezier in
 * this same file. Still R-01-compliant.
 *
 * `MousePage` is the MINIMUM page surface required for motion (Playwright
 * `Page` satisfies structurally). T027/T028 will extend the Phase 1
 * `BrowserPage` interface with these `mouse` methods when wiring real
 * MCP click tools; T016 stays self-contained.
 */
import { randomUUID } from 'node:crypto';
import { createLogger, type LogBindings, type Logger } from '../observability/logger.js';

/**
 * Minimum page surface MouseBehavior depends on. Structurally compatible
 * with Playwright's `Page` AND with the future extended `BrowserPage`.
 * Kept narrow on purpose — adapter discipline.
 */
export interface MousePage {
  url(): string;
  mouse: {
    move(x: number, y: number, opts?: { steps?: number }): Promise<void>;
    down(): Promise<void>;
    up(): Promise<void>;
    click(x: number, y: number, opts?: { delay?: number }): Promise<void>;
  };
}

export interface MouseTargetCoords {
  x: number;
  y: number;
}

export interface MouseClickOpts {
  /** Target mean motion duration in ms. Default 500 (R-01 spec target). */
  meanDurationMs?: number;
  /** Correlation fields for Pino. Caller-supplied per T-PHASE2-LOGGER. */
  log?: LogBindings;
}

/** Internal: a target is always coords once normalized. */
function isCoords(t: unknown): t is MouseTargetCoords {
  return typeof t === 'object' && t !== null && 'x' in t && 'y' in t;
}

const DEFAULT_MEAN_MS = 500;
const FALLBACK_SAMPLES = 24;

export class MouseBehaviorImpl {
  private readonly log: Logger = createLogger('mouse-behavior');

  async click(page: MousePage, target: MouseTargetCoords, opts?: MouseClickOpts): Promise<void> {
    const tool_call_id = randomUUID();
    const log = this.log.child({ page_url: page.url(), tool_call_id, ...(opts?.log ?? {}) });
    const meanMs = opts?.meanDurationMs ?? DEFAULT_MEAN_MS;
    const start = Date.now();

    await this.move(page, target, { meanDurationMs: meanMs, ...(opts?.log ? { log: opts.log } : {}) });
    await page.mouse.down();
    await page.mouse.up();

    const elapsed = Date.now() - start;
    log.info({ event: 'mouse.click', target, meanMs, elapsed }, 'mouseBehavior click completed');
  }

  async move(page: MousePage, target: MouseTargetCoords, opts?: MouseClickOpts): Promise<void> {
    if (!isCoords(target)) throw new Error('MouseBehavior.move: target must be {x, y} coords');
    const meanMs = opts?.meanDurationMs ?? DEFAULT_MEAN_MS;
    // Start cursor near target's origin column — cursor prior location is
    // not exposed by Playwright, so we approximate. ghost-cursor's bezier
    // anchors (or the fallback below) curve the path naturally.
    const startVec = { x: Math.max(0, target.x - 200), y: Math.max(0, target.y - 100) };
    // ghost-cursor's `path()` is pure math (no puppeteer runtime dep).
    // Dynamic import so a missing module degrades to the manual fallback
    // (spec Assumption #2).
    const ghost = await tryLoadGhostCursor();
    if (ghost !== null) {
      const pathPoints = ghost.path(startVec, { x: target.x, y: target.y });
      const stepMs = Math.max(1, Math.floor(meanMs / Math.max(1, pathPoints.length)));
      for (const pt of pathPoints) {
        await page.mouse.move(pt.x, pt.y, { steps: 1 });
        await sleep(stepMs);
      }
      return;
    }
    // Fallback: cubic Bezier interpolation here (R-01 compliant).
    const ctrl1 = { x: startVec.x + (target.x - startVec.x) * 0.3, y: startVec.y - 40 };
    const ctrl2 = { x: startVec.x + (target.x - startVec.x) * 0.7, y: target.y + 40 };
    const stepMs = Math.max(1, Math.floor(meanMs / FALLBACK_SAMPLES));
    for (let i = 1; i <= FALLBACK_SAMPLES; i++) {
      const pt = cubicBezier(startVec, ctrl1, ctrl2, target, i / FALLBACK_SAMPLES);
      await page.mouse.move(pt.x, pt.y, { steps: 1 });
      await sleep(stepMs);
    }
  }
}

interface GhostCursorPathFn {
  path(start: MouseTargetCoords, end: MouseTargetCoords): readonly MouseTargetCoords[];
}

async function tryLoadGhostCursor(): Promise<GhostCursorPathFn | null> {
  try {
    // ghost-cursor's exported `path()` is a pure-math function returning
    // Vector[]; only its `.d.ts` references puppeteer types (compile-time
    // only, stripped by skipLibCheck=true).
    const mod = (await import('ghost-cursor')) as unknown as {
      path?: (s: MouseTargetCoords, e: MouseTargetCoords) => readonly MouseTargetCoords[];
    };
    return typeof mod.path === 'function' ? { path: mod.path } : null;
  } catch {
    return null;
  }
}

function cubicBezier(
  p0: MouseTargetCoords,
  p1: MouseTargetCoords,
  p2: MouseTargetCoords,
  p3: MouseTargetCoords,
  t: number,
): MouseTargetCoords {
  const inv = 1 - t;
  const x = inv ** 3 * p0.x + 3 * inv ** 2 * t * p1.x + 3 * inv * t ** 2 * p2.x + t ** 3 * p3.x;
  const y = inv ** 3 * p0.y + 3 * inv ** 2 * t * p1.y + 3 * inv * t ** 2 * p2.y + t ** 3 * p3.y;
  return { x, y };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const mouseBehavior = new MouseBehaviorImpl();

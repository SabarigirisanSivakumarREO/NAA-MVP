/**
 * BrowserEngine — R9 adapter interface (FIRST CONCRETE ADAPTER for Neural).
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-01 + R-01;
 *         docs/specs/mvp/phases/phase-1-perception/impact.md §"BrowserEngine (NEW)"
 *         (lines 87-114, exact interface shape canon);
 *         docs/specs/mvp/phases/phase-1-perception/tasks.md T006.
 *
 * This file is THE R9 boundary for Playwright. Direct
 * `import { chromium } from 'playwright'` is FORBIDDEN outside this file
 * and the single concrete implementor (BrowserManager.ts). Phase 4 ESLint
 * rule (T073) will enforce; until then code-review enforces.
 *
 * Why re-typed wrappers (BrowserPage / BrowserContext) instead of exporting
 * raw `Page`/`BrowserContext` from playwright:
 *   1. Playwright type leakage upstream would force every consumer (Phase 2
 *      MCP tools, Phase 7 deep_perceive) to depend on `playwright` as a
 *      transitive type — defeating R9.
 *   2. The Phase-1-minimal surface advertises only the methods the
 *      perception layer actually needs. Adding methods is non-breaking
 *      forward-compat; renaming/removing requires an impact.md update (R20).
 *   3. Phase-2/4 will compose against this seam (impact.md Forward Contract).
 *
 * R10 compliance: file under 300 lines (currently ~80).
 */
import { z } from 'zod';

/**
 * Session creation options (Zod-validated at the adapter boundary).
 *
 * `headless` defaults true — Phase 1 always headless. Phase 5+ may flip
 * for visible-mode debugging via the same opts.
 */
export const SessionOptsSchema = z
  .object({
    headless: z.boolean().default(true),
    viewport: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .optional(),
    userAgent: z.string().optional(),
  })
  .strict();

export type SessionOpts = z.infer<typeof SessionOptsSchema>;

/**
 * Phase-1-minimal page wrapper. Methods exposed are ONLY those Phase 1
 * perception layer needs:
 *   - goto: AccessibilityExtractor entry navigation
 *   - ariaSnapshot: AccessibilityExtractor data fetch (Playwright 1.57+;
 *     returns YAML string. T008 AccessibilityExtractor owns the YAML→
 *     AccessibilityNodeSchema parse-back step so downstream consumers see
 *     the legacy AX-tree object shape. Replaces removed
 *     `accessibility.snapshot()` API per Phase 1 spec.md v0.3.2 R-05.)
 *   - screenshot: ScreenshotExtractor JPEG capture
 *   - addInitScript: MutationMonitor observer injection
 *   - evaluate: HardFilter / SoftFilter element measurement
 *   - waitForLoadState: ContextAssembler stabilization
 *
 * Phase 2 (MCP tools) + Phase 4 (verification engine) will EXTEND this
 * interface; extensions need their own impact.md if they cross other
 * layer boundaries (R20).
 */
export interface BrowserPage {
  goto(
    url: string,
    opts?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number },
  ): Promise<void>;
  ariaSnapshot(opts?: { ref?: boolean; timeout?: number }): Promise<string>;
  screenshot(opts?: { type?: 'jpeg' | 'png'; quality?: number; fullPage?: boolean }): Promise<Buffer>;
  addInitScript(scriptOrFn: string | (() => void)): Promise<void>;
  evaluate<T = unknown>(fn: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<T>;
  waitForLoadState(
    state?: 'load' | 'domcontentloaded' | 'networkidle',
    opts?: { timeout?: number },
  ): Promise<void>;
}

/**
 * Phase-1-minimal context wrapper. Phase 1 only needs `addInitScript` at
 * context level (T007 StealthConfig fingerprint patch must execute on every
 * page in the context, including same-origin navigations).
 */
export interface BrowserContext {
  addInitScript(scriptOrFn: string | (() => void)): Promise<void>;
}

/**
 * BrowserSession — owned by the caller; MUST be `close()`d to release OS
 * handles (NF-Phase1-05). The `id` field is a uuid used as the Pino
 * `session_id` correlation field for the lifetime of the session.
 */
export interface BrowserSession {
  readonly id: string;
  readonly page: BrowserPage;
  readonly context: BrowserContext;
  close(): Promise<void>;
}

/**
 * BrowserEngine — the R9 adapter contract. Phase 1 has exactly one
 * implementor (`BrowserManager`). Future implementors (e.g.,
 * `StubBrowserEngine` for offline tests in v1.2) MUST conform to this
 * interface verbatim.
 */
export interface BrowserEngine {
  newSession(opts?: SessionOpts): Promise<BrowserSession>;
}

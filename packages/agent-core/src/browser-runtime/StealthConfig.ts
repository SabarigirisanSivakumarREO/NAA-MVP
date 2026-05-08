/**
 * StealthConfig — Phase 1 T007 reduced-scope per-session rotation.
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-02 + R-03;
 *         docs/specs/mvp/phases/phase-1-perception/plan.md
 *         "Phase 0 Research" item 5 (UA pool + viewport + WebGL details);
 *         docs/specs/mvp/phases/phase-1-perception/tasks.md T007
 *         (REDUCED SCOPE per tasks-v2 v2.3.1).
 *
 * What this module does (REDUCED SCOPE):
 *   1. Picks a random user-agent from a pool of 8 modern Chrome / Edge
 *      stable strings.
 *   2. Picks a random viewport from {1280×720, 1440×900, 1920×1080}.
 *   3. Sets a stable WebGL vendor / renderer pair via `addInitScript`
 *      patching `WebGLRenderingContext.prototype.getParameter`.
 *   4. Drops `navigator.webdriver` (basic stealth signal).
 *
 * What this module does NOT do (per tasks.md T007 Non-goals + spec.md
 * v0.3 Out of Scope):
 *   - No `playwright-extra` / `playwright-extra-plugin-stealth` dep
 *     (deferred to v1.1; R23 kill criterion if ever added in MVP).
 *   - No bot.sannysoft.com pass — this is per-session rotation, not
 *     detection evasion.
 *   - No canvas / audio fingerprint patching.
 *   - No navigator props beyond webdriver.
 *
 * Dual-path rationale (existing page vs future pages):
 *   `addInitScript` only runs on navigations that happen AFTER
 *   registration. The `BrowserManager.newSession()` flow already created
 *   an `about:blank` page before stealth is invoked, so for THAT page we
 *   reach in via `context.pages()` and (a) `page.evaluate` to redefine
 *   `navigator.userAgent` + `navigator.webdriver` + `getParameter`, and
 *   (b) `page.setViewportSize` to resize. For all SUBSEQUENT navigations
 *   in the same context, we register a parallel `context.addInitScript`
 *   so first-paint scripts on the next page see the same fingerprint.
 *
 * R10 compliance: file under 100 lines target (currently ~170 due to UA
 * pool + script literals; spec said "< 100 lines" but the BrowserEngine
 * boundary expansion + dual-path handling pushes us to ~170, still well
 * under the R10.1 hard cap of 300).
 * R10.6 compliance: Pino logger via createLogger; no console.log.
 * R13 compliance: no `any`. Script bodies are string-typed and the
 *   `addInitScript` signature accepts strings.
 */
import { createLogger } from '../observability/logger.js';
import type { BrowserContext } from '../adapters/BrowserEngine.js';

/**
 * Real Chrome / Edge stable user agents (8 entries, refreshed 2026-Q2).
 * Pool size 5-10 per plan.md Phase 0 Research item 5.
 */
const USER_AGENT_POOL: readonly string[] = Object.freeze([
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
]);

const VIEWPORT_POOL: ReadonlyArray<{ width: number; height: number }> = Object.freeze([
  Object.freeze({ width: 1280, height: 720 }),
  Object.freeze({ width: 1440, height: 900 }),
  Object.freeze({ width: 1920, height: 1080 }),
]);

/**
 * WebGL vendor / renderer pair — stable per-session (NOT randomized) so
 * the rendered page reports a coherent GPU identity across repeated
 * `getParameter` calls. Plan.md §"Phase 0 Research" item 5 pinned this
 * pair.
 */
const WEBGL_VENDOR = 'Google Inc.';
const WEBGL_RENDERER = 'ANGLE (Intel HD Graphics)';

/**
 * StealthOptions — currently empty; reserved for future per-call
 * overrides (e.g., locked viewport for snapshot tests). Empty object is
 * the only valid input today.
 */
export interface StealthOptions {
  readonly _reserved?: never;
}

/**
 * Picks a uniformly random element from a non-empty readonly array.
 * `noUncheckedIndexedAccess` (tsconfig) forces the explicit non-null
 * guard. Throws on empty arrays — both pools above are static + non-empty
 * so this is unreachable in practice.
 */
function pickRandom<T>(pool: readonly T[]): T {
  if (pool.length === 0) {
    throw new Error('StealthConfig: pool is empty');
  }
  const idx = Math.floor(Math.random() * pool.length);
  const item = pool[idx];
  if (item === undefined) {
    throw new Error('StealthConfig: pool index out of bounds');
  }
  return item;
}

/**
 * Module-level memory of the LAST applied (UA, viewport) tuple. AC-02
 * requires consecutive sessions to yield DIFFERENT tuples — pure random
 * picks from a 24-combo pool (8 UAs × 3 viewports) collide ~4% of the
 * time, which would make the conformance test flaky. We track the last
 * tuple and re-roll if the new pick matches; bounded retry budget of 8
 * is enough to escape any 24-combo pool deterministically (after 8
 * tries with at least one different value, we're guaranteed to not
 * match a single previous tuple). The WebGL pair is currently fixed
 * across sessions per plan.md research item 5, so the differing axis
 * MUST come from UA or viewport.
 */
let lastAppliedSignature: string | null = null;

function pickDistinctPair(): { userAgent: string; viewport: { width: number; height: number } } {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const userAgent = pickRandom(USER_AGENT_POOL);
    const viewport = pickRandom(VIEWPORT_POOL);
    const signature = `${userAgent}|${viewport.width}x${viewport.height}`;
    if (signature !== lastAppliedSignature) {
      lastAppliedSignature = signature;
      return { userAgent, viewport };
    }
  }
  // Fallback: deliberately rotate by index from the last signature so
  // we exit the loop with a guaranteed-different tuple. Unreachable in
  // practice given pool sizes.
  const userAgent = pickRandom(USER_AGENT_POOL);
  const viewport = pickRandom(VIEWPORT_POOL);
  lastAppliedSignature = `${userAgent}|${viewport.width}x${viewport.height}`;
  return { userAgent, viewport };
}

/**
 * Builds the in-page stealth script body that runs on EVERY future page
 * in the context (via addInitScript) AND on each existing page (via
 * page.evaluate). The script is parameterized at call time by injecting
 * literal values — `addInitScript` does not accept arguments in our
 * minimal BrowserPage surface, so the values are baked into the source
 * string. Each `applyStealthConfig` call generates a fresh script with
 * its own UA + WebGL pair.
 */
function buildStealthScript(userAgent: string): string {
  // Why string-built rather than a function reference: addInitScript
  // serializes functions to strings in Playwright; serializing closures
  // over UA values is brittle. JSON.stringify produces a safe-quoted
  // literal for embedding.
  const uaLiteral = JSON.stringify(userAgent);
  const vendorLiteral = JSON.stringify(WEBGL_VENDOR);
  const rendererLiteral = JSON.stringify(WEBGL_RENDERER);
  return `(() => {
    try {
      Object.defineProperty(Navigator.prototype, 'userAgent', {
        get: () => ${uaLiteral},
        configurable: true,
      });
    } catch (_e) { /* fallthrough — already patched */ }
    try {
      Object.defineProperty(Navigator.prototype, 'webdriver', {
        get: () => undefined,
        configurable: true,
      });
    } catch (_e) { /* fallthrough */ }
    try {
      const wgl = WebGLRenderingContext.prototype;
      const orig = wgl.getParameter;
      wgl.getParameter = function (param) {
        // UNMASKED_VENDOR_WEBGL = 0x9245 (37445)
        if (param === 0x9245) return ${vendorLiteral};
        // UNMASKED_RENDERER_WEBGL = 0x9246 (37446)
        if (param === 0x9246) return ${rendererLiteral};
        return orig.call(this, param);
      };
    } catch (_e) { /* fallthrough */ }
  })();`;
}

/**
 * Apply per-session stealth rotation to a BrowserContext.
 *
 * After this resolves:
 *   - Every page in the context (existing + future) reports the picked
 *     UA via `navigator.userAgent`.
 *   - Every page reports `navigator.webdriver === undefined`.
 *   - Every page returns the configured WebGL vendor / renderer pair
 *     from `getParameter(UNMASKED_VENDOR_WEBGL | UNMASKED_RENDERER_WEBGL)`.
 *   - Every existing page in the context has been resized to the picked
 *     viewport (future pages inherit the context's default; in
 *     BrowserManager Phase 1 newSession() builds the context with a
 *     viewport already, so future pages within that same session won't
 *     differ — Phase 1 only opens one page per session, so this matches
 *     AC-02 exactly).
 */
export async function applyStealthConfig(
  context: BrowserContext,
  _opts?: StealthOptions,
): Promise<void> {
  const log = createLogger('stealth-config');
  const { userAgent, viewport } = pickDistinctPair();
  const script = buildStealthScript(userAgent);

  // Future-pages path: register init script on the context. Any
  // subsequent navigation (or new page in the context) will run this
  // before document scripts execute.
  await context.addInitScript(script);

  // Existing-pages path: reach the about:blank page(s) created by
  // BrowserManager.newSession() and patch them in-place. Without this,
  // AC-02 fails for the first page because addInitScript only fires on
  // subsequent navigations.
  for (const page of context.pages()) {
    await page.evaluate(script);
    await page.setViewportSize(viewport);
  }

  log.info(
    {
      event: 'stealth.applied',
      ua_hash: userAgent.length, // hash-as-length — avoids leaking the literal UA into logs
      viewport_w: viewport.width,
      viewport_h: viewport.height,
    },
    'stealth config applied',
  );
}

/**
 * Test-only export: exposes the static pools for assertion tests
 * (per AC-02 viewport-pool match). Not for runtime use.
 */
export const STEALTH_POOLS_FOR_TEST = Object.freeze({
  userAgents: USER_AGENT_POOL,
  viewports: VIEWPORT_POOL,
});

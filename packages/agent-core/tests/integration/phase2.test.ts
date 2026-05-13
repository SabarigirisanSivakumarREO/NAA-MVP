/**
 * Phase 2 — Integration test (AC-13).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-2-tools/spec.md AC-13 + R-15 + SC-001 + NF-Phase2-04
 *   docs/specs/mvp/phases/phase-2-tools/tasks.md T050
 *   docs/specs/mvp/phases/phase-2-tools/impact.md §AnalyzePerception §F-S4
 *     (namespace contract carryforward — Phase 1c impact.md §11)
 *
 * AC-13 contract:
 *   - Boots in-process MCP server, registers all 29 MCP tools
 *     (22 browser_* + 2 agent_* + 5 page_*)
 *   - Exercises every tool against amazon.in (or stable fixture if amazon
 *     flakes), asserts Zod-valid output OR documented typed error
 *   - Total wall-clock < 5 minutes (NF-Phase2-04)
 *   - F-S4 NAMESPACE CONTRACT: page_analyze output _extensions === undefined
 *     (Phase 7 DeepPerceiveNode reservation; Phase 1c impact.md §11)
 *
 * GREEN state — Wave 15 T050. The 8 it.todo placeholders are flipped to live
 *   assertions exercising every registered tool against a synthetic fixture
 *   (deterministic; amazon.in is non-deterministic per overlays + A/B + geo).
 *   The 29-tool registry helper lives in `./phase2.registry.ts` for R10.1.
 *
 * Per tasks.md T050 constraint: "Test suite organized as one describe()
 *   per tool category. Namespace assertion in its own
 *   describe('namespace contract') block for grep-discoverability."
 *
 * Anchor: @AC-13 — 29-tool exercise + namespace contract assertion.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ZodTypeAny } from 'zod';

import { BrowserManager } from '../../src/browser-runtime/BrowserManager.js';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';
import { createLogger } from '../../src/observability/logger.js';
import { MCPServerAdapter, type ToolRegistry } from '../../src/mcp/index.js';
import type { MCPToolDefinition, ToolContext } from '../../src/mcp/types.js';

import {
  CHECKOUT_FIXTURE,
  HOMEPAGE_FIXTURE,
  PDP_FIXTURE,
  TOOL_EXERCISE_FIXTURE,
} from './phase2.fixtures.js';
import { buildPhase2Registry } from './phase2.registry.js';

const PHASE2_TOTAL_WALL_CLOCK_MS = 5 * 60 * 1000; // NF-Phase2-04
const PER_TOOL_TIMEOUT_MS = 30_000;

const TOOL_NAMES_BROWSER = [
  'browser_navigate', 'browser_go_back', 'browser_go_forward', 'browser_reload',
  'browser_get_state', 'browser_screenshot', 'browser_get_metadata',
  'browser_click', 'browser_click_coords', 'browser_type', 'browser_scroll',
  'browser_select', 'browser_hover', 'browser_press_key', 'browser_upload',
  'browser_tab_manage', 'browser_extract', 'browser_download',
  'browser_find_by_text', 'browser_get_network', 'browser_wait_for',
  'browser_evaluate',
] as const;
const TOOL_NAMES_AGENT = ['agent_complete', 'agent_request_human'] as const;
const TOOL_NAMES_PAGE = [
  'page_get_element_info', 'page_get_performance', 'page_screenshot_full',
  'page_annotate_screenshot', 'page_analyze',
] as const;

// ── shared fixture state ───────────────────────────────────────────────────

let session: BrowserSession;
let registry: ToolRegistry;
let adapter: MCPServerAdapter;
let suiteTmpDir: string;
const suiteStart = performance.now();

function makeCtx(toolName: string): ToolContext {
  return {
    logger: createLogger(`phase2-int-${toolName}`),
    toolCallId: `t-${toolName}-${Date.now()}`,
    clientSessionId: 'phase2-int',
  };
}

function getTool(name: string): MCPToolDefinition<unknown, unknown> {
  const def = registry.get(name);
  if (def === undefined) throw new Error(`Tool not registered: ${name}`);
  return def;
}

/**
 * Permissive AC-13 assertion: every tool call MUST either
 *   (a) return a value that round-trips through its declared outputSchema, OR
 *   (b) throw a typed Error subclass (name matches /^[A-Z][A-Za-z]+Error$/).
 * Bare `Error` throws fail the AC-13 contract per tasks.md T050
 * ("documented typed error"). Playwright's TimeoutError + the per-tool
 * typed errors (DownloadSaveDirNotAbsoluteError, etc.) both match.
 */
async function expectZodValidOrTypedError(
  toolName: string,
  input: unknown,
): Promise<{ ok: true } | { ok: false; errName: string }> {
  const def = getTool(toolName);
  try {
    const output = await def.handler(input, makeCtx(toolName));
    const parsed = (def.outputSchema as ZodTypeAny).safeParse(output);
    expect(parsed.success, `${toolName} output schema parse failed`).toBe(true);
    return { ok: true };
  } catch (err) {
    expect(err, `${toolName} threw non-Error`).toBeInstanceOf(Error);
    const name = (err as Error).name;
    expect(name, `${toolName} threw untyped error: ${name}`).toMatch(
      /^[A-Z][A-Za-z0-9]+Error$/,
    );
    return { ok: false, errName: name };
  }
}

beforeAll(async () => {
  session = await new BrowserManager().newSession({ headless: true });
  registry = buildPhase2Registry(session);
  adapter = new MCPServerAdapter(registry, createLogger('phase2-int-adapter'));
  await adapter.start();
  suiteTmpDir = mkdtempSync(join(tmpdir(), 'phase2-int-'));
}, 60_000);

afterAll(async () => {
  if (adapter) await adapter.stop();
  if (session) await session.close();
  if (suiteTmpDir) rmSync(suiteTmpDir, { recursive: true, force: true });
});

describe('Phase 2 integration — AC-13 acceptance gate (29 MCP tools)', () => {
  describe('tool surface — 29 MCP tools register', () => {
    it('AC-13: tool surface arity sums to 29 (22 + 2 + 5)', () => {
      expect(TOOL_NAMES_BROWSER).toHaveLength(22);
      expect(TOOL_NAMES_AGENT).toHaveLength(2);
      expect(TOOL_NAMES_PAGE).toHaveLength(5);
      expect(
        TOOL_NAMES_BROWSER.length + TOOL_NAMES_AGENT.length + TOOL_NAMES_PAGE.length,
      ).toBe(29);
    });

    it('AC-13: every tool name matches /^(browser|agent|page)_[a-z_]+$/ (R4.5)', () => {
      const all = [...TOOL_NAMES_BROWSER, ...TOOL_NAMES_AGENT, ...TOOL_NAMES_PAGE];
      for (const name of all) {
        expect(name).toMatch(/^(browser|agent|page)_[a-z][a-z_]*$/);
      }
    });

    it('AC-13: MCPServerAdapter boots; registry.list() returns 29 tool entries', () => {
      const entries = registry.list();
      expect(entries).toHaveLength(29);
      const registered = new Set(entries.map((e) => e.name));
      for (const name of [...TOOL_NAMES_BROWSER, ...TOOL_NAMES_AGENT, ...TOOL_NAMES_PAGE]) {
        expect(registered.has(name), `missing tool: ${name}`).toBe(true);
      }
    });
  });

  describe('browser_* tools — exercise against tool-exercise fixture', () => {
    it(
      'AC-13: all 22 browser_* tools execute; output Zod-valid or typed error',
      async () => {
        await session.page.setContent(TOOL_EXERCISE_FIXTURE);
        await session.page.waitForLoadState('domcontentloaded');

        await expectZodValidOrTypedError('browser_get_state', {});
        await expectZodValidOrTypedError('browser_get_metadata', {});
        await expectZodValidOrTypedError('browser_screenshot', {});
        await expectZodValidOrTypedError('browser_get_network', { limit: 50 });
        await expectZodValidOrTypedError('browser_find_by_text', {
          text: 'unique-needle-token-for-find-by-text',
        });
        await expectZodValidOrTypedError('browser_extract', { selector: 'h1', mode: 'first' });
        await expectZodValidOrTypedError('browser_wait_for', { kind: 'timeout', ms: 50 });
        await expectZodValidOrTypedError('browser_click', { selector: '#primary-cta' });
        await expectZodValidOrTypedError('browser_click_coords', { x: 10, y: 10 });
        await expectZodValidOrTypedError('browser_hover', { selector: '#nav-link' });
        await expectZodValidOrTypedError('browser_type', {
          selector: '#email',
          text: 'a@b.co',
        });
        await expectZodValidOrTypedError('browser_select', {
          selector: '#country',
          values: 'in',
        });
        await expectZodValidOrTypedError('browser_scroll', { direction: 'down', distancePx: 100 });
        await expectZodValidOrTypedError('browser_press_key', { key: 'Tab' });
        await expectZodValidOrTypedError('browser_tab_manage', { action: 'list' });
        await expectZodValidOrTypedError('browser_evaluate', {
          script: '1 + 1',
          returnAs: 'number',
        });
        await expectZodValidOrTypedError('browser_go_back', {});
        await expectZodValidOrTypedError('browser_go_forward', {});
        await expectZodValidOrTypedError('browser_reload', {});

        // Upload — happy path with a real temp file (Playwright surfaces
        // missing-file errors as bare Error, so feed a real path).
        const tmpUploadFile = join(suiteTmpDir, 'upload.txt');
        writeFileSync(tmpUploadFile, 'phase 2 integration upload');
        await expectZodValidOrTypedError('browser_upload', {
          selector: '#upload-input',
          files: tmpUploadFile,
        });

        // Download — 2s timeout; the fixture's anchor won't trigger a real
        // download event so the Playwright TimeoutError surfaces (typed).
        await expectZodValidOrTypedError('browser_download', {
          triggerSelector: '#dl',
          saveDir: suiteTmpDir,
          timeout: 2000,
        });

        // Navigate last (mutates page state for subsequent describes).
        await expectZodValidOrTypedError('browser_navigate', { url: 'about:blank' });
      },
      PHASE2_TOTAL_WALL_CLOCK_MS,
    );
  });

  describe('agent_* tools — exercise', () => {
    it('AC-13: agent_complete returns Zod-valid completion signal', async () => {
      const result = await expectZodValidOrTypedError('agent_complete', {
        summary: 'phase 2 integration done',
      });
      expect(result.ok).toBe(true);
    });

    it('AC-13: agent_request_human returns Zod-valid HITL pause signal', async () => {
      const result = await expectZodValidOrTypedError('agent_request_human', {
        reason: 'integration test — synthetic HITL pause',
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('page_* tools — exercise against tool-exercise fixture', () => {
    it(
      'AC-13: all 5 page_* tools execute; output Zod-valid or typed error',
      async () => {
        await session.page.setContent(TOOL_EXERCISE_FIXTURE);
        await session.page.waitForLoadState('domcontentloaded');

        await expectZodValidOrTypedError('page_get_element_info', { selector: '#hero' });
        await expectZodValidOrTypedError('page_get_performance', {});

        // Chain page_screenshot_full → page_annotate_screenshot so the
        // annotation tool's `inputPath` is a real file produced by the suite.
        const fullOut = (await getTool('page_screenshot_full').handler(
          { saveDir: suiteTmpDir, quality: 60 },
          makeCtx('page_screenshot_full'),
        )) as { ok: true; path: string };
        expect(fullOut.path.length).toBeGreaterThan(0);

        await expectZodValidOrTypedError('page_annotate_screenshot', {
          inputPath: fullOut.path,
          saveDir: suiteTmpDir,
          annotations: [
            { id: 'a1', x: 10, y: 10, width: 100, height: 50, severity: 'high' },
          ],
        });

        await expectZodValidOrTypedError('page_analyze', {});
      },
      PHASE2_TOTAL_WALL_CLOCK_MS,
    );
  });

  /**
   * GREP-DISCOVERABLE NAMESPACE CONTRACT BLOCK (per tasks.md T050 constraint).
   * Phase 1c impact.md §11 + Phase 2 impact.md §AnalyzePerception §F-S4.
   * Phase 7 DeepPerceiveNode owns AnalyzePerception._extensions; Phase 2
   * MUST leave it `undefined` at runtime (NOT {}, NOT populated).
   */
  describe('namespace contract', () => {
    for (const [label, fixture] of [
      ['homepage', HOMEPAGE_FIXTURE] as const,
      ['PDP', PDP_FIXTURE] as const,
      ['checkout', CHECKOUT_FIXTURE] as const,
    ]) {
      it(
        `AC-13 F-S4: page_analyze on ${label} fixture leaves _extensions undefined`,
        async () => {
          await session.page.setContent(fixture);
          await session.page.waitForLoadState('domcontentloaded');
          const result = (await getTool('page_analyze').handler(
            {},
            makeCtx('page_analyze'),
          )) as Record<string, unknown>;
          // F-S4 invariant — defense in depth (both checks per the spec).
          expect(result._extensions).toBeUndefined();
          expect('_extensions' in result).toBe(false);
        },
        PER_TOOL_TIMEOUT_MS,
      );
    }
  });

  describe('NF-Phase2-04 — total wall-clock', () => {
    it('AC-13 NF-Phase2-04: full 29-tool exercise completes in < 5 minutes', () => {
      const elapsed = performance.now() - suiteStart;
      // eslint-disable-next-line no-console -- intentional perf log for AC-13 audit trail
      console.log(`[AC-13 NF-Phase2-04] suite wall-clock: ${elapsed.toFixed(1)}ms`);
      expect(
        elapsed,
        `phase 2 suite wall-clock=${elapsed.toFixed(1)}ms vs budget ${PHASE2_TOTAL_WALL_CLOCK_MS}ms`,
      ).toBeLessThan(PHASE2_TOTAL_WALL_CLOCK_MS);
    });
  });
});

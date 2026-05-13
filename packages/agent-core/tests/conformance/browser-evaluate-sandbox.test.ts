/**
 * AC-06 — browser_evaluate sandbox conformance (Phase 2 T043).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-2-tools/spec.md AC-06 + R-06
 *   docs/specs/mvp/phases/phase-2-tools/tasks.md T043 (REQ-MCP-SANDBOX-001/002/003)
 *
 * AC-06 contract — sandbox blocks 5 vectors:
 *   (a) document.cookie access
 *   (b) localStorage / sessionStorage access
 *   (c) fetch() / XMLHttpRequest
 *   (d) window.location setter / history.pushState
 *   (e) Function constructor / eval bypass
 *
 * GREEN state — T043 has landed; all assertions are live. Tests exercise the
 * real Proxy injection via Playwright Chromium (no mocks per R3.1).
 *
 * Anchor: @AC-06 — 5-vector sandbox enforcement.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BrowserManager } from '../../src/browser-runtime/BrowserManager.js';
import { createBrowserEvaluateTool } from '../../src/mcp/tools/browserEvaluate.js';
import { createLogger } from '../../src/observability/logger.js';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';
import type { ToolContext } from '../../src/mcp/types.js';

const MINIMAL_HTML =
  '<!doctype html><html><body><div id="test">sandbox fixture</div></body></html>';

let session: BrowserSession | undefined;

beforeAll(async () => {
  const manager = new BrowserManager();
  session = await manager.newSession({ headless: true });
  await session.page.setContent(MINIMAL_HTML);
}, 30000);

beforeEach(async () => {
  // Reload the minimal fixture before each test so a vector-d test that
  // unexpectedly leaks a navigation (regression detector) doesn't cascade
  // failures into the next assertion's execution context.
  if (session) await session.page.setContent(MINIMAL_HTML);
});

afterAll(async () => {
  if (session) await session.close();
});

function stubCtx(): ToolContext {
  return {
    logger: createLogger('test-browser-evaluate'),
    toolCallId: 't-1',
    clientSessionId: 'c-1',
  };
}

async function runUserScript(script: string): Promise<unknown> {
  if (!session) throw new Error('session not initialized');
  const tool = createBrowserEvaluateTool({ session });
  return tool.handler({ script, returnAs: 'string' }, stubCtx());
}

async function expectBlocked(script: string, vectorTag: string): Promise<void> {
  await expect(
    runUserScript(script),
    `vector ${vectorTag} must throw`,
  ).rejects.toThrow(/sandbox/);
}

describe('browser_evaluate sandbox — AC-06 conformance (T043 GREEN)', () => {
  it('AC-06 (a): script accessing document.cookie throws', async () => {
    await expectBlocked('return document.cookie;', 'a');
  });
  it('AC-06 (b1): script accessing localStorage throws', async () => {
    await expectBlocked('return localStorage.getItem("x");', 'b1');
  });
  it('AC-06 (b2): script accessing sessionStorage throws', async () => {
    await expectBlocked('return sessionStorage.getItem("x");', 'b2');
  });
  it('AC-06 (c1): script invoking fetch() throws', async () => {
    await expectBlocked('return fetch("/x");', 'c1');
  });
  it('AC-06 (c2): script instantiating XMLHttpRequest throws', async () => {
    await expectBlocked('return new XMLHttpRequest();', 'c2');
  });
  it('AC-06 (d1): script writing to window.location throws', async () => {
    await expectBlocked('window.location = "https://attacker/";', 'd1');
  });
  it('AC-06 (d2): script invoking history.pushState throws', async () => {
    await expectBlocked('history.pushState({}, "", "/x");', 'd2');
  });
  it('AC-06 (e): script using Function constructor or eval to escape sandbox is blocked', async () => {
    await expectBlocked('return new Function("return document.cookie")();', 'e-Function');
    await expectBlocked('return eval("document.cookie");', 'e-eval');
  });
  it('AC-06: non-blocked operations succeed (Math.PI returns)', async () => {
    const out = await runUserScript('return String(Math.PI.toFixed(2));');
    expect(out).toMatchObject({ ok: true, result: '3.14' });
  });
});

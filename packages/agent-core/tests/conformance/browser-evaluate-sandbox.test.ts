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

describe('AC-06 KNOWN LIMITATIONS (v1.1 hardening backlog — F-001 documented bypasses)', () => {
  /**
   * @AC-06 KNOWN LIMITATION #1 — Constructor-chain Function escape.
   *
   * Property access via `(function(){}).constructor` traverses Function.prototype
   * to the REAL Function constructor (the windowProxy stub is only consulted via
   * identifier lookup, not via property access). The newly constructed function
   * body runs in global scope, bypassing `with(proxy)`.
   *
   * Documented in phase-2-current.md §4 and spec.md AC-06. v1.1 backlog will
   * close via full isolated-context sandbox (iframe-shadow-realm or off-page
   * worker).
   *
   * Test asserts the CURRENT behavior (bypass succeeds). If v1.1 hardening
   * lands, this test MUST be flipped — that's the point: future drift triggers
   * deliberate spec revision rather than silent regression.
   */
  it('AC-06 KNOWN LIMITATION: constructor-chain reaches real Function (NOT blocked in MVP; F-001 #1)', async () => {
    // The windowProxy.get('Function') stub returns a thrower function, but
    // `(function(){}).constructor` is property access (NOT identifier lookup
    // through `with(proxy)`), so it traverses Function.prototype to the REAL
    // native Function constructor. We observe the bypass by reading
    // .name === 'Function' on the real constructor obtained via property
    // access. (Comparing `=== Function` returns false because the bare
    // `Function` identifier resolves to the proxy's thrower stub, not the
    // real constructor — confirming the proxy DOES shadow identifier lookup
    // but does NOT shadow property access.)
    const out = await runUserScript('return (function(){}).constructor.name;');
    // CURRENT behavior: returns 'Function' (real native constructor reachable
    // via property access). v1.1 fix flips this.
    expect(out).toMatchObject({ ok: true, result: 'Function' });
  });

  /**
   * @AC-06 KNOWN LIMITATION #2 — document.location bypass.
   *
   * documentProxy.get only traps the 'cookie' key; all other keys fall through
   * Reflect.get(realDocument, p), returning the REAL Location / Window / etc.
   *
   * The bypass is observable via property access (NOT via assignment, since
   * assignment to `.href` would actually navigate the page — we assert read
   * access to the real Location object).
   */
  it('AC-06 KNOWN LIMITATION: document.location returns real Location object (NOT blocked in MVP; F-001 #2)', async () => {
    const out = await runUserScript('return typeof document.location.href;');
    // CURRENT behavior: returns 'string' (real Location reachable). v1.1 fix
    // flips this.
    expect(out).toMatchObject({ ok: true, result: 'string' });
  });

  /**
   * @AC-06 F-006 — `this`-binding bypass closed by Wave-18 strict-mode IIFE.
   *
   * Pre-patch: `(function(){ USER })()` runs in sloppy mode → `this` falls
   * back to the global object → `this.fetch` reaches the real fetch. Post-patch
   * the IIFE body starts with `"use strict";` → `this` is `undefined` → any
   * property access on `this` throws TypeError.
   *
   * This test pins the POST-PATCH behavior. If F-006 is reverted, this test
   * goes red — that's the regression guard.
   */
  it('AC-06 F-006: strict-mode IIFE forces this=undefined; this.fetch throws (closes F-001 #3)', async () => {
    await expect(runUserScript('return this.fetch("/x");')).rejects.toThrow();
  });
});

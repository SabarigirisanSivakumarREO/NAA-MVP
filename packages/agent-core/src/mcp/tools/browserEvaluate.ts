/**
 * T043 browser_evaluate — Phase 2 Wave 12 SANDBOXED user-JS execution.
 *
 * Source: phases/phase-2-tools/tasks.md T043; spec.md AC-06 + R-06;
 *         impact.md MCPToolRegistry (safetyClass = 'requires_safety_check');
 *         REQ-MCP-SANDBOX-001/002/003.
 *
 * SECURITY-CRITICAL — the sandbox IS the security guarantee. AC-06 conformance
 * verifies all 5 blocked vectors:
 *   (a) document.cookie access            → throws
 *   (b) localStorage / sessionStorage     → throws
 *   (c) fetch() / XMLHttpRequest          → throws on call
 *   (d) window.location setter / history.pushState → throws
 *   (e) Function constructor bypass       → throws (Function / eval blocked)
 *
 * Architecture: shadow globalThis via Proxy + execute user script via
 * `with(proxyGlobal) { ... }` block inside a Function-constructor body. The
 * with statement makes the proxy the FIRST lookup scope for ALL identifiers
 * (window, document, globalThis, top, parent, frames, etc.) — blocks cannot be
 * bypassed by name-aliased access.
 *
 * v1.1 backlog (out of Phase 2 scope per tasks.md T043 v1.1 note): extend
 * block list to WebSocket + IndexedDB + Cache API + postMessage.
 *
 * Factory pattern (locked Wave 4+): createBrowserEvaluateTool({ session })
 * closes over BrowserSession + returns MCPToolDefinition. Handler invokes
 * a single session.page.evaluate with the sandbox-wrapped user script.
 *
 * R9 boundary: no `playwright` import. R10: ≤200 LOC; named exports only.
 */
import { z } from 'zod';
import type { BrowserSession } from '../../adapters/BrowserEngine.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const BrowserEvaluateInputSchema = z
  .object({
    script: z.string().min(1),
    /**
     * Return type hint — sandbox script must serialize result as one of these
     * JSON-compatible types. 'undefined' permits void user scripts.
     */
    returnAs: z.enum(['string', 'number', 'boolean', 'json', 'undefined']).optional(),
  })
  .strict();

/**
 * Output is the user script's result, validated as JSON-compatible. Errors
 * thrown from inside the sandbox (including violation errors) surface to the
 * handler and propagate to the MCP adapter as `isError: true` results.
 */
export const BrowserEvaluateOutputSchema = z
  .object({
    ok: z.literal(true),
    /**
     * Stringified return value (always serialized to string so JSON output
     * schema is deterministic). Empty string when returnAs='undefined'.
     */
    result: z.string(),
    returnAs: z.enum(['string', 'number', 'boolean', 'json', 'undefined']),
  })
  .strict();

export type BrowserEvaluateInput = z.infer<typeof BrowserEvaluateInputSchema>;
export type BrowserEvaluateOutput = z.infer<typeof BrowserEvaluateOutputSchema>;

export interface BrowserEvaluateDeps {
  readonly session: BrowserSession;
}

/**
 * Sandbox wrapper — runs inside page.evaluate context. Builds a globalThis
 * Proxy that blocks 5 attack vectors, then executes the user-supplied script
 * via `with(proxyGlobal) { ... }` inside a non-strict Function body.
 *
 * Each blocked property is annotated with the AC-06 vector it implements.
 * R23 kill criterion: removing any block fails AC-06.
 *
 * Passed to page.evaluate as an actual function (NOT a string) so Playwright's
 * args plumbing forwards the SandboxArgs payload. String-form evaluate is an
 * expression-only API and silently discards args.
 *
 * MUST stay <= 50 lines. Count carefully.
 */
// Browser-context shape — only declared so the Phase-2 tool file compiles
// against a no-DOM tsconfig (Node-only types). At runtime sandboxRunner is
// serialized + executed inside Chromium where these globals resolve normally.
interface SandboxBrowserGlobals {
  document: object;
  location: object;
  history: object;
}

function sandboxRunner(args: SandboxArgs): string {
  const { userScript, returnAs } = args;
  const w = globalThis as unknown as SandboxBrowserGlobals;
  // Capture native Function BEFORE the proxy shadows it (vector e prep).
  const NativeFunction = Function;
  // Vector (a): document.cookie blocked via document Proxy
  const documentProxy = new Proxy(w.document, {
    get(t, p) { if (p === 'cookie') throw new Error('sandbox: document.cookie blocked (AC-06 a)'); const v = Reflect.get(t, p); return typeof v === 'function' ? v.bind(t) : v; },
    set(t, p, v) { if (p === 'cookie') throw new Error('sandbox: document.cookie blocked (AC-06 a)'); return Reflect.set(t, p, v); },
  });
  // Vector (d): history.pushState/replaceState blocked
  const historyProxy = new Proxy(w.history, {
    get(t, p) { if (p === 'pushState' || p === 'replaceState') return () => { throw new Error('sandbox: history.' + String(p) + ' blocked (AC-06 d)'); }; const v = Reflect.get(t, p); return typeof v === 'function' ? v.bind(t) : v; },
  });
  // windowProxy: shadow window so `window.location = X` and `window.cookie` etc.
  // route through these traps. Also returned for window/self/top/parent/frames/
  // globalThis identifier lookups (vector d aliasing).
  const windowProxy: object = new Proxy(w, {
    has() { return true; },
    get(t, p) {
      if (p === 'localStorage') throw new Error('sandbox: localStorage blocked (AC-06 b)');
      if (p === 'sessionStorage') throw new Error('sandbox: sessionStorage blocked (AC-06 b)');
      if (p === 'fetch') return () => { throw new Error('sandbox: fetch blocked (AC-06 c)'); };
      if (p === 'XMLHttpRequest') return function () { throw new Error('sandbox: XMLHttpRequest blocked (AC-06 c)'); };
      if (p === 'Function') return function () { throw new Error('sandbox: Function constructor blocked (AC-06 e)'); };
      if (p === 'eval') return function () { throw new Error('sandbox: eval blocked (AC-06 e)'); };
      if (p === 'document') return documentProxy;
      if (p === 'history') return historyProxy;
      // window self-aliases route back through the same proxy (vector d aliasing).
      if (p === 'window' || p === 'self' || p === 'top' || p === 'parent' || p === 'frames' || p === 'globalThis') return windowProxy;
      // Vector (d): location getter — return a string-like that disallows assign/replace.
      if (p === 'location') return new Proxy(w.location, { set() { throw new Error('sandbox: window.location property setter blocked (AC-06 d)'); }, get(lt, lp) { if (lp === 'assign' || lp === 'replace' || lp === 'reload') return () => { throw new Error('sandbox: window.location.' + String(lp) + ' blocked (AC-06 d)'); } ; const v = Reflect.get(lt, lp); return typeof v === 'function' ? v.bind(lt) : v; } });
      const v = Reflect.get(t, p);
      return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, p, v) {
      if (p === 'location') throw new Error('sandbox: window.location setter blocked (AC-06 d)');
      return Reflect.set(t, p, v);
    },
  });
  // F-006 (Wave-18 Stage 2.5 remediation): inject "use strict" at the START of
  // the INNER IIFE body so `this` is `undefined` inside the user script (closes
  // F-001 bypass #3 — sloppy-mode `this`-binding to real window). The OUTER
  // Function body stays sloppy because `with` is forbidden in strict mode.
  const fn = new NativeFunction('proxy', 'with(proxy) { return (function(){"use strict";' + userScript + '})(); }') as (proxy: unknown) => unknown;
  const raw = fn(windowProxy);
  if (returnAs === 'undefined') return '';
  if (returnAs === 'string') return String(raw);
  if (returnAs === 'number') return String(Number(raw));
  if (returnAs === 'boolean') return String(Boolean(raw));
  return JSON.stringify(raw);
}

interface SandboxArgs {
  userScript: string;
  returnAs: 'string' | 'number' | 'boolean' | 'json' | 'undefined';
}

export function createBrowserEvaluateTool(
  deps: BrowserEvaluateDeps,
): MCPToolDefinition<BrowserEvaluateInput, BrowserEvaluateOutput> {
  return {
    name: 'browser_evaluate', // EXACT v3.1 (R4.5)
    description:
      'Execute user JavaScript in a sandboxed page context. Blocks document.cookie, localStorage/sessionStorage, fetch/XMLHttpRequest, window.location setter/history.pushState, Function/eval (AC-06). Returns serialized result per returnAs hint (default json).',
    inputSchema: BrowserEvaluateInputSchema,
    outputSchema: BrowserEvaluateOutputSchema,
    safetyClass: 'requires_safety_check',
    handler: async (input, ctx: ToolContext): Promise<BrowserEvaluateOutput> => {
      const returnAs = input.returnAs ?? 'json';
      ctx.logger.info(
        { script_length: input.script.length, return_as: returnAs },
        'mcp.tool.browser_evaluate.start',
      );

      const args: SandboxArgs = { userScript: input.script, returnAs };
      // Pass a real function (not a string) — Playwright's string-form evaluate
      // is expression-only and discards the arg. Cast through the wrapper's
      // declared (...args: unknown[]) shape so we don't widen the public type.
      const result = await deps.session.page.evaluate<string>(
        sandboxRunner as unknown as (...fnArgs: unknown[]) => string,
        args,
      );

      ctx.logger.info(
        { result_length: result.length, return_as: returnAs },
        'mcp.tool.browser_evaluate.done',
      );
      return { ok: true, result, returnAs };
    },
  };
}

/**
 * AC-04/AC-05 — T040 browser_wait_for factory + handler conformance.
 *
 * Spec: phases/phase-2-tools/tasks.md T040; impact.md MCPToolRegistry
 *       Utility row (safetyClass = 'safe'); REQ-MCP-001 + REQ-MCP-002.
 *
 * Stub-only — no real Playwright. Integration coverage lands later in Phase 2.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  WaitForInputSchema,
  WaitForOutputSchema,
  createWaitForTool,
} from '../../src/mcp/tools/waitFor.js';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';
import type { ToolContext } from '../../src/mcp/types.js';

function stubLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  } as unknown as Logger;
}

function stubCtx(): ToolContext {
  return { logger: stubLogger(), toolCallId: 't-1', clientSessionId: 'c-1' };
}

function stubSession(
  waitForSelector: (
    sel: string,
    opts?: {
      state?: 'attached' | 'detached' | 'visible' | 'hidden';
      timeout?: number;
    },
  ) => Promise<void>,
): BrowserSession {
  return {
    id: 's-1',
    page: {
      waitForSelector,
      url: () => 'https://example.test/',
    } as unknown as BrowserSession['page'],
    context: {
      addInitScript: async () => {},
      pages: () => [],
    } as unknown as BrowserSession['context'],
    close: async () => {},
  } as unknown as BrowserSession;
}

describe('T040 browser_wait_for factory — AC-04/AC-05', () => {
  it('exposes EXACT name + safe', () => {
    const tool = createWaitForTool({ session: stubSession(async () => {}) });
    expect(tool.name).toBe('browser_wait_for');
    expect(tool.safetyClass).toBe('safe');
  });

  it('inputSchema accepts both kinds with appropriate fields', () => {
    expect(
      WaitForInputSchema.safeParse({ kind: 'selector', selector: '#cta' }).success,
    ).toBe(true);
    expect(
      WaitForInputSchema.safeParse({
        kind: 'selector',
        selector: '#cta',
        state: 'visible',
        timeout: 5000,
      }).success,
    ).toBe(true);
    expect(
      WaitForInputSchema.safeParse({
        kind: 'selector',
        selector: '#x',
        state: 'attached',
      }).success,
    ).toBe(true);
    expect(WaitForInputSchema.safeParse({ kind: 'timeout', ms: 100 }).success).toBe(true);
    expect(WaitForInputSchema.safeParse({ kind: 'timeout', ms: 30000 }).success).toBe(true);
  });

  it('inputSchema rejects bad shapes', () => {
    // missing kind
    expect(WaitForInputSchema.safeParse({ selector: '#x' }).success).toBe(false);
    // bad state enum
    expect(
      WaitForInputSchema.safeParse({
        kind: 'selector',
        selector: '#x',
        state: 'bogus',
      }).success,
    ).toBe(false);
    // ms > 30000
    expect(WaitForInputSchema.safeParse({ kind: 'timeout', ms: 30001 }).success).toBe(false);
    // selector variant missing selector
    expect(WaitForInputSchema.safeParse({ kind: 'selector' }).success).toBe(false);
    // timeout variant missing ms
    expect(WaitForInputSchema.safeParse({ kind: 'timeout' }).success).toBe(false);
    // empty selector
    expect(
      WaitForInputSchema.safeParse({ kind: 'selector', selector: '' }).success,
    ).toBe(false);
    // unknown keys (strict)
    expect(
      WaitForInputSchema.safeParse({
        kind: 'selector',
        selector: '#x',
        extra: 1,
      }).success,
    ).toBe(false);
    expect(
      WaitForInputSchema.safeParse({ kind: 'timeout', ms: 50, extra: 1 }).success,
    ).toBe(false);
    // ms must be positive integer
    expect(WaitForInputSchema.safeParse({ kind: 'timeout', ms: 0 }).success).toBe(false);
    expect(WaitForInputSchema.safeParse({ kind: 'timeout', ms: 1.5 }).success).toBe(false);
  });

  it('outputSchema requires kind discriminant + elapsedMs', () => {
    expect(
      WaitForOutputSchema.safeParse({ ok: true, kind: 'selector', elapsedMs: 0 }).success,
    ).toBe(true);
    expect(
      WaitForOutputSchema.safeParse({ ok: true, kind: 'timeout', elapsedMs: 42 }).success,
    ).toBe(true);
    // ok must be literal true
    expect(
      WaitForOutputSchema.safeParse({ ok: false, kind: 'timeout', elapsedMs: 1 }).success,
    ).toBe(false);
    // bad kind
    expect(
      WaitForOutputSchema.safeParse({ ok: true, kind: 'other', elapsedMs: 0 }).success,
    ).toBe(false);
    // negative elapsedMs
    expect(
      WaitForOutputSchema.safeParse({ ok: true, kind: 'timeout', elapsedMs: -1 }).success,
    ).toBe(false);
  });

  it('handler "selector" calls page.waitForSelector with present-only opts', async () => {
    const spy = vi.fn(async () => {});
    const tool = createWaitForTool({ session: stubSession(spy) });
    const out = await tool.handler(
      { kind: 'selector', selector: '#cta', state: 'visible', timeout: 5000 },
      stubCtx(),
    );
    expect(spy).toHaveBeenCalledWith('#cta', { state: 'visible', timeout: 5000 });
    expect(out.ok).toBe(true);
    expect(out.kind).toBe('selector');
    expect(out.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('handler "selector" omits undefined state + timeout (exactOptionalPropertyTypes-safe)', async () => {
    const spy = vi.fn(async () => {});
    const tool = createWaitForTool({ session: stubSession(spy) });
    await tool.handler({ kind: 'selector', selector: '#cta' }, stubCtx());
    expect(spy).toHaveBeenCalledWith('#cta', {});
  });

  it('handler "timeout" sleeps ms and reports elapsedMs', async () => {
    const spy = vi.fn(async () => {});
    const tool = createWaitForTool({ session: stubSession(spy) });
    const out = await tool.handler({ kind: 'timeout', ms: 10 }, stubCtx());
    expect(spy).not.toHaveBeenCalled();
    expect(out.ok).toBe(true);
    expect(out.kind).toBe('timeout');
    // Some slack for timer precision (~9 ms lower bound on Windows).
    expect(out.elapsedMs).toBeGreaterThanOrEqual(9);
  });
});

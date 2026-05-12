/**
 * AC-05 — T020 browser_navigate factory + handler conformance.
 *
 * Spec: phases/phase-2-tools/tasks.md T020; plan.md per-tool template;
 *       impact.md MCPToolRegistry safetyClass table.
 *
 * Stub-only — no real Playwright. Integration coverage lands at T050.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  createNavigateTool,
  NavigateInputSchema,
  NavigateOutputSchema,
} from '../../src/mcp/tools/navigate.js';
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
  goto: (url: string, opts?: unknown) => Promise<void>,
): BrowserSession {
  return {
    id: 'sess-1',
    page: { goto } as unknown as BrowserSession['page'],
    context: {
      addInitScript: async () => {},
      pages: () => [],
    } as unknown as BrowserSession['context'],
    close: async () => {},
  };
}

describe('T020 browser_navigate factory — AC-05', () => {
  it('exposes EXACT v3.1 name and safe classification', () => {
    const tool = createNavigateTool({ session: stubSession(async () => {}) });
    expect(tool.name).toBe('browser_navigate');
    expect(tool.safetyClass).toBe('safe');
  });

  it('inputSchema rejects malformed url + accepts valid url', () => {
    expect(NavigateInputSchema.safeParse({ url: 'not-a-url' }).success).toBe(false);
    expect(NavigateInputSchema.safeParse({}).success).toBe(false);
    expect(NavigateInputSchema.safeParse({ url: 'https://amazon.in/' }).success).toBe(true);
    expect(
      NavigateInputSchema.safeParse({
        url: 'https://amazon.in/',
        waitUntil: 'load',
        timeout: 30000,
      }).success,
    ).toBe(true);
  });

  it('outputSchema requires url', () => {
    expect(NavigateOutputSchema.safeParse({}).success).toBe(false);
    expect(NavigateOutputSchema.safeParse({ url: 'https://amazon.in/' }).success).toBe(true);
  });

  it('handler calls session.page.goto with url + opts and returns { url }', async () => {
    const goto = vi.fn(async (_url: string, _opts?: unknown) => {});
    const tool = createNavigateTool({ session: stubSession(goto) });
    const ctx = stubCtx();
    const out = await tool.handler(
      { url: 'https://amazon.in/', waitUntil: 'networkidle', timeout: 15000 },
      ctx,
    );
    expect(goto).toHaveBeenCalledWith('https://amazon.in/', {
      waitUntil: 'networkidle',
      timeout: 15000,
    });
    expect(out).toEqual({ url: 'https://amazon.in/' });
    expect(ctx.logger.info).toHaveBeenCalledTimes(2);
  });

  it('handler omits undefined waitUntil/timeout (exactOptionalPropertyTypes-safe)', async () => {
    const goto = vi.fn(async () => {});
    const tool = createNavigateTool({ session: stubSession(goto) });
    await tool.handler({ url: 'https://amazon.in/' }, stubCtx());
    expect(goto).toHaveBeenCalledWith('https://amazon.in/', {});
  });
});

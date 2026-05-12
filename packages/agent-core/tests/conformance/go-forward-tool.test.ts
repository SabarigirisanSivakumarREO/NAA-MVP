/**
 * AC-05 — T022 browser_go_forward factory + handler conformance.
 *
 * Spec: phases/phase-2-tools/tasks.md T022; plan.md per-tool template;
 *       impact.md MCPToolRegistry safetyClass table.
 *
 * Stub-only — no real Playwright. Integration coverage lands at T050.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  createGoForwardTool,
  GoForwardInputSchema,
  GoForwardOutputSchema,
} from '../../src/mcp/tools/goForward.js';
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
  goForward: (opts?: unknown) => Promise<void>,
): BrowserSession {
  return {
    id: 'sess-1',
    page: { goForward } as unknown as BrowserSession['page'],
    context: {
      addInitScript: async () => {},
      pages: () => [],
    } as unknown as BrowserSession['context'],
    close: async () => {},
  };
}

describe('T022 browser_go_forward factory — AC-05', () => {
  it('exposes EXACT v3.1 name and safe classification', () => {
    const tool = createGoForwardTool({ session: stubSession(async () => {}) });
    expect(tool.name).toBe('browser_go_forward');
    expect(tool.safetyClass).toBe('safe');
  });

  it('inputSchema accepts empty + valid opts; rejects bad enum + non-positive timeout + unknown keys', () => {
    expect(GoForwardInputSchema.safeParse({}).success).toBe(true);
    expect(GoForwardInputSchema.safeParse({ waitUntil: 'domcontentloaded' }).success).toBe(true);
    expect(
      GoForwardInputSchema.safeParse({ waitUntil: 'load', timeout: 5000 }).success,
    ).toBe(true);
    expect(GoForwardInputSchema.safeParse({ waitUntil: 'never' }).success).toBe(false);
    expect(GoForwardInputSchema.safeParse({ timeout: -1 }).success).toBe(false);
    expect(GoForwardInputSchema.safeParse({ timeout: 1.5 }).success).toBe(false);
    expect(GoForwardInputSchema.safeParse({ extraKey: true }).success).toBe(false);
  });

  it('outputSchema requires ok: true literal', () => {
    expect(GoForwardOutputSchema.safeParse({}).success).toBe(false);
    expect(GoForwardOutputSchema.safeParse({ ok: false }).success).toBe(false);
    expect(GoForwardOutputSchema.safeParse({ ok: true }).success).toBe(true);
  });

  it('handler invokes page.goForward with assembled opts and returns { ok: true }', async () => {
    const goForward = vi.fn(async (_opts?: unknown) => {});
    const tool = createGoForwardTool({ session: stubSession(goForward) });
    const ctx = stubCtx();
    const out = await tool.handler(
      { waitUntil: 'networkidle', timeout: 10000 },
      ctx,
    );
    expect(goForward).toHaveBeenCalledWith({
      waitUntil: 'networkidle',
      timeout: 10000,
    });
    expect(out).toEqual({ ok: true });
    expect(ctx.logger.info).toHaveBeenCalledTimes(2);
  });

  it('handler omits undefined opts (exactOptionalPropertyTypes-safe)', async () => {
    const goForward = vi.fn(async () => {});
    const tool = createGoForwardTool({ session: stubSession(goForward) });
    await tool.handler({}, stubCtx());
    expect(goForward).toHaveBeenCalledWith({});
  });
});

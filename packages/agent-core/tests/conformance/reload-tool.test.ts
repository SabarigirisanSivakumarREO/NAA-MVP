/**
 * AC-05 — T023 browser_reload factory + handler conformance.
 *
 * Spec: phases/phase-2-tools/tasks.md T023; plan.md per-tool template;
 *       impact.md MCPToolRegistry safetyClass table.
 *
 * Stub-only — no real Playwright. Integration coverage lands at T050.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  createReloadTool,
  ReloadInputSchema,
  ReloadOutputSchema,
} from '../../src/mcp/tools/reload.js';
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
  reload: (opts?: unknown) => Promise<void>,
): BrowserSession {
  return {
    id: 'sess-1',
    page: { reload } as unknown as BrowserSession['page'],
    context: {
      addInitScript: async () => {},
      pages: () => [],
    } as unknown as BrowserSession['context'],
    close: async () => {},
  };
}

describe('T023 browser_reload factory — AC-05', () => {
  it('exposes EXACT v3.1 name and safe classification', () => {
    const tool = createReloadTool({ session: stubSession(async () => {}) });
    expect(tool.name).toBe('browser_reload');
    expect(tool.safetyClass).toBe('safe');
  });

  it('inputSchema accepts empty + valid opts; rejects bad enum + non-positive timeout + unknown keys', () => {
    expect(ReloadInputSchema.safeParse({}).success).toBe(true);
    expect(ReloadInputSchema.safeParse({ waitUntil: 'load' }).success).toBe(true);
    expect(
      ReloadInputSchema.safeParse({ waitUntil: 'load', timeout: 5000 }).success,
    ).toBe(true);
    expect(ReloadInputSchema.safeParse({ waitUntil: 'never' }).success).toBe(false);
    expect(ReloadInputSchema.safeParse({ timeout: -1 }).success).toBe(false);
    expect(ReloadInputSchema.safeParse({ timeout: 1.5 }).success).toBe(false);
    expect(ReloadInputSchema.safeParse({ extraKey: true }).success).toBe(false);
  });

  it('outputSchema requires ok: true literal', () => {
    expect(ReloadOutputSchema.safeParse({}).success).toBe(false);
    expect(ReloadOutputSchema.safeParse({ ok: false }).success).toBe(false);
    expect(ReloadOutputSchema.safeParse({ ok: true }).success).toBe(true);
  });

  it('handler invokes page.reload with assembled opts and returns { ok: true }', async () => {
    const reload = vi.fn(async (_opts?: unknown) => {});
    const tool = createReloadTool({ session: stubSession(reload) });
    const ctx = stubCtx();
    const out = await tool.handler(
      { waitUntil: 'networkidle', timeout: 10000 },
      ctx,
    );
    expect(reload).toHaveBeenCalledWith({
      waitUntil: 'networkidle',
      timeout: 10000,
    });
    expect(out).toEqual({ ok: true });
    expect(ctx.logger.info).toHaveBeenCalledTimes(2);
  });

  it('handler omits undefined opts (exactOptionalPropertyTypes-safe)', async () => {
    const reload = vi.fn(async () => {});
    const tool = createReloadTool({ session: stubSession(reload) });
    await tool.handler({}, stubCtx());
    expect(reload).toHaveBeenCalledWith({});
  });
});

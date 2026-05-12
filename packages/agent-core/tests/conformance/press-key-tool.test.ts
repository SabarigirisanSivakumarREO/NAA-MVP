/**
 * AC-04/AC-05 — T033 browser_press_key factory + handler conformance.
 *
 * Spec: phases/phase-2-tools/tasks.md T033; impact.md MCPToolRegistry
 *       Interaction row (safetyClass = 'requires_safety_check');
 *       REQ-MCP-001 + REQ-MCP-002.
 *
 * Stub-only — no real Playwright. Integration coverage lands at T050.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  PressKeyInputSchema,
  PressKeyOutputSchema,
  createPressKeyTool,
} from '../../src/mcp/tools/pressKey.js';
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
  press: (key: string, opts?: { delay?: number }) => Promise<void>,
): BrowserSession {
  return {
    id: 's-1',
    page: {
      keyboard: {
        type: async () => {},
        press,
      },
    } as unknown as BrowserSession['page'],
    context: {
      addInitScript: async () => {},
      pages: () => [],
    } as unknown as BrowserSession['context'],
    close: async () => {},
  };
}

describe('T033 browser_press_key factory — AC-04/AC-05', () => {
  it('exposes EXACT name + requires_safety_check', () => {
    const tool = createPressKeyTool({ session: stubSession(async () => {}) });
    expect(tool.name).toBe('browser_press_key');
    expect(tool.safetyClass).toBe('requires_safety_check');
  });

  it('inputSchema accepts valid keys + rejects empty/missing/negative-delay/unknown', () => {
    expect(PressKeyInputSchema.safeParse({ key: 'Enter' }).success).toBe(true);
    expect(PressKeyInputSchema.safeParse({ key: 'a' }).success).toBe(true);
    expect(PressKeyInputSchema.safeParse({ key: 'Shift+A', delay: 50 }).success).toBe(true);
    expect(PressKeyInputSchema.safeParse({}).success).toBe(false);
    expect(PressKeyInputSchema.safeParse({ key: '' }).success).toBe(false);
    expect(PressKeyInputSchema.safeParse({ key: 'a', delay: -1 }).success).toBe(false);
    expect(PressKeyInputSchema.safeParse({ key: 'a', extra: 1 }).success).toBe(false);
  });

  it('outputSchema requires { ok: true, key: string }', () => {
    expect(PressKeyOutputSchema.safeParse({ ok: true, key: 'Enter' }).success).toBe(true);
    expect(PressKeyOutputSchema.safeParse({ ok: false, key: 'Enter' }).success).toBe(false);
    expect(PressKeyOutputSchema.safeParse({ ok: true }).success).toBe(false);
  });

  it('handler invokes keyboard.press with key + opts and echoes', async () => {
    const pressSpy = vi.fn(async () => {});
    const tool = createPressKeyTool({ session: stubSession(pressSpy) });
    const out = await tool.handler({ key: 'Enter', delay: 30 }, stubCtx());
    expect(pressSpy).toHaveBeenCalledWith('Enter', { delay: 30 });
    expect(out).toEqual({ ok: true, key: 'Enter' });
  });

  it('handler omits undefined delay (exactOptionalPropertyTypes-safe)', async () => {
    const pressSpy = vi.fn(async () => {});
    const tool = createPressKeyTool({ session: stubSession(pressSpy) });
    await tool.handler({ key: 'Tab' }, stubCtx());
    expect(pressSpy).toHaveBeenCalledWith('Tab', {});
  });
});

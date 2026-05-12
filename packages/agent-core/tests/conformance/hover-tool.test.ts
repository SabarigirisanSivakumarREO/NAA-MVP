/**
 * AC-04/AC-05 — T032 browser_hover factory + handler conformance.
 *
 * Spec: phases/phase-2-tools/tasks.md T032; impact.md MCPToolRegistry
 *       Motion row (safetyClass = 'safe'); REQ-BROWSE-HUMAN-001/002
 *       (MouseBehavior.move dispatch — NOT click).
 *
 * Stub-only — no real Playwright, no real MouseBehavior. Integration
 * coverage lands at T050.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  HoverInputSchema,
  HoverOutputSchema,
  HoverTargetNotFoundError,
  createHoverTool,
} from '../../src/mcp/tools/hover.js';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';
import { mouseBehavior } from '../../src/browser-runtime/MouseBehavior.js';
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
  evaluate: (fn: string, ...args: unknown[]) => Promise<unknown>,
): BrowserSession {
  return {
    id: 's-1',
    page: {
      evaluate,
      url: () => 'https://example.test/',
    } as unknown as BrowserSession['page'],
    context: {
      addInitScript: async () => {},
      pages: () => [],
    } as unknown as BrowserSession['context'],
    close: async () => {},
  };
}

describe('T032 browser_hover factory — AC-04/AC-05', () => {
  it('exposes EXACT v3.1 name and safe classification', () => {
    const tool = createHoverTool({
      session: stubSession(async () => null),
      mouse: {
        move: async () => {},
        click: async () => {},
      } as unknown as typeof mouseBehavior,
    });
    expect(tool.name).toBe('browser_hover');
    expect(tool.safetyClass).toBe('safe');
  });

  it('inputSchema rejects missing/empty selector + unknown keys; accepts valid', () => {
    expect(HoverInputSchema.safeParse({}).success).toBe(false);
    expect(HoverInputSchema.safeParse({ selector: '' }).success).toBe(false);
    expect(HoverInputSchema.safeParse({ selector: '.menu-item' }).success).toBe(
      true,
    );
    expect(
      HoverInputSchema.safeParse({ selector: '.menu-item', extra: 1 }).success,
    ).toBe(false);
  });

  it('outputSchema requires { ok: true, x: number, y: number }', () => {
    expect(HoverOutputSchema.safeParse({ ok: true, x: 1, y: 2 }).success).toBe(
      true,
    );
    expect(HoverOutputSchema.safeParse({ ok: false, x: 1, y: 2 }).success).toBe(
      false,
    );
    expect(HoverOutputSchema.safeParse({ ok: true, x: 1 }).success).toBe(false);
  });

  it('handler resolves bbox via single evaluate call, dispatches mouse.MOVE at center, returns coords', async () => {
    const evalSpy = vi.fn(async () => ({
      x: 200,
      y: 100,
      width: 80,
      height: 40,
    }));
    const moveSpy = vi.fn(async () => {});
    const clickSpy = vi.fn(async () => {});
    const tool = createHoverTool({
      session: stubSession(evalSpy),
      mouse: {
        move: moveSpy,
        click: clickSpy,
      } as unknown as typeof mouseBehavior,
    });
    const out = await tool.handler({ selector: '.menu-item' }, stubCtx());
    expect(evalSpy).toHaveBeenCalledTimes(1);
    // Center of (200, 100, 80, 40) is (240, 120)
    expect(moveSpy).toHaveBeenCalledWith(expect.anything(), { x: 240, y: 120 });
    // CRITICAL: hover MUST NOT click
    expect(clickSpy).not.toHaveBeenCalled();
    expect(out).toEqual({ ok: true, x: 240, y: 120 });
  });

  it('handler throws HoverTargetNotFoundError when evaluate returns null', async () => {
    const tool = createHoverTool({
      session: stubSession(async () => null),
      mouse: {
        move: async () => {},
        click: async () => {},
      } as unknown as typeof mouseBehavior,
    });
    await expect(
      tool.handler({ selector: '.missing' }, stubCtx()),
    ).rejects.toBeInstanceOf(HoverTargetNotFoundError);
  });
});

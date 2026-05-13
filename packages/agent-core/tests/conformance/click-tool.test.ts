/**
 * AC-04/AC-05 — T027 browser_click factory + handler conformance.
 *
 * Spec: phases/phase-2-tools/tasks.md T027; impact.md MCPToolRegistry
 *       Interaction row (safetyClass = 'requires_safety_check');
 *       REQ-BROWSE-HUMAN-001/002 (MouseBehavior dispatch).
 *
 * Stub-only — no real Playwright, no real MouseBehavior. Integration
 * coverage lands at T050.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  ClickInputSchema,
  ClickOutputSchema,
  ClickTargetNotFoundError,
  createClickTool,
} from '../../src/mcp/tools/click.js';
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

describe('T027 browser_click factory — AC-04/AC-05', () => {
  it('exposes EXACT v3.1 name and requires_safety_check classification', () => {
    const tool = createClickTool({
      session: stubSession(async () => null),
      mouse: { click: async () => {} } as unknown as typeof mouseBehavior,
    });
    expect(tool.name).toBe('browser_click');
    expect(tool.safetyClass).toBe('requires_safety_check');
  });

  it('inputSchema rejects missing/empty selector + unknown keys; accepts valid', () => {
    expect(ClickInputSchema.safeParse({}).success).toBe(false);
    expect(ClickInputSchema.safeParse({ selector: '' }).success).toBe(false);
    expect(ClickInputSchema.safeParse({ selector: '.cta' }).success).toBe(true);
    expect(
      ClickInputSchema.safeParse({ selector: '.cta', extra: true }).success,
    ).toBe(false);
  });

  it('outputSchema requires { ok: true, x: number, y: number }', () => {
    expect(ClickOutputSchema.safeParse({ ok: true, x: 100, y: 50 }).success).toBe(
      true,
    );
    expect(
      ClickOutputSchema.safeParse({ ok: false, x: 100, y: 50 }).success,
    ).toBe(false);
    expect(ClickOutputSchema.safeParse({ ok: true, x: 100 }).success).toBe(false);
  });

  it('handler resolves bbox via single evaluate call, dispatches mouse.click at center, returns coords', async () => {
    const evalSpy = vi.fn(async () => ({
      x: 200,
      y: 100,
      width: 80,
      height: 40,
    }));
    const clickSpy = vi.fn(async () => {});
    const tool = createClickTool({
      session: stubSession(evalSpy),
      mouse: { click: clickSpy } as unknown as typeof mouseBehavior,
    });
    const out = await tool.handler({ selector: '.cta' }, stubCtx());
    expect(evalSpy).toHaveBeenCalledTimes(1);
    // Center of (200, 100, 80, 40) is (240, 120)
    expect(clickSpy).toHaveBeenCalledWith(expect.anything(), { x: 240, y: 120 });
    expect(out).toEqual({ ok: true, x: 240, y: 120 });
  });

  it('handler throws ClickTargetNotFoundError when evaluate returns null', async () => {
    const tool = createClickTool({
      session: stubSession(async () => null),
      mouse: { click: async () => {} } as unknown as typeof mouseBehavior,
    });
    await expect(
      tool.handler({ selector: '.missing' }, stubCtx()),
    ).rejects.toBeInstanceOf(ClickTargetNotFoundError);
  });
});

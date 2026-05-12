/**
 * AC-04/AC-05 — T028 browser_click_coords factory + handler conformance.
 *
 * Spec: phases/phase-2-tools/tasks.md T028; impact.md MCPToolRegistry
 *       Interaction row (safetyClass = 'requires_safety_check');
 *       REQ-BROWSE-HUMAN-001/002 (MouseBehavior dispatch).
 *
 * Stub-only — no real Playwright, no real MouseBehavior. Integration
 * coverage lands at T050.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  ClickCoordsInputSchema,
  ClickCoordsOutputSchema,
  createClickCoordsTool,
} from '../../src/mcp/tools/clickCoords.js';
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

function stubSession(): BrowserSession {
  return {
    id: 's-1',
    page: {
      url: () => 'https://example.test/',
    } as unknown as BrowserSession['page'],
    context: {
      addInitScript: async () => {},
      pages: () => [],
    } as unknown as BrowserSession['context'],
    close: async () => {},
  };
}

describe('T028 browser_click_coords factory — AC-04/AC-05', () => {
  it('exposes EXACT v3.1 name and requires_safety_check classification', () => {
    const tool = createClickCoordsTool({
      session: stubSession(),
      mouse: { click: async () => {} } as unknown as typeof mouseBehavior,
    });
    expect(tool.name).toBe('browser_click_coords');
    expect(tool.safetyClass).toBe('requires_safety_check');
  });

  it('inputSchema requires finite x + y; rejects missing, non-finite, and extras', () => {
    expect(ClickCoordsInputSchema.safeParse({ x: 100, y: 50 }).success).toBe(true);
    expect(ClickCoordsInputSchema.safeParse({ x: 100 }).success).toBe(false);
    expect(ClickCoordsInputSchema.safeParse({ x: 100, y: Infinity }).success).toBe(
      false,
    );
    expect(ClickCoordsInputSchema.safeParse({ x: 100, y: NaN }).success).toBe(false);
    expect(
      ClickCoordsInputSchema.safeParse({ x: 100, y: 50, extra: true }).success,
    ).toBe(false);
  });

  it('outputSchema requires { ok: true, x: number, y: number }', () => {
    expect(ClickCoordsOutputSchema.safeParse({ ok: true, x: 1, y: 2 }).success).toBe(
      true,
    );
    expect(
      ClickCoordsOutputSchema.safeParse({ ok: false, x: 1, y: 2 }).success,
    ).toBe(false);
    expect(ClickCoordsOutputSchema.safeParse({ ok: true, x: 1 }).success).toBe(false);
  });

  it('handler invokes mouse.click with the bound session.page and echoes coords', async () => {
    const clickSpy = vi.fn(async () => {});
    const session = stubSession();
    const tool = createClickCoordsTool({
      session,
      mouse: { click: clickSpy } as unknown as typeof mouseBehavior,
    });
    const out = await tool.handler({ x: 240, y: 120 }, stubCtx());
    expect(clickSpy).toHaveBeenCalledWith(session.page, { x: 240, y: 120 });
    expect(out).toEqual({ ok: true, x: 240, y: 120 });
  });
});

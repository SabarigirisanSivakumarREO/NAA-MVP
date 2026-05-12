/**
 * AC-04/AC-05 — T030 browser_scroll factory + handler conformance.
 *
 * Spec: phases/phase-2-tools/tasks.md T030; impact.md MCPToolRegistry
 *       Motion row (safetyClass = 'safe'); REQ-MCP-001 + REQ-MCP-002.
 *
 * Stub-only — no real Playwright, no real ScrollBehavior. Integration
 * coverage lands at T050.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  ScrollInputSchema,
  ScrollOutputSchema,
  createScrollTool,
} from '../../src/mcp/tools/scroll.js';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';
import { scrollBehavior } from '../../src/browser-runtime/ScrollBehavior.js';
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

describe('T030 browser_scroll factory — AC-04/AC-05', () => {
  it('exposes EXACT name + safe', () => {
    const tool = createScrollTool({
      session: stubSession(),
      scroll: { scroll: async () => {} } as unknown as typeof scrollBehavior,
    });
    expect(tool.name).toBe('browser_scroll');
    expect(tool.safetyClass).toBe('safe');
  });

  it('inputSchema rejects bad direction, non-positive distance, distance > 5000, unknown keys', () => {
    expect(
      ScrollInputSchema.safeParse({ direction: 'down', distancePx: 1000 }).success,
    ).toBe(true);
    expect(
      ScrollInputSchema.safeParse({ direction: 'sideways', distancePx: 100 }).success,
    ).toBe(false);
    expect(
      ScrollInputSchema.safeParse({ direction: 'down', distancePx: 0 }).success,
    ).toBe(false);
    expect(
      ScrollInputSchema.safeParse({ direction: 'down', distancePx: 5001 }).success,
    ).toBe(false);
    expect(
      ScrollInputSchema.safeParse({ direction: 'down', distancePx: 100, extra: 1 })
        .success,
    ).toBe(false);
  });

  it('outputSchema requires { ok: true, direction, distancePx }', () => {
    expect(
      ScrollOutputSchema.safeParse({ ok: true, direction: 'down', distancePx: 500 })
        .success,
    ).toBe(true);
    expect(
      ScrollOutputSchema.safeParse({ ok: false, direction: 'down', distancePx: 500 })
        .success,
    ).toBe(false);
    expect(ScrollOutputSchema.safeParse({ ok: true, direction: 'down' }).success).toBe(
      false,
    );
  });

  it('handler delegates with present-only opts and echoes coords', async () => {
    const scrollSpy = vi.fn(async () => {});
    const session = stubSession();
    const tool = createScrollTool({
      session,
      scroll: { scroll: scrollSpy } as unknown as typeof scrollBehavior,
    });
    const out = await tool.handler(
      { direction: 'down', distancePx: 800, velocityFactor: 1.5 },
      stubCtx(),
    );
    const [page, dir, dist, opts] = scrollSpy.mock.calls[0]!;
    expect(page).toBe(session.page);
    expect(dir).toBe('down');
    expect(dist).toBe(800);
    expect(opts).toMatchObject({
      velocityFactor: 1.5,
      tool_name: 'browser_scroll',
      tool_call_id: 't-1',
      client_session_id: 'c-1',
    });
    expect(opts).not.toHaveProperty('frameMs'); // omitted when undefined
    expect(out).toEqual({ ok: true, direction: 'down', distancePx: 800 });
  });
});

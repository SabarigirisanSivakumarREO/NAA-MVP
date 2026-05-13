/**
 * AC-04/AC-05 — T031 browser_select factory + handler conformance.
 *
 * Spec: phases/phase-2-tools/tasks.md T031; impact.md MCPToolRegistry
 *       Interaction row (safetyClass = 'requires_safety_check');
 *       REQ-MCP-001 + REQ-MCP-002.
 *
 * Stub-only — no real Playwright. Integration coverage lands later in Phase 2.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  SelectInputSchema,
  SelectOutputSchema,
  createSelectTool,
} from '../../src/mcp/tools/select.js';
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
  selectOption: (
    sel: string,
    vals: string | readonly string[],
    opts?: { timeout?: number },
  ) => Promise<readonly string[]>,
): BrowserSession {
  return {
    id: 's-1',
    page: {
      selectOption,
      url: () => 'https://example.test/',
    } as unknown as BrowserSession['page'],
    context: {
      addInitScript: async () => {},
      pages: () => [],
    } as unknown as BrowserSession['context'],
    close: async () => {},
  };
}

describe('T031 browser_select factory — AC-04/AC-05', () => {
  it('exposes EXACT name + requires_safety_check', () => {
    const tool = createSelectTool({ session: stubSession(async () => []) });
    expect(tool.name).toBe('browser_select');
    expect(tool.safetyClass).toBe('requires_safety_check');
  });

  it('inputSchema accepts string + array values; rejects empty array + missing selector + unknown', () => {
    expect(SelectInputSchema.safeParse({ selector: '#country', values: 'IN' }).success).toBe(true);
    expect(SelectInputSchema.safeParse({ selector: '#tags', values: ['a', 'b'] }).success).toBe(
      true,
    );
    expect(SelectInputSchema.safeParse({ selector: '#tags', values: [] }).success).toBe(false);
    expect(SelectInputSchema.safeParse({ values: 'IN' }).success).toBe(false);
    expect(
      SelectInputSchema.safeParse({ selector: '#x', values: 'a', extra: 1 }).success,
    ).toBe(false);
  });

  it('outputSchema requires { ok: true, selected: string[] }', () => {
    expect(SelectOutputSchema.safeParse({ ok: true, selected: [] }).success).toBe(true);
    expect(SelectOutputSchema.safeParse({ ok: true, selected: ['IN'] }).success).toBe(true);
    expect(SelectOutputSchema.safeParse({ ok: false, selected: ['IN'] }).success).toBe(false);
  });

  it('handler delegates to page.selectOption with present-only opts and echoes result', async () => {
    const selectSpy = vi.fn(async () => ['IN'] as readonly string[]);
    const tool = createSelectTool({ session: stubSession(selectSpy) });
    const out = await tool.handler(
      { selector: '#country', values: 'IN', timeout: 5000 },
      stubCtx(),
    );
    expect(selectSpy).toHaveBeenCalledWith('#country', 'IN', { timeout: 5000 });
    expect(out).toEqual({ ok: true, selected: ['IN'] });
  });

  it('handler omits timeout when undefined (exactOptionalPropertyTypes-safe)', async () => {
    const selectSpy = vi.fn(async () => [] as readonly string[]);
    const tool = createSelectTool({ session: stubSession(selectSpy) });
    await tool.handler({ selector: '#country', values: 'IN' }, stubCtx());
    expect(selectSpy).toHaveBeenCalledWith('#country', 'IN', {});
  });
});

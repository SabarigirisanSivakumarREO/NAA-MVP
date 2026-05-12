/**
 * T035 browser_tab_manage conformance — AC-04/AC-05 + REQ-MCP-001/REQ-MCP-002.
 *
 * Validates the factory shape (EXACT name + safetyClass='safe'), Zod input
 * boundary (4-action enum, refine() for switch/close required-index, strict
 * unknown-key rejection, non-negative integer index), output schema per
 * action (newIndex only present for 'new'), and per-action handler dispatch
 * (list/new/switch/close → respective BrowserSession multi-tab methods).
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  TabManageInputSchema,
  TabManageOutputSchema,
  createTabManageTool,
} from '../../src/mcp/tools/tabManage.js';
import type { BrowserSession, BrowserPage } from '../../src/adapters/BrowserEngine.js';
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

function mkPage(url: string): BrowserPage {
  return { url: () => url } as unknown as BrowserPage;
}

function stubSession(opts: {
  pages: BrowserPage[];
  activeIndex: number;
  newPage?: () => Promise<number>;
  setActiveIndex?: (i: number) => void;
  closePage?: (i: number) => Promise<void>;
}): BrowserSession {
  let active = opts.activeIndex;
  const session = {
    id: 's-1',
    get page() {
      return opts.pages[active] as BrowserPage;
    },
    pages: () => opts.pages,
    activeIndex: () => active,
    setActiveIndex: (i: number) => {
      if (opts.setActiveIndex) opts.setActiveIndex(i);
      active = i;
    },
    newPage: opts.newPage ?? (async () => opts.pages.length - 1),
    closePage: opts.closePage ?? (async () => {}),
    context: {
      addInitScript: async () => {},
      pages: () => opts.pages,
    },
    close: async () => {},
  } as unknown as BrowserSession;
  return session;
}

describe('T035 browser_tab_manage factory — AC-04/AC-05', () => {
  it('exposes EXACT name + safe', () => {
    const tool = createTabManageTool({
      session: stubSession({ pages: [mkPage('about:blank')], activeIndex: 0 }),
    });
    expect(tool.name).toBe('browser_tab_manage');
    expect(tool.safetyClass).toBe('safe');
  });

  it('inputSchema accepts 4 actions; rejects switch/close without index, bad enum, unknown keys', () => {
    expect(TabManageInputSchema.safeParse({ action: 'list' }).success).toBe(true);
    expect(TabManageInputSchema.safeParse({ action: 'new' }).success).toBe(true);
    expect(TabManageInputSchema.safeParse({ action: 'switch', index: 1 }).success).toBe(true);
    expect(TabManageInputSchema.safeParse({ action: 'close', index: 0 }).success).toBe(true);
    expect(TabManageInputSchema.safeParse({ action: 'switch' }).success).toBe(false); // missing index
    expect(TabManageInputSchema.safeParse({ action: 'close' }).success).toBe(false); // missing index
    expect(TabManageInputSchema.safeParse({ action: 'unknown' }).success).toBe(false);
    expect(TabManageInputSchema.safeParse({ action: 'list', extra: 1 }).success).toBe(false);
    expect(TabManageInputSchema.safeParse({ action: 'switch', index: -1 }).success).toBe(false);
  });

  it('outputSchema accepts all action shapes', () => {
    expect(
      TabManageOutputSchema.safeParse({
        ok: true,
        action: 'list',
        activeIndex: 0,
        tabs: [{ index: 0, url: 'about:blank', isActive: true }],
      }).success,
    ).toBe(true);
    expect(
      TabManageOutputSchema.safeParse({
        ok: true,
        action: 'new',
        activeIndex: 0,
        tabs: [
          { index: 0, url: 'about:blank', isActive: true },
          { index: 1, url: 'about:blank', isActive: false },
        ],
        newIndex: 1,
      }).success,
    ).toBe(true);
  });

  it('handler "list" returns tab summary without state change', async () => {
    const session = stubSession({
      pages: [mkPage('https://a/'), mkPage('https://b/')],
      activeIndex: 0,
    });
    const tool = createTabManageTool({ session });
    const out = await tool.handler({ action: 'list' }, stubCtx());
    expect(out).toMatchObject({ ok: true, action: 'list', activeIndex: 0 });
    expect(out.tabs).toHaveLength(2);
    expect(out.tabs[0]).toMatchObject({ index: 0, url: 'https://a/', isActive: true });
    expect(out.tabs[1]).toMatchObject({ index: 1, url: 'https://b/', isActive: false });
  });

  it('handler "new" calls session.newPage and returns new index', async () => {
    const newPageSpy = vi.fn(async () => 1);
    const pages = [mkPage('https://a/'), mkPage('https://b/')];
    const session = stubSession({ pages, activeIndex: 0, newPage: newPageSpy });
    const tool = createTabManageTool({ session });
    const out = await tool.handler({ action: 'new' }, stubCtx());
    expect(newPageSpy).toHaveBeenCalled();
    expect(out.action).toBe('new');
    expect(out.newIndex).toBe(1);
  });

  it('handler "switch" calls setActiveIndex with input.index', async () => {
    const setSpy = vi.fn();
    const session = stubSession({
      pages: [mkPage('https://a/'), mkPage('https://b/')],
      activeIndex: 0,
      setActiveIndex: setSpy,
    });
    const tool = createTabManageTool({ session });
    const out = await tool.handler({ action: 'switch', index: 1 }, stubCtx());
    expect(setSpy).toHaveBeenCalledWith(1);
    expect(out.action).toBe('switch');
    expect(out.activeIndex).toBe(1);
  });

  it('handler "close" calls closePage with input.index', async () => {
    const closeSpy = vi.fn(async () => {});
    const session = stubSession({
      pages: [mkPage('https://a/'), mkPage('https://b/')],
      activeIndex: 0,
      closePage: closeSpy,
    });
    const tool = createTabManageTool({ session });
    const out = await tool.handler({ action: 'close', index: 1 }, stubCtx());
    expect(closeSpy).toHaveBeenCalledWith(1);
    expect(out.action).toBe('close');
  });
});

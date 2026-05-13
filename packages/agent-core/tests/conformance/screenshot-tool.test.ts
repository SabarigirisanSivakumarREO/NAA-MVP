/**
 * AC-04/AC-05 — T025 browser_screenshot factory + handler conformance.
 *
 * Stub-only — screenshotExtractor.capture is mocked to avoid real Playwright.
 * Integration coverage lands at T050.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  createScreenshotTool,
  ScreenshotInputSchema,
  ScreenshotOutputSchema,
} from '../../src/mcp/tools/screenshot.js';
import { screenshotExtractor, VisualSchema, type Visual } from '../../src/perception/index.js';
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

const fakePage = {} as unknown as BrowserPage;

function stubSession(): BrowserSession {
  return {
    id: 's-1',
    page: fakePage,
    context: { addInitScript: async () => {}, pages: () => [] },
    close: async () => {},
  };
}

const fakeVisual: Visual = VisualSchema.parse({
  format: 'jpeg',
  sizeBytes: 1024,
  width: 1280,
  height: 720,
});

describe('T025 browser_screenshot factory — AC-04/AC-05', () => {
  it('exposes EXACT v3.1 name and safe classification', () => {
    const tool = createScreenshotTool({ session: stubSession() });
    expect(tool.name).toBe('browser_screenshot');
    expect(tool.safetyClass).toBe('safe');
  });

  it('inputSchema accepts empty + rejects unknown keys (strict)', () => {
    expect(ScreenshotInputSchema.safeParse({}).success).toBe(true);
    expect(ScreenshotInputSchema.safeParse({ fullPage: true }).success).toBe(false);
  });

  it('outputSchema is Phase 1 VisualSchema (identity)', () => {
    expect(ScreenshotOutputSchema).toBe(VisualSchema);
  });

  it('handler delegates to screenshotExtractor.capture with the bound session.page', async () => {
    const spy = vi.spyOn(screenshotExtractor, 'capture').mockResolvedValue(fakeVisual);
    const session = stubSession();
    const tool = createScreenshotTool({ session });
    const out = await tool.handler({}, stubCtx());
    expect(spy).toHaveBeenCalledWith(fakePage);
    expect(out).toBe(fakeVisual);
    spy.mockRestore();
  });

  it('handler emits Pino correlation logs with size/width/height', async () => {
    const spy = vi.spyOn(screenshotExtractor, 'capture').mockResolvedValue(fakeVisual);
    const ctx = stubCtx();
    const tool = createScreenshotTool({ session: stubSession() });
    await tool.handler({}, ctx);
    expect(ctx.logger.info).toHaveBeenCalledWith({}, 'mcp.tool.screenshot.start');
    expect(ctx.logger.info).toHaveBeenCalledWith(
      { size_bytes: 1024, width: 1280, height: 720 },
      'mcp.tool.screenshot.done',
    );
    spy.mockRestore();
  });
});

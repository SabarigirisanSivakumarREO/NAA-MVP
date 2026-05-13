/**
 * AC-09 — T046 page_screenshot_full factory + handler conformance.
 *
 * Spec: phases/phase-2-tools/spec.md AC-09 + R-09 + NF-Phase2-06;
 *       phases/phase-2-tools/tasks.md T046; impact.md MCPToolRegistry
 *       Page-perception row (safetyClass = 'safe'); REQ-MCP-001 + REQ-MCP-002.
 *
 * Stub-only — no real Playwright. session.page.screenshot is mocked to return a
 *   real Sharp-generated JPEG fixture; the Sharp pipeline inside the handler
 *   processes that buffer end-to-end (metadata probe + crop + re-encode ladder
 *   + writeFile). Integration coverage with real BrowserSession lands later.
 *
 * Anchor: @AC-09 — JPEG ≤ 2 MB ≤ 15000 px scroll-stitch via Sharp.
 */
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import type { Logger } from 'pino';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';
import type { ToolContext } from '../../src/mcp/types.js';
import {
  PageScreenshotFullInputSchema,
  PageScreenshotFullOutputSchema,
  ScreenshotFullSaveDirNotAbsoluteError,
  createPageScreenshotFullTool,
} from '../../src/mcp/tools/pageScreenshotFull.js';

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
  screenshot: (opts?: {
    type?: 'jpeg' | 'png';
    quality?: number;
    fullPage?: boolean;
  }) => Promise<Buffer>,
  url = 'https://example.test/path?q=1',
): BrowserSession {
  return {
    id: 's-1',
    page: {
      screenshot,
      url: () => url,
    } as unknown as BrowserSession['page'],
    context: {
      addInitScript: async () => {},
      pages: () => [],
    } as unknown as BrowserSession['context'],
    close: async () => {},
  } as unknown as BrowserSession;
}

/**
 * Build a real JPEG buffer with a solid-color background of given dimensions.
 * Generated via Sharp directly so the handler's metadata probe + Sharp
 * pipeline operate on a genuine JPEG rather than a synthetic stub.
 */
async function makeJpeg(width: number, height: number, quality = 90): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

/**
 * Build a deliberately large JPEG: high-entropy noise image at maximum
 * quality. Used to force the byte-budget ladder to fire in tests.
 */
async function makeLargeJpeg(width: number, height: number): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i++) pixels[i] = Math.floor(Math.random() * 256);
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 100, mozjpeg: false })
    .toBuffer();
}

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'page-screenshot-full-test-'));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('T046 page_screenshot_full factory — AC-09', () => {
  it('exposes EXACT name + safe classification (R4.5 + impact.md row)', () => {
    const tool = createPageScreenshotFullTool({
      session: stubSession(async () => makeJpeg(400, 300)),
    });
    expect(tool.name).toBe('page_screenshot_full');
    expect(tool.safetyClass).toBe('safe');
    expect(typeof tool.description).toBe('string');
    expect(typeof tool.handler).toBe('function');
  });

  it('inputSchema requires saveDir; clamps quality 1-100; rejects unknown keys', () => {
    expect(
      PageScreenshotFullInputSchema.safeParse({ saveDir: '/tmp' }).success,
    ).toBe(true);
    expect(
      PageScreenshotFullInputSchema.safeParse({ saveDir: '/tmp', quality: 80 })
        .success,
    ).toBe(true);
    expect(
      PageScreenshotFullInputSchema.safeParse({ saveDir: '/tmp', quality: 0 })
        .success,
    ).toBe(false);
    expect(
      PageScreenshotFullInputSchema.safeParse({ saveDir: '/tmp', quality: 101 })
        .success,
    ).toBe(false);
    expect(PageScreenshotFullInputSchema.safeParse({ saveDir: '' }).success).toBe(
      false,
    );
    expect(PageScreenshotFullInputSchema.safeParse({}).success).toBe(false);
    expect(
      PageScreenshotFullInputSchema.safeParse({ saveDir: '/tmp', extra: 1 })
        .success,
    ).toBe(false);
    expect(
      PageScreenshotFullInputSchema.safeParse({
        saveDir: '/tmp',
        maxHeight: 25000, // exceeds 20000 hard cap
      }).success,
    ).toBe(false);
  });

  it('outputSchema requires { ok:true, path, format:"jpeg", sizeBytes, width, height }', () => {
    expect(
      PageScreenshotFullOutputSchema.safeParse({
        ok: true,
        path: '/tmp/p.jpg',
        format: 'jpeg',
        sizeBytes: 1024,
        width: 1280,
        height: 800,
      }).success,
    ).toBe(true);
    expect(
      PageScreenshotFullOutputSchema.safeParse({
        ok: false,
        path: '/tmp/p.jpg',
        format: 'jpeg',
        sizeBytes: 1024,
        width: 1,
        height: 1,
      }).success,
    ).toBe(false);
    expect(
      PageScreenshotFullOutputSchema.safeParse({
        ok: true,
        path: '/tmp/p.jpg',
        format: 'png',
        sizeBytes: 1024,
        width: 1,
        height: 1,
      }).success,
    ).toBe(false);
  });

  it('handler throws ScreenshotFullSaveDirNotAbsoluteError on relative saveDir', async () => {
    const tool = createPageScreenshotFullTool({
      session: stubSession(async () => makeJpeg(400, 300)),
    });
    await expect(
      tool.handler({ saveDir: 'relative/path' }, stubCtx()),
    ).rejects.toBeInstanceOf(ScreenshotFullSaveDirNotAbsoluteError);
  });

  it('handler invokes page.screenshot({type:"jpeg", quality, fullPage:true}) and writes file', async () => {
    const screenshotSpy = vi.fn(async () => makeJpeg(800, 1200));
    const tool = createPageScreenshotFullTool({
      session: stubSession(screenshotSpy),
    });

    const out = await tool.handler({ saveDir: tmpDir, quality: 75 }, stubCtx());

    expect(screenshotSpy).toHaveBeenCalledTimes(1);
    expect(screenshotSpy).toHaveBeenCalledWith({
      type: 'jpeg',
      quality: 75,
      fullPage: true,
    });
    expect(out.ok).toBe(true);
    expect(out.format).toBe('jpeg');
    expect(isAbsolute(out.path)).toBe(true);
    expect(out.path.startsWith(tmpDir)).toBe(true);
    expect(out.path.endsWith('.jpg')).toBe(true);
    expect(out.width).toBe(800);
    expect(out.height).toBe(1200);
    // PageScreenshotFullOutputSchema validates the shape end-to-end.
    expect(PageScreenshotFullOutputSchema.safeParse(out).success).toBe(true);
    // File exists on disk with the claimed byte count
    const fileStat = await stat(out.path);
    expect(fileStat.size).toBe(out.sizeBytes);
    // And starts with JPEG magic bytes 0xFF 0xD8
    const bytes = await readFile(out.path);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
  });

  it('handler crops to maxHeight when capture exceeds the cap (clip, not reject)', async () => {
    // Synthetic 1280 × 16000 px page — exceeds default 15000 cap by 1000 px
    const tool = createPageScreenshotFullTool({
      session: stubSession(async () => makeJpeg(1280, 16000, 60)),
    });
    const out = await tool.handler({ saveDir: tmpDir }, stubCtx());
    expect(out.height).toBe(15000);
    expect(out.width).toBe(1280);
  });

  it('handler caps at custom maxHeight when provided', async () => {
    const tool = createPageScreenshotFullTool({
      session: stubSession(async () => makeJpeg(400, 5000, 60)),
    });
    const out = await tool.handler(
      { saveDir: tmpDir, maxHeight: 3000 },
      stubCtx(),
    );
    expect(out.height).toBe(3000);
  });

  it('handler fires re-encode ladder when initial capture exceeds maxBytes', async () => {
    // Force the ladder: high-quality noisy JPEG fixture; set maxBytes below its
    // initial length so the ladder must engage. Use a maxBytes well above the
    // floor of what quality-25 can produce on a 400x400 noise image (~20 KB),
    // so the ladder converges before hitting the failure path.
    const noisy = await makeLargeJpeg(400, 400);
    expect(noisy.length).toBeGreaterThan(40 * 1024); // sanity: fixture is large
    const screenshotSpy = vi.fn(async () => noisy);
    const ctx = stubCtx();
    const tool = createPageScreenshotFullTool({
      session: stubSession(screenshotSpy),
    });
    // maxBytes set above the q25 floor so the ladder converges, but below
    // the initial-buf length so the ladder fires at least once.
    const targetBytes = 32 * 1024;
    const out = await tool.handler(
      { saveDir: tmpDir, maxBytes: targetBytes },
      ctx,
    );
    expect(out.sizeBytes).toBeLessThanOrEqual(targetBytes);
    expect(out.sizeBytes).toBeLessThan(noisy.length); // ladder shrunk the image
    // Ladder logged at info level
    expect(ctx.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ final_quality: expect.any(Number) }),
      'mcp.tool.page_screenshot_full.recompressed',
    );
  });

  it('handler throws ScreenshotFullCompressionFailedError when ladder exhausted', async () => {
    // Sub-floor maxBytes that q25 cannot meet on a noisy fixture
    const noisy = await makeLargeJpeg(400, 400);
    const tool = createPageScreenshotFullTool({
      session: stubSession(async () => noisy),
    });
    const { ScreenshotFullCompressionFailedError } = await import(
      '../../src/mcp/tools/pageScreenshotFull.js'
    );
    await expect(
      tool.handler({ saveDir: tmpDir, maxBytes: 1024 }, stubCtx()),
    ).rejects.toBeInstanceOf(ScreenshotFullCompressionFailedError);
  });

  it('handler URL-slugifies session.page.url() into the filename', async () => {
    const tool = createPageScreenshotFullTool({
      session: stubSession(
        async () => makeJpeg(400, 300),
        'https://shop.example.com/cart?items=3',
      ),
    });
    const out = await tool.handler({ saveDir: tmpDir }, stubCtx());
    // Slug strips protocol, replaces unsafe chars with _
    const filename = out.path.split(/[\\/]/).pop() ?? '';
    expect(filename).toMatch(/^shop\.example\.com_cart_items_3-\d+\.jpg$/);
  });
});

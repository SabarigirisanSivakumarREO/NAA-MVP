/**
 * AC-10 — page_annotate_screenshot conformance (Phase 2 T047).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-2-tools/spec.md AC-10 + R-10
 *   docs/specs/mvp/phases/phase-2-tools/tasks.md T047
 *
 * AC-10 contract:
 *   - Sharp-based overlay of severity-colored boxes on input screenshot
 *   - Non-overlapping label placement (Phase 2 MVP: bbox top-left placement;
 *     proper collision routing deferred to v1.1+ — accepted per task brief)
 *   - Legend included
 *
 * GREEN state — implementation landed at T047.
 *
 * Anchor: @AC-10 — Sharp severity-color overlays + numbered labels + legend.
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';
import {
  type Annotation,
  PageAnnotateScreenshotInputSchema,
  PageAnnotateScreenshotOutputSchema,
  createPageAnnotateScreenshotTool,
} from '../../src/mcp/tools/pageAnnotateScreenshot.js';
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
function stubCtx(toolCallId = 't-1'): ToolContext {
  return { logger: stubLogger(), toolCallId, clientSessionId: 'c-1' };
}

let tmpDir: string;
let fixturePath: string;
const FIXTURE_W = 800;
const FIXTURE_H = 600;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'neural-annotate-'));
  fixturePath = path.join(tmpDir, 'input.jpg');
  // Generate a real Sharp-produced JPEG: solid white canvas.
  const buf = await sharp({
    create: {
      width: FIXTURE_W,
      height: FIXTURE_H,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  await fs.writeFile(fixturePath, buf);
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('T047 page_annotate_screenshot factory — AC-10 conformance', () => {
  /**
   * @AC-10 — factory shape: EXACT v3.1 name + safetyClass='safe'.
   */
  it('exposes EXACT name page_annotate_screenshot + safe (R4.5)', () => {
    const tool = createPageAnnotateScreenshotTool();
    expect(tool.name).toBe('page_annotate_screenshot');
    expect(tool.safetyClass).toBe('safe');
    expect(typeof tool.handler).toBe('function');
  });

  /**
   * @AC-10 — Zod strict boundary: absolute paths + severity enum.
   */
  it('inputSchema enforces absolute paths + severity enum + strict shape', () => {
    const ok = PageAnnotateScreenshotInputSchema.safeParse({
      inputPath: fixturePath,
      saveDir: tmpDir,
      annotations: [{ id: 'a', x: 10, y: 10, width: 50, height: 50, severity: 'critical' }],
    });
    expect(ok.success).toBe(true);

    expect(
      PageAnnotateScreenshotInputSchema.safeParse({
        inputPath: 'relative/path.jpg',
        saveDir: tmpDir,
        annotations: [{ id: 'a', x: 1, y: 1, width: 5, height: 5, severity: 'high' }],
      }).success,
    ).toBe(false);

    expect(
      PageAnnotateScreenshotInputSchema.safeParse({
        inputPath: fixturePath,
        saveDir: tmpDir,
        annotations: [{ id: 'a', x: 1, y: 1, width: 5, height: 5, severity: 'NOT_REAL' }],
      }).success,
    ).toBe(false);

    expect(
      PageAnnotateScreenshotInputSchema.safeParse({
        inputPath: fixturePath,
        saveDir: tmpDir,
        annotations: [],
      }).success,
    ).toBe(false);

    expect(
      PageAnnotateScreenshotInputSchema.safeParse({
        inputPath: fixturePath,
        saveDir: tmpDir,
        annotations: [{ id: 'a', x: 1, y: 1, width: 5, height: 5, severity: 'high' }],
        extra: 'no',
      }).success,
    ).toBe(false);
  });

  /**
   * @AC-10 — output schema requires { ok, path, format='jpeg', sizeBytes, width,
   * height, annotationCount }.
   */
  it('outputSchema requires full result shape', () => {
    expect(
      PageAnnotateScreenshotOutputSchema.safeParse({
        ok: true,
        path: '/tmp/foo.jpg',
        format: 'jpeg',
        sizeBytes: 1234,
        width: 800,
        height: 600,
        annotationCount: 1,
      }).success,
    ).toBe(true);

    expect(
      PageAnnotateScreenshotOutputSchema.safeParse({
        ok: true,
        path: '/tmp/foo.jpg',
        format: 'png', // wrong
        sizeBytes: 1234,
        width: 800,
        height: 600,
        annotationCount: 1,
      }).success,
    ).toBe(false);
  });

  /**
   * @AC-10 — handler reads input, produces output file, returns metadata.
   */
  it('handler writes a valid JPEG with correct dimensions', async () => {
    const tool = createPageAnnotateScreenshotTool();
    const annotations: Annotation[] = [
      { id: 'a1', x: 50, y: 50, width: 200, height: 100, severity: 'critical' },
      { id: 'a2', x: 300, y: 200, width: 150, height: 80, severity: 'high' },
      { id: 'a3', x: 100, y: 350, width: 120, height: 60, severity: 'medium' },
    ];
    const out = await tool.handler(
      { inputPath: fixturePath, saveDir: tmpDir, annotations },
      stubCtx('t-handler'),
    );

    expect(out.ok).toBe(true);
    expect(out.format).toBe('jpeg');
    expect(out.width).toBe(FIXTURE_W);
    expect(out.height).toBe(FIXTURE_H);
    expect(out.annotationCount).toBe(3);
    expect(out.sizeBytes).toBeGreaterThan(0);

    // Output exists + valid JPEG (Sharp can re-read metadata).
    const stat = await fs.stat(out.path);
    expect(stat.isFile()).toBe(true);
    const verifyMeta = await sharp(await fs.readFile(out.path)).metadata();
    expect(verifyMeta.format).toBe('jpeg');
    expect(verifyMeta.width).toBe(FIXTURE_W);
    expect(verifyMeta.height).toBe(FIXTURE_H);
  });

  /**
   * @AC-10 — output schema validates handler return.
   */
  it('handler result conforms to outputSchema', async () => {
    const tool = createPageAnnotateScreenshotTool();
    const out = await tool.handler(
      {
        inputPath: fixturePath,
        saveDir: tmpDir,
        annotations: [{ id: 'a', x: 10, y: 10, width: 50, height: 50, severity: 'info' }],
      },
      stubCtx('t-schema'),
    );
    expect(PageAnnotateScreenshotOutputSchema.safeParse(out).success).toBe(true);
  });

  /**
   * @AC-10 — annotations grow output size (overlay was actually composited).
   */
  it('annotated output differs from raw input (overlay actually composited)', async () => {
    const tool = createPageAnnotateScreenshotTool();
    const out = await tool.handler(
      {
        inputPath: fixturePath,
        saveDir: tmpDir,
        annotations: [
          { id: 'a', x: 100, y: 100, width: 400, height: 300, severity: 'critical' },
        ],
      },
      stubCtx('t-overlay'),
    );
    const inputStat = await fs.stat(fixturePath);
    // Output JPEG should be different size than blank input — annotations + legend
    // add visible pixels. Use !== rather than > to remain robust across encoders.
    expect(out.sizeBytes).not.toBe(inputStat.size);
  });

  /**
   * @AC-10 — Pino correlation: tool emits info with annotation_count + dims.
   */
  it('emits Pino correlation fields per T-PHASE2-LOGGER', async () => {
    const tool = createPageAnnotateScreenshotTool();
    const ctx = stubCtx('t-log');
    await tool.handler(
      {
        inputPath: fixturePath,
        saveDir: tmpDir,
        annotations: [{ id: 'a', x: 0, y: 0, width: 10, height: 10, severity: 'low' }],
      },
      ctx,
    );
    const infoFn = ctx.logger.info as unknown as ReturnType<typeof vi.fn>;
    expect(infoFn).toHaveBeenCalled();
    const callArg = infoFn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArg).toMatchObject({
      annotation_count: 1,
      width: FIXTURE_W,
      height: FIXTURE_H,
    });
    expect(callArg).toHaveProperty('out_path');
  });
});


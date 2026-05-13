/**
 * T047 page_annotate_screenshot — Phase 2 Wave 13 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T047 (Sharp-based overlay of
 *         severity-colored boxes + non-overlapping labels + legend);
 *         spec.md AC-10; impact.md MCPToolRegistry row safetyClass='safe';
 *         REQ-MCP-001 + REQ-MCP-002.
 *
 * Pure image-processing tool — no browser interaction; no BrowserSession
 * dependency. Handler reads an input image (JPEG/PNG) from disk, generates an
 * SVG overlay with severity-colored bboxes + numeric circular labels at each
 * bbox top-left + a top-right legend showing per-severity counts, composites
 * it via Sharp, and saves the result as a JPEG.
 *
 * Severity colour map (Tailwind v3 palette, fixed at Phase 2 close):
 *   critical=#dc2626 (red-600), high=#ea580c (orange-600),
 *   medium=#d97706  (amber-600), low=#eab308 (yellow-500),
 *   info=#2563eb    (blue-600).
 *
 * Label placement: Phase 2 MVP places the numbered label at the top-left of
 * each bbox. If two bboxes overlap heavily their labels may overlap — accept
 * for now; proper collision-detection routing is v1.1+ scope.
 *
 * R4.5 EXACT name. R9 boundary: no `playwright` import. R10.1: ≤200 LOC.
 * R10.3: named exports only. R13: no `any`. Zod strict on both schemas.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import type { MCPToolDefinition, ToolContext } from '../types.js';

const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type Severity = z.infer<typeof SeveritySchema>;

const AnnotationSchema = z
  .object({
    id: z.string().min(1),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    severity: SeveritySchema,
    label: z.string().optional(),
  })
  .strict();

export type Annotation = z.infer<typeof AnnotationSchema>;

export const PageAnnotateScreenshotInputSchema = z
  .object({
    inputPath: z.string().refine((p) => path.isAbsolute(p), {
      message: 'inputPath must be absolute',
    }),
    saveDir: z.string().refine((p) => path.isAbsolute(p), {
      message: 'saveDir must be absolute',
    }),
    annotations: z.array(AnnotationSchema).min(1),
  })
  .strict();

export const PageAnnotateScreenshotOutputSchema = z
  .object({
    ok: z.literal(true),
    path: z.string(),
    format: z.literal('jpeg'),
    sizeBytes: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    annotationCount: z.number().int().positive(),
  })
  .strict();

export type PageAnnotateScreenshotInput = z.infer<typeof PageAnnotateScreenshotInputSchema>;
export type PageAnnotateScreenshotOutput = z.infer<typeof PageAnnotateScreenshotOutputSchema>;

/**
 * Empty deps — no BrowserSession needed. Preserved for uniform registration
 * pattern (Phase 5 BrowseNode wires all 29 tools through a common factory shape).
 */
export type PageAnnotateScreenshotDeps = Record<string, never>;

const SEVERITY_COLORS: Readonly<Record<Severity, string>> = Object.freeze({
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#eab308',
  info: '#2563eb',
});

/**
 * Build the SVG overlay covering the full canvas. bbox outlines (3px) + numeric
 * circle label at each top-left + top-right legend with per-severity counts.
 *
 * Note: Phase 2 MVP — labels placed at bbox top-left without collision routing.
 */
function buildAnnotationSvg(
  width: number,
  height: number,
  annotations: readonly Annotation[],
): string {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const parts: string[] = [];

  annotations.forEach((a, i) => {
    const color = SEVERITY_COLORS[a.severity];
    counts[a.severity] += 1;
    parts.push(
      `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" fill="none" stroke="${color}" stroke-width="3" />`,
    );
    const lx = a.x + 14;
    const ly = a.y + 14;
    parts.push(`<circle cx="${lx}" cy="${ly}" r="12" fill="${color}" />`);
    parts.push(
      `<text x="${lx}" y="${ly + 4}" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="sans-serif">${i + 1}</text>`,
    );
  });

  const legendItems = (Object.entries(counts) as Array<[Severity, number]>).filter(
    ([, c]) => c > 0,
  );
  const legendW = 180;
  const legendH = 20 + legendItems.length * 24;
  const lx0 = Math.max(0, width - legendW - 20);
  const ly0 = 20;
  parts.push(
    `<rect x="${lx0}" y="${ly0}" width="${legendW}" height="${legendH}" fill="white" stroke="#374151" stroke-width="1" rx="4" />`,
  );
  legendItems.forEach(([sev, count], i) => {
    const rowY = ly0 + 14 + i * 24;
    parts.push(
      `<rect x="${lx0 + 10}" y="${rowY - 8}" width="16" height="16" fill="${SEVERITY_COLORS[sev]}" />`,
    );
    parts.push(
      `<text x="${lx0 + 34}" y="${rowY + 5}" fill="#111827" font-size="13" font-family="sans-serif">${sev} (${count})</text>`,
    );
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join('')}</svg>`;
}

export function createPageAnnotateScreenshotTool(
  _deps: PageAnnotateScreenshotDeps = {},
): MCPToolDefinition<PageAnnotateScreenshotInput, PageAnnotateScreenshotOutput> {
  return {
    name: 'page_annotate_screenshot', // EXACT v3.1 (R4.5)
    description:
      'Annotate an existing screenshot image with severity-colored bounding boxes, numbered labels, and a legend. Pure image processing — no browser interaction. Inputs: absolute inputPath + absolute saveDir + annotations array (each: id, x, y, width, height, severity ∈ {critical,high,medium,low,info}, optional label). Returns the saved JPEG path + metadata.',
    inputSchema: PageAnnotateScreenshotInputSchema,
    outputSchema: PageAnnotateScreenshotOutputSchema,
    safetyClass: 'safe',
    handler: async (
      input,
      ctx: ToolContext,
    ): Promise<PageAnnotateScreenshotOutput> => {
      const inputBuf = await fs.readFile(input.inputPath);
      const meta = await sharp(inputBuf).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      if (width <= 0 || height <= 0) {
        throw new Error(
          `page_annotate_screenshot: unable to determine dimensions of ${input.inputPath}`,
        );
      }

      const svg = buildAnnotationSvg(width, height, input.annotations);
      const outBuf = await sharp(inputBuf)
        .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
        .jpeg({ quality: 85 })
        .toBuffer();

      await fs.mkdir(input.saveDir, { recursive: true });
      const filename = `annotated-${Date.now()}-${ctx.toolCallId}.jpg`;
      const outPath = path.join(input.saveDir, filename);
      await fs.writeFile(outPath, outBuf);

      ctx.logger.info(
        {
          annotation_count: input.annotations.length,
          width,
          height,
          size_bytes: outBuf.length,
          out_path: outPath,
        },
        'mcp.tool.page_annotate_screenshot.saved',
      );

      return {
        ok: true,
        path: outPath,
        format: 'jpeg',
        sizeBytes: outBuf.length,
        width,
        height,
        annotationCount: input.annotations.length,
      };
    },
  };
}

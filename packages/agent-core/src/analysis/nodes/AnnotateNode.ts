/**
 * AnnotateNode — week-1 stub: no-op passthrough.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.5 §6 T-SKELETON-007
 *         (acceptance: passes findings through; no screenshot annotation).
 *
 * Status: complete-but-stubbed (per roadmap §3 conventions). Returns
 * input array verbatim — no image generation, no Sharp processing, no
 * severity-color overlay. Week 1 is data-shape-only.
 *
 * Phase 7 T131 forward path (week 9 — supersession):
 *   The real AnnotateNode introduces Sharp severity-color overlays on
 *   captured screenshots. Each grounded finding gets:
 *     - A bounding-box rectangle drawn at the finding's element ref
 *       coordinates (resolved from PageStateModel.filteredDOM)
 *     - A severity-mapped color (e.g., red for high-impact, yellow for
 *       medium, blue for low — color mapping per Phase 7 T131 spec)
 *     - An annotated_screenshot_url field added to each finding
 *       (uploaded to ScreenshotStorage / Cloudflare R2 — Phase 4 T072)
 *   Annotated screenshots flow into Phase 9 PDF delivery (T245-T249) at
 *   week 10 — appearing inline in the "Findings by Category" section.
 *
 * R20 impact.md required at week-9 transition (annotation pipeline
 * introduces Sharp dep + extends GroundedFinding shape with optional
 * `annotated_screenshot_url` field; Phase 7 plan §3 documents).
 *
 * R10/R13 — N/A (no LLM; Sharp is pure CPU image processing).
 *
 * R5.3 + GR-007 — N/A (passthrough preserves observation text from
 * upstream; no new prose generated).
 *
 * R6 — N/A; passthrough doesn't reference heuristic body content.
 *
 * R10 compliance: file ≤ 50 lines.
 */
import { type GroundedFinding } from '../../audit/types.js';

export class AnnotateNode {
  async run(grounded: readonly GroundedFinding[]): Promise<GroundedFinding[]> {
    return [...grounded];
  }
}

// ─── Phase 7 T131: annotateNodeRun (AC-19, REQ-ANALYZE-NODE-005, F-011) ─
//
// Composes severity-colored bbox + numbered pin overlays on viewport +
// fullpage screenshots via the page_annotate_screenshot MCP tool. Pin
// positions are computed with overlap-avoidance per AI_Analysis_Agent
// §7.8.
//
// Severity color map (F-011 spec lines 877-882):
//   critical=#DC2626 (red-600), high=#EA580C (orange-600),
//   medium=#CA8A04 (amber-600), low=#2563EB (blue-600).
//
// The page_annotate_screenshot tool itself handles the color rendering
// per its Tailwind palette; AnnotateNode only computes (x, y, width,
// height, severity, label) tuples and forwards.
import type { GroundedFinding as Phase7GroundedFinding } from '../../orchestration/AnalysisState.js';

/**
 * Minimal page_annotate_screenshot tool surface AnnotateNode calls.
 * Mirrors PageAnnotateScreenshotInput/Output from mcp/tools/.
 */
export interface AnnotateScreenshotToolInput {
  readonly inputPath: string;
  readonly saveDir: string;
  readonly annotations: ReadonlyArray<{
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    readonly label?: string;
  }>;
}

export interface AnnotateScreenshotToolOutput {
  readonly ok: true;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly annotationCount: number;
}

export type AnnotateScreenshotTool = (
  input: AnnotateScreenshotToolInput,
) => Promise<AnnotateScreenshotToolOutput>;

export interface AnnotateNodeInput {
  readonly grounded_findings: ReadonlyArray<Phase7GroundedFinding>;
  readonly viewportScreenshotPath: string;
  readonly fullpageScreenshotPath: string;
  readonly viewportDims: { readonly width: number; readonly height: number };
  readonly fullpageDims: { readonly width: number; readonly height: number };
  readonly saveDir: string;
  readonly annotateTool: AnnotateScreenshotTool;
}

export interface AnnotateNodeDelta {
  readonly annotated_viewport_path: string | null;
  readonly annotated_fullpage_path: string | null;
}

interface ParsedBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const COORD_RE = /\b(?:x|X)\s*[:=]\s*(\d+)\b.*?\b(?:y|Y)\s*[:=]\s*(\d+)\b/;
const SIZE_RE = /\b(\d{1,4})\s*[x×]\s*(\d{1,4})\b/;
const Y_ONLY_RE = /\b(?:y|Y)\s*[:=]\s*(\d+)\b/;

/**
 * Parse a finding's evidence.measurement into a rectangle. Recognized
 * patterns: "x:N, y:M" + "WxH" (or "W×H"). Falls back to null when no
 * coordinates extractable — caller stacks such findings in the margin.
 */
function parseBoundingBox(measurement: string | null): ParsedBox | null {
  if (measurement === null) return null;
  const c = COORD_RE.exec(measurement);
  const s = SIZE_RE.exec(measurement);
  if (c !== null) {
    const x = Number(c[1]);
    const y = Number(c[2]);
    const width = s !== null ? Number(s[1]) : 60;
    const height = s !== null ? Number(s[2]) : 28;
    return { x, y, width, height };
  }
  const yOnly = Y_ONLY_RE.exec(measurement);
  if (yOnly !== null) {
    return { x: 50, y: Number(yOnly[1]), width: 60, height: 28 };
  }
  return null;
}

/**
 * Per §7.8: if a new pin's anchor is within 35 px (Euclidean) of any
 * existing anchor, shift the new one down by 40 px and re-test until
 * clear. Bounded by the screenshot height.
 */
function shiftIfOverlapping(
  proposed: { x: number; y: number },
  existing: ReadonlyArray<{ readonly x: number; readonly y: number }>,
  maxY: number,
): { x: number; y: number } {
  let { x, y } = proposed;
  let collided = true;
  while (collided) {
    collided = false;
    for (const e of existing) {
      const dist = Math.hypot(x - e.x, y - e.y);
      if (dist < 35) {
        y += 40;
        collided = true;
        break;
      }
    }
    if (y > maxY - 30) {
      y = maxY - 30;
      collided = false;
    }
  }
  return { x, y };
}

function buildAnnotations(
  findings: ReadonlyArray<Phase7GroundedFinding>,
  dims: { width: number; height: number },
): AnnotateScreenshotToolInput['annotations'] {
  const placed: Array<{ x: number; y: number }> = [];
  const out: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    label: string;
  }> = [];

  for (let i = 0; i < findings.length; i += 1) {
    const f = findings[i] as Phase7GroundedFinding;
    const parsed = parseBoundingBox(f.evidence.measurement);
    const baseBox = parsed ?? {
      x: dims.width - 80,
      y: 40 + i * 50,
      width: 60,
      height: 28,
    };
    const anchor = shiftIfOverlapping({ x: baseBox.x, y: baseBox.y }, placed, dims.height);
    placed.push(anchor);
    out.push({
      id: `${i + 1}`,
      x: Math.max(0, Math.min(anchor.x, dims.width - baseBox.width - 1)),
      y: Math.max(0, Math.min(anchor.y, dims.height - baseBox.height - 1)),
      width: Math.max(1, baseBox.width),
      height: Math.max(1, baseBox.height),
      severity: (f.severity ?? 'low') as 'critical' | 'high' | 'medium' | 'low' | 'info',
      label: `F-${String(i + 1).padStart(2, '0')}: ${f.heuristic_id}`,
    });
  }
  return out;
}

export async function annotateNodeRun(input: AnnotateNodeInput): Promise<AnnotateNodeDelta> {
  if (input.grounded_findings.length === 0) {
    return { annotated_viewport_path: null, annotated_fullpage_path: null };
  }

  const viewportAnnotations = buildAnnotations(input.grounded_findings, input.viewportDims);
  const fullpageAnnotations = buildAnnotations(input.grounded_findings, input.fullpageDims);

  const viewportRes = await input.annotateTool({
    inputPath: input.viewportScreenshotPath,
    saveDir: input.saveDir,
    annotations: viewportAnnotations,
  });
  const fullpageRes = await input.annotateTool({
    inputPath: input.fullpageScreenshotPath,
    saveDir: input.saveDir,
    annotations: fullpageAnnotations,
  });

  return {
    annotated_viewport_path: viewportRes.path,
    annotated_fullpage_path: fullpageRes.path,
  };
}

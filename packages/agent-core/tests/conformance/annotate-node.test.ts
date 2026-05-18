/**
 * AC-19 — AnnotateNode (Phase 7 T131, REQ-ANALYZE-NODE-005, F-011).
 *
 * Verifies page_annotate_screenshot tool wiring + bounding-box parsing
 * from evidence.measurement + overlap-avoidance + severity propagation.
 */
import { describe, expect, it } from 'vitest';
import {
  annotateNodeRun,
  type AnnotateScreenshotTool,
  type AnnotateScreenshotToolInput,
} from '../../src/analysis/nodes/AnnotateNode.js';
import type { GroundedFinding } from '../../src/orchestration/AnalysisState.js';

function gf(overrides: Partial<GroundedFinding> = {}): GroundedFinding {
  return {
    heuristic_id: 'H-1',
    status: 'violation',
    observation: 'observation text long enough',
    assessment: 'assessment text long enough',
    evidence: {
      element_ref: 'Add to bag',
      element_selector: 'button.cta',
      data_point: 'ctas[0]',
      measurement: 'x:200, y:400 (280×48)',
    },
    severity: 'high',
    confidence_basis: null,
    recommendation: null,
    needs_review: false,
    verdict: 'KEEP',
    confidence_tier: 'high',
    ...overrides,
  };
}

class CapturingTool {
  public readonly calls: AnnotateScreenshotToolInput[] = [];
  readonly fn: AnnotateScreenshotTool = async (input) => {
    this.calls.push(input);
    return {
      ok: true,
      path: `${input.saveDir}/annotated-${this.calls.length}.jpg`,
      width: 1280,
      height: 720,
      annotationCount: input.annotations.length,
    };
  };
}

describe('AC-19 AnnotateNode', () => {
  it('short-circuits when no findings (no tool call)', async () => {
    const tool = new CapturingTool();
    const out = await annotateNodeRun({
      grounded_findings: [],
      viewportScreenshotPath: '/abs/view.jpg',
      fullpageScreenshotPath: '/abs/full.jpg',
      viewportDims: { width: 1280, height: 720 },
      fullpageDims: { width: 1280, height: 3000 },
      saveDir: '/abs/out',
      annotateTool: tool.fn,
    });
    expect(tool.calls).toHaveLength(0);
    expect(out.annotated_viewport_path).toBeNull();
    expect(out.annotated_fullpage_path).toBeNull();
  });

  it('calls page_annotate_screenshot for BOTH viewport + fullpage', async () => {
    const tool = new CapturingTool();
    await annotateNodeRun({
      grounded_findings: [gf()],
      viewportScreenshotPath: '/abs/view.jpg',
      fullpageScreenshotPath: '/abs/full.jpg',
      viewportDims: { width: 1280, height: 720 },
      fullpageDims: { width: 1280, height: 3000 },
      saveDir: '/abs/out',
      annotateTool: tool.fn,
    });
    expect(tool.calls).toHaveLength(2);
    expect(tool.calls[0]?.inputPath).toBe('/abs/view.jpg');
    expect(tool.calls[1]?.inputPath).toBe('/abs/full.jpg');
  });

  it('parses x/y/WxH from evidence.measurement', async () => {
    const tool = new CapturingTool();
    await annotateNodeRun({
      grounded_findings: [
        gf({ evidence: { element_ref: null, element_selector: null, data_point: 'ctas[0]', measurement: 'x:200, y:400 (280×48)' } }),
      ],
      viewportScreenshotPath: '/abs/view.jpg',
      fullpageScreenshotPath: '/abs/full.jpg',
      viewportDims: { width: 1280, height: 720 },
      fullpageDims: { width: 1280, height: 3000 },
      saveDir: '/abs/out',
      annotateTool: tool.fn,
    });
    const ann = tool.calls[0]?.annotations[0];
    expect(ann?.x).toBe(200);
    expect(ann?.y).toBe(400);
    expect(ann?.width).toBe(280);
    expect(ann?.height).toBe(48);
  });

  it('falls back to margin placement when measurement unparseable', async () => {
    const tool = new CapturingTool();
    await annotateNodeRun({
      grounded_findings: [
        gf({ evidence: { element_ref: null, element_selector: null, data_point: 'forms[0]', measurement: null } }),
        gf({ evidence: { element_ref: null, element_selector: null, data_point: 'forms[1]', measurement: 'somewhere' } }),
      ],
      viewportScreenshotPath: '/abs/view.jpg',
      fullpageScreenshotPath: '/abs/full.jpg',
      viewportDims: { width: 1280, height: 720 },
      fullpageDims: { width: 1280, height: 3000 },
      saveDir: '/abs/out',
      annotateTool: tool.fn,
    });
    const anns = tool.calls[0]?.annotations ?? [];
    expect(anns).toHaveLength(2);
    // Margin placement stacks toward right edge.
    expect(anns[0]?.x).toBeGreaterThan(1000);
  });

  it('applies overlap-avoidance shift (≥40px gap) for findings at identical coordinates', async () => {
    const tool = new CapturingTool();
    await annotateNodeRun({
      grounded_findings: [
        gf({ evidence: { element_ref: null, element_selector: null, data_point: 'ctas[0]', measurement: 'x:200, y:400' } }),
        gf({ evidence: { element_ref: null, element_selector: null, data_point: 'ctas[1]', measurement: 'x:200, y:400' } }),
      ],
      viewportScreenshotPath: '/abs/view.jpg',
      fullpageScreenshotPath: '/abs/full.jpg',
      viewportDims: { width: 1280, height: 720 },
      fullpageDims: { width: 1280, height: 3000 },
      saveDir: '/abs/out',
      annotateTool: tool.fn,
    });
    const anns = tool.calls[0]?.annotations ?? [];
    expect(anns[1]!.y - anns[0]!.y).toBeGreaterThanOrEqual(40);
  });

  it('propagates severity from each finding', async () => {
    const tool = new CapturingTool();
    await annotateNodeRun({
      grounded_findings: [gf({ severity: 'critical' }), gf({ severity: 'low' })],
      viewportScreenshotPath: '/abs/view.jpg',
      fullpageScreenshotPath: '/abs/full.jpg',
      viewportDims: { width: 1280, height: 720 },
      fullpageDims: { width: 1280, height: 3000 },
      saveDir: '/abs/out',
      annotateTool: tool.fn,
    });
    const sev = (tool.calls[0]?.annotations ?? []).map((a) => a.severity);
    expect(sev).toEqual(['critical', 'low']);
  });

  it('label uses F-NN format (F-01, F-02, ...)', async () => {
    const tool = new CapturingTool();
    await annotateNodeRun({
      grounded_findings: [gf(), gf({ heuristic_id: 'H-2' })],
      viewportScreenshotPath: '/abs/view.jpg',
      fullpageScreenshotPath: '/abs/full.jpg',
      viewportDims: { width: 1280, height: 720 },
      fullpageDims: { width: 1280, height: 3000 },
      saveDir: '/abs/out',
      annotateTool: tool.fn,
    });
    const labels = (tool.calls[0]?.annotations ?? []).map((a) => a.label);
    expect(labels[0]).toMatch(/^F-01:/);
    expect(labels[1]).toMatch(/^F-02:/);
  });

  it('clamps annotations within screenshot bounds', async () => {
    const tool = new CapturingTool();
    await annotateNodeRun({
      grounded_findings: [
        gf({ evidence: { element_ref: null, element_selector: null, data_point: 'x', measurement: 'x:9999, y:9999' } }),
      ],
      viewportScreenshotPath: '/abs/view.jpg',
      fullpageScreenshotPath: '/abs/full.jpg',
      viewportDims: { width: 1280, height: 720 },
      fullpageDims: { width: 1280, height: 3000 },
      saveDir: '/abs/out',
      annotateTool: tool.fn,
    });
    const ann = tool.calls[0]?.annotations[0];
    expect(ann!.x + ann!.width).toBeLessThanOrEqual(1280);
    expect(ann!.y + ann!.height).toBeLessThanOrEqual(720);
  });
});

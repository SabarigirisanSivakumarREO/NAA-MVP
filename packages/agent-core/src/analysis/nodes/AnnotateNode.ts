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

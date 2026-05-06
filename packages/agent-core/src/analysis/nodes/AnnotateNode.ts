/**
 * AnnotateNode — placeholder for T-SKELETON-001 orchestrator scaffolding.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.3 §6 T-SKELETON-007.
 *
 * Status: no-op passthrough. Same form will satisfy T-SKELETON-007
 * acceptance (week 1 stub no-op).
 *
 * Phase 7 T131 supersedes with real Sharp severity-color overlay in week 9
 * (annotated screenshots for Phase 9 PDF delivery).
 *
 * R10 compliance: file ≤ 50 lines.
 */
import { type GroundedFinding } from '../../audit/types.js';

export class AnnotateNode {
  async run(grounded: readonly GroundedFinding[]): Promise<GroundedFinding[]> {
    return [...grounded];
  }
}

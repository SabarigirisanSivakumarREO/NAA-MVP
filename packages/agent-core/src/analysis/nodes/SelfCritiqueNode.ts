/**
 * SelfCritiqueNode — placeholder for T-SKELETON-001 orchestrator scaffolding.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.3 §6 T-SKELETON-005.
 *
 * Status: passthrough placeholder — tags every input finding with
 * `verdict: 'KEEP'`. Same form will satisfy the T-SKELETON-005 acceptance
 * (week 1 stub passthrough).
 *
 * Phase 7 T120/T121 supersedes with R5.6 SEPARATE LLM call in week 6
 * (verifiable via 2 distinct llm_call_log rows per page).
 *
 * R10 compliance: file ≤ 50 lines.
 */
import { type CritiqueFinding, type RawFinding } from '../../audit/types.js';

export class SelfCritiqueNode {
  async run(rawFindings: readonly RawFinding[]): Promise<CritiqueFinding[]> {
    return rawFindings.map((finding) => ({ ...finding, verdict: 'KEEP' }));
  }
}

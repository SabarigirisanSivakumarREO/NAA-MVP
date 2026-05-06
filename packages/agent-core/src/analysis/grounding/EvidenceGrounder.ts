/**
 * EvidenceGrounder — placeholder for T-SKELETON-001 orchestrator scaffolding.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.3 §6 T-SKELETON-006.
 *
 * Status: passthrough placeholder — every critiqued finding flows to
 * `grounded`; `rejected` is empty. Same form will satisfy the
 * T-SKELETON-006 acceptance (week 1 stub passthrough).
 *
 * Phase 7 T122-T130 supersedes with all 9 grounding rules (GR-001..GR-008
 * + GR-012 benchmark validation) in week 7 — second critical risk gate.
 *
 * R10 compliance: file ≤ 50 lines.
 */
import { type CritiqueFinding, type GroundResult } from '../../audit/types.js';

export class EvidenceGrounder {
  async ground(critiqued: readonly CritiqueFinding[]): Promise<GroundResult> {
    return { grounded: [...critiqued], rejected: [] };
  }
}

/**
 * EvidenceGrounder — week-1 stub: passthrough; rejected[] empty.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.5 §6 T-SKELETON-006
 *         (acceptance: returns input passthrough — all critiqued findings
 *         → grounded; rejected[] empty).
 *
 * Status: complete-but-stubbed (per roadmap §3 conventions). Maps every
 * input CritiqueFinding to a GroundedFinding (alias for now); returns
 * empty `rejected` array. No rule evaluation, no element-exists check,
 * no benchmark validation, no banned-phrase filter — week 1 is
 * happy-path-only.
 *
 * Phase 7 T122-T130 forward path (★ second critical risk gate — week 7 ★):
 *   The real EvidenceGrounder ships 9 grounding rules per Phase 7 spec:
 *     - GR-001 element-exists       (T122) — verifies cited element refs
 *                                            resolve in PageStateModel
 *     - GR-002 element-rendered     (T123) — bounding box / non-zero area
 *     - GR-003 element-interactive  (T124) — interactiveGraph membership
 *     - GR-004 element-visible      (T125) — viewport visibility check
 *     - GR-005 element-content      (T126) — text content match
 *     - GR-006 element-position     (T127) — coordinate plausibility
 *     - GR-007 banned-phrase        (T128) — REUSES + EXTENDS T-SKELETON-004
 *                                            R5.3 regex pack; canonical pack
 *     - GR-008 element-uniqueness   (T129) — selector ambiguity check
 *     - GR-012 benchmark-validation (T130) — quantitative benchmark
 *                                            comparison + qualitative match
 *   All 9 rules + EvidenceGrounder integration land week 7 as ONE bundle
 *   (per implementation-roadmap.md §7 week 7). First REAL grounded finding
 *   ★ second critical risk gate ★ — failure modes: 0% rejection (rules
 *   too lenient), 95% rejection (rules too strict), GR-007 false positives.
 *
 * R20 impact.md required at week-7 transition (Finding lifecycle gates:
 * raw → critiqued → grounded/rejected; rejected_findings DB rows with
 * rule_id + reason per Phase 7 plan).
 *
 * R10/R13 — N/A (no LLM; pure rule evaluation).
 *
 * R5.3 + GR-007 — week-1 N/A (passthrough). Week-7 GR-007 implementation
 * EXTENDS the representative regex pack from T-SKELETON-004 EvaluateNode
 * test fixtures into the canonical full pack at runtime.
 *
 * R6 — N/A (passthrough doesn't reference heuristic body).
 *
 * R10 compliance: file ≤ 80 lines.
 */
import { type CritiqueFinding, type GroundResult } from '../../audit/types.js';

export class EvidenceGrounder {
  async ground(critiqued: readonly CritiqueFinding[]): Promise<GroundResult> {
    return { grounded: [...critiqued], rejected: [] };
  }
}

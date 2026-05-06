/**
 * SelfCritiqueNode — week-1 stub: passthrough with verdict='KEEP'.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.5 §6 T-SKELETON-005
 *         (acceptance: returns input passthrough with verdict='KEEP' on
 *         every finding).
 *
 * Status: complete-but-stubbed (per roadmap §3 conventions). Maps each
 * RawFinding to a CritiqueFinding tagged `verdict: 'KEEP'`; preserves
 * all upstream fields verbatim (id, source, heuristic_id, page_url,
 * observation). No filtering, no rejection — week 1 is happy-path-only.
 *
 * R5.6 forward path (Phase 7 T120/T121 — week 6):
 *   The real self-critique implementation MUST be a SEPARATE LLM call
 *   distinct from the evaluate call (R5.6 invariant). Verifiable via 2
 *   distinct llm_call_log rows per page after week 6 lands. The Phase 7
 *   T120 prompt template + T121 SelfCritiqueNode supersession will:
 *     - Issue a fresh Anthropic API call (not reuse the evaluate cache)
 *     - Use a DIFFERENT system prompt persona than evaluate (code review
 *       confirms personas differ)
 *     - Emit one of 4 verdicts: KEEP / REVISE / DOWNGRADE / REJECT (not
 *       just KEEP)
 *     - Return ~30% rejected raw findings on average (per Phase 7 spec)
 *     - Trigger R5.6 first-runtime conformance test (un-skip in week 6)
 *
 * R20 impact.md required at week-6 transition (SelfCritique behavior +
 * LLMAdapter SEPARATE-call activation per roadmap §8 promotion table).
 *
 * R10/R13 temperature=0 — N/A this week; activates with T121 in week 6.
 *
 * R5.3 + GR-007 — N/A this passthrough; the upstream EvaluateNode
 * (T-SKELETON-004) already enforced banned-phrase static-check on the
 * observation strings. Critique passthrough inherits that cleanliness.
 *
 * R6 — N/A; passthrough does not reference heuristic body content.
 *
 * R10 compliance: file ≤ 50 lines.
 */
import { type CritiqueFinding, type RawFinding } from '../../audit/types.js';

export class SelfCritiqueNode {
  async run(rawFindings: readonly RawFinding[]): Promise<CritiqueFinding[]> {
    return rawFindings.map((finding) => ({ ...finding, verdict: 'KEEP' }));
  }
}

/**
 * EvaluateNode — week-1 stub: 2 hardcoded raw findings against Peregrine PDP.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.5 §6 T-SKELETON-004
 *         (acceptance: returns 2 hardcoded raw findings; each tagged
 *         `{ source: 'skeleton-stub' }` for telemetry; observations MUST
 *         NOT contain banned conversion-prediction phrasing per R5.3 +
 *         GR-007 — static-check unit test enforces).
 *
 * Status: complete-but-stubbed (per roadmap §3 conventions). Returns
 * deterministic findings referencing observable filteredDOM elements from
 * the Peregrine PDP perception fixture (T-SKELETON-002), linked to 2 of
 * the 3 SKELETON-* heuristic fixtures (T-SKELETON-003) by id only — never
 * by body content (R6).
 *
 * Phase 7 T117 + T119 supersedes with the first real Claude `evaluate`
 * call in week 5 (★ first critical risk gate ★ — R10/R13 temperature=0
 * first runtime activation; R6 LangSmith trace channel; R14.1 atomic LLM
 * logging). R20 impact.md required at that transition (EvaluateNode
 * behavior + LLMAdapter activation per roadmap §8 promotion table).
 *
 * R5.3 + GR-007 absolute conversion-prediction ban (CRITICAL):
 *   - The hardcoded `observation` strings below MUST NOT match banned
 *     regex patterns (e.g., "increase conversion", "%lift", "ROI of N",
 *     "uplift", "drive sales").
 *   - Static-check unit test at `tests/unit/analysis/nodes/EvaluateNode.test.ts`
 *     enforces; representative regex pack defined there. Phase 7 T123
 *     (week 7) ships the canonical GR-007 grounding rule.
 *   - Roadmap §6 special kill trigger: stub finding with banned
 *     phrasing → STOP per R23 + R5.3.
 *
 * R6 IP-boundary discipline:
 *   - Observations may reference: heuristic_id (id only) + benchmark.value
 *     (numeric structured schema field; e.g., "44px minimum touch target").
 *   - Observations MUST NOT reference: heuristic.body prose content.
 *
 * R10 compliance: file ≤ 100 lines.
 */
import { type PageStateModel } from '../../perception/types.js';
import { type HeuristicExtended } from '../heuristics/types.js';
import { type RawFinding } from '../../audit/types.js';

/**
 * Stable telemetry tag — Phase 7 T117 will replace with model-id +
 * temperature snapshot per R10/R14.1 once real Claude lands.
 */
const SKELETON_STUB_SOURCE = 'skeleton-stub' as const;

export class EvaluateNode {
  async run(
    perception: PageStateModel,
    heuristics: readonly HeuristicExtended[],
  ): Promise<RawFinding[]> {
    // Defensive: no heuristics loaded → no findings (don't fabricate
    // findings against non-existent heuristic ids per R23 scope kill).
    if (heuristics.length === 0) return [];

    const url = perception.metadata.url;

    return [
      {
        id: 'skl-finding-001',
        source: SKELETON_STUB_SOURCE,
        heuristic_id: 'SKELETON-CHECKOUT-001',
        page_url: url,
        observation:
          "The primary call-to-action 'Add to bag' is rendered at viewport coordinates (640, 420) with a 280×48px hit area; both dimensions meet or exceed the 44px minimum touch-target benchmark on mobile.",
      },
      {
        id: 'skl-finding-002',
        source: SKELETON_STUB_SOURCE,
        heuristic_id: 'SKELETON-CONTENT-003',
        page_url: url,
        observation:
          "Within the first viewport, the page presents a heading (360×36px), a price label (96×28px), and a CTA button (280×48px) in a single column at x=640. Multiple visually weighty elements compete for the user's attention; consider whether the dominant action is unambiguous.",
      },
    ];
  }
}

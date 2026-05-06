/**
 * EvaluateNode — placeholder for T-SKELETON-001 orchestrator scaffolding.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.3 §6 T-SKELETON-004.
 *
 * Status: minimal placeholder — returns []. T-SKELETON-004 enriches to
 * return 2 hardcoded raw findings (one per fixture page-state) tagged
 * `{ source: 'skeleton-stub' }` for telemetry per the roadmap §6
 * acceptance criterion.
 *
 * Phase 7 T117/T119 supersedes with the first real Claude evaluate call
 * in week 5 (R10/R13 temperature=0 first runtime activation; R6 LangSmith
 * trace channel; R14.1 atomic LLM logging).
 *
 * R5.3 + GR-007 absolute conversion-prediction ban (applies to stub data
 * per roadmap §10): when T-SKELETON-004 enriches, the hardcoded
 * `observation` strings MUST NOT match banned-phrase regex. Static-check
 * unit test on the stub data per the roadmap acceptance.
 *
 * R10 compliance: file ≤ 50 lines.
 */
// TODO(T-SKELETON-004): replace empty array with 2 hardcoded RawFinding
// values; verify R5.3 banned-phrase regex passes against `observation`.
import { type PageStateModel } from '../../perception/types.js';
import { type HeuristicExtended } from '../heuristics/types.js';
import { type RawFinding } from '../../audit/types.js';

export class EvaluateNode {
  async run(
    _perception: PageStateModel,
    _heuristics: readonly HeuristicExtended[],
  ): Promise<RawFinding[]> {
    return [];
  }
}

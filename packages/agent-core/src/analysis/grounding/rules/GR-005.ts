/**
 * GR-005 — heuristic_id in filtered set (AC-14).
 *
 * Phase 6 HeuristicLoader.loadForContext output is the source of truth for
 * which heuristics could legally fire on this page. EvaluateNode must
 * only emit findings tagged with one of those ids; any other id is a
 * hallucinated reference (or stale id from a deprecated heuristic).
 */
import { type GroundingRule, fail, PASS } from './types.js';

export const GR_005_heuristicInFilteredSet: GroundingRule = (
  finding,
  _perception,
  filteredHeuristics,
) => {
  const ids = new Set(filteredHeuristics.map((h) => (h as { id: string }).id));
  if (ids.has(finding.heuristic_id)) return PASS;
  return fail(
    `GR-005: heuristic_id "${finding.heuristic_id}" not in filtered heuristic set (size=${ids.size}).`,
  );
};

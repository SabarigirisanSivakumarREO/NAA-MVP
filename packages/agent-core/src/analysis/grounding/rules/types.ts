/**
 * Grounding rule contract (Phase 7 Block C1, AC-10..AC-17).
 *
 * Pure deterministic predicate — NO LLM, NO I/O, NO time. Same input →
 * same output. Tests verify accept + reject cases per rule.
 *
 * Spec: phases/phase-7-analysis/tasks.md Block C1 "Each acceptance" +
 *       REQ-ANALYZE-GROUND-001.
 */
import type { CritiqueFinding } from '../../../orchestration/AnalysisState.js';
import type { AnalyzePerception } from '../../types.js';
import type { HeuristicExtended } from '../../heuristics/types.js';

export type GroundingResult =
  | { readonly pass: true }
  | { readonly pass: false; readonly reason: string };

export type GroundingRule = (
  finding: CritiqueFinding,
  perception: AnalyzePerception,
  filteredHeuristics: ReadonlyArray<HeuristicExtended>,
) => GroundingResult;

export const PASS: GroundingResult = { pass: true };
export const fail = (reason: string): GroundingResult => ({ pass: false, reason });

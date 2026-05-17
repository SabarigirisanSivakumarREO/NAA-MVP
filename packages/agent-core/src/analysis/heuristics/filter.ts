/**
 * Two-stage heuristic filter + prioritizer (T107).
 *
 * Source: docs/specs/mvp/phases/phase-6-heuristics/spec.md AC-05 / AC-06 / AC-07;
 *         tasks.md T107.
 *
 * Pure functions — no I/O, no side effects (apart from optional Pino info
 * log when a logger is provided). All three exports return ReadonlyArray
 * to discourage downstream mutation. Selector semantics ("undefined or
 * empty selector means applies to all") delegate to `matchesSelector` in
 * ./types.ts so Phase 4b T4B-013 stays bit-for-bit aligned.
 *
 * R6 IP-boundary: only metadata is logged (filter_stage + counts). Heuristic
 * body / benchmark / provenance content NEVER touches the log call; even if
 * it did, the production Pino logger's `redact.paths` in
 * ../../observability/logger.ts would strip it (defence in depth).
 *
 * R10: file is well under 200 lines, named exports only, no `any`.
 */
import type { Logger } from '../../observability/logger.js';
import {
  matchesSelector,
  type HeuristicExtended,
  type PRELIMINARY_BUSINESS_ARCHETYPES,
  type PRELIMINARY_PAGE_TYPES,
} from './types.js';

type BusinessArchetype = (typeof PRELIMINARY_BUSINESS_ARCHETYPES)[number];
type PageType = (typeof PRELIMINARY_PAGE_TYPES)[number];

export interface FilterOptions {
  /** Optional Pino logger; if provided, an info-level metadata line is emitted. */
  logger?: Logger;
}

/**
 * Stage 1 — reduce a heuristic library by business archetype.
 *
 * Includes every heuristic whose `archetype` manifest selector matches
 * the given archetype (or is absent / empty — "applies to all").
 *
 * @example
 *   const stage1 = filterByBusinessType(library, 'D2C');
 */
export function filterByBusinessType(
  set: ReadonlyArray<HeuristicExtended>,
  archetype: BusinessArchetype,
  opts?: FilterOptions,
): ReadonlyArray<HeuristicExtended> {
  const out = set.filter((h) => matchesSelector(h.archetype, archetype));
  if (opts?.logger) {
    opts.logger.info(
      { filter_stage: 'business_type', input_count: set.length, output_count: out.length },
      'heuristic filter stage applied',
    );
  }
  return out;
}

/**
 * Stage 2 — reduce a Stage-1 result by page type.
 *
 * Includes every heuristic whose `page_type` manifest selector matches
 * the given page type (or is absent / empty — "applies to all").
 */
export function filterByPageType(
  stage1Result: ReadonlyArray<HeuristicExtended>,
  pageType: PageType,
  opts?: FilterOptions,
): ReadonlyArray<HeuristicExtended> {
  const out = stage1Result.filter((h) => matchesSelector(h.page_type, pageType));
  if (opts?.logger) {
    opts.logger.info(
      { filter_stage: 'page_type', input_count: stage1Result.length, output_count: out.length },
      'heuristic filter stage applied',
    );
  }
  return out;
}

/**
 * Sort by `business_impact_weight` DESC, tie-break by `id` ASC, take top
 * `cap`. Deterministic: two calls on the same input produce deep-equal
 * output (no `Math.random`, no `Date.now`, no in-place mutation of the
 * caller's array — we copy via `.slice()` before sorting).
 */
export function prioritizeHeuristics(
  stage2Result: ReadonlyArray<HeuristicExtended>,
  cap: number,
): ReadonlyArray<HeuristicExtended> {
  const sorted = stage2Result.slice().sort((a, b) => {
    if (b.business_impact_weight !== a.business_impact_weight) {
      return b.business_impact_weight - a.business_impact_weight;
    }
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
  return sorted.slice(0, cap);
}

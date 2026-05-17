/**
 * Phase 2 analysis layer barrel — public surface for upstream consumers
 * (Phase 2 page_analyze tool, Phase 7 DeepPerceiveNode + grounding rules,
 * Phase 9 ReportGenerator).
 *
 * Source: docs/specs/mvp/phases/phase-2-tools/plan.md §"Project Structure"
 *         (analysis/index.ts barrel export); tasks.md T-PHASE2-TYPES.
 *
 * R10.3: named exports only. No default exports.
 *
 * Phase 2 scope at T-PHASE2-TYPES: AnalyzePerception types from types.ts +
 * sub-schemas from analyzePerception.subschemas.ts (for the rare consumer
 * that needs a parser for a single sub-shape — e.g., a grounding rule
 * validating pre-extracted CTA data).
 *
 * Existing analysis subdirs (grounding/, heuristics/, nodes/) are Phase 1c
 * forward-stubs / Phase 7 pre-work and remain accessible via their own
 * sub-paths; this barrel deliberately does NOT re-export them to keep the
 * public surface narrow.
 */
export * from './types.js';
export * from './analyzePerception.subschemas.js';
export * from './heuristics/index.js';

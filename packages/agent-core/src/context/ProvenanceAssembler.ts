/**
 * Phase 4b T4B-007 — ProvenanceAssembler: validate, sort, and freeze the
 * per-inferrer ProvenanceEntry rows that compose a ContextProfile's
 * `provenance[]` field (sibling of ConfidenceScorer; same task).
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.2
 *     (REQ-CONTEXT-OUT-001 — provenance present on every output)
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-07
 *     (every field tagged with source ∈ {user, url_pattern, schema_org,
 *      copy_inference, layout_inference, default})
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-007 (L131-137)
 *   packages/agent-core/src/types/context-profile.ts —
 *     ProvenanceEntrySchema (validation source of truth).
 *
 * # Contract (AC-07 — see context-confidence-scorer.test.ts blocks 8-11)
 *
 * 1. Validate every input entry via `ProvenanceEntrySchema.parse()` —
 *    throws on shape violation (missing `dimension`, out-of-range
 *    confidence, etc.).
 * 2. Sort by (dimension, source, inferred_at) ascending — deterministic
 *    output supports R-03 hash stability + idempotent re-runs.
 * 3. Return frozen array — downstream consumers cannot mutate the
 *    aggregated provenance log.
 *
 * # Algorithm
 *
 * Pure function. No business logic. No IO. No defaults injected.
 * `entries: []` returns `provenance: []` (frozen, no throw).
 *
 * # Sort key
 *
 * - `dimension` — alphabetical (audience < brand < business < page < traffic)
 * - `source` — alphabetical (copy_inference < default < layout_inference <
 *   schema_org < url_pattern < user)
 * - `inferred_at` — chronological ascending (Date.getTime())
 *
 * Stable sort across equal keys (Node.js Array.prototype.sort is stable
 * since V8 7.0 / Node 12).
 *
 * # Constitution compliance
 *
 * R3.1 TDD: conformance test written first; this impl follows.
 * R10.1 file ≤ 300 LOC. R10.3 named exports only. R10.6 no console.log.
 * R2 no `any` — Zod parses unknown input at the boundary.
 * R6 no heuristic-content reference (pure plumbing).
 * R9 zero vendor SDK imports — only `../types/context-profile.js`.
 * R14 NOT applicable — pure functional assembler; no Pino.
 * R25 NO Playwright; NO LLMAdapter; NO judgment fields; NO silent defaults
 *   (caller supplies entries with explicit source — assembler emits no
 *   defaults of its own).
 * R11.4/R20 — context-profile.ts shape NOT modified (LOCKED).
 */
import {
  type ProvenanceEntry,
  ProvenanceEntrySchema,
} from '../types/context-profile.js';

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface ProvenanceAssemblerInput {
  /**
   * Per-inferrer provenance entries. Each upstream inferrer
   * (BusinessArchetypeInferrer, PageTypeInferrer, etc.) emits one entry;
   * caller aggregates them into this list before assembly.
   *
   * `unknown[]` accepted at the contract boundary; Zod enforces shape
   * inside assemble().
   */
  readonly entries: ReadonlyArray<unknown>;
}

export interface ProvenanceAssemblerResult {
  /**
   * Validated, sorted, frozen provenance log. Sort order:
   * (dimension asc, source asc, inferred_at asc).
   */
  readonly provenance: ReadonlyArray<ProvenanceEntry>;
}

// ---------------------------------------------------------------------------
// Pure assembler
// ---------------------------------------------------------------------------

/**
 * Validate + sort + freeze the per-inferrer provenance entries.
 *
 * Stateless; safe for concurrent use. Does not mutate inputs.
 * Throws on Zod validation failure (returns no partial result).
 *
 * @param input — `entries: unknown[]` (validated against ProvenanceEntrySchema).
 * @returns `{provenance: ReadonlyArray<ProvenanceEntry>}` — frozen.
 */
export function assembleProvenance(
  input: ProvenanceAssemblerInput,
): ProvenanceAssemblerResult {
  // 1. Validate every entry via Zod. Throws on shape violation.
  const validated: ProvenanceEntry[] = input.entries.map((e) =>
    ProvenanceEntrySchema.parse(e),
  );

  // 2. Sort by (dimension, source, inferred_at) ascending. Stable sort.
  validated.sort(compareProvenance);

  // 3. Freeze and return.
  return {
    provenance: Object.freeze(validated),
  };
}

/**
 * Comparator: (dimension, source, inferred_at) ascending.
 * String compare uses lexical (Unicode codepoint) ordering — sufficient
 * for the LOCKED enum sets in context-profile.ts.
 */
function compareProvenance(a: ProvenanceEntry, b: ProvenanceEntry): number {
  if (a.dimension !== b.dimension) {
    return a.dimension < b.dimension ? -1 : 1;
  }
  if (a.source !== b.source) {
    return a.source < b.source ? -1 : 1;
  }
  const aTime = a.inferred_at.getTime();
  const bTime = b.inferred_at.getTime();
  if (aTime !== bTime) {
    return aTime < bTime ? -1 : 1;
  }
  return 0;
}

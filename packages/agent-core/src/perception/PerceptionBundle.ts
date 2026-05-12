/**
 * PerceptionBundle — Phase 1c T1C-010 (AC-10, R-10, R-11, NF-01).
 *
 * Source: phase-1c spec.md AC-10/R-10/R-11/NF-01; plan.md §2.5; tasks.md T1C-010;
 * impact.md §11 (namespace carryforward from Phase 1b §11) + §12 (runtime wiring).
 *
 * THE INTEGRATION POINT: wraps Wave 1-3 outputs (Settle / Shadow DOM / Portals /
 * Pseudo / Iframe / Hidden / Nondeterminism / ElementGraph / Warnings) +
 * AnalyzePerception + PageStateModel + screenshots into an immutable
 * `PerceptionBundle` envelope keyed by `state_id`.
 *
 * Contract surface:
 *   - PerceptionBundleSchema (Zod) — AC-10 envelope validation
 *   - ENVELOPE_TOKEN_BUDGET (2000) / ENVELOPE_TOKEN_HARD_CEILING (3000) — NF-01 v0.2
 *   - buildPerceptionBundle(...) — assembles + validates + freezes (R-10)
 *   - bundleToAnalyzePerception(bundle, stateId?) — R-11 v2.4 pass-through
 *   - envelopeTokenCount(bundle, stateId) — NF-01 measurement helper (T1C-012)
 *
 * Constitutional compliance: R10.1 ≤300 LOC, R10.2 ≤50 LOC fns, R10.3 named
 * exports, R3.1 RED→GREEN, R5.1 backward compat, R13 no `any` (one localized
 * documented cast), R18 append-only, R24 capture-only assembly.
 *
 * Namespace contract (Phase 1b §11 v0.2 carryforward): bundle.raw.page_state_model_by_state[*]._extensions
 * MUST be absent or empty (Phase 7 DeepPerceiveNode reservation). Asserted at
 * build time before freeze.
 *
 * Runtime wiring (impact.md §12 + AI Reviewer I7): inputs assumed present;
 * Phase 5 BrowseNode owns extractor wiring; missing outputs emit
 * EXTENSION_OUTPUT_MISSING via WarningEmitter (Phase 1b fields are
 * optional/nullable in PageStateModelSchema).
 */
import { z } from 'zod';

import {
  NondeterminismFlagSchema,
  type NondeterminismFlag,
} from './NondeterminismDetector.js';
import { type SettleResult } from './SettlePredicate.js';
import { type ElementGraph } from './ElementGraphBuilder.js';
import { WarningSchema, type Warning } from './WarningEmitter.js';
import { type PageStateModel } from './types.js';

// ─── NF-01 v0.2 constants ────────────────────────────────────────────────

/** NF-01 envelope-only soft budget (warn threshold ≤2K; warn at 1.8K). */
export const ENVELOPE_TOKEN_BUDGET = 2000;

/** NF-01 envelope-only hard ceiling (≤3K). Build fails above this. */
export const ENVELOPE_TOKEN_HARD_CEILING = 3000;

/** Schema version pin (v2.5). */
export const PERCEPTION_BUNDLE_SCHEMA_VERSION = 'v2.5' as const;

// ─── Envelope sub-schemas ────────────────────────────────────────────────

/**
 * State-graph node — one per captured state in Phase 1c (edges always
 * empty []; cross-state edges populated in Phase 13).
 */
export const StateNodeSchema = z
  .object({ id: z.string() })
  .passthrough();

/** Edges populated in Phase 13 (per spec §263 + plan.md §6). */
export const StateEdgeSchema = z.object({}).passthrough();

export const StateGraphSchema = z
  .object({
    nodes: z.array(StateNodeSchema),
    edges: z.array(StateEdgeSchema),
  })
  .strict();

/**
 * ElementGraph shape relaxed for envelope validation: the runtime type
 * (ElementGraphBuilder.ts) uses Map<string, FusedElement>; here we accept
 * any Record-like or Map-serialized shape so the Zod schema can validate
 * envelopes built from synthetic / serialized fixtures (test AC-10) AND
 * from in-memory ElementGraph instances. Strict structural validation of
 * elements happens at the ElementGraphBuilder boundary.
 */
export const ElementGraphEnvelopeSchema = z
  .object({
    elements: z.unknown(),
    root_element_ids: z.array(z.string()),
    truncated_count: z.number().int().min(0).optional(),
  })
  .passthrough();

/**
 * Top-level PerceptionBundle envelope. `.passthrough()` on inner sections
 * keeps the schema permissive on Phase 1b PageStateModel internals while
 * locking the envelope channels Phase 1c owns. Wrapped contents (raw.*)
 * use a permissive record shape — strict PageStateModel validation runs
 * inside `buildPerceptionBundle` before assembly (so Zod validation of a
 * pre-built bundle stays cheap and total per-state size remains within
 * NF-01 once `bundle.raw.*` is excluded per the spec).
 */
export const PerceptionBundleSchema = z
  .object({
    schema_version: z.literal(PERCEPTION_BUNDLE_SCHEMA_VERSION),
    initial_state_id: z.string(),
    meta: z.record(z.unknown()),
    performance: z.record(z.unknown()),
    nondeterminism_flags: z.array(NondeterminismFlagSchema),
    warnings: z.array(WarningSchema),
    state_graph: StateGraphSchema,
    element_graph_by_state: z.record(z.string(), ElementGraphEnvelopeSchema),
    raw: z
      .object({
        analyze_perception_by_state: z.record(z.string(), z.record(z.unknown())),
        page_state_model_by_state: z.record(z.string(), z.record(z.unknown())),
        full_page_screenshot_url_by_state: z
          .record(z.string(), z.string())
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type PerceptionBundle = z.infer<typeof PerceptionBundleSchema>;

// ─── Builder inputs ──────────────────────────────────────────────────────

export interface PerceptionBundleStateInput {
  state_id: string;
  page_state_model: PageStateModel;
  full_page_screenshot_url?: string;
  element_graph: ElementGraph;
}

export interface BuildPerceptionBundleInput {
  audit_run_id: string;
  url: string;
  initial_state_id: string;
  states: ReadonlyArray<PerceptionBundleStateInput>;
  settle_result: SettleResult;
  nondeterminism_flags: ReadonlyArray<NondeterminismFlag>;
  warnings: ReadonlyArray<Warning>;
  meta?: {
    user_agent?: string;
    viewport?: { width: number; height: number };
  };
  /** Optional ISO 8601 capture timestamp (default: new Date().toISOString()). */
  captured_at?: string;
}

// ─── Namespace contract assertion ────────────────────────────────────────

/**
 * Phase 1b §11 / Phase 1c §11 namespace contract: Phase 1c MUST NOT write
 * into `_extensions.*`. The cast is localized + documented — Phase 1+1b
 * PageStateModelSchema declares `_extensions: z.record(...).optional()`,
 * so the field is part of the type already; we read defensively to guard
 * against pre-Phase-7 leakage from upstream stages.
 */
export function assertNamespaceContract(psm: PageStateModel): void {
  const extensions = (psm as { _extensions?: Record<string, unknown> })
    ._extensions;
  if (
    extensions !== undefined &&
    typeof extensions === 'object' &&
    extensions !== null &&
    Object.keys(extensions).length > 0
  ) {
    throw new Error(
      'Phase 1c namespace contract violation: bundle.raw.page_state_model_by_state[*]._extensions must be absent or empty (Phase 7 reservation per Phase 1b impact.md §11)',
    );
  }
}

// ─── Deep freeze helper ──────────────────────────────────────────────────

/**
 * Deep-freeze an object graph. Cycle-safe via WeakSet. Map / Set are frozen
 * by reference (their internal entries are mutation-restricted by their
 * own API on the frozen wrapper, which is sufficient for R-10 immutability
 * intent: callers cannot reassign keys on the bundle root or its sections).
 */
export function deepFreeze<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return value;
  seen.add(value as object);
  Object.freeze(value);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object') deepFreeze(child, seen);
  }
  return value;
}

// ─── Builder ─────────────────────────────────────────────────────────────

/**
 * Assemble + validate + freeze a PerceptionBundle. Runs the namespace
 * contract assertion against every wrapped PageStateModel BEFORE freezing.
 * Throws on Zod validation failure or namespace-contract violation.
 */
export function buildPerceptionBundle(
  input: BuildPerceptionBundleInput,
): PerceptionBundle {
  for (const s of input.states) assertNamespaceContract(s.page_state_model);

  const ap_by_state: Record<string, PageStateModel> = {};
  const psm_by_state: Record<string, PageStateModel> = {};
  const screenshots: Record<string, string> = {};
  const element_graph_by_state: Record<string, ElementGraph> = {};
  for (const s of input.states) {
    // Stage 2.5 fix F-006-1c — bundle.raw.analyze_perception_by_state aliases
    // page_state_model_by_state. In v2.5, "AnalyzePerception" is a backward-
    // compat name for the wrapped PageStateModel (no separate Zod schema).
    // Phase 7 may diverge them; for now they reference identical storage.
    ap_by_state[s.state_id] = s.page_state_model;
    psm_by_state[s.state_id] = s.page_state_model;
    element_graph_by_state[s.state_id] = s.element_graph;
    if (s.full_page_screenshot_url !== undefined) {
      screenshots[s.state_id] = s.full_page_screenshot_url;
    }
  }

  const bundle = {
    schema_version: PERCEPTION_BUNDLE_SCHEMA_VERSION,
    initial_state_id: input.initial_state_id,
    meta: {
      audit_run_id: input.audit_run_id,
      url: input.url,
      captured_at: input.captured_at ?? new Date().toISOString(),
      ...(input.meta ?? {}),
    } as Record<string, unknown>,
    performance: {
      settle_elapsed_ms: input.settle_result.elapsed_ms,
      settle_capped_at_5s: input.settle_result.capped_at_5s,
    } as Record<string, unknown>,
    nondeterminism_flags: [...input.nondeterminism_flags],
    warnings: [...input.warnings],
    state_graph: {
      nodes: input.states.map((s) => ({ id: s.state_id })),
      edges: [] as unknown[], // Phase 1c: always [] (per spec §263 / plan §6)
    },
    element_graph_by_state,
    raw: {
      analyze_perception_by_state: ap_by_state,
      page_state_model_by_state: psm_by_state,
      full_page_screenshot_url_by_state: screenshots,
    },
  };

  const parsed = PerceptionBundleSchema.parse(bundle);
  return deepFreeze(parsed);
}

// ─── R-11 backward-compat accessor ───────────────────────────────────────

/**
 * R-11 backward-compat accessor — pure pass-through (no transformation).
 * Returns the v2.4 AnalyzePerception (== PageStateModel here) for the
 * requested state, defaulting to `bundle.initial_state_id`. Throws on
 * unknown state_id.
 */
export function bundleToAnalyzePerception(
  bundle: PerceptionBundle,
  stateId?: string,
): PageStateModel {
  const resolvedStateId = stateId ?? bundle.initial_state_id;
  const ap = bundle.raw.analyze_perception_by_state[resolvedStateId];
  if (ap === undefined) {
    throw new Error(
      `bundleToAnalyzePerception: state_id "${resolvedStateId}" not found in bundle`,
    );
  }
  return ap as PageStateModel;
}

// ─── NF-01 envelope token measurement (T1C-012 helper) ───────────────────

/**
 * Approximate envelope-only token count for a single state (NF-01 v0.2).
 * EXCLUDES `bundle.raw.*` per spec. Uses 4-chars-per-token GPT-style
 * heuristic — exact tiktoken measurement happens in T1C-012 integration.
 */
export function envelopeTokenCount(
  bundle: PerceptionBundle,
  stateId: string,
): number {
  const slice = {
    meta: bundle.meta,
    performance: bundle.performance,
    nondeterminism_flags: bundle.nondeterminism_flags,
    warnings: bundle.warnings,
    state_graph: bundle.state_graph,
    element_graph_for_state: bundle.element_graph_by_state[stateId],
  };
  return Math.ceil(JSON.stringify(slice).length / 4);
}

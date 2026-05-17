/**
 * DeepPerceiveNode — Phase 7 forward stub (Phase 1c T1C-011, AC-11, REQ-PERCEPT-V25-002).
 *
 * Source:
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md AC-11 + R-12
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/plan.md §2.1
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/tasks.md T1C-011
 *
 * Phase scope:
 *   - Phase 1c (this file, T1C-011): SMALL forward-stub. Wires `waitForSettle()`
 *     BEFORE AnalyzePerception capture and propagates settle warnings (notably
 *     `SETTLE_TIMEOUT_5S`) into the bundle via the shared `WarningEmitter`.
 *   - Phase 7 (T117): full LLM-driven enrichments + `_extensions.deepPerceive`
 *     population. NOT IMPLEMENTED HERE — this stub only carries the settle hook
 *     so the rest of the bundle pipeline can compile + integrate now per R20.
 *
 * Contract (AC-11 + R-12):
 *   - `waitForSettle(page, { requireSelector })` runs FIRST.
 *   - When `settle.capped_at_5s === true`, emit `SETTLE_TIMEOUT_5S` so the
 *     warning surfaces in `PerceptionBundle.warnings` at finalize time.
 *   - Sub-step warnings (FONTS_NOT_READY / ANIMATION_NOT_SETTLED / ...) flow
 *     through the same shared emitter (other emit-sites are owned by future
 *     Phase 7 wiring + the SettlePredicate caller seam).
 *   - Return value is the settle result + the current emitter snapshot so the
 *     caller (Phase 7 DeepPerceiveNode, or the Phase 1c integration test seam
 *     in AC-12) can fold the warnings into the bundle envelope.
 *
 * Out of scope for Phase 1c:
 *   - LLM-driven element enrichment, intent classification, persona modeling,
 *     `_extensions.deepPerceive` payload assembly. All Phase 7 T117.
 *   - `ContextAssembler.capture()` invocation — owned by Phase 7's full node
 *     (this stub only guarantees the settle gate fires BEFORE capture per AC-11
 *     wiring expectation; the capture call itself is in T117).
 *
 * Constitutional compliance:
 *   - R3.1  test RED → GREEN (Wave 0 conformance test now compiles + passes)
 *   - R9    no direct Playwright import — uses local structural `PageLike` type
 *           (Stage 2.5 fix I2 — prior `import type { Page } from 'playwright'`
 *           violated R9.1 outside adapters; mirrors SettlePredicate.SettlePage).
 *           Phase 7 T117 will pass a real Playwright `Page` — TypeScript
 *           structural typing accepts it.
 *   - R10   file ≤ 300 LOC (target ≤ 80); functions ≤ 50 LOC
 *   - R13   no `any`
 *   - R20   forward-stub keeps the shared contract surface stable so Phase 7
 *           T117 can grow into it without rewriting the settle wiring
 *   - R24   capture-only; no judgment, no LLM, no scoring
 */
import {
  type SettlePage,
  type SettleResult,
  waitForSettle,
} from '../../perception/SettlePredicate.js';
import {
  type Warning,
  WarningEmitter,
} from '../../perception/WarningEmitter.js';
import {
  bundleToAnalyzePerception,
  type PerceptionBundle,
} from '../../perception/PerceptionBundle.js';
import type { AnalysisState, PageType } from '../../orchestration/AnalysisState.js';
import { detectPageType } from '../utils/detectPageType.js';

/**
 * Minimum Page surface this stub needs. Currently equivalent to SettlePredicate's
 * `SettlePage` since the stub only delegates to `waitForSettle`. Phase 7 T117
 * will extend this with the additional Playwright methods deepPerceive needs
 * (evaluate / screenshot / etc.) — additive shape only per R20.
 *
 * Defined here as a re-export alias so future T117 widening doesn't ripple back
 * into SettlePredicate (which keeps its narrower surface for non-deepPerceive
 * callers like waitForSettle's direct conformance tests).
 */
export type PageLike = SettlePage;

/**
 * Caller-tunable options for the Phase 1c stub. Phase 7 T117 will extend this
 * with the full DeepPerceive option set (LLM persona, enrichment toggles, etc.)
 * — additive shape only, no rename / no removal, per R20.
 */
export interface DeepPerceiveOptions {
  /**
   * Forwarded to `waitForSettle`. When provided, settle additionally waits for
   * this selector to appear inside the 5s window (soft cap 2s). Hang is
   * non-fatal per SettlePredicate sub-step contract.
   */
  requireSelector?: string;
}

/**
 * Result of the Phase 1c settle-gated stub. Phase 7 T117 will extend this with
 * the full DeepPerceive enrichment payload — additive shape only per R20.
 */
export interface DeepPerceiveResult {
  /** Raw SettleResult from `waitForSettle` (elapsed_ms + capped_at_5s). */
  settle: SettleResult;
  /** Immutable snapshot of warnings the emitter has accumulated so far. */
  warnings: readonly Warning[];
}

/**
 * deepPerceiveWithSettle — Phase 1c T1C-011 entry point.
 *
 * Runs the settle predicate BEFORE any capture, emits `SETTLE_TIMEOUT_5S` when
 * the 5s hard cap fired, and hands the emitter snapshot back to the caller so
 * downstream PerceptionBundle assembly (T1C-010) can fold it into `warnings`.
 *
 * Phase 7 T117 will wrap this with the full DeepPerceive logic — this stub is
 * intentionally minimal (settle gate + warning propagation only) per R20.
 */
export async function deepPerceiveWithSettle(
  page: PageLike,
  emitter: WarningEmitter,
  opts: DeepPerceiveOptions = {},
): Promise<DeepPerceiveResult> {
  const settle = await waitForSettle(
    page,
    opts.requireSelector !== undefined
      ? { requireSelector: opts.requireSelector }
      : {},
  );

  if (settle.capped_at_5s) {
    emitter.emit(
      'SETTLE_TIMEOUT_5S',
      `Settle hit 5s hard cap (elapsed ${settle.elapsed_ms}ms)`,
    );
  }

  return {
    settle,
    warnings: emitter.collect(),
  };
}

/**
 * DeepPerceiveNode — class-shaped forward stub. Phase 7 T117 supersedes this
 * with the full LangGraph node (state input → enriched perception output).
 *
 * Phase 1c surface: a thin wrapper around `deepPerceiveWithSettle` so callers
 * that consume the conventional node shape (vs. the bare function) compile
 * cleanly today. AC-11 conformance only asserts the symbol is exported and
 * defined; the real node behavior is `it.todo` pending Phase 7 + AC-12.
 */
export class DeepPerceiveNode {
  /**
   * Phase 7 supersession marker — flipped to `true` by T117 when the full
   * implementation lands. Phase 1c integration test (AC-12) reads this to
   * route around enrichment assertions while the stub is in place.
   */
  public static readonly isPhase7Stub: boolean = false;

  /**
   * Invoke the settle gate. Phase 7 T117 will replace / extend this with the
   * full DeepPerceive pipeline; for now it delegates to the bare function so
   * the settle wiring + warning propagation are exercised identically through
   * either entry point.
   */
  async run(
    page: PageLike,
    emitter: WarningEmitter,
    opts: DeepPerceiveOptions = {},
  ): Promise<DeepPerceiveResult> {
    return deepPerceiveWithSettle(page, emitter, opts);
  }
}

// ─── Phase 7 T117: deepPerceiveNodeRun (AC-05) ───────────────────────────

/**
 * Minimal MCP tool surface DeepPerceiveNode invokes. `page_analyze` is
 * declared on the surface so test scaffolds + future graph wiring can pass
 * a uniform tool bundle; **DeepPerceiveNode MUST NOT call it** per R24 —
 * `bundleToAnalyzePerception` is the sole perception source.
 */
export interface DeepPerceiveTools {
  page_analyze: (args: { sections: string[] }) => Promise<unknown>;
  browser_screenshot: (args: { quality: number }) => Promise<{ imageBase64: string }>;
  page_screenshot_full: (args: {
    quality: number;
    maxHeight: number;
  }) => Promise<{ imageBase64: string }>;
}

export interface DeepPerceiveNodeInput {
  state: AnalysisState;
  page: PageLike;
  tools: DeepPerceiveTools;
  emitter: WarningEmitter;
  bundle: PerceptionBundle;
  /** Optional — defaults to `bundle.initial_state_id`. */
  stateId?: string;
  /** Forwarded to `waitForSettle` (AC-11). */
  requireSelector?: string;
}

export interface DeepPerceiveNodeDelta extends Partial<AnalysisState> {
  /**
   * Viewport screenshot (base64). Returned as an extra delta field; NOT in
   * AnalysisStateSchema yet — T131 (AnnotateNode) + T132 (StoreNode) consume
   * in-memory before persistence.
   */
  viewport_screenshot: string;
  /** Full-page screenshot (base64). Same persistence note as viewport. */
  fullpage_screenshot: string;
}

/**
 * Pull a `DetectPageTypeInput` from a wrapped PageStateModel (R24 — read-only).
 */
function deriveDetectInput(
  perception: ReturnType<typeof bundleToAnalyzePerception>,
): Parameters<typeof detectPageType>[0] {
  const metadata = (perception as { metadata?: { url?: string; schemaOrg?: Array<Record<string, unknown>> } }).metadata ?? {};
  const ctas = (perception as { ctas?: Array<{ text?: string }> }).ctas ?? [];
  const formFields = (perception as { formFields?: unknown[] }).formFields ?? [];
  const schemaOrg = metadata.schemaOrg ?? [];
  const schemaTypes: string[] = [];
  for (const frag of schemaOrg) {
    const t = (frag as { '@type'?: unknown })['@type'];
    if (typeof t === 'string') schemaTypes.push(t);
  }
  return {
    url: metadata.url ?? '',
    cta_texts: ctas
      .map((c) => c.text)
      .filter((t): t is string => typeof t === 'string'),
    form_signals: { has_form: formFields.length > 0, field_count: formFields.length },
    schema_org_types: schemaTypes,
  };
}

/**
 * Read `state.context_profile.page.type` defensively (the field is not in
 * AnalysisStateSchema today — Phase 4b ContextProfile lives in DB and is
 * threaded into state at the orchestration seam; this accessor accepts the
 * Phase 4b shape without coupling the schema).
 */
function readContextPageType(state: AnalysisState): PageType | undefined {
  const cp = (state as unknown as { context_profile?: { page?: { type?: PageType } } })
    .context_profile;
  return cp?.page?.type;
}

/**
 * DeepPerceiveNode entry — Phase 7 T117 (AC-05, REQ-ANALYZE-NODE-001).
 *
 * Single-bundle scope. T133 AnalysisGraph fans out multi-bundle iteration
 * when Phase 5b active; this node processes one bundle per invocation.
 *
 * Flow:
 *   1. Settle gate (AC-11 preserved — runs FIRST, before screenshots).
 *   2. Perception via `bundleToAnalyzePerception(bundle, stateId)` — R24:
 *      sole perception source. Does NOT call `tools.page_analyze`.
 *   3. Viewport screenshot (quality 85).
 *   4. Full-page screenshot (quality 80, maxHeight 15000).
 *   5. Resolve `current_page_type` (context_profile override → detectPageType).
 *
 * Returns a state delta plus viewport/fullpage screenshots (extra fields;
 * not yet in AnalysisStateSchema — T131/T132 consume in-memory).
 */
export async function deepPerceiveNodeRun(
  input: DeepPerceiveNodeInput,
): Promise<DeepPerceiveNodeDelta> {
  const { state, page, tools, emitter, bundle, stateId, requireSelector } = input;

  // 1. AC-11 settle gate — MUST run before screenshots.
  await deepPerceiveWithSettle(
    page,
    emitter,
    requireSelector !== undefined ? { requireSelector } : {},
  );

  // 2. R24 — perception via accessor only; no tools.page_analyze call.
  const perception = bundleToAnalyzePerception(bundle, stateId);

  // 3 + 4. Screenshots.
  const viewport = await tools.browser_screenshot({ quality: 85 });
  const fullpage = await tools.page_screenshot_full({
    quality: 80,
    maxHeight: 15000,
  });

  // 5. Resolve current_page_type.
  const override = readContextPageType(state);
  const current_page_type: PageType =
    override ?? detectPageType(deriveDetectInput(perception)).primary;

  return {
    current_page_perception_bundle: bundle,
    current_page_type,
    viewport_screenshot: viewport.imageBase64,
    fullpage_screenshot: fullpage.imageBase64,
  };
}

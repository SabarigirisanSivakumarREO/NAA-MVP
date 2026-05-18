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

// ─── Phase 7 T119: evaluateNodeRun (AC-07, REQ-ANALYZE-NODE-002) ─────────
//
// Supersedes skeleton EvaluateNode class above. The class is preserved for
// walking-skeleton audit.ts compatibility (RawFinding shape in audit/types.ts);
// Phase 7 LangGraph orchestrator calls evaluateNodeRun() and consumes the
// canonical AnalysisState RawFinding shape.
//
// R10/R13 — TemperatureGuard first-runtime activation (operation:'evaluate').
// R5.5  — heuristics injected into USER MESSAGE only (system prompt cached).
// R6    — projectHeuristicPublic in prompts/evaluate.ts strips body/provenance/ai_review.
// R14.1 — atomic llm_call_log row written by AnthropicAdapter on every outcome.
// R14.2 — pre-call BudgetGate; BudgetExceededError → analysis_status='budget_exhausted_partial'.
// Retry — up to 2 retries (3 attempts total) on malformed LLM output;
//         exhaust → analysis_status='skipped_llm_output_invalid'.
import { z } from 'zod';
import {
  type AnalysisState,
  type AnalysisStatus,
  type RawFinding as Phase7RawFinding,
  RawFindingSchema,
} from '../../orchestration/AnalysisState.js';
import type { AnalyzePerception } from '../types.js';
import type { HeuristicExtended as Phase7Heuristic } from '../heuristics/types.js';
import {
  type LLMAdapter,
  BudgetExceededError,
  LLMUnavailableError,
  TemperatureGuardError,
} from '../../adapters/LLMAdapter.js';
import { EVALUATE_SYSTEM_PROMPT, buildEvaluateUserMessage } from '../prompts/evaluate.js';
import { prioritizeHeuristics } from '../heuristics/filter.js';

const EVALUATE_HEURISTIC_CAP = 30;
const EVALUATE_MAX_TOKENS = 4096;
const EVALUATE_MAX_ATTEMPTS = 3;

/**
 * Minimal duck-typed loader surface. Permits a real HeuristicLoader OR a
 * test mock to be passed without coupling EvaluateNode to PostgresStorage.
 */
export interface HeuristicLoaderSurface {
  loadForContext(
    profile: unknown,
    opts?: { heuristics?: ReadonlyArray<Phase7Heuristic> },
  ): Promise<Phase7Heuristic[]>;
}

export interface EvaluateNodeInput {
  readonly state: AnalysisState;
  readonly perception: AnalyzePerception;
  readonly llm: LLMAdapter;
  readonly heuristicLoader: HeuristicLoaderSurface;
  readonly auditRunId: string;
  readonly clientId?: string;
  readonly currentUrl: string;
  readonly pageTypeDetected: string;
  readonly businessType: string;
  /** Optional REQ-ANALYZE-PERSONA-002 — tagged onto each finding when set. */
  readonly persona?: string;
  /** Multi-bundle (Phase 5b): tag findings with viewport. */
  readonly viewport?: 'desktop' | 'mobile' | 'tablet';
}

export interface EvaluateNodeDelta extends Partial<AnalysisState> {
  readonly evaluate_findings_raw: Phase7RawFinding[];
  readonly analysis_status?: AnalysisStatus;
}

/**
 * Strip Markdown code fences if the LLM wrapped its JSON output.
 */
function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return (fenced?.[1] ?? trimmed).trim();
}

function tagFinding(
  f: Phase7RawFinding,
  persona: string | undefined,
  viewport: 'desktop' | 'mobile' | 'tablet' | undefined,
): Phase7RawFinding {
  if (persona === undefined && viewport === undefined) return f;
  const out: Phase7RawFinding = { ...f };
  if (persona !== undefined) out.persona = persona;
  if (viewport !== undefined) out.viewport = viewport;
  return out;
}

export async function evaluateNodeRun(input: EvaluateNodeInput): Promise<EvaluateNodeDelta> {
  const {
    state,
    perception,
    llm,
    heuristicLoader,
    auditRunId,
    clientId,
    currentUrl,
    pageTypeDetected,
    businessType,
    persona,
    viewport,
  } = input;

  // 1. Load + prioritize heuristics via Phase 4b context_profile.
  const contextProfile = (state as unknown as { context_profile?: unknown }).context_profile;
  const candidates = await heuristicLoader.loadForContext(contextProfile);
  const filtered = prioritizeHeuristics(candidates, EVALUATE_HEURISTIC_CAP);
  if (filtered.length === 0) {
    return { evaluate_findings_raw: [], analysis_status: 'complete_no_findings' };
  }

  // 2. Build prompts. R5.5 — heuristics in user msg only.
  const userPrompt = buildEvaluateUserMessage({
    perception,
    filteredHeuristics: filtered,
    currentUrl,
    pageTypeDetected,
    businessType,
    ...(persona !== undefined ? { persona } : {}),
  });

  // 3. Retry loop (≤ 2 retries on malformed output per spec §4.2).
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= EVALUATE_MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await llm.complete({
        operation: 'evaluate',
        audit_run_id: auditRunId,
        userPrompt,
        systemPrompt: EVALUATE_SYSTEM_PROMPT,
        temperature: 0,
        maxTokens: EVALUATE_MAX_TOKENS,
        ...(clientId !== undefined ? { client_id: clientId } : {}),
      });
      const payload = JSON.parse(extractJsonPayload(res.text)) as unknown;
      const findings = z.array(RawFindingSchema).parse(payload);
      return {
        evaluate_findings_raw: findings.map((f) => tagFinding(f, persona, viewport)),
      };
    } catch (err) {
      lastError = err;
      if (err instanceof BudgetExceededError) {
        return { evaluate_findings_raw: [], analysis_status: 'budget_exhausted_partial' };
      }
      if (err instanceof TemperatureGuardError) {
        return { evaluate_findings_raw: [], analysis_status: 'error_r10_temperature_guard_violation' };
      }
      if (err instanceof LLMUnavailableError) {
        return { evaluate_findings_raw: [], analysis_status: 'skipped_llm_output_invalid' };
      }
      // JSON.parse / Zod failure → loop until attempts exhausted.
    }
  }

  void lastError;
  return { evaluate_findings_raw: [], analysis_status: 'skipped_llm_output_invalid' };
}

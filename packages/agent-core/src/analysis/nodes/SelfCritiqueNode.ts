/**
 * SelfCritiqueNode — week-1 stub: passthrough with verdict='KEEP'.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.5 §6 T-SKELETON-005
 *         (acceptance: returns input passthrough with verdict='KEEP' on
 *         every finding).
 *
 * Status: complete-but-stubbed (per roadmap §3 conventions). Maps each
 * RawFinding to a CritiqueFinding tagged `verdict: 'KEEP'`; preserves
 * all upstream fields verbatim (id, source, heuristic_id, page_url,
 * observation). No filtering, no rejection — week 1 is happy-path-only.
 *
 * R5.6 forward path (Phase 7 T120/T121 — week 6):
 *   The real self-critique implementation MUST be a SEPARATE LLM call
 *   distinct from the evaluate call (R5.6 invariant). Verifiable via 2
 *   distinct llm_call_log rows per page after week 6 lands. The Phase 7
 *   T120 prompt template + T121 SelfCritiqueNode supersession will:
 *     - Issue a fresh Anthropic API call (not reuse the evaluate cache)
 *     - Use a DIFFERENT system prompt persona than evaluate (code review
 *       confirms personas differ)
 *     - Emit one of 4 verdicts: KEEP / REVISE / DOWNGRADE / REJECT (not
 *       just KEEP)
 *     - Return ~30% rejected raw findings on average (per Phase 7 spec)
 *     - Trigger R5.6 first-runtime conformance test (un-skip in week 6)
 *
 * R20 impact.md required at week-6 transition (SelfCritique behavior +
 * LLMAdapter SEPARATE-call activation per roadmap §8 promotion table).
 *
 * R10/R13 temperature=0 — N/A this week; activates with T121 in week 6.
 *
 * R5.3 + GR-007 — N/A this passthrough; the upstream EvaluateNode
 * (T-SKELETON-004) already enforced banned-phrase static-check on the
 * observation strings. Critique passthrough inherits that cleanliness.
 *
 * R6 — N/A; passthrough does not reference heuristic body content.
 *
 * R10 compliance: file ≤ 50 lines.
 */
import { type CritiqueFinding, type RawFinding } from '../../audit/types.js';

export class SelfCritiqueNode {
  async run(rawFindings: readonly RawFinding[]): Promise<CritiqueFinding[]> {
    return rawFindings.map((finding) => ({ ...finding, verdict: 'KEEP' }));
  }
}

// ─── Phase 7 T121: selfCritiqueNodeRun (AC-09, REQ-ANALYZE-NODE-003) ────
//
// Supersedes skeleton SelfCritiqueNode (passthrough verdict=KEEP). Skeleton
// class preserved for walking-skeleton audit.ts compatibility.
//
// R5.6 — SEPARATE LLM call (operation='self_critique'), distinct from
//   evaluate. NF-06 verifies via llm_call_log (2 rows per page).
// R10/R13 — temperature=0 (TemperatureGuard enforces).
// Persona divergence in system prompt enforced by self-critique-prompt
//   conformance test (Jaccard ≥ 0.5 + zero shared 5-grams).
import { z } from 'zod';
import {
  type RawFinding as Phase7RawFinding,
  type CritiqueFinding as Phase7CritiqueFinding,
  type AnalysisStatus,
  CritiqueVerdictEnum,
  CritiqueFindingSchema,
} from '../../orchestration/AnalysisState.js';
import type { AnalyzePerception } from '../types.js';
import {
  type LLMAdapter,
  BudgetExceededError,
  LLMUnavailableError,
  TemperatureGuardError,
} from '../../adapters/LLMAdapter.js';
import {
  SELF_CRITIQUE_SYSTEM_PROMPT,
  buildSelfCritiqueUserMessage,
} from '../prompts/selfCritique.js';

const SELF_CRITIQUE_MAX_TOKENS = 2048;
const SELF_CRITIQUE_MAX_ATTEMPTS = 3;

/**
 * Per-finding critique response shape (spec §4.3 RESPOND-with JSON template).
 * `revised_finding` may be a partial RawFinding patch (REVISE verdict);
 * structural validation deferred to per-verdict apply step below.
 */
const CritiqueResponseItemSchema = z
  .object({
    finding_index: z.number().int().nonnegative(),
    verdict: CritiqueVerdictEnum,
    reason: z.string().min(1),
    revised_finding: z.record(z.string(), z.unknown()).nullable().optional(),
    new_severity: z.enum(['critical', 'high', 'medium', 'low']).nullable().optional(),
  })
  .strict();

export interface SelfCritiqueNodeInput {
  readonly rawFindings: ReadonlyArray<Phase7RawFinding>;
  readonly perception: AnalyzePerception;
  readonly llm: LLMAdapter;
  readonly auditRunId: string;
  readonly clientId?: string;
}

export interface SelfCritiqueNodeDelta {
  readonly critique_findings: Phase7CritiqueFinding[];
  readonly analysis_status?: AnalysisStatus;
}

function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return (fenced?.[1] ?? trimmed).trim();
}

/**
 * Apply the LLM's per-finding verdict to the original raw finding. Returns
 * `null` for REJECT (caller drops). Output validated by CritiqueFindingSchema
 * so any malformed revised_finding patch surfaces as a Zod error → retry.
 */
function applyVerdict(
  original: Phase7RawFinding,
  response: z.infer<typeof CritiqueResponseItemSchema>,
): Phase7CritiqueFinding | null {
  if (response.verdict === 'REJECT') return null;
  const base: Phase7CritiqueFinding = {
    ...original,
    verdict: response.verdict,
    revision_notes: response.reason,
  };
  if (response.verdict === 'DOWNGRADE' && response.new_severity != null) {
    base.severity = response.new_severity;
  }
  if (response.verdict === 'REVISE' && response.revised_finding != null) {
    Object.assign(base, response.revised_finding);
  }
  return CritiqueFindingSchema.parse(base);
}

export async function selfCritiqueNodeRun(
  input: SelfCritiqueNodeInput,
): Promise<SelfCritiqueNodeDelta> {
  const { rawFindings, perception, llm, auditRunId, clientId } = input;

  const reviewable = rawFindings.filter((f) => f.status !== 'pass');
  if (reviewable.length === 0) {
    return { critique_findings: [] };
  }

  const userPrompt = buildSelfCritiqueUserMessage({ perception, rawFindings: reviewable });

  for (let attempt = 1; attempt <= SELF_CRITIQUE_MAX_ATTEMPTS; attempt += 1) {
    try {
      // R5.6 — SEPARATE LLM call, distinct from evaluate.
      const res = await llm.complete({
        operation: 'self_critique',
        audit_run_id: auditRunId,
        userPrompt,
        systemPrompt: SELF_CRITIQUE_SYSTEM_PROMPT,
        temperature: 0,
        maxTokens: SELF_CRITIQUE_MAX_TOKENS,
        ...(clientId !== undefined ? { client_id: clientId } : {}),
      });
      const payload = JSON.parse(extractJsonPayload(res.text)) as unknown;
      const items = z.array(CritiqueResponseItemSchema).parse(payload);
      const critiques: Phase7CritiqueFinding[] = [];
      for (const item of items) {
        const original = reviewable[item.finding_index];
        if (original === undefined) continue; // LLM hallucinated index
        const out = applyVerdict(original, item);
        if (out !== null) critiques.push(out);
      }
      return { critique_findings: critiques };
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        return { critique_findings: [], analysis_status: 'budget_exhausted_partial' };
      }
      if (err instanceof TemperatureGuardError) {
        return {
          critique_findings: [],
          analysis_status: 'error_r10_temperature_guard_violation',
        };
      }
      if (err instanceof LLMUnavailableError) {
        return { critique_findings: [], analysis_status: 'skipped_llm_output_invalid' };
      }
      // JSON.parse / Zod failure → loop until exhausted.
    }
  }

  return { critique_findings: [], analysis_status: 'skipped_llm_output_invalid' };
}

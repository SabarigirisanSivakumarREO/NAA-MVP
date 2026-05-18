/**
 * Evaluate prompt template — Phase 7 T118 (AC-06, REQ-ANALYZE-NODE-002).
 *
 * Spec source: docs/specs/AI_Analysis_Agent_Architecture_v1.0.md §4.2 (lines 315-406).
 *
 * R5.5 — heuristic content in USER MESSAGE only (never injected into system prompt).
 *   System prompt is STATIC across audits → Anthropic prompt-cache friendly.
 * R6 — heuristic body / rule_text / description / guidance / examples MUST NOT be
 *   serialized into the user message. Only structured public fields (id, name,
 *   category, page_type, archetype, severity_default, benchmark) are exposed.
 * R5.3 — absolute conversion-prediction ban appended to user message every call.
 */

import type { AnalyzePerception } from '../types.js';
import type { HeuristicExtended } from '../heuristics/types.js';

export const EVALUATE_SYSTEM_PROMPT: string = `You are a CRO analyst. Your role is to evaluate web pages against usability
heuristics and identify friction points.

METHODOLOGY:
For each heuristic, follow this exact chain of thought:
1. OBSERVE: What specific elements on the page relate to this heuristic?
2. ASSESS: Does the page comply or violate? Why?
3. EVIDENCE: Point to the exact element, measurement, or data point.
4. SEVERITY: Assign based on evidence strength, NOT gut feeling.

RULES:
- Only report violations you can point to specific page data for.
- If a heuristic is satisfied, respond with status: "pass".
- If you are uncertain, respond with status: "needs_review".
- NEVER predict conversion rates, revenue impact, or percentage improvements.
- NEVER reference elements that are not in the provided page data.
- NEVER make up measurements or positions — use only provided bounding boxes.`;

export interface EvaluateUserMessageInput {
  readonly perception: AnalyzePerception;
  readonly filteredHeuristics: ReadonlyArray<HeuristicExtended>;
  readonly currentUrl: string;
  readonly pageTypeDetected: string;
  readonly businessType: string;
  readonly persona?: string;
}

/**
 * R6 IP boundary — fields STRIPPED before LLM serialization. `body` is the
 * LLM-evaluable rule text (HeuristicSchemaBase docstring: NEVER serialized
 * to logs / API / dashboard / traces). `provenance` + `ai_review` carry
 * prose authored during KB review; same boundary.
 */
const R6_STRIPPED_KEYS: ReadonlySet<string> = new Set(['body', 'provenance', 'ai_review']);

function projectHeuristicPublic(h: HeuristicExtended): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(h as unknown as Record<string, unknown>)) {
    if (R6_STRIPPED_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export function buildEvaluateUserMessage(input: EvaluateUserMessageInput): string {
  const p = input.perception as unknown as Record<string, unknown>;
  const layout = (p.layout ?? {}) as Record<string, unknown>;
  const text = (p.textContent ?? {}) as Record<string, unknown>;
  const perf = (p.performance ?? {}) as Record<string, unknown>;
  const publicHeuristics = input.filteredHeuristics.map(projectHeuristicPublic);

  const personaBlock =
    input.persona !== undefined
      ? `\n\nPERSONA CONTEXT:\n${input.persona}`
      : '';

  return `PAGE DATA:
URL: ${input.currentUrl}
Page type: ${input.pageTypeDetected}
Business type: ${input.businessType}

STRUCTURE:
Headings: ${JSON.stringify(p.headingHierarchy ?? [])}
Landmarks: ${JSON.stringify(p.landmarks ?? [])}
Semantic HTML: ${JSON.stringify(p.semanticHTML ?? {})}

CALLS TO ACTION:
${JSON.stringify(p.ctas ?? [])}

FORMS:
${JSON.stringify(p.forms ?? [])}

TRUST SIGNALS:
${JSON.stringify(p.trustSignals ?? [])}

LAYOUT:
Viewport height: ${String(layout.viewportHeight ?? '')}px
Fold position: ${String(layout.foldPosition ?? '')}px
Content above fold: ${JSON.stringify(layout.contentAboveFold ?? [])}
Whitespace ratio: ${String(layout.whitespaceRatio ?? '')}

NAVIGATION:
${JSON.stringify(p.navigation ?? {})}

IMAGES:
${JSON.stringify(p.images ?? [])}

CONTENT:
Word count: ${String(text.wordCount ?? '')}
Readability: ${String(text.readabilityScore ?? '')}

PERFORMANCE:
DOM Content Loaded: ${String(perf.domContentLoaded ?? '')}ms
Fully Loaded: ${String(perf.fullyLoaded ?? '')}ms
Resources: ${String(perf.resourceCount ?? '')}

---

EVALUATE AGAINST THESE HEURISTICS:
${JSON.stringify(publicHeuristics)}

---

For each heuristic, respond with JSON:
{
  "heuristic_id": "string",
  "status": "violation" | "pass" | "needs_review",
  "observation": "what I see on the page (quote specific data)",
  "assessment": "why this is/isn't a violation",
  "evidence": {
    "element_ref": "specific element text or identifier",
    "element_selector": "CSS selector if identifiable from data",
    "data_point": "which section above proves this (e.g., 'ctas[0]', 'forms[0].fieldCount')",
    "measurement": "exact number/position from the data (e.g., 'y:1400, viewport:800 → below fold')"
  },
  "severity": "critical" | "high" | "medium" | "low",
  "confidence_basis": "what measurable evidence supports this severity",
  "recommendation": "specific, actionable fix",
  "needs_review": boolean
}

Return an array of results, one per heuristic. Include both violations AND passes.${personaBlock}

ABSOLUTE: Do NOT predict conversion rates, revenue impact, ROI, or percentage improvements. No "increase by N%", no "uplift", no "drive sales".`;
}

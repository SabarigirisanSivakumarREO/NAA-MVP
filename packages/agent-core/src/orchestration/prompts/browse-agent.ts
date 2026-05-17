/**
 * Phase 5 T090 — BROWSE_AGENT_SYSTEM_PROMPT + ActionProposalSchema.
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-09 + REQ-BROWSE-PROMPT-001
 *   docs/specs/mvp/phases/phase-5-browse-mvp/tasks.md T090 (kill criteria — prompt < 2000 tokens)
 *   docs/specs/mvp/phases/phase-5-browse-mvp/impact.md §BrowseAgentSystemPrompt
 *   docs/specs/mvp/phases/phase-5-browse-mvp/r20-invalidation-from-phase-4b.md
 *     §"Open question" — page_* tools EXCLUDED from browse-mode prompt
 *   docs/specs/final-architecture/08-tool-manifest.md §8.2 Mode Availability Matrix
 *     (page_* = analyze-mode-only)
 *
 * Contract (AC-09 v0.4):
 *   - BROWSE_AGENT_SYSTEM_PROMPT enumerates the 24 EXACT v3.1 tool names
 *     eligible for browse-mode (22 browser_* + 2 agent_*; 5 page_* are
 *     analyze-mode-only per `08-tool-manifest.md` §8.2 and EXCLUDED here).
 *   - The 24 names are sourced VERBATIM from Phase 2 MCP tool files'
 *     `name:` fields (R4.5 exact-name compliance — paraphrasing = R23
 *     kill trigger). The full 29-tool registry remains untouched; Phase 5
 *     filters by name prefix (`page_*` excluded) at module load time.
 *   - Prompt < 2000 tokens (kill criterion — STOP if exceeded; prompt IS
 *     the per-iteration LLM cost lever, see tasks.md T090 L210).
 *   - ActionProposalSchema is a Zod object whose `tool` is z.enum over
 *     the 24 names. Strict mode rejects unknown fields.
 *
 * Drift-detection seam: BROWSE_TOOL_NAMES exported separately so the
 *   conformance test (tests/conformance/browse-prompt.test.ts) can assert
 *   it matches MCPToolRegistry.list().filter(t => !t.name.startsWith('page_')).
 *
 * R9 boundary: NO vendor SDK imports. Only Zod + TypeScript.
 * R10.1: file ≤ 200 lines.
 * R10.2: named exports only.
 */
import { z } from 'zod';

/**
 * 24 EXACT v3.1 tool names eligible for BROWSE-mode (alphabetically
 * sorted; 22 browser_* + 2 agent_*). Sourced VERBATIM from the `name:`
 * fields of `packages/agent-core/src/mcp/tools/*.ts`. The 5 page_* tools
 * (page_analyze, page_annotate_screenshot, page_get_element_info,
 * page_get_performance, page_screenshot_full) are EXCLUDED because
 * `docs/specs/final-architecture/08-tool-manifest.md` §8.2 marks them
 * analyze-mode-only.
 *
 * The full registry has 29 tools; drift-detection asserts:
 *   registry.list().length === 29
 *   registry.list().filter(t => !t.name.startsWith('page_'))
 *     .map(t => t.name).sort() === [...BROWSE_TOOL_NAMES]
 */
export const BROWSE_TOOL_NAMES = [
  'agent_complete',
  'agent_request_human',
  'browser_click',
  'browser_click_coords',
  'browser_download',
  'browser_evaluate',
  'browser_extract',
  'browser_find_by_text',
  'browser_get_metadata',
  'browser_get_network',
  'browser_get_state',
  'browser_go_back',
  'browser_go_forward',
  'browser_hover',
  'browser_navigate',
  'browser_press_key',
  'browser_reload',
  'browser_screenshot',
  'browser_scroll',
  'browser_select',
  'browser_tab_manage',
  'browser_type',
  'browser_upload',
  'browser_wait_for',
] as const;

/** TypeScript literal-union over the 24 browse-eligible tool names. */
export type BrowseToolName = (typeof BROWSE_TOOL_NAMES)[number];

/**
 * System prompt for the browse-mode LLM agent. Embeds the 24 EXACT tool
 * names from BROWSE_TOOL_NAMES so the prompt and the registry-derived
 * list stay in lockstep (R4.5 + drift detection).
 *
 * Token budget < 2000 (kill criterion — see tasks.md T090 L210). The
 * conformance test uses a coarse word-based proxy
 * (`split(/\s+/).length * 1.3`) since no tokenizer is bundled in
 * agent-core today; the 1.3x multiplier is a conservative GPT/Claude-
 * style BPE upper bound for English prose, leaving headroom inside
 * the 2000 budget.
 */
export const BROWSE_AGENT_SYSTEM_PROMPT = `You are Neural's browse-mode agent. Your job: navigate web pages, perform requested actions, and verify outcomes.

RULES (non-negotiable):
1. PERCEPTION FIRST. Always call browser_get_state before any action tool. Stale page state is the #1 source of wrong actions.
2. EXACT TOOL NAMES. Use only these registered MCP tools (exact spelling, no paraphrasing): ${BROWSE_TOOL_NAMES.join(', ')}. Never invent or rename a tool (e.g., never "page_snapshot" — use "browser_get_state").
3. ONE ACTION PER STEP. Propose exactly one tool call per response. Do not chain multiple actions; the orchestrator will call you again after each action completes.
4. JSON FORMAT. Action proposals MUST match this Zod-validated schema: { "tool": "<exact_name>", "args": { ... }, "reasoning": "<<=3 sentences>" }. Any other shape is rejected.
5. STAY UNDER BUDGET. If the page is off-topic, blocked, or unlikely to progress the audit, propose agent_complete with status='no_action_needed'. Cost discipline beats completionism.

OUTPUT (return ONLY this JSON, no prose wrapper):
{ "tool": "<one of the 24 names above>", "args": { ... }, "reasoning": "<short why>" }`;

/**
 * Zod schema for a single LLM-emitted action proposal. Validates at the
 * adapter boundary (R2.2) before any safety/tool dispatch. Strict mode
 * rejects unknown top-level fields so a hallucinated wrapper (e.g.,
 * `{ "action": {...} }`) fails fast instead of silently dropping data.
 *
 * Field rationale:
 *   - tool: z.enum over BROWSE_TOOL_NAMES — only the 24 browse-eligible
 *     names parse; page_* are rejected.
 *   - args: z.record because each tool's input schema is owned by Phase 2
 *     (browse-prompt has no business re-declaring them); the downstream
 *     dispatcher narrows via the tool's own Zod inputSchema.
 *   - reasoning: capped at 500 chars (~3-4 sentences) to keep token cost
 *     bounded and discourage rambling chain-of-thought leakage.
 */
export const ActionProposalSchema = z
  .object({
    tool: z.enum(BROWSE_TOOL_NAMES),
    args: z.record(z.string(), z.unknown()),
    reasoning: z.string().max(500),
  })
  .strict();

/** Type inferred from ActionProposalSchema. */
export type ActionProposal = z.infer<typeof ActionProposalSchema>;

---
title: Impact Analysis — Phase 5 Browse MVP (3 new contracts)
artifact_type: impact
status: draft
version: 0.2
created: 2026-04-27
updated: 2026-04-27
owner: engineering lead

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-5-browse-mvp/spec.md
  - docs/specs/mvp/phases/phase-5-browse-mvp/plan.md
  - docs/specs/final-architecture/04-orchestration.md
  - docs/specs/final-architecture/05-unified-state.md

req_ids:
  - REQ-BROWSE-NODE-001
  - REQ-BROWSE-NODE-002
  - REQ-BROWSE-NODE-003
  - REQ-BROWSE-GRAPH-001
  - REQ-BROWSE-PROMPT-001

breaking: false
risk_level: medium

affected_contracts:
  - BrowseSubGraph
  - BrowseAgentSystemPrompt
  - AuditStateBrowseSubset

delta:
  new:
    - First impact.md introducing LangGraph as orchestration runtime
    - AuditState forward-compat seam (Phase 5 subset → Phase 8 widening)
    - v0.2 — BrowseAgentSystemPrompt section now cites `docs/specs/final-architecture/08-tool-manifest.md` as canonical tool-name source (analyze finding F-002)
  changed:
    - v0.1 → v0.2 — cross-reference polish; no contract changes
  impacted: []
  unchanged:
    - All contract shapes (LangGraph subgraph, prompt, AuditState narrow subset)

governing_rules:
  - Constitution R9
  - Constitution R18
  - Constitution R20
  - Constitution R22
---

# Impact Analysis: BrowseSubGraph + BrowseAgentSystemPrompt + AuditStateBrowseSubset

## Why R20 applies — and why MEDIUM risk

Three new contracts land in Phase 5:

1. **`BrowseSubGraph`** — compiled LangGraph subgraph. Phase 8 `AuditGraph` will compose this with the analyze subgraph (Phase 7) into a unified graph. The subgraph's input/output state shape is the cross-graph contract.
2. **`BrowseAgentSystemPrompt`** — LLM prompt template + Zod schema for action proposals. Cross-cuts every LLM call in browse mode; changes here ripple through every browse-mode test.
3. **`AuditStateBrowseSubset`** — Phase 5 narrow subset of AuditState; Phase 8 widens. The forward-compat seam is the contract.

risk_level: **MEDIUM** because:
- 3 contracts (smaller than Phase 4's 18).
- AuditState narrow→wide forward-compat is the only structural risk; if Phase 5 hard-codes browse-only fields without leaving room for Phase 8 widening, Phase 8 forces re-shape.
- BrowseSubGraph is consumed by Phase 8 AuditGraph composition; LangGraph subgraph composition is well-supported, low integration risk.
- Most Phase 5 work is *integration* of Phase 1-4 contracts, not new contract design — much of the surface area is reused, not created.

## Affected modules

### Phase 5 itself

| File | Layer | Role |
|---|---|---|
| `packages/agent-core/src/orchestration/AuditState.ts` | orchestration | Browse-mode subset Zod schema |
| `packages/agent-core/src/orchestration/nodes/AuditSetupNode.ts` | orchestration/nodes | T082 |
| `packages/agent-core/src/orchestration/nodes/PageRouterNode.ts` | orchestration/nodes | T083 |
| `packages/agent-core/src/orchestration/nodes/BrowseNode.ts` | orchestration/nodes | T084 + T085 (action selection + verify/route) |
| `packages/agent-core/src/orchestration/nodes/AuditCompleteNode.ts` | orchestration/nodes | T086 |
| `packages/agent-core/src/orchestration/edges.ts` | orchestration | T088 conditional routing |
| `packages/agent-core/src/orchestration/BrowseGraph.ts` | orchestration | T091 — assembly |
| `packages/agent-core/src/orchestration/prompts/browse-agent.ts` | orchestration/prompts | T090 — system prompt + action-proposal Zod schema |
| `packages/agent-core/src/orchestration/index.ts` | orchestration | barrel |
| `packages/agent-core/src/observability/logger.ts` | observability | MODIFIED — add node_name, subgraph, loop_iteration correlation fields |

### Downstream consumers

| Phase | File(s) | Imports |
|---|---|---|
| Phase 7 | `analysis/nodes/*.ts` | (parallel — analyze subgraph alongside browse subgraph; both write same AuditState) |
| Phase 8 | `orchestration/AuditGraph.ts` | `BrowseSubGraph` (composed with AnalyzeSubGraph); widens AuditState additively |
| Phase 8 | `orchestration/AuditState.ts` | EXTENDS Phase 5's narrow subset to full schema (additive) |
| Phase 9 | `apps/dashboard/...` + `apps/cli/...` | trigger BrowseGraph via Hono API or CLI |

## Affected contracts

### `AuditStateBrowseSubset` (NEW; Phase 8 widens)

```ts
// orchestration/AuditState.ts
export const AuditStateBrowseSubsetSchema = z.object({
  audit_run_id: z.string().uuid(),
  client_id: z.string().uuid(),
  business_type: z.enum(['ecommerce', 'saas', 'b2b', 'content', 'unknown']).default('unknown'),
  urls_remaining: z.array(z.string().url()),
  current_url: z.string().url().optional(),
  page_state_models: z.array(PageStateModelSchema).default([]),  // from Phase 1
  session_confidence: z.number().min(0).max(1).default(1.0),     // ConfidenceScorer-managed
  budget_remaining_usd: z.number().nonnegative(),
  analysis_cost_usd: z.number().nonnegative().default(0),
  completion_reason: z.enum(['success', 'budget_exceeded', 'aborted', 'timeout']).optional(),
  // FORWARD-COMPAT SEAM:
  _phase8_extensions: z.record(z.string(), z.unknown()).optional(),  // Phase 8 widens here
}).strict();  // strict() for now; Phase 8 will EXTEND, not pass-through
```

**Forward-compat strategy:** rather than using `.passthrough()` (which would let any unknown field slip through silently — bad for type safety), Phase 5 declares `_phase8_extensions` as a typed escape hatch. Phase 8 lands a NEW schema (`AuditStateFullSchema`) that EXTENDS `AuditStateBrowseSubsetSchema` with concrete typed fields, deprecating `_phase8_extensions` as a transitional adapter.

### `BrowseAgentSystemPrompt` (NEW)

```ts
// orchestration/prompts/browse-agent.ts
export const BROWSE_AGENT_SYSTEM_PROMPT = `
You are Neural's browse-mode agent. Your job: navigate web pages, perform requested actions, and verify outcomes.

RULES (non-negotiable):
1. PERCEPTION FIRST. Always use browser_get_state before any action tool.
2. EXACT TOOL NAMES. Use only these registered MCP tools: ${LIST_OF_29_EXACT_NAMES}. Never paraphrase (e.g., never "page_snapshot" — use "browser_get_state").
3. ONE ACTION PER STEP. Do not chain multiple actions in one response.
4. PROPOSE IN JSON. Action proposals MUST match this schema: { tool, args, reasoning }.
5. STAY UNDER BUDGET. If the page seems off-topic or won't progress, propose 'agent_complete' with status: 'no_action_needed'.

OUTPUT FORMAT (Zod-validated):
{ "tool": "<exact_name>", "args": { ... }, "reasoning": "<≤3 sentences>" }
`;

export const ActionProposalSchema = z.object({
  tool: z.enum([/* 29 exact v3.1 names */]),
  args: z.record(z.string(), z.unknown()),
  reasoning: z.string().max(500),
}).strict();
```

The 29 tool names embedded in the prompt are sourced from Phase 2's MCPToolRegistry at compile time (NOT generated dynamically — to ensure prompt stability for reproducibility). The registry's tool-name list is itself anchored to the canonical manifest at `docs/specs/final-architecture/08-tool-manifest.md` (24 `browser_*` + 2 `agent_*` + 5 `page_*` = 29 per tasks-v2.md v2.3.1 reconciliation). Phase 5's golden snapshot test (T090 conformance) asserts `MCPToolRegistry.list().length === 29` to catch drift between the registry and the prompt.

### `BrowseSubGraph` (NEW)

```ts
// orchestration/BrowseGraph.ts
export function buildBrowseGraph(deps: {
  llm: LLMAdapter;
  storage: StorageAdapter;
  contextAssembler: ContextAssembler;
  toolRegistry: ToolRegistry;
  rateLimiter: RateLimiter;
  safety: SafetyCheck;
  verifyEngine: VerifyEngine;
  scorer: ConfidenceScorer;
  classifier: FailureClassifier;
  logger: Logger;
  recorder: SessionRecorder;
  emitter: StreamEmitter;
}): CompiledStateGraph<AuditStateBrowseSubset> {
  // builds and compiles the subgraph; returns runnable
}
```

`buildBrowseGraph` takes all Phase 1-4 contracts as injected deps (R9 adapter pattern preserved).

## Breaking changes

None — additive.

## Migration plan

Not applicable.

## Forward Contract — Phase 8 widens AuditState

When Phase 8 lands the full AuditState (T135), it EXTENDS Phase 5's narrow subset:

```ts
// Phase 8: orchestration/AuditState.ts (extended)
export const AuditStateFullSchema = AuditStateBrowseSubsetSchema.extend({
  trigger_source: z.enum([...]).default('consultant_dashboard'),
  audit_request_id: z.string().default(''),
  state_graph: ...,
  multi_state_perception: ...,
  current_state_id: z.string().nullable().default(null),
  exploration_cost_usd: z.number().default(0),
  exploration_budget_usd: z.number().default(0.50),
  exploration_pass_2_triggered: z.boolean().default(false),
  finding_rollups: z.array(FindingRollupSchema).default([]),
  reproducibility_snapshot: ...,
  published_finding_ids: z.array(z.string().uuid()).default([]),
  warmup_mode_active: z.boolean().default(true),
  // Plus the analyze-mode fields from Phase 7
  // ...
});
// _phase8_extensions can be deprecated once all extensions are typed
```

**Forward stability promise:** every field in `AuditStateBrowseSubsetSchema` will remain compatible (additive only) through Phase 8. New Phase 8 fields are optional with safe defaults so existing Phase 5 code paths continue to work.

## Risk level: MEDIUM — mitigations

**Why MEDIUM:**
- Smaller surface than Phase 4 (3 contracts vs 18).
- Most "new" code is integration of established contracts.

**Why not LOW:**
- AuditState forward-compat seam is a real risk if Phase 8 widening forces a re-shape.
- BrowseAgentSystemPrompt baked into LLM behavior — changes require new conformance + golden tests.

**Mitigations:**
- AuditState explicit `_phase8_extensions` escape hatch declared.
- BrowseAgentSystemPrompt golden snapshot test (T090) catches accidental drift.
- T084/T085 (browse node) split into action-selection + verify+route — each separately testable.
- T091 BrowseGraph assembly is single-threaded — composition is too subtle to parallelize.

## Verification

| Check | Test |
|---|---|
| AuditState browse-subset Zod parse on 5 fixtures | `tests/conformance/audit-state-browse-subset.test.ts` (AC-01) |
| 4 nodes each have node-level Zod I/O | `tests/conformance/node-io-zod.test.ts` (AC-06) |
| Conditional edges route correctly per FailureClassifier output | `tests/conformance/edges-routing.test.ts` (AC-07) |
| HITL interrupt pauses + resumes | `tests/conformance/hitl-interrupt.test.ts` (AC-08) |
| Browse prompt golden snapshot stable | `tests/conformance/browse-prompt.test.ts` (AC-09) |
| BrowseGraph compiles + runs on fixture | `tests/conformance/browse-graph-compile.test.ts` (AC-10) |
| 5 integration tests on real sites | `tests/integration/phase5-*.test.ts` (AC-11..AC-15) |

## Provenance (R22.2)

```yaml
why:
  source: >
    docs/specs/AI_Browser_Agent_Architecture_v3.1.md (browse-agent decision flow)
    docs/specs/final-architecture/04-orchestration.md (LangGraph canonical)
    docs/specs/final-architecture/05-unified-state.md (AuditState schema)
  evidence: >
    Phase 5 is the integration phase where R4.1-R4.5 converge in code. The browse-agent
    system prompt is the LLM-side enforcement (R4.1 perception first, R4.5 exact tool names);
    SafetyCheck + VerifyEngine + ConfidenceScorer + FailureClassifier are the code-side
    enforcement. AuditState narrow→wide forward-compat avoids Phase 8 forcing Phase 5 rework.
  linked_failure: >
    Hypothetical: AuditState shipped with Phase 8 fields hard-coded in Phase 5 forces
    Phase 5 code re-write at Phase 8 boundary; narrow→wide pattern avoids this.
```

## Approval

| Gate | Approver | Evidence |
|---|---|---|
| Impact analysis review | engineering lead | this `status: approved` |
| AuditState forward-compat strategy | engineering lead | `_phase8_extensions` + extend pattern documented |
| Browse prompt golden test in place | engineering lead | T090 conformance test |
| Phase 5 spec → plan transition | spec author + product owner | spec `approved` AND this `approved` |

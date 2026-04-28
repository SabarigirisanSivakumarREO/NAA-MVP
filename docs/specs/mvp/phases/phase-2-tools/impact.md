---
title: Impact Analysis — Phase 2 MCP Tools (4 new shared contracts)
artifact_type: impact
status: draft
version: 0.1
created: 2026-04-27
updated: 2026-04-27
owner: engineering lead

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-2-tools/spec.md
  - docs/specs/mvp/phases/phase-2-tools/plan.md
  - docs/specs/final-architecture/07-analyze-mode.md §07.9 + §07.9.1
  - docs/specs/final-architecture/08-tool-manifest.md

req_ids:
  - REQ-MCP-001
  - REQ-MCP-002
  - REQ-TOOL-PA-001
  - REQ-ANALYZE-PERCEPTION-V23-001

breaking: false
risk_level: high

affected_contracts:
  - MCPToolRegistry
  - MCPToolSchema
  - AnalyzePerception
  - RateLimiter

delta:
  new:
    - First impact.md introducing 4 simultaneous shared contracts (largest impact in MVP)
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R9
  - Constitution R18
  - Constitution R20
  - Constitution R22
---

# Impact Analysis: MCPToolRegistry + MCPToolSchema + AnalyzePerception + RateLimiter

## Why R20 applies — and why risk_level is HIGH

Phase 2 introduces FOUR new shared contracts simultaneously — the largest single-phase contract surface in MVP:

1. **`MCPToolRegistry`** — adapter contract for the MCP server. Sets the precedent for tool registration across every future MCP-related work (Phase 4 SafetyCheck consumes safety classifications from here; Phase 5 Browse MVP composes tools into LangGraph nodes).
2. **`MCPToolSchema`** — the per-tool I/O Zod contract. 28 individual schemas materialize. Phase 5 LangGraph nodes will compose tool calls; if any schema changes mid-flight, every consumer breaks.
3. **`AnalyzePerception`** — the v2.3 enriched analysis perception schema. Consumed by Phase 7 `DeepPerceiveNode`. **This is the single most-cited schema in Neural** — it appears in `evaluate` prompt (Phase 7), grounding rules (Phase 7), self-critique (Phase 7), report generation (Phase 9). Any change ripples across 4+ phases.
4. **`RateLimiter`** — operational adapter. Phase 4 reuses the queue model; Phase 5 wraps tool calls.

risk_level: **HIGH** because:
- AnalyzePerception alone is the highest-fanout schema in the codebase. A subtle field shape mistake (e.g., making `inferredPageType.alternatives` nullable when it should be an empty array) cascades into 12 grounding rules + evaluate prompts + reports.
- 28 tool schemas mean 56 (input + output) Zod boundaries — many places to drift.
- MCPToolRegistry sets the safety-classification slot used by Phase 4 SafetyCheck. If the slot type doesn't match what Phase 4 expects, full rework.

Compare Phase 1 (BrowserEngine + PageStateModel, MEDIUM): two contracts, one consumer phase. Phase 2 has 4 contracts, 4 consumer phases. Hence HIGH.

## Affected modules

### Phase 2 itself

| File | Layer | Role |
|---|---|---|
| `packages/agent-core/src/mcp/Server.ts` | mcp | MCP server adapter wrapping @modelcontextprotocol/sdk |
| `packages/agent-core/src/mcp/ToolRegistry.ts` | mcp | name → { input/output schema, handler, safety class } |
| `packages/agent-core/src/mcp/types.ts` | mcp | MCPToolSchema base + safety class enum |
| `packages/agent-core/src/mcp/tools/*.ts` (28 files) | mcp/tools | one tool per file; registers via ToolRegistry |
| `packages/agent-core/src/analysis/types.ts` | analysis | AnalyzePerception Zod schema (NEW — even though analysis pipeline is Phase 7, the schema authored here because page_analyze produces it) |
| `packages/agent-core/src/browser-runtime/MouseBehavior.ts` | browser-runtime | ghost-cursor wrapper |
| `packages/agent-core/src/browser-runtime/TypingBehavior.ts` | browser-runtime | Gaussian + typo |
| `packages/agent-core/src/browser-runtime/ScrollBehavior.ts` | browser-runtime | momentum scroll |
| `packages/agent-core/src/browser-runtime/RateLimiter.ts` | browser-runtime | per-domain pacer |

### Downstream consumers (forward contract)

| Phase | File | What it imports |
|---|---|---|
| Phase 4 | `safety/ActionClassifier.ts` | `MCPToolSchema['safetyClass']` enum + tool name list |
| Phase 4 | `safety/SafetyCheck.ts` | `MCPToolRegistry.getSafetyClass(toolName)` |
| Phase 5 | `orchestration/nodes/BrowseNode.ts` | every tool name + their schemas (composes tool calls within the LangGraph browse subgraph) |
| Phase 5 | `orchestration/nodes/ActionNode.ts` | `RateLimiter.acquire(domain)` |
| Phase 7 | `analysis/nodes/DeepPerceiveNode.ts` | `AnalyzePerception` schema + `page_analyze` tool call |
| Phase 7 | `analysis/grounding/rules/GR-001..GR-012.ts` | `AnalyzePerception` field paths (every grounding rule reads specific sub-fields) |
| Phase 7 | `analysis/nodes/EvaluateNode.ts` | `AnalyzePerception` serialized into LLM user message |
| Phase 9 | `delivery/ReportGenerator.ts` | reads `AnalyzePerception` snapshot from reproducibility_snapshots |

## Affected contracts — before / after shapes

### `MCPToolRegistry` (NEW)

**Before:** does not exist.

**After:**

```ts
// packages/agent-core/src/mcp/ToolRegistry.ts
export type SafetyClass = 'safe' | 'requires_safety_check' | 'requires_hitl' | 'forbidden';

export interface MCPToolDefinition<I, O> {
  name: string;            // EXACT v3.1 name — e.g., 'browser_get_state'
  description: string;
  inputSchema: ZodType<I>;
  outputSchema: ZodType<O>;
  safetyClass: SafetyClass;
  handler: (input: I, ctx: ToolContext) => Promise<O>;
}

export interface ToolRegistry {
  register<I, O>(def: MCPToolDefinition<I, O>): void;  // throws on duplicate name
  list(): readonly Pick<MCPToolDefinition<unknown, unknown>, 'name' | 'description' | 'safetyClass'>[];
  get(name: string): MCPToolDefinition<unknown, unknown> | undefined;
  getSafetyClass(name: string): SafetyClass;
}
```

### `AnalyzePerception` (NEW — most important schema in Neural)

**After:** matches §07.9 baseline (9 sections) + §07.9.1 v2.3 enrichments (14 fields). Concrete schema authored at T048 implementation time; this impact.md captures the shape promise:

- Top-level `AnalyzePerceptionSchema = z.object({ metadata, structure, headingHierarchy, landmarks, semanticHTML, textContent, ctas, forms, trustSignals, layout, images, navigation, performance, iframes?, accessibility?, inferredPageType }).strict()`
- Every leaf field is nullable per `null + reason` pattern; failures are observable, not silent.
- v2.3 enrichments appear as additional sub-fields (NOT a new top-level section): `metadata.canonical/lang/ogTags/schemaOrg`, `structure.titleH1Match/titleH1Similarity`, `textContent.valueProp/urgencyScarcityHits/riskReversalHits`, `ctas[].accessibleName/role/hoverFocusStyles`, `forms[].fields[].accessibleName/role`, `trustSignals[].subtype/source/attribution/freshnessDate/pixelDistanceToNearestCta`, `iframes[].purposeGuess`, `navigation.footerNavItems`, `accessibility.keyboardFocusOrder/skipLinks`, `performance.INP/CLS/TTFB/timeToFirstCtaInteractable`, `inferredPageType.primary/alternatives/signalsUsed`.
- Forward-compatibility seam: top-level `_extensions: z.record(z.string(), z.unknown()).optional()` — same pattern as Phase 1 PageStateModel.

### `RateLimiter` (NEW)

**After:**

```ts
export interface RateLimiterConfig {
  perSessionMinIntervalMs: number;        // default 2000
  perDomainCaps: Record<string, { limit: number; windowMs: number }>;  // e.g., { 'amazon.in': { limit: 30, windowMs: 60000 }, '*': { limit: 10, windowMs: 60000 } }
}

export interface RateLimiter {
  acquire(domain: string): Promise<void>;  // resolves when call may proceed
  release(domain: string): void;            // release token; queue advances
  stats(): { queueDepth: Record<string, number>; lastCall: Record<string, number> };
}
```

### `MCPToolSchema` (NEW base)

Each of the 28 tools defines its own input/output Zod schema in its own file (`mcp/tools/<name>.ts`). The base helper type `MCPToolSchema<I, O>` lives in `mcp/types.ts` and just re-exports `MCPToolDefinition<I, O>` plus a small assertion helper.

## Breaking changes

None — all 4 contracts are additive (no prior version exists). `breaking: false`.

## Migration plan

Not applicable.

## Forward Contract — what later phases will import

### Phase 4 (T066 ActionClassifier, T067 SafetyCheck — Safety + Infra)

```ts
// In Phase 4:
import { MCPToolRegistry, SafetyClass } from '@neural/agent-core/mcp';

// ActionClassifier reads classifications from registry
function classifyAction(toolName: string): SafetyClass {
  return registry.getSafetyClass(toolName);
}
```

**Forward stability promise:** safety class enum values (`safe` / `requires_safety_check` / `requires_hitl` / `forbidden`) are LOCKED in Phase 2. Phase 4 may add fields to the metadata side (e.g., `riskScore`) but MUST NOT alter the enum.

### Phase 5 (T081-T091 LangGraph orchestration — Browse MVP)

```ts
// In Phase 5:
import { MCPToolRegistry } from '@neural/agent-core/mcp';
import { RateLimiter } from '@neural/agent-core/browser-runtime';

// BrowseNode acquires rate limit + invokes tool by name
await rateLimiter.acquire(domain);
const result = await registry.get('browser_get_state').handler(input, ctx);
```

**Forward stability promise:** every tool name + schema is the contract. Phase 5 LangGraph nodes will hard-reference tool names; renaming any of the 28 tools after Phase 2 is a HIGH-impact change requiring its own impact.md.

### Phase 7 (T117 DeepPerceiveNode — Analysis Pipeline)

```ts
// In Phase 7:
import { AnalyzePerception, AnalyzePerceptionSchema } from '@neural/agent-core/analysis';

const result = await registry.get('page_analyze').handler({ url }, ctx);
const validated: AnalyzePerception = AnalyzePerceptionSchema.parse(result);
// pass `validated` to evaluate, grounding, etc.
```

**Forward stability promise:** AnalyzePerception field shapes — including all 14 v2.3 enrichments — are LOCKED in Phase 2. Phase 7 grounding rules hard-reference field paths (`AnalyzePerception.ctas[].accessibleName` etc.). Schema additions are non-breaking (use optional fields); rename / shape change requires impact.md cycle.

### Phase 9 (Report generation)

Reports embed AnalyzePerception snapshots in reproducibility_snapshots; consume frozen schema.

## Risk level: HIGH — mitigations

**Why HIGH (recap):**
- 4 simultaneous contracts.
- AnalyzePerception is the highest-fanout schema in Neural.
- 28 tool schemas = 56 boundaries to maintain.

**Why not CRITICAL:**
- All additive — no existing consumers to migrate.
- Failure mode contained to Phase 2 + immediate consumers.
- Strong upstream cite (§07.9 + §07.9.1 + 08-tool-manifest.md) — not inventing the contract, just materializing it.

**Mitigations:**
- T048 conformance test (`tests/conformance/page-analyze-v23.test.ts`) verifies every v2.3 field on 3 fixture pages — catches shape drift early.
- T050 integration test exercises every tool — catches tool-level drift.
- Phase 5 + Phase 7 will add their own conformance tests against the locked schema; if Phase 2 silently changes a field shape, those break loudly.
- R23 kill criteria on T048: any schema-shape ambiguity → STOP, refer back to §07.9.1 verbatim.

## Verification

| Check | Test |
|---|---|
| MCPToolRegistry rejects duplicate tool name on register | `tests/conformance/mcp-server.test.ts` (AC-04) |
| All 28 tools register with EXACT v3.1 names | grep + boot test |
| AnalyzePerception schema matches §07.9 baseline + 14 v2.3 fields | `tests/conformance/page-analyze-v23.test.ts` (AC-11) |
| RateLimiter pacing math correct (2s min, 60s window) | `tests/conformance/rate-limiter.test.ts` (AC-12) |
| browser_evaluate sandbox blocks 4 vectors | `tests/conformance/browser-evaluate-sandbox.test.ts` (AC-06) |
| No @modelcontextprotocol/sdk imports outside mcp/Server.ts + mcp/tools/*.ts | grep verify (manual; ESLint rule lands Phase 4) |
| AnalyzePerception._extensions reserved for Phase 7+ | `tests/conformance/page-analyze-v23.test.ts` asserts Phase 2 capture leaves _extensions undefined |

## Provenance (R22.2)

```yaml
why:
  source: >
    docs/specs/AI_Browser_Agent_Architecture_v3.1.md §08 (REQ-MCP-*) + REQ-BROWSE-HUMAN-* + REQ-BROWSE-RATE-* +
    docs/specs/final-architecture/08-tool-manifest.md (canonical 28-tool spec) +
    docs/specs/final-architecture/07-analyze-mode.md §07.9 + §07.9.1 (AnalyzePerception v2.3 enrichments)
  evidence: >
    AnalyzePerception is the most-cited contract in Neural. Authoring it in Phase 2 (where page_analyze
    produces it) rather than Phase 7 (where analysis pipeline consumes it) reflects R9 producer-side
    contract ownership. MCPToolRegistry's safety-class slot is the seam Phase 4 SafetyCheck depends on;
    locking the enum here prevents Phase 4 rework. RateLimiter is structural per R8.3 (rate limiting
    in code, not prompts).
  linked_failure: >
    Hypothetical: AnalyzePerception authored in Phase 7 forces page_analyze (Phase 2) to either
    (a) re-import schema from a future module — circular dep, or (b) emit unstructured JSON and
    have Phase 7 parse — defeats R2.2 Zod validation at every boundary.
```

## Approval

| Gate | Approver | Evidence |
|---|---|---|
| Impact analysis review | engineering lead | this `status: approved` |
| R20 compliance | engineering lead | all sections completed |
| R9 adapter discipline | engineering lead | adapter boundaries declared above |
| Phase 2 spec → plan transition | spec author + product owner | spec `approved` AND this `approved` |

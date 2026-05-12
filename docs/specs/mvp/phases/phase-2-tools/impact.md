---
title: Impact Analysis — Phase 2 MCP Tools (4 new shared contracts)
artifact_type: impact
status: approved
version: 0.2.6
created: 2026-04-27
updated: 2026-05-12
owner: engineering lead

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-2-tools/spec.md
  - docs/specs/mvp/phases/phase-2-tools/plan.md
  - docs/specs/final-architecture/07-analyze-mode.md §07.9 + §07.9.1
  - docs/specs/final-architecture/08-tool-manifest.md
  # v0.2 — Phase 1b/1c upstream rollups added per CLAUDE.md §1b rollup-first rule (Gate 1 finding F-S3)
  - docs/specs/mvp/phases/phase-1-perception/phase-1-current.md
  - docs/specs/mvp/phases/phase-1b-perception-extensions/phase-1b-current.md
  - docs/specs/mvp/phases/phase-1c-perception-bundle/phase-1c-current.md

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
    # v0.2 — Gate 1 Pass 1 patch wave (master orchestrator session 16, 2026-05-12) — REVISE → Pass 2
    - v0.2 — Phase 1b/1c upstream rollups added to derived_from (F-S3); Phase 1c PerceptionBundle envelope acknowledged as upstream substrate
    - v0.2 — §"Phase 1b/1c upstream substrate" section added (F-S1 staleness sweep)
    - v0.2 — §AnalyzePerception extended with F-G1 design decision (separate Zod schema, NOT PSM-alias) + F-S4 namespace contract assertion + F-S13 IframePurpose closed-enum constraint
    - v0.2 — §MCPToolRegistry extended with F-S12 safetyClass coverage promise (all 29 tools classified at Phase 2 close)
    # v0.2.1 — T-PHASE2-TYPES R11.4 correction (commit pending; master orchestrator session 16, 2026-05-12)
    - v0.2 → v0.2.1 — F-S13 IframePurpose enum values corrected: v0.2 cited 10 values including 'cross_origin' + 'video_embed' from Pass 1 memory; actual Phase 1c enum (IframePolicyEngine.ts:48-58) is 9-value (checkout, chat, video, analytics, social_embed, captcha, cmp, payment_3ds, other). `cross_origin` is a classifyIframe() security-override return value (NOT IframePurpose member). Patched §F-S13 codeblock + Phase 1b/1c upstream substrate enum list. T-PHASE2-TYPES F-CARRY-1 patch (line 178 of §AnalyzePerception) already separate v0.2.1 lineage.
    # v0.2.2 — Wave 4 navigation prep (R18 append-only Phase-2 extension of Phase 1 BrowserPage surface)
    - v0.2.1 → v0.2.2 — BrowserPage interface extended with `goBack` + `goForward` (opts: waitUntil + timeout) to unblock Wave 4 T021 (browser_go_back) + T022 (browser_go_forward) parallel-3 fanout. Authorized by BrowserEngine.ts header lines 71-75 ("Phase 2 will EXTEND this interface"). Concrete impl in BrowserManager.ts delegates to Playwright `Page.goBack`/`Page.goForward` (return value discarded — Phase-1-minimal pattern). R18 append-only: zero existing methods touched; zero signatures changed. R9 adapter boundary preserved (no new `playwright` imports outside BrowserManager.ts). No cross-layer ripple (Phase 4 SafetyCheck still consumes only `safetyClass` from MCPToolRegistry; Phase 5 BrowseNode still composes tools by name) — extension is internal to the R9 adapter surface, hence no separate impact.md per BrowserEngine.ts header R20 carve-out.
    # v0.2.3 — Wave 5 prep (R18 append-only Phase-2 extension of Phase 1 BrowserPage surface + ContextAssembler R20 forward-compat consumer pattern + R11.4 T024 spec patch)
    - v0.2.2 → v0.2.3 — BrowserPage interface extended with `reload(opts)` + `url()` to unblock Wave 5 T023 (browser_reload) + T024 (browser_get_state) parallel fanout. Authorized by BrowserEngine.ts header lines 71-75 ("Phase 2 will EXTEND this interface"). Concrete impl in BrowserManager.ts delegates to Playwright `Page.reload` (return value discarded — Phase-1-minimal pattern) + `Page.url()` (synchronous string return; no `as never` escape needed). R18 append-only: zero existing methods touched; zero signatures changed. R9 adapter boundary preserved (no new `playwright` imports outside BrowserManager.ts).
    - v0.2.2 → v0.2.3 — ContextAssembler `captureFromSession(session, opts?)` exposed as an ADDITIVE public method for Phase 2 T024 `browser_get_state` (R20 forward-compat consumer pattern). The post-navigation extractor pipeline (mutationMonitor settle observe + AX + filters + visual + substrate + metadata + assemble + fitToTokenBudget + Zod parse) is extracted from `capture(url, opts)` into the new method; the existing `capture(url, opts)` signature + behavior is PRESERVED (it now delegates to `captureFromSession` after session+navigation setup, still owns session lifecycle via `finally`). Caller of `captureFromSession` is responsible for session.close() lifecycle — matches MCP-client persistent-session pattern. R18 append-only: existing `capture(url, opts)` public contract unchanged; conformance tests pass verbatim. R10 file cap preserved (ContextAssembler.ts target ≤ 300 LOC).
    - v0.2.2 → v0.2.3 — R11.4 spec patch: T024 `browser_get_state` capture mechanism clarified as SESSION-BASED (operates on the current MCP session's `BrowserPage` via `ContextAssembler.captureFromSession`; does NOT spin up a fresh Chromium per call). Fixes ambiguity flagged at Wave 5 dispatch attempt — Phase 2 spec.md line 171 ("Given a session created via `browser_navigate`, When the client calls `browser_get_state`, Then a Zod-valid PageStateModel returns") now has an unambiguous implementation seam. No spec.md edit required — the clarification lives here in impact.md per R11.4 (impact.md is the canonical location for shared-contract clarifications).
    # v0.2.4 — Wave 6 prep (R18 append-only Phase-2 extension of Phase 1 BrowserPage surface for click tools)
    - v0.2.4 — Phase 1 BrowserPage.mouse surface extension for Wave 6 tools (T027 browser_click + T028 browser_click_coords); structurally compatible with MouseBehavior MousePage interface; R18 append-only (browser-runtime/MouseBehavior.ts:22 explicitly anticipates this). BrowserPage interface gains `mouse: { move, down, up, click }` matching MouseBehavior.ts:33-40 exactly so `mouseBehavior.click(session.page, coords)` typechecks without re-typing in the Wave 6 tool factories. Concrete impl in BrowserManager.ts delegates each method to `playwrightPage.mouse.*` (Playwright's Page.mouse has all four methods with compatible signatures; no `as never` escape needed). R18 append-only: zero existing methods touched; zero signatures changed. R9 adapter boundary preserved (no new `playwright` imports outside BrowserManager.ts). T026 browser_get_metadata needs no Phase 1 surface change — it reads metadata inline via `session.page.url()` + `session.page.evaluate('() => document.title')`.
    # v0.2.5 — Wave 7 prep (R18 append-only Phase-2 extension of Phase 1 BrowserPage surface for type/scroll/select tools)
    - v0.2.5 — Phase 1 BrowserPage surface extension for Wave 7 (T029 browser_type: keyboard + focus; T030 browser_scroll: mouse.wheel; T031 browser_select: selectOption); R18 append-only; structurally compatible with TypingBehavior + ScrollBehavior MousePage/TypingPage/ScrollPage interfaces; no Phase 1 consumer breakage.
    # v0.2.6 — Wave 8 prep (R18 append-only Phase-2 extension of Phase 1 BrowserPage surface for upload tool)
    - v0.2.6 — Phase 1 BrowserPage.setInputFiles surface extension for Wave 8 T034 browser_upload; R18 append-only; safetyClass='requires_hitl' (Phase 4 SafetyCheck gate).
  changed:
    - v0.2 — risk_level remains HIGH (4 contracts unchanged); upstream substrate now explicitly Phase 1c PerceptionBundle (was implicitly Phase 1 PageStateModel)
  impacted:
    - v0.2 — Phase 7 DeepPerceiveNode: receives Phase 2 AnalyzePerception (separate Zod schema) AND Phase 1c bundleToAnalyzePerception(bundle, stateId?) accessor (returns PSM); both contracts coexist
  unchanged:
    - All shared-contract ID stable (R18 append-only)

governing_rules:
  - Constitution R9
  - Constitution R18 (append-only delta enforced for v0.2 patch wave)
  - Constitution R19 (rollup-first reading order — predecessor rollups primary inputs)
  - Constitution R20
  - Constitution R22
  - Phase 1c impact.md §11 (namespace contract carryforward — Phase 2 MUST NOT write to bundle.raw.*._extensions)
---

# Impact Analysis: MCPToolRegistry + MCPToolSchema + AnalyzePerception + RateLimiter

## Phase 1b/1c upstream substrate (v0.2 — F-S1 staleness sweep)

This phase sits on top of Phase 1b (extension layer, shipped 2026-05-11) and Phase 1c (PerceptionBundle envelope, shipped 2026-05-12). Both must be acknowledged as upstream substrate before any Phase 2 contract is materialized.

**Phase 1b inheritance** — 10 perception extractors (PricingExtractor, AttentionScorer, ClickTargetSizer, CommerceBlockExtractor, CurrencySwitcherDetector, FrictionScorer, MicrocopyTagger, PopupPresenceDetector, SocialProofDepth, StickyElementDetector) produce enrichments in the `_extensions` namespace under PageStateModel. These are now resident in `bundle.raw.page_state_model_by_state[stateId]._extensions.<extractor_name>`.

**Phase 1c inheritance** — PerceptionBundle envelope wraps PageStateModel + AnalyzePerception alias + screenshots in `bundle.raw.*_by_state[stateId]`, layered with envelope channels (meta + performance + nondeterminism_flags + warnings + state_graph + element_graph_by_state). Backward-compat accessor: `bundleToAnalyzePerception(bundle, stateId?: string)` returns the PSM at that state. 4 closed Zod enums shipped (consumers MUST use exact values; append-only extension via R18 only):
- `IframePurpose` (closed 9-value enum: checkout, chat, video, analytics, social_embed, captcha, cmp, payment_3ds, other) — note `cross_origin` is a `classifyIframe()` security-override return value that supersedes enum classification, NOT a member of `IframePurpose` (per Phase 1c IframePolicyEngine.ts:44-58)
- `HiddenReason` (7 values)
- `NondeterminismFlag` (9 values)
- `WarningCode` (12 values)

**Namespace contract carryforward (CRITICAL — F-S4 + Phase 1c impact.md §11):** Anything written under `bundle.raw.page_state_model_by_state[*]._extensions` OR `bundle.raw.analyze_perception_by_state[*]._extensions` is RESERVED for Phase 7 DeepPerceiveNode. **Phase 2 MUST NOT write to either namespace.** Runtime assertion: Phase 1c `assertNamespaceContract` in `PerceptionBundle.ts` enforces; AC-10 + AC-12 conformance tests anchor.

**Substrate compatibility for Phase 2 tools:**
- `browser_get_state` (T024) — DECISION (v0.2): returns `PageStateModel` (Phase 1 contract, < 20K tokens per NF-Phase1-01 v0.4) for backward compat. Phase 5 BrowseNode may later add a `browser_get_bundle` tool returning the full PerceptionBundle if envelope channels are needed at MCP-tool granularity. Phase 2 keeps the simpler shape.
- `page_analyze` (T048) — DECISION (v0.2 per F-G1): emits a SEPARATE `AnalyzePerception` Zod schema extending PSM with v2.3 enrichments. Phase 1c `bundleToAnalyzePerception` accessor remains (returns PSM as-is); Phase 7 calls `page_analyze` separately for full v2.3 enriched form. Both contracts coexist.
- `page_analyze` (T048) — DECISION (v0.2 per F-G2): caller responsibility to invoke `waitForSettle(page)` BEFORE `page_analyze`. The single-call invariant (REQ-TOOL-PA-001) counts ONLY the analyze-mode `page.evaluate()` call within the handler — verifiable via Playwright trace count.

---

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

**Forward stability promise (v0.2 — F-S12):** ALL 29 tools MUST be registered with explicit `safetyClass` at Phase 2 close. Reserved enum value `forbidden` is intentionally unused in Phase 2 (held for Phase 4 SafetyCheck escalation). Per-tool defaults (locked in spec/tasks v0.3):

| Tool category | Safety class | Tools |
|---|---|---|
| Navigation (T020-T023) | `safe` | browser_navigate, browser_go_back, browser_go_forward, browser_reload |
| Perception read (T024-T026) | `safe` | browser_get_state, browser_screenshot, browser_get_metadata |
| Interaction (T027-T029, T031, T033) | `requires_safety_check` | browser_click, browser_click_coords, browser_type, browser_select, browser_press_key |
| Motion (T030, T032) | `safe` | browser_scroll, browser_hover |
| File transfer (T034, T037) | `requires_hitl` | browser_upload, browser_download |
| Utility (T035, T036, T038, T039, T040) | `safe` | browser_tab_manage, browser_extract, browser_find_by_text, browser_get_network, browser_wait_for |
| Agent signal (T041) | `safe` | agent_complete |
| Agent HITL (T042) | `requires_hitl` | agent_request_human |
| Sandboxed eval (T043) | `requires_safety_check` | browser_evaluate (arbitrary-JS surface even within sandbox; HITL-eligible per Phase 4 SafetyCheck policy) |
| Page perception (T044-T048) | `safe` | page_get_element_info, page_get_performance, page_screenshot_full, page_annotate_screenshot, page_analyze (read-only) |

Phase 4 SafetyCheck (T067) may elevate any `safe`/`requires_safety_check` tool to `requires_hitl` based on per-domain policy without requiring an impact.md cycle (the safetyClass field is the SLOT; the policy layer is what consults it).

### `AnalyzePerception` (NEW — most important schema in Neural)

**After:** matches §07.9 baseline (9 sections) + §07.9.1 v2.3 enrichments. **F-CARRY-1 resolution (T-PHASE2-TYPES, 2026-05-12):** §07.9.1 table enumerates **11 enrichment categories** (rows: metadata, structure [new], textContent, ctas[], forms[].fields[], trustSignals[], iframes [new top-level], navigation, accessibility [new top-level], performance, inferredPageType [new top-level]) and **38 enrichment sub-fields**. The previously-stated "14 v2.3 enrichment categories (~30 sub-fields)" was an approximation that drifted from §07.9.1 verbatim; canonical authority is §07.9 + §07.9.1 schema text, NOT the category count. AnalyzePerceptionSchema authored at `analysis/types.ts` per §07.9 verbatim. Concrete schema authored at T-PHASE2-TYPES; this impact.md captures the shape promise:

- Top-level `AnalyzePerceptionSchema = z.object({ metadata, structure, headingHierarchy, landmarks, semanticHTML, textContent, ctas, forms, trustSignals, layout, images, navigation, performance, iframes?, accessibility?, inferredPageType }).strict()`
- Every leaf field is nullable per `null + reason` pattern; failures are observable, not silent.
- v2.3 enrichments appear as additional sub-fields (NOT a new top-level section): `metadata.canonical/lang/ogTags/schemaOrg`, `structure.titleH1Match/titleH1Similarity`, `textContent.valueProp/urgencyScarcityHits/riskReversalHits`, `ctas[].accessibleName/role/hoverFocusStyles`, `forms[].fields[].accessibleName/role`, `trustSignals[].subtype/source/attribution/freshnessDate/pixelDistanceToNearestCta`, `iframes[].purposeGuess`, `navigation.footerNavItems`, `accessibility.keyboardFocusOrder/skipLinks`, `performance.INP/CLS/TTFB/timeToFirstCtaInteractable`, `inferredPageType.primary/alternatives/signalsUsed`.
- Forward-compatibility seam: top-level `_extensions: z.record(z.string(), z.unknown()).optional()` — same pattern as Phase 1 PageStateModel.

#### Design decisions (v0.2 — Gate 1 Pass 1 patch wave)

**F-G1 — Schema relationship to Phase 1c PSM-alias (DECIDED):** AnalyzePerceptionSchema is a SEPARATE Zod schema distinct from PageStateModel. Phase 1c's `bundleToAnalyzePerception(bundle, stateId?)` accessor returns the PSM as-is (the alias holds — see Phase 1c phase-1c-current.md §3 footnote). Phase 2's `page_analyze` tool produces the FULL v2.3 enriched AnalyzePerception via a separate code path. Phase 7 EvaluateNode chooses which contract to consume per use case (PSM via bundle accessor for grounding-rule lookups; full AnalyzePerception via direct page_analyze call when v2.3 enrichments are required). Both contracts coexist; neither supersedes the other.

**F-S4 — Namespace contract assertion (CRITICAL precedent for Phase 7):** Phase 2 MUST NOT write into:
- `bundle.raw.page_state_model_by_state[*]._extensions` (Phase 1c reservation — Phase 7 DeepPerceiveNode owns)
- `bundle.raw.analyze_perception_by_state[*]._extensions` (Phase 1c reservation — Phase 7 DeepPerceiveNode owns)
- `AnalyzePerception._extensions` (Phase 2-defined `_extensions` reservation — Phase 7+ deepPerceive namespace)

Runtime enforcement: Phase 1c `assertNamespaceContract` in `PerceptionBundle.ts` (already shipped). Phase 2 conformance test for T048 MUST add an explicit assertion: every `page_analyze` output's `_extensions` field is `undefined` (not `{}`, not populated) — see AC-11 + AC-13 conformance updates in spec.md v0.3.

**F-S13 — `iframes[].purposeGuess` closed-enum constraint (HIGH):** The `iframes[].purposeGuess` enrichment field MUST constrain to Phase 1c's `IframePurpose` Zod enum. Authoritative values shipped in Phase 1c (`packages/agent-core/src/perception/IframePolicyEngine.ts:48-58`):

```ts
// Phase 1c IframePurpose closed 9-value enum — VERIFIED VERBATIM 2026-05-12
// per T-PHASE2-TYPES R11.4 patch (subagent discovered the Pass 1 patch wave
// drift: 'video_embed' → 'video'; 'cross_origin' is NOT an enum member but
// a classifyIframe() security-override return value)
export const IFRAME_PURPOSE_ENUM = [
  'checkout',
  'chat',
  'video',
  'analytics',
  'social_embed',
  'captcha',
  'cmp',
  'payment_3ds',
  'other',
] as const;
export type IframePurpose = (typeof IFRAME_PURPOSE_ENUM)[number];
export const IframePurposeSchema = z.enum(IFRAME_PURPOSE_ENUM);
```

**`cross_origin` clarification:** `cross_origin` is a distinct decision string returned by `classifyIframe()` as the `purpose` field of `IframePolicyDecision` when the iframe is cross-origin (security override classified FIRST per IframePolicyEngine.ts:257-261), but `cross_origin` is NOT a member of the `IframePurpose` type. It's documented at IframePolicyEngine.ts:44-46: "Closed 9-value enum (R-05 v0.2). `cross_origin` is a distinct decision `purpose` value but is NOT a member of `IframePurpose` (security override is not a content type)."

Phase 2 page_analyze MUST import `IframePurposeSchema` from `../perception/IframePolicyEngine.js` and use it directly to constrain `iframes[].purposeGuess` (matching what T-PHASE2-TYPES did at `AnalyzePerceptionSchema` authoring). If page_analyze needs to express that an iframe is cross-origin and untyped, the field shape decision is one of: (a) leave `purposeGuess` as `null` with a `purposeGuessReason: 'cross_origin'` sibling field (current preferred path), OR (b) extend the enum via R18 append-only. Either way: NEVER invent ad-hoc purpose strings in Phase 2.

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

Each of the 29 tools (22 browser_* + 2 agent_* + 5 page_*) defines its own input/output Zod schema in its own file (`mcp/tools/<name>.ts`). The base helper type `MCPToolSchema<I, O>` lives in `mcp/types.ts` and just re-exports `MCPToolDefinition<I, O>` plus a small assertion helper.

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

**Forward stability promise:** every tool name + schema is the contract. Phase 5 LangGraph nodes will hard-reference tool names; renaming any of the 29 tools after Phase 2 is a HIGH-impact change requiring its own impact.md.

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
| All 29 MCP tools register with EXACT v3.1 names | grep + boot test |
| `page_analyze` output's `_extensions` field is `undefined` (Phase 1c namespace contract) | `tests/conformance/page-analyze-v23.test.ts` (AC-11) + `tests/integration/phase2.test.ts` (AC-13) |
| `page_analyze` `iframes[].purposeGuess` constrained to Phase 1c IframePurpose closed enum | `tests/conformance/page-analyze-v23.test.ts` (AC-11 — Zod parse asserts) |
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

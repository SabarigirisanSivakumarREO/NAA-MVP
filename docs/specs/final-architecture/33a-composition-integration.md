---
title: 33a-composition-integration
artifact_type: architecture-spec
status: approved
loadPolicy: on-demand-only
version: 2.3
updated: 2026-04-24
governing_rules:
  - Constitution R17 (Lifecycle States)
  - Constitution R22 (The Ratchet)
note: Reference material. Do NOT load by default (CLAUDE.md Tier 3). Load only the single REQ-ID section cited by the current task.
---

# Section 33a — Composition Integration Plan

**Status:** Addendum to §33. Specifies which §33 interfaces MUST be built into Phases 1-10 so that Phase 11 (full interactive composition) is a feature activation, not a rewrite.

**Principle:** Design for §33 from Day 1. Implement the static path in Phases 1-10. Activate the interactive path in Phase 11. Zero refactoring required.

---

## 33a.1 The Problem This Solves

§33 Agent Composition Model changes fundamental interfaces:
- The evaluate node becomes a ReAct loop (not a single-shot call)
- The browser session is shared between browse and analyze (not owned by browse)
- The safety classifier needs context awareness (which node is calling)
- The tool registry must support dynamic tool sets (not hardcoded per mode)

If Phases 1-10 build these components without §33 awareness, Phase 11 becomes a rewrite of 5 core modules. This addendum ensures the interfaces are right from Phase 1.

---

## 33a.2 Per-Phase Integration Requirements

### Phase 1 — Perception Foundation

**No §33 changes.** Perception is consumed by both static and interactive evaluation identically.

### Phase 2 — MCP Tools + Human Behavior

**§33 Interface: Injectable Tool Registry**

**REQ-COMP-PHASE2-001:** The MCP server SHALL expose tools through a `ToolRegistry` that supports dynamic tool sets, not a hardcoded list.

```typescript
// WRONG (hardcoded — would need rewriting for §33):
const tools = [browserNavigate, browserClick, browserType, ...]; // fixed 28

// RIGHT (registry — §33 just adds a new set):
interface ToolRegistry {
  registerToolSet(setName: string, tools: MCPToolDefinition[]): void;
  getToolSet(setName: string): MCPToolDefinition[];
  getToolsForContext(context: ToolContext): MCPToolDefinition[];
}

interface ToolContext {
  mode: "browse" | "analyze";
  compositionMode?: "interactive" | "static";  // Phase 11 adds this
  executionMode?: ExecutionMode;                // Mode A/B/C
}
```

**Phase 2 implementation:** Register two tool sets: `browse` (23 tools) and `analyze` (5 tools). The `getToolsForContext` method returns the appropriate set based on mode. Phase 11 adds a third set: `analyze_interactive` (9 browser + 6 analysis).

**REQ-COMP-PHASE2-002:** The 3 analysis output tools (`produce_finding`, `mark_heuristic_pass`, `mark_heuristic_needs_review`) SHALL be defined in Phase 2 as tool schemas, even though they're only used in Phase 11's interactive evaluate. This prevents schema changes later.

```typescript
// Defined in Phase 2, not activated until Phase 11:
const analyzeOutputTools: MCPToolDefinition[] = [
  {
    name: "produce_finding",
    description: "Record a CRO finding for a heuristic evaluation",
    inputSchema: RawFindingSchema,  // from §5.2
  },
  {
    name: "mark_heuristic_pass",
    description: "Mark a heuristic as passing for this page",
    inputSchema: z.object({ heuristic_id: z.string(), observation: z.string() }),
  },
  {
    name: "mark_heuristic_needs_review",
    description: "Mark a heuristic as uncertain, requiring consultant review",
    inputSchema: z.object({ heuristic_id: z.string(), reason: z.string() }),
  },
];
```

### Phase 4 — Safety & Infrastructure

**§33 Interface: Context-Aware Safety Classifier**

**REQ-COMP-PHASE4-001:** The `ActionClassifier` SHALL accept a `SafetyContext` parameter that includes the calling node, not just the tool name and URL.

```typescript
// WRONG (no context — can't distinguish browse vs analyze):
function classifyAction(toolName: string, url: string): ActionClass { ... }

// RIGHT (context-aware — §33 adds analyze-specific rules):
interface SafetyContext {
  toolName: string;
  toolArgs: Record<string, any>;
  currentUrl: string;
  callingNode: "browse" | "analyze" | "explore";  // who's calling
  domainPolicy: DomainPolicy;
  browserSession?: BrowserSession;  // for focused-element checks (Phase 11)
}

function classifyAction(context: SafetyContext): ActionClass | Promise<ActionClass> {
  // Phase 4 implementation: only checks toolName + domainPolicy
  // Phase 11 adds: if (context.callingNode === "analyze") { ... }
  //   - Enter key reclassification (REQ-COMP-011a)
  //   - Sensitive action blocking during analysis
  //   - Navigation detection
}
```

**Phase 4 implementation:** Build the classifier with the `SafetyContext` signature but only implement browse-mode rules. The `callingNode` field defaults to `"browse"`. Phase 11 adds analyze-mode rules without changing the interface.

**REQ-COMP-PHASE4-002:** The `BrowserSession` wrapper SHALL be designed as a **shareable handle**, not as a private member of the browse graph.

```typescript
// WRONG (browser session coupled to browse graph):
class BrowseGraph {
  private session: BrowserSession;  // nobody else can use this
  constructor() { this.session = new BrowserSession(); }
}

// RIGHT (session is external, injected):
class BrowserSessionManager {
  async createSession(config: SessionConfig): Promise<BrowserSession>;
  async getSession(sessionId: string): Promise<BrowserSession>;
  async closeSession(sessionId: string): Promise<void>;
}

// Browse graph receives session, doesn't own it:
class BrowseGraph {
  constructor(private session: BrowserSession) { }
}

// Phase 11: Analysis graph also receives the same session:
class AnalysisGraph {
  constructor(
    private perception: AnalyzePerception,
    private session?: BrowserSession,  // null in static mode
  ) { }
}
```

### Phase 5 — Browse Mode MVP

**§33 Interface: Session Lifecycle Managed by Orchestrator**

**REQ-COMP-PHASE5-001:** The browse subgraph SHALL NOT create or destroy the browser session. The audit orchestrator creates the session before browse and closes it after analysis (or after the audit for workflow mode).

```typescript
// WRONG (browse owns session lifecycle):
async function browseSubgraph(state: AuditState) {
  const session = await BrowserSessionManager.create();  // ← creates
  // ... navigate, perceive, act, verify ...
  await session.close();  // ← destroys
}

// RIGHT (orchestrator owns, browse borrows):
// In audit_setup or page_router:
const session = await BrowserSessionManager.create(config);
state.browser_session_id = session.id;

// Browse subgraph receives session via state:
async function browseSubgraph(state: AuditState) {
  const session = await BrowserSessionManager.get(state.browser_session_id);
  // ... navigate, perceive, act, verify ...
  // Does NOT close session — orchestrator decides when
}

// After analysis completes, orchestrator decides:
// - Multi-page: close session, open new for next page (or reuse)
// - Workflow: keep session open across steps
```

**Phase 5 implementation:** Build the browse graph to accept an external session. The orchestrator creates/manages sessions. This is the same effort as building session-internal — just different ownership.

**REQ-COMP-PHASE5-002:** Add `browser_session_id` to `AuditState` (§5.3):

```typescript
// In AuditState:
browser_session_id: Annotation<string | null>({ default: () => null }),
```

### Phase 7 — Analysis Pipeline

**§33 Interface: Pluggable Evaluate Strategy**

**REQ-COMP-PHASE7-001:** The evaluate node SHALL use a **strategy pattern** that allows swapping the evaluation implementation without changing the graph topology.

```typescript
// WRONG (hardcoded single-shot evaluate):
async function evaluateNode(state: AuditState): Promise<Partial<AuditState>> {
  const findings = await singleShotEvaluate(state.analyze_perception, state.filtered_heuristics);
  return { raw_findings: findings };
}

// RIGHT (strategy pattern — §33 adds InteractiveEvaluateStrategy):
interface EvaluateStrategy {
  evaluate(
    state: AuditState,
    perception: AnalyzePerception,
    heuristics: HeuristicExtended[],
    browserSession: BrowserSession | null,  // null = static mode
  ): Promise<EvaluateResult>;
}

interface EvaluateResult {
  raw_findings: RawFinding[];
  interactions: InteractionRecord[];       // empty in static mode
  open_observations: OpenObservation[];    // empty until Phase 11
  token_count: number;
  cost_usd: number;
}

class StaticEvaluateStrategy implements EvaluateStrategy {
  // Phase 7 implementation: single-shot LLM call (§7.5)
  async evaluate(state, perception, heuristics, _session) {
    const response = await llm.invoke(buildPrompt(perception, heuristics));
    return {
      raw_findings: parseFindings(response),
      interactions: [],
      open_observations: [],
      token_count: response.usage.total_tokens,
      cost_usd: calculateCost(response.usage),
    };
  }
}

// Phase 11 adds:
class InteractiveEvaluateStrategy implements EvaluateStrategy {
  // ReAct loop with tool injection (§33.7b REQ-COMP-039)
}

// The evaluate node is strategy-agnostic:
async function evaluateNode(state: AuditState): Promise<Partial<AuditState>> {
  const strategy = state.composition_mode === "interactive"
    ? new InteractiveEvaluateStrategy()
    : new StaticEvaluateStrategy();

  const session = state.browser_session_id
    ? await BrowserSessionManager.get(state.browser_session_id)
    : null;

  const result = await strategy.evaluate(
    state, state.analyze_perception!, state.filtered_heuristics, session
  );

  return {
    raw_findings: result.raw_findings,
    analysis_interactions: result.interactions,
    analysis_interaction_count: result.interactions.length,
    open_observations: result.open_observations,
    evaluate_token_count: result.token_count,
    analysis_cost_usd: result.cost_usd,
  };
}
```

**Phase 7 implementation:** Build `StaticEvaluateStrategy` (single-shot, identical to §7.5). Build the `evaluateNode` wrapper with the strategy pattern. The `InteractiveEvaluateStrategy` class is a stub that throws "Not implemented — enable in Phase 11." The cost is one extra interface + one wrapper function.

**REQ-COMP-PHASE7-002:** The analysis subgraph SHALL accept `BrowserSession | null` as an input from the orchestrator, even in Phase 7 (where it's always null).

```typescript
// Analysis graph constructor accepts optional session:
const analyzeGraph = buildAnalyzeGraph({
  browserSession: null,  // Phase 7: always null (static mode)
  // Phase 11: orchestrator passes the live session
});
```

**REQ-COMP-PHASE7-003:** Add §33 state fields (§33.13) to `AuditState` in Phase 7, with defaults:

```typescript
// All §33 fields added in Phase 7, all with defaults (no impact on static mode):
composition_mode: Annotation<CompositionMode>({ default: () => "static" as const }),
interaction_depth: Annotation<"standard" | "deep">({ default: () => "standard" as const }),
dual_mode_evaluation: Annotation<boolean>({ default: () => false }),  // off until Phase 11
analysis_interactions: Annotation<InteractionRecord[]>({ ... }),
analysis_interaction_count: Annotation<number>({ default: () => 0 }),
analysis_interaction_budget: Annotation<number>({ default: () => 0 }),  // 0 = static
open_observations: Annotation<OpenObservation[]>({ ... }),
session_contamination_events: Annotation<SessionContaminationEvent[]>({ ... }),
```

### Phase 8 — Audit Orchestrator

**§33 Interface: Session-Passing Orchestrator + Restore Node**

**REQ-COMP-PHASE8-001:** The orchestrator SHALL pass the browser session from browse to analyze:

```typescript
// In routeAfterBrowse:
function routeAfterBrowse(state: AuditState): "analyze" | "page_router" {
  if (state.is_complete && state.completion_reason === "success") {
    // Session stays open — analyze will receive it via state.browser_session_id
    return "analyze";
  }
  // Browse failed — close session for this page
  return "page_router";
}
```

**REQ-COMP-PHASE8-002:** Add the `restore_state` node to the orchestrator graph in Phase 8 (even though it's a no-op in static mode):

```typescript
const auditGraph = new StateGraph(AuditState)
  .addNode("audit_setup", auditSetupNode)
  .addNode("page_router", pageRouterNode)
  .addNode("browse", browseGraph)
  .addNode("analyze", analyzeGraph)
  .addNode("restore_state", restoreStateNode)  // Phase 8: no-op in static mode
  .addNode("audit_complete", auditCompleteNode)
  // ... edges include analyze → restore_state → page_router
```

```typescript
// Phase 8 implementation (no-op for static mode):
async function restoreStateNode(state: AuditState): Promise<Partial<AuditState>> {
  // Static mode or no interactions: skip restoration
  if (state.composition_mode === "static" || state.analysis_interaction_count === 0) {
    return {};
  }
  // Phase 11 adds: browser_reload + stability wait + verification
  // For now, this code path is unreachable (interaction count is always 0)
  return {};
}
```

### Phase 9 — Master Foundations

**No additional §33 interfaces needed.** Phase 9 (trigger gateway, discovery, reproducibility) operates upstream of composition.

### Phase 10 — State Exploration

**REQ-COMP-PHASE10-001:** State exploration (§20) produces a `StateGraph` that §33 interactive evaluate reads. The `explore_states` node already uses the browser session (per §20 REQ-STATE-EXPLORE-001). Ensure the session handle follows the same `BrowserSessionManager.get()` pattern from Phase 5.

**REQ-COMP-PHASE10-002:** After `explore_states` completes, the `StateGraph` is frozen (REQ-COMP-033). Add an immutability check:

```typescript
// After explore_states:
state.state_graph = Object.freeze(builtStateGraph);
// Phase 11's interactive evaluate reads but cannot modify
```

---

## 33a.3 Phase 11 — Agent Composition (What's LEFT After Interface Prep)

With the interfaces built into Phases 2-8, Phase 11 only needs to:

1. **Implement `InteractiveEvaluateStrategy`** — the ReAct loop (§33.7b)
2. **Add analyze-mode safety rules** — Enter-key reclassification (REQ-COMP-011a), navigation guards (REQ-COMP-012)
3. **Register `analyze_interactive` tool set** — 9 browser + 6 analysis tools
4. **Implement `HeuristicInteractionTracker`** — per-heuristic budget enforcement
5. **Implement Pass 2 open observation** — prompt + relaxed grounding (REQ-COMP-040-043)
6. **Implement GR-011** — per-state finding data correctness
7. **Implement `workflowStepRestore`** — funnel state verification (REQ-COMP-022a)
8. **Implement session contamination tracking** — transition action detection (REQ-COMP-064)
9. **Implement context window management** — message pruning, state-delta compression
10. **Activate `composition_mode = "interactive"` as default** — flip the flag
11. **Integration tests** for interactive composition on 3 real sites
12. **Acceptance tests** for dual-mode evaluation quality

**None of these require changes to Phase 1-10 code.** They add new strategy implementations, new safety rules, and new tool sets — all through the interfaces established earlier.

---

## 33a.4 Interface Cost Assessment

| Phase | Extra Work for §33 Interfaces | Alternative (Without §33 Awareness) |
|---|---|---|
| Phase 2 | `ToolRegistry` + 3 output tool schemas | Hardcoded tool list → Phase 11 rewrite |
| Phase 4 | `SafetyContext` parameter + `BrowserSessionManager` | Fixed classifier → Phase 11 rewrite |
| Phase 5 | External session injection (not internal creation) | Browse-owned session → Phase 11 rewrite |
| Phase 7 | `EvaluateStrategy` interface + `StaticEvaluateStrategy` | Hardcoded evaluate → Phase 11 rewrite |
| Phase 8 | Session passing + `restore_state` no-op node | No session passing → Phase 11 rewrite |

**Total overhead: ~2-3 days of extra interface design across Phases 2-8.**
**Savings: ~2-3 weeks of Phase 11 refactoring avoided.**

---

## 33a.5 Backward Compatibility Verification

| Phase | With §33 Interfaces | Behavior in Static Mode |
|---|---|---|
| Phase 2 | `ToolRegistry.getToolsForContext({mode: "browse"})` | Returns 23 browse tools. Identical. |
| Phase 4 | `classifyAction({callingNode: "browse", ...})` | Browse rules only. Identical. |
| Phase 5 | Session created by orchestrator, passed to browse | Browse uses session normally. Identical. |
| Phase 7 | `StaticEvaluateStrategy.evaluate(...)` | Single-shot LLM call. Identical to §7.5. |
| Phase 8 | `restore_state` node, `browser_session_id` in state | No-op node. Null session_id. Identical. |

**All phases produce identical behavior in static mode.** The §33 interfaces are invisible when `composition_mode = "static"`.

---

**End of §33a — Composition Integration Plan**

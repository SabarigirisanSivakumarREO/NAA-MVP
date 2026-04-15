# AI Browser Agent Architecture v3.1 — Unified Specification

## V2.0 Depth + V3.0 Innovations + Critical Analysis Fixes

**REO Digital / Neural Product Team — March 2026**
**Spec ID:** REO-BROWSER-AGENT-v3.1
**Status:** Pre-Implementation — Architecture Lock
**Methodology:** Spec-Driven Development (SDD) with GitHub Spec Kit
**Target Implementation:** Claude Code + LangGraph.js
**MCP Version:** 2025-03-26 (Protocol Revision)

---

## Document Control

| Field | Detail |
|-------|--------|
| **Predecessor** | v2.0 (16 sections, custom tools) + v3.0 (MCP-native, formal spec) |
| **Merge Strategy** | v2.0 depth (memory, human-like behavior, failure modes) + v3.0 structure (REQ-IDs, pre/postconditions, MCP, confidence) |
| **Critical Fixes** | Confidence formula, tool manifest gaps, rate limiting, streaming, JS sandbox |
| **Review Cycle** | Weekly during implementation |
| **Compliance** | RFC 2119 (SHALL/MUST/SHOULD/MAY) + GitHub Spec Kit v2.1 |

---

## Section 0 — Brutal Honesty (from v2.0, enhanced)

### 0.1 Reality Check

| Claim | Evidence |
|-------|---------|
| **Reliability ceiling is ~80-86%** | WebArena best: ~62%. WorkArena best: ~43%. Our target is realistic for *known* sites only. Arbitrary sites will be lower. |
| **Vision-only perception is fragile** | Anthropic Computer Use: ~22% on OSWorld. Screenshot flipbook loses DOM precision. |
| **Hybrid perception is mandatory** | AX-tree primary + screenshot fallback is the only approach that works across modern SPAs. |
| **No agent is production-reliable today** | Browser Use claims 89% on WebVoyager — a curated benchmark, not production traffic. |
| **Cost matters** | Vision-based agents cost $0.30+/step. Deterministic replay costs $0/step. Mode routing is the economic advantage. |

### 0.2 Core Architectural Thesis (from v3.0)

> **The browser agent is not an LLM with browser tools. It is a deterministic state machine with LLM-assisted reasoning, formally verified actions, and standardized protocol interfaces.**

### 0.3 What This Version Merges

| From v2.0 (Depth) | From v3.0 (Innovation) | New in v3.1 (Fixes) |
|---|---|---|
| 4-type memory system with pgvector | MCP-native tool interface | Expanded 23-tool manifest (full v2.0 parity + 4 new) |
| ghost-cursor, Gaussian typing, stealth | Confidence scoring system | Multiplicative confidence decay |
| 12 known failure modes + mitigations | Mutation-aware verification | Streaming progress events |
| Engineering constitution & decision log | Formal REQ-IDs + pre/postconditions | JS sandbox specification |
| Human-like behavior detail | Rate limiting as Layer 1 | Domain circuit breaker |
| 12 semantic + 3 restricted tools | 5-node MVP graph | 5-phase MVP plan with formal exit gates |

---

## Section 1 — Architecture Decisions

### 1.1 Locked Decisions (11 + 2 new)

| # | Decision | Rationale |
|---|----------|-----------|
| AD-01 | **TypeScript** | Type safety, Zod schemas, LangGraph.js compatibility |
| AD-02 | **LangGraph.js** | State graph with conditional routing, checkpointing, interrupt() |
| AD-03 | **Playwright + stealth plugin** | Best browser automation library, stealth for anti-detection |
| AD-04 | **PostgreSQL + pgvector** | Checkpointing, memory, semantic search in one DB |
| AD-05 | **LLM Adapter pattern** | Swap Anthropic/OpenAI/Gemini without graph changes |
| AD-06 | **AX-tree primary perception** | Cheaper, more reliable than vision-only |
| AD-07 | **3 execution modes** | Cost optimization: $0 / ~$0.10 / ~$0.30 per step |
| AD-08 | **Hard safety gates** | Not LLM-discretionary — enforced at graph level |
| AD-09 | **Monorepo** | `apps/` + `packages/` with shared types |
| AD-10 | **Docker isolation** (production) | Container per run for security |
| AD-11 | **LangSmith tracing** | Observability from Day 1 |
| AD-12 | **MCP-native tool interface** *(from v3.0)* | Access 5,000+ community servers, standardized discovery |
| AD-13 | **Confidence-based completion** *(from v3.0)* | Prevents premature task abandonment (#1 WebArena failure) |

### 1.2 Deferred Decisions (6)

| # | Decision | Defer Until |
|---|----------|-------------|
| DD-01 | Multi-agent coordination | After MVP validation |
| DD-02 | WebSocket vs SSE for streaming | Phase 5 (orchestration) |
| DD-03 | Redis caching layer | After memory phase benchmarks |
| DD-04 | Custom vision model fine-tuning | After Mode C validation |
| DD-05 | Kubernetes orchestration | Production scaling phase |
| DD-06 | Multi-browser support (Firefox/WebKit) | After Chromium stable |

---

## Section 2 — Layered Architecture (8 Layers)

### 2.1 Layer Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 8: Evaluation & Observability                              │
│ LangSmith tracing, WAREX stress testing, scorecards,             │
│ regression detection, internal benchmarks                        │
├─────────────────────────────────────────────────────────────────┤
│ Layer 7: Safety & Approval                                       │
│ Action classification (safe/caution/sensitive/blocked),           │
│ hard gates, audit log, domain denylist, MCP safety               │
├─────────────────────────────────────────────────────────────────┤
│ Layer 6: Memory & Replay                                         │
│ Working (Postgres), Episodic (session logs), Semantic (pgvector), │
│ Procedural (workflow recipes for Mode A)                         │
├─────────────────────────────────────────────────────────────────┤
│ Layer 5: Verification & Reflection                               │
│ Action contracts, failure taxonomy, mutation observation,         │
│ confidence adjustment, replan routing                             │
├─────────────────────────────────────────────────────────────────┤
│ Layer 4: Action                                                  │
│ 23 MCP tools (4 nav, 3 percept, 8 interact, 1 tab, 2 data,      │
│ 2 discovery, 2 control, 1 HITL, 1 restricted) + human behavior   │
├─────────────────────────────────────────────────────────────────┤
│ Layer 3: Perception                                              │
│ AX-tree primary, dual-stage filtering (hard + soft),             │
│ mutation monitoring, screenshot fallback (<10 AX nodes)          │
├─────────────────────────────────────────────────────────────────┤
│ Layer 2: Orchestration (LangGraph.js)                            │
│ State graph, mode routing, confidence scoring,                   │
│ HITL pause/resume, Postgres checkpointing, streaming events      │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: Request & Policy                                        │
│ Task intake, mode classification, budget assignment,             │
│ domain policy, rate limiting, robots.txt, circuit breaker        │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Interface Contracts

**REQ-LAYER-001**: Layer N SHALL only import from Layer N-1, N, or N+1 via adapter interfaces.

**REQ-LAYER-002**: All inter-layer communication SHALL use TypeScript interfaces with Zod runtime validation.

**REQ-LAYER-003**: Layer 4 (Action) SHALL expose tools exclusively through MCP protocol.

**REQ-LAYER-004** *(new)*: Layer 2 SHALL emit SSE/WebSocket events for each state transition.

---

## Section 3 — Three Execution Modes

### 3.1 Mode Definitions

#### Mode A: Deterministic Workflow

**REQ-MODE-001**: When `execution_mode === "deterministic"`, the system SHALL execute pre-recorded Playwright workflows without LLM invocation.

- **Cost:** $0 per step
- **Preconditions:** Workflow recipe exists with `success_rate > 0.9`, selectors validated within 30 days
- **Postconditions:** Task completion OR automatic downgrade to Mode B on selector failure
- **Invariant:** Zero LLM tokens consumed

#### Mode B: Guided Agent

**REQ-MODE-002**: When `execution_mode === "guided_agent"`, the system SHALL execute the LangGraph ReAct loop: perceive → reason → safety → act → verify.

- **Cost:** ~$0.10 per step (AX-tree + LLM reasoning)
- **Preconditions:** Page accessibility snapshot available, confidence initialized to 1.0
- **Postconditions:** Task completion with confidence > 0.7 OR HITL escalation OR max steps
- **Invariant:** Every action SHALL have an associated verification strategy before execution

#### Mode C: Computer-Use Fallback

**REQ-MODE-003**: When `execution_mode === "computer_use"`, the system SHALL use screenshot-assisted interaction.

- **Cost:** ~$0.30 per step (vision model + screenshot)
- **Preconditions:** AX-tree node count < 10 OR explicit visual grounding required
- **Step limit:** ≤ 10 (enforced by graph router), resolution capped at XGA (1024x768)
- **Invariant:** Mode C SHALL NOT be used for tasks solvable by Mode A or B

**REQ-MODE-004**: `browser_click_coords` SHALL only be available in Mode C. Modes A and B SHALL use `browser_click` (ref-based) exclusively.

### 3.2 Mode Selection Logic

**REQ-CLASSIFY-001**:

```typescript
function classifyTask(domain: string, task: string, axNodeCount: number): ExecutionMode {
  if (workflowRecipeExists(domain, task) && recipe.successRate > 0.9) return "deterministic";
  if (requiresVisualGrounding(task) || axNodeCount < 10) return "computer_use";
  return "guided_agent";
}
```

---

## Section 4 — Graph Topology

### 4.1 Full Production Graph (10 Nodes)

**REQ-GRAPH-001**:

```
┌─────────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐    ┌──────────┐
│  START   │───→│ classify │───→│  load   │───→│  open   │───→│ perceive │
│          │    │  _task   │    │ _memory │    │_session │    │          │
└──────────┘    └──────────┘    └─────────┘    └─────────┘    └────┬─────┘
                                                                    │
                                                                    ▼
┌──────────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  output  │◄───│   hitl   │◄───│ reflect │◄───│  verify │◄───│  reason │
│          │    │          │    │         │    │         │    │         │
└──────────┘    └─────▲────┘    └────▲────┘    └────┬────┘    └────┬────┘
                      │              │              │              │
                      │         ┌────┘         ┌────┘              │
                      │         │              │                   ▼
                      └─────────┤              │         ┌──────────────┐
                                │              └────────→│  safety_gate │
                                │                        │              │
                                └────────────────────────│      act     │
                                                         └──────────────┘
```

**Nodes:** `classify_task` → `load_memory` → `open_session` → `perceive` → `reason` → `safety_gate` → `act` → `verify` → `reflect` → `hitl` → `output`

### 4.2 MVP Reduced Graph (5 Nodes)

**REQ-MVP-001**:

```
START → perceive → reason → act → verify → output
           ▲                          │
           └──────── (loop) ──────────┘
```

**REQ-MVP-002**: MVP defaults to `guided_agent` mode.

**REQ-MVP-003**: MVP omits: `classify_task`, `load_memory`, `safety_gate` (inline check in act), `reflect` (simple retry), `hitl` (fail on sensitive).

### 4.3 Node Specifications

#### Node: classify_task

**REQ-NODE-001**: Implements mode selection per Section 3.2.

| | |
|---|---|
| **Input** | `task`, `start_url`, `session_id` |
| **Output** | `execution_mode`, `workflow_recipe` (Mode A), `max_steps` (10 for Mode C) |
| **Side Effects** | Query episodic memory for workflow recipes |
| **Invariant** | `execution_mode` is one of three defined modes |

#### Node: perceive

**REQ-NODE-002**: Assembles Page State Model from AX-tree, filtered DOM, and optional screenshot.

| | |
|---|---|
| **Input** | `current_url` (after navigation or post-action) |
| **Output** | `page_snapshot`, `screenshot_b64` (if needed), `pending_mutations` |
| **Precondition** | Browser session open and navigable |
| **Postcondition** | `page_snapshot` has ≥1 interactive element OR `screenshot_b64` is non-null |

#### Node: reason

**REQ-NODE-003**: Invokes LLM with perception context and available MCP tools.

| | |
|---|---|
| **Input** | `page_snapshot`, `messages`, `task`, `sub_tasks`, `current_step`, `confidence_score` |
| **Output** | `messages` (appended), `expected_outcome`, `verify_strategy`, `confidence_score` (updated), `is_complete` |
| **Precondition** | `page_snapshot` is non-null |
| **Postcondition** | If tool_calls present, `expected_outcome` and `verify_strategy` are non-null |

#### Node: safety_gate (Full only)

**REQ-NODE-004**: Classifies pending action, enforces hard gates independent of LLM.

| | |
|---|---|
| **Input** | `messages` (with pending tool call), `current_url`, `domain_policy` |
| **Output** | `action_class`, `requires_human` (if sensitive), `hitl_reason` |
| **Postcondition** | `action_class` is one of: `safe`, `caution`, `sensitive`, `blocked` |
| **Invariant** | Denylist domain → `action_class = blocked` always |

#### Node: act

**REQ-NODE-005**: Executes tool calls via MCP with human-like behavior.

| | |
|---|---|
| **Input** | `messages` (with tool calls), `last_action_timestamp` |
| **Output** | `last_action`, `messages` (with results), `current_url`, `last_action_timestamp`, `pending_mutations` |
| **Precondition** | Safety check passed (inline for MVP, gate node for full) |
| **Invariant** | `current_time - last_action_timestamp >= min_action_interval_ms` |

#### Node: verify

**REQ-NODE-006**: Verifies expected outcome with mutation awareness.

| | |
|---|---|
| **Input** | `expected_outcome`, `verify_strategy`, `page_snapshot` (pre-action), `pending_mutations` |
| **Output** | `verify_result`, `retry_count`, `confidence_score` (adjusted) |
| **Precondition** | `verify_strategy` is non-null |
| **Mutation Awareness** | If `pending_mutations > 0`, wait `mutation_timeout_ms` then re-check |

#### Node: reflect (Full only)

**REQ-NODE-007**: Revises plan on structural verification failures.

| | |
|---|---|
| **Input** | `verify_result`, `messages`, `task`, `current_step` |
| **Output** | `sub_tasks` (revised), `messages` (with reflection), `retry_count` (reset) |
| **Precondition** | `verify_result.failure_type === "structural"` |

#### Node: hitl (Full only)

**REQ-NODE-008**: Pauses execution for human decision.

| | |
|---|---|
| **Input** | `requires_human === true`, `hitl_reason`, `screenshot_b64`, `current_url` |
| **Output** | `human_response`, `requires_human = false`, `messages` (with human decision) |
| **Side Effects** | `interrupt()` call, Postgres checkpoint |
| **Invariant** | State fully serializable at interrupt point |

### 4.4 Conditional Edge Specifications

**REQ-EDGE-001**: `routeAfterReason`:
```typescript
function routeAfterReason(state: AgentState): "act" | "hitl" | "output" {
  if (state.current_step >= state.max_steps) return "output";
  if (state.confidence_score < 0.3) return "hitl";
  if (state.requires_human) return "hitl";
  if (state.is_complete) return "output";
  if (state.messages.at(-1)?.tool_calls?.length > 0) return "act";
  return "output";
}
```

**REQ-EDGE-002**: `routeAfterSafety`:
```typescript
function routeAfterSafety(state: AgentState): "proceed" | "approve" | "block" {
  if (state.action_class === "blocked") return "block";
  if (state.action_class === "sensitive") return "approve";
  return "proceed";
}
```

**REQ-EDGE-003**: `routeAfterVerify`:
```typescript
function routeAfterVerify(state: AgentState): "success" | "retry" | "replan" | "escalate" {
  const v = state.verify_result;
  if (!v || v.success) return "success";
  if (v.failure_type === "transient" && state.retry_count < state.max_retries) return "retry";
  if (v.failure_type === "structural") return "replan";
  return "escalate";
}
```

---

## Section 5 — State Specification

### 5.1 AgentState Schema

**REQ-STATE-001**:

```typescript
export const AgentState = Annotation.Root({
  // Core messaging
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer }),

  // Task definition
  task: Annotation<string>(),
  task_complexity: Annotation<"simple" | "moderate" | "complex">(),
  sub_tasks: Annotation<string[]>(),

  // Execution control
  current_step: Annotation<number>(),
  max_steps: Annotation<number>({ default: 50 }),
  execution_mode: Annotation<"deterministic" | "guided_agent" | "computer_use">(),

  // Confidence scoring (from v3.0, FIXED in v3.1)
  confidence_score: Annotation<number>(),        // 0.0 - 1.0
  confidence_threshold: Annotation<number>({ default: 0.7 }),
  uncertainty_reasons: Annotation<string[]>(),

  // Workflow reference
  workflow_recipe: Annotation<WorkflowRecipe | null>(),

  // Page state
  current_url: Annotation<string>(),
  page_title: Annotation<string>(),
  page_snapshot: Annotation<PageStateModel | null>(),
  screenshot_b64: Annotation<string | null>(),

  // Mutation monitoring (from v3.0)
  pending_mutations: Annotation<number>({ default: 0 }),
  mutation_timeout_ms: Annotation<number>({ default: 2000 }),

  // Action tracking
  last_action: Annotation<ActionRecord | null>(),
  expected_outcome: Annotation<string | null>(),
  verify_strategy: Annotation<VerifyStrategy | null>(),
  verify_result: Annotation<VerifyResult | null>(),

  // Retry control
  retry_count: Annotation<number>(),
  max_retries: Annotation<number>({ default: 3 }),

  // Data extraction (v3.1 fix: merge-aware reducer for multi-scroll pages)
  extracted_data: Annotation<Record<string, any>[]>({
    reducer: (existing, incoming) => {
      // If incoming item shares a merge_key with existing item, deep merge them.
      // Otherwise append. Prevents duplicate entries from multi-scroll extraction.
      const merged = [...existing];
      for (const item of incoming) {
        const key = item._merge_key;  // e.g. URL or product_id
        const idx = key ? merged.findIndex(e => e._merge_key === key) : -1;
        if (idx >= 0) {
          merged[idx] = { ...merged[idx], ...item };  // deep merge
        } else {
          merged.push(item);
        }
      }
      return merged;
    }
  }),

  // Human-in-the-loop
  requires_human: Annotation<boolean>(),
  human_response: Annotation<string | null>(),
  hitl_reason: Annotation<string | null>(),

  // Safety
  action_class: Annotation<"safe" | "caution" | "sensitive" | "blocked" | null>(),
  domain_policy: Annotation<DomainPolicy | null>(),

  // Rate limiting (from v3.0)
  last_action_timestamp: Annotation<number>(),
  min_action_interval_ms: Annotation<number>({ default: 2000 }),

  // Completion
  is_complete: Annotation<boolean>(),
  completion_reason: Annotation<"success" | "failure" | "max_steps" | "hitl" | "blocked" | null>(),

  // Session
  session_id: Annotation<string>(),
  start_url: Annotation<string>(),
  budget_remaining_usd: Annotation<number>(),
});
```

### 5.2 State Invariants

**REQ-STATE-INV-001**: `current_step` SHALL NEVER exceed `max_steps`.

**REQ-STATE-INV-002**: `confidence_score` SHALL be between 0.0 and 1.0 inclusive.

**REQ-STATE-INV-003**: If `is_complete === true`, then `completion_reason` SHALL NOT be null.

**REQ-STATE-INV-004**: If `execution_mode === "computer_use"`, then `current_step` SHALL NOT exceed 10.

**REQ-STATE-INV-005** *(new)*: `budget_remaining_usd` SHALL NEVER be negative. If budget exhausted, `is_complete = true`, `completion_reason = "failure"`.

---

## Section 6 — MCP-Native Tool Interface (from v3.0, expanded)

### 6.1 MCP Integration Strategy

**REQ-MCP-001**: All browser capabilities SHALL be exposed through MCP servers.

**REQ-MCP-002**: The system SHALL support both MCP Client Mode (connecting to external servers) and MCP Server Mode (exposing agent capabilities).

### 6.2 Tool Manifest (23 tools — complete v2.0 parity + MCP)

| # | Tool Name | Category | Description | Safety Class | Origin |
|---|-----------|----------|-------------|--------------|--------|
| | **Navigation (4)** | | | | |
| 1 | `browser_navigate` | Navigation | Navigate to absolute URL. First action on any task or domain change. | safe | v2.0 |
| 2 | `browser_go_back` | Navigation | Go back in browser history | safe | v2.0 |
| 3 | `browser_go_forward` | Navigation | Go forward in browser history | safe | v2.0 |
| 4 | `browser_reload` | Navigation | Hard reload when content appears stale or page is stuck | safe | v2.0 (restored) |
| | **Perception (3)** | | | | |
| 5 | `browser_get_state` | Perception | Returns Page State Model (AX-tree + filtered DOM). Always call first on a new page. | safe | v2.0 |
| 6 | `browser_screenshot` | Perception | Compressed JPEG screenshot (quality configurable, max 1280px) | safe | v2.0 |
| 7 | `browser_get_metadata` | Perception | Return title, canonical URL, meta description, og tags, schema.org data | safe | v2.0 (restored) |
| | **Interaction (8)** | | | | |
| 8 | `browser_click` | Interaction | Click element by AX-tree ref. Uses ghost-cursor Bezier path. | caution | v2.0 |
| 9 | `browser_click_coords` | Interaction | Click at (x,y) coordinates — **Mode C only**, bypasses semantic layer | caution | v2.0 |
| 10 | `browser_type` | Interaction | Type text character-by-character with Gaussian delays and typo simulation | caution | v2.0 |
| 11 | `browser_scroll` | Interaction | Human-like variable-momentum scroll (up/down/to element). Triggers lazy-load. | safe | v2.0 |
| 12 | `browser_select` | Interaction | Select from `<select>` dropdown by value, label, or index | caution | v3.1 new |
| 13 | `browser_hover` | Interaction | Hover to reveal menus, tooltips, dropdowns | safe | v3.1 new |
| 14 | `browser_press_key` | Interaction | Press keyboard key or shortcut (Enter, Esc, Tab, Ctrl+A, etc.) | caution | v3.1 new |
| 15 | `browser_upload` | Interaction | Upload file to file input element | sensitive | v3.1 new |
| | **Tab Management (1)** | | | | |
| 16 | `browser_tab_manage` | Tab Mgmt | Open new tab, switch tab, close tab | caution | v2.0 |
| | **Data (2)** | | | | |
| 17 | `browser_extract` | Data | Extract structured data per schema (with confidence + missing fields + merge support) | safe | v2.0 + v3.1 fix |
| 18 | `browser_download` | Data | Download file from URL or link — **requires explicit user approval** | sensitive | v2.0 (restored) |
| | **Discovery (2)** | | | | |
| 19 | `browser_find_by_text` | Discovery | Locate element by visible text (fuzzy match). Returns first match ref. | safe | v2.0 (restored) |
| 20 | `browser_get_network` | Discovery | Return recent XHR/fetch requests. Detect form submission success or API failures. | safe | v2.0 (restored) |
| | **Control (2)** | | | | |
| 21 | `browser_wait_for` | Control | Wait for condition (selector appears, URL change, network idle) | safe | v2.0 |
| 22 | `agent_complete` | Control | Signal task completion with summary | safe | v3.0 |
| | **HITL (1)** | | | | |
| 23 | `agent_request_human` | HITL | LLM-triggered interrupt() — proactively request human input mid-task | caution | v2.0 (restored) |
| | **Restricted (1)** | | | | |
| 24 | `browser_evaluate` | **RESTRICTED** | Execute sandboxed JS (see 6.3) | blocked/caution | v2.0 |

#### Deferred Tools (not in v3.1, may add later)

| Tool | Reason for Deferral |
|------|-------------------|
| `memory_save` / `memory_recall` | Memory handled internally by `load_memory` node. LLM doesn't need explicit memory tools for MVP. Revisit if agent needs mid-session "remember this" capability. |
| `browser_set_cookie` | Security risk too high. Auth/session cookies should be injected via HITL or pre-configured browser profiles, not LLM-controlled tool calls. |
| `browser_drag_drop` | Rare interaction pattern. Can be approximated with `click_coords` + mouse events if needed. Add when a real workflow requires it. |
| `browser_record_workflow` | Record actions as Mode A workflow recipe. Deferred until Phase 6 (Memory & Replay). |

### 6.3 JS Sandbox Specification (new in v3.1)

**REQ-MCP-SANDBOX-001**: `browser_evaluate` SHALL run in isolated execution context.

**REQ-MCP-SANDBOX-002**: The sandbox SHALL NOT have access to:
- `document.cookie`
- `localStorage` / `sessionStorage`
- `fetch` / `XMLHttpRequest` (no network)
- `window.open` / `window.location` (no navigation)

**REQ-MCP-SANDBOX-003**: `browser_evaluate` SHALL be `blocked` on untrusted domains, `caution` on trusted domains with audit logging.

### 6.4 MCP Server Interface

```typescript
export interface BrowserMCPServer {
  // Navigation (4)
  browser_navigate(params: { url: string }): Promise<{ success: boolean; finalUrl: string }>;
  browser_go_back(): Promise<{ success: boolean; url: string }>;
  browser_go_forward(): Promise<{ success: boolean; url: string }>;
  browser_reload(params: { waitUntil?: "load" | "domcontentloaded" | "networkidle" }): Promise<{ success: boolean }>;

  // Perception (3)
  browser_get_state(params: { includeScreenshot?: boolean }): Promise<PageStateModel>;
  browser_screenshot(params: { quality?: number }): Promise<{ imageBase64: string }>;
  browser_get_metadata(): Promise<{
    title: string;
    canonicalUrl: string;
    metaDescription: string;
    ogTags: Record<string, string>;       // Open Graph tags
    schemaOrg: Record<string, any>[];     // schema.org JSON-LD
    lang: string;
  }>;

  // Interaction (8)
  browser_click(params: { elementRef: string }): Promise<{ success: boolean }>;
  browser_click_coords(params: { x: number; y: number }): Promise<{ success: boolean }>;
  browser_type(params: { elementRef: string; text: string; clearFirst?: boolean }): Promise<{ success: boolean }>;
  browser_scroll(params: { direction: "up" | "down"; elementRef?: string; amount?: number }): Promise<{ success: boolean }>;
  browser_select(params: { elementRef: string; value: string }): Promise<{ success: boolean }>;
  browser_hover(params: { elementRef: string }): Promise<{ success: boolean }>;
  browser_press_key(params: { key: string; modifiers?: string[] }): Promise<{ success: boolean }>;
  browser_upload(params: { elementRef: string; filePath: string }): Promise<{ success: boolean }>;

  // Tab Management (1)
  browser_tab_manage(params: {
    action: "new" | "switch" | "close";
    tabId?: string;
    url?: string;
  }): Promise<{ success: boolean; tabId: string; tabCount: number }>;

  // Data (2)
  browser_extract(params: {
    schema: object;
    selectors?: Record<string, string>;
    strategy?: "dom" | "llm_vision" | "auto";
    merge_key?: string;
  }): Promise<{
    data: any[];
    confidence: number;
    missing_fields: string[];
    source: "dom" | "llm_vision";
  }>;
  browser_download(params: {
    url?: string;              // direct URL to download
    elementRef?: string;       // or click a download link/button
    savePath?: string;         // optional save location
  }): Promise<{
    success: boolean;
    filePath: string;          // where file was saved
    fileName: string;
    fileSize: number;          // bytes
    mimeType: string;
  }>;

  // Discovery (2)
  browser_find_by_text(params: {
    text: string;              // visible text to search for
    exact?: boolean;           // exact match vs fuzzy (default: false)
    elementType?: string;      // optional filter: "button", "link", "input", etc.
  }): Promise<{
    found: boolean;
    elementRef: string | null; // AX-tree ref if found
    selector: string | null;   // CSS selector if found
    matchedText: string;       // actual text that matched
  }>;
  browser_get_network(params: {
    urlPattern?: string;       // filter by URL pattern (regex)
    method?: string;           // filter by HTTP method (GET, POST, etc.)
    statusCode?: number;       // filter by status code
    limit?: number;            // max results (default: 20)
  }): Promise<{
    requests: Array<{
      url: string;
      method: string;
      statusCode: number;
      contentType: string;
      responseSize: number;
      timestamp: number;
    }>;
  }>;

  // Control (2)
  browser_wait_for(params: { condition: string; timeout?: number }): Promise<{ success: boolean }>;
  agent_complete(params: { success: boolean; summary: string }): Promise<{ recorded: boolean }>;

  // HITL (1)
  agent_request_human(params: {
    reason: string;            // why human input is needed
    question?: string;         // specific question to ask
    options?: string[];        // optional choices to present
    includeScreenshot?: boolean; // attach current screenshot (default: true)
  }): Promise<{
    response: string;          // human's response
    selectedOption?: string;   // if options were provided
  }>;

  // Restricted (1)
  browser_evaluate(params: { script: string }): Promise<{ result: any }>;
}
```

---

## Section 7 — Perception Layer (from v2.0 + v3.0 mutations)

### 7.1 Page State Model

**REQ-PERCEPT-001**:

```typescript
interface PageStateModel {
  metadata: {
    url: string;
    title: string;
    timestamp: number;
    viewport: { width: number; height: number };
  };
  accessibilityTree: {
    nodes: AXNode[];
    nodeCount: number;
    interactiveCount: number;
  };
  filteredDOM: {
    elements: FilteredElement[];
    totalElements: number;
    filteredElements: number;
  };
  interactiveGraph: {
    controls: InteractiveControl[];
    controlCount: number;
    topControls: InteractiveControl[];  // top N by relevance score
  };
  visual?: {
    screenshotBase64: string;
    screenshotWidth: number;
    screenshotHeight: number;
  };
  diagnostics: {
    consoleErrors: string[];
    failedRequests: string[];
    pendingMutations: number;
  };
}
```

### 7.2 Dual-Stage Filtering (from v2.0)

**REQ-PERCEPT-002**: Hard Filter (Pass 1) — Remove invisible, disabled, aria-hidden, zero-dimension elements.

**REQ-PERCEPT-003**: Soft Filter (Pass 2) — Score remaining elements by semantic relevance to current task. Return top N (default 30).

**REQ-PERCEPT-004**: If filtered node count < 10, trigger screenshot fallback and consider Mode C routing.

### 7.3 Mutation Monitoring (from v3.0)

**REQ-PERCEPT-005**: The system SHALL inject a MutationObserver to track DOM mutations between action and verification.

**REQ-PERCEPT-006**: The verify node SHALL wait for DOM stability (`pending_mutations === 0` OR `mutation_timeout_ms` elapsed) before state comparison.

---

## Section 8 — Verification & Reflection Layer

### 8.1 Verification Strategies

**REQ-VERIFY-001**: The system SHALL support 9 verification strategies:

```typescript
type VerifyStrategy =
  | { type: "url_change"; expected_pattern: string }
  | { type: "element_appears"; selector: string }
  | { type: "element_text"; selector: string; contains: string }
  | { type: "network_request"; url_pattern: string }
  | { type: "no_error_banner"; error_selectors: string[] }
  | { type: "snapshot_diff"; min_node_change: number }
  | { type: "custom_js"; script: string; expected_result: any }
  // v3.1 fix: anti-bot detection strategies
  | { type: "no_captcha"; captcha_selectors: string[] }
  | { type: "no_bot_block"; block_indicators: string[] };
```

**REQ-VERIFY-001-A** *(new)*: The `no_captcha` strategy SHALL check for common CAPTCHA patterns:
- reCAPTCHA iframe (`iframe[src*="recaptcha"]`)
- hCaptcha iframe (`iframe[src*="hcaptcha"]`)
- Amazon CAPTCHA page (`form[action*="validateCaptcha"]`)
- Cloudflare challenge (`div#challenge-running`)
- Generic CAPTCHA keywords in page title/body

**REQ-VERIFY-001-B** *(new)*: The `no_bot_block` strategy SHALL check for bot-detection pages:
- "Automated access" / "unusual traffic" text in page body
- Empty/minimal product listings when results are expected
- Redirect to verification page (URL contains "verify", "challenge", "sorry")
- HTTP 429 (Too Many Requests) response status

### 8.2 Failure Taxonomy

**REQ-VERIFY-002**: Every verification failure SHALL be classified:

| Type | Examples | Response |
|------|----------|----------|
| **transient** | Timeout, network blip, loading spinner | Retry (up to `max_retries`) |
| **structural** | Selector not found, page layout changed | Replan via reflect node |
| **blocked** | CAPTCHA, rate limit banner, login wall | HITL escalation |
| **bot_detected** | CAPTCHA challenge, "automated access" page, empty results on known-good query, HTTP 429 | Pause 30s → rotate fingerprint → retry once → HITL if persists |
| **extraction_partial** | `browser_extract` returns `missing_fields.length > 0` | Scroll + re-extract → merge → accept if confidence > 0.7 |
| **confidence** | Confidence < 0.3 | HITL escalation |
| **unknown** | Undetermined failure cause | HITL escalation |

### 8.3 Action Contracts (from v2.0)

**REQ-VERIFY-003**: Every tool call SHALL include:

```typescript
interface ActionContract {
  tool_name: string;
  parameters: Record<string, any>;
  expected_outcome: string;         // natural language
  verify_strategy: VerifyStrategy;  // how to check
  failure_budget: number;           // max retries for this action
}
```

---

## Section 9 — Confidence Scoring (from v3.0, FIXED)

### 9.1 Multiplicative Confidence (v3.1 fix)

**REQ-CONF-001**: Confidence SHALL use multiplicative decay, not additive:

```typescript
function updateConfidence(current: number, event: ConfidenceEvent): number {
  switch (event) {
    case "step":              return current * 0.97;     // natural decay per step
    case "verify_success":    return Math.min(1.0, current * 1.08);  // +8% for success
    case "verify_failure":    return current * 0.80;     // -20% for failure
    case "retry":             return current * 0.90;     // -10% per retry
    case "recipe_match":      return Math.min(1.0, current * 1.15);  // +15% if recipe exists
    // v3.1 fix: extraction-aware confidence
    case "extract_complete":  return Math.min(1.0, current * 1.05);  // +5% for full extraction
    case "extract_partial":   return current * 0.92;     // -8% for partial (missing fields)
    case "bot_detected":      return current * 0.60;     // -40% for bot detection (severe)
  }
}
```

**Rationale:** Additive decay (`-0.05 per step`) goes negative on long tasks. Multiplicative naturally bounds confidence in (0, 1) without clamping.

### 9.2 Confidence Thresholds

**REQ-CONF-002**:
- **≥ 0.7**: Allow task completion claim
- **0.3–0.7**: Continue with increased monitoring
- **< 0.3**: Force HITL escalation

---

## Section 10 — Safety Layer (from v2.0 + v3.0)

### 10.1 Action Classification

**REQ-SAFETY-001**: Classification is deterministic, not LLM-discretionary:

| Class | Examples | Gate Behavior |
|-------|----------|---------------|
| **safe** | navigate, go_back, go_forward, reload, get_state, screenshot, get_metadata, scroll, hover, find_by_text, get_network, wait_for | Proceed, log only |
| **caution** | click, click_coords (Mode C), type, select, press_key, tab_manage, agent_request_human | Proceed, audit log |
| **sensitive** | form submit, send message, purchase, upload, download (requires explicit user approval) | HITL approval required |
| **blocked** | evaluate_js on untrusted domain, denylist domain | Block, alert, terminate |

### 10.2 Domain Policy (from v2.0)

**REQ-SAFETY-002**: Domain policies SHALL enforce:
- Denylist: known malicious/sensitive domains → blocked
- Allowlist: trusted internal domains → relaxed limits
- Default: all other domains → standard restrictions

**REQ-SAFETY-003**: All `caution` and `sensitive` actions SHALL be logged to `audit_log` table with timestamp, session_id, action, url, result.

### 10.3 Domain Circuit Breaker (new in v3.1)

**REQ-SAFETY-004**: If 3 consecutive sessions fail on domain X within 1 hour, the system SHALL:
1. Block automated retries for that domain for 1 hour
2. Log a circuit-breaker event
3. Require explicit user override to resume

---

## Section 11 — Rate Limiting & Politeness (from v3.0, corrected)

**REQ-RATE-001**: Rate limiting SHALL be first-class Layer 1 architecture, not an afterthought.

**REQ-RATE-002**: Default rate limits (corrected from v3.0):

| Scope | Limit | Rationale |
|-------|-------|-----------|
| **Global** | 30 actions/min | Prevents resource abuse |
| **Per-domain (unknown)** | 10 actions/min | Matches human browsing pace |
| **Per-domain (trusted)** | 30 actions/min | Higher for internal/known-safe domains |
| **Per-session** | 2s minimum interval | Human-realistic pacing |

**REQ-RATE-003**: The system SHALL respect `robots.txt`. If path disallowed, block Mode A/B and offer HITL escalation.

**REQ-RATE-004** *(new)*: The system SHALL check for `ai-agent.txt` as fallback if `robots.txt` is absent.

---

## Section 12 — Human-Like Behavior (from v2.0 — restored detail)

### 12.1 Mouse Movement

**REQ-HUMAN-001**: Mouse paths SHALL use Bezier curves via `ghost-cursor` library. No teleporting.

**REQ-HUMAN-002**: Mouse movement speed SHALL vary with Gaussian distribution (mean: 500ms, stddev: 150ms).

### 12.2 Typing Behavior

**REQ-HUMAN-003**: Typing SHALL use Gaussian inter-key delays (mean: 120ms, stddev: 40ms).

**REQ-HUMAN-004**: Typing SHALL simulate occasional typos (1-2% rate) with backspace correction.

### 12.3 Anti-Detection

**REQ-HUMAN-005**: Browser SHALL use `playwright-extra` with `stealth` plugin to mask automation signals.

**REQ-HUMAN-006**: Viewport, user-agent, and WebGL fingerprint SHALL rotate per session.

---

## Section 13 — Memory Architecture (from v2.0 — full detail restored)

### 13.1 Four Memory Types

| Type | Storage | Purpose | TTL |
|------|---------|---------|-----|
| **Working** | AgentState (Postgres checkpoint) | Current session state | Session |
| **Episodic** | `sessions` table | Session logs, action history | 90 days |
| **Semantic** | `domain_patterns` table + pgvector | Selector embeddings, element patterns | Indefinite |
| **Procedural** | `workflow_recipes` table | Mode A replay workflows | Until invalidated |

### 13.2 Storage Adapter Interface

```typescript
interface StorageAdapter {
  // Checkpointing
  saveCheckpoint(sessionId: string, state: AgentState): Promise<void>;
  loadCheckpoint(sessionId: string): Promise<AgentState | null>;

  // Semantic memory
  recordSuccess(domain: string, actionType: string, selector: string, embedding: number[]): Promise<void>;
  findSimilarPatterns(domain: string, actionType: string, embedding: number[], limit: number): Promise<DomainPattern[]>;

  // Procedural memory
  saveWorkflowRecipe(recipe: WorkflowRecipe): Promise<void>;
  getWorkflowRecipe(domain: string, taskEmbedding: number[]): Promise<WorkflowRecipe | null>;

  // Episodic
  recordSession(session: SessionRecord): Promise<void>;
  getRecentSessions(domain: string, limit: number): Promise<SessionRecord[]>;
}
```

### 13.3 PostgreSQL Schema (key tables)

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  task TEXT NOT NULL,
  start_url TEXT NOT NULL,
  status TEXT NOT NULL,
  steps INTEGER,
  confidence FLOAT,
  cost_usd FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE domain_patterns (
  id UUID PRIMARY KEY,
  domain TEXT NOT NULL,
  action_type TEXT NOT NULL,
  selector TEXT NOT NULL,
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  embedding vector(1536),
  last_validated TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workflow_recipes (
  id UUID PRIMARY KEY,
  domain TEXT NOT NULL,
  task_pattern TEXT NOT NULL,
  task_embedding vector(1536),
  steps JSONB NOT NULL,
  success_rate FLOAT DEFAULT 0.0,
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  action_class TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  url TEXT NOT NULL,
  parameters JSONB,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Section 14 — LLM Adapter Interface (from v2.0 + v3.0)

```typescript
export interface LLMAdapter {
  readonly provider: "anthropic" | "openai" | "gemini" | "local";
  readonly model: string;

  invoke(messages: BaseMessage[], tools: MCPToolDefinition[]): Promise<LLMResponse>;
  getCostEstimate(inputTokens: number, outputTokens: number): CostEstimate;
  getTokenCount(messages: BaseMessage[]): number;
}

interface CostEstimate {
  input_cost_usd: number;
  output_cost_usd: number;
  total_cost_usd: number;
}
```

---

## Section 15 — Streaming & Progress Events (new in v3.1)

**REQ-STREAM-001**: The orchestration layer SHALL emit real-time events for each state transition.

**REQ-STREAM-002**: Event types:

```typescript
type AgentEvent =
  | { type: "session_started"; sessionId: string; task: string }
  | { type: "node_entered"; node: string; step: number }
  | { type: "action_taken"; tool: string; target: string }
  | { type: "verification_result"; success: boolean; confidence: number }
  | { type: "confidence_update"; score: number; reasons: string[] }
  | { type: "hitl_required"; reason: string; screenshot?: string }
  | { type: "session_completed"; reason: string; confidence: number; steps: number; cost: number };
```

**REQ-STREAM-003**: Events SHALL be delivered via SSE or WebSocket (deferred decision DD-02).

---

## Section 16 — Evaluation & Observability (from v2.0 + v3.0 WAREX)

### 16.1 LangSmith Integration

**REQ-EVAL-001**: Every session SHALL be traced in LangSmith with full decision path.

### 16.2 Internal Benchmark Suite

**REQ-EVAL-002**: 10-task benchmark inspired by WebArena/WorkArena patterns:
- 3 information retrieval tasks
- 3 form filling tasks
- 2 multi-step navigation tasks
- 2 data extraction tasks

### 16.3 WAREX Stress Testing (from v3.0)

**REQ-EVAL-003**: The system SHALL be validated under injected failures:
- Random selector invalidation
- Network timeout injection
- CAPTCHA appearance simulation
- DOM mutation storms
- Rate limit banner injection

### 16.4 Scorecards

**REQ-EVAL-004**: Per-session metrics:
- Task success rate (binary)
- Step count
- Confidence at completion
- Cost (USD)
- Latency (seconds)
- Failure type distribution

### 16.5 Regression Detection

**REQ-EVAL-005**: Alert when success rate drops >10% vs 7-day rolling baseline.

---

## Section 17 — Known Failure Modes (from v2.0 — restored)

| # | Failure Mode | Mitigation |
|---|-------------|------------|
| F-01 | **Infinite loop** | Step counter + confidence decay → force exit |
| F-02 | **Hallucinated selectors** | Verify against actual AX-tree before use |
| F-03 | **Cost explosion** | Per-session budget cap (`budget_remaining_usd`) |
| F-04 | **CAPTCHA walls** | Detect via error banner → HITL escalation |
| F-05 | **SPA navigation** | MutationObserver + wait-for-stability |
| F-06 | **Stale workflow recipes** | 30-day validation TTL on selectors |
| F-07 | **Context window overflow** | Token counting + message pruning |
| F-08 | **Rate limiting by target site** | Respectful defaults + backoff |
| F-09 | **Login/auth walls** | Detect → HITL for credentials |
| F-10 | **Domain circuit break** | 3 consecutive failures → 1hr cooldown |
| F-11 | **CAPTCHA / bot detection** *(new)* | `no_captcha` + `no_bot_block` verify strategies → pause 30s, rotate fingerprint, retry once → HITL |
| F-12 | **Partial extraction on long pages** *(new)* | Multi-scroll extraction with merge reducer, accept if confidence > 0.7, flag `missing_fields` |

---

## Section 18 — Implementation Phases (5 MVP + 4 Post-MVP)

### 18.1 MVP Scope

**Target use cases:** CRO analysis, workflow funnel analysis, single/multi-page data extraction
**Out of scope (deferred):** SEO audit tooling, WCAG accessibility scoring, Mode C (computer-use)

### 18.2 MVP Success Criteria

| # | Criteria | Measurable Target |
|---|---------|-------------------|
| SC-1 | Single-page data extraction end-to-end | Amazon product detail extraction in < 60s |
| SC-2 | Multi-step workflow funnel task | 3+ page checkout flow analysis with screenshots |
| SC-3 | Every action verified | 100% of actions have verification result |
| SC-4 | Survive anti-bot detection | Detect CAPTCHA/block, escalate (not crash) |
| SC-5 | Cost per task | < $1 for a 20-step task on Mode B |
| SC-6 | Human-like behavior | Pass bot-detection on Amazon, LinkedIn |

### 18.3 Phase Overview

| Phase | Name | Weeks | Entry Gate | Exit Gate | MVP? |
|-------|------|-------|-----------|-----------|------|
| **1** | Perception Foundation | 1-2 | Project start | PageStateModel on 3+ sites, < 1500 tokens each | ✅ |
| **2** | MCP Tools + Human Behavior | 2-4 | Phase 1 green | All 23 tools MCP-compliant, stealth passing, ghost-cursor working | ✅ |
| **3** | Verification & Confidence | 4-5 | Phase 2 green | 9 strategies + mutation-aware verify + multiplicative confidence | ✅ |
| **4** | Safety & Infrastructure | 5-6 | Phase 3 green | Classification, audit log, circuit breaker, Postgres, LLM adapter, streaming | ✅ |
| **5** | Orchestration MVP | 6-8 | Phase 4 green | 5-node graph end-to-end on 3+ real tasks, all SC criteria met | ✅ **MVP** |
| **6** | Memory & Replay | 8-9 | Phase 5 green | PostgreSQL + pgvector, Mode A replay on known workflow | |
| **7** | Full Orchestration | 9-11 | Phase 6 green | 10-node graph with HITL pause/resume, reflect, mode routing | |
| **8** | Evaluation | 11-12 | Phase 7 green | WAREX stress testing, 80%+ internal benchmark, regression detection | |
| **9** | Computer-Use + Production | 12-14 | Phase 8 green | Mode C, Docker isolation, API surface, monitoring dashboard | |

### 18.4 Phase Artifact Details

#### Phase 1 — Perception Foundation (Week 1-2)

> *The agent's eyes — everything depends on this*

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 1.1 | Browser Manager | `browser-runtime/BrowserManager.ts` | Launch, navigate to `amazon.in`, close | No crash, page loads, clean shutdown |
| 1.2 | Stealth Config | `browser-runtime/StealthConfig.ts` | Navigate to `bot.sannysoft.com` | All stealth checks pass |
| 1.3 | AX-Tree Extractor | `perception/AccessibilityExtractor.ts` | Extract from `amazon.in` homepage | Returns >50 nodes, includes search box |
| 1.4 | Hard Filter | `perception/HardFilter.ts` | Filter `amazon.in` AX-tree | Removes invisible/disabled, count drops >50% |
| 1.5 | Soft Filter | `perception/SoftFilter.ts` | Filter with task "search for keyboard" | Search elements score higher than footer |
| 1.6 | Mutation Monitor | `perception/MutationMonitor.ts` | Click button on SPA page | `pending_mutations` > 0 after click, settles within 2s |
| 1.7 | Screenshot Extractor | `perception/ScreenshotExtractor.ts` | Screenshot `amazon.in` | JPEG < 150KB, ≤ 1280px wide |
| 1.8 | Context Assembler | `perception/ContextAssembler.ts` | Assemble full PageStateModel | All fields populated: metadata, AX-tree, filteredDOM, interactiveGraph, diagnostics |

**Exit Gate:**
- ✅ PageStateModel assembled for 3 sites (amazon.in, bbc.com, github.com)
- ✅ Filtered token count < 1500 tokens each
- ✅ Stealth checks pass on bot.sannysoft.com
- ✅ Mutation monitoring detects SPA changes

#### Phase 2 — MCP Tools + Human Behavior (Week 2-4)

> *The agent's hands — each tool must work in isolation before wiring*

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 2.1 | Mouse Behavior | `human-behavior/MouseBehavior.ts` | Move from (0,0) to (500,300) headful | Bezier curve visible, ~500ms |
| 2.2 | Typing Behavior | `human-behavior/TypingBehavior.ts` | Type "hello world" | Takes 3-6s, inter-key 80-160ms, 1-2% typos |
| 2.3 | Scroll Behavior | `human-behavior/ScrollBehavior.ts` | Scroll down 3 times | Variable momentum, not uniform |
| 2.4 | MCP Server Shell | `mcp/MCPServer.ts` | Start server, list tools | 23 tools listed with Zod schemas |
| 2.5 | `browser_navigate` | `mcp/tools/navigate.ts` | Navigate to `amazon.in` | `{ success: true, finalUrl }` |
| 2.6 | `browser_get_state` | `mcp/tools/getState.ts` | Get state of `amazon.in` | Full PageStateModel returned |
| 2.7 | `browser_click` | `mcp/tools/click.ts` | Click search box by AX ref | Focus received, ghost-cursor path |
| 2.8 | `browser_type` | `mcp/tools/type.ts` | Type "mechanical keyboard" | Text appears with human delays |
| 2.9 | `browser_press_key` | `mcp/tools/pressKey.ts` | Press Enter after typing | Search results page loads |
| 2.10 | `browser_scroll` | `mcp/tools/scroll.ts` | Scroll on results page | Lazy-load triggers |
| 2.11 | `browser_select` | `mcp/tools/select.ts` | Select sort option dropdown | Page re-sorts |
| 2.12 | `browser_hover` | `mcp/tools/hover.ts` | Hover product image | Zoom/preview appears |
| 2.13 | `browser_extract` | `mcp/tools/extract.ts` | Extract product details | `{ data, confidence: >0.8, missing_fields: [] }` |
| 2.14 | `browser_find_by_text` | `mcp/tools/findByText.ts` | Find "Add to Cart" | Returns element ref + selector |
| 2.15 | `browser_upload` | `mcp/tools/upload.ts` | Upload test file | File accepted |
| 2.16 | `browser_tab_manage` | `mcp/tools/tabManage.ts` | Open, switch, close tab | Correct tab count |
| 2.17 | `browser_download` | `mcp/tools/download.ts` | Download test PDF | Correct file saved |
| 2.18 | `browser_get_network` | `mcp/tools/getNetwork.ts` | Get XHR from Amazon | Requests with status codes |
| 2.19 | `browser_wait_for` | `mcp/tools/waitFor.ts` | Wait for results | Success when elements appear |
| 2.20 | `browser_get_metadata` | `mcp/tools/getMetadata.ts` | Get product metadata | Title, og tags, schema.org |
| 2.21 | `browser_evaluate` | `mcp/tools/evaluate.ts` | Get `document.title` | Returns title. Blocks `document.cookie` |
| 2.22 | `browser_go_back/forward` | `mcp/tools/navigation.ts` | Forward/back nav | Correct pages load |
| 2.23 | `browser_reload` | `mcp/tools/reload.ts` | Reload page | Clean refresh |
| 2.24 | `browser_screenshot` | `mcp/tools/screenshot.ts` | Screenshot product | JPEG < 150KB |
| 2.25 | `browser_click_coords` | `mcp/tools/clickCoords.ts` | Click (500, 300) | Element clicked |
| 2.26 | `agent_complete` | `mcp/tools/complete.ts` | Signal completion | Event emitted |
| 2.27 | `agent_request_human` | `mcp/tools/requestHuman.ts` | Request input | Interrupt thrown |
| 2.28 | JS Sandbox | `mcp/JSSandbox.ts` | Access `document.cookie` | Blocked, error returned |
| 2.29 | Rate Limiter | `rate-limit/RateLimiter.ts` | 5 actions in 1s | Only first executes, rest queued 2s apart |

**Exit Gate:**
- ✅ All 23 tools callable individually via MCP protocol
- ✅ Zod schemas validate all input/output
- ✅ ghost-cursor Bezier paths visible in headful browser
- ✅ Typing "hello world" takes 3-6s with natural variation
- ✅ JS sandbox blocks cookie/localStorage/fetch access
- ✅ Rate limiter enforces 2s minimum interval
- ✅ Amazon manual test: navigate → type → search → scroll → extract works tool-by-tool

#### Phase 3 — Verification & Confidence (Week 4-5)

> *The agent's judgment — our key differentiator*

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 3.1 | ActionContract type | `verification/ActionContract.ts` | Create contract for "click Search" | Has expected_outcome, verify_strategy, failure_budget |
| 3.2 | `url_change` strategy | `verification/strategies/urlChange.ts` | After navigate | URL matches pattern |
| 3.3 | `element_appears` strategy | `verification/strategies/elementAppears.ts` | After click search | Results container appears |
| 3.4 | `element_text` strategy | `verification/strategies/elementText.ts` | After typing | Input contains text |
| 3.5 | `network_request` strategy | `verification/strategies/networkRequest.ts` | After form submit | POST detected |
| 3.6 | `no_error_banner` strategy | `verification/strategies/noErrorBanner.ts` | Normal page | No errors detected |
| 3.7 | `snapshot_diff` strategy | `verification/strategies/snapshotDiff.ts` | After sorting | ≥5 elements changed |
| 3.8 | `custom_js` strategy | `verification/strategies/customJs.ts` | Title changed | Matches expected |
| 3.9 | `no_captcha` strategy | `verification/strategies/noCaptcha.ts` | Normal vs CAPTCHA | Detects reCAPTCHA, hCaptcha, Amazon, Cloudflare |
| 3.10 | `no_bot_block` strategy | `verification/strategies/noBotBlock.ts` | Normal vs block | Detects bot text, 429, empty results |
| 3.11 | Verify Node | `verification/VerifyNode.ts` | Action + verify with mutations | Waits for DOM stability, checks strategy |
| 3.12 | Failure Classifier | `verification/FailureClassifier.ts` | Classify 7 types | Correct routing per taxonomy |
| 3.13 | Confidence Scorer | `confidence/ConfidenceScorer.ts` | 50 steps mixed results | Score stays (0, 1) |
| 3.14 | Confidence threshold | `confidence/ConfidenceScorer.ts` | Score < 0.3 | Forces HITL escalation |
| 3.15 | Confidence ceiling | `confidence/ConfidenceScorer.ts` | 5 consecutive successes | Approaches but never exceeds 1.0 |

**Exit Gate:**
- ✅ All 9 verify strategies work in isolation
- ✅ Mutation-aware verify waits for DOM stability on SPA
- ✅ Failure taxonomy correctly routes all 7 types
- ✅ Confidence bounded (0, 1) over 50+ steps
- ✅ ActionContract enforced: no action without expected_outcome + verify_strategy

#### Phase 4 — Safety & Infrastructure (Week 5-6)

> *The agent's guardrails + foundational infrastructure*

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 4.1 | Action Classifier | `safety/ActionClassifier.ts` | Classify all 23 tools | Correct class per tool |
| 4.2 | Inline Safety Check | `safety/SafetyCheck.ts` | Submit `browser_download` | Returns `sensitive`, blocks |
| 4.3 | Domain Policy | `safety/DomainPolicy.ts` | Check banking domain | Returns `blocked` |
| 4.4 | Circuit Breaker | `safety/CircuitBreaker.ts` | 3 consecutive failures | Domain blocked 1 hour |
| 4.5 | Audit Logger | `safety/AuditLogger.ts` | Log caution action | Row in `audit_log` table |
| 4.6 | PostgreSQL Schema | `memory/schema.sql` | Run migrations | 4 tables created |
| 4.7 | Session Recorder | `memory/SessionRecorder.ts` | Record 5-step session | Session retrievable |
| 4.8 | Anthropic Adapter | `adapters/AnthropicAdapter.ts` | Send prompt, get tool calls | Correct format + cost estimate |
| 4.9 | OpenAI Adapter | `adapters/OpenAIAdapter.ts` | Same prompt | Same tool call format |
| 4.10 | Adapter Factory | `adapters/LLMAdapterFactory.ts` | Swap via config | No code changes needed |
| 4.11 | Stream Emitter | `streaming/StreamEmitter.ts` | Emit node_entered | Event received by subscriber |
| 4.12 | Event Types | `streaming/types.ts` | All 7 types defined | TypeScript compiles |

**Exit Gate:**
- ✅ All 23 tools correctly classified
- ✅ Sensitive actions block without human approval
- ✅ Circuit breaker triggers after 3 failures
- ✅ Audit log records to Postgres
- ✅ LLM adapter works with Anthropic and OpenAI
- ✅ Streaming events emitted and received
- ✅ PostgreSQL schema deployed

#### Phase 5 — Orchestration MVP (Week 6-8) — **MVP COMPLETE**

> *Wire everything into a working agent loop*

| # | Artifact | File Path | Smoke Test | Pass Criteria |
|---|----------|-----------|-----------|---------------|
| 5.1 | AgentState schema | `orchestration/AgentState.ts` | Compile, serialize | All fields, defaults, invariants |
| 5.2 | State validators | `orchestration/StateValidators.ts` | Violate each invariant | Errors thrown correctly |
| 5.3 | Perceive Node | `orchestration/nodes/PerceiveNode.ts` | URL → PageStateModel | Integrates BrowserManager + ContextAssembler |
| 5.4 | Reason Node | `orchestration/nodes/ReasonNode.ts` | Page state → tool calls | LLM produces ActionContract |
| 5.5 | Act Node | `orchestration/nodes/ActNode.ts` | Tool calls → execution | Inline safety, rate limiting, human behavior |
| 5.6 | Verify Node | `orchestration/nodes/VerifyNode.ts` | Verify result | Mutation-aware, updates confidence |
| 5.7 | Output Node | `orchestration/nodes/OutputNode.ts` | Final result | Session recorded, events emitted |
| 5.8 | Graph Builder | `orchestration/Graph.ts` | 5-node graph | Compiles, all edges connected |
| 5.9 | routeAfterVerify | `orchestration/edges.ts` | Success/retry/output | Correct routing all cases |
| 5.10 | routeAfterReason | `orchestration/edges.ts` | Complete/act/output | Correct routing |
| 5.11 | System Prompt | `orchestration/SystemPrompt.ts` | Renders with context | Tools, task, constraints, safety |
| 5.12 | **Integration: BBC** | `tests/integration/bbc.test.ts` | Extract top 3 headlines | Returns 3 headlines < 30s |
| 5.13 | **Integration: Amazon** | `tests/integration/amazon.test.ts` | Search keyboard, get details | Product name, price, rating < 90s |
| 5.14 | **Integration: Workflow** | `tests/integration/workflow.test.ts` | 3-page form flow | Screenshots + data per step |
| 5.15 | **Integration: Recovery** | `tests/integration/recovery.test.ts` | Navigate to 404 | Recognizes error, reports failure |
| 5.16 | **Integration: Budget** | `tests/integration/budget.test.ts` | $0.05 budget, complex task | Terminates cleanly on exhaustion |

**Exit Gate — MVP Complete:**
- ✅ BBC extraction: end-to-end < 30s, correct data
- ✅ Amazon search: end-to-end < 90s, handles CAPTCHA gracefully
- ✅ Multi-page workflow: 3+ pages navigated with data per step
- ✅ 100% of actions have verification result
- ✅ Confidence prevents false success claims
- ✅ Sensitive actions blocked in integration tests
- ✅ Streaming events visible during runs
- ✅ Amazon task < $1.00 LLM cost
- ✅ Error recovery: 404/timeout handled without crash

### 18.5 Post-MVP Phase Details

#### Phase 6 — Memory & Replay (Week 8-9)

| Artifact | File Path | Smoke Test |
|----------|-----------|-----------|
| `StorageAdapter.ts` | `memory/StorageAdapter.ts` | Checkpoint save/load works |
| `SemanticMemory.ts` + pgvector | `memory/SemanticMemory.ts` | Similar selector found by embedding |
| `WorkflowRecorder.ts` | `memory/WorkflowRecorder.ts` | Successful session saved as recipe |
| `ModeARunner.ts` | `memory/ModeARunner.ts` | Recipe replayed without LLM |

#### Phase 7 — Full Orchestration (Week 9-11)

| Artifact | File Path | Smoke Test |
|----------|-----------|-----------|
| `Graph.ts` (10-node) | `orchestration/Graph.ts` | Full topology with all edges |
| `ClassifyTaskNode.ts` | `orchestration/nodes/ClassifyTaskNode.ts` | Known domain → Mode A |
| `LoadMemoryNode.ts` | `orchestration/nodes/LoadMemoryNode.ts` | Loads selectors + recipes |
| `SafetyGateNode.ts` | `orchestration/nodes/SafetyGateNode.ts` | Dedicated gate node |
| `ReflectNode.ts` | `orchestration/nodes/ReflectNode.ts` | Replans on structural failure |
| `HITLNode.ts` | `orchestration/nodes/HITLNode.ts` | interrupt() → inject response → continue |
| `PostgresCheckpointer` | `orchestration/PostgresCheckpointer.ts` | Kill process, resume from checkpoint |

#### Phase 8 — Evaluation (Week 11-12)

| Artifact | Smoke Test |
|----------|-----------|
| 10-task benchmark suite | Automated scoring on WebArena-inspired tasks |
| WAREX stress injection | Agent survives selector invalidation, timeouts, CAPTCHAs |
| Scorecard generator | Per-session metrics dashboard |
| LangSmith integration validation | Full decision trace visible per session |
| Regression detector | Alert on >10% success rate drop vs 7-day baseline |

#### Phase 9 — Computer-Use + Production (Week 12-14)

| Artifact | Smoke Test |
|----------|-----------|
| `ScreenshotInteractor.ts` | Vision model interaction on canvas site |
| `ComputerUseRouter.ts` | Step limit = 10, resolution cap enforced |
| Docker worker isolation | Container per run, clean teardown |
| HTTP API surface | Endpoints for session management |
| Monitoring dashboard | Real-time session status + step history |

### 18.6 Dependency Graph

```
Phase 1 (Perception)
    │
    └──→ Phase 2 (MCP Tools + Human Behavior)
              │
              └──→ Phase 3 (Verification + Confidence)
                        │
                        └──→ Phase 4 (Safety + Infrastructure)
                                  │
                                  └──→ Phase 5 (Orchestration MVP) ← MVP COMPLETE ─┐
                                                                                     │
                                            ┌────────────────────────────────────────┘
                                            │
                                            └──→ Phase 6 (Memory & Replay)
                                                      │
                                                      └──→ Phase 7 (Full Orchestration)
                                                                │
                                                                └──→ Phase 8 (Evaluation)
                                                                          │
                                                                          └──→ Phase 9 (Production)
```

### 18.7 Risk Register

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|-----------|------------|
| R-1 | LangGraph.js fewer examples than Python | Dev velocity slowdown | High | Budget extra time Phase 5, translate Python docs |
| R-2 | Amazon anti-bot blocks during testing | Can't validate core flow | Medium | Use bot.sannysoft.com first, test simpler sites |
| R-3 | AX-tree inconsistent across sites | Perception unreliable | Medium | Test 10+ diverse sites in Phase 1 |
| R-4 | ghost-cursor/playwright-extra compat | Human-like behavior breaks | Low | Pin versions, test together early Phase 2 |
| R-5 | Confidence formula doesn't match reality | False positives/negatives | Medium | Tune with Phase 5 integration tests |
| R-6 | MCP protocol overhead | Latency per action | Low | Benchmark Phase 2, consider hybrid if >100ms |
| R-7 | Scope creep into SEO/A11y | Delays MVP | Medium | Hard boundary: no analysis tools until post-MVP |

---

## Section 19 — Repository Structure

```
ai-browser-agent/
├── .spec/                              # Formal specifications
│   └── requirements.md
├── packages/
│   └── agent-core/
│       ├── src/
│       │   ├── orchestration/          # Phase 5 — LangGraph state, graph, edges
│       │   │   ├── AgentState.ts
│       │   │   ├── StateValidators.ts
│       │   │   ├── Graph.ts
│       │   │   ├── edges.ts
│       │   │   ├── SystemPrompt.ts
│       │   │   └── nodes/
│       │   │       ├── PerceiveNode.ts
│       │   │       ├── ReasonNode.ts
│       │   │       ├── ActNode.ts
│       │   │       ├── VerifyNode.ts
│       │   │       ├── OutputNode.ts
│       │   │       ├── ClassifyTaskNode.ts   # Phase 7
│       │   │       ├── LoadMemoryNode.ts     # Phase 7
│       │   │       ├── SafetyGateNode.ts     # Phase 7
│       │   │       ├── ReflectNode.ts        # Phase 7
│       │   │       └── HITLNode.ts           # Phase 7
│       │   ├── perception/                   # Phase 1
│       │   │   ├── AccessibilityExtractor.ts
│       │   │   ├── HardFilter.ts
│       │   │   ├── SoftFilter.ts
│       │   │   ├── MutationMonitor.ts
│       │   │   ├── ScreenshotExtractor.ts
│       │   │   └── ContextAssembler.ts
│       │   ├── browser-runtime/              # Phase 1
│       │   │   ├── BrowserManager.ts
│       │   │   └── StealthConfig.ts
│       │   ├── mcp/                          # Phase 2
│       │   │   ├── MCPServer.ts
│       │   │   ├── JSSandbox.ts
│       │   │   └── tools/
│       │   │       ├── navigate.ts
│       │   │       ├── getState.ts
│       │   │       ├── click.ts
│       │   │       ├── clickCoords.ts
│       │   │       ├── type.ts
│       │   │       ├── scroll.ts
│       │   │       ├── select.ts
│       │   │       ├── hover.ts
│       │   │       ├── pressKey.ts
│       │   │       ├── upload.ts
│       │   │       ├── tabManage.ts
│       │   │       ├── extract.ts
│       │   │       ├── download.ts
│       │   │       ├── findByText.ts
│       │   │       ├── getNetwork.ts
│       │   │       ├── waitFor.ts
│       │   │       ├── getMetadata.ts
│       │   │       ├── screenshot.ts
│       │   │       ├── evaluate.ts
│       │   │       ├── navigation.ts         # go_back, go_forward
│       │   │       ├── reload.ts
│       │   │       ├── complete.ts
│       │   │       └── requestHuman.ts
│       │   ├── human-behavior/               # Phase 2
│       │   │   ├── MouseBehavior.ts
│       │   │   ├── TypingBehavior.ts
│       │   │   └── ScrollBehavior.ts
│       │   ├── verification/                 # Phase 3
│       │   │   ├── ActionContract.ts
│       │   │   ├── VerifyNode.ts
│       │   │   ├── FailureClassifier.ts
│       │   │   └── strategies/
│       │   │       ├── urlChange.ts
│       │   │       ├── elementAppears.ts
│       │   │       ├── elementText.ts
│       │   │       ├── networkRequest.ts
│       │   │       ├── noErrorBanner.ts
│       │   │       ├── snapshotDiff.ts
│       │   │       ├── customJs.ts
│       │   │       ├── noCaptcha.ts
│       │   │       └── noBotBlock.ts
│       │   ├── confidence/                   # Phase 3
│       │   │   └── ConfidenceScorer.ts
│       │   ├── safety/                       # Phase 4
│       │   │   ├── ActionClassifier.ts
│       │   │   ├── SafetyCheck.ts
│       │   │   ├── DomainPolicy.ts
│       │   │   ├── CircuitBreaker.ts
│       │   │   └── AuditLogger.ts
│       │   ├── adapters/                     # Phase 4
│       │   │   ├── LLMAdapter.ts
│       │   │   ├── AnthropicAdapter.ts
│       │   │   ├── OpenAIAdapter.ts
│       │   │   └── LLMAdapterFactory.ts
│       │   ├── streaming/                    # Phase 4
│       │   │   ├── StreamEmitter.ts
│       │   │   └── types.ts
│       │   ├── rate-limit/                   # Phase 2
│       │   │   └── RateLimiter.ts
│       │   ├── memory/                       # Phase 4 (schema), Phase 6 (full)
│       │   │   ├── schema.sql
│       │   │   ├── SessionRecorder.ts
│       │   │   ├── StorageAdapter.ts         # Phase 6
│       │   │   ├── SemanticMemory.ts         # Phase 6
│       │   │   ├── WorkflowRecorder.ts       # Phase 6
│       │   │   └── ModeARunner.ts            # Phase 6
│       │   ├── computer-use/                 # Phase 9
│       │   │   ├── ScreenshotInteractor.ts
│       │   │   └── ComputerUseRouter.ts
│       │   └── evaluation/                   # Phase 8
│       │       ├── BenchmarkSuite.ts
│       │       ├── WAREXInjector.ts
│       │       ├── ScorecardGenerator.ts
│       │       └── RegressionDetector.ts
│       ├── tests/
│       │   ├── unit/                         # Per-phase unit tests
│       │   └── integration/                  # Phase 5
│       │       ├── bbc.test.ts
│       │       ├── amazon.test.ts
│       │       ├── workflow.test.ts
│       │       ├── recovery.test.ts
│       │       └── budget.test.ts
│       ├── package.json
│       └── tsconfig.json
├── apps/                                     # Phase 9
│   ├── api/                                  # HTTP API surface
│   ├── worker/                               # Docker browser worker
│   └── dashboard/                            # Monitoring UI
├── docker-compose.yml                        # PostgreSQL for dev
├── package.json                              # Monorepo root
├── turbo.json                                # Build config
└── .claude/
    └── HANDOVER.md
```

---

## Section 20 — Context Preservation (from v2.0 — restored)

### 20.1 Engineering Constitution

1. **Perception first, action second.** Never act without a fresh page snapshot.
2. **Verify everything.** No action is "done" until verification passes.
3. **Safety is structural.** The LLM cannot override the safety gate.
4. **Cheapest mode first.** Route to Mode A before B before C.
5. **Confidence is king.** Never claim success below threshold.
6. **Human is the fallback.** When in doubt, escalate.

### 20.2 Session Handover Prompt

```
Project: REO Digital AI Browser Agent (Neural) — Architecture v3.1
Methodology: Spec-Driven Development with GitHub Spec Kit
Current Phase: [UPDATE EACH SESSION]
Last Completed Phase: [UPDATE EACH SESSION]
Open Requirements: [UPDATE EACH SESSION]

MVP Scope: CRO analysis, workflow funnel analysis, single/multi-page data extraction
MVP Phases: 5 (perception → tools → verify → safety → orchestration) — ~8 weeks
Full Phases: 9 (+ memory, full graph, evaluation, production) — ~14 weeks

Architecture: 8-layer MCP-native system
- Layer 1: Request & Policy (rate limiting, circuit breaker)
- Layer 2: Orchestration (LangGraph.js, 5-node MVP / 10-node full)
- Layer 3: Perception (AX-tree + dual filter + mutation monitoring)
- Layer 4: Action (23 MCP tools + human-like behavior)
- Layer 5: Verification (9 strategies, mutation-aware, action contracts)
- Layer 6: Memory (4-type PostgreSQL + pgvector) — Post-MVP
- Layer 7: Safety (hard gates, audit log, circuit breaker)
- Layer 8: Evaluation (WAREX stress testing, LangSmith, benchmarks) — Post-MVP

Core Innovations:
- 3 execution modes ($0 / $0.10 / $0.30 per step)
- Confidence scoring with multiplicative decay
- Mutation-aware verification
- MCP-native tool interface (23 tools)
- Streaming progress events
- Domain circuit breaker

Key Invariants:
- Safety layer runs independently of LLM judgment
- Every action has a verification strategy before execution
- Confidence never goes negative (multiplicative)
- Budget exhaustion → immediate session termination

MVP Success Criteria:
- SC-1: Amazon product extraction end-to-end in < 60s
- SC-2: 3+ page workflow funnel analysis with screenshots
- SC-3: 100% of actions have verification result
- SC-4: CAPTCHA/bot-block detected and escalated (not crash)
- SC-5: < $1 per 20-step task
- SC-6: Pass bot-detection on Amazon, LinkedIn
```

---

### 20.3 Development Workflow

```
Per-Phase Process:
1. Read spec section for the phase
2. Create branch: phase-N/feature-name
3. Write types/interfaces first (TypeScript-first)
4. Write unit tests (TDD where possible)
5. Implement against the tests
6. Run smoke tests from Section 18
7. Run all existing tests (no regressions)
8. PR with spec traceability (link artifacts to REQ-IDs)
9. Phase exit gate review
10. Merge to main

Definition of Done (per artifact):
- [ ] TypeScript types/interfaces defined
- [ ] Zod schemas for runtime validation
- [ ] Unit tests pass
- [ ] Smoke test from plan passes
- [ ] No regressions in previous phases
- [ ] LangSmith trace working (Phase 4+)
```

---

**End of Architecture Plan v3.1 — Unified Specification**

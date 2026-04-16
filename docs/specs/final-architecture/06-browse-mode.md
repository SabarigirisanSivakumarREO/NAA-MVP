# Section 6 — Browse Mode (Browser Agent v3.1)

> **Source of truth:** `docs/specs/AI_Browser_Agent_Architecture_v3.1.md`
> This section is the COMPLETE specification for browse mode, inlined here for the unified architecture. Any discrepancy between this section and v3.1 should be resolved in favor of v3.1.

---

## 6.0 Browser Agent Reality Check (from v3.1 §0 — coverage gap fix)

### 6.0.1 Honesty Table

| Claim | Evidence |
|---|---|
| **Reliability ceiling is ~80-86%** | WebArena best: ~62%. WorkArena best: ~43%. Our target is realistic for *known* sites only. Arbitrary sites will be lower. |
| **Vision-only perception is fragile** | Anthropic Computer Use: ~22% on OSWorld. Screenshot flipbook loses DOM precision. |
| **Hybrid perception is mandatory** | AX-tree primary + screenshot fallback is the only approach that works across modern SPAs. |
| **No agent is production-reliable today** | Browser Use claims 89% on WebVoyager — a curated benchmark, not production traffic. |
| **Cost matters** | Vision-based agents cost $0.30+/step. Deterministic replay costs $0/step. Mode routing is the economic advantage. |

### 6.0.2 Core Architectural Thesis

> **The browser agent is not an LLM with browser tools. It is a deterministic state machine with LLM-assisted reasoning, formally verified actions, and standardized protocol interfaces.**

This thesis drives every design decision in §6: deterministic Mode A before LLM-guided Mode B, hard safety gates independent of LLM judgment, multiplicative confidence scoring that bounds behavior, and MCP-standardized tool interfaces. The LLM is a COMPONENT of the agent, not the agent itself.

### 6.0.3 What This Means for Implementation

- **Do NOT design a "chat with a browser" system.** The agent follows a state graph with formal pre/postconditions per node.
- **Do NOT assume LLM reliability improves linearly.** Budget for 15-20% failure rates on novel sites. Design recovery paths for every action.
- **DO invest in deterministic Mode A recipes.** Every recurring task that can be replayed without LLM is $0 and 100% reliable.
- **DO invest in perception quality (Phase 1).** Everything downstream depends on the PageStateModel being accurate.

---

## 6.1 8-Layer Architecture

**REQ-BROWSE-LAYER-001:** Browse mode is built as an 8-layer system. Each layer has one responsibility and communicates only with adjacent layers via typed interfaces.

| Layer | Name | Responsibility |
|-------|------|---------------|
| **1** | **Request & Policy** | Task intake, mode classification, budget assignment, domain policy, rate limiting, robots.txt, circuit breaker |
| **2** | **Orchestration** | LangGraph.js state graph, mode routing, confidence scoring, HITL pause/resume, Postgres checkpointing, streaming events |
| **3** | **Perception** | AX-tree primary, dual-stage filtering (hard + soft), mutation monitoring, screenshot fallback (<10 AX nodes) |
| **4** | **Action** | 23 MCP tools, human-like behavior (ghost-cursor, Gaussian typing), stealth |
| **5** | **Verification & Reflection** | Action contracts, 9 verify strategies, failure taxonomy, mutation observation, replan routing |
| **6** | **Memory & Replay** | Working (Postgres checkpoint), Episodic (session logs), Semantic (pgvector), Procedural (workflow recipes for Mode A) |
| **7** | **Safety & Approval** | Action classification (safe/caution/sensitive/blocked), hard gates, audit log, domain denylist |
| **8** | **Evaluation & Observability** | LangSmith tracing, WAREX stress testing, scorecards, regression detection, internal benchmarks |

---

## 6.2 Three Execution Modes

**REQ-BROWSE-MODE-001:** Browse mode supports 3 execution strategies that vary by perception method and cost.

### Mode A: Deterministic Workflow

| | |
|---|---|
| **Cost** | **$0 per step** |
| **Method** | Replay pre-recorded Playwright workflow |
| **LLM calls** | **Zero** |
| **Preconditions** | Workflow recipe exists with `success_rate > 0.9`, selectors validated within 30 days |
| **Postconditions** | Task completion OR automatic downgrade to Mode B on selector failure |
| **Use case** | Recurring tasks on known domains (e.g., daily Amazon product data extraction) |
| **Invariant** | Zero LLM tokens consumed |

### Mode B: Guided Agent

| | |
|---|---|
| **Cost** | **~$0.10 per step** |
| **Method** | LLM reads AX-tree → decides action → executes → verifies |
| **LLM calls** | 1 per step (perceive → reason → act → verify loop) |
| **Preconditions** | Page accessibility snapshot available, confidence initialized to 1.0 |
| **Postconditions** | Task completion with confidence > 0.7 OR HITL escalation OR max steps |
| **Use case** | Default mode for new tasks and unfamiliar websites |
| **Invariant** | Every action SHALL have an associated verification strategy before execution |

### Mode C: Computer-Use Fallback

| | |
|---|---|
| **Cost** | **~$0.30 per step** |
| **Method** | Vision model receives screenshot, outputs (x,y) click coordinates |
| **LLM calls** | 1 per step (vision-capable model) |
| **Preconditions** | AX-tree node count < 10 OR explicit visual grounding required |
| **Step limit** | ≤ 10 (enforced by graph router) |
| **Resolution cap** | XGA (1024x768) |
| **Use case** | Canvas-heavy pages, image-only sites, when AX-tree is empty |
| **Invariant** | Mode C SHALL NOT be used for tasks solvable by Mode A or B |

**REQ-BROWSE-MODE-002:** `browser_click_coords` SHALL only be available in Mode C. Modes A and B SHALL use `browser_click` (ref-based) exclusively.

### Mode Selection Logic

**REQ-BROWSE-CLASSIFY-001:**

```typescript
function classifyTask(domain: string, task: string, axNodeCount: number): ExecutionMode {
  // Mode A: deterministic replay if recipe exists
  if (workflowRecipeExists(domain, task) && recipe.successRate > 0.9) {
    return "deterministic";
  }
  // Mode C: vision fallback if page is canvas/image
  if (requiresVisualGrounding(task) || axNodeCount < 10) {
    return "computer_use";
  }
  // Mode B: default guided agent
  return "guided_agent";
}
```

---

## 6.3 Graph Topology (10 Nodes Full / 5 Nodes MVP)

### Full Production Graph (10 Nodes)

**REQ-BROWSE-GRAPH-001:**

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

**Nodes (10):** `classify_task` → `load_memory` → `open_session` → `perceive` → `reason` → `safety_gate` → `act` → `verify` → `reflect` → `hitl` → `output`

### MVP Reduced Graph (5 Nodes)

**REQ-BROWSE-GRAPH-002:**

```
START → perceive → reason → act → verify → output
           ▲                          │
           └──────── (loop) ──────────┘
```

**REQ-BROWSE-MVP-001:** MVP defaults to `guided_agent` mode.

**REQ-BROWSE-MVP-002:** MVP omits: `classify_task`, `load_memory`, `safety_gate` (inline check in act), `reflect` (simple retry), `hitl` (fail on sensitive).

---

## 6.4 Node Specifications

### Node: `classify_task`

**REQ-BROWSE-NODE-001:** Implements mode selection per Section 6.2.

| | |
|---|---|
| **Input** | `task`, `start_url`, `session_id` |
| **Output** | `execution_mode`, `workflow_recipe` (Mode A), `max_steps` (10 for Mode C) |
| **Side effects** | Query episodic memory for workflow recipes |
| **Invariant** | `execution_mode` is one of three defined modes |

### Node: `load_memory`

**REQ-BROWSE-NODE-002:**

| | |
|---|---|
| **Input** | `domain`, `task_type`, `session_id` |
| **Output** | `domain_policy`, known selectors, `workflow_recipe` |
| **Side effects** | Query semantic memory (pgvector) |

### Node: `open_session`

**REQ-BROWSE-NODE-003:**

| | |
|---|---|
| **Input** | `start_url`, browser config |
| **Output** | Browser session, `current_url` |
| **Side effects** | Launches Playwright with stealth, applies fingerprint |

### Node: `perceive`

**REQ-BROWSE-NODE-004:** Assembles Page State Model from AX-tree, filtered DOM, and optional screenshot.

| | |
|---|---|
| **Input** | `current_url` (after navigation or post-action) |
| **Output** | `page_snapshot`, `screenshot_b64` (if needed), `pending_mutations` |
| **Precondition** | Browser session open and navigable |
| **Postcondition** | `page_snapshot` has ≥1 interactive element OR `screenshot_b64` is non-null |

### Node: `reason`

**REQ-BROWSE-NODE-005:** Invokes LLM with perception context and available MCP tools.

| | |
|---|---|
| **Input** | `page_snapshot`, `messages`, `task`, `sub_tasks`, `current_step`, `confidence_score` |
| **Output** | `messages` (appended), `expected_outcome`, `verify_strategy`, `confidence_score` (updated), `is_complete` |
| **Precondition** | `page_snapshot` is non-null |
| **Postcondition** | If tool_calls present, `expected_outcome` and `verify_strategy` are non-null |

### Node: `safety_gate` (Full graph only)

**REQ-BROWSE-NODE-006:** Classifies pending action, enforces hard gates independent of LLM.

| | |
|---|---|
| **Input** | `messages` (with pending tool call), `current_url`, `domain_policy` |
| **Output** | `action_class`, `requires_human` (if sensitive), `hitl_reason` |
| **Postcondition** | `action_class` is one of: `safe`, `caution`, `sensitive`, `blocked` |
| **Invariant** | Denylist domain → `action_class = blocked` always |

### Node: `act`

**REQ-BROWSE-NODE-007:** Executes tool calls via MCP with human-like behavior.

| | |
|---|---|
| **Input** | `messages` (with tool calls), `last_action_timestamp` |
| **Output** | `last_action`, `messages` (with results), `current_url`, `last_action_timestamp`, `pending_mutations` |
| **Precondition** | Safety check passed (inline for MVP, gate node for full) |
| **Invariant** | `current_time - last_action_timestamp >= min_action_interval_ms` |

### Node: `verify`

**REQ-BROWSE-NODE-008:** Verifies expected outcome with mutation awareness.

| | |
|---|---|
| **Input** | `expected_outcome`, `verify_strategy`, `page_snapshot` (pre-action), `pending_mutations` |
| **Output** | `verify_result`, `retry_count`, `confidence_score` (adjusted) |
| **Precondition** | `verify_strategy` is non-null |
| **Mutation awareness** | If `pending_mutations > 0`, wait `mutation_timeout_ms` then re-check |

### Node: `reflect` (Full graph only)

**REQ-BROWSE-NODE-009:** Revises plan on structural verification failures.

| | |
|---|---|
| **Input** | `verify_result`, `messages`, `task`, `current_step` |
| **Output** | `sub_tasks` (revised), `messages` (with reflection), `retry_count` (reset) |
| **Precondition** | `verify_result.failure_type === "structural"` |

### Node: `hitl` (Full graph only)

**REQ-BROWSE-NODE-010:** Pauses execution for human decision.

| | |
|---|---|
| **Input** | `requires_human === true`, `hitl_reason`, `screenshot_b64`, `current_url` |
| **Output** | `human_response`, `requires_human = false`, `messages` (with human decision) |
| **Side effects** | `interrupt()` call, Postgres checkpoint |
| **Invariant** | State fully serializable at interrupt point |

---

## 6.5 Conditional Edge Functions

**REQ-BROWSE-EDGE-001:** `routeAfterReason`:

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

**REQ-BROWSE-EDGE-002:** `routeAfterSafety`:

```typescript
function routeAfterSafety(state: AgentState): "proceed" | "approve" | "block" {
  if (state.action_class === "blocked") return "block";
  if (state.action_class === "sensitive") return "approve";
  return "proceed";
}
```

**REQ-BROWSE-EDGE-003:** `routeAfterVerify`:

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

## 6.6 Perception Layer

### PageStateModel

**REQ-BROWSE-PERCEPT-001:**

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
    topControls: InteractiveControl[];   // top N by relevance
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

### Dual-Stage Filtering

**REQ-BROWSE-PERCEPT-002:** Hard Filter (Pass 1) — Remove invisible, disabled, aria-hidden, zero-dimension elements.

**REQ-BROWSE-PERCEPT-003:** Soft Filter (Pass 2) — Score remaining elements by semantic relevance to current task. Return top N (default 30).

**REQ-BROWSE-PERCEPT-004:** If filtered node count < 10, trigger screenshot fallback and consider Mode C routing.

### Mutation Monitoring

**REQ-BROWSE-PERCEPT-005:** The system SHALL inject a `MutationObserver` to track DOM mutations between action and verification.

**REQ-BROWSE-PERCEPT-006:** The verify node SHALL wait for DOM stability (`pending_mutations === 0` OR `mutation_timeout_ms` elapsed) before state comparison.

---

## 6.7 Verification Layer

### 9 Verify Strategies

**REQ-BROWSE-VERIFY-001:**

```typescript
type VerifyStrategy =
  | { type: "url_change"; expected_pattern: string }
  | { type: "element_appears"; selector: string }
  | { type: "element_text"; selector: string; contains: string }
  | { type: "network_request"; url_pattern: string }
  | { type: "no_error_banner"; error_selectors: string[] }
  | { type: "snapshot_diff"; min_node_change: number }
  | { type: "custom_js"; script: string; expected_result: any }
  | { type: "no_captcha"; captcha_selectors: string[] }       // v3.1 anti-bot
  | { type: "no_bot_block"; block_indicators: string[] };     // v3.1 anti-bot
```

**REQ-BROWSE-VERIFY-001-A:** `no_captcha` SHALL check:
- reCAPTCHA iframe (`iframe[src*="recaptcha"]`)
- hCaptcha iframe (`iframe[src*="hcaptcha"]`)
- Amazon CAPTCHA page (`form[action*="validateCaptcha"]`)
- Cloudflare challenge (`div#challenge-running`)
- Generic CAPTCHA keywords in page title/body

**REQ-BROWSE-VERIFY-001-B:** `no_bot_block` SHALL check:
- "Automated access" / "unusual traffic" text
- Empty/minimal product listings when results expected
- Redirect to verification page
- HTTP 429 response status

### Failure Taxonomy

**REQ-BROWSE-VERIFY-002:**

| Type | Examples | Response |
|------|----------|----------|
| **transient** | Timeout, network blip, loading spinner | Retry (up to `max_retries`) |
| **structural** | Selector not found, page layout changed | Replan via reflect node |
| **blocked** | CAPTCHA, rate limit banner, login wall | HITL escalation |
| **bot_detected** | "Automated access" page, HTTP 429 | Pause 30s → rotate fingerprint → retry once → HITL |
| **extraction_partial** | `browser_extract` returns missing fields | Scroll + re-extract → merge → accept if confidence > 0.7 |
| **confidence** | Confidence < 0.3 | HITL escalation |
| **unknown** | Undetermined cause | HITL escalation |

### Action Contracts

**REQ-BROWSE-VERIFY-003:** Every tool call SHALL include:

```typescript
interface ActionContract {
  tool_name: string;
  parameters: Record<string, any>;
  expected_outcome: string;          // natural language
  verify_strategy: VerifyStrategy;   // how to check
  failure_budget: number;            // max retries for this action
}
```

---

## 6.8 Confidence Scoring (Multiplicative)

**REQ-BROWSE-CONF-001:** Confidence SHALL use multiplicative decay, not additive:

```typescript
function updateConfidence(current: number, event: ConfidenceEvent): number {
  switch (event) {
    case "step":              return current * 0.97;     // -3% natural decay
    case "verify_success":    return Math.min(1.0, current * 1.08);   // +8%
    case "verify_failure":    return current * 0.80;     // -20%
    case "retry":             return current * 0.90;     // -10% per retry
    case "recipe_match":      return Math.min(1.0, current * 1.15);   // +15%
    case "extract_complete":  return Math.min(1.0, current * 1.05);   // +5%
    case "extract_partial":   return current * 0.92;     // -8%
    case "bot_detected":      return current * 0.60;     // -40% severe
  }
}
```

**Rationale:** Additive decay (`-0.05/step`) goes negative on long tasks. Multiplicative naturally bounds in (0, 1).

**REQ-BROWSE-CONF-002:** Thresholds:
- **≥ 0.7**: Allow task completion claim
- **0.3–0.7**: Continue with increased monitoring
- **< 0.3**: Force HITL escalation

---

## 6.9 Safety Layer

### Action Classification

**REQ-BROWSE-SAFETY-001:** Classification is deterministic, not LLM-discretionary:

| Class | Examples | Gate Behavior |
|-------|----------|---------------|
| **safe** | navigate, go_back, go_forward, reload, get_state, screenshot, get_metadata, scroll, hover, find_by_text, get_network, wait_for | Proceed, log only |
| **caution** | click, click_coords (Mode C), type, select, press_key, tab_manage, agent_request_human | Proceed, audit log |
| **sensitive** | form submit, send message, purchase, upload, download | HITL approval required |
| **blocked** | evaluate_js on untrusted domain, denylist domain | Block, alert, terminate |

### Domain Policy

**REQ-BROWSE-SAFETY-002:**
- **Denylist:** known malicious/sensitive domains → blocked
- **Allowlist:** trusted internal domains → relaxed limits
- **Default:** all other domains → standard restrictions

**REQ-BROWSE-SAFETY-003:** All `caution` and `sensitive` actions SHALL be logged to `audit_log` table.

### Domain Circuit Breaker

**REQ-BROWSE-SAFETY-004:** If 3 consecutive sessions fail on domain X within 1 hour:
1. Block automated retries for that domain for 1 hour
2. Log a circuit-breaker event
3. Require explicit user override to resume

---

## 6.10 Rate Limiting & Politeness

**REQ-BROWSE-RATE-001:** Rate limiting SHALL be first-class Layer 1 architecture.

**REQ-BROWSE-RATE-002:**

| Scope | Limit | Rationale |
|-------|-------|-----------|
| **Global** | 30 actions/min | Prevents resource abuse |
| **Per-domain (unknown)** | 10 actions/min | Matches human browsing pace |
| **Per-domain (trusted)** | 30 actions/min | Higher for internal/known-safe domains |
| **Per-session** | 2s minimum interval | Human-realistic pacing |

**REQ-BROWSE-RATE-003:** SHALL respect `robots.txt`. If path disallowed, block Mode A/B and offer HITL escalation.

**REQ-BROWSE-RATE-004:** SHALL check `ai-agent.txt` as fallback if `robots.txt` is absent.

---

## 6.11 Human-Like Behavior

### Mouse Movement

**REQ-BROWSE-HUMAN-001:** Mouse paths SHALL use Bezier curves via `ghost-cursor` library. No teleporting.

**REQ-BROWSE-HUMAN-002:** Mouse movement speed SHALL vary with Gaussian distribution (mean: 500ms, stddev: 150ms).

### Typing Behavior

**REQ-BROWSE-HUMAN-003:** Typing SHALL use Gaussian inter-key delays (mean: 120ms, stddev: 40ms).

**REQ-BROWSE-HUMAN-004:** Typing SHALL simulate occasional typos (1-2% rate) with backspace correction.

### Anti-Detection

**REQ-BROWSE-HUMAN-005:** Browser SHALL use `playwright-extra` with `stealth` plugin to mask automation signals.

**REQ-BROWSE-HUMAN-006:** Viewport, user-agent, and WebGL fingerprint SHALL rotate per session.

---

## 6.12 Memory Architecture (4 Types)

**REQ-BROWSE-MEMORY-001:**

| Type | Storage | Purpose | TTL |
|------|---------|---------|-----|
| **Working** | AgentState (Postgres checkpoint) | Current session state | Session |
| **Episodic** | `sessions` table | Session logs, action history | 90 days |
| **Semantic** | `domain_patterns` table + pgvector | Selector embeddings, element patterns | Indefinite |
| **Procedural** | `workflow_recipes` table | Mode A replay workflows | Until invalidated |

### Storage Adapter Interface

```typescript
interface StorageAdapter {
  // Checkpointing
  saveCheckpoint(sessionId: string, state: AgentState): Promise<void>;
  loadCheckpoint(sessionId: string): Promise<AgentState | null>;

  // Semantic memory (pgvector)
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

---

## 6.13 Streaming Events

**REQ-BROWSE-STREAM-001:** The orchestration layer SHALL emit real-time events for each state transition.

**REQ-BROWSE-STREAM-002:** Event types:

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

**REQ-BROWSE-STREAM-003:** Events SHALL be delivered via SSE (Server-Sent Events).

---

## 6.14 LLM Adapter Interface

**REQ-BROWSE-LLM-001:**

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

## 6.15 Known Failure Modes (Browse)

**REQ-BROWSE-FAIL-001:**

| # | Failure Mode | Mitigation |
|---|-------------|------------|
| F-01 | **Infinite loop** | Step counter + confidence decay → force exit |
| F-02 | **Hallucinated selectors** | Verify against actual AX-tree before use |
| F-03 | **Cost explosion** | Per-session budget cap (`budget_remaining_usd`) |
| F-04 | **CAPTCHA walls** | Detect via `no_captcha` strategy → HITL escalation |
| F-05 | **SPA navigation** | MutationObserver + wait-for-stability |
| F-06 | **Stale workflow recipes** | 30-day validation TTL on selectors |
| F-07 | **Context window overflow** | Token counting + message pruning |
| F-08 | **Rate limiting by target site** | Respectful defaults + backoff |
| F-09 | **Login/auth walls** | Detect → HITL for credentials |
| F-10 | **Domain circuit break** | 3 consecutive failures → 1hr cooldown |
| F-11 | **CAPTCHA / bot detection** | `no_captcha` + `no_bot_block` strategies → pause 30s, rotate fingerprint, retry once → HITL |
| F-12 | **Partial extraction on long pages** | Multi-scroll extraction with merge reducer, accept if confidence > 0.7, flag missing_fields |

---

## 6.16 Evaluation & Observability (from v3.1 §16 — coverage gap fix)

### 6.16.1 LangSmith Integration

**REQ-BROWSE-EVAL-001:** Every browser agent session SHALL be traced in LangSmith with full decision path: node transitions, tool calls, LLM inputs/outputs, confidence updates, verification results.

### 6.16.2 Internal Benchmark Suite

**REQ-BROWSE-EVAL-002:** A 10-task benchmark inspired by WebArena/WorkArena patterns, run as a regression suite:

| # | Task type | Count | Example |
|---|---|---|---|
| 1-3 | Information retrieval | 3 | Extract product price from Amazon |
| 4-6 | Form filling | 3 | Fill a multi-field contact form |
| 7-8 | Multi-step navigation | 2 | Navigate 3-page checkout flow |
| 9-10 | Data extraction | 2 | Extract structured table data |

**REQ-BROWSE-EVAL-002a:** Benchmark runs on every PR that touches `packages/agent-core/src/orchestration/` or `packages/agent-core/src/mcp/`. Pass threshold: 80% task success rate.

### 6.16.3 WAREX Stress Testing

**REQ-BROWSE-EVAL-003:** The system SHALL be validated under injected failures (WAREX = Worst-case Agent Runtime EXercise):

| # | Injection | Purpose |
|---|---|---|
| W-1 | Random selector invalidation | Test structural failure → reflect/replan path |
| W-2 | Network timeout injection (random 5s delays) | Test transient failure → retry path |
| W-3 | CAPTCHA appearance simulation | Test bot detection → HITL escalation path |
| W-4 | DOM mutation storms (rapid 50+ mutations) | Test mutation observer → stability wait path |
| W-5 | Rate limit banner injection (HTTP 429 interception) | Test rate limit → backoff path |

**REQ-BROWSE-EVAL-003a:** WAREX runs weekly in CI on a dedicated test environment. Failure in any WAREX scenario is a P1 bug.

### 6.16.4 Per-Session Scorecards

**REQ-BROWSE-EVAL-004:** Every session produces a scorecard with these metrics:

| Metric | Type | Target |
|---|---|---|
| Task success (binary) | bool | ≥80% across benchmark |
| Step count | int | < 30 for simple, < 50 for complex |
| Confidence at completion | float | ≥ 0.7 for success claims |
| Cost (USD) | float | < $1.00 for 20-step task |
| Latency (seconds) | float | < 90s for simple tasks |
| Failure type distribution | histogram | No single failure type > 30% of failures |

### 6.16.5 Regression Detection

**REQ-BROWSE-EVAL-005:** Alert when benchmark success rate drops >10% vs 7-day rolling baseline. Alert channels: Sentry + Slack webhook + consultant dashboard admin panel.

**REQ-BROWSE-EVAL-005a:** Regression detection runs daily (overnight batch). It compares the latest benchmark run against the 7-day rolling average. A >10% drop triggers a P1 investigation.

### 6.16.6 Implementation Phase

Evaluation infrastructure is Phase 8 in v3.1 (post-MVP). In the master architecture, it maps to Phase 13 (Production Hardening). The benchmark suite SHOULD be started in Phase 5 (a subset of 5 tasks) and expanded in Phase 13.

---

---

## 6.17 Overlay Dismissal (v2.2a)

**REQ-BROWSE-OVERLAY-001:** Between page stabilization and perception capture, an `overlay_dismissal` step attempts to dismiss cookie banners, modals, email popups, and chat widgets that would otherwise corrupt perception data.

**REQ-BROWSE-OVERLAY-002:** Detection heuristics (same as §7.10 quality gate):
- `position: fixed` or `position: sticky`
- `z-index > 999`
- Bounding box covering > 30% of viewport
- Common class patterns: `cookie`, `consent`, `modal`, `popup`, `overlay`, `chat-widget`, `banner`

**REQ-BROWSE-OVERLAY-003:** Dismissal attempts common selector patterns for accept/close buttons:

```typescript
const DISMISS_SELECTORS = [
  '[class*="accept"]',
  '[class*="close"]',
  '[aria-label*="close" i]',
  '[aria-label*="dismiss" i]',
  'button:has-text("Accept")',
  'button:has-text("Accept all")',
  'button:has-text("Got it")',
  'button:has-text("OK")',
  'button:has-text("Continue")',
  '.cookie-consent button',
  '.modal-close',
  '[data-testid*="close"]',
];
```

**REQ-BROWSE-OVERLAY-004:** Process:
1. Detect overlay elements
2. Try each selector in order until one produces a visible, clickable element within the overlay
3. Click with ghost-cursor (human-like)
4. Wait for DOM stability (MutationObserver settles, max 2s)
5. Re-check for overlay presence
6. Emit `overlay_dismissed` event (§34) with overlay_type and selector_used
7. If dismissal fails, proceed with overlay present — quality gate (§7.10) handles degraded perception

**REQ-BROWSE-OVERLAY-005:** Overlay dismissal is a **browser agent concern**, NOT an analysis concern. It runs in the browse subgraph. The analysis agent does not know about overlays.

**REQ-BROWSE-OVERLAY-006:** The persistent overlay itself (e.g., page-blocking cookie wall) is evaluated as a CRO finding separately by the analysis agent. The dismissal step is pre-perception cleanup; the finding is post-perception observation.

---

**End of §6 — Browse Mode (base §6.0-6.15 + evaluation §6.16 + overlay dismissal §6.17)**

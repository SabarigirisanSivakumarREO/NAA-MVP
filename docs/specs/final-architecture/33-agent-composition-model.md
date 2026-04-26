---
title: 33-agent-composition-model
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

# Section 33 — Agent Composition Model

**Status:** Architectural specification. Supersedes §31 (State-Aware Analysis) and §32 (Interactive Analysis). Those sections are retained for reference with "superseded by §33" notes.

**Cross-references:**
- §3 (Architecture Layers) — REQ-LAYER-005 revised to v3
- §4 (Orchestration) — subgraph integration updated
- §5 (Unified State) — composition-specific state extensions
- §6 (Browse Mode v3.1) — Browser Agent as reusable capability library
- §7 (Analyze Mode) — Analysis Agent pipeline extended with interactive evaluate
- §8 (Tool Manifest) — tool injection matrix for composition
- §9 (Heuristic KB) — dual-mode evaluation integrates with heuristic schema
- §11 (Safety & Cost) — composition cost model
- §20 (State Exploration) — consumed by composition, unchanged
- §21 (Workflow Orchestration) — workflow-level composition
- §31 (State-Aware Analysis) — absorbed: per-state + transition scopes
- §32 (Interactive Analysis) — absorbed: browser tool injection during evaluate

---

## 33.1 Principle

> **The Browser Agent is a reusable capability library. The Analysis Agent is a CRO domain expert. They compose — they do not merge. The Browser Agent provides tools, stealth, verification, and a shared browser session. The Analysis Agent borrows those capabilities via injection to perform interactive evaluation. Neither agent is subordinate to the other; both are independently valuable.**

This is not a plugin architecture, not an orchestrator-mediated message bus, and not a merge of two codebases. It is **dependency injection of browser capabilities into the analysis evaluation loop**, with the orchestrator managing lifecycle and safety boundaries.

---

## 33.2 The Two Agents

### Browser Agent — Reusable Capability Library

| Aspect | Specification |
|---|---|
| **Identity** | General-purpose browser automation agent (v3.1) |
| **Reusability** | Can operate independently for non-CRO tasks: data extraction, web scraping, form filling, monitoring |
| **Provides** | 23 MCP tools, stealth infrastructure, human-like behavior, verification strategies, session management, confidence scoring |
| **Owns** | Browser session lifecycle (Playwright context), page navigation, page stabilisation, rate limiting, anti-detection |
| **Does not own** | CRO evaluation, heuristic knowledge, finding production, evidence grounding |
| **Graph** | 10-node browse subgraph (§6.3): classify → load_memory → open_session → perceive → reason → safety_gate → act → verify → reflect → hitl → output |
| **Spec** | §6 (inlined from `AI_Browser_Agent_Architecture_v3.1.md`) |

### Analysis Agent — CRO Domain Expert

| Aspect | Specification |
|---|---|
| **Identity** | CRO audit specialist with research-grounded methodology |
| **Reusability** | CRO-specific; requires heuristic KB, perception data, and browser session (when interactive) |
| **Provides** | 5-step pipeline (perceive → evaluate → self-critique → ground → annotate), heuristic evaluation, finding production, evidence grounding, dual-mode evaluation |
| **Owns** | CRO methodology, heuristic filtering, finding lifecycle, severity assignment, confidence tiering |
| **Does not own** | Browser session, page navigation, page transitions, stealth, rate limiting |
| **Graph** | Analysis subgraph (§7.3): deep_perceive → evaluate → self_critique → ground → annotate_and_store |
| **Spec** | §7 (inlined from `AI_Analysis_Agent_Architecture_v1.0.md`) |

---

## 33.3 Composition Pattern: Tool Injection

**REQ-COMP-001:** The composition pattern is **tool injection** — the Analysis Agent's evaluate node receives a subset of browser tools from the shared session, alongside its own analysis tools.

```
COMPOSITION (not merge, not plugin, not message bus):

Browser Agent Runtime:
  ┌──────────────────────────────────────────┐
  │ BrowserSession (Playwright + stealth)    │
  │ 23 tools, verification, rate limiting    │
  │ Session lifecycle: open → use → close    │
  └──────────────────┬───────────────────────┘
                     │
                     │ tool injection (9 of 23 tools)
                     │
                     ▼
Analysis Agent (evaluate node):
  ┌──────────────────────────────────────────┐
  │ Available tools (15 total):              │
  │   9 browser: click, hover, select, type, │
  │     press_key, scroll, get_state,        │
  │     screenshot, find_by_text             │
  │   3 perception: page_analyze,            │
  │     page_get_element_info,               │
  │     page_get_performance                 │
  │   3 output: produce_finding,             │
  │     mark_heuristic_pass,                 │
  │     mark_heuristic_needs_review          │
  │                                          │
  │ Pipeline: perceive → evaluate → critique │
  │           → ground → annotate            │
  └──────────────────────────────────────────┘
```

**REQ-COMP-002:** The Browser Agent's public interface (23 MCP tools) is UNCHANGED by composition. No CRO-specific tools, prompts, or heuristic knowledge are added to the Browser Agent. It can be used independently for non-CRO tasks (data extraction, web scraping, monitoring) without any awareness that an Analysis Agent exists. The Browser Agent does NOT know about CRO. The Analysis Agent does NOT manage browser sessions. The Audit Orchestrator (§4) manages composition lifecycle:
1. Opens browser session via Browser Agent
2. Browse subgraph navigates to page + stabilises
3. Analysis subgraph receives browser session handle + injected tools
4. Analysis evaluates interactively (or statically, per mode)
5. Orchestrator restores page state after analysis
6. Orchestrator advances to next page or workflow step

---

## 33.4 Tool Injection Matrix

**REQ-COMP-010:** During the `evaluate_interactive` node, the Analysis Agent receives exactly these tools:

### Injected Browser Tools (9)

| # | Tool | Safety Class | Why Analysis Needs It |
|---|---|---|---|
| 1 | `browser_click` | caution | Click tabs, accordions, checkboxes, radio buttons, CTAs, "show more" buttons |
| 2 | `browser_hover` | safe | Reveal tooltips, dropdown previews, hover states |
| 3 | `browser_select` | caution | Change dropdowns: size, variant, quantity, sort order |
| 4 | `browser_type` | caution | Fill form fields to trigger validation, test search |
| 5 | `browser_press_key` | caution/sensitive* | Escape (close modal), Tab (focus), arrow keys. *Enter key reclassified — see REQ-COMP-011a |
| 6 | `browser_scroll` | safe | Scroll to reveal lazy-loaded content, trigger sticky elements |
| 7 | `browser_get_state` | safe | Fresh perception after interaction |
| 8 | `browser_screenshot` | safe | Capture evidence of dynamic state |
| 9 | `browser_find_by_text` | safe | Locate elements by visible text |

### Analysis-Specific Tools (6)

| # | Tool | Purpose |
|---|---|---|
| 10 | `page_analyze` | Re-perceive after interaction — returns fresh AnalyzePerception |
| 11 | `page_get_element_info` | Bounding box, computed styles, isAboveFold for specific element |
| 12 | `page_get_performance` | Performance metrics (DOMContentLoaded, LCP, etc.) |
| 13 | `produce_finding` | Structured finding output (analysis-only tool, not from §8) |
| 14 | `mark_heuristic_pass` | Mark heuristic as passing (analysis-only tool) |
| 15 | `mark_heuristic_needs_review` | Mark heuristic as uncertain (analysis-only tool) |

**Note:** `page_screenshot_full` and `page_annotate_screenshot` from §8 are NOT available during evaluate. `page_screenshot_full` is used in `deep_perceive` (before evaluate). `page_annotate_screenshot` is used in `annotate_and_store` (after evaluate). During evaluate, `browser_screenshot` (viewport) is sufficient for evidence capture.

**Cost note:** `page_analyze` is a full DOM traversal (~200ms, no LLM cost). `browser_get_state` is lighter (AX-tree only, ~50ms). The evaluate prompt instructs the LLM to prefer `browser_get_state` for quick checks and use `page_analyze` only when a full re-perception is needed (e.g., after a major state change like variant selection).

### Excluded Tools (Navigation + Sensitive + Restricted)

| Tool | Reason for Exclusion |
|---|---|
| `browser_navigate` | Analysis stays on current page — no URL changes |
| `browser_go_back` / `browser_go_forward` | No history manipulation during analysis |
| `browser_tab_manage` | No tab operations during analysis |
| `browser_download` / `browser_upload` | Not relevant to CRO evaluation |
| `browser_evaluate` | JS execution restricted for safety |
| `browser_extract` | Data extraction is a browse concern |
| `browser_click_coords` | Mode C only; analysis uses ref-based interaction |
| `browser_reload` | Reserved for orchestrator state restoration |
| `browser_get_metadata` | Available indirectly via page_analyze |
| `browser_get_network` | Network analysis not in scope for CRO evaluation |
| `agent_complete` | Browse-mode signal, not used in analysis |
| `agent_request_human` | Analysis does not escalate to HITL |
| `page_screenshot_full` | Used in deep_perceive, not during evaluate |
| `page_annotate_screenshot` | Used in annotate_and_store, not during evaluate |

**REQ-COMP-011:** The safety classification from §11 applies to ALL browser tool calls during analysis. Sensitive actions (form submission with real data, purchases, uploads) are **BLOCKED** during analysis. The safety gate is deterministic code, not LLM judgment (unchanged from §6.9).

**REQ-COMP-011a:** `browser_press_key` with `key = "Enter"` is **reclassified to sensitive** when the currently focused element is inside a `<form>`. This prevents accidental form submission during analysis. Detection is deterministic:

```typescript
async function classifyPressKey(
  key: string,
  browserSession: BrowserSession
): ActionClass {
  if (key.toLowerCase() !== "enter") return "caution";

  // Check if focused element is inside a <form>
  const isInForm = await browserSession.evaluate(() => {
    const active = document.activeElement;
    return active ? !!active.closest("form") : false;
  });

  if (isInForm) return "sensitive";  // BLOCKED during analysis
  return "caution";                   // Enter outside form is fine (e.g., closing dialog)
}
```

**REQ-COMP-012:** Navigation guard operates in **two layers** — pre-execution inspection and post-execution recovery:

**Layer 1 — Pre-execution (prevents most navigation):**

```typescript
async function inspectClickTarget(
  elementRef: string,
  currentUrl: string,
  browserSession: BrowserSession
): Promise<{ safe: boolean; reason?: string }> {
  const elementInfo = await browserSession.evaluate((ref) => {
    const el = document.querySelector(`[data-ref="${ref}"]`) ||
               document.querySelector(ref);
    if (!el) return { tag: "unknown", href: null };

    // Walk up to find nearest <a> ancestor
    const anchor = el.closest("a");
    if (!anchor) return { tag: el.tagName, href: null };

    return {
      tag: "A",
      href: anchor.href,
      target: anchor.target,
    };
  }, elementRef);

  // If the element (or its ancestor) is an <a> with an external href, BLOCK
  if (elementInfo.tag === "A" && elementInfo.href) {
    const clickUrl = new URL(elementInfo.href, currentUrl);
    const currentParsed = new URL(currentUrl);

    // Same origin + same pathname = safe (hash/query changes are fine)
    if (clickUrl.origin === currentParsed.origin &&
        clickUrl.pathname === currentParsed.pathname) {
      return { safe: true };
    }

    // Different page = navigation = BLOCKED
    return {
      safe: false,
      reason: `Click target is <a href="${elementInfo.href}"> which navigates to a different page`
    };
  }

  // Not an anchor — allow (JS-triggered navigation caught by Layer 2)
  return { safe: true };
}
```

**Layer 2 — Post-execution recovery (catches JS-triggered navigation):**

```typescript
async function verifyNoNavigation(
  preClickUrl: string,
  browserSession: BrowserSession
): Promise<{ safe: boolean; reason?: string }> {
  const currentUrl = await browserSession.currentUrl();
  const pre = new URL(preClickUrl);
  const post = new URL(currentUrl);

  // Same origin + same pathname = safe (hash/query changes are normal state changes)
  if (post.origin === pre.origin && post.pathname === pre.pathname) {
    return { safe: true };
  }

  // Navigation detected — recover
  await browserSession.goBack();
  await waitForStability(browserSession);
  return { safe: false, reason: "navigation_detected_post_click" };
}
```

**REQ-COMP-012a:** The agent receives different messages depending on which layer caught the navigation:
- Layer 1: `"Action blocked: this click targets <a href='...'> which would navigate away from {current_url}. Analysis stays on current page."`
- Layer 2: `"Navigation detected after click — recovered via goBack(). The interaction had a side effect. Evaluate from available evidence."`

---

## 33.5 REQ-LAYER-005 (v3) — Revised Layer Contract

**REQ-LAYER-005 (v3):** Layer 3 (Analysis Engine) MAY use browser interaction tools from the shared browser session to interact with the page during heuristic evaluation. Layer 3 SHALL NOT use navigation tools (`browser_navigate`, `browser_go_back`, `browser_go_forward`, `browser_tab_manage`). Layer 3 SHALL NOT trigger sensitive actions (form submission, purchases, uploads). The browser session is shared, not owned — analysis borrows it, does not manage it. After analysis completes, the orchestrator (Layer 1) restores the page to its default state before proceeding.

**Replaces:** REQ-LAYER-005 (v1, §3.2): "Layer 3 SHALL never directly control the browser."

**Rationale:** The original REQ-LAYER-005 was correct for static analysis. With interactive evaluation (§32 concept, now absorbed), the analysis agent MUST interact to evaluate state-dependent heuristics. The revised contract preserves the critical boundary (analysis doesn't navigate or manage sessions) while enabling interaction.

---

## 33.6 Three Composition Levels

### Level 1: Page-Level Composition

The default and most common composition. One page, one shared session.

```
Orchestrator
    │
    ├── Browse Agent: navigate to URL → stabilise → [explore_states (§20)]
    │         │
    │         │ browser session stays open
    │         ▼
    ├── Analysis Agent: deep_perceive → evaluate_interactive → self_critique → ground → annotate
    │         │
    │         │ uses injected browser tools during evaluate
    │         ▼
    └── Orchestrator: restore page state → advance to next page
```

**REQ-COMP-020:** Page-level composition is the atomic unit. All other levels delegate to it.

### Level 2: Multi-Page Composition

Each page is independently composed (browse + interactive analysis). The orchestrator manages the page queue.

```
Orchestrator (page_router)
    │
    ├── Page 1: browse → analysis (Level 1 composition)
    ├── Page 2: browse → analysis (Level 1 composition)
    ├── ...
    └── Page N: browse → analysis (Level 1 composition)
    │
    ├── Cross-page consistency check (§10)
    └── Audit complete
```

**REQ-COMP-021:** Each page-level composition is independent. Browser session state (cookies, localStorage) persists across pages within the same audit but page-specific state (scroll position, opened tabs, form fills) is restored between pages.

### Level 3: Workflow Funnel Composition

A continuous browser session traverses a multi-step funnel. Browse handles transitions; analysis evaluates interactively at each step. Session state (cookies, cart, form data) persists across steps.

```
Workflow Orchestrator (§21)
    │
    ├── Step 1 (homepage):
    │     browse → analysis (Level 1)
    │     │
    │     ├── TRANSITION: browser_click("Add to Cart") → verify transition
    │     ▼
    ├── Step 2 (cart):
    │     browse (verify correct page) → analysis (Level 1)
    │     │
    │     ├── TRANSITION: browser_click("Proceed to Checkout") → verify
    │     ▼
    ├── Step 3 (checkout):
    │     browse (verify) → analysis (Level 1)
    │     │
    │     └── no more steps
    │
    ├── Workflow-level analysis (§21.5): cross-step synthesis
    └── Workflow persist
```

**REQ-COMP-022:** In workflow composition, the browser session is held OPEN for the entire funnel. Cookies, cart state, and form data persist across steps. This is enforced by the Workflow Orchestrator (§21, REQ-WORKFLOW-NODE-003 S9-L2-FIX).

**REQ-COMP-022a:** Workflow step restore — after interactive analysis at each step, the workflow orchestrator restores the page before performing the transition action:

```
Step N lifecycle (within workflow orchestrator):
  1. Browse navigates to step N URL + stabilises
  2. Analysis evaluates interactively (may modify page state)
  3. WORKFLOW STEP RESTORE (not the audit-level restore_state)
  4. Workflow orchestrator performs transition action → step N+1
```

```typescript
async function workflowStepRestore(
  browserSession: BrowserSession,
  stepUrl: string,
  analysisInteractionCount: number,
  workflowContext: WorkflowContext
): Promise<void> {
  // Skip if analysis didn't interact
  if (analysisInteractionCount === 0) return;

  // Strategy 1: Reload (preserves cookies, cart, server-side session)
  await browserSession.reload({ waitUntil: "networkidle" });
  await waitForStability(browserSession);

  // Verify: URL still matches step URL
  const currentUrl = await browserSession.currentUrl();
  const current = new URL(currentUrl);
  const expected = new URL(stepUrl);

  if (current.origin !== expected.origin || current.pathname !== expected.pathname) {
    // Reload caused redirect — navigate back explicitly
    await browserSession.navigate(stepUrl);
    await waitForStability(browserSession);
  }

  // Verify: critical funnel state survived reload
  // (cart items, form prefill, login session)
  const stateCheck = await verifyFunnelState(browserSession, workflowContext);
  if (!stateCheck.intact) {
    // Funnel state was lost (e.g., cart emptied on reload — rare, server-dependent)
    workflowContext.abandoned = true;
    workflowContext.abandon_reason = `funnel_state_lost_after_restore: ${stateCheck.reason}`;
    // Workflow proceeds to workflow_analyze with available data
  }
}

async function verifyFunnelState(
  browserSession: BrowserSession,
  workflowContext: WorkflowContext
): Promise<{ intact: boolean; reason?: string }> {
  const currentStep = workflowContext.steps[workflowContext.current_step_index];

  // Page-type-specific checks
  switch (currentStep.page_type) {
    case "cart":
      // Verify cart is not empty
      const cartState = await browserSession.evaluate(() => {
        const cartCount = document.querySelector(
          '[data-cart-count], .cart-count, .cart-items-count'
        );
        return cartCount ? parseInt(cartCount.textContent || "0") : -1;
      });
      if (cartState === 0) return { intact: false, reason: "cart_emptied_on_reload" };
      break;

    case "checkout":
      // Verify we're still on checkout (not redirected to login)
      const hasCheckoutForm = await browserSession.evaluate(() => {
        return !!document.querySelector(
          'form[action*="checkout"], form[action*="order"], [data-checkout]'
        );
      });
      if (!hasCheckoutForm) return { intact: false, reason: "checkout_form_lost" };
      break;
  }

  return { intact: true };
}
```

**REQ-COMP-022b:** If funnel state is lost after restore, the workflow is marked `abandoned` with reason. Workflow analysis (§21.5) still runs on successfully traversed steps. This is a known limitation: some sites store cart state in-page only (not cookies/server-side), and reload destroys it. These sites require `composition_mode = "static"` for workflow audits.

**REQ-COMP-023:** During workflow composition, the Analysis Agent at each step SHALL NOT perform transition actions. Actions that advance the funnel (e.g., "Add to Cart", "Proceed to Checkout") are performed ONLY by the Workflow Orchestrator via the Browse Agent. The Analysis Agent may interact with the page at each step (open tabs, select variants, check validation) but cannot trigger the transition to the next step.

**REQ-COMP-024:** Transition action classification:

| Action | Who Performs | Why |
|---|---|---|
| Click "Add to Cart" | Workflow Orchestrator (via Browse Agent) | Advances funnel — session contamination risk if analysis does it |
| Click "Proceed to Checkout" | Workflow Orchestrator | Same — funnel transition |
| Click "Reviews" tab (same page) | Analysis Agent (during evaluate) | Does not advance funnel — reveals content for evaluation |
| Select size variant (same page) | Analysis Agent (during evaluate) | Does not advance funnel — reveals state for evaluation |
| Submit empty form (validation) | Analysis Agent (during evaluate) | Does not advance funnel — tests error handling |

---

## 33.7 Enhanced Chain-of-Thought: Interactive CoT

**REQ-COMP-030:** The evaluate node's chain-of-thought is enhanced to support optional interaction between OBSERVE and ASSESS:

```
For each heuristic:

  1. OBSERVE     — What specific elements on the page relate to this heuristic?
                   (from static perception data)

  2. INTERACT    — [OPTIONAL] Is the static data sufficient to evaluate?
     (if needed)   If NO: use browser tools to reveal hidden content.
                   Call browser_click/select/hover/type/scroll → browser_get_state.
                   Max 2 interactions per heuristic (focus drift mitigation).

  3. ASSESS      — Does the page comply or violate? Why?
                   (using static data + any interaction results)

  4. EVIDENCE    — Point to the exact element, measurement, or data point.
                   Include interaction_path if interaction was performed.

  5. SEVERITY    — Assign based on evidence strength, NOT gut feeling.
                   Critical/high requires measurable evidence (GR-006).
```

**REQ-COMP-031:** The interactive CoT is a prompting technique INSIDE the evaluate node. It is NOT a separate phase, NOT a separate graph node, and NOT orchestrator-mediated. The LLM decides whether to interact based on the heuristic being evaluated and the available evidence.

**REQ-COMP-032:** Self-critique remains a SEPARATE LLM call after evaluate completes (unchanged from §7.6, SD-07). Self-critique reviews the findings produced during interactive evaluation with the same rigor as static evaluation.

---

## 33.7a Relationship Between §20 State Exploration and §33 Interactive Evaluate

§20 and §33 both interact with the page, but at different times, for different purposes, with different state contracts.

```
TIMELINE (per page):

  Browse stabilises page
       │
       ▼
  §20 explore_states (BEFORE analysis)
       │  Rule-driven, systematic
       │  Produces: StateGraph (FROZEN after this point)
       │  Produces: MultiStatePerception (FROZEN)
       │  Page restored to default state after exploration
       ▼
  deep_perceive (reads MultiStatePerception)
       │
       ▼
  §33 evaluate_interactive (DURING analysis)
       │  Heuristic-driven, ad-hoc
       │  Reads: StateGraph (read-only — does NOT add states)
       │  Produces: InteractionRecord[] (transient, not persisted as states)
       │  Page may be in modified state during evaluate
       │  Page restored by orchestrator after evaluate
       ▼
  self_critique → ground → annotate
```

**REQ-COMP-033:** The StateGraph produced by §20 is **immutable** once `explore_states` completes. Interactive evaluate interactions do NOT create new `StateNode` entries. The StateGraph is a read-only input to the analysis pipeline.

**REQ-COMP-034:** Interactive evaluate interactions produce `InteractionRecord` entries (§33.13), not `StateNode` entries. These records are:
- Stored in `AuditState.analysis_interactions` (transient per-page, not persisted to `page_states` table)
- Attached to findings via `evidence.interaction_performed` (for consultant traceability)
- NOT included in `MultiStatePerception` or `state_provenance`

**REQ-COMP-035:** Findings produced during interactive evaluate that reference elements only visible after an interaction carry `evidence.interaction_performed` (the interaction that revealed the element), NOT `evaluated_state_id` (which references §20 states). GR-011 applies to §20-derived per-state findings. GR-011 does NOT apply to findings with `evidence.interaction_performed` set — those are validated by GR-001 (element exists in the post-interaction perception captured by `browser_get_state`).

**REQ-COMP-036:** §20-explored states are provided to the evaluate prompt as context to avoid redundant interactions:

```
ALREADY EXPLORED STATES (from state exploration):
{{#each state_graph.states}}
  State: {{state_id}} — reached via: {{interaction_path | describe}}
  Key content revealed: {{perception_summary}}
{{/each}}

If you need to evaluate a heuristic against one of these states,
reference the state data above. Do NOT re-interact to reach a
state that was already explored — that wastes your interaction budget.
Only interact to reach states NOT listed above.
```

**REQ-COMP-037:** The evaluate node does NOT auto-restore page state between heuristics. If the LLM selects size "XL" while evaluating heuristic A, and then evaluates heuristic B, heuristic B sees the "XL" state. This is intentional — the LLM may evaluate multiple heuristics against the same interaction result. The LLM can explicitly call `browser_select` to change back or `browser_scroll` to reset scroll position if needed.

**REQ-COMP-038:** If §20 is not active (Phase 1-6, or static mode), the `state_graph` is null and `MultiStatePerception.hidden_states` is empty. In this case, ALL heuristics evaluate as global scope regardless of their declared `analysis_scope`. Interactive evaluate still works — the LLM can interact to reveal hidden content even without §20 pre-exploration. The difference: without §20, the LLM must discover ALL hidden content itself (using its interaction budget); with §20, common disclosures are pre-captured and the LLM focuses on ad-hoc interactions §20 couldn't predict.

---

## 33.7b Interactive Evaluate Node — Implementation

**REQ-COMP-039:** The `evaluateInteractive` node is a ReAct loop. This is the reference implementation (extends §32.4, absorbed):

```typescript
async function evaluateInteractive(
  state: AuditState,
  perception: AnalyzePerception,
  heuristics: HeuristicExtended[],
  browserSession: BrowserSession,
  stateGraph: StateGraph | null,
): Promise<Partial<AuditState>> {

  // --- Mode check ---
  if (state.composition_mode === "static") {
    // Delegate to original single-shot evaluate (§7.5)
    return evaluateStatic(state, perception, heuristics);
  }

  // --- Build tool set ---
  const browserTools = [
    browserClickTool, browserHoverTool, browserSelectTool,
    browserTypeTool, browserPressKeyTool, browserScrollTool,
    browserGetStateTool, browserScreenshotTool, browserFindByTextTool,
  ];
  const analysisTools = [
    pageAnalyzeTool, pageGetElementInfoTool, pageGetPerformanceTool,
    produceFindingTool, markHeuristicPassTool, markHeuristicNeedsReviewTool,
  ];
  const allTools = [...browserTools, ...analysisTools];

  // --- Initialize tracking ---
  const maxInteractions = state.analysis_interaction_budget;
  const perHeuristicCap = state.interaction_depth === "deep" ? 3 : 2;
  const maxTurns = state.interaction_depth === "deep" ? 40 : 20;
  let totalInteractionCount = 0;
  const tracker = new HeuristicInteractionTracker(heuristics, perHeuristicCap);
  const findings: RawFinding[] = [];
  const interactionLog: InteractionRecord[] = [];

  // --- Build initial messages ---
  const messages = [
    buildInteractiveSystemPrompt(state.interaction_depth),
    buildEvaluateUserMessage(perception, heuristics, stateGraph),
  ];

  // --- ReAct loop ---
  let turn = 0;
  while (turn < maxTurns) {
    turn++;
    const response = await llmAdapter.invoke(messages, allTools, { temperature: 0 });
    messages.push(response);

    // No tool calls = LLM is done
    if (!response.tool_calls || response.tool_calls.length === 0) break;

    for (const toolCall of response.tool_calls) {

      // --- Finding output tools ---
      if (["produce_finding", "mark_heuristic_pass", "mark_heuristic_needs_review"].includes(toolCall.name)) {
        const finding = toolCall.name === "produce_finding"
          ? toolCall.args
          : { ...toolCall.args, status: toolCall.name === "mark_heuristic_pass" ? "pass" : "needs_review" };

        findings.push(finding);
        tracker.advanceHeuristic(finding.heuristic_id);
        messages.push(toolResult(toolCall, { recorded: true }));
        continue;
      }

      // --- Analysis perception tools (no interaction budget) ---
      if (["page_analyze", "page_get_element_info", "page_get_performance"].includes(toolCall.name)) {
        const result = await executeAnalysisTool(browserSession, toolCall);
        messages.push(toolResult(toolCall, result));
        continue;
      }

      // --- Browser interaction tools ---
      if (isBrowserTool(toolCall.name)) {

        // Global budget check
        if (totalInteractionCount >= maxInteractions) {
          messages.push(toolResult(toolCall, {
            error: `Page interaction budget exhausted (${maxInteractions}/${maxInteractions}). Evaluate remaining heuristics from static data.`
          }));
          continue;
        }

        // Per-heuristic budget check
        const heuristicCheck = tracker.canInteract();
        if (!heuristicCheck.allowed) {
          messages.push(toolResult(toolCall, { error: heuristicCheck.reason }));
          continue;
        }

        // Safety classification (C2 fix: Enter key reclassification)
        const safety = await classifyAnalysisAction(toolCall, browserSession);
        if (safety === "sensitive" || safety === "blocked") {
          messages.push(toolResult(toolCall, {
            error: `Action blocked: ${toolCall.name} is ${safety} during analysis.`
          }));
          continue;
        }

        // Navigation guard Layer 1 (C1 fix: pre-execution inspection)
        if (toolCall.name === "browser_click") {
          const navCheck = await inspectClickTarget(
            toolCall.args.elementRef, state.current_url, browserSession
          );
          if (!navCheck.safe) {
            messages.push(toolResult(toolCall, { error: navCheck.reason }));
            continue;
          }
        }

        // Workflow transition guard
        if (state.workflow_context) {
          if (isTransitionAction(toolCall, state.workflow_context)) {
            messages.push(toolResult(toolCall, {
              error: "This action would advance the funnel. Only the workflow orchestrator performs transitions."
            }));
            continue;
          }
        }

        // --- Execute ---
        const result = await executeBrowserTool(browserSession, toolCall);

        // Navigation guard Layer 2 (C1 fix: post-execution recovery)
        const navPostCheck = await verifyNoNavigation(state.current_url, browserSession);
        if (!navPostCheck.safe) {
          messages.push(toolResult(toolCall, {
            error: `Navigation detected after click — recovered via goBack(). Evaluate from available evidence.`
          }));
          totalInteractionCount++;
          tracker.recordInteraction();
          continue;
        }

        messages.push(toolResult(toolCall, result));
        totalInteractionCount++;
        tracker.recordInteraction();

        interactionLog.push({
          tool: toolCall.name,
          args: toolCall.args,
          result,
          timestamp: Date.now(),
          phase: "analysis",
          heuristic_id: tracker.currentHeuristicId(),
        });
        continue;
      }

      // Unknown tool
      messages.push(toolResult(toolCall, { error: "Unknown tool" }));
    }

    // Exit: all heuristics resolved
    if (findings.length >= heuristics.length) break;

    // Exit: token budget (M2 note: 80% threshold)
    if (getTokenCount(messages) > llmAdapter.contextLimit * 0.80) {
      messages.push({
        role: "system",
        content: "Context budget nearly exhausted. Complete remaining heuristics from available evidence."
      });
      // Allow one more turn for the LLM to flush remaining findings
    }
  }

  return {
    raw_findings: findings,
    analysis_interactions: interactionLog,
    analysis_interaction_count: totalInteractionCount,
  };
}
```

---

## 33.8 Dual-Mode Evaluation

**REQ-COMP-040:** Each page undergoes TWO evaluation passes:

### Pass 1 — Heuristic-Driven Evaluation (structured)

| Aspect | Specification |
|---|---|
| **What** | Evaluates the page against filtered heuristics from the KB |
| **Input** | AnalyzePerception (from deep_perceive) + filtered_heuristics + browser tools |
| **Method** | Interactive CoT (§33.7) — LLM evaluates each heuristic, interacting as needed |
| **Scope split** | Heuristics split by `analysis_scope` (§31.2, absorbed): global → merged view, per_state → each state, transition → state pairs |
| **Confidence** | Tier 1-3 based on heuristic reliability + evidence quality (§7.7) |
| **Grounding** | Full 8+ grounding rules (GR-001..GR-011) |
| **Output** | GroundedFindings[] with full evidence chain |

### Pass 2 — Open CRO Observation (consultant-style)

| Aspect | Specification |
|---|---|
| **What** | "What did the heuristics miss?" — unstructured CRO review |
| **Input** | AnalyzePerception + Pass 1 findings summary (heuristic IDs + status) |
| **Method** | Single LLM call — static perception only, NO browser tools (see rationale below) |
| **Confidence** | Always Tier 3 (low) — consultant review required |
| **Cap** | Max 5 observations per page |
| **Cost** | ~$0.05/page additional (1 LLM call, ~4K tokens) |
| **Grounding** | GR-001, GR-007 (element exists + no conversion prediction). Other rules applied but with relaxed expectations. GR-005 SKIPPED (§33.8 REQ-COMP-042a). |
| **Output** | OpenObservation[] — tagged as `source: "open_observation"` |
| **Lifecycle** | Always HELD for consultant review (never auto-published) |
| **Learning** | Open observations feed the Learning Service (§28) — consultant-approved observations crystallise into new heuristics over time |

**Why Pass 2 has NO browser tools:** Pass 1's interactive evaluate already used the interaction budget. Giving Pass 2 its own interaction budget would (a) increase cost unpredictably, (b) add another ReAct loop after the main evaluation, (c) risk page state corruption before self-critique. Pass 2 is a lightweight "second opinion" on static data — not a second round of exploration. If the LLM notices something interesting in the static data, it reports it. The consultant decides if deeper investigation is warranted in a follow-up audit.

#### 33.8.1 Open Observation Prompt

```
SYSTEM:
You are a senior CRO consultant performing a final review.
The page has already been evaluated against {{pass_1_finding_count}} heuristics.
{{pass_1_violation_count}} violations were found.

Your job: look at the page with FRESH EYES. What CRO issues exist that
the structured heuristics MISSED?

Think like a consultant who has reviewed 1,000 e-commerce sites.
What patterns do you notice? What friction points are obvious to
an experienced eye but not captured by formal rules?

RULES:
- Maximum 5 observations
- Each must cite specific page evidence (element, text, position)
- Do NOT repeat issues already found in Pass 1
- Do NOT predict conversion impact
- You CANNOT interact with the page — evaluate from static data only
- If you suspect hidden content needs investigation, note it as a
  recommendation ("verify by clicking X") — the consultant will decide
- Every observation is Tier 3 (consultant review required)

PASS 1 FINDINGS (for context — do not repeat):
{{pass_1_findings_summary}}

PAGE DATA:
{{analyze_perception | selected_fields}}

Respond with JSON array:
[{
  "observation": "what you noticed",
  "evidence": {
    "element_ref": "specific element",
    "data_point": "section.field reference",
    "measurement": "if measurable"
  },
  "category": "CRO category (e.g., 'trust', 'friction', 'clarity', 'flow')",
  "recommendation": "specific actionable fix",
  "suggested_investigation": null | "description of interaction to verify (for consultant)"
}]
```

**REQ-COMP-041:** Pass 2 runs AFTER Pass 1 evaluate completes but BEFORE self-critique. This ordering means:
1. Pass 1 evaluate → produces `raw_findings[]`
2. Pass 2 open observation → produces `open_observations[]`
3. Self-critique reviews ALL findings (Pass 1 raw_findings + Pass 2 open observations converted to RawFinding format) in one batched call
4. Evidence grounding runs on all surviving findings

Pass 2 receives Pass 1's raw findings summary (heuristic IDs + violation/pass status) to avoid duplication, but does NOT wait for self-critique or grounding of Pass 1 findings.

**REQ-COMP-042:** Pass 2 observations are grounded through the same pipeline as Pass 1 findings but with distinct treatment:
- They get a synthetic `heuristic_id` of `OPEN-OBS-{NNN}` (not from the KB)
- **GR-005 (heuristic ID validity) is SKIPPED** for open observations — the synthetic ID is not in the KB by design
- GR-001 (element exists), GR-007 (no conversion prediction), GR-008 (valid data_point section) are applied normally
- GR-002..GR-004, GR-006 are applied but rejection is downgraded to a `needs_review` flag (relaxed, since open observations are always consultant-reviewed)
- Confidence tier is ALWAYS `low` regardless of evidence quality
- Auto-publish is ALWAYS `false`
- `needs_consultant_review` is ALWAYS `true`
- They carry `source: "open_observation"` for learning service tracking

**REQ-COMP-042a:** The grounding function detects open observations and routes them through the relaxed pipeline:

```typescript
function isOpenObservation(finding: ReviewedFinding): boolean {
  return finding.heuristic_id.startsWith("OPEN-OBS-") ||
         finding.source === "open_observation";
}

// In groundFindings() (§7.7), replace GR-005 check:
if (!validHeuristicIds.has(finding.heuristic_id)) {
  if (isOpenObservation(finding)) {
    // Skip GR-005 for open observations — synthetic ID is expected
  } else {
    rejected.push({ ...finding, rejection_reason: `Unknown heuristic_id`, rejected_by: "GR-005" });
    continue;
  }
}
```

**REQ-COMP-043:** Pass 2 is controlled by a feature flag (`dual_mode_evaluation: boolean`, default `true`). Setting it to `false` skips Pass 2 entirely — useful for budget-constrained audits.

---

## 33.9 Two Operating Modes

**REQ-COMP-050:** The composition model supports two modes, selectable per audit:

### Unified Interactive Mode (Default, Quality-Optimised)

| Aspect | Specification |
|---|---|
| **Browser tools during analysis** | Yes — 9 injected tools available |
| **Interactive CoT** | Yes — LLM may interact during evaluate |
| **Pass 2 open observation** | Yes |
| **State exploration (§20)** | Yes — pre-captures known disclosure patterns |
| **State-aware analysis (§31)** | Yes — global + per_state + transition scopes |
| **Interaction budget** | Standard: 5 interactions/page, Deep: 15 interactions/page |
| **Cost** | ~$0.50-1.50/page (standard), ~$1.00-3.00/page (deep) |
| **Use case** | Default for all audits. Maximum finding quality. |

### Static-Only Mode (Budget-Optimised)

| Aspect | Specification |
|---|---|
| **Browser tools during analysis** | No — analysis receives perception data only |
| **Interactive CoT** | No — single-shot evaluate (§7.5 original) |
| **Pass 2 open observation** | No |
| **State exploration (§20)** | Optional (configurable, default off) |
| **State-aware analysis (§31)** | Global scope only (per_state and transition require state exploration) |
| **Interaction budget** | 0 |
| **Cost** | ~$0.20-0.35/page (unchanged from §11.5) |
| **Use case** | Budget-constrained audits. Quick scans. Re-audits where interactive findings already exist. |

**REQ-COMP-051:** Mode selection is per-audit via `AuditRequest.composition_mode`:

```typescript
export type CompositionMode = "interactive" | "static";

// In AuditRequest (§18):
composition_mode: CompositionMode;  // default: "interactive"
interaction_depth: "standard" | "deep";  // default: "standard"
dual_mode_evaluation: boolean;  // default: true (Pass 2 enabled)
```

**REQ-COMP-052:** Static mode is functionally equivalent to the pre-§33 architecture. All existing tests, prompts, and pipelines work unchanged in static mode. Interactive mode is a superset.

---

## 33.10 Interaction Budget and Drift Mitigation

### Interaction Budget

**REQ-COMP-060:**

| Constraint | Standard Mode | Deep Mode | Static Mode |
|---|---|---|---|
| Max interactions per page (evaluate) | 5 | 15 | 0 |
| Max interactions per heuristic | 2 | 3 | 0 |
| Max LLM turns per evaluate loop | 20 | 40 | 1 |
| Interaction budget USD per page | $0.30 | $1.00 | $0.00 |
| State restoration after analysis | Required | Required | Not needed |

**REQ-COMP-060a — Budget reality check:** With ~15-20 filtered heuristics per page and a per-heuristic cap of 2, the theoretical demand is 30-40 interactions. But the page cap is 5 (standard) or 15 (deep). This is intentional:

- **Standard mode:** ~80% of heuristics are evaluated from static data alone. The LLM allocates its 5 interactions to the 2-3 heuristics where static data is most insufficient (e.g., variant selection behavior, form validation states, hidden disclosure content). The evaluate prompt explicitly tells the LLM to prioritize: *"You have 5 interactions for this page. Use them on heuristics where the static data is clearly insufficient. Most heuristics can be evaluated from the perception data alone."*

- **Deep mode:** ~25-50% of heuristics may receive interaction. The LLM has more room to test variant selectors, form edge cases, and disclosure patterns that §20 missed.

- **Static mode:** 100% of heuristics evaluated from perception data only. Equivalent to pre-§33 architecture.

### Runtime Impact

**REQ-COMP-060b:** Each browser interaction adds latency (click + DOM stability wait + optional re-perception):

| Operation | Latency | Notes |
|---|---|---|
| `browser_click` + stability wait | ~1-3s | MutationObserver wait (§6.6) |
| `browser_select` + stability wait | ~1-3s | Dropdown interaction + DOM update |
| `browser_type` (short text) | ~1-2s | Gaussian typing delay (§6.11) |
| `browser_get_state` (re-perception) | ~50-200ms | AX-tree extraction |
| `page_analyze` (full re-perception) | ~200-500ms | Full DOM traversal |
| `browser_screenshot` | ~100-300ms | JPEG compression |

**Per-page runtime overhead:**

| Mode | Interactions | Estimated Overhead | Notes |
|---|---|---|---|
| Static | 0 | 0s | Unchanged from pre-§33 |
| Standard | ~5 | ~5-15s per page | 50-150s for 10-page audit |
| Deep | ~15 | ~15-45s per page | 150-450s (2.5-7.5 min) for 10-page audit |

These estimates are ADDITIONAL to the existing analysis time (~3-8s for LLM evaluate + ~2-3s for self-critique per page). The total per-page time including interactions:

| Mode | Total Analysis Time/Page |
|---|---|
| Static | ~6-12s |
| Standard | ~11-27s |
| Deep | ~21-57s |

### Focus Drift Mitigation

**REQ-COMP-061:** The interactive evaluate prompt is heuristic-first — the LLM evaluates heuristics in order, not explore-then-evaluate. This prevents unbounded curiosity:

```
For each heuristic in the list:
  1. Read the heuristic
  2. Check if static data is sufficient
  3. If not, interact (max 2 times for THIS heuristic)
  4. Produce the finding
  5. Move to next heuristic

Do NOT explore the page freely. Do NOT investigate interesting things
unrelated to the current heuristic. Each interaction must serve the
heuristic currently being evaluated.
```

**REQ-COMP-062:** Per-heuristic interaction cap (2 standard, 3 deep) is enforced by the evaluate node, not the LLM.

**Tracking mechanism:** The evaluate node maintains a `current_heuristic_id` pointer. The pointer advances when the LLM calls `produce_finding`, `mark_heuristic_pass`, or `mark_heuristic_needs_review`. All browser interactions between two finding/pass/review calls are attributed to `current_heuristic_id`.

```typescript
class HeuristicInteractionTracker {
  private current_heuristic_id: string | null = null;
  private counts: Map<string, number> = new Map();
  private readonly cap: number;  // 2 for standard, 3 for deep

  constructor(heuristics: Heuristic[], cap: number) {
    this.cap = cap;
    // Initialize with first heuristic in the list
    if (heuristics.length > 0) {
      this.current_heuristic_id = heuristics[0].id;
    }
  }

  // Called when LLM produces a finding, pass, or needs_review
  advanceHeuristic(heuristicId: string): void {
    this.current_heuristic_id = heuristicId;
  }

  // Called before executing a browser tool — returns whether allowed
  canInteract(): { allowed: boolean; reason?: string } {
    if (!this.current_heuristic_id) {
      return { allowed: true };  // no tracking before first heuristic
    }
    const count = this.counts.get(this.current_heuristic_id) || 0;
    if (count >= this.cap) {
      return {
        allowed: false,
        reason: `Interaction budget for ${this.current_heuristic_id} reached (${this.cap}/${this.cap}). Evaluate from available evidence.`
      };
    }
    return { allowed: true };
  }

  // Called after successfully executing a browser tool
  recordInteraction(): void {
    if (!this.current_heuristic_id) return;
    const count = this.counts.get(this.current_heuristic_id) || 0;
    this.counts.set(this.current_heuristic_id, count + 1);
  }
}
```

**REQ-COMP-062a:** The LLM MUST call `produce_finding`, `mark_heuristic_pass`, or `mark_heuristic_needs_review` for each heuristic before moving to the next. The evaluate prompt reinforces this:

```
IMPORTANT: After evaluating each heuristic, you MUST call one of:
- produce_finding() — if violation or needs_review
- mark_heuristic_pass() — if the heuristic passes
- mark_heuristic_needs_review() — if you can't determine

This signals that you're moving to the next heuristic.
Your interaction budget resets per heuristic.
```

**REQ-COMP-062b:** If the LLM calls browser tools without first producing a finding for a previous heuristic (skipping the signal), the interactions are attributed to the first unresolved heuristic in the list. This is a fallback — the prompt strongly encourages sequential processing.

### Session Contamination Prevention (Workflows)

**REQ-COMP-063:** In workflow composition, the Analysis Agent's interactions are sandboxed per step:

1. **No transition actions:** Analysis cannot click "Add to Cart", "Proceed to Checkout", or any CTA that advances the funnel (REQ-COMP-023)
2. **State verification:** After analysis completes at each step, the orchestrator verifies the page state hasn't drifted from the expected funnel position using `browser_get_state()` + URL check
3. **Restoration:** If analysis interactions changed the page state in a way that affects the funnel (e.g., accidentally removed an item from cart), the orchestrator detects and logs `session_contamination` but does NOT auto-fix — it proceeds with the current state and includes the contamination event in the audit trail

**REQ-COMP-064:** Transition action detection:

```typescript
function isTransitionAction(
  toolCall: ToolCall,
  workflowContext: WorkflowContext
): boolean {
  if (!workflowContext) return false;

  const currentStep = workflowContext.steps[workflowContext.current_step_index];
  const nextStep = workflowContext.steps[workflowContext.current_step_index + 1];
  if (!nextStep) return false;

  // Check if the click target matches the known transition CTA
  if (toolCall.name === "browser_click") {
    const targetRef = toolCall.args.elementRef;
    // Match against known transition patterns for this funnel type
    const transitionPatterns = getTransitionPatterns(
      currentStep.page_type,
      nextStep.page_type,
      workflowContext.business_model
    );
    return transitionPatterns.some(p => matchesPattern(targetRef, p));
  }

  return false;
}

// Edge case: ambiguous CTAs (e.g., "Continue" could be funnel transition or content action).
// Resolution: if URL would change, it's a transition (caught by navigation guard REQ-COMP-012).
// If URL stays same, it's a page-internal action and allowed.
// The navigation guard is the ultimate backstop — transition detection is a HINT, not the gate.
```

### Post-Interaction Verification

**REQ-COMP-065:** After each browser interaction during analysis, the navigation guard Layer 2 (`verifyNoNavigation` from REQ-COMP-012) runs. This uses `origin + pathname` comparison — hash changes (`#reviews`) and query param changes (`?variant=xl`) are allowed as normal page-internal state changes. Only origin or pathname changes trigger recovery.

See `verifyNoNavigation()` in §33.4 REQ-COMP-012 for the implementation.

### Context Window Management

**REQ-COMP-066:** Interactive evaluation generates more context than static evaluation (each interaction adds tool call + result to messages). Mitigation:

1. **State-delta compression:** After each interaction, capture only what CHANGED (new elements, removed elements, changed text) rather than full `AnalyzePerception`. The LLM sees: `"After browser_select(size='XL'): CTA changed from 'Add to Cart' to 'Notify Me'. Price hidden. 5 trust signals removed."`

2. **Token budget:** Evaluate loop enforces a token budget. When approaching the limit (80% of max), the agent is told: `"Context budget nearly exhausted. Complete remaining heuristics from available evidence."`

3. **Message pruning:** Interaction results older than 5 turns are summarised to a single line each. Only the most recent 3 interaction results are kept in full.

---

## 33.11 Unified Analysis Pipeline (Post-Composition)

The analysis pipeline from §7 is extended to support interactive evaluation and dual-mode:

```
                      ┌──────────────────────┐
                      │    deep_perceive     │  Unchanged (§7.4)
                      │  + MultiStatePerception if §20 active
                      └──────────┬───────────┘
                                 │
                                 ▼
            ┌────────────────────────────────────────┐
            │         EVALUATE (enhanced)            │
            │                                        │
            │  IF interactive mode + state_graph:    │
            │    Split heuristics by analysis_scope  │
            │    ├── global → evaluate against       │
            │    │   merged_view (1 call)            │
            │    ├── per_state → evaluate per state  │
            │    │   (N calls, interactive CoT)      │
            │    └── transition → evaluate state     │
            │        pairs (M calls)                 │
            │                                        │
            │  IF interactive mode + NO state_graph: │
            │    ALL heuristics → global scope       │
            │    (REQ-COMP-038 fallback)             │
            │    Single interactive evaluate call    │
            │                                        │
            │  IF static mode:                       │
            │    Single evaluate call (§7.5 original)│
            │                                        │
            │  ReAct loop with browser tools         │
            │  (interactive mode only)               │
            └────────────────┬───────────────────────┘
                             │
                             ▼
            ┌────────────────────────────────────────┐
            │        PASS 2: Open Observation        │
            │  (interactive mode + dual_mode = true) │
            │                                        │
            │  "What did the heuristics miss?"       │
            │  Max 5 observations, always Tier 3     │
            │  Receives Pass 1 findings summary      │
            │  to avoid duplication                   │
            │  Feeds learning service (§28)          │
            └────────────────┬───────────────────────┘
                             │
                             ▼
            ┌────────────────────────────────────────┐
            │          SELF-CRITIQUE                  │
            │  Separate LLM call (§7.6, SD-07)      │
            │  Reviews ALL findings:                 │
            │    Pass 1 raw_findings +               │
            │    Pass 2 open_observations            │
            │  Single batched call                   │
            └────────────────┬───────────────────────┘
                             │
                             ▼
            ┌────────────────────────────────────────┐
            │       EVIDENCE GROUND                   │
            │  Deterministic code (§7.7)             │
            │  GR-001..GR-008 (base)                 │
            │  + GR-009 (state provenance, Phase 7+) │
            │  + GR-010 (workflow cross-step, §21)   │
            │  + GR-011 (per-state data correctness) │
            └────────────────┬───────────────────────┘
                             │
                             ▼
            ┌────────────────────────────────────────┐
            │    ANNOTATE + STORE                     │
            │  Per-state screenshots annotated        │
            │  Transition findings: before/after pair │
            │  Open observations: tagged separately   │
            └────────────────────────────────────────┘
```

---

## 33.12 GR-011 — Per-State Finding Data Correctness

**REQ-COMP-070:** New grounding rule (carried forward from §31.9):

```typescript
{
  id: "GR-011",
  description: "Per-state findings must reference data from the correct state",
  check: (finding, perception, stateGraph, multiState) => {
    if (finding.analysis_scope === "global") return { pass: true };

    if (finding.analysis_scope === "per_state") {
      if (!finding.evaluated_state_id) {
        return { pass: false, reason: "Per-state finding missing evaluated_state_id" };
      }
      const state = stateGraph?.states.find(
        s => s.state_id === finding.evaluated_state_id
      );
      if (!state) {
        return { pass: false, reason: `State ${finding.evaluated_state_id} not in graph` };
      }
      // Verify evidence element exists in THIS state's perception
      const ref = finding.evidence.element_ref;
      if (!ref) return { pass: true };
      if (!elementExistsInPerception(ref, state.perception)) {
        return { pass: false, reason: `Element "${ref}" not in state ${finding.evaluated_state_id}` };
      }
    }

    if (finding.analysis_scope === "transition") {
      if (!finding.transition) {
        return { pass: false, reason: "Transition finding missing transition data" };
      }
      // Validate before_ref in before state, after_ref in after state
      const { before_state_id, after_state_id } = finding.transition;
      const beforeState = stateGraph?.states.find(s => s.state_id === before_state_id);
      const afterState = stateGraph?.states.find(s => s.state_id === after_state_id);
      if (!beforeState || !afterState) {
        return { pass: false, reason: "Transition state(s) not found in graph" };
      }
    }

    return { pass: true };
  }
}
```

**REQ-COMP-071:** GR-011 is gated behind Phase 7+ (requires state exploration). Phase 1-6 implementations skip this rule. When `stateGraph` is null, all findings are treated as global scope and GR-011 trivially passes.

---

## 33.13 State Extensions

**REQ-COMP-080:** The following fields are added to `AuditState` (§5.7.2) for composition support:

```typescript
// === Composition (§33) ===

composition_mode: Annotation<CompositionMode>({ default: () => "interactive" as const }),
interaction_depth: Annotation<"standard" | "deep">({ default: () => "standard" as const }),
dual_mode_evaluation: Annotation<boolean>({ default: () => true }),

// Interactive evaluate tracking
analysis_interactions: Annotation<InteractionRecord[]>({
  reducer: (existing, incoming) => [...existing, ...incoming],
  default: () => []
}),
analysis_interaction_count: Annotation<number>({ default: () => 0 }),
analysis_interaction_budget: Annotation<number>({ default: () => 5 }),

// Pass 2 open observations
open_observations: Annotation<OpenObservation[]>({
  reducer: (_, incoming) => incoming,
  default: () => []
}),

// Session contamination tracking (workflow composition)
session_contamination_events: Annotation<SessionContaminationEvent[]>({
  reducer: (existing, incoming) => [...existing, ...incoming],
  default: () => []
}),
```

### Supporting Types

```typescript
export interface InteractionRecord {
  tool: string;
  args: Record<string, any>;
  result: any;
  timestamp: number;
  phase: "browse" | "analysis";
  heuristic_id?: string;        // which heuristic triggered this interaction
  screenshot_ref?: string;      // R2 key if browser_screenshot was called after this interaction
}

// REQ-COMP-080a: Interaction screenshots are stored in R2 alongside
// page-level screenshots. Key format: {audit_run_id}/{page_url_hash}/
// interaction_{timestamp}_{heuristic_id}.jpg
// The annotate_and_store node (§7.8) is extended to:
// 1. Collect all InteractionRecords with non-null screenshot_ref
// 2. Store them in the finding's evidence_screenshots[] array
// 3. The consultant dashboard displays these as "interaction evidence"
//    alongside the default-state annotated screenshot

export interface OpenObservation {
  id: string;                    // OPEN-OBS-{NNN}
  observation: string;
  evidence: {
    element_ref: string | null;
    data_point: string;
    measurement: string | null;
  };
  category: string;
  recommendation: string;
  suggested_investigation: string | null;  // "click X to verify" — for consultant
  source: "open_observation";
  confidence_tier: "low";        // always
  needs_consultant_review: true;  // always
}

export interface SessionContaminationEvent {
  workflow_id: string;
  step_index: number;
  tool_call: string;
  expected_state: string;
  actual_state: string;
  timestamp: number;
}
```

### Invariants

**REQ-COMP-INV-001:** `analysis_interaction_count` SHALL NEVER exceed `analysis_interaction_budget`.

**REQ-COMP-INV-002:** If `composition_mode === "static"`, then `analysis_interaction_count` SHALL be 0 and `analysis_interactions` SHALL be empty.

**REQ-COMP-INV-003:** If `dual_mode_evaluation === false`, then `open_observations` SHALL be empty.

**REQ-COMP-INV-004:** `open_observations.length` SHALL NOT exceed 5.

**REQ-COMP-INV-005:** Every `OpenObservation` SHALL have `confidence_tier === "low"` and `needs_consultant_review === true`.

---

## 33.14 Cost Model

### Per-Page Cost Breakdown

| Component | Static Mode | Interactive Standard | Interactive Deep |
|---|---|---|---|
| Browse (navigate + stabilise) | ~$0.10 | ~$0.10 | ~$0.10 |
| State exploration (§20) | $0.00 | ~$0.15 | ~$0.30 |
| deep_perceive | ~$0.05 | ~$0.05 | ~$0.05 |
| Evaluate (Pass 1, heuristic-driven) | ~$0.15 | ~$0.25-0.60 | ~$0.40-1.20 |
| Evaluate (Pass 2, open observation) | $0.00 | ~$0.05 | ~$0.05 |
| Self-critique | ~$0.05 | ~$0.08 | ~$0.10 |
| Evidence grounding | ~$0.00 | ~$0.00 | ~$0.00 |
| Annotation | ~$0.00 | ~$0.00 | ~$0.00 |
| **Total per page** | **~$0.35** | **~$0.68-1.03** | **~$1.00-1.80** |

### Per-Audit Cost (10 pages)

| Mode | Cost | Findings Quality |
|---|---|---|
| Static | ~$3.50 | Baseline — catches static-state issues |
| Interactive Standard | ~$6.80-10.30 | High — catches state-dependent + hidden content issues |
| Interactive Deep | ~$10.00-18.00 | Maximum — thorough exploration + deep evaluation |

**Cross-reference:** Budget enforcement for all composition costs uses the same `BudgetEnforcer` framework from §11.6 and §26 (Cost & Guardrails). Per-page and per-audit budgets from §26 apply. Interactive mode costs are tracked under the page budget. When the page budget is exceeded mid-evaluate, the evaluate loop exits and produces findings from already-evaluated heuristics.

### Cost Mitigation (from §31.7, carried forward)

1. **Selective per-state evaluation:** Not all heuristics apply to all states. Filter by state relevance.
2. **Skip default-identical states:** If >90% text Jaccard similarity, skip per-state evaluation.
3. **Batch per-state calls:** One LLM call per state with all relevant heuristics.
4. **Rule heuristics skip LLM:** Deterministic detectors run at $0 per state.
5. **Interaction budget enforcement:** Hard caps prevent runaway costs.

---

## 33.15 Orchestrator Integration

### Updated Audit Orchestrator Graph (§4 extended)

```typescript
// Extended from §4.4 REQ-ORCH-SUBGRAPH-001
const auditGraph = new StateGraph(AuditState)
  .addNode("audit_setup", auditSetupNode)
  .addNode("page_router", pageRouterNode)
  .addNode("browse", browseGraph)
  .addNode("analyze", analyzeGraph)           // now uses interactive evaluate
  .addNode("restore_state", restoreStateNode)  // NEW: restore page after analysis
  .addNode("audit_complete", auditCompleteNode)

  .addEdge("__start__", "audit_setup")
  .addEdge("audit_setup", "page_router")
  .addConditionalEdges("page_router", routePageRouter, {
    browse: "browse",
    audit_complete: "audit_complete",
  })
  .addConditionalEdges("browse", routeAfterBrowse, {
    analyze: "analyze",
    page_router: "page_router",
  })
  .addEdge("analyze", "restore_state")        // always restore after analysis
  .addConditionalEdges("restore_state", routeAfterRestore, {
    page_router: "page_router",
    audit_complete: "audit_complete",
  })
  .addEdge("audit_complete", END)

  .compile({ checkpointer: postgresCheckpointer });
```

### Node: `restore_state`

**REQ-COMP-090:**

| | |
|---|---|
| **Input** | Browser session, `composition_mode`, `analysis_interaction_count` |
| **Output** | Page restored to default state (or reload if restoration fails) |
| **Process** | 1. If `composition_mode === "static"` OR `analysis_interaction_count === 0`: skip (no restoration needed) |
| | 2. `browser_reload()` — simplest, most reliable restoration |
| | 3. Wait for page stabilisation (MutationObserver, §6.6) |
| | 4. Verify: `browser_get_state()` URL matches expected |
| **Timeout** | 10s. If restoration exceeds timeout, log `restoration_timeout` and proceed. |
| **Failure** | If URL changed after reload (redirect), navigate back to `current_url`. If still fails, log `restoration_failed`. |

---

## 33.16 Absorbed Sections

### §31 State-Aware Analysis — Absorbed

§31 introduced three heuristic analysis scopes (global, per_state, transition). These are now integrated into the composition model:

| §31 Concept | §33 Location |
|---|---|
| Three analysis scopes | §33.11 (evaluate node, scope split) |
| Per-state evaluation | §33.11 (evaluate node scope split: per_state → evaluate per state with interactive CoT) |
| Transition evaluation | §33.11 (evaluate node, transition scope) |
| StateDiff computation | Unchanged — deterministic diff before LLM call |
| GR-011 | §33.12 |
| Cost mitigation | §33.14 |
| Heuristic `analysis_scope` field | Unchanged from §31.10 (§9.10.2 extension) |

**§31 is retained in `31-state-aware-analysis.md` with a header note: "Superseded by §33 — Agent Composition Model. Retained for reference."**

### §32 Interactive Analysis — Absorbed

§32 introduced browser tool injection during the evaluate phase. This is now the core of the composition model:

| §32 Concept | §33 Location |
|---|---|
| Tool injection | §33.4 (tool injection matrix) |
| Interactive evaluate node (ReAct loop) | §33.7 (interactive CoT), §33.11 (pipeline) |
| Safety classification during analysis | §33.4 (REQ-COMP-011, REQ-COMP-012) |
| Interaction budget | §33.10 |
| State restoration | §33.15 (restore_state node) |
| REQ-LAYER-005 (v3) | §33.5 |
| Finding evidence with interaction context | §33.13 (InteractionRecord, OpenObservation types) |

**§32 is retained in `32-interactive-analysis.md` with a header note: "Superseded by §33 — Agent Composition Model. Retained for reference."**

---

## 33.17 Failure Modes

| # | Failure | Detection | Response |
|---|---|---|---|
| **CM-01** | LLM clicks link that navigates away during analysis | URL change detected (REQ-COMP-012) | BLOCKED pre-execution. Agent told: "Navigation blocked during analysis." |
| **CM-02** | LLM attempts form submission during analysis | Safety gate: sensitive action (REQ-COMP-011) | BLOCKED. Agent told: "Form submission blocked during analysis." |
| **CM-03** | Interaction budget exhausted early (first 2 heuristics) | `analysis_interaction_count >= budget` | Agent told: "Budget exhausted. Evaluate remaining heuristics from static data." |
| **CM-04** | LLM enters infinite interaction loop | Message count > LLM turn cap (20/40) | Force exit. Produce findings from evaluated heuristics. |
| **CM-05** | Interaction crashes the page | Page unresponsive | `browser_reload()`. Mark current heuristic as `needs_review`. Continue with remaining. |
| **CM-06** | Page state unchanged after interaction | DOM hash comparison | Agent told: "Interaction had no visible effect." Skip. |
| **CM-07** | Session contamination in workflow | State verification after analysis (REQ-COMP-063) | Log `session_contamination_event`. Proceed with current state. |
| **CM-08** | State restoration fails after analysis | Reload timeout (10s) | Force navigation to URL. If still fails, log `restoration_failed`. |
| **CM-09** | Pass 2 duplicates Pass 1 findings | Post-processing dedup by evidence similarity | Remove duplicates. Keep Pass 1 version (higher confidence). |
| **CM-10** | Context window exceeded during interactive evaluate | Token count > 80% of model limit | Force exit evaluate loop. Complete with available findings. |
| **CM-11** | Analysis agent performs transition action in workflow | Transition detection (REQ-COMP-064) | BLOCKED pre-execution. Agent told: "This action would advance the funnel. Only the workflow orchestrator performs transitions." |
| **CM-12** | Open observation references non-existent element | GR-001 check | Observation rejected. Logged. |
| **CM-13** | LLM presses Enter while form field focused (form submission attempt) | `classifyPressKey()` detects Enter + form context (REQ-COMP-011a) | BLOCKED. Agent told: "Enter key blocked — focused element is inside a form." |
| **CM-14** | Pre-execution nav guard misclassifies element (JS listener on non-anchor) | Layer 1 passes, Layer 2 catches post-click URL change | goBack() recovery. Agent warned. Interaction counted against budget. |
| **CM-15** | Workflow funnel state lost after analysis restore (reload empties cart) | `verifyFunnelState()` detects empty cart/missing form (REQ-COMP-022a) | Workflow marked `abandoned: funnel_state_lost_after_restore`. Analyse available steps. |
| **CM-16** | LLM re-explores states already captured by §20 (redundant interaction) | Not blocked in real-time (budget absorbs cost) | §20 states are provided in prompt context (REQ-COMP-036) to discourage. Audit trail flags overlap for tuning. |

---

## 33.18 Implementation Phase Mapping

| Phase | Deliverable |
|---|---|
| **7 (Analysis Pipeline)** | Static-mode composition (§33.9 static mode). Pipeline unchanged from §7. Composition is transparent — static mode = current architecture. |
| **8 (Orchestrator)** | `restore_state` node. Composition mode selection in `AuditRequest`. `composition_mode` state field. |
| **9 (Competitor + Workflow)** | Workflow-level composition (Level 3, §33.6). Transition action detection (REQ-COMP-064). Session contamination tracking. |
| **10 (Client Management)** | Interactive evaluate node. Tool injection. Interactive CoT. Interaction budget enforcement. Focus drift mitigation. |
| **10** | Dual-mode evaluation (Pass 1 + Pass 2). Open observation pipeline. |
| **11 (Delivery)** | Consultant dashboard: interaction log per finding ("the agent clicked X and saw Y"). Per-state screenshots in finding detail view. |
| **12 (Production)** | Deep mode. Learning service integration for open observations → heuristic crystallisation. |

---

## 33.19 Backward Compatibility

**REQ-COMP-COMPAT-001:** Static mode (§33.9) is functionally identical to the pre-§33 architecture. All Phase 1-7 implementations operate in static mode by default. Interactive mode activates only when explicitly enabled.

**REQ-COMP-COMPAT-002:** The `analysis_scope` field from §31 defaults to `"global"`. Existing heuristics without this field evaluate against the merged view — identical to pre-§33 behavior.

**REQ-COMP-COMPAT-003:** REQ-LAYER-005 (v3) is backward-compatible: if `composition_mode === "static"`, analysis never touches browser tools, which satisfies the original REQ-LAYER-005 (v1).

**REQ-COMP-COMPAT-004:** All §33 state fields (§33.13) have defaults. Phase 1-7 implementations leave them at defaults. No existing node interfaces change.

---

## 33.20 Design Decisions Summary

| # | Decision | Rationale |
|---|---|---|
| D1 | Composition, not merge | Browser Agent is reusable beyond CRO. Analysis Agent is CRO-specific. Merging loses reusability. |
| D2 | Tool injection, not message bus | Direct tool access is simpler, faster, and cheaper than orchestrator-mediated message passing. |
| D3 | Shared browser session | Separate sessions waste resources and can't share cookies/state. One session, two consumers. |
| D4 | Navigation tools excluded from analysis | Analysis evaluates a page — it doesn't decide WHERE to go. Navigation is the orchestrator's job. |
| D5 | Interactive CoT as prompting technique | Not a separate graph node. Keeps the 5-step pipeline clean. The LLM decides whether to interact. |
| D6 | Dual-mode evaluation (heuristic + open) | Structured heuristics catch known patterns. Open observation catches novel issues. Together: comprehensive. |
| D7 | Open observations always Tier 3 | Unstructured findings lack the evidence chain for auto-publishing. Consultant review is mandatory. |
| D8 | Per-heuristic interaction cap | Prevents the LLM from spending all interactions on one interesting finding and neglecting others. |
| D9 | Workflow transition actions excluded from analysis | Prevents analysis from accidentally advancing the funnel (session contamination). |
| D10 | State restoration via reload | Simpler and more reliable than trying to undo each interaction individually. |
| D11 | Open observations feed learning service | The learning loop: open observation → consultant approval → new heuristic. The system gets smarter. |

---

**End of §33 — Agent Composition Model**

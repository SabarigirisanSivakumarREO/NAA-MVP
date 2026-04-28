---
title: 32-interactive-analysis
artifact_type: architecture-spec
status: superseded
supersededBy: 33-agent-composition-model.md
supersedes: 32-collaborative-agent-protocol.md
loadPolicy: do-not-load
version: 2.3
updated: 2026-04-28
governing_rules:
  - Constitution R17 (Lifecycle States)
  - Constitution R22 (The Ratchet)
note: SUPERSEDED. Do not implement from this file. The concepts here (browser tool injection during evaluate, ReAct loop, safety classification, interaction budget, state restoration) are absorbed into §33 — Agent Composition Model. Retained for historical reference only.
---

# Section 32 — Interactive Analysis (Supersedes previous §32 draft)

**Status:** Architectural extension. Solves: the analysis agent is blind to dynamic page content because it cannot interact with the browser.

> **Superseded by §33 — Agent Composition Model.** The concepts in this section (browser tool injection during evaluate, ReAct loop, safety classification, interaction budget, state restoration) are absorbed into §33. This file is retained for reference. Implementers should read §33 instead.

---

## 32.1 The Problem in One Sentence

The analysis agent receives a static snapshot and evaluates it once. But 30-60% of a modern page's content only exists after interaction — and the agent can't interact.

### Specific scenarios the current architecture CANNOT handle

| Page element | What's hidden | Why the static snapshot misses it |
|---|---|---|
| PDP size selector | Selecting "XL" → "Out of Stock" + price hidden + CTA changes | Snapshot only sees default size state |
| PDP color variant | Selecting "Red" → different product images + different price | Snapshot only sees default variant |
| Checkbox "Gift wrap" | Checking it → reveals gift message form + adds $5 to total | Snapshot shows unchecked state only |
| Radio button "Express shipping" | Selecting it → shows delivery date + changes total | Snapshot shows default shipping |
| "Show more" button | Clicking → reveals 10 more reviews | Snapshot shows truncated reviews |
| Form field focus | Focusing on email → shows inline hint "We'll never share your email" | Snapshot shows empty hint area |
| Quantity change | Setting qty to 0 → shows error "Minimum 1" | Snapshot shows qty=1 (no error) |
| Gallery navigation | Clicking image 3 → shows video, not photo | Snapshot shows image 1 |
| Sticky CTA on scroll | Scrolling past fold → sticky "Buy Now" bar appears | Snapshot doesn't scroll |
| Error states | Submitting invalid data → error messages with specific text | Snapshot shows clean form |
| Dropdown filter on PLP | Selecting "Price: Low to High" → products reorder | Snapshot shows default sort |
| Nested accordion | Opening "Warranty" inside "Product Details" accordion | §20 explores depth 1, not depth 2 |

### Why §20 State Exploration doesn't fully solve this

§20 pre-captures states using a rule library + heuristic-primed approach. It handles the PREDICTABLE interactions: tabs, accordions, `<details>` elements, obvious modals.

But §20 cannot anticipate:
- Which specific form values reveal hidden content
- Which variant/filter combinations produce meaningful state changes
- Which checkboxes/radios trigger dynamic content
- Content that only appears after multi-step interaction sequences
- Page behaviors that are business-logic-dependent (e.g., "out of stock" only for specific sizes)

**§20 handles the 80% — predictable disclosure patterns. This section handles the remaining 20% — ad-hoc interactions that the analysis agent identifies as necessary during evaluation.**

---

## 32.2 The Solution

**Give the analysis agent direct access to a subset of browser interaction tools during the evaluate phase.** The agent can interleave evaluation and interaction in a single reasoning loop.

No protocol. No message bus. No orchestrator routing. The browser session stays open. The analysis agent calls browser tools directly.

```
CURRENT (static, single-shot):

  evaluate(perception, heuristics) → findings[]

  LLM sees: static data
  LLM can: produce findings
  LLM cannot: interact with the page


NEW (interactive, multi-turn):

  evaluate_interactive(perception, heuristics, browser_tools) → findings[]

  LLM sees: static data + browser tools
  LLM can: produce findings OR interact with page, then produce findings
  LLM cannot: navigate away from page, trigger sensitive actions
```

---

## 32.3 What Tools the Analysis Agent Gets

### Included (interaction + observation subset)

| Tool | Why analysis needs it |
|---|---|
| `browser_click` | Click tabs, accordions, checkboxes, radio buttons, CTAs, "show more" buttons, gallery arrows |
| `browser_hover` | Reveal tooltips, dropdown previews, hover states |
| `browser_select` | Change dropdowns: size, variant, quantity, sort order, filters |
| `browser_type` | Fill form fields to trigger validation, test search, enter values |
| `browser_press_key` | Press Enter (submit), Escape (close modal), Tab (focus next) |
| `browser_scroll` | Scroll to reveal lazy-loaded content, trigger sticky elements |
| `browser_get_state` | Fresh perception after interaction |
| `browser_screenshot` | Capture evidence of dynamic state |
| `browser_find_by_text` | Locate elements by visible text |

### Excluded (navigation + sensitive)

| Tool | Why excluded |
|---|---|
| `browser_navigate` | Analysis stays on current page. No URL changes. |
| `browser_go_back` / `go_forward` | No navigation history manipulation. |
| `browser_tab_manage` | No opening/closing tabs. |
| `browser_download` / `browser_upload` | Not relevant to analysis. |
| `browser_evaluate` | JS execution restricted for safety. |
| `agent_request_human` | Analysis doesn't escalate to HITL — browse agent handles that. |

### Safety classification still applies

Every browser tool call during analysis goes through the same safety check as during browsing:
- `browser_click` → caution (logged)
- `browser_type` → caution (logged)
- `browser_select` → caution (logged)
- form submit (Enter on form) → sensitive → **BLOCKED during analysis**
- `browser_get_state`, `browser_screenshot` → safe

**REQ-IA-001:** The analysis agent CANNOT trigger sensitive actions. No form submissions with real data, no purchases, no uploads. It can fill fields (to trigger validation UI) but cannot submit forms. If it presses Enter on a form, the safety gate blocks it.

**REQ-IA-002:** The analysis agent CANNOT navigate away from the current page. `browser_navigate`, `browser_go_back`, `browser_go_forward` are NOT in its tool set. If a `browser_click` on a link would navigate away (detected by the tool), the action is blocked and the agent is told: "This click would navigate to a different page. Use the default state or request a separate audit for that URL."

---

## 32.4 The Interactive Evaluate Node

### LangGraph node change

The evaluate node becomes a **ReAct loop** instead of a single LLM call:

```typescript
async function evaluateInteractive(
  state: AuditState,
  perception: AnalyzePerception,
  heuristics: HeuristicExtended[],
  browserSession: BrowserSession,        // browser session stays open
): Promise<Partial<AuditState>> {

  // Build tool set: analysis tools + browser subset
  const tools = [
    // Analysis output tools
    produceFindingTool,                   // structured finding output
    markHeuristicPassTool,                // heuristic passes
    markHeuristicNeedsReviewTool,         // uncertain

    // Browser interaction tools (subset)
    browserClickTool,
    browserHoverTool,
    browserSelectTool,
    browserTypeTool,
    browserPressKeyTool,
    browserScrollTool,
    browserGetStateTool,
    browserScreenshotTool,
    browserFindByTextTool,
  ];

  // ReAct loop with budget
  const maxInteractions = state.analysis_interaction_budget ?? 10;
  let interactionCount = 0;
  const findings: RawFinding[] = [];
  const interactionLog: InteractionRecord[] = [];

  const messages = [
    systemPrompt,                         // analysis + interaction instructions
    userMessage(perception, heuristics),  // page data + heuristics
  ];

  while (true) {
    const response = await llmAdapter.invoke(messages, tools, { temperature: 0 });
    messages.push(response);

    // Process tool calls
    for (const toolCall of response.tool_calls ?? []) {
      if (toolCall.name === "produce_finding") {
        findings.push(toolCall.args);
        messages.push(toolResult(toolCall, { recorded: true }));

      } else if (toolCall.name === "mark_heuristic_pass") {
        findings.push({ ...toolCall.args, status: "pass" });
        messages.push(toolResult(toolCall, { recorded: true }));

      } else if (isBrowserTool(toolCall.name)) {
        // Budget check
        if (interactionCount >= maxInteractions) {
          messages.push(toolResult(toolCall, {
            error: `Interaction budget exhausted (${maxInteractions} max). Evaluate remaining heuristics with available evidence.`
          }));
          continue;
        }

        // Safety check
        const safety = classifyAction(toolCall.name, toolCall.args);
        if (safety === "sensitive" || safety === "blocked") {
          messages.push(toolResult(toolCall, {
            error: `Action blocked: ${toolCall.name} is ${safety} during analysis. Cannot submit forms or navigate away.`
          }));
          continue;
        }

        // Navigation check
        if (wouldNavigateAway(toolCall, state.current_url)) {
          messages.push(toolResult(toolCall, {
            error: `Action blocked: this would navigate away from ${state.current_url}. Analysis stays on current page.`
          }));
          continue;
        }

        // Execute browser tool
        const result = await executeBrowserTool(browserSession, toolCall);
        messages.push(toolResult(toolCall, result));
        interactionCount++;
        interactionLog.push({
          tool: toolCall.name,
          args: toolCall.args,
          result: result,
          timestamp: Date.now(),
          phase: "analysis",
        });

      } else {
        // Unknown tool
        messages.push(toolResult(toolCall, { error: "Unknown tool" }));
      }
    }

    // Exit conditions
    if (!response.tool_calls || response.tool_calls.length === 0) break;  // LLM done
    if (findings.length >= heuristics.length) break;  // all heuristics evaluated
    if (messages.length > 100) break;  // token safety cap
  }

  return {
    raw_findings: findings,
    analysis_interactions: interactionLog,
    analysis_interaction_count: interactionCount,
  };
}
```

### What this looks like in practice

**Heuristic:** BAY-PRODUCT-007 — "Product variant selection provides clear feedback"

```
LLM thinks: "The page has a size selector dropdown. Let me check what happens
             when I change the size."

LLM calls:  browser_select({ elementRef: "size-dropdown", value: "XL" })
Result:     { success: true }

LLM calls:  browser_get_state()
Result:     {
              ctas: [{ text: "Notify Me", type: "secondary", ... }],  // was "Add to Cart"
              trustSignals: [],                                         // was 5 signals
              textContent: { paragraphs: [{ text: "Currently Unavailable" }] }
            }

LLM calls:  browser_screenshot({ quality: 85 })
Result:     { imageBase64: "..." }  // captures the "out of stock" state

LLM calls:  produce_finding({
              heuristic_id: "BAY-PRODUCT-007",
              status: "violation",
              observation: "Selecting size 'XL' changes the page significantly:
                CTA changes from 'Add to Cart' to 'Notify Me',
                price disappears, trust signals hidden,
                'Currently Unavailable' text appears.",
              assessment: "The variant selection provides no WARNING before the user
                selects an unavailable size. The state change is abrupt and removes
                purchase-critical information (price, trust signals).",
              evidence: {
                element_ref: "size-dropdown",
                data_point: "ctas[0].text changed from 'Add to Cart' to 'Notify Me'",
                measurement: "5 trust signals removed, price hidden",
                interaction_path: [{ type: "select", target: "size-dropdown", value: "XL" }]
              },
              severity: "high",
              recommendation: "Show stock availability per variant BEFORE selection.
                Gray out unavailable sizes. If selected, keep price visible
                (crossed out) and show expected restock date."
            })
```

**Without interactive analysis:** "Size selector present. Pass." (the static snapshot shows default size = in stock)
**With interactive analysis:** "Selecting XL reveals a broken experience — no warning, price disappears, trust signals removed." (the agent tested it)

---

## 32.5 System Prompt for Interactive Analysis

```
You are a CRO analyst evaluating a web page against usability heuristics.
You have access to both analysis and browser interaction tools.

METHODOLOGY:
For each heuristic:
1. OBSERVE: Review the page data provided
2. ASSESS: Can you evaluate this heuristic from the static data alone?
   - If YES: produce the finding immediately
   - If NO: interact with the page to reveal the information you need
3. INTERACT (if needed): Use browser tools to click, select, hover, type, scroll
4. RE-OBSERVE: Call browser_get_state() after interaction to see the result
5. EVALUATE: Now produce the finding with full evidence

WHEN TO INTERACT:
- Tabs/accordions that might contain CRO-relevant content (reviews, shipping, specs)
- Variant selectors (size, color, material) that might change availability or price
- Checkboxes/radios that reveal additional form fields or content
- "Show more" / "Read more" buttons hiding content
- Dropdowns that change page state (sort, filter)
- Form fields that show inline validation or hints on focus/input
- Gallery/carousel navigation to see all product images
- Scroll to check for sticky elements, lazy-loaded content

WHEN NOT TO INTERACT:
- Navigation links that would leave the page (BLOCKED)
- Form submission with real data (BLOCKED — you can fill fields but not submit)
- Purchase/checkout actions (BLOCKED)
- Content already visible in the static data (wasteful)
- Interactions unrelated to the heuristic being evaluated (off-topic)

RULES:
- Maximum {{max_interactions}} interactions per page
- After each interaction, call browser_get_state() to see the result
- Include your interaction in the finding's evidence (interaction_path)
- Capture a screenshot if the interaction reveals something important
- NEVER predict conversion impact
- NEVER reference elements that don't exist in the page data
- If budget runs out, evaluate remaining heuristics from static data

PRODUCE FINDINGS:
For each heuristic, call produce_finding() with the complete finding object.
For heuristics that clearly pass, call mark_heuristic_pass().
For heuristics you can't evaluate even after interaction, call mark_heuristic_needs_review().
```

---

## 32.6 Interaction Budget and Cost

| Constraint | Default | Max | Rationale |
|---|---|---|---|
| Interactions during analysis per page | 10 | 25 | Prevents unbounded clicking |
| Max LLM turns per evaluate loop | 30 | 50 | Token safety cap |
| Analysis interaction budget USD | $0.30 | $1.00 | Per-page cap for interaction-during-analysis |
| Interaction timeout | 5s per action | — | Single action timeout |
| State restoration after analysis | Required | — | Page must be returned to default state after analysis |

### Cost model

```
Static analysis (current):     1 LLM call × ~$0.15                    = ~$0.15/page
Interactive analysis (new):    3-8 LLM turns × ~$0.04/turn average    = ~$0.12-0.32/page
                               + browser interactions                  = ~$0 (infrastructure)
                                                                        --------
Total:                                                                  ~$0.15-0.35/page
```

**Cost increase: 0-2x over static analysis.** Much cheaper than §32's protocol approach because there's no orchestrator overhead, no request/response serialization, no separate browser sessions.

---

## 32.7 Relationship to §20 and §31

### Three layers of page understanding — each complementary

```
LAYER 1: STATE EXPLORATION (§20)
  When: BEFORE analysis
  What: Systematically discovers KNOWN disclosure patterns
  How: Rule library (12 rules) + heuristic preferred_states
  Coverage: Tabs, accordions, <details>, modals, basic variant selectors
  Cost: ~$0.15/page
  Deterministic: Yes (Pass 1), mostly (Pass 2)

  ↓ produces StateGraph + MultiStatePerception

LAYER 2: STATE-AWARE ANALYSIS (§31)
  When: DURING analysis (structured)
  What: Evaluates each pre-captured state against state-dependent heuristics
  How: Per-state LLM evaluation + transition analysis
  Coverage: State-specific issues in PRE-CAPTURED states
  Cost: ~$0.60/page
  Deterministic: No (LLM evaluation)

  ↓ produces per-state + transition findings

LAYER 3: INTERACTIVE ANALYSIS (§32 — this section)
  When: DURING analysis (ad-hoc)
  What: LLM-driven interactions for content that §20 didn't pre-capture
  How: Analysis agent calls browser tools during evaluation
  Coverage: Form interactions, variant combos, dynamic content, "show more", focus states
  Cost: ~$0.20/page additional
  Deterministic: No (LLM decides what to interact with)

  ↓ produces interaction-enriched findings
```

### Why all three are needed

| Scenario | §20 handles? | §31 handles? | §32 handles? |
|---|---|---|---|
| Open "Reviews" tab | ✅ (rule R2) | ✅ (per-state eval) | Not needed |
| Open accordion | ✅ (rule R3) | ✅ (per-state eval) | Not needed |
| Select size "XL" → out of stock | ✅ (rule R5, partially) | ✅ (transition eval) | ✅ (deeper: tries multiple sizes) |
| Check "Gift wrap" checkbox → reveals form | ❌ (not in rule library) | ❌ (not pre-captured) | ✅ |
| Focus on email field → shows hint | ❌ (not a disclosure) | ❌ (not pre-captured) | ✅ |
| Set quantity to 0 → error message | ❌ (not in rule library) | ❌ (not pre-captured) | ✅ |
| Click "Show 10 more reviews" | ❌ (might be missed) | ❌ (not pre-captured) | ✅ |
| Gallery: click to see video | ❌ (not CRO-relevant by rules) | ❌ (not pre-captured) | ✅ |
| Sort PLP by price | ✅ (rule R8) | ✅ (per-state) | Deeper: tries multiple sorts |
| Form submit empty → error quality | ✅ (rule R10) | ✅ (transition) | ✅ (tries different inputs) |
| Nested interaction (accordion inside tab) | ❌ (depth cap 2) | ❌ | ✅ |

**§20 = predictable patterns. §31 = structured evaluation. §32 = LLM curiosity.**

---

## 32.8 Integration with Existing Analysis Pipeline

### Before (current pipeline)

```
deep_perceive → evaluate (single LLM call) → self_critique → ground → score → annotate
```

### After (with interactive analysis)

```
deep_perceive → evaluate_interactive (ReAct loop with browser tools) → self_critique → ground → score → annotate
                     │
                     ├── LLM evaluates heuristic from static data → finding
                     ├── LLM decides to interact → browser_click/select/type → browser_get_state → finding
                     ├── LLM evaluates next heuristic → finding
                     ├── LLM decides to interact again → browser_select → browser_get_state → finding
                     └── ... (max N interactions)
```

### What changes in the graph

```typescript
// In AnalysisGraph.ts — only the evaluate node changes
const analysisGraph = new StateGraph(AuditState)
  .addNode("deep_perceive", deepPerceiveNode)
  .addNode("evaluate", evaluateInteractiveNode)     // ← CHANGED: now interactive
  .addNode("self_critique", selfCritiqueNode)        // unchanged
  .addNode("ground", evidenceGrounderNode)            // unchanged
  .addNode("annotate_and_store", annotateStoreNode)   // unchanged
  // ... edges unchanged
```

### What changes in the tool manifest (§8)

**REQ-IA-010:** During the evaluate phase, the analysis agent's tool set is:

| Tool | Available in evaluate? | Available in browse? |
|---|---|---|
| `browser_click` | ✅ (caution, logged) | ✅ |
| `browser_hover` | ✅ | ✅ |
| `browser_select` | ✅ (caution, logged) | ✅ |
| `browser_type` | ✅ (caution, logged) | ✅ |
| `browser_press_key` | ✅ (caution, logged) | ✅ |
| `browser_scroll` | ✅ | ✅ |
| `browser_get_state` | ✅ | ✅ |
| `browser_screenshot` | ✅ | ✅ |
| `browser_find_by_text` | ✅ | ✅ |
| `browser_navigate` | ❌ **BLOCKED** | ✅ |
| `browser_go_back/forward` | ❌ **BLOCKED** | ✅ |
| `browser_tab_manage` | ❌ **BLOCKED** | ✅ |
| `browser_download/upload` | ❌ **BLOCKED** | ✅ |
| `browser_evaluate` | ❌ **BLOCKED** | ✅ (restricted) |
| `produce_finding` | ✅ | ❌ |
| `mark_heuristic_pass` | ✅ | ❌ |
| `mark_heuristic_needs_review` | ✅ | ❌ |

### REQ-LAYER-005 (revised again)

**REQ-LAYER-005 (v3):** The analysis evaluation node MAY use browser interaction tools from the shared browser session to interact with the page during heuristic evaluation. The analysis node SHALL NOT use navigation tools (`browser_navigate`, `browser_go_back`, `browser_go_forward`, `browser_tab_manage`). The analysis node SHALL NOT trigger sensitive actions (form submission, purchases, uploads). The browser session is shared, not owned — analysis borrows it, does not manage it. After analysis completes, the orchestrator restores the page to default state before proceeding.

---

## 32.9 State Restoration After Interactive Analysis

**REQ-IA-020:** After the evaluate_interactive node completes, the page may be in a modified state (accordion open, variant selected, form partially filled). Before proceeding to the next page in the queue, the orchestrator MUST restore the page:

1. `browser_reload()` — simplest, most reliable restoration
2. Wait for page stabilisation (MutationObserver)
3. Verify: `browser_get_state()` matches expectations for default state

**Why not restore after each interaction?** Because the LLM might make multiple related interactions (select size → check price → check stock → evaluate). Restoring between them would break the chain. Restore ONCE after all analysis is done.

---

## 32.10 Finding Evidence with Interaction Context

**REQ-IA-030:** Findings produced during interactive analysis MUST include the interaction that revealed the evidence:

```typescript
interface InteractionEnrichedEvidence {
  // Standard evidence fields (unchanged)
  element_ref: string | null;
  element_selector: string | null;
  data_point: string;
  measurement: string | null;

  // NEW: interaction context
  interaction_performed?: {
    tool: string;                     // "browser_select"
    target: string;                   // "size-dropdown"
    value?: string;                   // "XL"
    result_summary: string;           // "CTA changed from 'Add to Cart' to 'Notify Me'"
    screenshot_ref?: string;          // screenshot of the post-interaction state
  };
}
```

This gives the consultant FULL traceability: "The agent selected size XL, and here's what happened."

---

## 32.11 Failure Modes

| # | Failure | Detection | Response |
|---|---|---|---|
| **IA-01** | LLM clicks a link that navigates away | URL change detected | BLOCKED pre-execution. Agent told: "Navigation blocked during analysis." |
| **IA-02** | LLM tries to submit a form | Safety gate: form submit = sensitive | BLOCKED. Agent told: "Form submission blocked. You can fill fields but not submit." |
| **IA-03** | LLM exhausts interaction budget on first 2 heuristics | Interaction count ≥ max | Agent told: "Budget exhausted. Evaluate remaining heuristics from static data." |
| **IA-04** | LLM enters infinite interaction loop | Message count > 50 or LLM turns > 30 | Force exit. Produce findings from what's evaluated so far. |
| **IA-05** | Interaction crashes the page | Page unresponsive | `browser_reload()`. Mark current heuristic as `needs_review`. Continue with remaining. |
| **IA-06** | Page state after interaction is identical to pre-interaction | DOM hash unchanged | Agent told: "Interaction had no visible effect." Skip this interaction. |
| **IA-07** | LLM interacts with elements unrelated to any heuristic | Audit trail review | Not blocked in real-time (LLM judgment). Flagged in audit trail for consultant review. Cost tracked. |
| **IA-08** | State restoration fails after analysis | Reload timeout | Force navigation to the URL. If still fails, mark page as `analysis_state_corrupted`. |

---

## 32.12 Implementation Phase

| Phase | Deliverable |
|---|---|
| **MVP (Phase 10)** | Evaluate node gains browser interaction tools. ReAct loop. Safety gates. Interaction budget. State restoration. |
| **Phase 11** | Consultant dashboard shows interaction log per finding — "the agent clicked X and saw Y" |
| **Phase 12** | Learning service tracks which heuristics benefit from interaction — auto-suggests `analysis_scope: "per_state"` for heuristics where interactive analysis consistently finds issues static doesn't |

---

## 32.13 This Is How a Human CRO Consultant Works

```
Human consultant:
1. Opens the page                              → our browse agent does this
2. Looks at the default state                  → our deep_perceive does this
3. Clicks tabs to see what's hidden            → our §20 does this
4. Picks up the product, changes size          → §32 does this NOW ✅
5. Notices price disappeared                   → §32 does this NOW ✅
6. Checks what happens with gift wrap option   → §32 does this NOW ✅
7. Tries submitting the form empty             → §20 rule R10 + §32 for deeper testing
8. Makes notes about each issue                → our evaluate + produce_finding does this
9. Cross-references with best practices        → future: web search integration
10. Writes the report                          → our annotate + store does this
```

Steps 4-6 were missing. Now they're not.

---

**End of §32 — Interactive Analysis**

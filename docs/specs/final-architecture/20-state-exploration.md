---
title: 20-state-exploration
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

# Section 20 — State Exploration Engine

**Status:** Master architecture extension. Phase 7 implementation. Implements the Q2-R locked ruling: heuristic-primed Pass 1 + auto-escalated bounded Pass 2. Best-effort rejected.

**Cross-references:**
- §5.7.1 (`StateNode`, `StateGraph`, `MultiStatePerception`, `ExplorationTrigger`) — types
- §6 (Browse Mode v3.1) — Browser Agent Runtime that executes interactions
- §7 (Analyze Mode) — consumer of `MultiStatePerception`; GR-009 (state provenance)
- §9.10.2 (`preferred_states` field on HeuristicExtended) — Pass 1 driver
- §13.6.3 (`page_states`, `state_interactions` tables) — persistence
- §26 (Cost & Guardrails) — exploration budget enforcement

---

## 20.1 Principle

> **A modern web page is not a static document. Content hides behind tabs, accordions, modals, variant selectors, and filter controls. An audit that only sees the default state misses 30-50% of CRO-relevant content. State exploration is the mechanism that reveals hidden content — bounded, deterministic where possible, and always within budget.**

---

## 20.2 Architecture

State exploration is a **new node** inside the browse subgraph, positioned BETWEEN page stabilisation and perception-for-analysis:

```
Browse subgraph (extended):

  perceive → reason → act → verify → stabilize
       ▲                          │
       └──────── (loop) ──────────┘
                                  │
                                  ▼ (page stable)
                         ┌─────────────────┐
                         │ explore_states   │  ← NEW NODE (Phase 7)
                         │                  │
                         │ Pass 1: heuristic│
                         │   primed         │
                         │                  │
                         │ [auto-escalation │
                         │  check]          │
                         │                  │
                         │ Pass 2: bounded  │
                         │   exhaustive     │
                         │   (conditional)  │
                         └────────┬─────────┘
                                  │
                                  ▼
                         deep_perceive (§7.4)
                         receives MultiStatePerception
```

**REQ-STATE-EXPLORE-001:** The `explore_states` node lives in the **Browser Agent Runtime** (Layer 2), NOT in the Analysis Engine (Layer 3). It uses browse tools (`browser_click`, `browser_hover`, `browser_select`, `browser_get_state`, `browser_screenshot`) to interact with the page. This preserves REQ-LAYER-005 (analysis never touches browser).

**REQ-STATE-EXPLORE-002:** The `explore_states` node is a Phase 7 addition. Phase 1-5 implementations skip this node entirely — the browse subgraph exits directly to `deep_perceive` after stabilisation, and `deep_perceive` produces a single-state `AnalyzePerception` (equivalent to `MultiStatePerception` with `hidden_states = []`).

---

## 20.3 Two-Pass Model

### Pass 1 — Heuristic-Primed Exploration (always runs)

**REQ-STATE-EXPLORE-010:** Before exploration begins, collect `preferred_states[]` from all filtered heuristics for this page:

```typescript
function collectRequiredStates(filteredHeuristics: HeuristicExtended[]): StatePattern[] {
  const required: StatePattern[] = [];
  for (const h of filteredHeuristics) {
    if (h.preferred_states) {
      for (const sp of h.preferred_states) {
        // Deduplicate by pattern_id
        if (!required.some(r => r.pattern_id === sp.pattern_id)) {
          required.push(sp);
        }
      }
    }
  }
  return required;
}
```

**REQ-STATE-EXPLORE-011:** For each `StatePattern`, the explorer attempts to find and interact with the target element:

```typescript
async function executeStatePattern(pattern: StatePattern, page: Page): Promise<StateNode | null> {
  // 1. Find the target element
  let elementRef: string | null = null;

  if (pattern.interaction_hint.target_selector) {
    elementRef = await tools.browser_find_by_selector(pattern.interaction_hint.target_selector);
  }
  if (!elementRef && pattern.interaction_hint.target_text_contains) {
    for (const text of pattern.interaction_hint.target_text_contains) {
      const result = await tools.browser_find_by_text({ text, elementType: pattern.interaction_hint.target_role });
      if (result.found) { elementRef = result.elementRef; break; }
    }
  }
  if (!elementRef && pattern.interaction_hint.target_role) {
    // Search AX tree for role
    elementRef = await findByRole(page, pattern.interaction_hint.target_role);
  }

  // 2. If element not found, skip this pattern
  if (!elementRef) {
    logSkippedPattern(pattern, "element_not_found");
    return null;
  }

  // 3. Execute interaction
  const interaction: Interaction = {
    type: pattern.interaction_hint.type,
    target_ref: elementRef,
    target_label: pattern.description,
    captured_at: Date.now(),
  };

  await executeInteraction(interaction);

  // 4. Wait for stability (MutationObserver — §6.6)
  await waitForStability();

  // 5. Capture state
  const perception = await tools.page_analyze({ sections: ALL_SECTIONS });
  const domHash = computeDomHash(page);
  const textHash = computeTextHash(perception);

  // 6. Build StateNode
  const stateId = computeStateId(page.url(), [interaction]);

  return {
    state_id: stateId,
    url: page.url(),
    interaction_path: [interaction],
    discovered_in_pass: "pass_1_heuristic_primed",
    dom_hash: domHash,
    text_hash: textHash,
    is_default_state: false,
    parent_state_id: defaultStateId,
    perception,
    viewport_screenshot_ref: null,   // captured in deep_perceive
    fullpage_screenshot_ref: null,
    discovered_at: Date.now(),
    trigger: { trigger: "rule_matched", pass: "pass_1_heuristic_primed", heuristic_id: pattern.source_heuristic_id, rule_id: pattern.pattern_id },
    meaningful: false,               // set after meaningful-state check
  };
}
```

**REQ-STATE-EXPLORE-012:** After each state capture, run the meaningful-state detector (§20.5). Non-meaningful states are discarded immediately.

**REQ-STATE-EXPLORE-013:** (C4-L2-FIX) Interactions are classified as **self-restoring** or **destructive**:

| Category | Examples | Restoration needed? |
|---|---|---|
| **Self-restoring** | Tab click (replaces in place), dropdown select, accordion toggle (click again), hover (reverts on mouseout) | **No** — proceed to next interaction directly |
| **Destructive** | Form submission (navigates away), link navigation (leaves page), modal with side effects | **Yes** — restore via `browser_go_back()`, click-to-close, or `browser_reload()` fallback |

**REQ-STATE-EXPLORE-013a:** Self-restoring interactions execute sequentially without restoration. Example: click Tab 1 → capture → click Tab 2 → capture → click Tab 3 → capture. No reload between tabs.

**REQ-STATE-EXPLORE-013b:** Destructive interactions are scheduled LAST in exploration order (consistent with §20.9 REQ-STATE-EXPLORE-102). After each destructive interaction, restoration is required.

**REQ-STATE-EXPLORE-013c:** Cookie/chat dismissal (rules R11, R12) are PERSISTENT cleanup, not exploration. They don't need restoration and their state isn't captured as a StateNode.

**REQ-STATE-EXPLORE-014:** If a `preferred_state` has `required: true` and the element is not found, log `heuristic_state_unavailable` — that heuristic will be evaluated against the default state with a `needs_review` flag, because its required evidence is missing.

### Auto-Escalation Check

**REQ-STATE-EXPLORE-020:** After Pass 1 completes, evaluate escalation triggers:

```typescript
function shouldEscalateToPass2(
  stateGraph: StateGraph,
  pageSnapshot: PageStateModel,
  analysisConfig: AuditRequest["scope"]["state_exploration"]
): { escalate: boolean; reasons: ExplorationTriggerRecord[] } {

  const reasons: ExplorationTriggerRecord[] = [];

  // Trigger 1: Thorough mode requested
  if (analysisConfig?.policy === "thorough_mode") {
    reasons.push({ trigger: "thorough_mode", pass: "pass_2_bounded_exhaustive" });
  }

  // Trigger 2: High ratio of unexplored disclosures
  const disclosures = countDisclosureElements(pageSnapshot);
  const explored = stateGraph.states.filter(s => !s.is_default_state).length;
  if (disclosures > 0 && explored / disclosures < 0.5) {
    reasons.push({ trigger: "unexplored_ratio_threshold", pass: "pass_2_bounded_exhaustive" });
  }

  // Trigger 3: Policy explicitly allows escalation (default: true)
  if (analysisConfig?.pass_2_allowed === false) {
    return { escalate: false, reasons: [] };
  }

  // Trigger 4: heuristic_primed_only mode blocks escalation
  if (analysisConfig?.policy === "heuristic_primed_only") {
    return { escalate: false, reasons: [] };
  }

  return { escalate: reasons.length > 0, reasons };
}
```

**REQ-STATE-EXPLORE-021:** Triggers 1 and 2 are checked deterministically. The analysis agent's `self_critique_flag` trigger (analysis found insufficient evidence, suspects hidden content) is checked AFTER the analysis pass — if fired, it triggers a SECOND exploration + re-analysis cycle (see §20.7).

### Pass 2 — Bounded-Exhaustive Exploration (conditional)

**REQ-STATE-EXPLORE-030:** Pass 2 uses a **rule library** to identify and interact with disclosure elements systematically:

**Disclosure Rule Library:**

| # | Element pattern | Detection | Action | Max interactions |
|---|---|---|---|---|
| R1 | `<details>` / `<summary>` | Tag name | Click `<summary>` | All (uncapped — HTML5 spec element) |
| R2 | `role="tab"` in `role="tablist"` | AX role | Click each tab | 5 per tablist |
| R3 | `aria-expanded="false"` buttons | AX + aria attribute | Click to expand | 8 per page |
| R4 | Accordion heading patterns | DOM pattern library (`.accordion-header`, `[data-toggle="collapse"]`, etc.) | Click header | 8 per page |
| R5 | Size/variant selectors on PDP | Structural: `<select>` or button group near "Add to Cart" | Select first, middle, last option | 3 |
| R6 | Quantity selector | `input[type=number]` near primary CTA | Increment once | 1 |
| R7 | Dropdown `<select>` near primary CTA | Proximity analysis to CTA bounding box | Change to non-default value | 1 |
| R8 | Filter/sort controls on PLP/category | Template classification = category/search | Apply 1 filter, 1 sort | 2 |
| R9 | Modal triggers | Buttons/links with text containing: "size guide", "shipping", "delivery", "returns", "zoom", "view larger" | Click → capture → close | 3 |
| R10 | Form validation states | Forms with `required` fields + submit button | Submit empty form → capture validation errors | 1 per form |
| R11 | Cookie banner | Pattern library: `.cookie-banner`, `#cookie-consent`, etc. | Accept/dismiss (privacy-safe default) | 1 (first, before other exploration) |
| R12 | Chat widget | Pattern library: `.chat-widget`, `#intercom-container`, etc. | Close/minimize if possible | 1 (first, before other exploration) |

**REQ-STATE-EXPLORE-031:** Rules are applied in order R11 → R12 → R1..R10. Cookie/chat dismissal happens first to clear UI clutter.

**REQ-STATE-EXPLORE-032:** For each rule match, the explorer executes the interaction, waits for stability, captures perception, runs meaningful-state detector, and restores state if needed.

**REQ-STATE-EXPLORE-033:** Pass 2 skips elements already explored in Pass 1 (matched by target_ref).

### LLM Fallback within Pass 2

**REQ-STATE-EXPLORE-040:** If Pass 2 rules produce fewer than 3 new meaningful states on a page that the page_type suggests should be interactive (product, checkout, form), AND budget allows, invoke a single LLM call:

```
Given this AX tree (interactive elements only), which 3 additional
interactions would most likely reveal CRO-relevant hidden content?

Interactive elements:
{{pageSnapshot.interactiveGraph.topControls | json}}

Already explored:
{{exploredInteractions | json}}

Respond with JSON array:
[{ "element_ref": "...", "action": "click|hover|select", "reason": "..." }]
```

**REQ-STATE-EXPLORE-041:** LLM-suggested interactions are executed by the deterministic executor — the LLM does NOT control the browser. It only suggests; code acts.

**REQ-STATE-EXPLORE-042:** LLM fallback is capped at 1 call per page. Cost: ~$0.05.

---

## 20.4 State Graph Construction

**REQ-STATE-EXPLORE-050:** The exploration process builds a `StateGraph` (§5.7.1) incrementally:

```typescript
function buildStateGraph(
  pageUrl: string,
  defaultPerception: AnalyzePerception,
  exploredStates: StateNode[],
  config: { costCapUsd: number; runtimeCapMs: number }
): StateGraph {
  const defaultStateId = computeStateId(pageUrl, []);

  const defaultNode: StateNode = {
    state_id: defaultStateId,
    url: pageUrl,
    interaction_path: [],
    discovered_in_pass: "pass_1_heuristic_primed",
    dom_hash: computeDomHash(defaultPerception),
    text_hash: computeTextHash(defaultPerception),
    is_default_state: true,
    parent_state_id: null,
    perception: defaultPerception,
    viewport_screenshot_ref: null,
    fullpage_screenshot_ref: null,
    discovered_at: Date.now(),
    trigger: { trigger: "rule_matched", pass: "pass_1_heuristic_primed" },
    meaningful: true,
  };

  const allStates = [defaultNode, ...exploredStates.filter(s => s.meaningful)];

  const edges = exploredStates
    .filter(s => s.meaningful)
    .map(s => ({
      from: s.parent_state_id ?? defaultStateId,
      to: s.state_id,
      interaction: s.interaction_path[s.interaction_path.length - 1],
    }));

  return {
    page_url: pageUrl,
    default_state_id: defaultStateId,
    states: allStates,
    edges,
    exploration_cost_usd: 0,    // updated by cost tracker
    exploration_cost_cap_usd: config.costCapUsd,
    exploration_runtime_ms: 0,
    exploration_runtime_cap_ms: config.runtimeCapMs,
    pass_2_triggered: false,
    pass_2_trigger_reasons: [],
    truncated: false,
  };
}
```

---

## 20.5 Meaningful-State Detection

**REQ-STATE-EXPLORE-060:** After each state capture, determine if the new state is "meaningful" — i.e., reveals content worth analyzing:

```typescript
function isMeaningful(newState: AnalyzePerception, parentState: AnalyzePerception): boolean {
  // Text content difference
  const newText = extractAllText(newState);
  const parentText = extractAllText(parentState);
  // M1-L2-FIX: word-level tokenization (split on whitespace + punctuation, lowercased)
  const textJaccard = jaccardDistance(tokenize(newText), tokenize(parentText));

  // New interactive elements
  const newInteractive = newState.ctas.length + newState.forms.length;
  const parentInteractive = parentState.ctas.length + parentState.forms.length;
  const newInteractiveCount = Math.max(0, newInteractive - parentInteractive);

  // Visible area change (proxy: contentAboveFold diff)
  const newAboveFold = new Set(newState.layout.contentAboveFold);
  const parentAboveFold = new Set(parentState.layout.contentAboveFold);
  const aboveFoldDiff = symmetricDifference(newAboveFold, parentAboveFold).size / Math.max(newAboveFold.size, 1);

  // CTA set changed
  const newCTATexts = new Set(newState.ctas.map(c => c.text.toLowerCase()));
  const parentCTATexts = new Set(parentState.ctas.map(c => c.text.toLowerCase()));
  const ctaChanged = symmetricDifference(newCTATexts, parentCTATexts).size > 0;

  // Meaningful if ANY threshold met
  return (
    textJaccard > 0.15 ||
    newInteractiveCount > 3 ||
    aboveFoldDiff > 0.10 ||
    ctaChanged
  );
}
```

**REQ-STATE-EXPLORE-061:** States that fail meaningful-state detection are logged with reason `not_meaningful` but NOT added to the state graph. They do not count against the max-states cap.

**REQ-STATE-EXPLORE-062:** The default state (no interactions) is ALWAYS meaningful. This invariant is enforced.

---

## 20.6 Multi-State Perception Synthesis

**REQ-STATE-EXPLORE-070:** After exploration completes, synthesise a `MultiStatePerception` for the Analysis Agent:

```typescript
function synthesiseMultiState(
  stateGraph: StateGraph,
  defaultPerception: AnalyzePerception
): MultiStatePerception {
  const hiddenStates = stateGraph.states
    .filter(s => !s.is_default_state && s.meaningful)
    .map(s => ({
      state_id: s.state_id,
      interaction_path: s.interaction_path,
      perception: s.perception,
    }));

  // Merge: union of all elements across states, with provenance tracking
  const merged = mergePerceptions(defaultPerception, hiddenStates.map(s => s.perception));
  const provenance = buildProvenanceMap(defaultPerception, hiddenStates, merged);

  return {
    page_url: stateGraph.page_url,
    default_state: defaultPerception,
    hidden_states: hiddenStates,
    merged_view: merged,
    state_provenance: provenance,
  };
}
```

**REQ-STATE-EXPLORE-071:** (S4-L2-FIX) The `merged_view` is what the Analysis Agent evaluates heuristics against. CTA dedup across states: two CTAs are the SAME element if (text cosine similarity > 0.9 AND bounding box IoU > 0.5). CTAs with different text at the same position are DIFFERENT elements from different states — both retained with distinct provenance. The merged view contains the UNION of:
- All CTAs across all states (deduplicated by text + bounding box proximity)
- All forms across all states
- All trust signals across all states
- All headings (deduplicated by text)
- Text content: paragraphs from all states, tagged with `state_id`
- Navigation: from default state only (nav doesn't change across states)
- Performance: from default state only
- Layout: from default state (fold position, whitespace ratio)

**REQ-STATE-EXPLORE-072:** The `state_provenance` Record maps element identifiers in the `merged_view` back to their source `state_id`. This is consumed by GR-009 (§7 extended) to validate that findings cite elements they can prove exist.

**REQ-STATE-EXPLORE-072a:** (S3-L2-FIX) Provenance keys use the same `{section}[{index}]` format as `finding.evidence.data_point` — e.g., `ctas[0]`, `forms[1].fields[2]`, `trustSignals[3]`. GR-009 matches `finding.evidence.data_point` against provenance keys. If the data_point references an element that only exists in a hidden state, the provenance record must exist; otherwise GR-009 rejects.

---

## 20.7 Self-Critique Escalation Loop

**REQ-STATE-EXPLORE-080:** If the Analysis Agent's self-critique flags `insufficient_evidence: hidden_content_suspected` for any finding, AND Pass 2 has not yet run, AND budget allows:

1. The Analysis Agent signals `escalation_needed: state_exploration` via the AuditState
2. The Audit Orchestrator routes back to `explore_states` for a second pass
3. `explore_states` runs Pass 2 (bounded-exhaustive), producing additional states
4. `deep_perceive` re-runs with the expanded state graph
5. Analysis re-runs with the updated `MultiStatePerception`
6. Self-critique runs again (but does NOT trigger another escalation — max 1 cycle)

**REQ-STATE-EXPLORE-081:** This creates a mini-loop between explore and analyze, but it is bounded: at most 1 escalation per page. After the re-analysis, the pipeline proceeds to grounding and annotation regardless.

**REQ-STATE-EXPLORE-082:** The escalation loop cost is tracked separately: `exploration_pass_2_cost_usd`. It is subtracted from the page budget, not the exploration budget alone.

---

## 20.8 Caps and Budget (per page)

| Cap | Default | Configurable via | Enforcement |
|---|---|---|---|
| Max states per page | 15 | `AuditRequest.scope.state_exploration.max_states_per_page` | `REQ-STATE-EXT-INV-005` |
| Max exploration depth | 2 | Hard-coded | No tabs-inside-tabs-inside-modals |
| Max interactions per page | 25 | Hard-coded | Includes failed interactions |
| Max Pass 2 LLM calls | 1 | Hard-coded | §20.3 REQ-STATE-EXPLORE-042 |
| Exploration budget USD | $0.50 | `AuditState.exploration_budget_usd` | `REQ-STATE-EXT-INV-002` via state graph |
| Exploration runtime | 60s | Hard-coded | Timer kill |
| Max escalation cycles | 1 | Hard-coded | §20.7 REQ-STATE-EXPLORE-081 |
| State restoration timeout | 5s | Hard-coded | If restore takes >5s, reload page |

**REQ-STATE-EXPLORE-090:** When ANY cap is hit, exploration halts immediately. The state graph is marked `truncated = true` with the specific `truncation_reason`. Analysis proceeds with whatever states were captured.

---

## 20.9 State Restoration Strategy

**REQ-STATE-EXPLORE-100:** After exploring a non-default state, restore to default before the next exploration:

| Interaction type | Restoration strategy |
|---|---|
| Click on accordion/details | Click again to close (toggle) |
| Click on tab | Click the default (first) tab |
| Click on modal trigger | Click close button / press Escape |
| Select dropdown option | Select default option |
| Form submission (validation) | Browser reload |
| Navigation to new URL | `browser_go_back()` |

**REQ-STATE-EXPLORE-101:** Restoration has a 5s timeout. If restoration fails or takes too long, `browser_reload()` is the universal fallback.

**REQ-STATE-EXPLORE-102:** Destructive interactions (form submission, navigation) are scheduled LAST in exploration order. The exploration planner sorts interactions: non-destructive first, destructive last, so that restoration reloads don't interfere with other exploration.

---

## 20.10 GR-009 — State Provenance Integrity (Grounding Rule Addition)

**REQ-STATE-EXPLORE-110:** Add grounding rule GR-009 to the evidence grounding pipeline (§7.7):

```typescript
{
  id: "GR-009",
  description: "Finding citing hidden-state content must include state provenance",
  check: (finding, pageData, multiState) => {
    // If finding references an element that only exists in a non-default state,
    // the finding MUST record the state_id in its evidence
    const ref = finding.evidence.element_ref;
    if (!ref) return { pass: true };

    // Check if element exists in default state
    const inDefault = elementExistsInPerception(ref, multiState.default_state);
    if (inDefault) return { pass: true }; // no provenance needed

    // Element NOT in default — must be from a hidden state
    const sourceState = multiState.state_provenance[ref];
    if (!sourceState) {
      return { pass: false, reason: `Element "${ref}" not in default state and no state provenance recorded` };
    }

    // Verify the cited state actually exists in the graph
    const stateExists = multiState.hidden_states.some(s => s.state_id === sourceState);
    if (!stateExists) {
      return { pass: false, reason: `State provenance "${sourceState}" not found in state graph` };
    }

    return { pass: true };
  }
}
```

**REQ-STATE-EXPLORE-111:** GR-009 is gated behind Phase 7. (X2-L2-FIX) §7 (analyze-mode.md) will be updated in Layer 3 (G7 fix) to add GR-009 and GR-010 references to the grounding rule set. Phase 1-5 implementations do not have state exploration and skip this rule (the `multiState` parameter will have `hidden_states = []`, so every element is in the default state and the rule trivially passes).

---

## 20.11 Persistence

**REQ-STATE-EXPLORE-120:** After exploration, persist to:
- `page_states` table: one row per meaningful `StateNode` (§13.6.3)
- `state_interactions` table: one row per edge in the state graph (§13.6.3)
- `StateGraph` in AuditState checkpoint (LangGraph/Temporal)
- Screenshots per state: captured during `deep_perceive` after exploration (stored in R2, referenced by `viewport_screenshot_ref` / `fullpage_screenshot_ref`)

**REQ-STATE-EXPLORE-121:** Non-meaningful states (failed the detection threshold) are NOT persisted to `page_states`. They are logged to the audit trail for diagnostic purposes only.

---

## 20.12 Failure Modes (Additions to §15)

| # | Failure | Detection | Response |
|---|---|---|---|
| **SE-01** | Exploration interaction crashes the page | Page unresponsive after interaction | Reload page, mark state as failed, continue with remaining exploration |
| **SE-02** | State restoration fails | Timeout or incorrect DOM after restore | `browser_reload()` fallback. If reload fails, abort exploration for this page. |
| **SE-03** | Meaningful-state detection too aggressive (discards everything) | 0 meaningful states after >5 interactions | Lower thresholds by 50% and re-evaluate captured states. If still 0, proceed with default state only. |
| **SE-04** | Meaningful-state detection too lenient (keeps everything) | Hits max-states cap quickly | Cap enforces. Truncated = true. Proceed with captured states. |
| **SE-05** | Pass 1 preferred_states all fail (elements not found) | 0 Pass 1 states | Proceed with default state. Heuristics with `required: true` states are flagged `needs_review`. |
| **SE-06** | Exploration budget exhausted mid-pass | Cost check after each interaction | Halt exploration. Set `truncated = true, truncation_reason = "budget"`. Proceed with captured states. |
| **SE-07** | Exploration runtime exceeds 60s | Timer | Halt exploration. Set `truncated = true, truncation_reason = "runtime"`. Proceed. |
| **SE-08** | LLM fallback returns invalid element refs | AX tree validation of suggested refs | Skip invalid refs. Execute valid ones only. |
| **SE-09** | Escalation loop: analysis requests Pass 2, but Pass 2 was already run | State check | Reject escalation. Max 1 cycle per page (REQ-STATE-EXPLORE-081). |
| **SE-10** | Concurrent DOM mutations during exploration | MutationObserver spike | Wait for stability (mutation_timeout_ms). If unstable after timeout, capture current state. |

---

## 20.13 Implementation Phase Mapping

| Phase | Deliverable |
|---|---|
| **7** | `explore_states` node in browse subgraph, disclosure rule library (R1-R12), Pass 1 heuristic-primed execution, meaningful-state detection, state graph construction, MultiStatePerception synthesis, GR-009, persistence |
| **7** | Pass 2 bounded-exhaustive execution, auto-escalation triggers |
| **8** | Self-critique escalation loop (§20.7) integration with analysis pipeline |
| **11** | Consultant dashboard: state graph visualiser, exploration replay, per-state finding view |
| **12** | Learning service: track which preferred_states are consistently found/missing → auto-update heuristic preferred_states |

---

**End of §20 — State Exploration Engine**

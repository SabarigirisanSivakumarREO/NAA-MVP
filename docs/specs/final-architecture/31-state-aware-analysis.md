---
title: 31-state-aware-analysis
artifact_type: architecture-spec
status: superseded
supersededBy: 33-agent-composition-model.md
loadPolicy: do-not-load
version: 2.3
updated: 2026-04-28
governing_rules:
  - Constitution R17 (Lifecycle States)
  - Constitution R22 (The Ratchet)
note: SUPERSEDED. Do not implement from this file. The concepts here (per-state evaluation, transition evaluation, GR-011, three heuristic analysis scopes) are absorbed into §33 — Agent Composition Model. Retained for historical reference only.
---

# Section 31 — State-Aware Analysis Architecture

**Status:** Architectural extension. Addresses the gap between state exploration (§20) and analysis (§7): the current merged-view analysis misses state-dependent issues. This section redesigns the analysis pipeline to support per-state evaluation.

> **Superseded by §33 — Agent Composition Model.** The concepts in this section (three heuristic analysis scopes, per-state evaluation, transition evaluation, GR-011) are absorbed into §33. This file is retained for reference. Implementers should read §33 instead.

**Problem statement:** The current architecture merges all explored states into one `MultiStatePerception` and runs the analysis pipeline once. This works for global heuristics (navigation structure, heading hierarchy) but FAILS for state-dependent heuristics where the finding changes based on which interactive state is active.

**Examples of what the current architecture misses:**

| Scenario | Why merged analysis fails |
|---|---|
| Tab "Reviews" has social proof, Tab "Description" does not | Merged view shows social proof exists → Cialdini heuristic passes. But in the default state (Description tab), there's NO social proof above fold — that's a real issue. |
| Size filter "XL" → out of stock, "M" → in stock | Merged view shows product as available → stock heuristic passes. But a user who selects XL sees an out-of-stock state — that's a CRO friction point. |
| Accordion "Shipping" has misleading delivery estimate | Merged view blends shipping text with returns text → copy clarity heuristic evaluates the combined text. The specific misleading claim in the shipping accordion is diluted. |
| Form submitted empty → 6 validation errors with poor messages | Merged view shows the clean form + error state together → error handling heuristic sees both states at once, can't distinguish "before submit" from "after submit." |
| Sticky CTA changes text on scroll (Add to Cart → Buy Now) | Merged view has both CTA texts → CTA consistency heuristic can't tell they're the SAME button in different scroll states. |

---

## 31.1 Solution: Three-Mode Analysis

The analysis pipeline is extended to support three evaluation modes, determined by the heuristic's declared scope:

```
                    filtered_heuristics
                           │
                ┌──────────┼──────────┐
                ▼          ▼          ▼
          GLOBAL      PER-STATE   TRANSITION
          heuristics  heuristics  heuristics
                │          │          │
                ▼          ▼          ▼
          evaluate    evaluate    evaluate
          against     against     against
          merged_     EACH        state
          view        state       PAIRS
          (1 call)    (N calls)   (M calls)
                │          │          │
                └──────┬───┘          │
                       ▼              ▼
                  self-critique    self-critique
                  (batched)       (batched)
                       │              │
                       ▼              ▼
                  evidence ground  evidence ground
                  (per finding)   (per finding)
                       │              │
                       └──────┬───────┘
                              ▼
                         4D score + annotate + store
```

---

## 31.2 Three Heuristic Scopes

### New field on HeuristicExtended: `analysis_scope`

```typescript
export const AnalysisScopeEnum = z.enum([
  "global",       // evaluate against merged_view (1 evaluation)
  "per_state",    // evaluate against EACH state independently (N evaluations)
  "transition",   // evaluate against state PAIRS: before→after (M evaluations)
]);
```

**REQ-SAA-001:** Every heuristic SHALL declare an `analysis_scope`. Default: `"global"` (backward-compatible — existing heuristics evaluate against merged view as before).

### Scope assignment guidelines

| Scope | When to use | Examples |
|---|---|---|
| **global** | Heuristic evaluates site-wide or page-wide properties that don't change across states | Navigation structure, heading hierarchy, overall page performance, semantic HTML, meta tags, page-level layout, primary CTA presence (is there ANY CTA on the page across all states) |
| **per_state** | Heuristic evaluates properties that depend on which interactive state is active | CTA visibility in current view, trust signal placement in current tab, form field count in current accordion, content quality in current panel, product availability after filter, pricing after variant selection |
| **transition** | Heuristic evaluates what CHANGES between two states — the dynamic behavior itself | Stock availability change on variant selection, price change on option selection, CTA text change on scroll, validation error quality after form submit, loading state during async operation, content shift during interaction |

### Distribution estimate (100 MVP heuristics)

| Scope | Count | % | Rationale |
|---|---|---|---|
| global | ~45 | 45% | Navigation, structure, performance, overall layout |
| per_state | ~40 | 40% | CTA, trust, forms, content — all state-dependent |
| transition | ~15 | 15% | Stock changes, validation, dynamic behavior |

---

## 31.3 Global Analysis (scope = "global")

**Unchanged from current architecture.** Evaluates against `MultiStatePerception.merged_view` in one LLM call.

**REQ-SAA-010:** Global heuristics are batched into a single evaluate call using the merged_view. This is identical to the current §7.5 evaluate node behavior.

**What the LLM sees:** The merged perception with all elements from all states, deduplicated.

**When this is correct:** "Does the page have a primary CTA ANYWHERE?" → yes, even if it's only in Tab 2. "Does the page have semantic HTML?" → yes/no regardless of which tab is active. "Is page performance good?" → independent of interactive state.

**Cost:** ~$0.15 for ~20 global heuristics (same as current)

---

## 31.4 Per-State Analysis (scope = "per_state")

**NEW.** Evaluates each heuristic against EACH meaningful state independently. Produces state-scoped findings.

**REQ-SAA-020:** Per-state heuristics are evaluated N times — once per meaningful state in the StateGraph. Each evaluation receives that state's individual `AnalyzePerception`, NOT the merged view.

### Evaluation structure

```typescript
async function evaluatePerState(
  stateGraph: StateGraph,
  perStateHeuristics: HeuristicExtended[],
  pageType: PageType,
  businessType: BusinessType,
): Promise<RawFinding[]> {
  const allFindings: RawFinding[] = [];

  for (const state of stateGraph.states) {
    // Each state gets its own evaluation
    const findings = await evaluateNode({
      perception: state.perception,        // THIS state's perception, not merged
      heuristics: perStateHeuristics,
      pageType,
      businessType,
      stateContext: {
        state_id: state.state_id,
        is_default: state.is_default_state,
        interaction_path: state.interaction_path,
        interaction_label: describeInteractionPath(state.interaction_path),
        // e.g., "After clicking 'Reviews' tab"
        // e.g., "After selecting size 'XL'"
        // e.g., "After submitting empty form"
      },
    });

    // Tag each finding with its source state
    for (const f of findings) {
      f.state_ids = [state.state_id];
      f.state_context = state.interaction_path.length > 0
        ? `In state: ${describeInteractionPath(state.interaction_path)}`
        : "In default state";
    }

    allFindings.push(...findings);
  }

  return allFindings;
}
```

### Per-state evaluate prompt (extends §7.5)

```
PAGE DATA (STATE-SPECIFIC):
URL: {{current_url}}
Page type: {{page_type}}
Business type: {{business_type}}

CURRENT STATE: {{state_context.interaction_label}}
  {{#if state_context.is_default}}
  This is the DEFAULT page state (no interactions performed).
  {{else}}
  This state was reached by: {{state_context.interaction_path | describe}}
  {{/if}}

STATE-SPECIFIC PAGE DATA:
{{state.perception | json}}

---

EVALUATE AGAINST THESE HEURISTICS:
{{per_state_heuristics | json}}

---

IMPORTANT: Evaluate ONLY what is visible/active in THIS state.
Do NOT reference elements from other states.
If a heuristic is not applicable to this state, respond with status: "not_applicable".
```

### Per-state finding deduplication

**REQ-SAA-021:** After per-state evaluation, dedup findings:

```typescript
function deduplicatePerStateFindings(findings: RawFinding[]): RawFinding[] {
  const groups = groupBy(findings, f => f.heuristic_id);

  return Object.values(groups).flatMap(group => {
    // Same heuristic, same verdict across ALL states → single global finding
    const allPass = group.every(f => f.status === "pass");
    const allViolation = group.every(f => f.status === "violation");

    if (allPass) {
      // Consistent pass → one finding, scope = "page"
      return [{
        ...group[0],
        status: "pass",
        state_ids: group.map(f => f.state_ids[0]),
        observation: `Passes in all ${group.length} states`,
      }];
    }

    if (allViolation && similarEvidence(group)) {
      // Same violation in all states → one finding, scope = "page"
      return [{
        ...group[0],
        state_ids: group.map(f => f.state_ids[0]),
        observation: `Violation present in all ${group.length} states: ${group[0].observation}`,
      }];
    }

    // MIXED results — some states pass, some violate
    // This is the interesting case: keep state-specific findings
    return group.filter(f => f.status === "violation" || f.status === "needs_review")
      .map(f => ({
        ...f,
        observation: `${f.state_context}: ${f.observation}`,
        // e.g., "In state 'Reviews tab open': Social proof trust signals present above fold"
        // vs "In default state: No social proof visible above fold"
      }));
  });
}
```

### Cost model

**REQ-SAA-022:** Per-state analysis cost:

```
Per-state cost = (num_states × num_per_state_heuristics × token_cost_per_heuristic)

Example: 5 states × 20 per_state heuristics × ~$0.008/heuristic = ~$0.80

vs. current merged: 1 evaluation × 20 heuristics × ~$0.008 = ~$0.16
```

**Cost increase: ~5x for per-state analysis.** This is significant. Mitigation strategies in §31.7.

---

## 31.5 Transition Analysis (scope = "transition")

**NEW.** Evaluates what CHANGES between two states — the dynamic behavior itself. Focuses on the BEFORE→AFTER comparison, not the individual states.

**REQ-SAA-030:** Transition heuristics receive state PAIRS: `(parent_state, child_state, interaction)`. They evaluate the CHANGE caused by the interaction.

### Use cases

| Interaction | Before state | After state | What transition analysis catches |
|---|---|---|---|
| Select size "XL" | Product available, price $29.99 | "Out of stock", price hidden | Stock availability handling, price disappearance |
| Click "Add to Cart" | CTA says "Add to Cart" | CTA says "Added ✓", cart count updates | Feedback clarity, confirmation pattern |
| Submit empty form | Clean form, no errors | 6 error messages appear | Error message quality, inline vs summary, field highlighting |
| Scroll past fold | Sticky nav hidden | Sticky nav + CTA appears | Sticky element behavior, CTA visibility on scroll |
| Apply filter "In Stock" | 24 products shown | 3 products shown | Zero-result handling, filter feedback, result count update |
| Click "Show More" | 5 reviews visible | 15 reviews visible | Progressive disclosure, loading indication |

### Transition evaluate prompt

```
TRANSITION ANALYSIS:
URL: {{current_url}}

INTERACTION PERFORMED: {{interaction.type}} on "{{interaction.target_label}}"
  {{interaction | describe}}

BEFORE STATE:
{{parent_state.perception | selected_fields}}

AFTER STATE:
{{child_state.perception | selected_fields}}

CHANGES DETECTED:
  Text content delta: {{text_diff_summary}}
  New elements: {{new_elements | json}}
  Removed elements: {{removed_elements | json}}
  Changed elements: {{changed_elements | json}}
  CTA changes: {{cta_diff | json}}
  Price changes: {{price_diff | json}}
  Availability changes: {{availability_diff | json}}

---

EVALUATE THESE TRANSITION HEURISTICS:
{{transition_heuristics | json}}

For each heuristic, evaluate the QUALITY of the transition — not just what changed, but
whether the change is clear, helpful, and maintains user confidence.

Respond with JSON:
{
  "heuristic_id": "...",
  "status": "violation" | "pass" | "needs_review",
  "observation": "what changed and how",
  "assessment": "is this change well-handled or problematic",
  "evidence": {
    "before_ref": "element/value before interaction",
    "after_ref": "element/value after interaction",
    "data_point": "which change detected above proves this"
  },
  "severity": "...",
  "recommendation": "..."
}
```

### State diff computation (deterministic)

**REQ-SAA-031:** Before calling the LLM, compute a deterministic diff between parent and child states:

```typescript
interface StateDiff {
  text_added: string[];
  text_removed: string[];
  ctas_added: CTA[];
  ctas_removed: CTA[];
  ctas_changed: Array<{ before: CTA; after: CTA; change: string }>;
  forms_changed: Array<{ field: string; before: string; after: string }>;
  prices_changed: Array<{ before: string; after: string }>;
  availability_changed: boolean;
  new_error_messages: string[];
  layout_shift: boolean;
  elements_appeared: number;
  elements_disappeared: number;
}

function computeStateDiff(parent: AnalyzePerception, child: AnalyzePerception): StateDiff {
  // Deterministic comparison of two perception snapshots
  // Returns structured diff that the LLM evaluates
}
```

**REQ-SAA-032:** The diff is computed BEFORE the LLM call and included in the prompt. The LLM evaluates the QUALITY of the change, not detects the change itself. Change detection is deterministic; quality assessment is LLM-driven.

### Which state pairs to evaluate

**REQ-SAA-033:** Not all state pairs are meaningful for transition analysis. Evaluate only:

1. `default_state → each child state` (what changes when user first interacts)
2. State pairs where the interaction is CRO-relevant (filter change, variant selection, form submission, scroll-triggered changes)

**NOT evaluated:** Tab A → Tab B transitions (these are per-state, not transitions). Accordion open → close (restoring to default).

```typescript
function selectTransitionPairs(stateGraph: StateGraph): Array<[StateNode, StateNode, Interaction]> {
  const pairs: Array<[StateNode, StateNode, Interaction]> = [];
  const defaultState = stateGraph.states.find(s => s.is_default_state)!;

  for (const edge of stateGraph.edges) {
    const child = stateGraph.states.find(s => s.state_id === edge.to);
    if (!child || !child.meaningful) continue;

    const interaction = edge.interaction;

    // Only include CRO-relevant transitions
    const isCRORelevant =
      interaction.type === "select" ||                    // variant/filter selection
      interaction.type === "click" && isFormSubmit(interaction) ||  // form submission
      interaction.type === "scroll_to" && isStickyTrigger(interaction) ||  // scroll triggers
      hasSignificantDiff(defaultState.perception, child.perception);

    if (isCRORelevant) {
      pairs.push([defaultState, child, interaction]);
    }
  }

  return pairs;
}
```

### Cost model

**REQ-SAA-034:** Transition analysis cost:

```
Transition cost = (num_CRO_pairs × num_transition_heuristics × token_cost)

Example: 3 CRO-relevant transitions × 10 transition heuristics × ~$0.008 = ~$0.24
```

---

## 31.6 Extended Analysis Pipeline

### Updated flow

```
filtered_heuristics
    │
    ▼
SPLIT by analysis_scope
    │
    ├─▶ global_heuristics[]         (~45)
    ├─▶ per_state_heuristics[]      (~40)
    └─▶ transition_heuristics[]     (~15)
    │
    ▼
PARALLEL EVALUATION:
    │
    ├─▶ evaluateGlobal(merged_view, global_heuristics)
    │     → 1 LLM call, ~$0.12
    │
    ├─▶ evaluatePerState(stateGraph.states, per_state_heuristics)
    │     → N LLM calls (1 per state), ~$0.08 each
    │     → dedup across states
    │
    └─▶ evaluateTransitions(state_pairs, transition_heuristics)
          → M LLM calls (1 per CRO pair), ~$0.08 each
          → state diff computed deterministically before each call
    │
    ▼
MERGE all raw findings
    │
    ▼
SELF-CRITIQUE (batched — one call for all findings)
    │
    ▼
EVIDENCE GROUND (per finding, deterministic)
    │ GR-001..GR-010 apply
    │ GR-009 validates state provenance for per-state and transition findings
    │
    ▼
4D SCORE + ANNOTATE + STORE
```

### State-aware finding schema extension

**REQ-SAA-040:** Findings from per-state and transition analysis carry additional fields:

```typescript
interface StateAwareFinding extends Finding {
  // Existing fields...

  // NEW: State-aware fields
  analysis_scope: "global" | "per_state" | "transition";

  // For per_state findings:
  evaluated_state_id?: string;          // which state was this finding about
  state_interaction_label?: string;     // "After clicking 'Reviews' tab"

  // For transition findings:
  transition?: {
    before_state_id: string;
    after_state_id: string;
    interaction: Interaction;
    diff_summary: string;               // human-readable change description
  };
}
```

### Annotation extension

**REQ-SAA-041:** Per-state findings are annotated on THAT STATE's screenshot (not the default state screenshot). Each state's viewport + fullpage screenshots get their own annotation layer.

**REQ-SAA-042:** Transition findings are annotated with a BEFORE/AFTER screenshot pair showing the change. Both screenshots are annotated: the "before" pin shows the original state, the "after" pin shows what changed.

---

## 31.7 Cost Mitigation

Per-state analysis is ~5x more expensive than merged analysis. Mitigations:

### Strategy 1: Selective per-state evaluation

**REQ-SAA-050:** Not all states need all per-state heuristics. Filter per-state heuristics by STATE RELEVANCE:

```typescript
function filterPerStateHeuristics(
  heuristics: HeuristicExtended[],
  state: StateNode
): HeuristicExtended[] {
  return heuristics.filter(h => {
    // Only evaluate heuristics whose data_points are affected by this state's content
    const stateHasRelevantContent = h.detection.dataPoints.some(dp => {
      switch (dp) {
        case "trustSignals": return state.perception.trustSignals.length > 0;
        case "forms": return state.perception.forms.length > 0;
        case "ctas": return state.perception.ctas.length > 0;
        default: return true;
      }
    });
    return stateHasRelevantContent;
  });
}
```

**Savings:** If a state only reveals trust signals (Reviews tab), only trust-related heuristics are evaluated — not form heuristics or CTA heuristics. Reduces from 40 heuristics to ~10-15 per state.

### Strategy 2: Skip default-identical states

**REQ-SAA-051:** If a state's perception is >90% similar to the default state (text Jaccard), skip per-state analysis for that state — the merged analysis already covers it.

### Strategy 3: Batch per-state calls

**REQ-SAA-052:** Instead of 1 LLM call per state × per heuristic, batch: 1 LLM call per state with all relevant heuristics for that state. Same as global evaluation but scoped to one state.

### Strategy 4: Rule heuristics skip LLM entirely

**REQ-SAA-053:** Per-state heuristics with `rule_vs_guidance = "rule"` run their deterministic detector per state with $0 LLM cost. Only guidance heuristics need LLM per state.

### Revised cost model with mitigations

```
Per page (5 meaningful states, 100 heuristics):

Global:     1 call × 45 heuristics               = ~$0.12
Per-state:  5 states × ~15 relevant heuristics    = ~$0.40  (was $0.80 without filtering)
Transition: 3 pairs × 10 heuristics               = ~$0.24
Self-critique: 1 batched call                      = ~$0.08
                                                    --------
Total analysis per page:                            ~$0.84

vs. current merged-only:                            ~$0.20
vs. unmitigated per-state:                          ~$1.20
```

**Cost increase: ~4x over current, but captures 3-5x more state-dependent issues.** The ROI is in finding quality, not finding quantity.

### Budget enforcement

**REQ-SAA-054:** Per-state and transition analysis costs are tracked under the page analysis budget. If the page budget is exhausted mid-state-evaluation, remaining states are skipped and analysis proceeds with findings from evaluated states. The finding includes a note: `"analysis_truncated: budget — ${remaining_states} states not evaluated"`.

---

## 31.8 Example Walkthrough: PDP with Size Filter

**Page:** amazon.in/product/mechanical-keyboard
**States discovered by §20 exploration:**

| State | Interaction | Key content revealed |
|---|---|---|
| S0 (default) | None | Product page with size "Standard" selected, in stock, $29.99 |
| S1 | Click "Reviews" tab | 342 reviews, 4.2★ rating, review text |
| S2 | Click "Specifications" tab | Technical specs table, dimensions, weight |
| S3 | Select size "Compact" | Price changes to $24.99, still in stock |
| S4 | Select size "Full" | "Currently unavailable", price hidden, CTA changes to "Notify Me" |
| S5 | Submit empty "Ask Question" form | 3 validation errors appear |

**Analysis execution:**

#### Global heuristics (against merged_view):
- Navigation structure → PASS (consistent nav)
- Heading hierarchy → PASS (proper H1-H3)
- Page performance → PASS (LCP < 2.5s)
- Semantic HTML → VIOLATION: no `<main>` element

#### Per-state heuristics:

**S0 (default):**
- Primary CTA above fold → PASS (Add to Cart visible)
- Trust signals above fold → VIOLATION (no reviews visible in default state — reviews are in Tab S1)
- Price clarity → PASS ($29.99 visible)

**S1 (Reviews tab):**
- Social proof presence → PASS (342 reviews visible)
- Review credibility → PASS (verified purchase badges)
- Trust signals above fold → PASS (in THIS state, reviews are visible)

**S4 (Size "Full" selected):**
- CTA visibility → VIOLATION (primary CTA changed from "Add to Cart" to "Notify Me" — less actionable)
- Price clarity → VIOLATION (price hidden when out of stock — user can't compare sizes)
- Stock indicator clarity → VIOLATION ("Currently unavailable" but no expected date)

**S5 (Empty form submitted):**
- Form error messages → VIOLATION (generic "required field" instead of specific guidance)
- Inline validation → VIOLATION (errors shown only after submit, not inline)

#### Transition heuristics:

**S0 → S4 (Standard → Full size):**
- Stock change handling → VIOLATION: no warning before size selection that this variant is unavailable
- Price change clarity → VIOLATION: price disappears entirely instead of showing crossed-out price
- CTA transition quality → NEEDS_REVIEW: "Add to Cart" → "Notify Me" is a major CTA change with no explanation

**S0 → S5 (form submit):**
- Error prevention → VIOLATION: no client-side validation before submit
- Error recovery → VIOLATION: form scrolls to top on error, user loses context

#### Findings summary:

| Scope | Violations | Passes | Needs review |
|---|---|---|---|
| Global | 1 | 3 | 0 |
| Per-state (across 6 states) | 7 | 8 | 0 |
| Transition (2 pairs) | 5 | 0 | 1 |
| **Total** | **13** | **11** | **1** |

**Without state-aware analysis (current merged approach), we would have found: ~4-5 violations.** The per-state and transition analysis found **8 additional violations** that the merged view would have missed or diluted.

---

## 31.9 New Grounding Rule: GR-011

**REQ-SAA-060:** Per-state and transition findings must cite evidence from the CORRECT state:

```typescript
{
  id: "GR-011",
  description: "Per-state finding must reference data from its evaluated state, not other states",
  check: (finding, perception, stateGraph) => {
    if (finding.analysis_scope === "global") return { pass: true };

    if (finding.analysis_scope === "per_state") {
      const evaluatedState = stateGraph.states.find(s => s.state_id === finding.evaluated_state_id);
      if (!evaluatedState) return { pass: false, reason: "Evaluated state not found in graph" };

      // Verify evidence references exist in THIS state's perception
      const ref = finding.evidence.element_ref;
      if (!ref) return { pass: true };
      const exists = elementExistsInPerception(ref, evaluatedState.perception);
      if (!exists) return { pass: false, reason: `Element "${ref}" not in state ${finding.evaluated_state_id}` };
    }

    if (finding.analysis_scope === "transition") {
      // Verify before_ref in before state, after_ref in after state
      if (!finding.transition) return { pass: false, reason: "Transition finding missing transition data" };
      // ...validate before/after refs against respective states
    }

    return { pass: true };
  }
}
```

---

## 31.10 Heuristic Schema Extension

**REQ-SAA-070:** Add `analysis_scope` to `HeuristicSchemaExtended` (§9.10.2):

```typescript
// Add to HeuristicSchemaExtended
analysis_scope: AnalysisScopeEnum.default("global"),
// "global" = merged view (default, backward-compatible)
// "per_state" = evaluated per state independently
// "transition" = evaluated on state pairs (before→after)

// For transition heuristics: what interactions trigger evaluation
transition_triggers: z.array(z.enum([
  "variant_selection",      // size, color, quantity changes
  "filter_application",     // search/PLP filters, sort changes
  "form_submission",        // submit empty, submit invalid, submit valid
  "scroll_trigger",         // sticky elements, lazy-load, infinite scroll
  "disclosure_toggle",      // "show more", accordion expand
  "cart_action",            // add to cart, remove from cart
  "navigation_intent",      // "proceed to checkout", "continue shopping"
])).optional(),
```

---

## 31.11 Relationship to Existing Architecture

| Section | Impact |
|---|---|
| **§7 (Analyze Mode)** | Pipeline extended: evaluate node splits by scope, runs 3 parallel evaluation tracks |
| **§9.10 (Heuristic KB)** | New field: `analysis_scope`, `transition_triggers` |
| **§20 (State Exploration)** | Unchanged — exploration still captures states as before. This section changes how analysis CONSUMES them. |
| **§23 (Findings Engine)** | New finding fields: `analysis_scope`, `evaluated_state_id`, `transition`. Dedup logic extended for per-state findings. |
| **§5.7 (Unified State)** | New type: `StateDiff`. Extended: `StateAwareFinding`. |
| **§13.6 (Data Layer)** | Findings table: add `analysis_scope`, `evaluated_state_id`, `transition_data` columns |
| **§26 (Cost)** | Per-state + transition costs tracked separately. Page budget may need increase to $3-4. |

---

## 31.12 Implementation Phase

| Phase | Deliverable |
|---|---|
| **Phase 7 (MVP, with state exploration)** | Per-state analysis for `per_state` heuristics. Global analysis unchanged. Transition analysis deferred. |
| **Phase 9** | Transition analysis for `transition` heuristics. StateDiff computation. Full 3-mode pipeline. |
| **Phase 12** | Learning service calibrates `analysis_scope` effectiveness per client (auto-suggests scope changes). |

**MVP Note:** For MVP, implement per-state analysis first (the highest-value addition). Transition analysis can follow in Phase 9 because it requires more complex prompt engineering and diff computation.

---

## 31.13 Backward Compatibility

**REQ-SAA-080:** Heuristics without `analysis_scope` default to `"global"`. The merged-view analysis path is unchanged. Phase 1-5 implementations without state exploration produce `MultiStatePerception` with `hidden_states = []` — all heuristics evaluate against the single default state regardless of scope, which is correct.

**REQ-SAA-081:** Per-state analysis only activates when `stateGraph.states.length > 1`. For pages with only the default state (no exploration, or exploration found nothing meaningful), ALL heuristics fall back to global evaluation — equivalent to current behavior.

---

## 31.14 Failure Modes

| # | Failure | Detection | Response |
|---|---|---|---|
| **SAA-01** | Per-state evaluation budget exceeded mid-state | Cost check after each state's evaluation | Skip remaining states. Findings from evaluated states are valid. Note: `analysis_truncated`. |
| **SAA-02** | Per-state evaluation produces contradictory findings across states | Dedup detects same heuristic PASS in one state, VIOLATION in another | Keep BOTH as state-specific findings. This is the POINT — different states have different issues. |
| **SAA-03** | Transition diff computation fails | Exception in diff logic | Fall back to per-state evaluation for the two states. Skip transition analysis for this pair. |
| **SAA-04** | LLM returns findings referencing wrong state's data | GR-011 catches | Finding rejected. |
| **SAA-05** | Too many per-state heuristics × states exceeds token budget | Pre-flight cost check | Reduce per-state heuristics to top 10 by priority. Log truncation. |
| **SAA-06** | Transition prompt too long (large diff) | Token count check | Truncate diff to top 20 changes. Prioritize CTA, price, availability changes. |

---

## 31.15 Key Design Decisions

| Decision | Rationale |
|---|---|
| Split into 3 scopes, not 2 | "Per-state" and "transition" are fundamentally different questions: "what does THIS state look like?" vs "what CHANGED between states?" |
| Heuristic declares its own scope | The heuristic author knows whether the heuristic is state-dependent. The system doesn't guess. |
| Default scope = "global" | Backward-compatible. Existing heuristics work unchanged. |
| Per-state dedup keeps contradictory findings | A finding that passes in Tab 1 but fails in Tab 2 is NOT a duplicate — it's a state-dependent issue. Keeping both surfaces the real problem. |
| Transition diff is computed by CODE, quality assessed by LLM | Same pattern as evidence grounding: code detects facts, LLM interprets quality. |
| Cost mitigation via relevance filtering | Not every heuristic applies to every state. If a state only reveals reviews, don't evaluate form heuristics against it. |

---

**End of §31 — State-Aware Analysis Architecture**

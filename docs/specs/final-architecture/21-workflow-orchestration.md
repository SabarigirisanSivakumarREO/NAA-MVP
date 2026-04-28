---
title: 21-workflow-orchestration
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

# Section 21 — Workflow Orchestration

> **See also §33 — Agent Composition Model.** §33.11 adds a `workflowStepRestore` node specific to workflow orchestration: after `evaluate_interactive` runs at a workflow step, the system must verify reentry into that step before continuing. The Workflow Orchestrator topology below is extended (not replaced) by §33 — the funnel traversal logic stays; the inter-step state restoration uses §33's contract.

**Status:** Master architecture extension. Phase 13 implementation (per §16 v2.4). Implements C6 locked decision: workflow orchestration gets its own tier with a dedicated Workflow Analyzer.

**Cross-references:**
- §4 (Audit Orchestrator) — workflow orchestrator is a peer tier alongside page orchestrator
- §5.7.1 (`WorkflowContext`, `WorkflowStepRef`, `FunnelPosition`, `WorkflowId`) — types
- §6 (Browse Mode v3.1) — browser agent traverses workflow steps
- §7 (Analyze Mode) — per-step analysis uses the existing pipeline; cross-step synthesis is NEW
- §13.6.2 (`workflows`, `workflow_steps` tables) — persistence
- §19 (Discovery) — workflow synthesis feeds this section
- §23 (Findings Engine Extended) — workflow-scoped findings

---

## 21.1 Principle

> **A workflow is a unit of analysis above the page. "The checkout funnel has 3 friction points across steps 2 and 4" is a finding that no page-level analysis can produce. The Workflow Orchestrator traverses funnels, the Workflow Analyzer synthesises cross-step insights, and workflow-scoped findings represent conclusions that ONLY exist at the funnel level.**

---

## 21.2 Three-Tier Orchestration (context)

```
TIER 1: AUDIT ORCHESTRATOR (Temporal, durable)
  │
  ├──▶ TIER 2a: PAGE ORCHESTRATOR (LangGraph subgraph, per page)
  │         browse → [explore_states] → deep_perceive → analyze → persist
  │
  ├──▶ TIER 2b: WORKFLOW ORCHESTRATOR (LangGraph subgraph, per funnel) ← THIS SECTION
  │         step_1 (delegate to page orch) → verify_transition →
  │         step_2 (delegate) → ... → workflow_analyze → persist
  │
  └──▶ TIER 2c: COMPETITOR AUDIT (separate mode, §28)
```

**REQ-WORKFLOW-001:** The Workflow Orchestrator is a SEPARATE LangGraph subgraph, not an extension of the page orchestrator. It delegates per-step page analysis to the page orchestrator and adds cross-step orchestration + workflow-level analysis on top.

**REQ-WORKFLOW-002:** Workflows execute AFTER all their constituent pages have been individually analyzed as PAGE work items (§19.8 REQ-DISC-102). The Workflow Orchestrator reuses existing per-page findings + perception and adds cross-step traversal + synthesis.

---

## 21.3 Workflow Orchestrator Graph

```
┌──────────────┐
│ workflow_init │  Load workflow definition, verify all steps have page findings
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ step_router  │◄─────────────────────────────────────────┐
└──────┬───────┘                                          │
       │                                                  │
  (all steps done) ──→ workflow_analyze                   │
       │                                                  │
  (steps remain)                                          │
       │                                                  │
       ▼                                                  │
┌──────────────────────────────────────────┐              │
│ STEP EXECUTION                           │              │
│                                          │              │
│  1. Navigate to step URL (browse agent)  │              │
│  2. Verify correct page loaded           │              │
│  3. Execute step action (if any)         │              │
│     e.g., "add to cart", "proceed to     │              │
│     checkout", "fill shipping"           │              │
│  4. Capture step transition evidence     │              │
│  5. Verify transition to next step       │              │
└──────────────┬───────────────────────────┘              │
               │                                          │
          (success) ──→ step_router (next step) ──────────┤
          (failure) ──→ step_failed ──→ workflow_analyze   │
               │                                          │
               └──────────────────────────────────────────┘

┌────────────────────┐
│ workflow_analyze    │  Cross-step synthesis: funnel friction, drop-off risk,
│                     │  CTA consistency, trust signal continuity, form flow
└──────────┬─────────┘
           │
           ▼
┌────────────────────┐
│ workflow_persist    │  Store workflow findings + update workflow status
└────────────────────┘
```

---

## 21.4 Node Specifications

### Node: `workflow_init`

**REQ-WORKFLOW-NODE-001:**

| | |
|---|---|
| **Input** | `workflow_id`, `workflow` definition from §19 or custom, per-step page findings from DB |
| **Output** | `WorkflowContext` populated, step_index = 0, per-step findings loaded |
| **Precondition** | All step pages have been individually analyzed (PAGE work items completed) |
| **Postcondition** | `WorkflowContext.steps` has all step definitions with `traversal_success = false` |
| **Failure** | If any required step page has `status = "failed"`, mark workflow as `incomplete` and proceed with available steps |

### Node: `step_router`

**REQ-WORKFLOW-NODE-002:**

```typescript
function routeWorkflowStep(state: AuditState): "step_execute" | "workflow_analyze" {
  const wf = state.workflow_context!;
  if (wf.current_step_index >= wf.steps.length) return "workflow_analyze";
  if (wf.abandoned) return "workflow_analyze";
  if (wf.workflow_budget_spent_usd >= wf.workflow_budget_usd) {
    wf.abandoned = true;
    wf.abandon_reason = "budget_exceeded";
    return "workflow_analyze";
  }
  return "step_execute";
}
```

### Node: `step_execute`

**REQ-WORKFLOW-NODE-003:**

| | |
|---|---|
| **Input** | Current step definition, browser session, page findings for this step |
| **Output** | Step transition evidence, verification result, updated step status |
| **Browser** | (S9-L2-FIX) All steps MUST execute in the SAME Playwright browser context. Session cookies, cart state, and form data persist across steps. The workflow orchestrator acquires a single context at `workflow_init` and releases it at `workflow_persist`. |
| **Process** | 1. Navigate to step URL via browse agent (Tier A/B) |
| | 2. Verify the page matches expected page_type |
| | 3. If step requires an action (e.g., "click Add to Cart"): execute it |
| | 4. Verify the transition succeeded (URL changed, expected elements appeared) |
| | 5. Capture transition evidence: before/after screenshots, network requests, state changes |

**REQ-WORKFLOW-NODE-003a:** Step actions are defined per funnel type:

| Business type | Funnel | Step | Action |
|---|---|---|---|
| ecommerce | purchase | homepage → category | Click primary nav category link |
| ecommerce | purchase | category → product | Click first product tile |
| ecommerce | purchase | product → cart | Click "Add to Cart" CTA |
| ecommerce | purchase | cart → checkout | Click "Proceed to Checkout" |
| saas | signup | homepage → pricing | Click "Pricing" nav link |
| saas | signup | pricing → form | Click primary CTA ("Start Free Trial", "Sign Up") |
| leadgen | capture | landing → form | Click primary CTA |

**REQ-WORKFLOW-NODE-003b:** Step actions use the browser agent's existing tools (`browser_find_by_text`, `browser_click`). The workflow orchestrator provides the action intent; the browser agent resolves the exact element. If the element can't be found, the step is marked `failed` and the workflow proceeds to analysis with available data.

**REQ-WORKFLOW-NODE-003c:** Step transition verification uses the existing 9 verify strategies (§6.7). Primary strategy: `url_change` (expected pattern matches next step's URL pattern). Fallback: `element_appears` (expected elements for next page type are present).

### Node: `workflow_analyze`

**REQ-WORKFLOW-NODE-004:**

| | |
|---|---|
| **Input** | `WorkflowContext` with step statuses, per-step findings from DB, per-step perceptions, transition evidence |
| **Output** | Workflow-scoped findings (`scope = "workflow"`) |
| **Process** | Cross-step LLM analysis on specific dimensions (§21.5) |
| **LLM calls** | 1 (batched cross-step prompt) |
| **Postcondition** | Workflow findings pass through same grounding pipeline as page findings (GR-001..GR-009 applied against multi-step evidence) |

### Node: `workflow_persist`

**REQ-WORKFLOW-NODE-005:**

| | |
|---|---|
| **Input** | Workflow findings, workflow status, transition evidence |
| **Output** | Findings stored in `findings` table with `scope = "workflow"`, `workflow_id` set. Workflow status updated in `workflows` table. |

---

## 21.5 Cross-Step Analysis Dimensions

**REQ-WORKFLOW-ANALYZE-001:** The Workflow Analyzer evaluates these dimensions across steps:

| Dimension | What to look for | Evidence source |
|---|---|---|
| **Funnel friction** | Points where users are likely to drop off based on UX heuristics | Step transition success/failure + per-step findings severity |
| **CTA continuity** | Are CTAs consistent in style, language, urgency across steps? | CTAs from each step's perception |
| **Trust signal flow** | Do trust signals (reviews, badges, guarantees) persist through the funnel or disappear at critical moments? | Trust signals per step |
| **Form flow complexity** | Total field count across multi-step forms; are fields logically grouped? | Forms from each step |
| **Information scent** | Does the user always know where they are in the process? (progress bars, breadcrumbs, step indicators) | Navigation + layout per step |
| **Value reinforcement** | Is the value proposition reinforced at each step, or does it fade after the landing page? | Content analysis per step |
| **Error handling continuity** | If a user makes an error at step N, can they recover without re-entering data from step N-1? | Form validation states (from state exploration) |
| **Transition clarity** | Is it obvious what clicking the CTA will do? Are labels like "Continue" or "Next" sufficient? | CTA text + surrounding context per step |

### Workflow Analysis Prompt

**REQ-WORKFLOW-ANALYZE-002:**

```
SYSTEM:
You are a CRO funnel analyst. You evaluate multi-step user journeys
for friction, inconsistency, and drop-off risk.

RULES:
- Cite specific data from the step summaries below.
- Do NOT predict conversion rates or revenue impact.
- Focus on cross-step issues that page-level analysis cannot detect.
- If a step was skipped or failed, note the gap but do not speculate.

USER:
WORKFLOW: {{workflow.name}} ({{workflow.business_model}})
STEPS TRAVERSED: {{workflow.steps_traversed}} / {{workflow.expected_steps}}

{{for each step}}
STEP {{step.step_index + 1}}: {{step.page_type}} ({{step.funnel_position}})
URL: {{step.page_url}}
Traversal: {{step.traversal_success ? "success" : "FAILED: " + step.failure_reason}}
Key CTAs: {{step.perception.ctas.slice(0,3) | json}}
Trust signals: {{step.perception.trustSignals | json}}
Forms: {{step.perception.forms | json}}
Page findings count: {{step.step_findings_count}}
Top findings (up to 3, S5-L2-FIX): {{step.top_findings_summary}}
{{end}}

TRANSITION EVIDENCE:
{{transition_evidence | json}}

EVALUATE these cross-step dimensions:
1. Funnel friction points
2. CTA continuity
3. Trust signal flow
4. Form flow complexity
5. Information scent (progress indicators)
6. Value reinforcement
7. Error handling continuity
8. Transition clarity

For each dimension, respond with JSON:
{
  "dimension": "CTA continuity",
  "status": "issue" | "good" | "not_applicable",
  "observation": "specific cross-step observation with data",
  "affected_steps": [1, 3],
  "recommendation": "specific actionable fix",
  "evidence": {
    "step_references": ["step_1.ctas[0]", "step_3.ctas[0]"],
    "data_point": "CTA style changes from orange button to blue text link"
  }
}
```

### Workflow Finding Schema

**REQ-WORKFLOW-ANALYZE-003:** Workflow findings use the same `Finding` schema as page findings (§13.1 + C1 fix), with:
- `scope = "workflow"`
- `workflow_id` set
- `page_url = null` (workflow-level, not page-level)
- `state_ids` references the entry/exit states of affected steps
- `evidence_ids` links to transition evidence + per-step perceptions

---

## 21.6 Workflow Grounding

**REQ-WORKFLOW-GROUND-001:** Workflow findings pass through the SAME grounding pipeline as page findings (GR-001..GR-009), but with multi-step evidence:

- **GR-001 (element exists):** verified against the step-specific perception, not a single page
- **GR-002 (fold claims):** verified per step
- **GR-007 (no conversion prediction):** enforced on all workflow findings
- **GR-009 (state provenance):** if a workflow finding cites hidden-state content from a specific step, provenance must trace to that step's state graph

**REQ-WORKFLOW-GROUND-002:** Additional workflow-specific grounding rule:

```typescript
{
  id: "GR-010",
  description: "Cross-step finding must reference at least 2 different steps",
  check: (finding) => {
    if (finding.scope !== "workflow") return { pass: true };
    const stepsReferenced = new Set(finding.evidence?.step_references?.map(r => r.split(".")[0]) ?? []);
    if (stepsReferenced.size < 2) {
      return { pass: false, reason: "Workflow finding references only 1 step — should be a page finding" };
    }
    return { pass: true };
  }
}
```

---

## 21.7 Workflow Completion

**REQ-WORKFLOW-COMPLETE-001:** A workflow is marked `completed` when:
- All steps have been traversed (success or failed)
- Workflow analysis has produced findings
- Findings have been grounded and persisted

**REQ-WORKFLOW-COMPLETE-002:** A workflow is marked `abandoned` when:
- Budget exceeded mid-traversal
- A step fails and no skip-ahead is possible (e.g., can't reach checkout without cart)
- Runtime cap exceeded

**REQ-WORKFLOW-COMPLETE-003:** Abandoned workflows still trigger `workflow_analyze` with available data. Partial workflow findings are valid — they just cite fewer steps.

---

## 21.8 Relationship to Cross-Page Consistency (§10)

The existing §10 "Cross-Page Consistency Analysis" checks for VISUAL consistency (CTA styling, nav structure, colors, typography) across pages of the SAME site. This is different from workflow analysis:

| | Cross-Page Consistency (§10) | Workflow Analysis (§21) |
|---|---|---|
| Unit | All pages of a site | Steps of a specific funnel |
| Concern | Visual/brand consistency | Funnel friction, user journey |
| Findings scope | `scope = "audit"` level | `scope = "workflow"` |
| Requires step traversal? | No — uses stored perceptions | Yes — traverses funnel in order |
| Requires transition evidence? | No | Yes |

**REQ-WORKFLOW-010:** Both §10 and §21 can coexist. §10 runs after all pages are analyzed (it always did). §21 runs as WORKFLOW work items from the queue. They produce different finding types that don't overlap.

---

## 21.9 Caps and Budget

| Cap | Default | Enforcement |
|---|---|---|
| Max workflows per audit | 5 | §19.6 |
| Max steps per workflow | 8 | Hard cap |
| Workflow budget USD | $3.00 | `WorkflowContext.workflow_budget_usd` |
| Workflow LLM calls | 1 (cross-step analysis) + per-step (reuses page analysis) | Bounded |
| Workflow runtime | 10 minutes | Hard cap |
| Step transition timeout | 15s | Per step |
| Max step transition retries | 2 | Per step |

---

## 21.10 Failure Modes (Additions to §15)

| # | Failure | Detection | Response |
|---|---|---|---|
| **WF-01** | Step page was not analyzed (PAGE item failed) | Missing page findings in DB | Mark step as `skipped`. Workflow proceeds with available steps. |
| **WF-02** | Step transition fails (CTA not found, navigation didn't work) | Verify strategy fails | Retry once with alternative CTA detection. If still fails, mark step `failed`, proceed. |
| **WF-03** | Funnel interrupted by login wall | Login form detected mid-funnel | HITL escalation (existing §6.9 F-09). Workflow pauses. |
| **WF-04** | Funnel interrupted by CAPTCHA | CAPTCHA detected mid-funnel | HITL escalation. Workflow pauses. |
| **WF-05** | All steps fail traversal | 0 successful steps | Workflow marked `abandoned: all_steps_failed`. No workflow analysis. Log for consultant review. |
| **WF-06** | Workflow analysis LLM returns malformed output | Zod validation fails | Retry once. If still fails, log `workflow_analysis_error`. No workflow findings. |
| **WF-07** | Workflow budget exceeded mid-traversal | Cost check after each step | Mark `abandoned: budget_exceeded`. Analyze available steps. |
| **WF-08** | Step produces 0 page findings (clean page) | Finding count = 0 for step | Valid result — step is fine. Cross-step analysis still evaluates transitions. |

---

## 21.11 Implementation Phase Mapping

| Phase | Deliverable |
|---|---|
| **9** | (FS-2-FIX: corrected from Phase 8 to Phase 9 per §16.5 C1-L3-FIX) Workflow orchestrator subgraph, step_router, step_execute, workflow_analyze, workflow_persist, GR-010, cross-step prompt |
| **9** | Integration with page orchestrator (delegate per-step analysis) |
| **10** | (FS-2-FIX: corrected from Phase 9 to Phase 10) Competitor workflow comparison (same funnel, different sites) — links to §28 |
| **11** | Consultant dashboard: funnel visualiser, step-by-step finding view, transition evidence |
| **11** | Client dashboard: funnel summary view |

---

**End of §21 — Workflow Orchestration**

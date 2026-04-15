# Section 26 — Cost Architecture & Operational Guardrails

**Status:** Master architecture extension. Foundational from Phase 6; extends §11 (Safety & Cost).

**Cross-references:**
- §11 (Safety, Rate Limits & Cost) — existing per-audit/per-page caps; this section adds layered budgets + pre-flight estimation
- §18 (`AuditRequest.budget`) — budget inputs from trigger gateway
- §5.7.2 (exploration_cost_usd, exploration_budget_usd) — state fields
- §20 (State Exploration) — per-page exploration budget
- §21 (Workflow Orchestration) — per-workflow budget

---

## 26.1 Principle

> **Cost is a first-class signal, not a post-hoc check. Every work item gets a pre-flight cost estimate before execution. Every layer has its own budget gate. The system halts gracefully when any budget is exceeded — it never produces partial, unchecked output and calls it done.**

---

## 26.2 Layered Budget Model

```
AUDIT BUDGET (top-level, from AuditRequest.budget.max_total_usd)
    │
    ├── DISCOVERY BUDGET (fixed: ~$0.05, §19)
    │
    ├── PAGE BUDGET × N pages (from AuditRequest.budget.max_per_page_usd)
    │     │
    │     ├── BROWSE COST (navigation + stabilisation)
    │     ├── EXPLORATION COST (Pass 1 + Pass 2, §20)
    │     ├── PERCEPTION COST (page_analyze, screenshots — negligible)
    │     └── ANALYSIS COST (evaluate LLM + critique LLM + annotation)
    │
    ├── WORKFLOW BUDGET × M workflows (from WorkflowContext.workflow_budget_usd)
    │     │
    │     ├── STEP TRAVERSAL COST (browse agent per step)
    │     └── WORKFLOW ANALYSIS COST (1 LLM call)
    │
    └── POST-PROCESSING (rollup, scoring, annotation — negligible, no LLM)
```

---

## 26.3 Budget Defaults

| Scope | Default | Max override | Source |
|---|---|---|---|
| Audit total | $15.00 | $100.00 | `AuditRequest.budget.max_total_usd` — **this is the real constraint** |
| Per page | $2.00 | $10.00 | `AuditRequest.budget.max_per_page_usd` |
| Exploration (per page) | $0.50 | $2.00 | `AuditState.exploration_budget_usd` |
| Per workflow | $3.00 | $15.00 | `WorkflowContext.workflow_budget_usd` |
| Max runtime | 120 min | 480 min | `AuditRequest.budget.max_runtime_minutes` |
| Max pages | 50 | 200 | `AuditRequest.budget.max_pages` |
| Max LLM calls | 200 | 1000 | `AuditRequest.budget.max_llm_calls` |
| Max states per page | 15 | 30 | `AuditRequest.scope.state_exploration.max_states_per_page` |
| Max workflows | 5 | 10 | Hard cap |

**(S8-L2-FIX) Important:** Per-item budgets (per-page, per-workflow, per-exploration) are **CAPS per item**, not guaranteed allocations. Pre-flight estimation (§26.4) checks each item against **remaining audit budget**, not against per-item cap. A $2.00 page cap means "never spend more than $2 on one page" — it doesn't mean every page gets $2.00. The audit total budget is the hard ceiling; per-item caps prevent any single item from dominating.

---

## 26.4 Pre-Flight Cost Estimation

**REQ-COST-001:** Before each work item is dequeued, estimate its cost:

```typescript
interface CostEstimate {
  item_id: string;
  item_type: "page" | "workflow";
  estimated_browse_usd: number;
  estimated_exploration_usd: number;
  estimated_analysis_usd: number;
  estimated_total_usd: number;
  confidence: "high" | "medium" | "low";
  basis: string;                    // e.g., "similar page_type average from past 10 audits"
}

function estimatePageCost(pageType: PageType, stateExplorationPolicy: string): CostEstimate {
  // Base costs from §11.5 cost model
  const browse = 0.10;
  const analysis = 0.20;   // evaluate + critique

  // Exploration depends on policy
  const exploration = {
    heuristic_primed_only: 0.05,
    with_auto_escalation: 0.15,
    thorough_mode: 0.35,
  }[stateExplorationPolicy] ?? 0.15;

  return {
    estimated_browse_usd: browse,
    estimated_exploration_usd: exploration,
    estimated_analysis_usd: analysis,
    estimated_total_usd: browse + exploration + analysis,
    confidence: "medium",
    basis: "default cost model",
  };
}
```

**REQ-COST-002:** If `audit_spent_usd + estimated_total_usd > audit_budget_usd`, the work item is skipped with status `budget_skipped`. The audit continues with remaining items that fit within budget.

**REQ-COST-003:** Pre-flight estimation improves over time using historical cost data from past audit runs (Phase 12+).

### §33 Integration — Interactive Evaluation Costs

**REQ-COST-004 (§33):** Pre-flight cost estimation MUST account for `composition_mode` when estimating analysis cost:

| `composition_mode` | LLM turns per evaluation | Analysis cost multiplier (vs static) |
|---|---|---|
| `static` | 1 evaluate call | 1x (baseline) |
| `interactive_standard` | ~5 tool-use turns (ReAct loop) | ~2-3x |
| `interactive_deep` | ~15 tool-use turns (ReAct loop) | ~5-8x |

**REQ-COST-005 (§33):** The "Before evaluate LLM call" budget gate (§26.5, REQ-COST-010) MUST wrap the **entire ReAct loop** (all turns), not just the first call. The gate checks estimated cost for the full interaction sequence before the loop begins, and running cost is tracked across all turns within the loop. If the page budget is exhausted mid-loop, the agent completes its current turn, emits partial findings, and exits gracefully.

**REQ-COST-006 (§33):** Browser interaction overhead within interactive evaluations has ~$0 additional LLM cost (tool execution is Playwright, not LLM-driven) but adds ~1-3 seconds latency per interaction. Pre-flight runtime estimation should factor in `composition_mode` for wall-clock time: `interactive_standard` adds ~15-25s, `interactive_deep` adds ~45-90s per page.

---

## 26.5 Runtime Budget Gates

**REQ-COST-010:** Budget checks occur at these decision points:

| Decision point | Check | Action on failure |
|---|---|---|
| Work item dequeue | Pre-flight estimate vs remaining audit budget | Skip item (`budget_skipped`) |
| Before browse subgraph | Remaining page budget > 0 | Skip page |
| Before each browse LLM call | Estimated call cost vs remaining page budget | Terminate browse, proceed to analyze with available perception |
| Before explore_states Pass 1 | Exploration budget > 0 | Skip exploration, use default state only |
| Before explore_states Pass 2 | Exploration budget > 0 after Pass 1 | Skip Pass 2 |
| Before evaluate LLM call | Estimated call cost vs remaining page budget | Skip evaluation, mark page `budget_exceeded` |
| Before critique LLM call | Estimated call cost vs remaining page budget | Skip critique (finding quality degrades but findings still grounded) |
| Before workflow step traversal | Remaining workflow budget > 0 | Skip step, mark `budget_exceeded` |
| Before workflow analysis LLM call | Estimated call cost vs remaining workflow budget | Skip analysis, use per-step findings only |
| After each LLM call | Actual cost recorded | Update running totals |

**REQ-COST-011:** Budget exhaustion at any level triggers `graceful_stop`:
1. Complete the current step (don't leave partial state)
2. Persist whatever findings are available
3. Mark the item/audit with `budget_exceeded` status
4. Emit SSE event: `budget_warning` or `budget_exceeded`

---

## 26.6 Cost Tracking

**REQ-COST-020:** Every LLM call records:

```typescript
interface CostRecord {
  audit_run_id: string;
  page_url?: string;
  workflow_id?: string;
  node: string;                     // evaluate, critique, comparison, workflow_analysis, discovery_classify
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  timestamp: number;
}
```

**REQ-COST-021:** Running totals maintained at:
- `AuditState.budget_remaining_usd` (audit-wide)
- `AuditState.analysis_cost_usd` (analysis pipeline cumulative)
- `AuditState.exploration_cost_usd` (exploration cumulative)
- `StateGraph.exploration_cost_usd` (per-page exploration)
- `WorkflowContext.workflow_budget_spent_usd` (per-workflow)

**REQ-COST-022:** At audit completion, total cost is written to `audit_runs.total_cost_usd`. Historical cost data feeds pre-flight estimation improvement.

---

## 26.7 Kill-Switch

**REQ-COST-030:** A global admin kill-switch that immediately terminates all running audits:

```typescript
interface KillSwitch {
  // Halt ALL running audits for a tenant
  haltClient(clientId: string, reason: string): Promise<void>;

  // Halt ALL running audits globally (emergency)
  haltGlobal(reason: string): Promise<void>;

  // Halt a specific audit
  haltAudit(auditRunId: string, reason: string): Promise<void>;
}
```

**REQ-COST-031:** Kill-switch is implemented via Temporal workflow cancellation. The Temporal worker catches the cancellation signal, persists current state, and exits cleanly.

**REQ-COST-032:** Kill-switch is accessible from: admin API endpoint, consultant dashboard admin panel, CLI (`reo-cli admin halt --client-id=...`).

---

## 26.8 Low-Signal Suppression

**REQ-COST-040:** Beyond finding-level suppression (§23.5), the cost architecture suppresses PROCESSING of low-signal items:

| Signal | Suppression |
|---|---|
| Template with 1 member + classified as "other" | Deprioritize to last in queue. Skip if budget <30% remaining. |
| Page with 0 interactive elements (detected in shallow fetch) | Skip state exploration entirely (no content to explore). |
| Workflow with >50% steps failed | Analyse with available data, don't retry failed steps. |
| Template already analysed in previous audit version (unchanged) | Skip analysis, carry forward previous findings with `version_carryforward` flag. |

---

## 26.9 Early Stop Conditions

**REQ-COST-050:** The audit orchestrator MAY stop early (before all queue items processed) when:

| Condition | Check frequency | Action |
|---|---|---|
| Budget < 10% remaining AND > 70% of templates covered | After each page | `completed_early: budget_conservation` |
| Runtime > 80% of cap AND > 70% of templates covered | After each page | `completed_early: runtime_conservation` |
| Last 5 pages produced 0 findings (all clean) | After each page | Log `low_yield_streak`, continue (do NOT stop — clean pages are valid) |
| All funnel-critical templates (checkout, cart, product, pricing, form, homepage — M9-L2-FIX) analysed | After each page | May skip remaining "other" templates if budget is tight |

**REQ-COST-051:** Early stop is NEVER silent. It sets `audit_runs.status = "completed_partial"` and records the stop reason. Consultant dashboard shows exactly which templates were skipped and why.

---

## 26.10 Failure Modes

| # | Failure | Detection | Response |
|---|---|---|---|
| **CG-01** | Audit budget exceeded mid-page | Cost check after LLM call | Complete current step, persist partial, mark `budget_exceeded` |
| **CG-02** | Page budget exceeded mid-analysis | Same | Skip remaining analysis steps, persist what's grounded |
| **CG-03** | Exploration budget exceeded mid-Pass-2 | Same | Halt exploration, proceed with captured states |
| **CG-04** | Runtime cap exceeded | Timer | Same as budget exceeded — graceful stop |
| **CG-05** | Cost tracking drift (actual > estimated by >50%) | Post-LLM-call comparison | Alert to observability. Adjust estimation model. |
| **CG-06** | Kill-switch activated | Temporal cancellation signal | Persist state, exit cleanly, mark `admin_halted` |
| **CG-07** | LLM provider price change | Cost estimate vs actual diverges | Alert. Update cost model. Does NOT stop running audits. |
| **CG-08** | Pre-flight estimation wildly wrong | Historical data insufficient | Fall back to conservative defaults. Log for model training. |

---

## 26.11 Implementation Phase Mapping

| Phase | Deliverable |
|---|---|
| **6** | Layered budget model, per-page + per-audit gates, cost tracking, pre-flight estimation (default model) |
| **6** | SSE budget events (warning at 80%, exceeded at 100%) |
| **7** | Exploration budget integration (per-page exploration cost tracking) |
| **8** | Workflow budget gates, early stop conditions |
| **11** | Consultant dashboard: cost breakdown per audit, cost trend charts, kill-switch UI |
| **12** | Historical cost model training (pre-flight estimation improvement) |
| **13** | Global kill-switch + admin API, low-signal suppression rules |

---

**End of §26 — Cost Architecture & Operational Guardrails**

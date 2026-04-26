---
title: 27-durable-orchestration
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

# Section 27 — Durable Orchestration (Temporal + LangGraph)

**Status:** Master architecture extension. Phase 6 (post-MVP). Implements C8 locked decision: Temporal outer + LangGraph inner.

**Cross-references:**
- §4 (Audit Orchestrator) — existing LangGraph-based orchestrator; this section wraps it with Temporal
- §18 (Trigger Gateway) — starts Temporal workflows
- §25 (Reproducibility) — Temporal provides durable audit run state
- §26 (Cost & Guardrails) — kill-switch via Temporal workflow cancellation

---

## 27.1 Principle

> **LangGraph.js is excellent for stateful AI agent subgraphs — perception, reasoning, action, verification loops. It is NOT designed for multi-hour, multi-worker, crash-recoverable workflow orchestration. Temporal is. Use each tool for what it's best at.**

---

## 27.2 Why LangGraph Alone Is Insufficient

| Concern | LangGraph Postgres Checkpointer | Temporal |
|---|---|---|
| Worker crash recovery | Checkpoint exists but no automatic restart | Automatic retry with configurable policy |
| Multi-hour workflows | Works but checkpoint bloat grows | Designed for long-running workflows |
| Worker pool management | Not handled | Native task queues with worker routing |
| Visibility/debugging | LangSmith traces (good for AI calls) | Temporal Web UI (full workflow history, pending activities) |
| Cancellation/kill-switch | No built-in mechanism | Native workflow cancellation with cleanup handlers |
| Scheduling | Not supported | Native cron schedules (S4-FIX) |
| Retry policies | Per-node retry in graph edges | Per-activity retry with exponential backoff, max attempts, timeouts |
| Concurrency control | Application-level | Native rate limiting per task queue |
| Versioning | Checkpoint schema must be backward-compatible | Workflow versioning with deterministic replay |

---

## 27.3 Architecture: Two-Layer Orchestration

```
TEMPORAL LAYER (durable, long-running, crash-recoverable)
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  AuditWorkflow (Temporal Workflow)                           │
│  ├── activity: resolveClient()                               │
│  ├── activity: loadReproducibilitySnapshot()                 │
│  ├── activity: runDiscovery()                 → §19          │
│  ├── activity: buildWorkQueue()               → §19.8        │
│  │                                                           │
│  │  for each PAGE work item:                                 │
│  │  ├── activity: runPageOrchestrator()       → LangGraph    │
│  │  └── activity: persistPageResults()                       │
│  │                                                           │
│  │  for each WORKFLOW work item:                             │
│  │  ├── activity: runWorkflowOrchestrator()   → LangGraph    │
│  │  └── activity: persistWorkflowResults()                   │
│  │                                                           │
│  ├── activity: runRollupAndScoring()          → §23          │
│  ├── activity: runCrossPageConsistency()      → §10          │
│  ├── activity: applyReviewGate()              → §24          │
│  └── activity: finalizeAudit()                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘

LANGGRAPH LAYER (stateful AI subgraphs, per-page or per-workflow)
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  PageOrchestrator (LangGraph.js compiled graph)              │
│  ├── perceive → reason → act → verify (loop)                │
│  ├── explore_states (§20)                                    │
│  ├── deep_perceive                                           │
│  ├── evaluate → self_critique → ground → annotate            │
│  └── returns: PageExecutionResult                            │
│                                                              │
│  WorkflowOrchestrator (LangGraph.js compiled graph)          │
│  ├── step_router → step_execute (loop)                       │
│  ├── workflow_analyze                                        │
│  └── returns: WorkflowExecutionResult                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 27.4 Temporal Workflow Definition

**REQ-DURABLE-001:**

```typescript
// Temporal workflow — the top-level audit orchestrator
@workflow()
export class AuditWorkflow {
  @signal()
  async cancelAudit(reason: string): Promise<void> {
    this.cancelled = true;
    this.cancelReason = reason;
  }

  @query()
  getProgress(): AuditProgress {
    return this.progress;
  }

  async execute(request: AuditRequest): Promise<AuditResult> {
    // 1. Init
    const client = await executeActivity(resolveClient, { clientId: request.client_id });
    // §18 REQ-TRIGGER-PERSIST-003: the gateway creates the reproducibility snapshot
    // before workflow start. This activity loads and validates the existing snapshot.
    const snapshot = await executeActivity(loadReproducibilitySnapshot, { request, client });

    // 2. Discovery (§19)
    const discovery = await executeActivity(runDiscovery, {
      request, client, snapshot,
    }, { startToCloseTimeout: "5m", retry: { maximumAttempts: 2 } });

    // 3. Process PAGE items
    for (const item of discovery.work_queue.filter(i => i.type === "page")) {
      if (this.cancelled) break;
      if (!this.budgetAllows(item)) { this.skipItem(item, "budget"); continue; }

      this.progress.currentItem = item;
      const result = await executeActivity(runPageOrchestrator, {
        item, request, client, snapshot, discovery,
      }, {
        startToCloseTimeout: "5m",           // S6-L2-FIX: increased from 3m — pages with escalation may take 4-5m
        heartbeatTimeout: "30s",             // LangGraph emits heartbeats
        retry: { maximumAttempts: 2, initialInterval: "5s" },
      });

      await executeActivity(persistPageResults, { result });
      this.updateBudget(result.cost_spent_usd);
      this.progress.pagesCompleted++;
    }

    // 4. Process WORKFLOW items
    for (const item of discovery.work_queue.filter(i => i.type === "workflow")) {
      if (this.cancelled) break;
      if (!this.budgetAllows(item)) { this.skipItem(item, "budget"); continue; }

      const result = await executeActivity(runWorkflowOrchestrator, {
        item, request, client, snapshot, discovery,
      }, {
        startToCloseTimeout: "12m",
        heartbeatTimeout: "30s",
        retry: { maximumAttempts: 1 },       // workflows are expensive to retry
      });

      await executeActivity(persistWorkflowResults, { result });
      this.updateBudget(result.cost_spent_usd);
      this.progress.workflowsCompleted++;
    }

    // 5. Post-processing
    await executeActivity(runRollupAndScoring, { auditRunId: this.auditRunId });
    await executeActivity(runCrossPageConsistency, { auditRunId: this.auditRunId });
    await executeActivity(applyReviewGate, { auditRunId: this.auditRunId, warmupActive: client.warmup_mode_active });

    // 6. Finalize
    return await executeActivity(finalizeAudit, {
      auditRunId: this.auditRunId,
      cancelled: this.cancelled,
      cancelReason: this.cancelReason,
    });
  }
}
```

---

## 27.5 Temporal Activities

**REQ-DURABLE-010:** Each Temporal activity wraps a specific capability:

| Activity | What it does | Timeout | Retries |
|---|---|---|---|
| `resolveClient` | Load client profile from DB | 10s | 3 |
| `loadReproducibilitySnapshot` | Load + validate existing snapshot (§25); created by gateway per §18 REQ-TRIGGER-PERSIST-003 | 10s | 2 |
| `runDiscovery` | Full discovery pipeline (§19) | 5m | 2 |
| `runPageOrchestrator` | Compile + run LangGraph page subgraph | 5m (S6-L2-FIX) | 2 |
| `persistPageResults` | Write findings + screenshots to DB/R2 | 30s | 3 |
| `runWorkflowOrchestrator` | Compile + run LangGraph workflow subgraph | 12m | 1 |
| `persistWorkflowResults` | Write workflow findings to DB | 30s | 3 |
| `runRollupAndScoring` | Dedup, merge, score (§23) | 60s | 2 |
| `runCrossPageConsistency` | Cross-page consistency check (§10) | 60s | 2 |
| `applyReviewGate` | Apply publish rules (§24) | 30s | 3 |
| `finalizeAudit` | Update audit_runs status, emit completion event | 10s | 3 |

**§33 Integration Note:** When `composition_mode = "interactive"`, the `runPageOrchestrator` activity timeout SHALL be extended. Standard interactive: 7 minutes. Deep interactive: 10 minutes. The heartbeat mechanism (REQ-DURABLE-011) covers long-running interactive evaluate loops within these timeouts. The `startToCloseTimeout` is set dynamically based on the `composition_mode` field in AuditState.

**REQ-DURABLE-011:** `runPageOrchestrator` and `runWorkflowOrchestrator` emit Temporal heartbeats every 10s. (X4-L2-FIX) Note: `runPageOrchestrator` may take up to 2x normal duration if the self-critique escalation loop (§20.7) triggers Pass 2 state exploration + re-analysis. The 5m timeout (S6-L2-FIX) accounts for this. The LangGraph execution loop calls `context.heartbeat()` on each node transition. If heartbeat stops for >30s, Temporal considers the activity failed and triggers retry.

---

## 27.6 LangGraph ↔ Temporal Boundary

**REQ-DURABLE-020:** The LangGraph subgraphs (page + workflow) run INSIDE Temporal activities. They are stateless from Temporal's perspective — Temporal owns crash recovery, not LangGraph's checkpointer.

**REQ-DURABLE-021:** LangGraph's Postgres checkpointer is RETAINED for fine-grained state within a single page execution (e.g., the perceive→reason→act→verify loop across 20 iterations). If the LangGraph execution crashes mid-loop, the Temporal activity retries from scratch (with a fresh LangGraph graph), NOT from a LangGraph checkpoint.

**REQ-DURABLE-022:** Rationale: LangGraph checkpoint resume after a crash is fragile — browser state is lost, mutation observers are gone, the page may have changed. A fresh retry with a new browser session is more reliable than trying to resume a half-completed browser interaction.

**REQ-DURABLE-023:** The LangGraph checkpointer is still useful for:
- Debugging: inspect intermediate state of a failed page execution
- HITL: pause at `interrupt()`, persist state, resume after human response
- Long pages: if a page takes >3 minutes, the LangGraph state is available for diagnostics

---

## 27.7 Crash Recovery Scenarios

| Scenario | Temporal behavior | Outcome |
|---|---|---|
| Worker process killed mid-page | Activity times out (heartbeat stops) → retry activity from scratch (new browser session). (S7-L2-FIX) Activity cancellation handler closes Playwright browser context via `BrowserManager.cleanup()` before returning. Orphaned browser processes detected + killed by health check worker. | Page re-executed. Cost: ~$0.35 (one page repeated). |
| Worker process killed mid-workflow | Same — retry activity | Workflow re-traversed from step 1. Cost: ~$3.00. |
| Database unavailable during persist | Persist activity fails → retry with backoff | Findings eventually persisted. Page not re-executed. |
| Temporal server restarts | Workflow history is durable — resumes from last completed activity | No data loss. Running activity retries. |
| Entire cluster restarts | Same — Temporal history in Postgres | Full audit resumes from last checkpoint. |
| Budget exceeded during retry | Budget check fires on dequeue of retried item | Item skipped (`budget_skipped`) instead of re-executed. |
| LLM provider outage during page activity | Activity fails with provider error → retry after interval | Retried activity may succeed if provider recovers. Max 2 retries then skip page. |

---

## 27.8 Temporal Task Queues

**REQ-DURABLE-030:** Two task queues:

| Queue | Workers | Purpose |
|---|---|---|
| `audit-orchestration` | 2-4 | Runs `AuditWorkflow` (lightweight — orchestration logic only) |
| `audit-execution` | 4-8 | Runs activities: `runPageOrchestrator`, `runWorkflowOrchestrator` (heavyweight — browser + LLM) |

**REQ-DURABLE-031:** Execution workers each manage their own Playwright browser pool (1-2 concurrent browsers per worker). Workers are horizontally scalable.

**REQ-DURABLE-032:** Concurrency control: max 1 audit workflow per client at a time. Enforced by the trigger gateway (§18 REQ-TRIGGER-RATE-004) and backed by a Temporal search attribute check.

---

## 27.9 SSE Integration

**REQ-DURABLE-040:** The Temporal workflow emits progress data via Temporal queries (not SSE directly). The API layer polls the Temporal query endpoint and pushes events to clients via SSE:

```
Browser/Dashboard ←── SSE ←── API Layer ←── Temporal Query ←── AuditWorkflow.getProgress()
```

**REQ-DURABLE-041:** Query polling interval: 2s. SSE events are debounced to 1 event per second max. This is lower overhead than having the workflow directly push SSE events.

**REQ-DURABLE-041a:** (M5-L2-FIX) Implementation: the API server uses a background timer (`setInterval(2000)`) per active SSE connection to poll the Temporal query endpoint. When the audit completes, the timer is cleared and the SSE connection closed. Max concurrent SSE connections per API instance: 100 (configurable). Excess connections rejected with HTTP 503.

---

## 27.10 Migration from Phase 1-5 (LangGraph-only)

**REQ-DURABLE-050:** Phase 1-5 MVP uses LangGraph Postgres checkpointer for the outer orchestrator (§4). Phase 6 introduces Temporal as the outer layer:

| Phase | Outer orchestrator | Inner subgraphs |
|---|---|---|
| 1-5 (MVP) | LangGraph compiled graph + Postgres checkpointer | N/A (single graph) |
| 6+ | Temporal `AuditWorkflow` | LangGraph page/workflow subgraphs as activities |

**REQ-DURABLE-051:** Migration path:
1. Phase 6: introduce Temporal alongside existing LangGraph orchestrator (feature flag)
2. Phase 6: new audits use Temporal by default; flag allows fallback to LangGraph-only
3. Phase 7: LangGraph-only orchestrator deprecated
4. Phase 8: LangGraph-only orchestrator removed

**REQ-DURABLE-052:** The LangGraph page subgraph (browse + explore + analyze) does NOT change. It compiles and runs the same way in both modes. The only change is WHO calls it: Phase 1-5, the LangGraph outer graph calls it as a subgraph. Phase 6+, a Temporal activity calls it as a function.

---

## 27.11 Failure Modes

| # | Failure | Detection | Response |
|---|---|---|---|
| **DO-01** | Temporal server unavailable at audit trigger time | Connection error in gateway | Return HTTP 503. Audit not started. Caller retries. |
| **DO-02** | Temporal server goes down mid-audit | Workflow replay fails on restart | Temporal auto-recovers from history. No data loss. Alerts to ops. |
| **DO-03** | Activity timeout (heartbeat lost) | Temporal schedules retry | Activity re-executed. If browser state is stale, fresh session starts. |
| **DO-04** | Activity fails max retries | Temporal marks activity failed | Workflow handles: skip item, continue with remaining. |
| **DO-05** | Workflow cancelled via kill-switch | Signal handler sets `cancelled = true` | Current activity completes, remaining items skipped, audit finalised with `admin_halted`. |
| **DO-06** | Temporal history exceeds size limit | Very large audit (200+ pages) | Use `continueAsNew()` to start a fresh workflow. **Threshold:** `continueAsNew()` fires when the Temporal workflow history exceeds 40,000 events OR 40MB serialized size, whichever comes first. For reference: a 50-page audit with state exploration produces approximately 500-2,000 events per page, so `continueAsNew` typically fires around page 25-50. (M6-L2-FIX) Pass: accumulated `AuditProgress` + remaining `work_queue` items + `reproducibility_snapshot_id`. Already-completed pages NOT included in continued state — their results are in the DB. |
| **DO-07** | Worker pool exhausted (all workers busy) | Activities queue but don't start | Temporal queues activities until a worker is free. No data loss. May exceed runtime cap. |
| **DO-08** | LangGraph subgraph crashes inside activity | Unhandled exception | Temporal retries the activity (fresh LangGraph graph + fresh browser). |

---

## 27.12 Implementation Phase Mapping

| Phase | Deliverable |
|---|---|
| **6** | Temporal server deployment (Docker Compose dev, Fly.io/managed prod), `AuditWorkflow` definition, activity wrappers, task queue setup, feature flag for LangGraph-only fallback |
| **6** | SSE integration via Temporal queries |
| **7** | `runPageOrchestrator` activity with state exploration heartbeat integration |
| **8** | `runWorkflowOrchestrator` activity |
| **8** | LangGraph-only orchestrator deprecated |
| **13** | Temporal Schedules for recurring audits (S4-FIX), worker pool scaling, Temporal Web UI for ops |

---

**End of §27 — Durable Orchestration (Temporal + LangGraph)**

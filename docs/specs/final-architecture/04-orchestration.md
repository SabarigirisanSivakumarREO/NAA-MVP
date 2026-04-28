---
title: 04-orchestration
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

# Section 4 — Audit Orchestrator

> **See also §33 — Agent Composition Model.** §33 extends the orchestrator with session-passing between browse and analyze subgraphs and adds a `restore_state` node after analyze. Phase 8 implements the no-op static path (REQ-COMP-PHASE8-002); Phase 14 activates the interactive path. The orchestrator topology below stays valid — §33 adds nodes/edges, does not replace.

> **See also §37 — Context Capture Layer.** Phase 4b inserts a `context_capture` node BEFORE `audit_setup`. The new flow is: `context_capture` → (blocking questions? halt) → `audit_setup` → `page_router` → ... Audit halts at `context_capture` if any blocking `open_question` exists; resumes after user answers. ContextProfile flows through AuditState as `context_profile_id` reference.

## 4.1 Orchestrator Graph Topology

**REQ-ORCH-001:** The audit orchestrator is the OUTER graph. Browse and Analyze are INNER subgraphs.

```
┌─────────────┐
│ audit_setup  │  Load client profile, heuristics, build page queue
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ page_router  │◄──────────────────────────────────────────┐
└──────┬──────┘                                            │
       │                                                   │
  (queue empty)──→ audit_complete                          │
       │                                                   │
  (pages remain)                                           │
       │                                                   │
       │                                                   │
  (queue empty)──→ cross_page_analyze (v2.2) ──→ audit_complete
       │                                                   │
       ▼                                                   │
┌──────────────────────────────────────────┐               │
│         BROWSE SUBGRAPH (v3.1)           │               │
│                                          │               │
│  perceive → reason → act → verify        │               │
│      ↑                       │           │               │
│      └──────── loop ─────────┘           │               │
│                                          │               │
│  Exit: page loaded + stable              │               │
└──────────────┬───────────────────────────┘               │
               │                                           │
          (success)──→ analyze                             │
          (failure)──→ page_router (skip page) ────────────┤
               │                                           │
               ▼                                           │
┌──────────────────────────────────────────┐               │
│        ANALYZE SUBGRAPH                  │               │
│                                          │               │
│  deep_perceive → evaluate → self_critique│               │
│       → ground → annotate_and_store      │               │
│                                          │               │
│  Exit: findings stored                   │               │
└──────────────┬───────────────────────────┘               │
               │                                           │
               └───────────────────────────────────────────┘

┌─────────────────┐
│ audit_complete   │  Generate summary, update audit_run status
└─────────────────┘
```

## 4.2 Node Specifications

### Node: `audit_setup`

**REQ-ORCH-NODE-001:**

| | |
|---|---|
| **Input** | `client_id`, `root_url`, `crawl_scope`, `heuristic_set`, `competitor_urls?` |
| **Output** | `audit_run_id`, `client_profile`, `page_queue[]`, `heuristic_knowledge_base` |
| **Precondition** | Client exists in DB. Heuristic KB loadable. |
| **Postcondition** | `audit_run` record created in DB. `page_queue.length >= 1`. |
| **Side effects** | Creates `audit_run` DB record with status "running". |

```typescript
async function auditSetup(state: AuditState): Promise<Partial<AuditState>> {
  // 1. Load client profile
  const client = await storage.getClient(state.client_id);

  // 2. Load heuristic knowledge base
  const heuristics = await heuristicLoader.loadAll();

  // 3. Build page queue
  const pageQueue = await buildPageQueue(state.root_url, state.crawl_scope);

  // 4. Create audit run record
  const auditRunId = await storage.createAuditRun({
    client_id: state.client_id,
    root_url: state.root_url,
    pages_total: pageQueue.length,
    status: "running",
  });

  return {
    audit_run_id: auditRunId,
    client_profile: client,
    page_queue: pageQueue,
    heuristic_knowledge_base: heuristics,
    current_page_index: 0,
    pages_analyzed: 0,
    total_findings: 0,
  };
}

async function buildPageQueue(rootUrl: string, scope: string): Promise<AuditPage[]> {
  const queue: AuditPage[] = [];

  // 1. Always start with homepage
  queue.push({ url: rootUrl, pageType: "homepage", priority: 1, status: "pending" });

  // 2. Try to parse sitemap.xml
  const sitemapUrls = await parseSitemap(`${rootUrl}/sitemap.xml`);
  if (sitemapUrls.length > 0) {
    for (const url of sitemapUrls.slice(0, 49)) {  // max 50 total
      if (!queue.some(p => p.url === url)) {
        queue.push({ url, pageType: "other", priority: 3, status: "pending" });
      }
    }
  }

  // 3. Sort by priority
  queue.sort((a, b) => a.priority - b.priority);

  return queue.slice(0, 50);  // hard cap
}
```

### Node: `page_router`

**REQ-ORCH-NODE-002:**

| | |
|---|---|
| **Input** | `page_queue`, `current_page_index`, `pages_analyzed`, `budget_remaining_usd` |
| **Output** | `current_url`, `current_page_index` (incremented), or signal `audit_complete` |
| **Precondition** | `page_queue` is non-empty. |
| **Postcondition** | Either next page set OR audit marked complete. |

### Node: `cross_page_analyze` (v2.2 NEW)

**REQ-ORCH-NODE-002b:**

| | |
|---|---|
| **Input** | `page_signals[]`, `findings[]`, `funnel_definition?` |
| **Output** | `pattern_findings[]`, `consistency_findings[]`, `funnel_findings[]` |
| **Precondition** | Page loop complete (`current_page_index >= page_queue.length` OR budget exhausted) |
| **Postcondition** | Cross-page findings produced. State updated before `audit_complete`. |
| **Side effects** | One LLM call for funnel analysis (capped $1). Emits `cross_page_analysis_completed` event. |

Three sub-capabilities executed in order:

1. **Pattern detection** (deterministic) — Group grounded findings by heuristic_id across pages. 3+ violations with similar evidence → PatternFinding.
2. **Consistency check** (deterministic) — Compare CTA styles, nav structure, trust signals across accumulated page_signals.
3. **Funnel analysis** (LLM-assisted, 1 call, $1 cap, temp=0) — Detect promise/delivery mismatches, missing funnel steps, journey friction. Assigned Tier 2 (24hr delay).

Details in §7.13 and §35.2.

### Node: `audit_complete`

**REQ-ORCH-NODE-003:**

| | |
|---|---|
| **Input** | `audit_run_id`, `pages_analyzed`, `total_findings`, `findings[]`, `pattern_findings[]`, `consistency_findings[]`, `funnel_findings[]`, `competitor_data` |
| **Output** | Audit run status updated to "completed". ExecutiveSummary + ActionPlan generated. PDF report produced (§35). |
| **Postcondition** | `audit_run.status === "completed"`. `audit_run.completed_at` set. PDF URL stored in `audit_runs.report_pdf_url`. |
| **Side effects** | Emits `session_completed` SSE event. Triggers competitor comparison if competitor data exists. Generates executive summary + action plan + PDF report. Sends email notification (§14 v2.2a). |

## 4.3 Routing Functions

**REQ-ORCH-EDGE-001:** `routePageRouter` (v2.2 — now routes to cross_page_analyze when done):
```typescript
function routePageRouter(state: AuditState): "browse" | "cross_page_analyze" {
  if (state.current_page_index >= state.page_queue.length) return "cross_page_analyze";
  if (state.current_page_index >= 50) return "cross_page_analyze";
  if (state.budget_remaining_usd <= 0) return "cross_page_analyze";
  return "browse";
}

// v2.2 NEW: After cross-page analysis, always proceed to audit_complete
function routeAfterCrossPage(state: AuditState): "audit_complete" {
  return "audit_complete";
}
```

**REQ-ORCH-EDGE-002:** `routeAfterBrowse`:
```typescript
function routeAfterBrowse(state: AuditState): "analyze" | "page_router" {
  if (state.is_complete && state.completion_reason === "success") {
    return "analyze";
  }
  // Browse failed — skip this page, move to next
  state.page_queue[state.current_page_index].status = "failed";
  return "page_router";
}
```

**REQ-ORCH-EDGE-003:** `routeAfterAnalyze`:
```typescript
function routeAfterAnalyze(state: AuditState): "page_router" | "audit_complete" {
  state.page_queue[state.current_page_index].status = "complete";
  state.pages_analyzed++;
  state.current_page_index++;

  if (state.budget_remaining_usd <= 0) return "audit_complete";
  if (state.current_page_index >= state.page_queue.length) return "audit_complete";
  return "page_router";
}
```

## 4.4 Subgraph Integration (LangGraph.js)

**REQ-ORCH-SUBGRAPH-001:**

```typescript
import { StateGraph, Annotation, END } from "@langchain/langgraph";

// 1. Browse subgraph (v3.1 graph — compiled independently)
const browseGraph = buildBrowseGraph();  // from v3.1 spec

// 2. Analyze subgraph (analysis pipeline — compiled independently)
const analyzeGraph = buildAnalyzeGraph();  // from analysis v1.0 spec

// 3. Audit orchestrator (outer graph — uses both as subgraphs)
// v2.2: cross_page_analyze node added between page loop and audit_complete
const auditGraph = new StateGraph(AuditState)
  .addNode("audit_setup", auditSetupNode)
  .addNode("page_router", pageRouterNode)
  .addNode("browse", browseGraph)                     // v3.1 as nested subgraph
  .addNode("analyze", analyzeGraph)                    // analysis as nested subgraph
  .addNode("cross_page_analyze", crossPageAnalyzeNode) // v2.2 NEW
  .addNode("audit_complete", auditCompleteNode)

  // Edges
  .addEdge("__start__", "audit_setup")
  .addEdge("audit_setup", "page_router")
  .addConditionalEdges("page_router", routePageRouter, {
    browse: "browse",
    cross_page_analyze: "cross_page_analyze",        // v2.2: was "audit_complete"
  })
  .addConditionalEdges("browse", routeAfterBrowse, {
    analyze: "analyze",
    page_router: "page_router",
  })
  .addConditionalEdges("analyze", routeAfterAnalyze, {
    page_router: "page_router",
    cross_page_analyze: "cross_page_analyze",        // v2.2: was "audit_complete"
  })
  .addEdge("cross_page_analyze", "audit_complete")   // v2.2 NEW
  .addEdge("audit_complete", END)

  .compile({
    checkpointer: postgresCheckpointer,     // crash recovery
  });
```

## 4.5 State Flow Between Subgraphs

```
AuditState enters BROWSE subgraph:
  → Orchestrator sets: current_url, start_url, task = "Navigate to {url} and prepare for analysis"
  → Browse reads/writes: BrowseState fields (page_snapshot, messages, confidence, etc.)
  → Browse exits when: page loaded + stable (is_complete = true, completion_reason = "success")
  → Orchestrator resets: is_complete = false, current_mode = "analyze"

AuditState enters ANALYZE subgraph:
  → Orchestrator sets: current_mode = "analyze", filtered_heuristics (pre-filtered)
  → Analyze reads: page_snapshot, current_url, screenshot_b64 (from browse)
  → Analyze writes: analyze_perception, findings, annotated_screenshots
  → Analyze exits when: all 5 pipeline steps complete (analysis_complete = true)
  → Orchestrator advances: current_page_index++, updates page_queue status
```

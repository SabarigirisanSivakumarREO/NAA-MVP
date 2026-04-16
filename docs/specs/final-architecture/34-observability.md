# Section 34 — Observability & Operational Monitoring

**Status:** Master architecture extension (v2.2). Phase 9 implementation. Production-grade visibility into audit health, cost, and quality.

**Cross-references:**
- §11 (Safety & Cost) — per-call cost records feed here
- §13 (Data Layer) — new tables: `audit_events`, `llm_call_log`
- §23 (Findings Engine Extended) — heuristic performance feeds alerts
- §24 (Two-Store Pattern) — observability reads from internal store
- §14 (Delivery Layer) — operational dashboard lives here

---

## 34.1 Principle

> **You cannot operate what you cannot observe. The audit pipeline is a complex multi-agent system executing long-running workflows. Without structured observability, failures become mysteries and quality degradation goes undetected. This section specifies the three layers of observability — structured logging, event tracking, and derived metrics — plus alerting and an operational dashboard.**

---

## 34.2 Three-Layer Observability Architecture

```
Layer 3: Derived Metrics & Alerting (computed from layers 1-2)
              ↑
Layer 2: Audit Events (structured events in audit_events table)
              ↑
Layer 1: Structured Logging (Pino, correlation IDs)
```

Each layer serves a different consumer:
- **Layer 1 (Logs):** Engineers debugging specific issues
- **Layer 2 (Events):** Dashboard rendering, SSE streaming, post-hoc analysis
- **Layer 3 (Metrics):** Operational monitoring, quality trending, alerting

---

## 34.3 Layer 1 — Structured Logging

**REQ-OBS-001:** Every log line SHALL be JSON structured via Pino. No free-form strings in production code.

**REQ-OBS-002:** Every log line SHALL include mandatory correlation fields:

```typescript
interface LogContext {
  audit_run_id?: string;          // present for any audit-scoped log
  client_id?: string;             // present when audit_run_id is present
  page_url?: string;              // present for page-scoped logs
  node_name?: string;             // "evaluate" | "browse_perceive" | "cross_page_analyze" | etc.
  heuristic_id?: string;          // present when evaluating a specific heuristic
  trace_id?: string;              // LangSmith trace correlation
}
```

**REQ-OBS-003:** Log levels SHALL be used consistently:
- `debug` — development only, NEVER in production
- `info` — state transitions, decisions, milestones
- `warn` — degraded behavior that did not fail (retry succeeded, fallback used)
- `error` — failures that were recovered (operation retried or skipped)
- `fatal` — audit cannot continue

**REQ-OBS-004:** Sensitive data SHALL NEVER be logged:
- Heuristic content (only heuristic_ids)
- Client credentials, API keys, session tokens
- Full page HTML or DOM
- User PII that might appear in perception data

**REQ-OBS-005:** `console.log` / `console.error` are FORBIDDEN in production code. Use the Pino logger exclusively.

---

## 34.4 Layer 2 — Audit Events

**REQ-OBS-010:** Every significant state transition SHALL emit an event to `audit_events` table and via SSE stream.

**REQ-OBS-011:** Event schema:

```typescript
interface AuditEvent {
  id: string;                       // uuid
  audit_run_id: string;
  client_id: string;
  event_type: AuditEventType;
  page_url: string | null;          // null for audit-level events
  metadata: Record<string, any>;    // event-specific payload
  timestamp: string;                // ISO 8601
}
```

**REQ-OBS-012:** The 22 canonical event types:

| Event Type | Metadata Fields | Emitted By |
|---|---|---|
| `audit_started` | trigger_source, total_pages, budget_usd | audit_setup |
| `audit_completed` | duration_seconds, total_cost_usd, findings_count | audit_complete |
| `audit_failed` | reason, last_node, partial_findings_count | any node |
| `page_browse_started` | page_url, page_type, page_index | page_router |
| `page_browse_completed` | page_url, duration_ms, confidence_score | browse subgraph |
| `page_browse_failed` | page_url, failure_type, attempts | browse subgraph |
| `page_analyze_started` | page_url, heuristics_count | deep_perceive |
| `page_analyze_completed` | page_url, findings_count, duration_ms, cost_usd | annotate_and_store |
| `page_analyze_skipped` | page_url, analysis_status, reason | any node |
| `finding_produced` | finding_id, heuristic_id, severity, tier | evaluate |
| `finding_grounding_rejected` | heuristic_id, rejected_by, reason | ground |
| `finding_critique_rejected` | heuristic_id, reason | self_critique |
| `finding_published` | finding_id, publish_status, delay_hours | store |
| `budget_warning` | spent, remaining, percent_used | cost tracker |
| `budget_exceeded` | limit_type, spent_usd | cost tracker |
| `llm_call_completed` | llm_call_id (FK to llm_call_log) | llm adapter |
| `llm_call_failed` | provider, error_type, will_retry | llm adapter |
| `llm_provider_fallback` | from_provider, to_provider, reason | llm adapter |
| `perception_quality_low` | score, signals, blocking_issue | quality gate |
| `hitl_requested` | reason, current_url, screenshot_ref | browse subgraph |
| `cross_page_analysis_completed` | pattern_count, consistency_count, funnel_count | cross_page_analyze |
| `overlay_dismissed` | overlay_type, selector_used | browse subgraph (v2.2a) |

**REQ-OBS-013:** `audit_events` table is append-only. No UPDATE, no DELETE. Retention: 90 days active, then archived to cold storage.

**REQ-OBS-014:** All events emitted within a single graph node SHALL share the same `trace_id` for LangSmith correlation.

---

## 34.5 Layer 3 — Derived Metrics

**REQ-OBS-020:** Audit-level metrics computed from `audit_events` + `llm_call_log` + `findings`:

| Metric | Formula | Purpose |
|---|---|---|
| `duration_seconds` | `audit_completed.timestamp - audit_started.timestamp` | Performance trending |
| `actual_cost_usd` | `SUM(llm_call_log.cost_usd) WHERE audit_run_id = X` | Cost validation |
| `cost_vs_estimate_ratio` | `actual_cost / estimated_cost_at_start` | Budget accuracy |
| `pages_complete_rate` | `pages_analyze_completed / pages_total` | Reliability |
| `pages_skipped_count` | `COUNT(page_analyze_skipped)` | Perception quality |
| `findings_per_page_avg` | `total_findings / pages_complete` | Rule productivity |
| `grounding_rejection_rate` | `grounding_rejected / (grounded + rejected)` | Finding quality |
| `cache_hit_rate` | `SUM(cache_hit) / COUNT(llm_call_log)` | Cost optimization |

**REQ-OBS-021:** Heuristic-level metrics computed per heuristic_id:

```typescript
interface HeuristicHealthMetrics {
  heuristic_id: string;
  total_evaluations: number;       // how many times applied
  findings_produced: number;       // violations found
  passes: number;                  // pass status count
  grounding_rejections: number;    // finding produced but grounded rejected
  critique_rejections: number;     // self-critique rejected
  consultant_approvals: number;    // consultant approved
  consultant_rejections: number;   // consultant rejected
  health_score: number;            // (produced - grounding_rej - consultant_rej) / total
  last_updated: string;
}
```

**REQ-OBS-022:** `health_score < 0.3` → heuristic flagged for rewrite. Feeds §28 Learning Service.

---

## 34.6 Alerting

**REQ-OBS-030:** A BullMQ scheduled job runs every 5 minutes checking alerting rules:

| Rule | Condition | Severity | Action |
|---|---|---|---|
| `audit_stuck_warning` | Audit running > 45 min | warning | Log + email consultant |
| `audit_stuck_critical` | Audit running > 90 min | critical | Log + email admin + pause option |
| `grounding_rejection_high` | > 80% findings rejected on a page | warning | Flag page for manual review |
| `heuristic_health_low` | `health_score < 0.3` | warning | Flag heuristic for rewrite |
| `cost_overrun` | `actual_cost > 2× estimated_cost` | warning | Log + cost model review |
| `llm_provider_errors` | 5+ errors from one provider in 10 min | critical | Alert admin, consider pause |
| `audit_failure_cluster` | 3+ audits failed in 1 hour | critical | Alert admin, systemic issue |

**REQ-OBS-031:** Notifications delivered via `NotificationAdapter` (§14 v2.2a extension). Email for MVP. Webhook post-MVP.

**REQ-OBS-032:** Alerts are debounced — the same alert type for the same audit_run_id fires at most once per hour.

---

## 34.7 Operational Dashboard

**REQ-OBS-040:** Admin route `/console/admin/operations` provides real-time operational visibility. Access: consultant role with `admin` flag.

**REQ-OBS-041:** Dashboard sections:

1. **Active Audits** — Currently running audits with progress bar, ETA, current page, cost burn
2. **24h Summary** — Audits completed, failed, avg duration, avg cost, findings per audit
3. **Heuristic Health Table** — Sortable by health_score. Columns: heuristic_id, source, total_evaluations, findings_produced, health_score
4. **Alert Feed** — Recent warnings and critical alerts, last 24h
5. **Cost Trend** — Daily LLM spend chart, last 30 days
6. **Failure Breakdown** — Pie chart of failure types (perception_insufficient, llm_failed, budget_exceeded, etc.)

**REQ-OBS-042:** Dashboard queries read from `audit_events`, `llm_call_log`, and derived `heuristic_health_metrics` (materialized view). No live writes from dashboard.

---

## 34.8 Build Order (Phase 9)

Build last — after consultant dashboard, client dashboard, PDF reports. For interim production use, query `audit_events` directly via SQL until the dashboard UI is ready.

Tasks: T239 (logging), T240-T241 (events + emission), T242 (heuristic health), T243 (alerting job), T244 (ops dashboard).

---

**End of §34 — Observability & Operational Monitoring**

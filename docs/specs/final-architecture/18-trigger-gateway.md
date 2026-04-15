# Section 18 — Trigger Gateway

**Status:** Master architecture extension. Required from Phase 6 onwards. The gateway is the **only** entry point into the audit orchestrator.

**Cross-references:**
- §5.7.2 (Unified State Extensions) — `trigger_source`, `audit_request_id` fields
- §13.6.10 (Data Layer Extensions) — `audit_requests` table
- §4 (Audit Orchestrator) — consumer of `AuditRequest`
- §14 (Delivery Layer) — some channels originate here

---

## 18.1 Principle

> **All audit initiations — regardless of channel — converge on a single `AuditRequest` contract before the Audit Orchestrator ever sees them. Channels carry their own auth and quirks; the orchestrator does not.**

The gateway normalises every trigger into one shape, enforces auth + rate limiting + permission checks, and hands a validated `AuditRequest` to the orchestrator. The orchestrator is channel-agnostic.

---

## 18.2 Architecture

```
┌─────────────┐  ┌─────┐  ┌─────────────────┐  ┌─────────────────┐  ┌──────────┐
│     CLI     │  │ MCP │  │ Consultant Dash │  │   Client Dash   │  │Scheduler │
└──────┬──────┘  └──┬──┘  └────────┬────────┘  └────────┬────────┘  └────┬─────┘
       │            │              │                    │                │
       │  JSON      │  MCP         │  REST + Clerk      │  REST + Clerk  │  Cron
       │  via       │  protocol    │  session           │  session       │  + job
       │  stdin     │              │                    │                │  def
       ▼            ▼              ▼                    ▼                ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         TRIGGER GATEWAY                                     │
│                                                                             │
│  ┌───────────────┐   ┌───────────────┐   ┌──────────────────────────────┐  │
│  │ Channel       │   │ Auth          │   │ Normalizer                   │  │
│  │ Adapters      │──▶│ Resolver      │──▶│ (per-channel → AuditRequest) │  │
│  └───────────────┘   └───────────────┘   └──────────────┬───────────────┘  │
│                                                          │                  │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────▼───────────────┐ │
│  │ Permission    │   │ Rate Limiter  │   │ Validator                     │ │
│  │ Check         │◀──│ (per-client)  │◀──│ (Zod schema + budget check)   │ │
│  └───────┬───────┘   └───────────────┘   └───────────────────────────────┘ │
│          │                                                                  │
│          ▼                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Persist AuditRequest → audit_requests table                           │  │
│  │ Emit to Audit Orchestrator (Temporal workflow start)                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                           Audit Orchestrator (§4)
```

---

## 18.3 Channels

### 18.3.1 CLI

**REQ-TRIGGER-CLI-001:** The CLI SHALL accept a JSON audit request via stdin or a file argument and POST it to the gateway's internal CLI endpoint.

```bash
# Usage
reo-cli audit --client-id=<uuid> --url=https://example.com --budget=15.00
reo-cli audit --from-file=./audit-config.json

# Auth: via env var REO_API_KEY, scoped to one or more client_ids
```

**REQ-TRIGGER-CLI-002:** CLI auth SHALL use an API key (same mechanism as MCP). The CLI is a thin wrapper around the HTTP gateway — no privileged access.

**REQ-TRIGGER-CLI-003:** The CLI SHALL print the audit_request_id + audit_run_id on success and exit 0. Failure prints a structured error and exits non-zero.

### 18.3.2 MCP

**REQ-TRIGGER-MCP-001:** The CRO Audit MCP Server (§14.1) SHALL expose a `cro_trigger_audit` tool:

```typescript
cro_trigger_audit(params: {
  client_id: string;
  root_url: string;
  scope?: AuditScopeConfig;
  budget?: AuditBudgetConfig;
  heuristic_set?: string;              // named preset
  competitor_urls?: string[];          // triggers competitor mode as separate run
}): Promise<{
  audit_request_id: string;
  audit_run_id: string;
  status: "queued";
}>;
```

**REQ-TRIGGER-MCP-002:** MCP write access is gated behind an explicit API key scope: `cro:audit:write`. Keys without this scope can only query existing findings (read-only MCP tools).

**REQ-TRIGGER-MCP-003:** Per C9 locked decision and §14.1, the MCP server is read-only until Phase 9+. Write tools (including `cro_trigger_audit`) are Phase 11 additions.

### 18.3.3 Consultant Dashboard

**REQ-TRIGGER-CONSULTANT-001:** The consultant dashboard (§14.3) SHALL provide an "Audit" panel where consultants can:
- Select a client
- Enter or pick a root URL
- Configure scope (templates, workflows, exclusions)
- Configure budget (USD cap, runtime cap, max pages, max states)
- Pick a heuristic set preset
- Optionally attach competitor URLs (triggers separate competitor audit mode — §28 F-competitor)
- Submit

**REQ-TRIGGER-CONSULTANT-002:** Consultant auth uses Clerk (existing). Permission: `consultant` or `admin` role. The gateway verifies the Clerk session and extracts the user_id for the audit_request log.

**REQ-TRIGGER-CONSULTANT-003:** Consultants can re-run any existing audit via a "Re-run" action on an audit_run detail page. Re-runs bypass the scope config form — they inherit scope from the source run. See §25.8 for reproducibility semantics.

### 18.3.4 Client Dashboard

**REQ-TRIGGER-CLIENT-001:** The client dashboard (§14.2) MAY expose an audit trigger button — if and only if the client's account config has `self_service_audits: true`. Default: `false`.

**REQ-TRIGGER-CLIENT-002:** Client-initiated audits SHALL:
- Be rate-limited to ≤ N per month per client (default 10, M3-FIX)
- Use a pre-configured scope (client cannot customise scope; consultant pre-approves)
- Use the client's pre-configured budget cap (not adjustable at trigger time)
- Be flagged in `audit_requests.trigger_source = client_dashboard` for audit trail

**REQ-TRIGGER-CLIENT-003:** (S6-FIX) Client-initiated audits inherit warm-up mode status from the client profile. During warm-up, **client-initiated** audit triggers are disabled — the client dashboard shows "Audits are being reviewed by your CRO consultant" instead of the trigger button. **Consultant-initiated** audits operate normally during warm-up and count toward the warm-up exit criteria (first 3 audits fully consultant-reviewed, rejection rate < 25%). Once warm-up exits, client self-service re-enables automatically if `self_service_audits: true`.

### 18.3.5 Scheduler

**REQ-TRIGGER-SCHEDULER-001:** The scheduler (Phase 13, §14.3 extended) SHALL support recurring audit jobs:
- Cron expression (e.g., `0 3 * * MON` = Mondays at 3 AM)
- One-shot scheduled (fire at a specific timestamp)
- Post-event triggers (deferred: Phase 14+, e.g., "re-audit on Shopify theme update")

**REQ-TRIGGER-SCHEDULER-002:** Scheduled jobs are owned by the consultant dashboard. They store the scope + budget config, and the scheduler loop fires the same code path as a consultant manual trigger.

**REQ-TRIGGER-SCHEDULER-003:** (S4-FIX) The audit scheduler uses **Temporal Schedules** (cron-style recurring workflows). Temporal owns both the scheduling AND the audit workflow execution — no separate scheduling layer is needed for audits. BullMQ is retained strictly for non-audit background jobs (e.g., delayed finding publish worker from §12, analytics signal ingestion). The scheduler's Temporal Schedule fires an `AuditRequest` at the configured time by starting a new `AuditOrchestrator` workflow.

**REQ-TRIGGER-SCHEDULER-004:** Scheduled audits that fire while a previous audit for the same client is still running SHALL be deferred with a `concurrent_audit_in_progress` status, retried every 15 min for up to 2 hours, then marked `skipped_overlap` if still blocked.

---

## 18.4 `AuditRequest` Contract

**REQ-TRIGGER-CONTRACT-001:** Every channel produces an `AuditRequest` of exactly this shape before the Audit Orchestrator sees it:

```typescript
export interface AuditRequest {
  // === Identity ===
  id: string;                                // UUID, generated by gateway
  client_id: string;                         // UUID, resolved from auth
  idempotency_key?: string;                  // optional; prevents double-submit

  // === Provenance ===
  trigger: {
    source: "cli" | "mcp" | "consultant_dashboard" | "client_dashboard" | "scheduler";
    user_id?: string;                        // Clerk user id (dashboards)
    api_key_id?: string;                     // API key id (CLI, MCP)
    schedule_id?: string;                    // scheduler job id
    correlation_id?: string;                 // for distributed tracing
    submitted_at: string;                    // ISO 8601
    client_ip?: string;                      // for audit log
    user_agent?: string;                     // for audit log
  };

  // === Target ===
  target: {
    root_url: string;
    crawl_scope: "domain" | "subdomain" | "path_prefix" | "listed_urls_only";
    path_prefix?: string;                    // if crawl_scope = path_prefix
    listed_urls?: string[];                  // if crawl_scope = listed_urls_only
    exclusion_patterns: string[];            // regex patterns to exclude
  };

  // === Scope ===
  scope: {
    templates?: {                            // Phase 6+: template-first discovery
      max_templates: number;                 // default: 20
      representative_pages_per_template: number; // default: 1-3
      force_include_templates?: string[];    // consultant override
    };
    workflows?: {                            // Phase 8+: workflow orchestration
      enabled: boolean;                      // default: true per business_type
      workflow_presets?: string[];           // e.g., ["ecommerce-checkout"]
      custom_workflows?: WorkflowDefinition[];
    };
    state_exploration?: {                    // Phase 7+
      policy: "heuristic_primed_only" | "with_auto_escalation" | "thorough_mode";
      max_states_per_page: number;           // default: 15
      pass_2_allowed: boolean;               // default: true
    };
  };

  // === Budget ===
  budget: {
    max_total_usd: number;                   // hard cap for the whole audit
    max_per_page_usd: number;                // per-page cap
    max_per_state_usd?: number;              // optional fine-grained cap
    max_runtime_minutes: number;             // hard runtime cap
    max_pages: number;                       // absolute cap
    max_llm_calls: number;                   // absolute cap
    on_exhaustion: "graceful_stop" | "fail";
  };

  // === Heuristic set ===
  heuristic_set: {
    base_version: string;                    // e.g., "2.1.0" or "latest"
    overlays: string[];                      // e.g., ["brand:luxury", "client:abc-123"]
    learned_calibration_enabled: boolean;    // Phase 4+
  };

  // === Competitor (separate mode, §28) ===
  competitor?: {
    enabled: boolean;
    competitor_urls: string[];
    comparison_dimensions?: string[];
  };

  // === Notification preferences ===
  notifications: {
    on_complete?: string[];                  // email addresses (consultant emails only)
    on_failure?: string[];
    on_budget_warning?: string[];
    webhook_url?: string;                    // for scheduler-triggered audits
  };

  // === Metadata (S5-FIX: specific fields, not free-form) ===
  tags?: string[];                           // user-defined labels for filtering/grouping
  reason?: string;                           // why was this audit triggered (consultant notes)
  external_correlation_id?: string;          // link to external system (JIRA, Slack, etc.)
}
```

**REQ-TRIGGER-CONTRACT-002:** The gateway SHALL validate the `AuditRequest` against a Zod schema derived from this TypeScript definition. Validation failures return HTTP 400 with a structured error (no audit is created).

**REQ-TRIGGER-CONTRACT-003:** `AuditRequest.id` SHALL be a UUID generated server-side. Callers cannot provide their own.

**REQ-TRIGGER-CONTRACT-004:** `idempotency_key` MAY be provided by the caller. If present, the gateway SHALL return the existing audit_request with the same key rather than create a duplicate. Idempotency window: 24 hours.

---

## 18.5 Auth & Permission Matrix

**REQ-TRIGGER-AUTH-001:**

| Channel | Auth Mechanism | Identity Source | Min Permission |
|---|---|---|---|
| CLI | API key (env var) | `api_keys` table | `cro:audit:write` scope + client_id membership |
| MCP | API key (header) | `api_keys` table | `cro:audit:write` scope + client_id membership |
| Consultant Dashboard | Clerk session | `user_id` from Clerk | `consultant` or `admin` role |
| Client Dashboard | Clerk session | `user_id` from Clerk | `client` role + `self_service_audits: true` on client profile |
| Scheduler | Internal service token | `schedule_id` from jobs table | Consultant who created the schedule must still have `consultant`+ role |

**REQ-TRIGGER-AUTH-002:** Every channel produces a tuple `(identity_type, identity_id, client_id_set)`. The gateway verifies that the requested `client_id` is in the caller's `client_id_set`. Unauthorized access returns HTTP 403 and is logged.

**REQ-TRIGGER-AUTH-003:** API keys SHALL be scoped to specific client_ids. A key created for Client A cannot trigger audits for Client B — enforced at the gateway, backstopped by RLS at the database layer.

**REQ-TRIGGER-AUTH-004:** Scheduler jobs SHALL re-verify the creator's permission at fire time. If the creator no longer has `consultant+` role, the job is marked `skipped_permission_revoked` and logged for review.

---

## 18.6 Rate Limiting

**REQ-TRIGGER-RATE-001:** The gateway SHALL enforce rate limits at multiple scopes:

| Scope | Default | Rationale |
|---|---|---|
| Per api_key | 10 audits/hour | Prevents runaway automation |
| Per client (consultant) | 20 audits/hour | Human consultant working pace |
| Per client (client_dashboard) | 10 audits/month | M3-FIX: increased from 2 — budget enforcement is the real gating, not rate limits |
| Per client (scheduler) | Unlimited | Scheduler is trusted |
| Global | 200 audits/hour | Worker pool protection |

**REQ-TRIGGER-RATE-002:** Rate limit exceeded returns HTTP 429 with `Retry-After` header. The request is NOT queued — the caller must retry.

**REQ-TRIGGER-RATE-003:** Scheduler triggers bypass per-api_key and per-client consultant limits (they are not tied to an api_key). They still honour global limits.

**REQ-TRIGGER-RATE-004:** Per-client concurrency limit: default 1 concurrent audit per client. Second request returns HTTP 409 with `concurrent_audit_in_progress` error unless it is a scheduled job (which defers per REQ-TRIGGER-SCHEDULER-004).

---

## 18.7 Validation Pipeline

**REQ-TRIGGER-VALIDATE-001:** After auth and rate limiting, the gateway validates the `AuditRequest` in this order:

1. **Zod schema validation** (structural)
2. **Client exists** in `clients` table
3. **Root URL is reachable** (HEAD request with 5s timeout; warn if unreachable, do NOT block validation — M5-FIX: warning is attached to audit_request metadata, not a validation failure. Some sites block HEAD from server IPs or require specific User-Agent.)
4. **Budget within client profile limits** (consultant can override client-set limits if they have `admin` role)
5. **Scope within client profile limits** (e.g., client has `max_pages_per_audit: 100`, request asks for 200 → reject unless admin override)
6. **Heuristic set exists and is loadable** (base_version resolvable, overlays exist)
7. **Domain not on global denylist** (§11.1 safety)
8. **Client not in `suspended` status** (billing, trust, or legal hold)

**REQ-TRIGGER-VALIDATE-002:** Validation failures produce structured errors:

```typescript
interface ValidationError {
  code: "invalid_schema" | "client_not_found" | "url_unreachable"
      | "budget_exceeds_limit" | "scope_exceeds_limit" | "heuristic_set_invalid"
      | "domain_blocked" | "client_suspended" | "concurrent_audit_in_progress"
      | "rate_limited" | "permission_denied";
  message: string;
  details: Record<string, any>;
  http_status: number;
}
```

**REQ-TRIGGER-VALIDATE-003:** Every validation outcome (pass or fail) SHALL be written to the `audit_requests` table with the final status. Rejected requests are visible in the consultant dashboard's "Rejected Requests" view.

---

## 18.8 Persistence & Handoff to Orchestrator

**REQ-TRIGGER-PERSIST-001:** On successful validation, the gateway:

1. Inserts a row into `audit_requests` with `status = 'validated'`
2. Creates an `audit_runs` row with `status = 'pending'` and links it
3. Updates `audit_requests.audit_run_id`
4. Starts a Temporal workflow (`AuditOrchestrator.run`) with the `AuditRequest` as input
5. Updates `audit_requests.status = 'queued'` + `audit_requests.queued_at = NOW()`
6. Returns `{ audit_request_id, audit_run_id, status: "queued" }` to the caller

**REQ-TRIGGER-PERSIST-002:** Steps 1-5 SHALL execute within a database transaction + Temporal workflow start. If any step fails, the entire operation rolls back and returns an error. No partial state.

**REQ-TRIGGER-PERSIST-003:** The gateway is responsible for creating the `reproducibility_snapshots` row in the database BEFORE starting the Temporal workflow. The snapshot is assembled from the gateway's resolved heuristic set + prompt registry + model config at request time. The `snapshot_id` (= `audit_run_id`, per §13.6.7 UNIQUE constraint) is passed to the Temporal workflow as part of `AuditRequest`. The `audit_setup` node reads this row into AuditState — it does NOT create it. See §25.4 for field definitions and §25.3 REQ-REPRO-031 for the full ownership protocol.

**REQ-TRIGGER-PERSIST-004:** After handoff, the gateway does not track audit progress. Progress is emitted by the orchestrator via SSE (§14.5) and persisted via Temporal state.

---

## 18.9 Response Streaming

**REQ-TRIGGER-STREAM-001:** All channels MAY subscribe to the SSE stream at `GET /api/audits/:audit_run_id/stream` after submission to receive real-time progress events (§14.5). The CLI subscribes by default; dashboards subscribe when the user navigates to the audit detail page.

**REQ-TRIGGER-STREAM-002:** MCP does NOT subscribe to streams (MCP is request/response). MCP callers poll `cro_get_audit_summary` to check status.

**REQ-TRIGGER-STREAM-003:** Scheduler-triggered audits emit a webhook POST to the optional `notifications.webhook_url` on terminal states (completed, failed, budget_exceeded, skipped_overlap).

**REQ-TRIGGER-STREAM-003a:** (M4-FIX) Webhook delivery uses exponential backoff on failure: retry at 10s, 30s, 90s, 270s, 810s (5 attempts total, ~20 min span). After all retries exhausted, the webhook payload is written to a dead-letter queue (DLQ) table in Postgres. DLQ entries are retained for 7 days and surfaced in the consultant dashboard admin view for manual replay.

---

## 18.10 Idempotency & Deduplication

**REQ-TRIGGER-IDEM-001:** If a caller provides `idempotency_key` and a matching audit_request exists within the last 24 hours:

- Return the existing audit_request_id + audit_run_id with HTTP 200
- Do NOT create a duplicate
- Log the dedupe event for observability

**REQ-TRIGGER-IDEM-002:** Callers without `idempotency_key` can still double-submit. The gateway detects near-duplicates only when concurrency limits fire (REQ-TRIGGER-RATE-004).

**REQ-TRIGGER-IDEM-002a:** (M7-FIX) HTTP 409 `idempotency_conflict` (same key, different payload) SHALL NOT be retried — it indicates a caller bug. The response body SHALL include a human-readable message: "Idempotency key was already used with a different request payload. Use a new key or resubmit the original request." Callers SHOULD NOT implement automatic retry logic on 409.

**REQ-TRIGGER-IDEM-003:** Scheduler-triggered requests SHALL always supply an `idempotency_key` derived from `{schedule_id}:{fire_timestamp}`. This prevents duplicate fires if the scheduler retries.

---

## 18.11 Observability

**REQ-TRIGGER-OBS-001:** The gateway emits metrics:
- `gateway.audit_requests.received{source, status}`
- `gateway.audit_requests.rejected{reason}`
- `gateway.audit_requests.validation_duration_ms`
- `gateway.rate_limit_hits{scope}`
- `gateway.auth_failures{channel}`

**REQ-TRIGGER-OBS-002:** Every audit_request is logged as a structured JSON log line with `audit_request_id`, `client_id`, `trigger_source`, `status`, `validation_result`, and `duration_ms`.

**REQ-TRIGGER-OBS-003:** Consultant dashboard admin view SHALL expose a "Gateway Activity" page showing recent requests, rejections, rate-limit hits, and auth failures across all channels.

---

## 18.12 Failure Modes (Additions to §15)

| # | Failure | Detection | Response |
|---|---|---|---|
| **TF-01** | Channel adapter crashes mid-normalization | Exception in channel handler | Return HTTP 500 with correlation_id. Log. Do not create audit_request row. |
| **TF-02** | Auth provider (Clerk) unavailable | Timeout or 5xx from Clerk | Return HTTP 503 `auth_unavailable`. Do not auto-fallback to no-auth. |
| **TF-03** | Database unavailable during persist | Connection error or transaction failure | Return HTTP 503. Log. Alert. Do not retry from gateway (caller retries). |
| **TF-04** | Temporal workflow start fails | Temporal client error | Mark audit_request `failed_to_queue`, return HTTP 502. Audit_run row is rolled back. |
| **TF-05** | Reproducibility snapshot creation fails | Missing file, hash error | Fail the entire request (see §25 RF-01). Do not queue audit. |
| **TF-06** | Idempotency key collision with different payload | Same key, different `target.root_url` | Reject with HTTP 409 `idempotency_conflict`. Do not silently merge. |
| **TF-07** | Scheduled job fires for suspended client | Client status check in validation | Mark job `skipped_client_suspended`. Log. Notify consultant. |
| **TF-08** | Scheduled job fires for deleted client | Client not in clients table | Mark job `skipped_client_missing`, auto-disable the schedule, notify admin. |

---

## 18.13 Implementation Phase Mapping

| Phase | Deliverable |
|---|---|
| **6** | `AuditRequest` contract locked, gateway service stub, consultant dashboard channel only, Clerk auth, `audit_requests` table, idempotency |
| **6** | Reproducibility snapshot creation in gateway (integrated with §25) |
| **7** | Scope extensions for state exploration policy |
| **8** | Scope extensions for workflow orchestration + templates |
| **9** | CLI channel, read-only MCP channel |
| **11** | Write MCP channel (`cro_trigger_audit`), client dashboard channel |
| **13** | Scheduler channel, recurring jobs, permission re-verification at fire time |
| **13** | Rate limiting, concurrency limits, observability dashboard |
| **14** | Webhook notifications, correlation IDs for distributed tracing |

---

## 18.14 Design Rationale

**Why a single gateway?** Any alternative (per-channel orchestrator entry points) duplicates auth, validation, rate limiting, idempotency, and audit logging. Each duplication is a security and consistency risk.

**Why `AuditRequest` as a contract?** The orchestrator must be channel-agnostic to stay testable and to let future channels (email, Slack, webhook ingest) be added without touching orchestrator code.

**Why persist `audit_requests` separately from `audit_runs`?** Because rejected requests never become runs. Without a dedicated table, we lose visibility into "who tried to audit what, and why we said no." That visibility is essential for debugging permission issues and consultant trust.

**Why not let the orchestrator create its own Temporal workflow?** Because the orchestrator is the workflow. The gateway is the caller. Separating caller from callee is basic workflow engine discipline.

**Why is scheduler a channel, not a service that calls CLI?** Because scheduled audits need different permission semantics (permission re-verification at fire time), different rate limit rules (bypass per-api_key), and different failure handling (auto-disable on repeated failures). Channel-level modelling is cleaner than if/else in CLI.

---

**End of §18 — Trigger Gateway**

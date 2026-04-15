# Section 30 — Analytics Bindings (Deferred Contract)

**Status:** Contract reserved. Implementation Phase 15. Tables already created in §13.6.9.

**Cross-references:**
- §13.6.9 (`analytics_bindings`, `analytics_signals` tables) — storage
- §22.6 (Phase 4 retrieval) — analytics signals inform heuristic prioritization
- §23.4 (`computeBusinessImpact`) — analytics data can refine impact scoring
- §28 (Learning Service) — analytics signals feed calibration
- §29 (Hypothesis Pipeline) — analytics provide baseline metrics for test plans

---

## 30.1 Principle

> **CRO audit findings grounded in page structure are valuable. CRO audit findings correlated with behavioral analytics data are transformative. Analytics bindings connect the audit platform to real user behavior — bounce rates, rage clicks, scroll depth, funnel drop-off — so that findings can be prioritised by actual user impact, not just heuristic severity.**

---

## 30.2 Supported Providers (Phase 15+)

| Provider | Signal types | Integration method |
|---|---|---|
| **GA4** | Page views, bounce rate, exit rate, conversion events, funnel drop-off | GA4 Data API (REST) |
| **Contentsquare** | Rage clicks, hesitation, scroll depth, zone-level engagement | CS API |
| **FullStory** | Frustration signals, dead clicks, error clicks, session replay links | FS API |
| **Hotjar** (future) | Heatmaps, recordings, polls | Hotjar API |
| **Custom webhook** | Any structured signal | Inbound webhook |

---

## 30.3 Binding Contract

**REQ-ANALYTICS-001:**

```typescript
interface AnalyticsBinding {
  id: string;
  client_id: string;
  provider: "ga4" | "contentsquare" | "fullstory" | "hotjar" | "custom_webhook";
  property_id: string;                   // provider-specific site/property identifier
  credential_ref: string;                // reference to secret manager — NEVER store raw credentials
  scopes: string[];                      // e.g., ["read:events", "read:funnels"]
  enabled: boolean;
  sync_config: {
    frequency: "daily" | "weekly" | "on_audit";  // when to pull data
    lookback_days: number;                // how far back to fetch (default 30)
    // M4-L3-FIX: should be ≥7 to compensate for GA4/CS 24-48h processing delays
    page_url_mapping?: Record<string, string>;  // map analytics URLs to audit URLs if different
  };
}
```

**REQ-ANALYTICS-002:** Credential management:
- Raw API keys, OAuth tokens, service account JSON are stored in a **secret manager** (environment variable for MVP, Vault/AWS Secrets Manager for production)
- `credential_ref` is a reference key, not the credential itself
- The analytics sync worker resolves `credential_ref` → actual credential at runtime
- Credentials are NEVER written to logs, traces, DB rows, or API responses

---

## 30.4 Signal Schema

**REQ-ANALYTICS-010:**

```typescript
interface AnalyticsSignal {
  id: string;
  binding_id: string;
  client_id: string;

  // Scope
  page_url?: string;                     // specific page (null = site-wide)
  template_id?: string;                  // matched template (post-discovery)
  workflow_id?: string;                  // matched workflow step (post-discovery)

  // Signal
  signal_type: "traffic" | "bounce" | "exit" | "frustration" | "rage_click"
             | "dead_click" | "scroll_depth" | "time_on_page" | "conversion"
             | "funnel_dropoff" | "error_rate";
  signal_value: number;
  signal_unit: "ratio" | "count" | "percentage" | "milliseconds";  // S2-L3-FIX: semantic unit
  // ratio = 0..1 (bounce rate, conversion rate), count = absolute (traffic, clicks),
  // percentage = 0..100 (scroll depth), milliseconds = time (time on page, LCP)
  confidence: number;                    // statistical confidence in the signal
  sample_size?: number;                  // sessions/events this is based on

  // Time window
  time_window_start: string;             // ISO
  time_window_end: string;

  ingested_at: string;
}
```

---

## 30.5 How Analytics Feed the Platform

| Consumer | What it reads | Effect |
|---|---|---|
| §23.4 Business Impact scoring | `traffic` + `funnel_dropoff` signals per page | High-traffic pages with high drop-off get higher business_impact |
| §22.6 Heuristic retrieval (Phase 4) | `frustration` + `rage_click` signals per page | Pages with behavioral frustration signals get more aggressive heuristic coverage |
| §28 Learning Service | `bounce` + `exit` signals correlated with findings | Findings on high-bounce pages get reliability boost (the heuristic identified a real problem) |
| §29 Hypothesis Pipeline | `conversion` baseline per page | Test plan sample size calculator uses real conversion rate instead of default 3% |
| §19 Discovery | `traffic` per URL | Representative page selection prioritises high-traffic pages |

---

## 30.6 Sync Architecture

```
┌──────────────┐    ┌──────────────┐    ┌───────────────┐
│  GA4 API     │    │ CS API       │    │ FS API        │
└──────┬───────┘    └──────┬───────┘    └───────┬───────┘
       │                   │                    │
       ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│  Analytics Sync Worker (BullMQ — non-audit background)  │
│                                                         │
│  For each enabled binding:                              │
│    1. Resolve credential_ref → actual credential        │
│    2. Fetch data via provider adapter                   │
│    3. Normalize to AnalyticsSignal[]                    │
│    4. Match URLs to templates/workflows (if available)  │
│       M3-L3-FIX: default matching = normalize both     │
│       URLs (strip protocol, trailing slash, query       │
│       params), compare path. Exact or prefix match.     │
│       Custom mapping via binding.page_url_mapping.      │
│    5. Write to analytics_signals table                  │
│    6. Update binding.last_sync_at + last_sync_status    │
└─────────────────────────────────────────────────────────┘
```

**REQ-ANALYTICS-020:** The sync worker runs on BullMQ (NOT Temporal — analytics sync is a background data job, not an audit workflow). Schedule: per binding configuration (daily/weekly/on_audit).

**REQ-ANALYTICS-021:** Provider adapters implement a common interface:

```typescript
interface AnalyticsProviderAdapter {
  readonly provider: string;
  fetchSignals(config: AnalyticsBinding, dateRange: DateRange): Promise<AnalyticsSignal[]>;
  testConnection(config: AnalyticsBinding): Promise<{ success: boolean; error?: string }>;
}
```

**REQ-ANALYTICS-022:** Each provider adapter is in `packages/core/src/adapters/analytics/`. Adding a new provider = implementing the interface + registering in the adapter factory. No core code changes.

**REQ-ANALYTICS-022a:** (M5-L3-FIX) Provider adapters SHALL implement per-provider rate limiting per documented API quotas. Example: GA4 Data API = 10 req/s, 10,000 req/day per project. Rate limit config is per-adapter, not global. Exceeded limits trigger backoff, not failure.

---

## 30.7 Privacy & Security

**REQ-ANALYTICS-030:** Analytics signals are AGGREGATED, not per-user:
- No individual user sessions stored
- No PII (user IDs, emails, IP addresses) ingested
- Signals are page-level aggregates (bounce rate for /checkout, not "user john@example.com bounced from /checkout")
- Session replay LINKS (FullStory) may be stored as references but the platform does NOT fetch or store replay content

**REQ-ANALYTICS-031:** Client data isolation: analytics_signals has `client_id` + RLS. Client A's analytics data cannot be queried by Client B.

**REQ-ANALYTICS-032:** GDPR: analytics_signals are deletable per client via the same deletion pathway as findings and audit data. Binding credentials are deleted from secret manager.

---

## 30.8 Failure Modes

| # | Failure | Detection | Response |
|---|---|---|---|
| **AB-01** | Provider API unavailable | HTTP 5xx or timeout during sync | Retry with backoff (3 attempts). Mark `last_sync_status = "failure"`. Alert if 3 consecutive syncs fail. |
| **AB-02** | Credential expired/revoked | HTTP 401/403 | Mark binding `enabled = false`. Notify consultant: "Analytics connection needs re-authentication." |
| **AB-03** | URL mismatch (analytics URLs don't match audit URLs) | 0 template/workflow matches after sync | Log warning. Consultant configures `page_url_mapping` in binding. |
| **AB-04** | Signal volume too high (>100k signals per sync) | Count check | Truncate to most recent time window. Log. Suggest narrower sync config. |
| **AB-05** | Signal data quality poor (many nulls, inconsistent values) | Validation check | Drop invalid signals. Log `data_quality_warning`. Proceed with valid subset. |

---

## 30.9 Implementation Phase Mapping

| Phase | Deliverable |
|---|---|
| **15** | GA4 adapter, Contentsquare adapter, FullStory adapter, sync worker, signal normalisation, URL-to-template matching |
| **15** | Consultant dashboard: analytics binding configuration, connection test, sync status |
| **15** | Integration with §23 (impact scoring uses traffic data), §29 (baseline metrics) |
| **16** | Integration with §28 (behavioral signal → calibration), §22 (frustration → heuristic boost) |
| **16** | Custom webhook adapter for non-standard analytics providers |

---

**End of §30 — Analytics Bindings**

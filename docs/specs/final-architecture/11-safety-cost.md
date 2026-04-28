---
title: 11-safety-cost
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

# Section 11 — Safety, Rate Limits & Cost Control

> **See also §33 — Agent Composition Model.** §33.9 extends the cost model with composition-mode pricing: interactive evaluate costs more per heuristic (typically 1.3-2.5× single-shot) due to ReAct loop tool calls. Per-heuristic interaction budgets (§33.7c) and Pass 2 open observation budgets (§33.10) are enforced through the rate limiter and budget gate defined here. Phase 4 builds the `SafetyContext`-aware classifier (§33a REQ-COMP-PHASE4-001); analyze-mode safety rules activate in Phase 14.

## 11.1 Safety Classification (Browse Mode)

**REQ-SAFETY-001:** Classification is deterministic code, NOT LLM judgment.

| Class | Tools | Gate Behavior |
|-------|-------|---------------|
| **safe** | navigate, go_back, go_forward, reload, get_state, screenshot, get_metadata, scroll, hover, find_by_text, get_network, wait_for, extract, page_analyze, page_get_element_info, page_get_performance, page_screenshot_full, page_annotate_screenshot | Proceed, minimal log |
| **caution** | click, click_coords (Mode C), type, select, press_key, tab_manage, agent_request_human | Proceed, full audit log |
| **sensitive** | form submit, purchase, upload, download | HITL approval required |
| **blocked** | evaluate_js on untrusted domain, denylist domain access | Block, alert, terminate |

**REQ-SAFETY-002:** Domain policies:
- **Denylist:** Banking, government with legal implications → blocked
- **Allowlist:** Trusted internal domains → relaxed rate limits
- **Default:** Standard restrictions

**REQ-SAFETY-003:** All `caution` and `sensitive` actions logged to `audit_log` table.

### 11.1.1 Robots / ToS Hard Rules (v2.5 — Phase 4 extension)

**REQ-SAFETY-005:** The browser SHALL respect `robots.txt`. Implementation:
- Fetch `<root>/robots.txt` once per audit at `audit_setup`
- Parse User-agent rules, Disallow paths
- Refuse navigation to disallowed paths; emit `ROBOTS_TXT_DISALLOWED` warning into PerceptionBundle
- Do not bypass via UA spoofing

**REQ-SAFETY-006:** Real form submissions are **hard-blocked** unless the AuditRequest explicitly enables them:

| Form action | Default behavior | Override |
|---|---|---|
| Submit checkout / payment / purchase | **NEVER** — hard block, no override | None. Hard rule. |
| Create account / register | Block by default | Requires `AuditRequest.allow_form_submit: ["account_creation"]` + consultant approval per audit |
| Add-to-cart (state-mutating retry) | Block on retry — first attempt allowed | Requires `AuditRequest.allow_cart_mutation: true` |
| Newsletter / marketing signup | Block by default | Requires explicit list in AuditRequest |
| Search / filter / non-mutating GET | Allowed | — |
| Login / authentication | **NEVER auto-attempt** | Use `AuditRequest.auth_seed` (cookies / localStorage) instead |

**REQ-SAFETY-007:** The browser SHALL use a **realistic User-Agent**. No spoofing of search engine crawlers (Googlebot etc.). Default UA = Playwright stealth default. Override only for testing-environment whitelist.

**REQ-SAFETY-008:** Throttling defaults — same as §11.3 rate limits, but per-domain (not just global). Audits cannot DDoS a single client by spreading load globally.

**REQ-SAFETY-009:** No automated authentication attempts. Auth-required pages produce `AUTH_REQUIRED_DETECTED` warning + skip page from queue. To audit authenticated pages, use `AuditRequest.auth_seed` mechanism (Phase 13 master track).

**REQ-SAFETY-010:** Retries that mutate state are forbidden. If add-to-cart succeeds then page navigation fails, do NOT retry add-to-cart. Mark page as failed; audit continues.

## 11.2 Domain Circuit Breaker

**REQ-SAFETY-004:** If 3 consecutive sessions fail on domain X within 1 hour:
1. Block automated retries for 1 hour
2. Log circuit-breaker event
3. Require explicit user override to resume

## 11.3 Browse Rate Limits

**REQ-RATE-001:**

| Scope | Limit | Rationale |
|-------|-------|-----------|
| Global | 30 actions/min | Prevents resource abuse |
| Per-domain (unknown) | 10 actions/min | Matches human browsing pace |
| Per-domain (trusted) | 30 actions/min | Higher for internal domains |
| Per-session | 2s minimum interval | Human-realistic pacing |

**REQ-RATE-002:** SHALL respect `robots.txt`. If path disallowed, block Mode A/B, offer HITL.

**REQ-RATE-003:** SHALL check `ai-agent.txt` as fallback if `robots.txt` absent.

## 11.4 Analysis Rate Limits

**REQ-ANALYSIS-RATE-001:**

| Scope | Limit | Rationale |
|-------|-------|-----------|
| Token budget per page | Max 15,000 input tokens | Prevents oversized prompts |
| Token budget per audit | Max 500,000 total tokens | Prevents runaway costs |
| LLM calls per page | Max 3 (evaluate + critique + 1 retry) | Bounded cost per page |
| Concurrent analysis | 1 page at a time (sequential) | Simplicity, cost control |

## 11.5 Cost Model

### Per-Page Costs

| Component | Cost | Method |
|-----------|------|--------|
| Browse mode (navigate to page) | ~$0.10 | 1-2 LLM calls |
| Analyze mode (full page scan) | ~$0.05 | 1 `page_analyze()` call (no LLM) |
| Heuristic evaluation (CoT) | ~$0.15 | 1 LLM call, ~10K tokens |
| Self-critique | ~$0.05 | 1 LLM call, ~4K tokens |
| Evidence grounding | ~$0.00 | Code only, no LLM |
| Screenshot annotation | ~$0.00 | Sharp, no LLM |
| **Total per page** | **~$0.35** | |

### Per-Audit Costs

| Audit Type | Pages | Browse | Analyze | Total |
|-----------|-------|--------|---------|-------|
| Single site (10 pages) | 10 | $1.00 | $2.50 | ~$3.50 |
| Single site (50 pages) | 50 | $5.00 | $12.50 | ~$17.50 |
| Site + 1 competitor | 20 | $2.00 | $5.00 | ~$7.00 |
| Site + 2 competitors | 30 | $3.00 | $7.50 | ~$10.50 |
| Site + 2 competitors + comparison | 30+comp | $3.00 | $8.50 | ~$11.50 |

### Monthly Costs at Scale

| Audits/week | Avg pages/audit | LLM cost/mo | Infrastructure/mo | Total/mo |
|------------|----------------|-------------|-------------------|----------|
| 10 | 15 | ~$210 | ~$150 | ~$360 |
| 20 | 15 | ~$420 | ~$150 | ~$570 |
| 50 | 15 | ~$1,050 | ~$200 | ~$1,250 |

## 11.6 Budget Enforcement

**REQ-COST-001:**

```typescript
interface BudgetEnforcer {
  // Per-audit budget
  audit_budget_usd: number;           // default: $15.00
  audit_spent_usd: number;

  // Per-page budget
  page_budget_usd: number;            // default: $5.00
  page_spent_usd: number;

  // Check before LLM call
  canProceed(estimatedCost: number): boolean;

  // Track after LLM call
  recordCost(actualCost: number): void;
}

function canProceed(enforcer: BudgetEnforcer, estimatedCost: number): boolean {
  if (enforcer.audit_spent_usd + estimatedCost > enforcer.audit_budget_usd) {
    return false;  // audit budget exceeded
  }
  if (enforcer.page_spent_usd + estimatedCost > enforcer.page_budget_usd) {
    return false;  // page budget exceeded
  }
  return true;
}
```

**REQ-COST-002:** When budget exceeded:
1. Complete current step (don't leave partial state)
2. Skip remaining steps for this page
3. Mark page as `budget_exceeded` in queue
4. If audit budget exceeded, trigger `audit_complete` with `completion_reason = "budget_exceeded"`
5. Log budget event for monitoring

---

## 11.7 Token-Level Cost Accounting (v2.2)

**REQ-COST-010:** Every LLM call SHALL be logged atomically to `llm_call_log` table with:

```typescript
interface LLMCallRecord {
  id: string;                           // uuid
  audit_run_id: string;
  page_url: string | null;              // null for cross-page/audit-level calls
  node_name: string;                    // "evaluate" | "self_critique" | "funnel_analysis" | etc.
  heuristic_id: string | null;          // for interactive mode
  model: string;                        // "claude-sonnet-4-20260301"
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;                     // computed from MODEL_PRICING
  duration_ms: number;
  cache_hit: boolean;                   // prompt caching hit
  timestamp: string;
}
```

**REQ-COST-011:** `MODEL_PRICING` config defines per-model costs. Updated when providers change pricing:

```typescript
const MODEL_PRICING: Record<string, { input_per_m: number; output_per_m: number }> = {
  "claude-sonnet-4-20260301": { input_per_m: 3.00, output_per_m: 15.00 },
  "gpt-4o-2025-xx-xx":        { input_per_m: 2.50, output_per_m: 10.00 },
};
```

**REQ-COST-012:** Pre-call budget gate — before every LLM call:
1. Estimate cost from prompt token count via `LLMAdapter.getTokenCount()`
2. If `estimated_cost > budget_remaining_usd` → skip call, emit `budget_exceeded` event
3. For evaluate node: if budget tight, split heuristic batch (20 → 2×10) to reduce per-call risk

**REQ-COST-013:** Post-audit cost summary — `audit_complete` computes from `llm_call_log`:
- `actual_cost_usd` — sum of all call costs
- `cost_breakdown` by node_name
- `cost_per_page_avg`
- `cache_hit_rate`

Written to `audit_runs.cost_summary` (JSONB).

**REQ-COST-014:** Per-client cost attribution:
```sql
SELECT client_id, SUM(cost_usd)
FROM llm_call_log
JOIN audit_runs ON llm_call_log.audit_run_id = audit_runs.id
GROUP BY client_id
```

Enables per-client billing and profitability analysis.

---

## 11.8 LLM Rate Limiting (v2.2)

**REQ-RATE-LLM-001:** Rate limits enforced inside `LLMAdapter` before every call. Sliding window rate limiter in Redis (via Upstash).

**REQ-RATE-LLM-002:** Default configs (adjustable via env vars):

```typescript
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  anthropic: { requests_per_minute: 50, tokens_per_minute: 80000, max_concurrent: 5 },
  openai:    { requests_per_minute: 60, tokens_per_minute: 150000, max_concurrent: 5 },
};
```

**REQ-RATE-LLM-003:** Before each call:
1. Check RPM window — if at limit, wait with backoff
2. Check TPM window against estimated input tokens — if near limit, queue
3. Check concurrent count — if at max, queue

**REQ-RATE-LLM-004:** Exponential backoff with jitter: base 1s, multiplier 2×, jitter ±20%, max 30s.

---

## 11.9 LLM Failover (v2.2)

**REQ-FAILOVER-001:** Per-call failover (not per-audit). Each call attempts primary, then fallback, then errors out.

**REQ-FAILOVER-002:** Call attempt flow:
1. Try primary provider (Claude Sonnet 4) — up to 3 retries with backoff
2. All 3 fail → switch to fallback provider (GPT-4o) for THIS CALL ONLY
3. Fallback: up to 2 retries
4. All fail → throw `LLMUnavailableError`
5. Next call: try primary again first (no sticky fallback)

**REQ-FAILOVER-003:** Failure classification:
- HTTP 429 (rate limited), 500/502/503 (server error), 529 (overloaded), timeout, network error → RETRY
- HTTP 400 (bad request) → DO NOT RETRY, log and fail immediately

**REQ-FAILOVER-004:** When failover occurs:
- Log `FailoverEvent` to `audit_events` table
- Finding gets `model_used` field recording which model actually produced it
- Finding gets `model_mismatch = true` when produced by fallback
- Consultant sees badge "produced by fallback model" in review UI

**REQ-FAILOVER-005:** Both providers down:
1. 3+ consecutive pages fail with `llm_failed` → audit pauses (not terminates)
2. `audit_status = "paused_llm_unavailable"`
3. BullMQ schedules resume attempt in 5 minutes (max 3 attempts)
4. After 15 min total, audit marked `failed` with reason `llm_providers_unavailable`

**REQ-FAILOVER-006:** No degraded deterministic-only mode. The evaluate step IS the product. Better to pause and resume than deliver low-quality output.

# Section 11 — Safety, Rate Limits & Cost Control

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

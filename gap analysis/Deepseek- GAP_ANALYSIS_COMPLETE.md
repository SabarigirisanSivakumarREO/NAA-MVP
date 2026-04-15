# Comprehensive Gap Analysis: AI CRO Audit Platform

Below is every missing piece I can identify from your master plan, organized by category. For each gap, I provide:

- **What's missing** – the capability or concern absent from the spec
- **How to improve (Architectural)** – changes to the system design
- **How to improve (Development)** – concrete implementation steps

I have not repeated the obvious (e.g., "you need tests") unless it's structurally missing.

---

## 1. BUSINESS CONTEXT & STRATEGIC INJECTION

### 1.1 No understanding of client's conversion goals per page

**What's missing**
Your plan evaluates pages against generic heuristics without knowing what the client wants the user to *do* on that page (e.g., "sign up", "buy", "download", "contact"). A top consultant adjusts severity based on goal alignment.

**Architectural improvement**
Add `PageGoal` entity:
- `page_id`, `primary_conversion_action` (CTA text / element selector), `secondary_goals`, `success_metrics` (e.g., form submission, click-through)
- Inject into `evaluate` prompt: *"This page's primary goal is to get the user to [action]. Evaluate heuristics in that context."*

**Development improvement**
- Create `ClientContext` schema in DB (Zod validated)
- Extend `audit_setup` node to accept a goals manifest (CSV or JSON) per URL pattern
- Build a simple UI in consultant dashboard to map URLs to goals before audit runs

### 1.2 No funnel modeling or cross-page leak detection

**What's missing**
Pages are analyzed in isolation. Consultants spot leaks across steps (e.g., homepage → category → product → cart → checkout). No detection of missing "next step" elements.

**Architectural improvement**
Add `FunnelStage` enum and `FunnelDefinition` per audit. After all pages analyzed, run `FunnelLeakDetector` that:
- Verifies each stage has a clear path to the next (e.g., "Add to Cart" on product → "Proceed to Checkout" on cart)
- Flags any stage where conversion element is missing or inconsistent (different wording, hidden)

**Development improvement**
- Extend `AuditState` with `funnel_definition: FunnelStage[]` and `page_to_stage_map`
- Create `FunnelAnalyzer` module that runs after page loop, outputs `FunnelFinding` (severity=high if leak)
- Store findings in internal store with `finding_type='funnel_leak'`

### 1.3 No industry benchmarking or competitor comparison (beyond mention)

**What's missing**
"Competitor view" is mentioned but no architecture for comparing across domains. Without benchmark, clients can't tell if a finding is critical or normal for their industry.

**Architectural improvement**
Add optional `CompetitorAudit` that runs same heuristics on competitor URLs. Store results in `competitor_benchmarks` table. Dashboard shows: *"Your site has 3 trust signals; average competitor has 7."*

**Development improvement**
- Add `Competitor` entity with `url`, `industry`, `audit_id`
- Reuse analysis pipeline but store results with `is_competitor=true`
- Build comparison view in client dashboard (side-by-side radar chart)

---

## 2. PAGE DISCOVERY & CRAWLING (UNDERSPECIFIED)

### 2.1 No handling of sites without sitemap.xml

**What's missing**
Your plan assumes sitemap exists. Real sites often don't. You'll get zero pages and audit fails.

**Architectural improvement**
Implement `CrawlStrategy` interface with three implementations:
1. `SitemapCrawler` – parse sitemap.xml or sitemap index
2. `InternalLinkCrawler` – BFS from homepage, depth limit 3, max 200 URLs, respect `robots.txt`
3. `ManualListProvider` – client provides exact URLs

**Development improvement**
- Create `PageDiscoveryService` with fallback chain: sitemap → internal crawl → manual
- Store `discovery_method` per audit for debugging
- Add timeout (2 minutes for discovery) and hard cap of 200 candidate URLs before filtering to 50

### 2.2 No duplicate URL or content detection

**What's missing**
Pagination, session IDs, print versions create duplicate pages. Analyzing them wastes budget and dilutes findings.

**Architectural improvement**
Add `NormalizedUrl` function (remove query params like `?sessionId=...`, lower-case, trailing slash). Compute content hash (DOM structure without dynamic data) after page load. Skip page if URL or content hash already processed.

**Development improvement**
- Implement `url_normalizer.ts` with rule set (remove `utm_*`, `ref=`, `sessionid`)
- Compute `dom_hash` (SHA256 of cleaned body innerHTML) after stabilization
- In `page_router`, check `processed_urls` and `processed_hashes`; skip duplicates and log warning

### 2.3 No robots.txt or rate-limit respect (legal & technical risk)

**What's missing**
Your agent could be blocked or sued for ignoring `robots.txt` or hammering a server.

**Architectural improvement**
Add `RobotsTxtParser` that caches rules per domain. Before navigating, check if URL is disallowed. If disallowed, skip page and record reason.
Add domain-wide rate limiter: 1 request per second for unknown domains, 5/sec for trusted (configurable).

**Development improvement**
- Use `robots-parser` npm package
- Store `domain_rate_limit` in Redis with sliding window
- In `BrowserEngine`, before each navigation, call `checkRateLimit(domain)` – wait if exceeded

---

## 3. COST & BUDGET (SERIOUSLY UNDERSPECIFIED)

### 3.1 No token-level cost accounting

**What's missing**
You budget $0.35/page but don't track actual tokens per LLM call. One long page with 50K tokens of AX-tree could cost $1.50 just for evaluate.

**Architectural improvement**
Add `TokenCounter` that, before each LLM call, estimates cost based on prompt length + expected output. After call, subtract actual cost from `analysis_budget_usd`. Kill page if budget < 0.

**Development improvement**
- Extend `LLMAdapter` to return `{ cost, input_tokens, output_tokens }`
- Maintain `remaining_budget_cents` in `AuditState`
- In `evaluate` node, check if estimated cost > remaining; if yes, skip heuristic or downgrade to static analysis

### 3.2 No early termination for low-value pages

**What's missing**
You analyze a blog post (low business impact) the same way you analyze a checkout page (high impact). Wastes money.

**Architectural improvement**
Add `PageValueScorer` that computes `importance_score` based on:
- `funnel_position` (checkout > cart > product > homepage > blog)
- `business_type` weighting (e.g., for SaaS, pricing page is high)
- User-provided priority (client can mark pages as "critical")

**Development improvement**
- Assign importance 0–1. Only run full analysis (self-critique + grounding) if >0.6.
- Low-importance pages get only evaluate (no critique) and findings marked as "preliminary"

### 3.3 No cost-based mode switching

**What's missing**
You decide static vs interactive mode up front. But you could cheap-scan first, then escalate only if cheap scan finds many violations.

**Architectural improvement**
Implement `AdaptiveModeSelector`:
1. Run Tier 1 heuristics only (no LLM, deterministic checks)
2. If violation rate > 50%, escalate to full static analysis
3. If still ambiguous, escalate to interactive (only for top 3 high-importance pages)

**Development improvement**
- Add `cheap_scan` node that uses DOM analysis only (no LLM)
- Store `cheap_scan_violations` count; if > threshold, proceed to LLM
- Interactive mode only if `importance_score > 0.8 AND cheap_scan found >0 violations`

---

## 4. QUALITY & HALLUCINATION (MISSING LAYERS)

### 4.1 No adversarial testing for grounded facts

**What's missing**
Your grounding rules check existence, but they don't test *contradictions* (e.g., LLM says "CTA is above fold" – page says it's below). You have no cross-validation.

**Architectural improvement**
Add `ContradictionDetector` that compares LLM's `evidence.data_point` against actual page data. If mismatch > threshold, reject finding with reason "contradicts computed style".

**Development improvement**
- For each numeric claim (contrast ratio, fold position, form field count), retrieve ground truth from `AnalyzePerception`
- Compute absolute difference; if > 20% relative error, reject
- Log rejected finding with `contradiction_error`

### 4.2 No consistency across pages for same heuristic

**What's missing**
Heuristic "navigation is consistent" requires checking multiple pages. Your single-page analysis can't detect inconsistency.

**Architectural improvement**
Add `CrossPageConsistencyChecker` that runs after all pages are analyzed. Groups findings by heuristic_id. If same heuristic passes on page A but fails on page B, generate a new "inconsistency" finding.

**Development improvement**
- Store per-page heuristic pass/fail in `heuristic_page_results` table
- Post-process: for each heuristic, if pass rate < 100% but > 0%, create `InconsistentFinding`
- Assign medium severity (confuses users)

### 4.3 No way to validate "missing element" when element doesn't exist

**What's missing**
LLM says "no trust signals". Grounding rule GR-001 can't verify absence of something – you can only verify presence. This is a classic hallucination risk.

**Architectural improvement**
For negative claims ("missing X"), require the LLM to also state what *should* be there (e.g., "trust signal like a testimonial"). Grounding checks that the expected element does not exist AND that a similar element (fuzzy match) doesn't exist.

**Development improvement**
- Extend `RawFinding` with `expected_element_description` (string)
- In ground node, use fuzzy text matching (e.g., "testimonial" vs "client story") to confirm absence
- If expected element is found, reject finding with "element actually present"

---

## 5. OPERATIONAL & RESILIENCE (ALMOST MISSING)

### 5.1 No retry with backoff for transient failures

**What's missing**
Your spec says "retry 3x" but no exponential backoff or jitter. You'll hammer failing APIs and get rate-limited.

**Architectural improvement**
Implement `RetryPolicy` with:
- Initial delay 1s, multiply by 2 each retry, add jitter (±20%)
- Different policies for different failure types (network vs LLM rate-limit vs bot detection)

**Development improvement**
- Wrap all external calls (LLM, Playwright) in `retryWithBackoff` utility
- Store retry counts in `AuditState` to avoid infinite loops
- After 3 retries, escalate to HITL or skip with error log

### 5.2 No graceful degradation when LLM fails

**What's missing**
If Claude returns a 429 (rate limit) and GPT-4o also fails, your audit dies. No fallback to heuristic-only mode.

**Architectural improvement**
Add `DegradationMode`:
- Level 1: LLM unavailable → use deterministic heuristics only (reduced accuracy but still runs)
- Level 2: Both LLMs fail → pause audit, resume later, or email admin

**Development improvement**
- In `LLMAdapter`, if both primary and fallback fail, throw `DegradationException`
- Orchestrator catches it and sets `audit_status = 'degraded'` and continues with available heuristics
- Log alert to monitoring system

### 5.3 No health checks or liveness for browser instances

**What's missing**
Playwright browser can crash, become unresponsive, or leak memory. Your plan has no recovery.

**Architectural improvement**
Add `BrowserHealthChecker` that:
- Pings browser context every 30 seconds with `browser.isConnected()`
- On failure, re-initialize browser session (with same session ID if possible)
- Kill and restart after 5 consecutive failures

**Development improvement**
- In `BrowserSessionManager`, run background heartbeat
- Expose `/health` endpoint in MCP server (Phase 2+)
- On crash, emit `session_dead` event and trigger session recreation

---

## 6. SECURITY & IP (GAPS BEYOND ENCRYPTION)

### 6.1 No audit logging of who accessed which findings

**What's missing**
You have `audit_log` table but no per-finding access log. Compliance (GDPR, SOC2) requires knowing who saw what.

**Architectural improvement**
Add `finding_access_log` table with `finding_id`, `user_id`, `accessed_at`, `access_reason` (e.g., "client dashboard", "consultant review", "MCP query").

**Development improvement**
- Create middleware that logs every read from `published_findings` view
- Include IP address and user agent (from Clerk session)
- Store for 90 days, then rotate

### 6.2 No redaction of PII from screenshots

**What's missing**
Screenshots may contain PII (names, emails, credit card numbers). Storing them in R2 without redaction is a liability.

**Architectural improvement**
Add `PiiRedactor` that uses regex + a local LLM (or off-the-shelf) to blur:
- Email addresses, phone numbers, credit card patterns, names (using entity recognition)
- Run before storing to R2; store original only temporarily.

**Development improvement**
- Use `node-redact` or `pii-filter` library
- Run redaction in `annotate_and_store` node after screenshot capture
- Store redacted version; delete original from memory immediately

### 6.3 No rate limiting on MCP server (Phase 6+)

**What's missing**
When you build MCP, there's no protection against a client querying 10,000 findings and bankrupting your API costs.

**Architectural improvement**
Add token-bucket rate limiter per API key: 1000 requests per hour, burst 100. Also limit result set size (max 100 findings per query).

**Development improvement**
- Use `@upstash/ratelimit` (Redis) in Hono middleware
- Return `429` with `Retry-After` header
- Log rate limit violations for security review

---

## 7. DATA MODEL & STORAGE (MISSING PIECES)

### 7.1 No versioning of heuristics per audit

**What's missing**
You update a heuristic. Old audits should still reference the old version. Otherwise reproducibility is broken.

**Architectural improvement**
Store a snapshot of the heuristic JSON in `audit_runs` table at audit start. Not just `heuristic_set_id`. Each heuristic has `content_hash` and `version`.

**Development improvement**
- In `audit_setup`, copy active heuristic content into `audit_runs.heuristic_snapshot` (JSONB)
- When evaluating, use snapshot, not live repository
- On dashboard, show which heuristic version was used

### 7.2 No separation of "raw findings" vs "reviewed findings" in DB schema

**What's missing**
Your schema shows `findings` table but not the lifecycle stages. You'll lose rejected findings if you overwrite.

**Architectural improvement**
Implement the full pipeline as separate tables:
- `raw_findings` (from evaluate)
- `critiqued_findings` (after self-critique)
- `grounded_findings` (after grounding)
- `rejected_findings` (append-only)

**Development improvement**
- Each table has `audit_run_id`, `finding_hash` for dedup
- Move data between tables via idempotent ETL
- Final `published_findings` view unions from `grounded_findings` where publish_status = published

### 7.3 No indexing strategy for query performance

**What's missing**
With 20 audits/week × 50 pages × 20 findings = 20,000 findings/week. Queries on dashboard will become slow without indexes.

**Architectural improvement**
Add explicit indexes:
- `idx_findings_audit_run_id`
- `idx_findings_heuristic_id`
- `idx_findings_publish_status_created`
- `idx_screenshots_finding_id`

**Development improvement**
- Write migration scripts with `CREATE INDEX CONCURRENTLY`
- Use `pg_stat_statements` to identify missing indexes after MVP
- Add composite index on `(client_id, published_at DESC)` for dashboard feed

---

## 8. DEVELOPMENT & TESTING (MISSING PRACTICES)

### 8.1 No offline / mock mode for development

**What's missing**
Developers will burn API credits and get blocked by real sites during local testing. No way to run pipeline with recorded responses.

**Architectural improvement**
Add `MODE=offline` environment variable. In offline mode:
- Browser engine returns mock page snapshots from fixtures
- LLM adapter returns canned findings from JSON files
- No network calls to Anthropic/OpenAI

**Development improvement**
- Create `MockBrowserEngine` and `MockLLMAdapter` implementing same interfaces
- Store fixtures in `test/fixtures/`
- Add `pnpm test:offline` command

### 8.2 No integration test for full audit run

**What's missing**
Your test plan mentions Vitest (unit) and Playwright Test (integration) but no end-to-end test that runs an audit on a test site (e.g., localhost dummy store) and asserts findings.

**Architectural improvement**
Add `AuditE2ETest` suite that:
- Starts a local static test site (e.g., `test-site/` with known violations)
- Runs CLI audit
- Asserts that expected findings (e.g., "missing alt text") are present and grounded

**Development improvement**
- Use `http-server` npm package to serve test site in CI
- Run full audit with `NODE_ENV=test` and budget $0 (mock LLM if needed)
- Compare output against golden master JSON

### 8.3 No performance budget for each pipeline node

**What's missing**
No timeouts per node. A single LLM call could hang for 60 seconds, blocking entire audit.

**Architectural improvement**
Add `node_timeout_seconds` in `AuditState` (default 30s for LLM, 60s for browse). Use `Promise.race` with timeout rejection.

**Development improvement**
- Wrap each graph node execution with `withTimeout(nodeFn, timeout)`
- On timeout, log error, skip node (if possible) or fail audit gracefully
- Make timeouts configurable per client tier

---

## 9. USER EXPERIENCE & FEEDBACK (MISSING)

### 9.1 No progress estimation or ETA for running audits

**What's missing**
Clients submit an audit and have no idea when it will finish. No streaming progress beyond SSE events (which are under-specified).

**Architectural improvement**
Add `progress_tracker` that computes:
- `pages_completed` / `total_pages`
- `estimated_seconds_remaining` based on average time per page (rolling window)
- Expose via API endpoint `GET /audits/:id/progress` and SSE event `progress_update`

**Development improvement**
- In orchestrator, after each page, compute elapsed time and update moving average
- Store progress in Redis (for quick access)
- Dashboard shows progress bar with ETA

### 9.2 No way for consultant to provide inline corrections on findings

**What's missing**
Consultant can approve/reject but not edit a finding's severity or recommendation text. That means the system never learns nuance.

**Architectural improvement**
Add `FindingCorrection` entity:
- `original_finding_id`, `field_changed` (severity, recommendation, assessment)
- `new_value`, `consultant_id`, `reason`
- Trigger feedback loop to adjust future prompts.

**Development improvement**
- Extend consultant dashboard to allow inline editing
- Store corrections in `finding_corrections` table
- Weekly batch process: use corrections to fine-tune heuristic weights or prompt examples

### 9.3 No "why was this rejected?" explanation for clients

**What's missing**
When a finding is rejected by grounding or consultant, the client sees nothing. They lose trust.

**Architectural improvement**
Store rejection reason in `rejected_findings` and expose a summarized version in client dashboard: *"Finding about missing CTA was rejected because the CTA element was found at selector .buy-now."*

**Development improvement**
- Add `rejection_explanation` field to `rejected_findings`
- In client dashboard, show a "View rejected hypotheses" toggle (disabled by default)
- Display explanation in tooltip

---

## SUMMARY TABLE: TOP 10 CRITICAL MISSING PIECES

| # | Missing Piece | Impact (1-5) | Effort to fix (weeks) |
|---|---------------|--------------|------------------------|
| 1 | Business context & page goals | 5 (fatal) | 2 |
| 2 | Funnel leak detection | 5 | 1.5 |
| 3 | Token-level cost accounting | 5 | 1 |
| 4 | Robots.txt + rate limiting | 4 (legal) | 0.5 |
| 5 | Duplicate page detection | 3 | 0.5 |
| 6 | Cross-page consistency | 4 | 1 |
| 7 | Offline mock mode | 4 | 1 |
| 8 | PII redaction on screenshots | 5 (legal) | 0.5 |
| 9 | Progress estimation & ETA | 3 | 0.5 |
| 10 | Consultant inline corrections | 4 | 1.5 |

**Total additional effort:** ~10 weeks to make the product viable.

---

## FINAL ADVICE (RUTHLESS)

Your master plan is a **research prototype**, not a production system. You have over-engineered the browser automation (23 tools, 9 verification strategies, multiplicative confidence) while **under-engineering business value, cost control, and operational resilience**.

**Stop adding academic complexity. Start adding practical survival features.**

Do this:
1. **Cut** 70 heuristics, state exploration, interactive mode, workflow mode, MCP, Temporal, pgvector.
2. **Add** business context, funnel detection, token budgets, duplicate detection, offline mode, PII redaction.
3. **Build** the 18-week MVP (detailed in the previous response).
4. **Then** add sophistication only when you have paying customers and real failure data.

Otherwise, you will burn $50k in development and API credits and deliver a system that can't survive a single real-world audit on a messy ecommerce site with no sitemap and a rate-limiting firewall.

**You asked for ruthless. Here it is: The plan is beautiful on paper and useless in production. Fix the gaps above or pivot to a simpler problem.**
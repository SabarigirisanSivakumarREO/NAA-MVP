# MVP Specification

## What We're Building

A command-line tool that audits a website for CRO issues by:
1. Crawling up to 5 pages
2. Analyzing each against ~15 CRO heuristics
3. Producing annotated screenshots and a JSON findings report

This MVP validates the entire dual-mode architecture (browse + analyze) end-to-end with the absolute minimum scope.

---

## Functional Requirements

### F-001: CLI Entry Point

**Description:** A CLI command that triggers an audit.

**Interface:**

```bash
pnpm cro:audit --url <URL> [--pages N] [--output PATH]

Examples:
  pnpm cro:audit --url https://example.com
  pnpm cro:audit --url https://shop.example.com --pages 5 --output ./audit-report
```

**Acceptance Criteria:**
- Accepts a starting URL (required)
- Accepts optional `--pages` (default: 5, max: 5 for MVP)
- Accepts optional `--output` directory (default: `./output`)
- Validates URL format before starting
- Prints real-time progress to stdout
- Exits with code 0 on success, non-zero on failure
- Displays final summary: pages crawled, findings count, total cost, duration

---

### F-002: Page Crawling (Browse Mode)

**Description:** Navigate to URLs and prepare them for analysis.

**Behavior:**
- Launch Playwright with stealth plugin
- Navigate to the start URL
- Handle cookie consent banners (auto-dismiss when possible)
- Close popups and modals
- Wait for page stability (mutation observer)
- For multi-page audits: discover internal links from homepage and queue up to N pages
- Use Mode B (Guided Agent) execution mode

**Acceptance Criteria:**
- Successfully navigates to https://example.com
- Successfully navigates to amazon.in (handles anti-bot)
- Detects and dismisses cookie banners
- Waits for SPA navigation to complete via MutationObserver
- Each page produces a stable PageStateModel
- Failed page navigation is logged but does not crash the audit

---

### F-003: Page Analysis (Analyze Mode)

**Description:** Evaluate each page against the heuristic knowledge base.

**Behavior:**
- Run `page_analyze` to capture full page perception
- Take viewport + full-page screenshots
- Auto-detect page type (homepage / product / checkout / form / other)
- Filter heuristics by page type and business type (e.g., "ecommerce" by default)
- Send filtered heuristics to LLM via chain-of-thought prompt
- Run self-critique pass on raw findings
- Run evidence grounding (8 rules) on reviewed findings
- Annotate screenshots with finding pins
- Store findings in PostgreSQL

**Acceptance Criteria:**
- Each page returns 0-10 grounded findings
- Self-critique rejects at least 1 finding per audit (proves filter works)
- Evidence grounding rejects at least 1 hallucinated finding per audit (proves grounding works)
- Annotated screenshots have visible numbered pins with severity colors
- All findings stored in `findings` table with correct status

---

### F-004: Heuristic Knowledge Base

**Description:** Load 100 CRO heuristics for MVP.

**Behavior:**
- Load from `heuristics-repo/*.json` at startup
- Validate against Zod schema
- Filter by page type and business type per request
- 100 heuristics total for MVP:
  - 50 Baymard (homepage, product, checkout, cart, forms, mobile)
  - 35 Nielsen (10 core heuristics + sub-heuristics for error prevention, navigation, recognition)
  - 15 Cialdini (6 principles × 2-3 concrete applications: social proof, scarcity, authority, reciprocity, commitment, liking)

**Tier distribution (preserved from 60-heuristic ratio):**
  - Tier 1 Visual/Structural: ~42 (42%)
  - Tier 2 Content/Persuasion: ~42 (42%)
  - Tier 3 Interaction/Emotional: ~16 (16%)

**Acceptance Criteria:**
- All 100 heuristics pass Zod validation at load
- Filtering returns 15-25 relevant heuristics per page type + business type combo
- Heuristic content NEVER appears in CLI output (only `heuristic_id`)
- Heuristic JSON encrypted at rest (AES-256-GCM)

---

### F-005: Findings Output

**Description:** Produce structured findings as JSON + annotated screenshots.

**Output Structure:**

```
output/
├── audit-{audit_run_id}/
│   ├── summary.json                    # Audit metadata + counts
│   ├── findings.json                   # All grounded findings
│   ├── pages/
│   │   ├── homepage/
│   │   │   ├── viewport-clean.jpg
│   │   │   ├── viewport-annotated.jpg
│   │   │   ├── fullpage-clean.jpg
│   │   │   ├── fullpage-annotated.jpg
│   │   │   └── findings.json           # findings for this page
│   │   ├── product-1/
│   │   └── ...
│   └── trace.json                      # LangSmith trace reference
```

**Acceptance Criteria:**
- All files generated correctly per the structure above
- `summary.json` includes: audit_run_id, url, pages_crawled, findings_count, total_cost_usd, duration_seconds
- `findings.json` is a JSON array of grounded findings
- Each annotated screenshot has visible pins
- Total output size < 50 MB per audit

---

### F-006: Database Persistence

**Description:** Store all audit data in PostgreSQL.

**Behavior:**
- Connect to PostgreSQL on startup
- Run migrations automatically (Drizzle Kit)
- Store: clients, audit_runs, findings, screenshots, sessions, audit_log
- Use `gen_random_uuid()` for IDs

**Acceptance Criteria:**
- Schema deployed via `pnpm db:migrate`
- Audit creates a new `audit_runs` row
- All findings stored with correct foreign keys
- Audit log records all caution/sensitive actions
- No PII stored

---

### F-007: Cost Tracking

**Description:** Track LLM API costs throughout the audit.

**Behavior:**
- Each LLM call records token count and cost
- Total tracked in `audit_run.total_cost_usd`
- Hard cap: $5 per audit (configurable)
- When cap reached, audit terminates gracefully

**Acceptance Criteria:**
- Per-call cost recorded in trace
- Total cost displayed in CLI summary
- Cap enforcement works (audit terminates cleanly when exceeded)

---

## Non-Functional Requirements

### NF-001: Performance

| Metric | Target |
|--------|--------|
| Time to first finding | < 60 seconds |
| 5-page audit total time | < 15 minutes |
| Memory usage (Node process) | < 1 GB |
| Concurrent audits supported (MVP) | 1 (sequential) |

### NF-002: Cost

| Metric | Target |
|--------|--------|
| Cost per page | < $1.00 |
| Cost per 5-page audit | < $5.00 |
| Cost per LLM call (analyze) | < $0.20 |

### NF-003: Quality

| Metric | Target |
|--------|--------|
| Self-critique rejection rate | At least 1 per audit |
| Evidence grounding rejection rate | At least 1 per audit |
| Browse action verification rate | 100% |
| False positive rate (consultant assessment) | TBD post-MVP |

### NF-004: Reliability

| Metric | Target |
|--------|--------|
| Audit success rate (clean exit) | > 90% |
| Page-level failure tolerance | Audit continues even if 1-2 pages fail |
| Crash recovery | LangGraph Postgres checkpointer enables resume |

### NF-005: Security

| Requirement | Implementation |
|------------|---------------|
| Heuristic IP protection | AES-256-GCM encryption at rest, redacted in traces |
| No secrets in code | All secrets via environment variables |
| No PII in database | Validated in code review |
| Audit log immutable | Append-only, no UPDATE/DELETE |

---

## Out of Scope (Post-MVP)

These are explicitly NOT in the MVP. Do not implement:

| Out-of-Scope | Why | When |
|-------------|-----|------|
| Multi-tenant client management | Complexity | Phase 10 |
| Competitor comparison | Adds another full audit cycle | Phase 9 |
| Version diff (re-audit) | Requires v1 of the same client | Phase 9 |
| Web dashboard | CLI is enough to validate the loop | Phase 11 |
| Consultant review workflow | Auto-publish for MVP | Phase 10 |
| Scheduled audits | Manual trigger only | Phase 12 |
| Production deployment | Local Docker only | Phase 12 |
| Full 250+ heuristics library | Start with 100 to validate | After MVP |
| Mode A (deterministic replay) | Mode B is enough | After memory phase |
| Mode C (computer-use) | Rare fallback | After MVP |
| HITL pause/resume | Fail on sensitive for MVP | Phase 7 (full graph) |
| Reflect node (replan) | Simple retry for MVP | Phase 7 (full graph) |

---

## Test Sites

The MVP MUST be tested on these real websites:

| Site | Why | Expected Behavior |
|------|-----|------------------|
| `https://example.com` | Simplest possible test | 1-2 findings, completes in < 30s |
| `https://news.ycombinator.com` | Plain HTML, no anti-bot | 3-5 findings on layout/content |
| `https://amazon.in` | Anti-bot detection | Handle CAPTCHA gracefully OR escalate |
| `https://github.com` | Modern SPA with React | Handles SPA navigation, finds CTA issues |
| `https://airbnb.com` | Heavy JS, complex layout | Finds form/CTA issues |

---

## Acceptance Test (MVP Done)

```bash
# Run this and it should work
pnpm cro:audit --url https://example.com --pages 3 --output ./test-output

# Expected output:
# ✓ Audit started: a1b2c3d4
# ✓ Page 1/3: https://example.com (browse 8s, analyze 12s, 2 findings)
# ✓ Page 2/3: https://example.com/about (browse 5s, analyze 10s, 1 finding)
# ✓ Page 3/3: https://example.com/contact (browse 6s, analyze 11s, 3 findings)
# ✓ Audit complete: 6 findings, $1.85 cost, 52s total
# ✓ Output saved to ./test-output/audit-a1b2c3d4/

# Verify output structure
ls test-output/audit-a1b2c3d4/
# summary.json  findings.json  pages/  trace.json

# Verify findings
cat test-output/audit-a1b2c3d4/findings.json | jq '. | length'
# 6

# Verify annotated screenshots
ls test-output/audit-a1b2c3d4/pages/homepage/
# viewport-clean.jpg  viewport-annotated.jpg  fullpage-clean.jpg  fullpage-annotated.jpg  findings.json
```

If this test passes, the MVP is **DONE**.

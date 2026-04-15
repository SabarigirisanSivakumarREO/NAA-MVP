# Section 15 — Failure Modes (22 Total)

## 15.1 Browse Mode Failures (from v3.1)

| # | Failure Mode | Detection | Response |
|---|-------------|-----------|----------|
| F-01 | **Infinite loop** | Step counter reaches max_steps | Confidence decay → force exit. `completion_reason = "max_steps"`. |
| F-02 | **Hallucinated selectors** | Verify node: element not found after click | Verify against actual AX-tree before use. Structural failure → reflect. |
| F-03 | **Cost explosion** | `budget_remaining_usd <= 0` | Per-session budget cap. Terminate with `completion_reason = "failure"`. |
| F-04 | **CAPTCHA walls** | `no_captcha` verify strategy detects challenge | Pause 30s → rotate fingerprint → retry once → HITL if persists. |
| F-05 | **SPA navigation** | Page content changes without URL change | MutationObserver + wait-for-stability before verification. |
| F-06 | **Stale workflow recipes** | Mode A selector fails | 30-day validation TTL. Auto-downgrade to Mode B. |
| F-07 | **Context window overflow** | Token count exceeds model limit | Token counting + message pruning. Keep latest N messages. |
| F-08 | **Rate limiting by target site** | HTTP 429 or "too many requests" page | `no_bot_block` strategy. Backoff + respectful defaults. |
| F-09 | **Login/auth walls** | Login form detected, can't proceed | Detect → HITL for credentials. Session cookie persistence. |
| F-10 | **Domain circuit break** | 3 consecutive failures on same domain | Block automated retries for 1 hour. Require override. |
| F-11 | **Bot detection** | "Automated access" page, empty results | Pause 30s → rotate fingerprint → retry once → HITL. |
| F-12 | **Partial extraction** | `browser_extract` returns `missing_fields` | Multi-scroll extraction + merge reducer. Accept if confidence > 0.7. |

## 15.2 Analysis Mode Failures

| # | Failure Mode | Detection | Response |
|---|-------------|-----------|----------|
| AF-01 | **Hallucinated finding** | Evidence grounding: element doesn't exist (GR-001 fails) | Finding rejected. Logged in `rejected_findings` table. |
| AF-02 | **Inflated severity** | Self-critique downgrades OR grounding rejects (GR-006: no measurable evidence for critical/high) | Downgrade severity or reject. |
| AF-03 | **Malformed LLM output** | Zod schema validation fails on evaluate/critique response | Retry with simplified prompt (up to 2x). If still fails, mark `analysis_error`. |
| AF-04 | **LLM refuses evaluation** | Empty response or "I cannot evaluate this" | Retry once with shorter context. If persists, mark all heuristics as `needs_review`. |
| AF-05 | **Wrong page type detection** | `detectPageType` returns different type than orchestrator provided | Use auto-detected type. Log discrepancy. Re-filter heuristics if needed. |
| AF-06 | **Heuristic KB load failure** | File missing, JSON parse error, Zod validation fails | Audit blocked. Cannot proceed without heuristics. Alert immediately. |
| AF-07 | **Screenshot annotation overlap** | Multiple findings at same (x,y) position | Overlap avoidance algorithm shifts pins. Stack vertically if needed. |
| AF-08 | **Budget exceeded mid-analysis** | `analysis_cost_usd > analysis_budget_usd` | Complete current step. Skip remaining. Mark `budget_exceeded`. |
| AF-09 | **Conversion prediction in output** | GR-007 detects prediction phrases in finding | Finding rejected. Logged with reason. |
| AF-10 | **Context window exceeded** | Page data + heuristics > model context limit | Chunk: send top 10 heuristics first, remaining in second call. Merge findings. |

## 15.3 Audit-Level Failures

| # | Failure Mode | Detection | Response |
|---|-------------|-----------|----------|
| OA-01 | **All pages fail browse** | Every page in queue has `status = "failed"` | Audit marked as failed. HITL escalation. Likely site-wide issue (auth, geo-block). |
| OA-02 | **Budget exhausted mid-audit** | `budget_remaining_usd <= 0` at audit level | Complete current page analysis. Skip remaining pages. Mark audit as `budget_exceeded`. Report partial results. |
| OA-03 | **Competitor site unreachable** | Browse fails on all competitor pages | Skip competitor. Proceed with client-only audit. Note in report: "Competitor analysis unavailable." |
| OA-04 | **Audit run interrupted** | Server crash, process kill | LangGraph Postgres checkpointer. Resume from last checkpoint on restart. No data loss. |

## 15.4 Failure Response Summary

```
BROWSE FAILURES:
  transient → retry (up to 3x)
  structural → reflect (replan)
  blocked → HITL escalation
  bot_detected → pause 30s, rotate, retry once, then HITL

ANALYSIS FAILURES:
  hallucination → rejected by grounding rules
  malformed output → retry (up to 2x)
  budget exceeded → graceful stop, partial results
  KB failure → audit blocked, alert

AUDIT FAILURES:
  all pages fail → audit failed, HITL
  budget exceeded → partial results + report
  crash → checkpoint recovery
```

---

## 15.5 Master Architecture Extension — Additional Failure Modes (G5-FIX)

The following failure modes are introduced by the master architecture extensions (§18-§30). Each is fully specified in its source section; this is a consolidated index.

### Discovery Failures (§19.12)

| # | Failure | Response |
|---|---|---|
| DF-01 | Root URL unreachable | Audit fails |
| DF-02 | All seeds excluded by rules | Audit fails; review exclusion config |
| DF-03 | 0 templates produced | Audit fails; tiny/broken site |
| DF-04 | LLM classification batch fails | Unclassified → "other"; proceed |
| DF-05 | Discovery runtime >5 min | Truncate + cluster partial set |
| DF-06 | Sitemap missing/unparseable | Skip source; rely on other seeds |
| DF-07 | Consultant override path 404 | Flag for consultant review |

### State Exploration Failures (§20.12)

| # | Failure | Response |
|---|---|---|
| SE-01 | Exploration crashes page | Reload; mark state failed; continue |
| SE-02 | State restoration fails | `browser_reload()` fallback |
| SE-03 | Meaningful-state detection too aggressive | Lower thresholds 50%; re-evaluate |
| SE-04 | Detection too lenient | Cap enforces; truncated |
| SE-05 | All Pass 1 preferred_states fail | Default state only; heuristics flagged `needs_review` |
| SE-06 | Exploration budget exhausted | Halt; proceed with captured states |
| SE-07 | Exploration runtime >60s | Halt; proceed with captured states |
| SE-08 | LLM fallback returns invalid refs | Skip invalid; execute valid only |
| SE-09 | Escalation loop: Pass 2 already run | Reject; max 1 cycle |
| SE-10 | DOM mutation storm during exploration | Wait for stability; capture current |

### Workflow Failures (§21.10)

| # | Failure | Response |
|---|---|---|
| WF-01 | Step page not analyzed (PAGE item failed) | Mark step skipped; proceed |
| WF-02 | Step transition fails | Retry once; then mark failed; proceed |
| WF-03 | Login wall mid-funnel | HITL escalation; workflow pauses |
| WF-04 | CAPTCHA mid-funnel | HITL escalation; workflow pauses |
| WF-05 | All steps fail traversal | Workflow abandoned; log for review |
| WF-06 | Workflow analysis LLM malformed | Retry once; then no workflow findings |
| WF-07 | Workflow budget exceeded | Analyse available steps |
| WF-08 | Step produces 0 findings | Valid — step is clean |

### Heuristic Retrieval Failures (§22.9)

| # | Failure | Response |
|---|---|---|
| HR-01 | Embedding model unavailable | Fall back to categorical filter |
| HR-02 | pgvector index corrupted | Rebuild; fall back to categorical |
| HR-03 | Mixed embedding model versions | Block retrieval; force re-embed |
| HR-04 | Rule detector throws exception | Skip heuristic; fall back to guidance |
| HR-05 | Stale calibration (>90 days) | Ignore calibration; use base weights |
| HR-06 | Overlay version conflict | Client wins (S2-FIX resolution order) |

### Trigger Gateway Failures (§18.12)

| # | Failure | Response |
|---|---|---|
| TF-01 | Channel adapter crash | HTTP 500; no audit created |
| TF-02 | Auth provider (Clerk) unavailable | HTTP 503; no fallback to no-auth |
| TF-03 | Database unavailable during persist | HTTP 503; caller retries |
| TF-04 | Temporal workflow start fails | Mark `failed_to_queue`; HTTP 502 |
| TF-05 | Reproducibility snapshot creation fails | Fail request entirely |
| TF-06 | Idempotency key collision (different payload) | HTTP 409 |
| TF-07 | Scheduled job for suspended client | Skip; notify consultant |
| TF-08 | Scheduled job for deleted client | Skip; auto-disable schedule |

### Reproducibility Failures (§25.10)

| # | Failure | Response |
|---|---|---|
| RF-01 | Snapshot creation fails | Fail audit immediately |
| RF-02 | Snapshot mutation attempted | DB trigger blocks; alert engineering |
| RF-03 | Temperature non-zero on evaluate/critique | Fail the call; alert |
| RF-04 | Overlap <90% on repeat run | Warn; surface to consultant |
| RF-05 | Model version unavailable on rerun | Fail rerun; explicit error |
| RF-06 | Heuristic version not loadable on rerun | Fail rerun; archive violation |
| RF-07 | LangSmith trace write fails | Non-blocking; log to Sentry |
| RF-08 | Prompt template hash mismatch | Block deployment |

### Cost & Guardrail Failures (§26.10)

| # | Failure | Response |
|---|---|---|
| CG-01 | Audit budget exceeded mid-page | Graceful stop; persist partial |
| CG-02 | Page budget exceeded mid-analysis | Skip remaining steps; persist grounded |
| CG-03 | Exploration budget exceeded | Halt exploration; proceed |
| CG-04 | Runtime cap exceeded | Graceful stop |
| CG-05 | Cost tracking drift >50% | Alert; adjust estimation model |
| CG-06 | Kill-switch activated | Persist state; exit cleanly |
| CG-07 | LLM provider price change | Alert; update cost model |
| CG-08 | Pre-flight estimation wildly wrong | Fall back to conservative defaults |

### Durable Orchestration Failures (§27.11)

| # | Failure | Response |
|---|---|---|
| DO-01 | Temporal server unavailable at trigger | HTTP 503; not started |
| DO-02 | Temporal goes down mid-audit | Auto-recover from history |
| DO-03 | Activity heartbeat lost | Retry activity (fresh browser) |
| DO-04 | Activity fails max retries | Skip item; continue |
| DO-05 | Workflow cancelled (kill-switch) | Complete current; skip remaining |
| DO-06 | Temporal history exceeds size | `continueAsNew()` |
| DO-07 | Worker pool exhausted | Queue until free |
| DO-08 | LangGraph crashes inside activity | Retry activity |

### Learning Service Failures (§28.6)

| # | Failure | Response |
|---|---|---|
| LS-01 | Calibration job fails | Retry (idempotent) |
| LS-02 | Stale calibration >90 days | Ignore; use base weights |
| LS-03 | Delta too aggressive | Clamped to bounds |
| LS-04 | Inconsistent consultant behavior | Pause calibration until stable |
| LS-05 | Crystallisation suggestion rejected | No harm; discard |

### Analytics Binding Failures (§30.8)

| # | Failure | Response |
|---|---|---|
| AB-01 | Provider API unavailable | Retry 3x; mark sync failed |
| AB-02 | Credential expired | Disable binding; notify consultant |
| AB-03 | URL mismatch | Warn; consultant configures mapping |
| AB-04 | Signal volume too high | Truncate to recent window |
| AB-05 | Data quality poor | Drop invalid; proceed with valid |

### Two-Store Pattern Failures (§24.7)

| # | Failure | Response |
|---|---|---|
| TS-01 | `app.access_mode` not set | Client sees empty results; alert |
| TS-02 | Consultant gets `published_only` | Middleware bug; fix |
| TS-03 | Warm-up graduation computed wrong | Unit test; cross-check dashboard |
| TS-04 | Warm-up re-enabled after delay queued | Worker checks; finding stays held |
| TS-05 | Client API shows 0 findings (all held) | Expected during warm-up |

**Total failure modes: 22 (base §15.1-15.3) + 72 (master extensions) = 94 catalogued failure modes.**

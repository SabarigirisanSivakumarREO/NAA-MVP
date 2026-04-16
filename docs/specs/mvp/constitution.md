# MVP Engineering Constitution

## Non-Negotiable Rules for Implementation

> **For Claude Code:** These rules are mandatory. They override convenience, speed, or your own preferences. If a task seems to require breaking a rule, STOP and ask the user.

---

## 1. Source of Truth

**RULE 1.1:** When implementing any browse-mode component, the source of truth is `docs/specs/AI_Browser_Agent_Architecture_v3.1.md`. Read it before writing code.

**RULE 1.2:** When implementing any analyze-mode component, the source of truth is `docs/specs/AI_Analysis_Agent_Architecture_v1.0.md`.

**RULE 1.3:** For system-level integration (orchestrator, layers, data flow), use `docs/specs/final-architecture/`.

**RULE 1.4:** If specs disagree, ASK the user. Do not pick one arbitrarily.

---

## 2. Type Safety First

**RULE 2.1:** Write TypeScript types and Zod schemas BEFORE implementation. No `any` types except in well-justified cases.

**RULE 2.2:** Every external boundary (LLM output, MCP tool input/output, API request/response, DB row) MUST have a Zod schema with runtime validation.

**RULE 2.3:** Every TypeScript interface from the spec MUST be implemented exactly. Do not rename fields, change types, or add fields without spec authorization.

---

## 3. Test-Driven Development

**RULE 3.1:** Write the test first. Then implement until the test passes.

**RULE 3.2:** Every artifact in `tasks.md` has a smoke test. The smoke test MUST pass before the task is marked complete.

**RULE 3.3:** Never disable a failing test. Never modify a test to match buggy code. Fix the implementation.

**RULE 3.4:** Use Vitest for unit tests, Playwright Test for integration tests.

---

## 4. Browser Agent Rules (Browse Mode)

**RULE 4.1:** Perception first, action second. Never call a tool that modifies state without first calling `browser_get_state` to know what's on the page.

**RULE 4.2:** Verify everything. No browse action is "done" until its verification strategy passes. Never claim success without verification.

**RULE 4.3:** Safety is structural, not advisory. The LLM cannot override the safety gate. Implement classification in code, not in prompts.

**RULE 4.4:** Confidence scoring uses **multiplicative** decay (`current * 0.97`), NOT additive (`current - 0.05`). Multiplicative naturally bounds in (0, 1).

**RULE 4.5:** Tool names from v3.1 are EXACT. Do not rename `browser_get_state` to `page_snapshot`, do not rename `browser_click` to `page_click`. Use the v3.1 names.

---

## 5. Analysis Agent Rules (Analyze Mode)

**RULE 5.1:** Findings are HYPOTHESES, not VERDICTS. Every finding must survive 3 filters (CoT, self-critique, evidence grounding) before reaching a client.

**RULE 5.2:** Evidence grounding is DETERMINISTIC CODE, not LLM judgment. The 8 grounding rules (GR-001 through GR-008) are non-negotiable.

**RULE 5.3:** NEVER predict conversion impact. No phrases like "increase conversions by X%". Grounding rule GR-007 enforces this — do not work around it.

**RULE 5.4:** Heuristics are filtered by orchestrator BEFORE the LLM call, NOT inside the LLM. Filter by page type AND business type.

**RULE 5.5:** Heuristics are injected into the LLM USER MESSAGE, not the system prompt, not via a tool call.

**RULE 5.6:** Self-critique is a SEPARATE LLM call. Do not combine it with the evaluate call. The cost is worth it (~30% reduction in false positives).

**RULE 5.7:** Severity is tied to MEASURABLE EVIDENCE, not LLM opinion. Critical/high severity REQUIRES a measurement field. Grounding rule GR-006 enforces this.

---

## 6. Heuristic IP Protection

**RULE 6.1:** Heuristic content NEVER appears in API responses, MCP tool outputs, or dashboard pages. Only `heuristic_id` references are exposed.

**RULE 6.2:** Heuristic JSON is encrypted at rest using AES-256-GCM. Decryption happens in memory only.

**RULE 6.3:** LangSmith traces MUST redact heuristic content. Use the LangSmith metadata feature to mark heuristic fields as private.

**RULE 6.4:** Even in development, do not log full heuristic JSON to console or files. Log heuristic IDs only.

---

## 7. Database & Storage

**RULE 7.1:** Use Drizzle ORM for all database access. No raw SQL queries except for migrations and RLS policies.

**RULE 7.2:** Row-level security MUST be enabled on all client-scoped tables. Set `app.client_id` session variable before any query.

**RULE 7.3:** Screenshots are stored in Cloudflare R2 (production) or local disk (dev). Never store screenshots as base64 strings in the database.

**RULE 7.4:** Audit log tables are append-only. Never UPDATE or DELETE rows from `audit_log`, `rejected_findings`, or `finding_edits`.

---

## 8. Cost & Safety

**RULE 8.1:** Every audit has a hard budget cap (`budget_remaining_usd`). When exhausted, the audit terminates with `completion_reason = "budget_exceeded"`. No exceptions.

**RULE 8.2:** Every page in analyze mode has its own budget (`analysis_budget_usd`, default $5). When exhausted, skip remaining steps for that page.

**RULE 8.3:** Rate limiting is enforced per-domain (10/min unknown, 30/min trusted) and per-session (2s minimum interval). The rate limiter is in code, not prompts.

**RULE 8.4:** Sensitive actions (form submit, purchase, upload, download) require HITL approval. The safety gate blocks them automatically — do not bypass.

---

## 9. Loose Coupling

**RULE 9.1:** Every external dependency goes through an adapter interface. Direct imports of Anthropic SDK, Playwright, PostgreSQL, etc. are FORBIDDEN outside the adapter modules.

**RULE 9.2:** Business logic depends on interfaces, not implementations. To swap Anthropic for OpenAI, only the adapter file should change.

**RULE 9.3:** Adapter interfaces:
- `LLMAdapter` for all LLM calls
- `StorageAdapter` for all DB access
- `ScreenshotStorage` for image files
- `BrowserEngine` for Playwright (eventually)
- `JobScheduler` for BullMQ
- `EventBus` for streaming events
- `HeuristicLoader` for heuristic KB
- `AuthProvider` for Clerk

---

## 10. Code Quality

**RULE 10.1:** Files SHOULD be under 300 lines. If a file exceeds this, split by responsibility.

**RULE 10.2:** Functions SHOULD be under 50 lines. If a function exceeds this, extract helpers.

**RULE 10.3:** Use named exports. Avoid default exports. (Better for refactoring and IDE navigation.)

**RULE 10.4:** Comments explain WHY, not WHAT. The code shows what; comments explain why a non-obvious decision was made.

**RULE 10.5:** No commented-out code. Delete it. Git remembers.

**RULE 10.6:** No `console.log` in production code. Use the Pino logger.

---

## 11. Spec-Driven Development Discipline

**RULE 11.1:** Before starting a task, READ the relevant spec section. The task description is a summary; the spec is the truth.

**RULE 11.2:** Every implementation decision MUST trace back to a REQ-ID in the spec. If you can't cite a REQ-ID, you're inventing requirements.

**RULE 11.3:** If the spec is missing a detail, ASK before assuming. Do not invent solutions silently.

**RULE 11.4:** When you discover a spec defect, FIX THE SPEC FIRST, then implement. Don't let code drift from spec.

**RULE 11.5:** Commit messages reference the task ID and REQ-ID:
`feat(perception): T003 implement AccessibilityExtractor (REQ-BROWSE-PERCEPT-001)`

---

## 12. Definition of Done (per task)

A task is complete only when ALL of these are true:

- [ ] TypeScript types and Zod schemas defined
- [ ] Unit tests written and passing
- [ ] Smoke test from `tasks.md` passing
- [ ] No regressions in previous task tests
- [ ] Code follows all rules above
- [ ] Code references spec REQ-IDs in comments where applicable
- [ ] Committed with reference to task ID

---

## 13. Forbidden Patterns

**NEVER:**

- Use `any` type without a `// TODO: type this` comment and a tracking issue
- Disable a failing test
- Work around the safety gate
- Bypass rate limiting
- Predict conversion impact
- Expose heuristic content to clients
- Skip evidence grounding
- Use `console.log` in production code
- Hardcode API keys, secrets, or credentials
- Mix browse-mode and analyze-mode logic in the same file
- Use Playwright APIs outside the `BrowserEngine` adapter

**ALWAYS:**

- Read the spec first
- Write the test first
- Use the adapter pattern
- Validate with Zod
- Reference REQ-IDs
- Commit small, atomic changes

---

## 14. Cost Accountability (v2.2)

**RULE 14.1:** Every LLM call SHALL be logged atomically to `llm_call_log` table with model, tokens, cost, duration, and cache_hit. No silent LLM calls.

**RULE 14.2:** Every LLM call SHALL pass a pre-call budget gate. Estimate cost from prompt token count before calling. If `estimated_cost > budget_remaining_usd`, skip the call or split the batch.

**RULE 14.3:** Budget enforcement uses ACTUAL costs from `llm_call_log`, not estimates. `AuditState.analysis_cost_usd` updates from real call records.

**RULE 14.4:** Per-client cost attribution MUST be queryable. Every `llm_call_log` row links to an audit_run which links to a client_id.

**RULE 14.5:** LLM failover is per-call, not per-audit. Primary 3 retries → fallback 2 retries → `LLMUnavailableError`. Next call tries primary again.

**RULE 14.6:** When failover occurs, finding gets `model_mismatch = true`. Consultant UI shows a badge for fallback-generated findings.

---

## 15. Quality Gates (v2.2)

**RULE 15.1:** Perception quality gate runs BEFORE every evaluate call. Score < 0.3 → skip page. Score 0.3-0.59 → partial analysis (Tier 1 only). Score ≥ 0.6 → proceed.

**RULE 15.2:** Every page gets an `analysis_status`. The audit NEVER silently drops a page. Every non-complete page has a documented reason.

**RULE 15.3:** Every heuristic MUST have a benchmark (quantitative or qualitative). Heuristics without benchmarks fail Zod validation and cannot be loaded.

**RULE 15.4:** GR-012 validates benchmark claims. Quantitative: claimed value within ±20% of actual. Qualitative: finding references the standard text.

**RULE 15.5:** Golden test suite runs on every PR touching analysis, heuristics, or prompts. Pass criteria: TP ≥ 80%, FP ≤ 20%, no individual test below 60% TP.

**RULE 15.6:** Golden tests are built INCREMENTALLY from validated audits. First 5 hand-crafted during development. No automated golden test generation.

**RULE 15.7:** Never silently update golden tests to match code output. When a golden test fails, ask: regression (fix code) or improvement (update golden)? Consultant involvement required.

---

## 16. When to Stop and Ask

Stop and ask the user when:

- Two specs disagree
- A REQ-ID is missing for a decision you're making
- A task seems to require breaking a constitution rule
- Tests reveal the spec is wrong
- You're tempted to use `any` or disable a test
- Implementation diverges from the spec

It is ALWAYS better to ask than to silently invent.

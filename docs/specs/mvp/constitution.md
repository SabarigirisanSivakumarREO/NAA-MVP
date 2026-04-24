# MVP Engineering Constitution

## Non-Negotiable Rules for Implementation

> **For Claude Code:** These rules are mandatory. They override convenience, speed, or your own preferences. If a task seems to require breaking a rule, STOP and ask the user.

> **Opening principle (v1.1 — 2026-04-22):** **This Constitution is a control system, not documentation.** Specifications govern AI behavior + system evolution. Every rule here exists because violating it produces unreliable or unmaintainable systems at scale. When in doubt: obey the rule, ask for override with rationale in the PR body.

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

---

## 17. Spec Lifecycle States (v1.1)

**RULE 17.1:** Every spec artifact (PRD, spec.md, plan.md, tasks.md, design doc, checklist, rollup, impact) SHALL carry an explicit `status:` field in its frontmatter. No artifact is ambiguous about whether it is current, under review, or obsolete.

**Allowed states:**
- `draft` — being written; not approved; do not use as authoritative
- `validated` — reviewed by owner; content verified; awaiting approval
- `approved` — approved for use; informs implementation
- `implemented` — code exists; implementation landed
- `verified` — conformance tests pass; in production use
- `superseded` — replaced by newer version; reference only
- `archived` — historical; do not use

**RULE 17.2:** An artifact in state `superseded` or `archived` SHALL reference its successor (`supersededBy: <path>`). Readers encountering one SHALL follow the pointer rather than reading stale content.

**RULE 17.3:** Claude Code and human readers SHALL skip artifacts in states `draft`, `superseded`, or `archived` when loading context for implementation tasks, unless explicitly instructed otherwise.

**RULE 17.4:** State transitions SHALL be explicit:
- `draft → validated`: owner (author) marks after self-review
- `validated → approved`: PR approval by product owner or engineering lead
- `approved → implemented`: commit references the artifact's REQ-IDs
- `implemented → verified`: conformance tests green + acceptance test pass
- `verified → superseded`: a new version replaces it (commit references `supersedes:`)

**RULE 17.5:** Frontmatter is YAML between `---` fences at the top of any Markdown artifact. Template in `docs/specs/mvp/templates/frontmatter-lifecycle.template.md`.

---

## 18. Delta-Based Updates (v1.1)

**RULE 18.1:** Every spec update SHALL include an explicit `delta` section in frontmatter or changelog enumerating:
- `new:` — content added
- `changed:` — content modified (with rationale)
- `impacted:` — downstream artifacts affected (with cross-references)
- `unchanged:` — major sections preserved (to reassure readers)

**RULE 18.2:** No silent edits. A commit that modifies a spec file without a `delta` entry in changelog + frontmatter SHALL be rejected in PR review.

**RULE 18.3:** Delta entries are append-only. When a v1.1 change supersedes a v1.0 delta, both remain in the changelog — v1.0 marked `superseded by v1.1`.

**RULE 18.4:** For cross-cutting changes (touching ≥ 3 artifacts), the primary spec SHALL also carry an `impact:` pointer to an `impact.md` file (see Rule 20).

---

## 19. Rollup per Phase (v1.1)

**RULE 19.1:** At the end of every implementation phase (per `tasks-mvp-v1.md` phase exit criteria), a `phase-N-current.md` rollup SHALL be produced BEFORE the next phase begins.

**RULE 19.2:** A rollup captures the compressed current state after a phase:
- Active modules introduced
- Data contracts now in effect
- System flows now operational
- Known limitations carried forward
- Open risks for next phase

Template: `docs/specs/mvp/templates/phase-rollup.template.md`.

**RULE 19.3:** Phase N+1 implementation SHALL read `phase-N-current.md` FIRST (rollup) rather than loading all Phase N artifacts. Full phase artifacts are reference material; rollup is the operational baseline.

**RULE 19.4:** Rollups are `approved` state immediately after phase exit; they transition to `verified` when Phase N+1 begins and to `superseded` when phase N+1 produces its own rollup. Earlier phase rollups remain `verified` as part of the system history.

**RULE 19.5:** Rollup size cap: 300 lines (~3000 tokens). If the system state exceeds this, split by subsystem (e.g., `phase-N-browser-current.md` + `phase-N-analysis-current.md`) rather than bloating one file.

---

## 20. Impact Analysis Before Cross-Cutting Changes (v1.1)

**RULE 20.1:** Any change that modifies a shared contract SHALL be preceded by an `impact.md` analysis committed in the same PR. Shared contracts include:
- `AnalyzePerception` schema (§07.9)
- `PageStateModel` schema (§06)
- `AuditState` (§05)
- `Finding` lifecycle types (§07, §23)
- Any adapter interface (`LLMAdapter`, `StorageAdapter`, `ScreenshotStorage`, `BrowserEngine`, `HeuristicLoader`, `NotificationAdapter`, `DiscoveryStrategy`)
- Database schema (`findings`, `audit_runs`, `llm_call_log`, `audit_events`, etc.)
- MCP tool interfaces (§08)
- Grounding rule interfaces (GR-001 through GR-012)

**RULE 20.2:** An `impact.md` SHALL document:
- **Affected modules:** list with file paths
- **Affected contracts:** data contracts touched; before/after shapes
- **Breaking changes:** yes/no + migration steps
- **Migration plan:** concrete steps, in order, to roll the change out
- **Risk level:** low / medium / high + rationale
- **Verification:** which conformance tests guard this change

Template: `docs/specs/mvp/templates/impact.template.md`.

**RULE 20.3:** For additive-only changes (new fields with defaults; new adapter implementations; new grounding rules), `impact.md` SHALL state `breaking: false` + `migration: none required` but still exist. The discipline of producing it is the rule; the content may be short.

**RULE 20.4:** For breaking changes, `impact.md` SHALL be reviewed and approved BEFORE any implementation PR. Breaking-change PRs without an approved `impact.md` SHALL be rejected.

---

## 21. Traceability Matrix (v1.1)

**RULE 21.1:** A central traceability matrix (`docs/specs/mvp/spec-to-code-matrix.md`) SHALL map every REQ-ID to:
- Spec file + section
- Implementation file(s) + line ranges (if implemented)
- Test file(s) covering this requirement
- Status: spec-only / implemented / verified

**RULE 21.2:** The matrix SHALL be auto-generated by `pnpm spec:matrix` — not hand-maintained. Script scans:
- All Markdown files under `docs/specs/` for `REQ-\w+-\d+` patterns → source
- All TypeScript source files for `// REQ-\w+-\d+` inline references → implementation
- All test files for `// REQ-\w+-\d+` references → coverage
- Git log / conformance suite results → status

**RULE 21.3:** CI SHALL run `pnpm spec:matrix --check` on every PR. If a REQ-ID is referenced in a spec but has no implementation reference (and the task is marked `implemented` or later), CI fails with a clear gap report.

**RULE 21.4:** Claude Code SHALL reference REQ-IDs in comments when implementing a spec requirement:

```typescript
// REQ-GROUND-007: NEVER predict conversion impact
// Implements rule GR-007 from §07.7. Deterministic regex check; no LLM.
export function groundGR007(...) { ... }
```

**RULE 21.5:** The matrix is read-only reference — never edited by hand. Changes to the matrix come from updating the underlying specs or code, then re-running the generation script.

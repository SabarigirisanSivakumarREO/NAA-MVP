---
title: MVP Engineering Constitution
artifact_type: constitution
status: approved
version: 1.2
created: 2026-04-22
updated: 2026-04-24
owner: engineering lead
authors: [REO Digital team, Claude]
reviewers: [REO Digital team]

supersedes: v1.1
supersededBy: null

derived_from:
  - docs/engineering-practices/ai-orchestration-research-2026-04-24.md (R22-R23 provenance)

req_ids: []  # Constitution defines rules R1-R23, not REQ-IDs

impact_analysis: null
breaking: false
affected_contracts: []

delta:
  new:
    - R22 The Ratchet — Rules Trace to Failures
    - R23 Kill Criteria Before Task Start
    - R22.5 — Retroactive audit record (good-spec review Option B, 2026-04-24) for R3, R5, R6, R7, R9, R10, R11, R13
    - R22.6 — Flagged stale cross-reference; temperature=0 lacks explicit rule codification (punch-list for v1.3)
    - R15.3.1 — `provenance` block fields for heuristics (2026-04-26)
    - R15.3.2 — Human verification mandatory for LLM-drafted heuristics (2026-04-26)
    - R15.3.3 — LLM-drafted heuristic content is still IP per R6 (2026-04-26)
    - R17 lifecycle frontmatter on this constitution file itself (was missing; self-compliance fix)
  changed:
    - R3, R5, R6, R7, R9, R10, R11, R13 now carry `why:` provenance blocks (retroactive audit per R22.2)
    - R15.3 expanded 2026-04-26 — benchmark + provenance both required for Zod validation
  impacted:
    - docs/specs/mvp/PRD.md §10.9 (PR Contract references R23)
    - docs/specs/mvp/PRD.md §10.10 (Pacing references R22)
    - CLAUDE.md §7 (boundaries updated)
    - .claude/skills/neural-dev-workflow/ (new skill operationalizing R22-R23)
  unchanged:
    - R1 (Source of Truth), R2 (Type Safety), R4 (Browser Agent), R8 (Cost & Safety), R12 (Definition of Done), R14 (Cost Accountability), R15 (Quality Gates), R16 (When to Stop and Ask) — retain grandfather status per R22.4; audit on next amendment
    - R17-R21 (v1.1 SDD infrastructure) — PR-reviewed at introduction; treat approval PR as implicit provenance

governing_rules:
  - Constitution R17 (Lifecycle)
  - Constitution R18 (Delta)
  - Constitution R22 (Ratchet)
---

# MVP Engineering Constitution

> **Summary (~100 tokens — agent reads this first):** Non-negotiable engineering rules R1-R23 for Neural MVP. Override order: user instructions > constitution > default behavior. R1-R21 are grandfathered (predate R22 Ratchet provenance rule). Every future rule requires a `why:` provenance block citing a specific failure or research source per R22.2. R17 governs artifact lifecycle states; R18 requires delta blocks on every update; R19 mandates phase rollups; R20 requires impact analysis for shared-contract changes; R21 auto-generates a spec-to-code traceability matrix; R22 ratchets rule hygiene; R23 requires pre-task kill criteria.

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

**Provenance (retroactive audit 2026-04-24, per R22.2):**

```yaml
why:
  source: >
    docs/engineering-practices/ai-orchestration-research-2026-04-24.md §Part 1 §2 (ai-coding-workflow) + §5 (agentic-engineering) + TDD canon (Kent Beck, 2002)
  evidence: >
    Addy Osmani: "test after each increment, not at the end"; "passing tests ≠ correct, secure, or maintainable code."
    Agentic-engineering research: "comprehensive testing is the primary differentiator from vibe coding";
    "AI-assisted development actually rewards good engineering practices more than traditional coding does."
  linked_failure: >
    Generic LLM failure mode — plausible code that passes static checks but fails runtime edge cases.
    TDD forces boundary/invariant thinking before implementation, which LLMs systematically underweight.
```

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

**Provenance (retroactive audit 2026-04-24, per R22.2):**

```yaml
why:
  source: REO Digital product policy + GR-007 deterministic enforcement + §07.9 self-critique design
  evidence: >
    R5.1 hypotheses-not-verdicts: every finding passes a 3-layer filter (CoT, separate-persona self-critique,
    deterministic grounding) before reaching a consultant. LLM "confidence" alone is unreliable.
    R5.3 no conversion predictions: absolute ban because unfounded quantitative lift claims expose REO Digital
    to legal and reputational risk (clients cannot hold consultants to forecasted numbers). GR-007 enforces at
    code level as deterministic regex check, not LLM judgment.
    R5.6 separate self-critique LLM call: different system prompt persona catches ~30% more false positives
    than combined evaluate-and-critique; cost is worth it (pre-MVP prompt testing).
    R5.7 severity tied to measurable evidence: blocks LLM opinion-as-fact via GR-006.
  linked_failure: >
    Cross-session pattern during spec design — LLM-generated findings repeatedly included unfounded
    percentage lift claims that passed CoT review but failed GR-007 deterministic check. This codified R5.3
    as an absolute ban rather than a guideline.
```

---

## 6. Heuristic IP Protection

**RULE 6.1:** Heuristic content NEVER appears in API responses, MCP tool outputs, or dashboard pages. Only `heuristic_id` references are exposed.

**RULE 6.2:** Heuristic JSON is encrypted at rest using AES-256-GCM. Decryption happens in memory only.

**RULE 6.3:** LangSmith traces MUST redact heuristic content. Use the LangSmith metadata feature to mark heuristic fields as private.

**RULE 6.4:** Even in development, do not log full heuristic JSON to console or files. Log heuristic IDs only.

**Provenance (retroactive audit 2026-04-24, per R22.2):**

```yaml
why:
  source: REO Digital competitive strategy + docs/specs/final-architecture/§07 analyze-mode IP boundary + §09 heuristic-kb
  evidence: >
    Heuristic content (Baymard/Nielsen/Cialdini applications with research-grounded benchmarks) is
    Neural's direct competitive differentiator vs generic AI tools (Lighthouse, Hotjar, ChatGPT-audits).
    If heuristic JSON leaks via LangSmith traces, Pino logs, API responses, or error messages, any
    competitor can reproduce the pipeline. MVP uses private git repo (PRD §F-012); AES-256-GCM at rest
    ships before first external pilot (v1.1 per PRD §3.2 deferred-to-v1.1).
  linked_failure: >
    General risk class — LLM systems leaking proprietary knowledge via observability infrastructure
    (error strings, trace metadata, retry logs, debug dumps).
```

---

## 7. Database & Storage

**RULE 7.1:** Use Drizzle ORM for all database access. No raw SQL queries except for migrations and RLS policies.

**RULE 7.2:** Row-level security MUST be enabled on all client-scoped tables. Set `app.client_id` session variable before any query.

**RULE 7.3:** Screenshots are stored in Cloudflare R2 (production) or local disk (dev). Never store screenshots as base64 strings in the database.

**RULE 7.4:** Audit log tables are append-only. Never UPDATE or DELETE rows from `audit_log`, `rejected_findings`, or `finding_edits`.

**Provenance (retroactive audit 2026-04-24, per R22.2):**

```yaml
why:
  source: Audit compliance + incident forensics practice + docs/specs/final-architecture/§13 data-layer
  evidence: >
    R7.1 Drizzle-only: typed migrations prevent schema drift; enables spec:matrix REQ-ID tracing (R21).
    R7.2 RLS on client-scoped tables: single-agency MVP today but multi-tenant is v1.2 target; RLS-first
    prevents accidental cross-client data exposure during prototyping.
    R7.3 R2 for screenshots not base64-in-DB: Postgres bloats unpredictably with base64; R2 zero-egress
    on Cloudflare keeps storage costs predictable and queryability unaffected.
    R7.4 append-only: `audit_log`, `rejected_findings`, `finding_edits`, `llm_call_log`, `audit_events` are
    forensic evidence of what the system did during client audits. UPDATE/DELETE breaks reproducibility
    analysis (§25), cost attribution (R14.4), and incident root-cause forensics.
  linked_failure: >
    General risk class — mutable audit data during incident investigation yielding incorrect root cause
    (analyst editing evidence to match hypothesis).
```

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

**Provenance (retroactive audit 2026-04-24, per R22.2):**

```yaml
why:
  source: Ports & adapters pattern (Cockburn, Fowler) + docs/engineering-practices/ai-orchestration-research-2026-04-24.md §Part 1 §8 (agent-harness-engineering)
  evidence: >
    Addy Osmani: "Every component in a harness encodes an assumption about what the model can't."
    Direct imports of @anthropic-ai/sdk, Playwright, pg, Drizzle outside adapters prevent:
    (a) v1.2 GPT-4o failover (PRD §3.2 deferred-to-v1.2)
    (b) temperature-guard enforcement at a single boundary (forbidden-pattern in R13)
    (c) MockLLMAdapter in unit/integration tests (required by R3 TDD)
    (d) LLM cost logging to llm_call_log at a single chokepoint (required by R14.1)
    The adapter boundary IS the Control Layer of Neural's five-layer harness
    (docs/specs/mvp/architecture.md §6.1).
  linked_failure: >
    General risk class — tightly-coupled LLM code requiring cross-module refactor for each provider
    swap, temperature policy change, or test harness setup.
```

---

## 10. Code Quality

**RULE 10.1:** Files SHOULD be under 300 lines. If a file exceeds this, split by responsibility.

**RULE 10.2:** Functions SHOULD be under 50 lines. If a function exceeds this, extract helpers.

**RULE 10.3:** Use named exports. Avoid default exports. (Better for refactoring and IDE navigation.)

**RULE 10.4:** Comments explain WHY, not WHAT. The code shows what; comments explain why a non-obvious decision was made.

**RULE 10.5:** No commented-out code. Delete it. Git remembers.

**RULE 10.6:** No `console.log` in production code. Use the Pino logger.

**Provenance (retroactive audit 2026-04-24, per R22.2):**

```yaml
why:
  source: docs/engineering-practices/code-style.md + industry conventions (clean code, named exports) + pilot usage observations
  evidence: >
    R10.1 files < 300 lines: beyond ~300 lines LLMs and humans both lose track of responsibilities. The
    grounding/rules/ directory pattern (one rule per file) is an applied example.
    R10.2 functions < 50 lines: keeps call graphs reviewable; limits cyclomatic complexity.
    R10.3 named exports: refactor-friendly; IDE rename-symbol works; avoids default-export import name drift.
    R10.4 WHY not WHAT comments: LLM-generated code tends to narrate ("Increment i"); this forbids that pattern.
    R10.5 no commented-out code: git remembers; dead code in comments trains Claude Code to tune out
    neighboring comments.
    R10.6 no console.log: Pino with correlation fields (audit_run_id, page_url, node_name, heuristic_id) is
    required for R14.1 cost logging + §25 reproducibility audit trails; console.log defeats both.
  linked_failure: >
    Pilot-era sessions where bare console.log broke audit_run_id correlation during incident triage;
    required re-running with Pino to diagnose.

note_on_stale_xref: >
  PRD §10.1 ALWAYS list and Constitution R13 Forbidden Patterns both cite "(R10)" for the
  temperature=0 rule on evaluate/self_critique/evaluate_interactive. This cross-reference is STALE —
  §10 Code Quality does NOT codify temperature=0. The temperature invariant lives only in PRD §10.1
  ALWAYS + R13 NEVER + TemperatureGuard implementation. Flagged as a post-audit punch-list item;
  temperature=0 likely belongs as its own Constitution rule (candidate: R10.7 or a new top-level rule).
```

---

## 11. Spec-Driven Development Discipline

**RULE 11.1:** Before starting a task, READ the relevant spec section. The task description is a summary; the spec is the truth.

**RULE 11.2:** Every implementation decision MUST trace back to a REQ-ID in the spec. If you can't cite a REQ-ID, you're inventing requirements.

**RULE 11.3:** If the spec is missing a detail, ASK before assuming. Do not invent solutions silently.

**RULE 11.4:** When you discover a spec defect, FIX THE SPEC FIRST, then implement. Don't let code drift from spec.

**RULE 11.5:** Commit messages reference the task ID and REQ-ID:
`feat(perception): T003 implement AccessibilityExtractor (REQ-BROWSE-PERCEPT-001)`

**Provenance (retroactive audit 2026-04-24, per R22.2):**

```yaml
why:
  source: Spec-Driven Development (GitHub Spec Kit) + docs/engineering-practices/ai-orchestration-research-2026-04-24.md §Part 2 theme 1 (spec-as-leverage)
  evidence: >
    Addy Osmani: "A vague spec multiplies errors across the fleet."
    Agentic-engineering research: "better specs yield better AI output" — spec discipline is the
    single strongest lever on AI output quality across Claude, GPT-4, and Gemini.
    R11.1 read-spec-first: LLMs fill in gaps by inventing; reading the spec first forces the
    implementation to match documented requirements rather than plausible-sounding invention.
    R11.2 REQ-ID tracing: every decision must cite a REQ-ID, which makes spec drift detectable in CI
    via R21 traceability matrix.
    R11.4 fix-spec-first: prevents the "we'll document it later" rationalization that produces
    code/spec divergence over time.
    R11.5 commit-message format: TaskID + REQ-ID in commit subject makes `git log` a spec-to-code index.
  linked_failure: >
    Pilot session where Claude Code invented field names not in the spec because it relied on
    "reasonable defaults" instead of reading §07.9 AnalyzePerception schema — caught in code review
    because no REQ-ID could be cited.
```

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

**Provenance (retroactive audit 2026-04-24, per R22.2):**

```yaml
why:
  source: >
    Collected pilot failure modes + docs/engineering-practices/ai-orchestration-research-2026-04-24.md
    §Part 1 §3 (code-review-ai lethal-trifecta) + §Part 1 §8 (agent-harness-engineering safety mechanisms)
  evidence: >
    Each NEVER pattern traces to a concrete failure mode:
    - `any` without TODO + tracking issue: type erasure compounds across dependencies; LLMs lean on it under pressure
    - `console.log` in production: breaks R14.1 Pino correlation on audit_run_id / heuristic_id
    - Direct SDK imports outside adapters: violates R9 (blocks test mocking, failover, temperature guard)
    - Disabled tests: hides regressions; violates R3.3
    - Hardcoded secrets: basic security breach; LLM autocomplete frequently suggests them
    - Heuristic content in API/dashboard/logs: violates R6 IP protection
    - Mixed browse/analyze logic in same file: breaks Layer 2 / Layer 3 architecture isolation
    - Playwright outside BrowserEngine: violates R9
    - Raw LLM output without Zod: violates R2.2 + enables hallucination injection into downstream stages
    - UPDATE/DELETE on append-only tables: violates R7.4
    - Temperature > 0 on evaluate/self_critique/evaluate_interactive: violates reproducibility target (§25, NF-006)
    Lethal-trifecta principle (Addy Osmani): code touching auth/payments/secrets/untrusted-input must
    treat AI as "high-speed intern" requiring human threat model + security tool pass.
  linked_failure: >
    Multiple pilot-identified failure modes collapsed into one enforceable NEVER list,
    cross-referenced from PRD §10.3.
  note_on_stale_xref: >
    The "(R10)" reference in "Set temperature > 0 ... (R10)" is stale — Constitution §10 is Code Quality,
    not reproducibility. Temperature=0 isn't explicitly codified as a Constitution rule; it lives in
    PRD §10.1 ALWAYS list + this R13 NEVER list + TemperatureGuard implementation. Flagged post-audit.
```

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

**RULE 15.3:** Every heuristic MUST have a benchmark (quantitative or qualitative) AND a `provenance` block. Heuristics without either fail Zod validation and cannot be loaded.

**RULE 15.3.1:** `provenance` block fields:
- `source_url` — URL or stable reference to the cited research (e.g., Baymard article URL, Nielsen page, Cialdini chapter reference)
- `citation_text` — verbatim excerpt from the source supporting the heuristic + benchmark
- `draft_model` — identifier of the LLM that drafted the heuristic, OR `"human"` if hand-authored
- `verified_by` — name of the human verifier
- `verified_date` — ISO-8601 date of verification

**RULE 15.3.2:** When `draft_model` is an LLM, a human verifier MUST manually re-derive the benchmark from `source_url` + `citation_text` and confirm match within ±20% (quantitative) or text-reference (qualitative) BEFORE commit. Verification is captured in the PR Contract Proof block (PRD §10.9).

**RULE 15.3.3:** LLM-drafted heuristic content is still IP and subject to R6.1-R6.4. The drafting prompt + the resulting heuristic JSON are both protected. Drafting LLM responses MUST NOT be logged to LangSmith / Pino / dashboard / API / error messages — apply the same redaction discipline as for hand-authored heuristics.

**Provenance for R15.3 amendment (per R22.2):**

```yaml
why:
  source: User decision 2026-04-26 to use LLM-assisted heuristic authoring instead of CRO consultant authoring (PRD F-012 amendment, same date)
  evidence: >
    LLM authoring introduces hallucination risk on benchmarks (e.g., LLM cites
    "Baymard 2024 says 6-8 form fields" but actual research says 4-6). Without
    verifiable provenance + human verification, GR-012 benchmark validation at
    runtime cannot trust source-of-truth values it's checking against.
  linked_failure: >
    Anticipated risk class — LLM-drafted heuristics with hallucinated benchmarks
    cascade into false-confidence findings during real audits, eroding REO
    Digital's consultant defensibility.
```

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

---

## 22. The Ratchet — Rules Trace to Failures (v1.2)

**RULE 22.1:** Every rule added to `constitution.md`, `CLAUDE.md`, or any `.claude/skills/*.md` SHALL be traceable to a specific failure, research finding, or documented AI-system mistake. Speculative rules accumulate noise that degrades the harness. Research synthesized in `docs/engineering-practices/ai-orchestration-research-2026-04-24.md` shows human-curated agent instructions produce ~4% improvement while auto-generated or speculative ones produce ~3% regression.

**RULE 22.2:** New rules require a `why:` provenance block in the PR body citing either (a) a specific commit where the failure happened, (b) a research source with URL + date, or (c) a `docs/engineering-practices/` synthesis file documenting the pattern.

Example:

```yaml
why:
  source: docs/engineering-practices/ai-orchestration-research-2026-04-24.md §Part 2
  evidence: "human-curated AGENTS.md ~4% improvement; auto-generated ~3% regression"
```

**RULE 22.3:** Quarterly review of `constitution.md` + `CLAUDE.md` SHALL remove any rule whose `why:` provenance has become stale (failure no longer reproduces, research superseded, context no longer applies). Dead rules are worse than missing rules — they train Claude Code to tune out the rule set.

**RULE 22.4:** This Ratchet principle applies prospectively. Rules R1–R21 were initially exempt from the `why:` provenance requirement (they predate R22) but any FUTURE amendment, clarification, or additional rule MUST carry provenance.

**RULE 22.5 (Retroactive audit, 2026-04-24 per good-spec review Option B):** A targeted retroactive `why:` audit was performed on the 8 most-referenced rules — **R3** (TDD), **R5** (Analysis Agent, covering R5.1/R5.3/R5.6/R5.7), **R6** (Heuristic IP Protection), **R7** (Database & Storage, covering R7.4 append-only), **R9** (Loose Coupling), **R10** (Code Quality), **R11** (Spec-Driven Development), **R13** (Forbidden Patterns). These rules now carry provenance blocks (see each section). Remaining grandfathered rules — R1 (Source of Truth), R2 (Type Safety), R4 (Browser Agent), R8 (Cost & Safety), R12 (Definition of Done), R14 (Cost Accountability), R15 (Quality Gates), R16 (When to Stop and Ask) — retain R22.4 grandfather status; audit them individually when their text is next amended (R22.2 requires provenance on amendment). R17–R21 codified current SDD practice in v1.1 and were approved under PR review at introduction; treat that PR as their implicit provenance source.

**RULE 22.6 (Stale cross-reference flagged by retroactive audit):** R10 Code Quality does NOT codify temperature=0 on `evaluate / self_critique / evaluate_interactive`, despite PRD §10.1 ALWAYS list and R13 NEVER list both citing "(R10)" for this invariant. The temperature=0 rule lives only as a forbidden pattern in R13 + an enforcement requirement at `TemperatureGuard` (adapter boundary, R9). Codify temperature=0 as its own Constitution rule in v1.3 — candidate: promote from R13 into a new top-level rule "Reproducibility Guarantees." Tracked as post-audit punch-list item.

---

## 23. Kill Criteria Before Task Start (v1.2)

**RULE 23.1:** Every task meeting ANY of the following SHALL define explicit kill criteria in the task description BEFORE implementation begins:

- Estimated effort > 2 hours
- Touches a shared contract (R20: `AnalyzePerception`, `PageStateModel`, `AuditState`, `Finding`, any adapter interface, DB schema, MCP tool interface, grounding rule interface)
- Dispatched to a subagent (CLAUDE.md §9)
- LLM budget > $0.50

**Kill criteria answer:** *"What would cause me to stop, revert, and escalate rather than iterate forward?"*

**RULE 23.2:** Acceptable kill criteria SHALL include at least one from each category:

**Resource:**
- Token budget: per-node auto-pause at 85% of allocated budget
- Wall-clock: task exceeds 2× estimate → stop and re-scope
- Iteration count: 3+ iterations on same error → stop, reassign

**Quality:**
- Test-suite regression: any previously-passing test breaks → stop, investigate
- Conformance test failure: any `pnpm test:conformance` failure → stop, do not merge
- Spec contradiction: implementation reveals spec defect → stop, fix spec first (R11.4)

**Scope / forbidden patterns:**
- Subagent diff reveals forbidden patterns (R13: `any` without TODO, `console.log`, direct Anthropic/Playwright/pg imports outside adapters, disabled tests) → reject, do not merge
- Cross-cutting change emerges mid-task without `impact.md` (R20) → stop, produce impact analysis first

**RULE 23.3:** Kill criteria are SEPARATE from acceptance criteria. Acceptance = "how we know we're done successfully." Kill = "how we know to stop trying." Both are mandatory; neither substitutes for the other.

**RULE 23.4:** When kill criteria trigger, the orchestrator SHALL:

1. Snapshot current state (commit WIP to a scratch branch: `wip/killed/<task-id>-<reason>`)
2. Log the trigger reason — to `audit_events` (PRODUCT scope) or the task thread (META scope)
3. Escalate to human with specific failure mode ("GR-001 conformance failing on fixture X after 3 iterations"), not a generic "stuck"
4. Do NOT silently retry. Do NOT `--no-verify` around the trigger. Kill criteria exist to protect quality; bypassing them defeats the rule.

**Provenance (per R22.2):**

```yaml
why:
  source: docs/engineering-practices/ai-orchestration-research-2026-04-24.md §Part 1 §4 (coding-agents-manager) + §7 (code-agent-orchestra)
  evidence: >
    "Kill criteria defined before starting — what would cause you to stop"
    "Kill & reassign after 3+ iterations on same error"
    "Per-agent token budgeting with auto-pause at 85%"
```

---

## 24. Perception Layer MUST NOT (v2.5)

**The perception layer captures facts. Everything else is downstream's job.**

### 24.1 Hard prohibitions (perception layer SHALL NOT)

The perception layer is content-neutral and judgment-free. It SHALL NOT:

1. **Make CRO judgments.** Don't compute "this CTA is too small" — record the size, let heuristics judge.
2. **Prioritize elements.** Don't rank elements by importance — record everything meeting capture criteria.
3. **Rewrite content.** Don't normalize copy or fix typos in extracted text.
4. **Submit forms autonomously.** Form submits require explicit `AuditRequest.allow_form_submit` whitelist + per-audit consultant approval (per §11 REQ-SAFETY-006).
5. **Attempt authentication.** Auth-required pages produce `AUTH_REQUIRED_DETECTED` warning + skip. Use `AuditRequest.auth_seed` (cookies / localStorage seed) when authenticated audit is needed.
6. **Retry state-mutating operations.** If add-to-cart succeeds and a downstream step fails, do NOT retry add-to-cart. Mark page failed; audit continues.
7. **Spoof crawlers.** No User-Agent spoofing of Googlebot or other search-engine UAs (per §11 REQ-SAFETY-007).
8. **Bypass robots.txt.** Disallowed paths emit `ROBOTS_TXT_DISALLOWED` warning + skip. No UA workaround (per §11 REQ-SAFETY-005).
9. **Mutate the captured bundle.** `PerceptionBundle` is immutable after capture (`Object.freeze`); any consumer needing a derived view must produce a new artifact, not modify the bundle.
10. **Cross the layer boundary.** Perception SHALL NOT call analysis tools, heuristic evaluation, or finding production. The reverse holds: analysis SHALL NOT modify perception.

### 24.2 What perception SHOULD do

By contrast, the perception layer SHALL:

- Capture all 4 channels (DOM / AX-tree / visual / layout) per state
- Fuse channels into ElementGraph keyed by stable `element_id`
- Run settle predicate before every state capture
- Emit warnings for gaps (Shadow DOM depth, iframe skip, settle timeout, etc.)
- Emit nondeterminism flags when A/B testing platforms or personalization detected
- Capture hidden elements with reason flags (downstream decides whether to consume them)
- Respect the configured cookie banner policy (`dismiss` / `preserve`)
- Honor robots.txt + per-domain rate limits

### 24.3 Why this rule exists

CRO findings depend on a stable, reproducible perception layer. If perception silently makes judgments ("I think this CTA is too small, so I won't capture its bbox"), downstream cannot reason about the data, and reproducibility breaks. Separating capture from judgment is the architectural invariant that makes 3-layer finding validation (CoT → self-critique → grounding) possible.

**Provenance:**

```yaml
why:
  source: docs/Improvement/perception_layer_spec.md §8
  evidence: >
    "Perception captures facts. Everything else is downstream's job."
    "No CRO judgments. Don't compute 'this CTA is too small' — record the size, let heuristics judge."
    "No prioritization. Don't rank elements by importance — record everything that meets capture criteria."
adopted_in: v2.5 / Phase 1c
referenced_specs:
  - §06 §6.6 (PageStateModel + Shadow DOM/Portal/pseudo-element traversal)
  - §07 §7.9.3 (PerceptionBundle envelope + ElementGraph + FusedElement)
  - §11 §11.1.1 (robots/ToS hard rules)
  - §16 Phase 1c artifact table
```

---

## 25. Context Capture Layer MUST NOT (v3.0)

**The context capture layer captures intake. Everything else is downstream's job.**

### 25.1 Hard prohibitions (context capture layer SHALL NOT)

The context capture layer is a pre-perception intake layer. It SHALL NOT:

1. **Run perception.** No headless browser, no state exploration, no Playwright at this layer. Lightweight HTTP fetch + cheerio only.
2. **Make heuristic judgments.** Don't say "this is a bad page" — only "this is a PDP".
3. **Silently guess.** Every inference MUST record `source` + `confidence`. No anonymous defaults.
4. **Skip clarification when confidence is low.** When `confidence < 0.6` on a required field, the system MUST surface a blocking `open_question` and halt audit.
5. **Mutate page state.** No clicks, no form submits, no JS execution. GET-only HTTP fetch.
6. **Make assumptions about traffic without user input.** Inference for `audience.awareness_level` and `traffic.creative_or_message` is explicitly deferred to Phase 13b — and even then, must default to low confidence + flag.
7. **Hide low-confidence values.** Profile fields with confidence <0.6 MUST be surfaced via `open_questions[]`, not silently used.
8. **Bypass robots.txt.** The HtmlFetcher (T4B-003) honors robots.txt. UA spoofing is forbidden (per R5 + §11 REQ-SAFETY-007).
9. **Persist mutable ContextProfile.** ContextProfile is `Object.freeze`'d after capture. The `context_profiles` table is append-only (no UPDATE, no DELETE per §13).
10. **Run perception heuristics.** Heuristic selection happens in HeuristicLoader (Phase 6), not in context capture. Context capture produces inputs, not decisions.

### 25.2 What context capture SHOULD do

By contrast, the context capture layer SHALL:

- Capture all 5 dimensions per audit (business / page / audience / traffic / goal+constraints)
- Tag every field with `{value, source, confidence}`
- Halt audit on blocking open_questions; resume cleanly after user answers
- Cache HTTP fetch by URL+ETag for re-runs
- Honor robots.txt + realistic UA
- Pin into ReproducibilitySnapshot (§25)
- Reject AuditRequest missing `goal.primary_kpi`
- Reject AuditRequest for regulated verticals missing `constraints.regulatory`

### 25.3 Why this rule exists

Context drift causes silent finding-quality degradation. If context layer guesses business archetype as "D2C" when it's actually "B2B", the wrong heuristic pack runs, and the audit produces 30 generic findings instead of 10 relevant ones — wasted budget + wasted consultant review time. Provenance + clarification loop make context certainty visible to downstream layers.

The architectural separation matters: context describes WHAT the page is for; perception describes HOW the page is built; analysis describes WHAT'S WRONG. Mixing context capture into perception (or perception into context) creates cyclic dependencies that break reproducibility and reasoning.

**Provenance:**

```yaml
why:
  source: docs/Improvement/context_capture_layer_spec.md §5
  evidence: >
    "No perception (no headless browser, no state exploration)."
    "No heuristic judgments (don't say 'this is a bad page' — only 'this is a PDP')."
    "No silent guessing — every inference must record source + confidence."
    "No skipping user when confidence is low — always surface open_questions."
adopted_in: v3.0 / Phase 4b
referenced_specs:
  - §37 §37.7 (Architectural Boundaries)
  - §13 (context_profiles table — append-only)
  - §18 (AuditRequest intake validation)
  - §25 (ReproducibilitySnapshot pinning — Phase 13b)
  - §16 Phase 4b artifact table
```

---

## 26. State Exploration Layer MUST NOT (v3.1)

**State exploration drives perception but does not edit it. It captures state transitions; everything else is downstream's job.**

### 26.1 Hard prohibitions (state exploration layer SHALL NOT)

The state exploration layer enumerates and fires triggers, captures resulting states, and emits a StateGraph. It SHALL NOT:

1. **Make CRO judgments.** Don't decide a state is "bad" — record it, let heuristics judge.
2. **Submit forms unless explicitly allowed.** `AuditRequest.allow_form_submit` whitelist required (per §11 REQ-SAFETY-006). Default = block all.
3. **Take destructive actions.** Triggers whose copy contains "delete", "remove", "logout", "cancel order", "unsubscribe" are skipped. Captured as `unexplored[]` with `reason: "destructive"`.
4. **Submit checkout / payment.** Hard rule. No override exists.
5. **Follow external links.** Record edge in StateGraph with `delta_type: "navigation"` + external flag; do NOT navigate to external domain.
6. **Attempt authentication.** Auth-required pages trigger `AUTH_REQUIRED_DETECTED` warning + skip. Use `AuditRequest.auth_seed` (Phase 13b master track) for authenticated audits.
7. **Mutate perception data.** State exploration drives perception (decides what to interact with) — it never edits perception output. PerceptionBundle for each state is produced by the perception layer, frozen, and consumed read-only.
8. **Submit payment ever.** Even with override flags, payment submission is forbidden. Hard rule.
9. **Hide nondeterminism.** When replay-sampling reveals state hash mismatch, the layer MUST emit `NONDETERMINISTIC_STATE` warning. Silent absorption is a violation.
10. **Bypass storage restoration policy.** When `restore_storage_per_branch: true` (default), the layer MUST snapshot at State 0 and restore between branches. Silent omission is a violation.

### 26.2 What state exploration SHOULD do

By contrast, the state exploration layer SHALL:

- Discover candidate triggers from the element graph (§07 §7.9.3 ElementGraph)
- Fire triggers in priority order (CRO-value heuristic per §20 §20.3)
- Settle after each trigger via the predicate (§20 §20.4 / §07 §7.9.3 SettlePredicate)
- Diff each new state vs parent and classify delta (§20 §20.5)
- Hash each state for dedup (§20 §20.5)
- Use hybrid state reset (reverse-action when reversible, reload+replay otherwise) per §20 §20.9.1
- Snapshot + restore storage between branches per §20 §20.9.2
- Replay-sample first 3 non-default states for nondeterminism detection per §20 §20.9.3
- Emit warnings for caps reached, settle timeouts, trigger failures
- Stay within resource caps (60s wall, 100 triggers, 50 states, 50MB screenshots)

### 26.3 Why this rule exists

State exploration is the layer where most page-analyzers fail. Naive enumeration explodes budget on duplicate states. Skipping state reset corrupts depth-2+ exploration. Failing to restore storage silently breaks exit-intent re-fire. Ignoring nondeterminism produces flaky findings that consultants can't reproduce. The MUST NOT list codifies the architectural discipline that prevents these failure modes.

The architectural separation matters: state exploration decides WHAT TO INTERACT WITH; perception decides HOW TO CAPTURE WHAT'S THERE; analysis decides WHAT'S WRONG. Mixing creates cyclic dependencies that break reproducibility and reasoning.

**Provenance:**

```yaml
why:
  source: docs/Improvement/state_exploration_layer_spec.md §9
  evidence: >
    "No CRO judgments. Don't decide a state is 'bad' — record it, let heuristics judge."
    "No form submits unless explicitly allowed."
    "No destructive actions (delete, logout, cancel order, unsubscribe)."
    "No following external links."
    "No auth attempts."
    "No payment submission ever."
    "No mutation of perception data — drives perception, doesn't edit its output."
adopted_in: v3.1 / Phase 13 extension
referenced_specs:
  - §20 §20.9.1 (Hybrid State Reset Strategy)
  - §20 §20.9.2 (Storage Restoration Between Branches)
  - §20 §20.9.3 (Nondeterministic State Detection)
  - §11 §11.1.1 (robots/ToS hard rules)
  - §16 Phase 13 v3.1 extension artifacts
```

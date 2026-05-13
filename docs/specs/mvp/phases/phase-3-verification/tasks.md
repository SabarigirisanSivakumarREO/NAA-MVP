---
title: Tasks — Phase 3 Verification (thin)
artifact_type: tasks
status: approved
version: 0.3
created: 2026-04-27
updated: 2026-05-14
owner: engineering lead
authors: [Claude (drafter)]

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-3-verification/spec.md
  - docs/specs/mvp/phases/phase-3-verification/plan.md
  - docs/specs/mvp/phases/phase-3-verification/impact.md
  - docs/specs/mvp/tasks-v2.md v2.3.2 (T051-T065 with T056-T061 deferred)
  - docs/specs/mvp/constitution.md (R3 TDD, R4.4 multiplicative, R23)

req_ids:
  - REQ-VERIFY-001
  - REQ-VERIFY-002
  - REQ-VERIFY-003
  - REQ-VERIFY-CONFIDENCE-001
  - REQ-VERIFY-FAILURE-001

impact_analysis: docs/specs/mvp/phases/phase-3-verification/impact.md

delta:
  new:
    - Phase 3 tasks.md — 9 MVP tasks (T051-T055 + T062-T065)
    - T056-T061 deferred to v1.1 per tasks-v2 v2.3.2 (NOT scheduled here)
    - T064 carries explicit additive-math kill criterion
    - v0.2 — T054 acceptance now codifies the 3-criterion visibility check (analyze F04)
    - v0.2 — T064 grep-test details aligned with plan.md v0.2 (source path, comment-stripping, no-multiline) per analyze F02 + F06
    - v0.3 — Session 19 Gate 1 Pass 1 REVISE fixes (fix-all-spec-defects policy enforcement; 5 LOW briefs tightened)
  changed:
    - v0.1 → v0.2 — analyze-driven fixes (F02, F04, F06)
    - v0.2 → v0.3 — T053 brief pins urlMatches semantics (string = strict equality; RegExp = pattern); T054 brief pins ElementAppearsStrategy two-timer (MutationMonitor settle = precondition gate, same 10s ceiling); T055 brief pins elementText shape (`expected.text` when `kind='elementText'`; string = substring); T064 brief adds factor-bounds kill criterion + constructor-throw acceptance; T-PHASE3-LOGGER brief tightened to Pino child-logger binding pattern per Phase 2 T-PHASE2-LOGGER precedent; T051 brief narrows `type` field to `z.string()` aligning with impact.md v0.2 (Pass-2 wording cleanup F-P2-01); T064 conformance test enumeration corrected to "three test blocks across two files" (Pass-2 wording cleanup F-P2-02)
  impacted: []
  unchanged:
    - All AC IDs + REQ IDs; dependency graph; default kill criteria block
    - T051, T052, T062, T063, T065 task bodies (no Gate 1 findings touched them)

governing_rules:
  - Constitution R3 (TDD)
  - Constitution R4.2, R4.4
  - Constitution R9
  - Constitution R23

description: "Phase 3 task list — 9 MVP tasks; T056-T061 deferred; R4.4 additive-math grep test enforces multiplicative confidence."
---

# Tasks: Phase 3 — Verification (thin)

**Input:** spec.md + plan.md + impact.md (this folder)
**Prerequisites:** spec.md `approved` AND impact.md `approved` (R20 MEDIUM risk)
**Test policy:** TDD per R3.1.
**Organization:** Single user story; 9 MVP tasks.

---

## Task ID Assignment

Phase 3 IDs from `docs/specs/mvp/tasks-v2.md` v2.3.2 — T051, T052, T053, T054, T055, T062, T063, T064, T065 (9 MVP tasks). T056-T061 NOT scheduled (deferred to v1.1).

---

## Path Conventions (architecture.md §6.5)

Phase 3 touches:
- `packages/agent-core/src/verification/` (NEW directory tree)
- `packages/agent-core/src/observability/logger.ts` (modify — 3 new correlation fields)
- `packages/agent-core/tests/conformance/` (9 new tests)
- `packages/agent-core/tests/integration/phase3.test.ts`

No MCP, no analysis, no DB, no orchestration in Phase 3.

---

## Default Kill Criteria *(R23 — applies to all tasks)*

```yaml
kill_criteria:
  resource:
    token_budget_pct: 85
    wall_clock_factor: 2x
    iteration_limit: 3
  quality:
    - "any previously-passing test breaks"
    - "pnpm test:conformance -- <component> fails"
    - "implementation reveals spec defect (R11.4)"
    - "additive math on confidence detected (R4.4 violation — T064 specific)"
    - "Playwright import outside Phase 1 boundary (R9 violation)"
  scope:
    - "diff introduces forbidden pattern (R13)"
    - "task expands beyond plan.md file table"
    - "any T056-T061 v1.1 strategy implementation lands (deferred per tasks-v2 v2.3.2)"
  on_trigger:
    - "snapshot WIP to wip/killed/<task-id>-<reason>"
    - "log to task thread"
    - "escalate to human"
    - "do NOT silently retry"
```

T064 carries additional explicit kill criteria.

---

## Phase 1 — Setup

`impact.md` MUST be `status: approved` (MEDIUM risk).

No new deps in Phase 3.

---

## Phase 2 — Foundational

- [ ] **T-PHASE3-TESTS [P] [SETUP]** Author 9 conformance tests + Phase 3 integration test FIRST. All AC-01..AC-09 blocks FAIL initially.
- [ ] **T-PHASE3-LOGGER [SETUP]** Modify `observability/logger.ts` following Phase 2 T-PHASE2-LOGGER precedent: bind `action_id`, `verify_strategy`, `failure_class` as **Pino child-logger fields** at call sites in `VerifyEngine.verify()` and downstream strategies (e.g., `logger.child({ action_id, verify_strategy }).info('verify.dispatch')`). Update the logger module's correlation-fields documentation comment block to declare the three NEW fields alongside Phase 0/1/2 correlation fields (audit_run_id, page_url, node_name, heuristic_id, trace_id, tool_name, tool_call_id, client_session_id). No new Zod schema entry needed — Pino child logger pattern; just doc + usage convention. (v0.3 F07 closure)

**Checkpoint:** Tests fail; logger has new fields. Then T051-T065 proceed.

---

## Phase 3 — User Story 1: Browse-mode actions are verified, classified, confidence-decayed (Priority: P1) 🎯 MVP

**Goal:** Phase 5 Browse MVP can call `VerifyEngine.verify(contract, session)` after every action; failures are classified for routing; confidence decays multiplicatively per R4.4.

**Independent Test:** `pnpm -F @neural/agent-core test integration/phase3` — 10 synthetic contracts route correctly.

**AC IDs covered:** AC-01 through AC-09.

### Implementation tasks

- [ ] **T051 [SETUP] [US-1] ActionContract type** (AC-01, REQ-VERIFY-001)
  - **Brief:**
    - **Outcome:** `verification/types.ts` exports `ActionContractSchema` (Zod) with `id` (uuid), `type` (**`z.string()` per impact.md v0.2** — informational metadata for logging + classifier subclass routing; does NOT drive strategy dispatch (`expected.kind` does); Phase 5 BrowseNode owns concrete enum closure against Phase 2's 22 browser_* + 2 agent_* tools), `target` (optional, action-specific), `expected` (discriminated union: urlMatches / elementAppears / elementText), `candidateStrategies` (priority-ordered name array). `.strict()`. TS type via `z.infer`. ALSO exports `VerifyResultSchema` + `AggregatedVerifyResultSchema`.
    - **Constraints:** File ≤ 200 lines. No `z.any()`.
    - **Acceptance:** AC-01 — Zod parses fixture contracts; rejects malformed.
    - **Files:** `packages/agent-core/src/verification/types.ts`
    - **dep:** T-PHASE3-TESTS, T-PHASE3-LOGGER
    - **Smoke test:** `ActionContractSchema.parse(fixture)` succeeds for valid; throws for invalid
    - **Kill criteria:** default block

- [ ] **T052 [P] [US-1] VerifyStrategy union type + interface** (AC-02, REQ-VERIFY-002)
  - **Brief:**
    - **Outcome:** `verification/types.ts` extends to export `VerifyStrategyNames` const array (9 entries: 3 MVP + 6 v1.1 reserved) + `VerifyStrategyName` type + `VerifyStrategy` interface (`name`, `priority`, `applicable`, `verify`).
    - **Constraints:** Same file as T051 (still < 200 lines combined). v1.1 names reserved but no implementations.
    - **Acceptance:** AC-02 — interface compiles; enum lists all 9 names; v1.1 slots reserved.
    - **Files:** `packages/agent-core/src/verification/types.ts` (extends T051)
    - **dep:** T051
    - **Smoke test:** TypeScript compile passes; enum has exactly 9 entries
    - **Kill criteria:** default block

- [ ] **T053 [P] [US-1] url_change strategy** (AC-03, REQ-VERIFY-003)
  - **Brief:**
    - **Outcome:** `verification/strategies/UrlChangeStrategy.ts` exports `UrlChangeStrategy implements VerifyStrategy` with `name='url_change'`, `priority=100` (high — navigation is most fundamental), `applicable(c)=c.expected.kind==='urlMatches'`, `verify()` reads `session.page.url()` and matches against `expected.urlMatches`. **(v0.3 F03 closure)** String urlMatches uses **strict equality** (`actualUrl === expected.urlMatches`); RegExp urlMatches uses **`.test(actualUrl)` pattern match**. Code MUST dispatch via `typeof` / `instanceof RegExp` discriminator at runtime (Zod schema accepts both via `z.union`, but the runtime dispatch is explicit).
    - **Constraints:** File < 100 lines.
    - **Acceptance:** AC-03 — fixture session at `https://example.com` matches `urlMatches: 'https://example.com'` (strict equality); fixture session at `https://example.com/path` does NOT match `urlMatches: 'https://example.com'` (strict equality returns false for substring); fixture session at `https://example.com/path` DOES match `urlMatches: /^https:\/\/example\.com/` (RegExp pattern match returns true); mismatched URL returns `ok: false`.
    - **Files:** `packages/agent-core/src/verification/strategies/UrlChangeStrategy.ts`
    - **dep:** T051, T052; consumes Phase 1 BrowserSession
    - **Kill criteria:** default block

- [ ] **T054 [P] [US-1] element_appears strategy** (AC-04, REQ-VERIFY-003)
  - **Brief:**
    - **Outcome:** `verification/strategies/ElementAppearsStrategy.ts` exports `ElementAppearsStrategy`. Strategy operates within a **single shared time ceiling** of `contract.expected.timeoutMs` (default 10 000 ms). **Three-criterion visibility check (per spec v0.2 AC-04):** ALL THREE must pass — (a) `querySelector(selector) !== null`, (b) `boundingBox.width > 0 AND boundingBox.height > 0`, (c) computed style `visibility !== 'hidden'` AND `display !== 'none'` AND `opacity > 0`. Uses Phase 1 `MutationMonitor` for stability before checking. **(v0.3 F05 closure) Two-timer semantics:** MutationMonitor is invoked as a **precondition gate**, not a separate timer. Order of operations: (1) `await mutationMonitor.waitForSettle({ timeoutMs: contract.expected.timeoutMs })` — if MutationMonitor returns `unstable: true` (its internal 2s settle predicate fires while DOM keeps mutating, OR shared ceiling expires while DOM still moving), strategy returns `{ ok: false, unstable: true }` immediately WITHOUT proceeding to visibility check; (2) if MutationMonitor settles, the remaining time budget is used for the 3-criterion visibility check — if visibility check exceeds remaining budget, strategy returns `{ ok: false, failedCriterion: 'a'|'b'|'c', timedOut: true }`; (3) on success, returns `{ ok: true, evidence: { boundingBox, computedStyle } }`. Returns VerifyResult; on any criterion failing within budget, returns `{ ok: false, evidence: { failedCriterion: 'a' | 'b' | 'c' } }` for diagnostic clarity.
    - **Constraints:** File < 150 lines. Each criterion is a separate predicate function for testability. NOT bare DOM presence. Two-timer semantics: single shared ceiling — no separate 10s for visibility check.
    - **Acceptance:** AC-04 — fixture suite covers all 3 branches + 2 timer-failure modes: (a) absent element → `ok: false, failedCriterion: 'a'`; (b) zero-dim element → `ok: false, failedCriterion: 'b'`; (c) `visibility:hidden` element → `ok: false, failedCriterion: 'c'`; fully visible → `ok: true`; DOM mutating past settle predicate → `ok: false, unstable: true`; visibility check exceeds remaining budget → `ok: false, timedOut: true`.
    - **Files:** `packages/agent-core/src/verification/strategies/ElementAppearsStrategy.ts`
    - **dep:** T051, T052; consumes Phase 1 MutationMonitor
    - **Kill criteria:** default block

- [ ] **T055 [P] [US-1] element_text strategy** (AC-05, REQ-VERIFY-003)
  - **Brief:**
    - **Outcome:** `verification/strategies/ElementTextStrategy.ts` exports `ElementTextStrategy` with `name='element_text'`, `applicable(c)=c.expected.kind==='elementText'`. Reads `element.textContent` (for non-input elements) OR `element.value` (for `<input>` / `<textarea>` / `<select>`); matches against `c.expected.text` (NOT `c.expected.elementText.text` — shape is flat per the discriminated-union variant per impact.md). **(v0.3 F04 closure) Match semantics:** string text = **substring match** (case-sensitive `actual.includes(expected.text)`); RegExp text = **`.test(actual)` pattern match**. Code dispatches via `typeof` / `instanceof RegExp` discriminator (mirrors T053 url_change pattern). Returns VerifyResult.
    - **Constraints:** File < 100 lines. Element-type dispatch (textContent vs value) is a separate predicate function.
    - **Acceptance:** AC-05 — typed substring matches; mismatched text returns `ok: false`; input field value read works for `<input>` / `<textarea>` / `<select>`; non-input element falls back to textContent; RegExp match works for pattern text; case-sensitive substring asserted (`'Amazon'` does NOT match `'amazon'` for string text).
    - **Files:** `packages/agent-core/src/verification/strategies/ElementTextStrategy.ts`
    - **dep:** T051, T052
    - **Kill criteria:** default block

- [ ] **T062 [US-1] VerifyEngine** (AC-06, REQ-VERIFY-002)
  - **Brief:**
    - **Outcome:** `verification/VerifyEngine.ts` exports `VerifyEngine` class with `register(strategy)` + `verify(contract, session)`. Iterates contract's `candidateStrategies` in priority order; runs first applicable; returns aggregated result. Forward-compat: `register()` accepts any `VerifyStrategy` whose name is in the enum (including the 6 v1.1 names).
    - **Constraints:** File < 200 lines. Engine code is name-agnostic; doesn't hard-code MVP-only behavior.
    - **Acceptance:** AC-06 — registers 3 MVP strategies; `register({ name: 'no_captcha', ... })` succeeds without engine code change.
    - **Files:** `packages/agent-core/src/verification/VerifyEngine.ts`
    - **dep:** T051, T052, T053, T054, T055
    - **Kill criteria:** default block + extra: any check that gates registration on `name in MVP_NAMES_ONLY` → STOP, that's not forward-compat

- [x] **T063 [P] [US-1] FailureClassifier** (AC-07, REQ-VERIFY-FAILURE-001)
  - **Brief:**
    - **Outcome:** `verification/FailureClassifier.ts` exports `FailureClassifier` class with pure `classify(input)` method. Maps `AggregatedVerifyResult | {kind:'safety'|'rate'}` → `FailureClassification` with class + subclass + shouldRetry. Includes `bot_detected_likely` class pre-positioned for v1.1.
    - **Constraints:** File < 200 lines. Pure function. No external state.
    - **Acceptance:** AC-07 — 5 fixtures (one per FailureClass) route correctly.
    - **Files:** `packages/agent-core/src/verification/FailureClassifier.ts`
    - **dep:** T051, T052
    - **Kill criteria:** default block

- [ ] **T064 [US-1] ConfidenceScorer (multiplicative — R4.4)** (AC-08, REQ-VERIFY-CONFIDENCE-001) **— extended kill criteria**
  - **Brief:**
    - **Outcome:** `verification/ConfidenceScorer.ts` exports `ConfidenceScorer` class with `afterFailure(c) = c * 0.97`, `afterSuccess(c) = min(1, c * 1.01)`, `belowFloor(c) = c < 0.10`. Configurable factors via constructor. **NEVER additive math.** **(v0.3 F06 closure) Constructor validates factor bounds:** throws `RangeError` if `failureFactor` is NOT strictly in (0, 1) OR if `successFactor < 1`. Per plan.md v0.3 Phase 1 Design item 4 canonical code.
    - **Conformance — three test blocks across two test files (per plan v0.3 + spec v0.3 AC-08):**
      - **(a) `tests/conformance/confidence-scorer.test.ts` — `describe('runtime math')` block** — runtime math correctness (e.g., `afterFailure(1).toFixed(2) === '0.97'`).
      - **(b) `tests/conformance/confidence-scorer.test.ts` — `describe('constructor bounds')` block (same file as (a))** — asserts `RangeError` thrown on `failureFactor = 0` / `failureFactor = 1` / `failureFactor = -0.5` / `successFactor = 0.5` / `successFactor < 1`. Asserts ACCEPTED on default `{ failureFactor: 0.97, successFactor: 1.01, floor: 0.10 }` and on edge-case `{ failureFactor: 0.5, successFactor: 1.0, floor: 0.05 }` (successFactor === 1 = no rebound, allowed).
      - **(c) `tests/conformance/confidence-scorer-no-additive.test.ts`** — source-grep enforcement. Reads `packages/agent-core/src/verification/ConfidenceScorer.ts` as text. **Strips comments first** (block + line comments removed before grep) so explanatory prose with `+`/`-` is allowed in comments. Greps line-by-line (no multiline matching) for: `\bc\s*[-+]\s*\d`, `\bc\s*[-+]=`, `\bcurrent\s*[-+]\s*\d`, `\bconfidence\s*[-+]`. FAILS on any match. See plan.md v0.3 Phase 1 Design item 4 for the canonical test code.
    - **Constraints:** File < 100 lines. Source contains ONLY `*` operator on confidence in live code; comments may use `+`/`-` for explanation. NO AST check (grep-only enforcement per spec v0.3 + plan v0.3; revisit if grep proves insufficient).
    - **Non-goals:** No async; no I/O; pure arithmetic.
    - **Acceptance:** AC-08 — all three conformance tests green (runtime math + constructor bounds + source-grep).
    - **Per-task kill criteria (extends default):**
      - "Source code contains `c -= X`, `c += X`, `current - X`, `confidence + X` patterns on confidence" → R23 trigger; R4.4 violation. Convert to multiplicative or escalate.
      - "Test `confidence-scorer-no-additive.test.ts` removed or weakened" → R23 trigger; the test IS the constitution enforcement.
      - "Configurable factors set to values that mimic additive (e.g., factor close to 1 with magic offsets)" → R23 trigger; talk to engineering lead.
      - **(v0.3 F06 closure)** "Constructor missing bounds validation (no `RangeError` throw on `failureFactor ∉ (0,1)` or `successFactor < 1`)" → R23 trigger; the bounds check is the structural guard preventing additive-mimicking config.
    - **Files:** `packages/agent-core/src/verification/ConfidenceScorer.ts`
    - **dep:** T051

- [ ] **T065 [US-1] Phase 3 integration test** (AC-09)
  - **Brief:**
    - **Outcome:** `tests/integration/phase3.test.ts` exercises 10 synthetic contracts (3 success / 3 verify_failed / 2 rate_limited / 2 safety_blocked) end-to-end. Asserts: VerifyEngine routes correctly; each strategy invoked when applicable; FailureClassifier returns expected class; ConfidenceScorer trends correctly across N failures.
    - **Constraints:** File < 250 lines. Total wall-clock < 30 s.
    - **Acceptance:** AC-09 — exits 0; all 10 contracts route correctly.
    - **Files:** `packages/agent-core/tests/integration/phase3.test.ts`
    - **dep:** T051-T064
    - **Kill criteria:** default block + extra: wall-clock > 30 s → STOP, individual strategy regression

**Checkpoint:** After T-PHASE3-TESTS + T-PHASE3-LOGGER + T051-T065 green, all 9 ACs pass. Phase 3 ready for rollup.

---

## Phase N — Polish

- [ ] **T-PHASE3-DOC [P]** Update root README with `pnpm test:integration phase3` validator.
- [ ] **T-PHASE3-ROLLUP** Author `phase-3-current.md` per R19. Active modules: `verification/`. Contracts: ActionContract, VerifyStrategy, VerifyEngine, ConfidenceScorer, FailureClassifier (all NEW). Known limitations: 6 strategies deferred to v1.1; engine reserves slots. Forward risks for Phase 5 (action node integration); for Phase 4 (FailureClass enum stability).

---

## Dependencies & Execution Order

```
T-PHASE3-TESTS  +  T-PHASE3-LOGGER             # SETUP parallel
              │              │
              └──────┬───────┘
                     ▼
                   T051                          # ActionContract type
                     │
                     ▼
                   T052                          # VerifyStrategy interface
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
      T053         T054         T055           # 3 MVP strategies (parallel)
        │            │            │
        └────────────┼────────────┘
                     ▼
                   T062                          # VerifyEngine
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
     T063          T064          (T064 first if extended kill criteria need review)
                     │
                     ▼
                   T065                          # Integration test
                     │
                     ▼
T-PHASE3-DOC, T-PHASE3-ROLLUP
```

### Comprehension-Debt Pacing (PRD §10.10)

T053 + T054 + T055 are the natural parallel point — 3 small strategies, mutually independent. Single-batch dispatch to 3 subagents acceptable (under 5-agent ceiling).

---

## Implementation Strategy

1. SETUP — T-PHASE3-TESTS + T-PHASE3-LOGGER. AC blocks FAIL.
2. T051 (ActionContract) → T052 (VerifyStrategy interface) — sequential, same file.
3. T053 + T054 + T055 — parallel (3 strategies, independent).
4. T062 (VerifyEngine) — single-threaded.
5. T063 (FailureClassifier) + T064 (ConfidenceScorer) — parallel.
6. T065 (integration test).
7. T-PHASE3-DOC + T-PHASE3-ROLLUP.

---

## Notes

- 6 strategies (T056-T061) are **deferred to v1.1** per tasks-v2 v2.3.2. Do NOT implement them in this phase — kill criterion catches it.
- R4.4 multiplicative-only is non-negotiable. T064 has both a runtime test and a source-grep test.
- `bot_detected_likely` failure class is in the enum despite no MVP path producing it — this is intentional v1.1 forward-compat.
- One task = one commit. Strategies can be one PR (review the 3 atomically) given they share an interface.

---

## Cross-references

- spec.md, plan.md, impact.md (this folder)
- Phase 1 spec, impact (BrowserEngine + MutationMonitor consumed)
- `docs/specs/mvp/tasks-v2.md` v2.3.2 T051-T065
- `docs/specs/mvp/constitution.md` R4.2, R4.4, R9, R20, R23

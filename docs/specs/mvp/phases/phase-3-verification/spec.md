---
title: Phase 3 — Verification & Confidence (thin)
artifact_type: spec
status: draft
version: 0.2
created: 2026-04-27
updated: 2026-04-27
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (F-003 Browser Agent verification surface)
  - docs/specs/mvp/constitution.md (R4 browser rules; R9 adapter; R17-R23)
  - docs/specs/mvp/architecture.md (§6.4 tech stack, §6.5 file structure)
  - docs/specs/mvp/tasks-v2.md v2.3.2 (T051-T065; T053-T061 reduced to 3 MVP strategies)
  - docs/specs/AI_Browser_Agent_Architecture_v3.1.md (REQ-VERIFY-*)
  - docs/specs/mvp/phases/phase-1-perception/impact.md (BrowserEngine + PageStateModel forward contract)

req_ids:
  - REQ-VERIFY-001
  - REQ-VERIFY-002
  - REQ-VERIFY-003
  - REQ-VERIFY-CONFIDENCE-001
  - REQ-VERIFY-FAILURE-001

impact_analysis: docs/specs/mvp/phases/phase-3-verification/impact.md
breaking: false
affected_contracts:
  - ActionContract
  - VerifyStrategy
  - VerifyEngine
  - ConfidenceScorer
  - FailureClassifier

delta:
  new:
    - Phase 3 spec — introduces 5 verification contracts
    - AC-01..AC-09 stable IDs
    - R-01..R-09 functional requirements
    - 3 MVP verify strategies; 6 deferred to v1.1 per tasks-v2 v2.3.2
    - v0.2 — AC-04 element_appears visibility criterion concrete (analyze finding F04)
    - v0.2 — AC-08 ConfidenceScorer enforcement narrowed to "grep-based source check" (no AST claim) + grep test details specified (analyze findings F01 + F06)
  changed:
    - v0.1 → v0.2 — analyze-driven fixes (F01, F04, F06); no scope changes
  impacted:
    - Constitution R4.4 (multiplicative confidence decay) — first concrete enforcement in ConfidenceScorer
    - Constitution R4.2 (verify everything) — VerifyEngine is the runtime enforcement
  unchanged:
    - AC-NN stable IDs and acceptance scenarios (R18 append-only)
    - R-NN functional requirement IDs and statements
    - User Scenarios, Out of Scope, Constitution Alignment Check sections preserved verbatim

governing_rules:
  - Constitution R4 (browser rules — R4.2 verify everything; R4.4 multiplicative confidence)
  - Constitution R9 (adapter pattern — VerifyEngine seam for v1.1 strategies)
  - Constitution R11 (spec discipline)
  - Constitution R17 (lifecycle)
  - Constitution R20 (impact analysis)
  - Constitution R23 (kill criteria)
---

# Feature Specification: Phase 3 — Verification & Confidence (thin)

> **Summary (~150 tokens):** Thin verification layer for browse-mode actions. **9 MVP tasks** (T051-T055 + T062-T065 from tasks-v2 v2.3.2; T056-T061 deferred to v1.1). Defines `ActionContract` (every action declares pre/post conditions + candidate strategies), `VerifyStrategy` union, **3 MVP strategies** (`url_change` post-navigation, `element_appears` post-click, `element_text` post-content-change), `VerifyEngine` (mutation-aware orchestrator running strategies in priority order), `FailureClassifier` (typed failures for orchestrator routing), and `ConfidenceScorer` enforcing R4.4 multiplicative decay non-negotiably. The `VerifyEngine` interface reserves slots for the 6 v1.1-deferred strategies — forward-compat seam — so v1.1 plugs them in without code-shape changes. No LLM, no orchestration graph, no findings — Phase 5 Browse MVP wires this into action nodes.

**Feature Branch:** `phase-3-verification` (created at implementation time)
**Input:** Phase 3 scope from `docs/specs/mvp/phases/INDEX.md` row 3 + `tasks-v2.md` v2.3.2 T051-T065 (9 MVP tasks)

---

## Mandatory References

1. `docs/specs/mvp/constitution.md` — R4.2 (verify everything) + R4.4 (multiplicative confidence — `current × 0.97`, NEVER additive); R9 (VerifyEngine adapter for v1.1 plugin); R10, R17-R23.
2. `docs/specs/mvp/PRD.md` §F-003 — Browser Agent verification scope.
3. `docs/specs/mvp/architecture.md` §6.4 (no new deps; uses Playwright via BrowserEngine adapter from Phase 1) + §6.5 (`packages/agent-core/src/verification/`).
4. `docs/specs/mvp/tasks-v2.md` v2.3.2 T051-T065 — note 6 deferred tasks T056-T061.
5. `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` — REQ-VERIFY-* (canonical browser agent verification spec).
6. `docs/specs/mvp/phases/phase-1-perception/spec.md` + `impact.md` — Phase 1 prerequisite.

---

## Constraints Inherited from Neural Canonical Specs

- **Tech stack:** No new deps in Phase 3. Uses Phase 1 `BrowserEngine` + `BrowserSession`. No `playwright-extra`, no LLM, no DB.
- **R4.2 Verify everything** — no browse action is "done" until its verification strategy passes. Phase 5 Browse MVP MUST call `VerifyEngine.verify(contract, session)` after every action.
- **R4.4 Multiplicative confidence decay** — `ConfidenceScorer` uses `confidence = confidence × 0.97` per failed verify (or some `× factor` per spec). NEVER `confidence -= 0.05`. Forbidden additive math is a R23 kill trigger. The factor naturally bounds in (0, 1).
- **R9 Adapter pattern** — `VerifyEngine` accepts strategies by name via a registry. The 6 v1.1-deferred strategies have **interface slots reserved** so v1.1 plugs them in without re-shape. Strategies follow the same `VerifyStrategy` interface shape.
- **No `console.log`** (R10.6) — Pino with new correlation fields: `action_id`, `verify_strategy`, `failure_class`.
- **Files < 300 lines, functions < 50 lines** — strategies are tiny (~30-50 lines each); VerifyEngine ~150 lines.
- **No conversion-rate predictions** (R5.3) — N/A in Phase 3.
- **No append-only DB writes** (R7.4) — N/A.

---

## User Scenarios & Testing

### User Story 1 — Browse-mode actions are verified, classified on failure, and confidence-decayed (Priority: P1) 🎯 MVP

When a Phase 5 Browse MVP node performs an action (navigate / click / type), it emits an `ActionContract` describing target + expected outcome + candidate strategies. `VerifyEngine.verify()` runs the strategies in priority order. On success, the result is stamped into the action log. On failure, `FailureClassifier` typed-classes the failure and `ConfidenceScorer` multiplicatively decays the session's running confidence.

**Why this priority:** Without verification, browse actions are open-loop — no way to detect when a click missed or a navigation failed. R4.2 makes this rule structural; Phase 5 cannot ship without it.

**Independent Test:** `pnpm -F @neural/agent-core test integration/phase3` — synthetic action-result fixtures exercise each strategy + the engine + classifier + scorer.

**Acceptance Scenarios:**

1. **Given** an `ActionContract { type: 'navigate', expected: { urlMatches: 'https://example.com' } }`, **When** the action lands on `https://example.com`, **Then** `url_change` strategy returns `{ ok: true, strategy: 'url_change', evidence: { actualUrl: 'https://example.com' } }`.
2. **Given** an `ActionContract { type: 'click', expected: { elementAppears: { selector: '.cart-count' } } }`, **When** the click triggers DOM mutation revealing `.cart-count`, **Then** `element_appears` returns `{ ok: true }` after `MutationMonitor` settles (uses Phase 1's MutationMonitor).
3. **Given** an `ActionContract { type: 'type', expected: { elementText: { selector: 'input.search', text: 'amazon' } } }`, **When** `element_text` runs after typing, **Then** verification returns `{ ok: true }` if the input value matches.
4. **Given** all 3 strategies fail for a contract, **When** `VerifyEngine.verify()` returns, **Then** the result is `{ ok: false, attemptedStrategies: ['url_change', 'element_appears', 'element_text'], failures: [...] }` and `FailureClassifier` typed-classes the overall failure.
5. **Given** N consecutive failed verifies in a session, **When** `ConfidenceScorer.afterFailure()` runs N times, **Then** confidence = `initial × 0.97^N` (multiplicative); no additive math; bounded in (0, 1).
6. **Given** the v1.1-deferred strategy `no_captcha`, **When** `VerifyEngine.registerStrategy('no_captcha', impl)` is called by future v1.1 code, **Then** registration succeeds without engine code changes (forward-compat seam verified).
7. **Given** a `FailureClassifier` input `{ ok: false, failures: [{ strategy: 'url_change', actualUrl: 'about:blank' }] }`, **When** classifier runs, **Then** result is `{ class: 'verify_failed', subclass: 'navigation_did_not_complete', shouldRetry: true }`.
8. **Given** Phase 3 integration test, **When** it runs against synthetic fixtures (10 contracts: 3 success / 3 verify_failed / 2 rate_limited / 2 safety_blocked), **Then** every contract routes to the correct classifier output and confidence trends as expected.

### Edge Cases

- **Navigation completes but URL is unexpected (e.g., redirect to login):** `url_change` returns `ok: false` with `actualUrl`; FailureClassifier marks `unexpected_redirect` (subclass for retry routing).
- **Element appears but is hidden by CSS:** `element_appears` MUST check **all three** visibility criteria — (a) DOM presence (`querySelector !== null`), (b) bounding box > 0 in both width and height, (c) computed style `visibility !== 'hidden'` AND `display !== 'none'` AND `opacity > 0`. All three required to declare `ok: true`. Bare DOM presence is insufficient.
- **MutationMonitor never settles within 10s during verify:** strategy returns `ok: false` with `unstable: true` rather than blocking forever.
- **All 3 strategies inapplicable to a contract (e.g., file download):** VerifyEngine returns `{ ok: false, reason: 'no_applicable_strategy' }`; FailureClassifier marks `unverifiable` (subclass — Phase 5 can route to HITL or skip).
- **Confidence floor:** if `confidence × 0.97^N < 0.10`, ConfidenceScorer emits a `low_confidence_threshold` warning event for orchestrator escalation. Floor is configurable; default 0.10.

---

## Acceptance Criteria *(stable IDs, append-only)*

| ID | Criterion | Conformance test path | Linked task |
|----|-----------|----------------------|-------------|
| AC-01 | `ActionContract` Zod schema validates `{ id, type, target?, expected, candidateStrategies }`; `expected` is a discriminated union (urlMatches / elementAppears / elementText / etc.) | `tests/conformance/action-contract.test.ts` | T051 |
| AC-02 | `VerifyStrategy` interface defines `name: string`, `priority: number`, `applicable(contract): boolean`, `verify(contract, session): Promise<VerifyResult>`. All 3 MVP strategies implement this interface; 6 v1.1 strategies have reserved name slots in the interface enum | `tests/conformance/verify-strategy.test.ts` | T052 |
| AC-03 | `url_change` strategy reads `session.page.url()` post-action; matches against `expected.urlMatches` (string or regex); returns `VerifyResult` | `tests/conformance/verify-url-change.test.ts` | T053 |
| AC-04 | `element_appears` strategy waits up to 10 s for selector to be **fully visible**, defined as ALL THREE: (a) `querySelector(selector) !== null`, (b) `boundingBox.width > 0 AND boundingBox.height > 0`, (c) computed style `visibility !== 'hidden'` AND `display !== 'none'` AND `opacity > 0`. Uses Phase 1 `MutationMonitor` for stability before checking. Returns `VerifyResult { ok: false }` if any of the 3 visibility criteria fail. | `tests/conformance/verify-element-appears.test.ts` (covers all 3 visibility branches via fixtures) | T054 |
| AC-05 | `element_text` strategy reads element value/text post-action; substring/regex match per `expected.elementText.text`; returns `VerifyResult` | `tests/conformance/verify-element-text.test.ts` | T055 |
| AC-06 | `VerifyEngine` accepts a `StrategyRegistry`; runs strategies in priority order; respects `applicable()` gating; returns aggregated `VerifyResult`. Registration of v1.1 strategy slots succeeds without engine code change (forward-compat) | `tests/conformance/verify-engine.test.ts` | T062 |
| AC-07 | `FailureClassifier` typed-classes outcomes into `{ class: 'verify_failed' \| 'safety_blocked' \| 'rate_limited' \| 'unverifiable' \| 'bot_detected_likely', subclass: string, shouldRetry: boolean }`. Pre-positions `bot_detected_likely` for v1.1's `no_bot_block` strategy. | `tests/conformance/failure-classifier.test.ts` | T063 |
| AC-08 | `ConfidenceScorer` enforces multiplicative decay: `afterFailure(c)` = `c × 0.97` (default factor); `afterSuccess(c)` = `min(1, c × 1.01)` (mild rebound); NEVER `c - 0.05` or `c + 0.01`. **Two-test enforcement:** (1) runtime test asserts the math (`afterFailure(1).toFixed(2) === '0.97'`); (2) **source-grep test** reads `packages/agent-core/src/verification/ConfidenceScorer.ts` as text and asserts NO regex match for `\bc\s*[-+]\s*\d`, `\bc\s*[-+]=`, `\bcurrent\s*[-+]\s*\d`, `\bconfidence\s*[-+]` patterns. Comments (`//` and `/* */`) are STRIPPED before grep so explanatory prose with `+`/`-` is allowed. The grep does NOT cross newlines (each line evaluated independently). | `tests/conformance/confidence-scorer.test.ts` + `tests/conformance/confidence-scorer-no-additive.test.ts` | T064 |
| AC-09 | Phase 3 integration test exercises 10 synthetic contracts (3 success / 3 verify_failed / 2 rate_limited / 2 safety_blocked) end-to-end through ActionContract → VerifyEngine → 3 strategies → FailureClassifier → ConfidenceScorer; total wall-clock < 30 s | `tests/integration/phase3.test.ts` | T065 |

AC-NN IDs are append-only per Constitution R18.

---

## Functional Requirements

| ID | Requirement | Cites PRD F-NNN | Linked architecture spec |
|----|-------------|-----------------|--------------------------|
| R-01 | System MUST define `ActionContract` Zod schema in `verification/types.ts` capturing target + expected + candidate strategies | F-003 | REQ-VERIFY-001 |
| R-02 | System MUST define `VerifyStrategy` interface + `VerifyResult` Zod schema | F-003 | REQ-VERIFY-002 |
| R-03 | System MUST implement `url_change` MVP strategy | F-003 | REQ-VERIFY-003 |
| R-04 | System MUST implement `element_appears` MVP strategy using Phase 1 MutationMonitor | F-003 | REQ-VERIFY-003 |
| R-05 | System MUST implement `element_text` MVP strategy | F-003 | REQ-VERIFY-003 |
| R-06 | System MUST implement `VerifyEngine` with strategy registry; reserves 6 v1.1 strategy slots as forward-compat seam | F-003 | REQ-VERIFY-002 |
| R-07 | System MUST implement `FailureClassifier` with typed failure classes including `bot_detected_likely` for v1.1 forward-compat | F-003 | REQ-VERIFY-FAILURE-001 |
| R-08 | System MUST implement `ConfidenceScorer` with **multiplicative** decay per R4.4; NO additive math allowed in source (enforced via grep test) | F-003 | REQ-VERIFY-CONFIDENCE-001 + Constitution R4.4 |
| R-09 | System MUST provide Phase 3 integration test against 10 synthetic contracts | F-003 acceptance | (integration test) |

---

## Non-Functional Requirements

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| NF-Phase3-01 | Per-strategy verify wall-clock | < 2 s on static page (uses MutationMonitor 2 s settle) | Pino timing |
| NF-Phase3-02 | VerifyEngine total per-action overhead | < 3 s including strategy dispatch | Pino timing |
| NF-Phase3-03 | Phase 3 integration test wall-clock | < 30 s for 10 synthetic contracts | Vitest timing |
| NF-Phase3-04 | ConfidenceScorer overhead per call | < 1 ms (pure arithmetic) | manual benchmark |

---

## Key Entities

- **`ActionContract`** (NEW shared) — every browse action's pre/post-condition declaration. See impact.md.
- **`VerifyStrategy`** (NEW shared interface) — uniform shape for all 9 strategies (3 MVP + 6 v1.1).
- **`VerifyResult`** — `{ ok: boolean, strategy: string, evidence?: unknown, error?: string }`.
- **`VerifyEngine`** (NEW shared) — orchestrator + strategy registry; consumed by Phase 5 Browse MVP nodes.
- **`FailureClassifier`** (NEW shared) — typed failures for routing.
- **`ConfidenceScorer`** (NEW shared) — multiplicative-only confidence math.

---

## Success Criteria

- **SC-001:** Phase 3 integration test green; all 10 synthetic contracts route correctly.
- **SC-002:** No additive math on confidence anywhere in `verification/` source (grep + conformance test verify).
- **SC-003:** `VerifyEngine.registerStrategy('no_captcha', impl)` (a v1.1 strategy) lands without engine code changes — forward-compat seam holds.
- **SC-004:** Phase 5 Browse MVP can wire `VerifyEngine.verify(contract, session)` into every action node without modifying Phase 3 code.

---

## Constitution Alignment Check

- [x] No conversion-rate predictions (R5.3) — N/A
- [x] No auto-publish (F-016) — N/A
- [x] No UPDATE/DELETE on append-only tables (R7.4) — N/A
- [x] No vendor SDK imports outside adapters (R9) — Phase 1's BrowserEngine boundary preserved; no new SDK in Phase 3
- [x] No temperature > 0 (R10) — no LLM calls
- [x] No heuristic content exposed (R6) — no heuristics
- [x] DOES include conformance tests for every AC-NN — 10 conformance test files
- [x] DOES carry frontmatter delta block — see frontmatter
- [x] DOES define kill criteria — default block in tasks.md; T064 ConfidenceScorer carries explicit kill criteria for additive-math detection
- [x] DOES reference REQ-IDs — REQ-VERIFY-* + R4.4 codified
- [x] DOES include impact.md — required by R20 (5 new shared contracts)
- [x] R4.2 Verify everything — VerifyEngine is the runtime enforcement
- [x] R4.4 Multiplicative decay — codified in ConfidenceScorer; additive math is an R23 kill trigger

---

## Out of Scope

- 6 v1.1-deferred strategies (T056-T061): network_request, no_error_banner, snapshot_diff, custom_js, no_captcha, no_bot_block
- LLM-based verification (e.g., LLM judges screenshot) — not in MVP per R5.2 (grounding is deterministic code)
- Cross-action confidence aggregation across an entire audit — Phase 5 (orchestrator-level)
- LangGraph node integration — Phase 5
- Drizzle persistence for verify results — Phase 4 (audit_events writes)
- Findings confidence (different model — Phase 7 4D scoring)

---

## Assumptions

- **3 MVP strategies cover 80%+ of Phase 5 Browse MVP needs.** The 3 chosen (url_change, element_appears, element_text) are the most fundamental for navigation, click, and typing actions respectively. v1.1 advanced strategies fill remaining 20%.
- **No analytical verification in MVP** — ConfidenceScorer is browse-action confidence (R4.4), separate from Phase 7 finding confidence (4D scoring per architecture.md).
- **VerifyEngine forward-compat seam:** the v1.1-deferred strategy names are registered as a "known but not implemented" enum so registration of v1.1 implementations later doesn't require an enum change.
- **`bot_detected_likely` is pre-positioned** in FailureClassifier even though v1.1's `no_bot_block` strategy is what would actually populate it. Pre-positioning avoids a Phase 3 → v1.1 enum change.
- **MutationMonitor reuse from Phase 1** — `element_appears` strategy delegates DOM-stability waiting to Phase 1's MutationMonitor (avoids duplication).

---

## Next Steps

1. impact.md authored (R20 — 5 contracts).
2. plan.md drafted.
3. tasks.md drafted (9 MVP tasks).
4. /speckit.analyze (Explore subagent).
5. Phase 3 implementation in a separate session.

---

## Cross-references

- Phase 1 spec, impact (BrowserEngine + MutationMonitor consumed)
- Phase 2 spec (Phase 5 will sequence Phase 2 tools through Phase 3 verify)
- `docs/specs/mvp/tasks-v2.md` v2.3.2 T051-T065
- `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` REQ-VERIFY-*
- `docs/specs/mvp/constitution.md` R4.2, R4.4, R9, R20, R23

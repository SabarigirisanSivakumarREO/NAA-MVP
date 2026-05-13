---
title: Phase 3 Rollup — Current System State
artifact_type: rollup
status: approved
version: 1.0
phase_number: 3
phase_name: Verification & Confidence (thin)
phase_completed_on: 2026-05-14
created: 2026-05-14
updated: 2026-05-14
owner: engineering lead
authors: [Claude (master orchestrator session 19)]
reviewers: [Sabari (Gate 2 stamped 2026-05-14)]
supersedes: phase-2-tools/phase-2-current.md
supersededBy: null
derived_from:
  - docs/specs/mvp/phases/phase-3-verification/spec.md v0.3
  - docs/specs/mvp/phases/phase-3-verification/plan.md v0.3
  - docs/specs/mvp/phases/phase-3-verification/tasks.md v0.3
  - docs/specs/mvp/phases/phase-3-verification/impact.md v0.2 (5 NEW shared contracts; MEDIUM risk; breaking:false)
  - docs/specs/AI_Browser_Agent_Architecture_v3.1.md REQ-VERIFY-*
req_ids:
  - REQ-VERIFY-001
  - REQ-VERIFY-002
  - REQ-VERIFY-003
  - REQ-VERIFY-CONFIDENCE-001
  - REQ-VERIFY-FAILURE-001
delta:
  new:
    - 5 NEW shared contracts in `packages/agent-core/src/verification/` — ActionContract + VerifyStrategy + VerifyEngine + ConfidenceScorer + FailureClassifier (all additive; locked enums via R20 forward-stability promise)
    - 3 MVP verify strategies (url_change, element_appears, element_text); 6 v1.1 strategies reserved-only (VerifyStrategyName enum slots present; implementations deferred per tasks-v2 v2.3.2)
    - First concrete code-level enforcement of Constitution R4.4 (multiplicative confidence decay) via ConfidenceScorer + source-grep conformance test (`confidence-scorer-no-additive.test.ts`)
    - 3 NEW Pino correlation fields (action_id, verify_strategy, failure_class) registered in `observability/logger.ts` LogBindings
    - Fix-all-spec-defects policy (Session 19) — supersedes Day-0 MED/LOW-never-block; encoded in 3 skill files (neural-ai-reviewer/SKILL.md + correctness-audit.md + neural-master-orchestrator/SKILL.md)
  changed:
    - `observability/logger.ts` extended v0.2.x → v0.3 with 3 NEW Phase 3 correlation fields (+21 LOC; R18 append-only)
    - README.md status line bumped Phase 2 → Phase 3 + 8-step validate runbook + `pnpm -F @neural/agent-core test integration/phase3` validator
  impacted:
    - Phase 4 SafetyCheck (T066) — consumes FailureClassifier + FailureClass enum (5 classes LOCKED); pre-positioned bot_detected_likely for v1.1 no_bot_block strategy
    - Phase 5 BrowseNode — primary consumer of full Phase 3 surface (ActionContract, VerifyEngine, ConfidenceScorer, FailureClassifier + 3 MVP strategy classes); MUST adapter-bridge MutationSettleWaiter ↔ Phase 1 waitForSettle real signature (see §5 Open Risks)
    - Phase 7 grounding rules — NOT consumed by Phase 3 (different concern; Phase 7 has its own 4D scoring); Phase 3 ConfidenceScorer is browse-action-confidence only
  unchanged:
    - Phase 1 conformance suite (browser-manager, context-assembler, accessibility-extractor, hard-filter, soft-filter, mutation-monitor, screenshot-extractor, stealth-config, perception-types) — ZERO regression across 16-commit Phase 3 development
    - Phase 1b 10-extractor conformance (PricingExtractor, AttentionScorer, ClickTargetSizer, CommerceBlockExtractor, CurrencySwitcherDetector, FrictionScorer, MicrocopyTagger, PopupPresenceDetector, SocialProofDepth, StickyElementDetector)
    - Phase 1c PerceptionBundle envelope + 4 closed Zod enums
    - Phase 2 MCP surface (29 tools: 22 browser_* + 2 agent_* + 5 page_*); AnalyzePerception v2.3 schema; DomainRateLimiter
    - Walking-skeleton path (apps/cli/src/commands/audit.ts) — still uses Phase 0/1 BrowserManager.capture() fixture stub; R20 supersession deferred to Phase 5
governing_rules:
  - Constitution R19 (Rollup per Phase)
  - Constitution R17 (Lifecycle — approved → verified bumped 2026-05-14 at Stage 4 exit)
  - Constitution R20 (Impact Analysis — impact.md v0.2; 5 NEW additive contracts)
  - Constitution R9 (Adapter Pattern — VerifyEngine IS the strategy registry adapter)
  - Constitution R4.2 (Verify everything) — VerifyEngine is the runtime enforcement
  - Constitution R4.4 (Multiplicative confidence decay) — ConfidenceScorer first concrete code-level enforcement
  - Constitution R18 (Append-only delta) — every Stage-1+Stage-4 artifact patch added delta blocks; zero retroactive line removals
  - Constitution R23 (Kill Criteria) — T064 extended kill criteria all honored; no MVP whitelist on VerifyEngine.register(); no additive math
---

# Phase 3 — Verification & Confidence (thin) — Current System State Rollup

> **Summary (~200 tokens):** Phase 3 ships a thin verification layer for browse-mode actions: every Phase 5 BrowseNode action will emit an `ActionContract`, dispatch through `VerifyEngine` (registry of 9-name-locked strategies; 3 MVP impls + 6 v1.1 reserved), aggregate failures, classify via `FailureClassifier` (5-class taxonomy + pre-positioned bot_detected_likely), and decay session confidence via `ConfidenceScorer` (multiplicative-only per R4.4; constructor-validated factor bounds). 9 ACs all GREEN (81 new tests + zero regression). R4.4 enforcement is structural — source-grep conformance test fails on any additive pattern in ConfidenceScorer.ts. AC-06 forward-compat seam verified clean: VerifyEngine.register() has no MVP whitelist; all 6 v1.1 reserved names register without engine code change.

> **Governed by:** Constitution R19. Rollup size cap: 300 lines / ~3000 tokens.

---

## 1. Active modules introduced this phase

| Module | Path | Purpose | Tests |
|---|---|---|---|
| `ActionContractSchema` + `VerifyResultSchema` + `AggregatedVerifyResultSchema` | `packages/agent-core/src/verification/types.ts` (259 LOC after T063 extension) | T051 + T063 — Zod schemas + TS types for verify pipeline contracts; `.strict()` top-level; discriminated union on `expected.kind` (urlMatches / elementAppears / elementText) | `tests/conformance/action-contract.test.ts` (AC-01 8/8) |
| `VerifyStrategy` interface + `VerifyStrategyNames` enum + `VerifyStrategyName` type | (same file) | T052 — 9-name locked enum (3 MVP + 6 v1.1 reserved); interface contract for strategies; forward-compat seam | `tests/conformance/verify-strategy.test.ts` (AC-02 6/6) |
| `FailureClass` + `FailureClassification` + `ClassifyInput` types | (same file) | T063 (appended to types.ts at landing) — 5-class taxonomy LOCKED; new classes require fresh impact.md cycle per R20 | (consumed by FailureClassifier tests) |
| `UrlChangeStrategy` | `packages/agent-core/src/verification/strategies/UrlChangeStrategy.ts` (94 LOC) | T053 — name=`url_change`, priority=100; string urlMatches = strict equality (`===`); RegExp = pattern match | `tests/conformance/verify-url-change.test.ts` (AC-03 9/9) |
| `ElementAppearsStrategy` + `MutationSettleWaiter` interface | `packages/agent-core/src/verification/strategies/ElementAppearsStrategy.ts` (146 LOC) | T054 — name=`element_appears`, priority=80; **two-timer semantics**: contract.expected.timeoutMs is SINGLE shared ceiling; MutationMonitor settle = precondition gate; 3-criterion visibility check (querySelector + boundingBox dims + computed style) | `tests/conformance/verify-element-appears.test.ts` (AC-04 10/10 — incl. F-04 closure for height:0 case) |
| `ElementTextStrategy` | `packages/agent-core/src/verification/strategies/ElementTextStrategy.ts` (94 LOC) | T055 — name=`element_text`, priority=70; **form-field dispatch**: `<input>`/`<textarea>`/`<select>` read `.value`; non-input reads `.textContent`; string text = substring case-sensitive; RegExp = pattern | `tests/conformance/verify-element-text.test.ts` (AC-05 11/11) |
| `VerifyEngine` | `packages/agent-core/src/verification/VerifyEngine.ts` (145 LOC) | T062 — Map-based registry keyed by VerifyStrategyName; `register()` has NO MVP whitelist (forward-compat seam); `verify()` filters by applicable() + sorts priority desc + first-success-wins | `tests/conformance/verify-engine.test.ts` (AC-06 7/7) |
| `FailureClassifier` | `packages/agent-core/src/verification/FailureClassifier.ts` (183 LOC) | T063 — pure `classify(input)` method; maps `AggregatedVerifyResult | {kind:'safety'|'rate'}` → `FailureClassification`; subclass routing for navigation_did_not_complete / dom_unstable / visibility_criterion_{a,b,c} / text_mismatch / etc. | `tests/conformance/failure-classifier.test.ts` (AC-07 7/7) |
| `ConfidenceScorer` + `ConfidenceScorerConfig` | `packages/agent-core/src/verification/ConfidenceScorer.ts` (65 LOC) | T064 — **R4.4 enforcement**: afterFailure(c) = `c * 0.97`; afterSuccess(c) = `Math.min(1, c * 1.01)`; belowFloor(c) = `c < 0.10`. Constructor throws RangeError on factor bounds violations. **NEVER additive** — source-grep conformance test verifies | `tests/conformance/confidence-scorer.test.ts` (AC-08 runtime 7 + ctor bounds 6 = 13/13); `tests/conformance/confidence-scorer-no-additive.test.ts` (1/1 source-grep) |
| `verification/index.ts` barrel | `packages/agent-core/src/verification/index.ts` (24 LOC after F-01 closure) | Re-exports all 5 shared contracts + 3 strategy classes + MutationSettleWaiter interface for Phase 4/5 consumers (per impact.md §Forward Contract) | (consumed at integration test + future Phase 5) |
| `observability/logger.ts` extension | `packages/agent-core/src/observability/logger.ts` (155 LOC; +21 LOC) | T-PHASE3-LOGGER — adds Phase 3 (verification) section to LogBindings registry + docstring: `action_id` / `verify_strategy` / `failure_class` | (consumed by VerifyEngine + FailureClassifier + strategies) |

**Test scaffolding (Wave 1):** 9 conformance test files + 1 integration test file authored RED at commit `eca726d` (T-PHASE3-TESTS); 74 RED tests driven GREEN across Waves 2-6.

**Integration test (Wave 6):** `tests/integration/phase3.test.ts` (249 LOC) — AC-09 gate; 9/9 tests; 10 synthetic contracts (3 success + 3 verify_failed + 2 rate_limited + 2 safety_blocked) end-to-end; confidence trend `0.97^7 ≈ 0.808` verified; wall-clock 10 ms (3 orders of magnitude under NF-Phase3-03 30 s budget).

---

## 2. Data contracts now in effect

| Contract | Location | Spec | Notes |
|---|---|---|---|
| `ActionContractSchema` (Zod) | `packages/agent-core/src/verification/types.ts` | spec.md AC-01 + impact.md v0.2 §ActionContract | `.strict()`; discriminated union on `expected.kind` (urlMatches / elementAppears / elementText); `type` is `z.string()` (Phase 5 owns concrete enum); `target` is `z.unknown().optional()` (tool-specific); `candidateStrategies: z.array(z.string())` priority-ordered |
| `VerifyResultSchema` + `AggregatedVerifyResultSchema` (Zod) | (same file) | spec.md AC-02 + impact.md §VerifyEngine | VerifyResult includes optional `unstable`/`timedOut`/`failedCriterion` for two-timer semantics; AggregatedVerifyResult is a discriminated union on `ok:true|false` |
| `VerifyStrategy` interface + `VerifyStrategyNames` (9-entry enum) | (same file) | spec.md R-02 + impact.md §VerifyStrategy | **9 names LOCKED per forward-stability promise**: 3 MVP (url_change, element_appears, element_text) + 6 v1.1 reserved (network_request, no_error_banner, snapshot_diff, custom_js, no_captcha, no_bot_block); new names require fresh impact.md cycle |
| `FailureClass` + `FailureClassification` + `ClassifyInput` types | (same file) | spec.md AC-07 + impact.md §FailureClassifier | **5-class enum LOCKED**: verify_failed, safety_blocked, rate_limited, unverifiable, bot_detected_likely (last pre-positioned for v1.1 no_bot_block); `subclass: string` is free-form per class; `shouldRetry: boolean` drives orchestrator routing |
| `ConfidenceScorerConfig` interface | `packages/agent-core/src/verification/ConfidenceScorer.ts` | spec.md AC-08 + plan.md v0.3 Phase 1 Design item 4 | `failureFactor` ∈ (0, 1) — default 0.97; `successFactor` ≥ 1 — default 1.01 (1 = no rebound, allowed); `floor` — default 0.10; constructor throws RangeError on bounds violation |
| LogBindings extension (3 NEW fields) | `packages/agent-core/src/observability/logger.ts` | spec.md AC-09 + REQ-VERIFY-FAILURE-001 | Phase 3 section appended after Phase 2 fields: `action_id` (per-ActionContract dispatch UUID); `verify_strategy` (strategy name per attempt); `failure_class` (classifier output class) |

---

## 3. System flows now operational

### Flow: Verify-after-action pipeline (R4.2 structural enforcement)

**Trigger:** Future Phase 5 BrowseNode executes any browse action (navigate / click / type / etc.) and emits an `ActionContract { id, type, expected, candidateStrategies }`.
**Steps:**
1. BrowseNode calls `await engine.verify(contract, session)`.
2. VerifyEngine resolves contract.candidateStrategies (string[]) → VerifyStrategy[] via internal Map; filters by `applicable(contract)`; sorts by `priority` desc.
3. For each candidate in priority order: calls `await strategy.verify(contract, session)`; if `ok:true`, returns aggregated success with prior failures array.
4. If all candidates fail: returns aggregated failure with attemptedStrategies + failures.
5. BrowseNode (or downstream orchestrator) feeds aggregated result into `classifier.classify(result)` to get typed FailureClassification.
6. Classification drives routing: shouldRetry → retry; shouldRetry=false → escalate/replan; class='unverifiable' → HITL.
7. Per failed attempt, BrowseNode calls `scorer.afterFailure(confidence)` to decay session confidence multiplicatively.
**Output:** `AggregatedVerifyResult` + `FailureClassification` + decayed `confidence` for orchestrator-level routing.
**Spec:** AC-06 + R4.2 + REQ-VERIFY-002.

### Flow: Two-timer ElementAppearsStrategy (F05 closure — v0.3)

**Trigger:** Engine dispatches `element_appears` strategy with contract `{expected: {kind:'elementAppears', selector, timeoutMs:10000}}`.
**Steps:**
1. Strategy invokes `await mutationWaiter.waitForSettle({ page, timeoutMs: contract.expected.timeoutMs })` — SINGLE shared ceiling.
2. If MutationMonitor returns `{stable: false, unstable: true}` → strategy returns `{ok:false, unstable:true}` IMMEDIATELY (no visibility check).
3. Otherwise, strategy invokes `session.page.evaluate(PROBE_SCRIPT)` to fetch `{present, boundingBox, computedStyle}` in one round-trip.
4. Strategy runs 3 criterion predicates: (a) `present === true`; (b) `boundingBox.width > 0 && boundingBox.height > 0`; (c) `visibility !== 'hidden' && display !== 'none' && opacity > 0`.
5. First criterion to fail short-circuits with `{ok:false, failedCriterion:'a'|'b'|'c', evidence}`.
6. All 3 pass → `{ok:true, evidence:{boundingBox, computedStyle}}`.
**Output:** VerifyResult with diagnostic granularity.
**Spec:** AC-04 + edge case "ElementAppearsStrategy two-timer semantics" + plan.md v0.3 Phase 1 Design.

### Flow: Multiplicative confidence decay (R4.4 — first concrete enforcement)

**Trigger:** Phase 5 BrowseNode passes any failed verify result to ConfidenceScorer.
**Steps:**
1. Constructor (one-time per session): validates `failureFactor ∈ (0, 1)` AND `successFactor ≥ 1`; throws RangeError if not.
2. Per failed verify: `confidence = scorer.afterFailure(confidence)` → multiplicative `confidence * 0.97`.
3. Per successful verify: `confidence = scorer.afterSuccess(confidence)` → `Math.min(1, confidence * 1.01)` with mild rebound clamped at 1.
4. Floor check: `scorer.belowFloor(confidence)` returns true if `< 0.10` → orchestrator escalates per spec edge case.
**Output:** New confidence ∈ (0, 1]; bounded by multiplicative arithmetic (additive accumulates unbounded — see R4.4 retroactive audit 2026-04-24).
**Spec:** AC-08 + Constitution R4.4 + REQ-VERIFY-CONFIDENCE-001. **Source-grep test:** zero `c -= X`, `c += X`, `current - X`, `confidence + X` patterns in non-comment lines of ConfidenceScorer.ts.

---

## 4. Known limitations carried forward

| Limitation | Phase to resolve | Workaround in place |
|---|---|---|
| 6 advanced verify strategies deferred (network_request, no_error_banner, snapshot_diff, custom_js, no_captcha, no_bot_block) | v1.1 backlog per tasks-v2 v2.3.2 | VerifyStrategyName enum reserves all 6 slots; v1.1 implementations register via existing `engine.register()` without engine code change (forward-compat seam verified) |
| MVP verify strategies are deterministic-only — no LLM-judged verification (e.g., screenshot-OK-judge) | v1.1 backlog | R5.2 grounding-as-deterministic-code precedent applied; LLM verification is a Phase 7+ concern (different model) |
| No DB persistence of verify outcomes (no audit_events writes) | Phase 4 (audit_events R7.4 append-only) | Phase 3 returns typed results; Phase 5 BrowseNode + Phase 8 orchestrator handle persistence |
| Cross-action confidence aggregation across an entire audit not yet implemented | Phase 5 + Phase 8 | ConfidenceScorer is per-session/per-action confidence (R4.4); Phase 8 orchestrator-level aggregation is a different concern |
| No LangGraph node wiring | Phase 5 (BrowseNode) | VerifyEngine + strategies are pure adapters; Phase 5 wires them into action nodes |
| Findings confidence is a DIFFERENT model | Phase 7 4D scoring | Phase 3 ConfidenceScorer is browse-action-confidence (R4.4); Phase 7 has its own 4D finding scoring per architecture.md |

---

## 5. Open risks for next phase

| Risk | Impact | Owner | Mitigation |
|---|---|---|---|
| **(Stage 2.5 F-02 closure)** `MutationSettleWaiter` interface diverges from Phase 1's real `waitForSettle(page, opts) → {elapsed_ms, capped_at_5s}` signature (perception/SettlePredicate.ts:107). The strategy expects `waitForSettle({page, timeoutMs}) → {stable, unstable?}`. impact.md L80 ("Phase 1 MutationMonitor is consumed") is technically correct (no Phase 1 mods) but Phase 5 BrowseNode MUST write an adapter shim to bridge the two shapes. | Multi-tab flows + element_appears flows in Phase 5 misroute if shim missing | Phase 5 BrowseNode lead | Add a 1-file adapter (e.g., `verification/MutationSettleAdapter.ts`) wrapping Phase 1's waitForSettle into the MutationSettleWaiter shape; integration test exercises end-to-end. Defensible design choice — allows clean stub injection in tests. |
| Phase 5 BrowseNode caches `session.page` reference at handler-construction time, breaking multi-tab transparency (Phase 2 dynamic-getter contract from Phase 2 v0.2.7) | Multi-tab BrowseNode + strategy invocation misroutes to dead tab reference | Phase 5 BrowseNode lead | Phase 2 phase-2-current.md §4 documents the dynamic-getter contract; Phase 3 strategies already honor by reading `session.page` at verify() invocation time |
| Phase 4 SafetyCheck (T066) consumes FailureClassifier with `kind:'safety'` shape; LOCKED 5-class enum means new classes require fresh impact.md cycle | New failure modes discovered in Phase 4-9 require coordinated enum extension | engineering lead | Forward-stability promise documented in impact.md v0.2; bot_detected_likely pre-positioned shows the pattern |
| ActionContract.type as `z.string()` is open-ended — Phase 5 BrowseNode must decide whether to (a) close to a concrete enum of 24 tool names, or (b) keep open for v1.2+ flexibility | Phase 5 implementer ambiguity → potential drift | Phase 5 BrowseNode lead | impact.md v0.2 comment explicitly delegates: "Phase 5 BrowseNode owns concrete enum closure against Phase 2's 22 browser_* + 2 agent_* tools" |
| ConfidenceScorer default 0.97/1.01 factors are spec-locked defaults; v1.1+ tuning may need calibration | If pilot deployments show too-rapid or too-slow decay, factors will require empirical tuning | v1.1 lead | Constructor accepts config; tuning is per-deployment config-only (no code change); bounds validation prevents subtle additive-mimicking values |
| Stage 2.5 LOW pure_cosmetic findings (F-03 + F-05 + F-06) deferred to v1.1 routine refactor — VerifyEngine.ts type-cast laxity, ElementAppearsStrategy.ts redundant OR, FailureClassifier.ts redundant type narrowing | Code quality slightly below pristine; no behavior impact | v1.1 lead | Tracked in `.phase-state/3/code-review-findings.yaml`; cosmetic only |

---

## 6. Conformance gate status (at phase exit — 2026-05-14)

| Test | AC | Status | Last run |
|---|---|---|---|
| `tests/conformance/action-contract.test.ts` | AC-01 | ✅ green (8/8) | 2026-05-14 |
| `tests/conformance/verify-strategy.test.ts` | AC-02 | ✅ green (6/6) | 2026-05-14 |
| `tests/conformance/verify-url-change.test.ts` | AC-03 | ✅ green (9/9) | 2026-05-14 |
| `tests/conformance/verify-element-appears.test.ts` | AC-04 | ✅ green (10/10 — incl. Stage 2.5 F-04 height:0 closure) | 2026-05-14 |
| `tests/conformance/verify-element-text.test.ts` | AC-05 | ✅ green (11/11) | 2026-05-14 |
| `tests/conformance/verify-engine.test.ts` | AC-06 | ✅ green (7/7 — forward-compat verified across all 6 v1.1 reserved names) | 2026-05-14 |
| `tests/conformance/failure-classifier.test.ts` | AC-07 | ✅ green (7/7) | 2026-05-14 |
| `tests/conformance/confidence-scorer.test.ts` | AC-08 runtime + bounds | ✅ green (13/13) | 2026-05-14 |
| `tests/conformance/confidence-scorer-no-additive.test.ts` | AC-08 source-grep | ✅ green (1/1; R4.4 enforcement) | 2026-05-14 |
| `tests/integration/phase3.test.ts` | AC-09 | ✅ green (9/9; 10 contracts; confidence trend 0.97^7 verified; wall-clock 10 ms) | 2026-05-14 |
| Phase 1 + 1b + 1c + 2 conformance (regression) | — | ✅ green (zero regression across 16-commit Phase 3 delta) | 2026-05-14 |
| `pnpm typecheck` | — | ✅ clean (3/3 packages) | 2026-05-14 |
| `pnpm lint` | — | ✅ clean (Phase 4 stub) | 2026-05-14 |
| `pnpm test:integration` (Playwright acceptance) | — | ✅ green (12/12; phase-0-setup 5 + walking-skeleton 7) | 2026-05-14 |

---

## 7. What Phase 4 (or Phase 5) should read

When Phase 4 starts (next per INDEX.md dependency order), the recommended reading order is:

1. **This file** (`phase-3-verification/phase-3-current.md`) — YOU ARE HERE
2. `phase-3-validation.md` (sibling — ASCII diagrams + spot-checks for ~20-min trust calibration)
3. `docs/specs/mvp/phases/phase-4-safety-infra-cost/README.md` (when authored)
4. `docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md`
5. `packages/agent-core/src/verification/index.ts` (barrel — public surface)
6. `packages/agent-core/src/verification/FailureClassifier.ts` (T066 SafetyCheck consumes FailureClass + classify())
7. `docs/specs/mvp/phases/phase-3-verification/impact.md` v0.2 (Forward Contract section)

When Phase 5 starts (after Phase 4):

1. This file + phase-3-validation.md
2. `phase-3-verification/impact.md` v0.2 §Forward Contract — Phase 5 import patterns
3. **Stage 2.5 F-02 closure note in §5 above** — Phase 5 MUST write an adapter shim for `MutationSettleWaiter ↔ Phase 1 waitForSettle` before invoking ElementAppearsStrategy on a real BrowserSession

Do NOT load all Phase 3 artifacts. The compression is intentional. Shared contracts (`ActionContract`, `VerifyEngine`, `ConfidenceScorer`, `FailureClassifier`, 3 strategy classes, `MutationSettleWaiter` interface) live in `packages/agent-core/src/verification/*.ts` — read those files directly.

---

## 8. Cost + time summary (this phase)

| Metric | Target | Actual |
|---|---|---|
| Duration (sessions) | 1-2 sessions (planned) | 1 session 2026-05-13 → 2026-05-14 (~4 hr wall-clock; Gate 1 3-pass + Stage 2 7 waves + Stage 2.5 + Stage 3 + Stage 3b + Stage 4) |
| Tasks completed | 13 task units (9 MVP impl + 2 setup + 2 polish; T056-T061 deferred to v1.1) | 13/13 ✅ + 1 Stage 2.5 follow-up patch (F-01 + F-04 closure) |
| LLM spend total | $60 user-approved per-phase ceiling | ~$5.30 (Gate 1 + 8 subagents + Stage 2.5 + Stage 3b + Stage 4 authoring) |
| Phase 3 commits | (no target) | 16 commits on `feat/phase-3-verification` since branch cut at master `d3933ad` |
| Net LOC delta | (no target) | sources ~1,025 (8 source files) + tests ~1,479 (10 test files + extension) + spec/plan/tasks/impact patches (~150) + Stage 4 docs (this file + validation; ~700) |
| Test count delta | (no target) | +81 net new tests (493 Phase 2 baseline → 574 at phase exit; zero regression) |

---

*End of phase-3-current.md. Sibling: phase-3-validation.md (5 ASCII proof sections + 5 spot-check entries).*

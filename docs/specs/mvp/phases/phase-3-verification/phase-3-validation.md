---
title: Phase 3 Validation — Verification & Confidence (thin)
artifact_type: validation
status: implemented
version: 1.0
phase_number: 3
phase_name: Verification & Confidence (thin)
phase_completed_on: 2026-05-14
created: 2026-05-14
updated: 2026-05-14
owner: engineering lead
authors: [Claude (master orchestrator session 19)]
reviewers: [Sabari]
supersedes: null
supersededBy: null
derived_from:
  - docs/specs/mvp/phases/phase-3-verification/spec.md v0.3
  - docs/specs/mvp/phases/phase-3-verification/tasks.md v0.3
  - docs/specs/mvp/phases/phase-3-verification/phase-3-current.md v1.0
  - .phase-state/3/code-review-findings.yaml (Stage 2.5 verdict)
  - .phase-state/3/verify-test-results.json (Stage 3 empirical)
  - .phase-state/3/verify-verdict.yaml (Stage 3b Gate 2 verdict)
governing_rules:
  - Constitution R19 (Rollup per Phase) — sibling artifact pair with phase-3-current.md
  - CLAUDE.md §8c (Per-phase artifact maintenance)
---

# Phase 3 — Verification & Confidence — Validation

> **Purpose (~150 tokens):** AI-built code creates a comprehension gap. The phase rollup tells you *what was built*; this file tells you *how it fits together* in 5 ASCII-shaped artifacts a human can verify with eyes alone in ~20 minutes. Read AFTER `phase-3-current.md` but BEFORE diving into the spec corpus or src files. Each section is self-checkable: pick one node/edge in a diagram, open the corresponding file at the cited line, and confirm "yes that matches." Three confirmations = trust the diagram.

> **Governed by:** Constitution R19 (rollup partnership). Authored at master orchestrator Stage 4 exit; sibling to `phase-3-current.md`. HEAD at authoring: post Gate 2 stamp 2026-05-14.

---

## §1 Module dependency graph

ASCII import graph for src files introduced this phase. Direction: arrow points from importer to imported. Helps catch accidental cross-layer coupling.

**Conventions:**
- `┌─┐` boxes are modules (one per file)
- Solid arrows `─►` are runtime imports
- Dashed arrows `--►` are type-only imports
- `█` boundary marker = R9 adapter boundary

```
  Phase 3 module graph (no R9 boundaries introduced — Phase 3 has no external SDK
                        imports; consumes Phase 1's BrowserEngine adapter):

  verification/
    types.ts ◄─────────────────────────────── (all of below import types)
       │   exports: ActionContractSchema, VerifyResultSchema,
       │            AggregatedVerifyResultSchema, ExpectedSchema (+ 3 variants),
       │            VerifyStrategy interface, VerifyStrategyNames + VerifyStrategyName,
       │            FailureClass, FailureClassification, ClassifyInput
       │   --► adapters/BrowserEngine.ts (type-only — BrowserSession)
       ▲
       │
       ├──── strategies/UrlChangeStrategy.ts
       │        │   implements VerifyStrategy (name='url_change', priority=100)
       │        │   --► adapters/BrowserEngine.ts (BrowserSession type)
       │        │   --► pino (Logger type — optional ctor injection)
       │
       ├──── strategies/ElementAppearsStrategy.ts
       │        │   implements VerifyStrategy (name='element_appears', priority=80)
       │        │   defines + exports MutationSettleWaiter interface (narrow wrapper)
       │        │   --► adapters/BrowserEngine.ts (BrowserSession type)
       │        │   uses string-literal probe (no `dom` lib needed at TS layer)
       │
       ├──── strategies/ElementTextStrategy.ts
       │        │   implements VerifyStrategy (name='element_text', priority=70)
       │        │   exports isFormField() + extractText() predicates
       │        │   --► adapters/BrowserEngine.ts (BrowserSession type)
       │
       ├──── VerifyEngine.ts
       │        │   Map<VerifyStrategyName, VerifyStrategy> registry
       │        │   register() — no whitelist (forward-compat seam)
       │        │   verify() — applicable() filter + priority-desc sort + first-success-wins
       │        │   --► adapters/BrowserEngine.ts (BrowserSession type)
       │        │   --► observability/logger.ts (Logger + LogBindings)
       │
       ├──── FailureClassifier.ts
       │        │   pure classify(input) method
       │        │   isAggregated() type predicate for narrowing
       │        │   --► observability/logger.ts (Logger + LogBindings)
       │
       ├──── ConfidenceScorer.ts ████ R4.4 ENFORCEMENT BOUNDARY ████
       │        │   constructor throws RangeError on factor bounds violation
       │        │   afterFailure / afterSuccess / belowFloor — multiplicative ONLY
       │        │   (live code uses ONLY * and < operators on confidence)
       │        │   (no imports needed — pure arithmetic; no logger)
       │
       └──── index.ts (barrel)
                │   re-exports everything above
                │   Phase 4 + Phase 5 import via this barrel
                ▼
            consumed by:
              Phase 4 SafetyCheck (T066) → FailureClassifier + FailureClass
              Phase 5 BrowseNode → full surface + 3 strategy classes

  observability/
    logger.ts ◄─── extended with 3 NEW LogBindings fields (Phase 3 section)
       │              action_id / verify_strategy / failure_class
       │              (no Phase 3-specific imports; just docstring + type extension)
       ▲
       │
       └─── consumed by: VerifyEngine, FailureClassifier, all 3 strategies
                         (via createChildLogger(parent, bindings) pattern)
```

**Trust check:** open `packages/agent-core/src/verification/VerifyEngine.ts`, grep its `import` block. Confirm 2 edges: `from '../adapters/BrowserEngine.js'` (type) + `from '../observability/logger.js'` (Logger). Repeat for any strategy file — should see `import type { BrowserSession } from '../../adapters/BrowserEngine.js'`. If 2 of 3 match, trust the rest.

---

## §2 Data flow — VerifyEngine.verify() public entry point

ASCII pipeline diagram for the canonical Phase 3 entry point. Shows what gets transformed at each step + what shape passes between stages.

**Conventions:**
- Nouns in `[brackets]` are typed values flowing between steps
- `(async)` annotates an awaited call
- `► event:foo.bar` shows Pino correlation event

```
  ActionContract { id, type, target?, expected, candidateStrategies } ──┐
                                                                          │
                                                                          ▼
            engine.verify(contract, session) (async)
            ► child logger bound: { action_id: contract.id }
                                                                          │
                                                                          ▼
            Step 1 — Resolve candidates:
              contract.candidateStrategies.map(name => strategies.get(name))
              ──► [VerifyStrategy | undefined][]

                                                                          │
                                                                          ▼
            Step 2 — Filter & sort:
              .filter(s => s !== undefined && s.applicable(contract))
              .sort((a, b) => b.priority - a.priority)
              ──► [VerifyStrategy[] (priority-desc, applicable-only)]

                                                                          │
                                                                          ▼
            Step 3 — Empty short-circuit:
              if candidates.length === 0:
                return { ok:false, attemptedStrategies:[], failures:[],
                         reason:'no_applicable_strategy' }                ► event: verify.no_applicable

                                                                          │
                                                                          ▼
            Step 4 — Iterate first-success-wins:
              for (strategy of candidates):
                ► child logger bound: { verify_strategy: strategy.name }
                result = await strategy.verify(contract, session) (async)
                                          ──► [VerifyResult]
                if (result.ok):
                  return { ok:true, strategy:strategy.name, evidence,
                           failures:[prior failed attempts] }              ► event: verify.success
                failures.push(result)

                                                                          │
                                                                          ▼
            Step 5 — All-failed terminus:
              return { ok:false, attemptedStrategies:[<names>],
                       failures:[<all attempted results>] }                ► event: verify.all_failed

  ─────────────────────────────────────────────────────────────────────────

  Downstream pipeline (typically Phase 5 BrowseNode):

  AggregatedVerifyResult ──┐
                            ▼
                       if !result.ok:
                            │
                            ├──► classifier.classify(result)
                            │       ── routes to FailureClassification
                            │       ── ► event: classify.outcome ({failure_class})
                            │
                            ├──► scorer.afterFailure(confidence)
                            │       ── confidence × 0.97 (multiplicative; R4.4)
                            │
                            └──► route per FailureClassification.shouldRetry
                                  (retry / replan / escalate / HITL)
```

**Trust check:** pick `AggregatedVerifyResult`, grep for its definition in `verification/types.ts`. Confirm it's a discriminated union on `ok:true|false`. Then read `VerifyEngine.verify()` body at `VerifyEngine.ts` — confirm Step 3 (empty short-circuit) returns the shape shown above.

---

## §3 Function flow — top-level call graph

ASCII call graph for the most complex orchestrating function: `VerifyEngine.verify()`. One level deep usually suffices.

**Conventions:**
- Indentation = call depth from the entry point
- `[file:line]` cites the call site (approximate; verify with grep)
- `(N×)` annotates loops
- `try/finally` shown as branches
- Skip trivial leaf calls

```
engine.verify(contract, session)                          [VerifyEngine.ts:88-145]
├─ logger.child({ action_id: contract.id })               [VerifyEngine.ts:~95]
├─ Step 1: contract.candidateStrategies.map(...)           [~99]
│   └─ this.strategies.get(name as VerifyStrategyName)     [internal Map lookup]
├─ Step 2: .filter(s => s !== undefined && s.applicable(c)) + .sort
│   └─ strategy.applicable(contract)                       [varies per strategy]
│       UrlChangeStrategy.applicable → c.expected.kind === 'urlMatches'
│       ElementAppearsStrategy.applicable → c.expected.kind === 'elementAppears'
│       ElementTextStrategy.applicable → c.expected.kind === 'elementText'
├─ Step 3: if (candidates.length === 0) return aggregated unverifiable
├─ Step 4: for (strategy of candidates) (N×):
│   ├─ childLogger.child({ verify_strategy: strategy.name })
│   ├─ await strategy.verify(contract, session)
│   │    ┌── UrlChangeStrategy.verify ──┐
│   │    │   ├─ const actualUrl = session.page.url()    [sync]
│   │    │   ├─ if instanceof RegExp: pattern.test(actualUrl)
│   │    │   ├─ else: actualUrl === expected.urlMatches (strict)
│   │    │   └─ return VerifyResult
│   │    └────────────────────────────┘
│   │    ┌── ElementAppearsStrategy.verify ──────────────┐
│   │    │   ├─ await mutationWaiter.waitForSettle({page, timeoutMs}) (async)
│   │    │   │     ── if {stable:false} return {unstable:true} (early exit)
│   │    │   ├─ track elapsed; compute remaining budget
│   │    │   ├─ await session.page.evaluate(PROBE_SCRIPT) (async)
│   │    │   │     ── returns {present, boundingBox, computedStyle}
│   │    │   ├─ criterionA_present(probe) → pass/fail
│   │    │   ├─ criterionB_boundingBox(probe.boundingBox) → pass/fail
│   │    │   ├─ criterionC_computedStyle(probe.computedStyle) → pass/fail
│   │    │   └─ return VerifyResult (with failedCriterion if any fail)
│   │    └─────────────────────────────────────────────┘
│   │    ┌── ElementTextStrategy.verify ────────────────┐
│   │    │   ├─ await session.page.evaluate(PROBE_SCRIPT) (async)
│   │    │   │     ── returns {tagName, value, textContent}
│   │    │   ├─ isFormField(probe.tagName) → boolean
│   │    │   ├─ extractText(probe) → string (.value or .textContent)
│   │    │   ├─ if instanceof RegExp: pattern.test(actual)
│   │    │   ├─ else: actual.includes(expected.text) (substring)
│   │    │   └─ return VerifyResult
│   │    └────────────────────────────────────────────┘
│   ├─ if (result.ok) return aggregated success with prior failures
│   └─ failures.push(result); continue
└─ return aggregated failure with attemptedStrategies + failures
```

**Trust check:** pick `UrlChangeStrategy.verify()`, open `strategies/UrlChangeStrategy.ts`. Confirm the `instanceof RegExp` dispatch comes BEFORE the string-equality dispatch (must — RegExp is `typeof === 'object'` so falls through otherwise). Confirm exact lines exist; if so, trust the strategy-call edges in the diagram.

---

## §4 AC → impl → test traceability matrix

ASCII grid mapping every AC to its impl source file(s) and verifying test file(s) + pass status at phase exit.

**Conventions:**
- ✅ = test green
- ⚠ = green-but-flagged (Stage 2.5 finding)
- ❌ = red (would NOT have stamped Gate 2)
- N/M = N tests pass of M total

```
┌──────┬──────────────────────────────────────────────┬──────────────────────────────────────────────────────┬──────────┬────────────────────────────────────────────┐
│ AC   │ Implementation file                          │ Test file                                            │ Status   │ Notes                                      │
├──────┼──────────────────────────────────────────────┼──────────────────────────────────────────────────────┼──────────┼────────────────────────────────────────────┤
│ AC-01│ verification/types.ts (ActionContractSchema +│ tests/conformance/action-contract.test.ts            │ ✅ 8/8   │ —                                          │
│      │   VerifyResult + AggregatedVerifyResult)     │                                                      │          │                                            │
│ AC-02│ verification/types.ts (VerifyStrategy +      │ tests/conformance/verify-strategy.test.ts            │ ✅ 6/6   │ 9-name enum locked per forward-stability   │
│      │   VerifyStrategyNames)                       │                                                      │          │                                            │
│ AC-03│ verification/strategies/UrlChangeStrategy.ts │ tests/conformance/verify-url-change.test.ts          │ ✅ 9/9   │ String strict-eq + RegExp pattern verified │
│ AC-04│ verification/strategies/ElementAppearsStrate │ tests/conformance/verify-element-appears.test.ts     │ ✅ 10/10 │ F-04 closure added height:0 case (Stage 2.5)│
│      │   gy.ts                                      │                                                      │          │                                            │
│ AC-05│ verification/strategies/ElementTextStrategy. │ tests/conformance/verify-element-text.test.ts        │ ✅ 11/11 │ Form-field dispatch + substring/RegExp     │
│      │   ts                                         │                                                      │          │                                            │
│ AC-06│ verification/VerifyEngine.ts                 │ tests/conformance/verify-engine.test.ts              │ ✅ 7/7   │ Forward-compat seam (all 6 v1.1 names)     │
│ AC-07│ verification/FailureClassifier.ts            │ tests/conformance/failure-classifier.test.ts         │ ✅ 7/7   │ 5 classes + bot_detected_likely (type)     │
│ AC-08│ verification/ConfidenceScorer.ts             │ tests/conformance/confidence-scorer.test.ts          │ ✅ 13/13 │ Runtime math 7 + ctor bounds 6             │
│      │  (R4.4 enforcement)                          │   + tests/conformance/confidence-scorer-no-additive  │ ✅ 1/1   │ Source-grep: zero forbidden patterns       │
│      │                                              │                                                      │          │   in non-comment lines                     │
│ AC-09│ (full Phase 3 surface — integration)         │ tests/integration/phase3.test.ts                     │ ✅ 9/9   │ 10 synthetic contracts; confidence trend   │
│      │                                              │                                                      │          │   0.97^7 ≈ 0.808 verified; wall-clock 10ms │
└──────┴──────────────────────────────────────────────┴──────────────────────────────────────────────────────┴──────────┴────────────────────────────────────────────┘

REQ-ID → AC mapping:
  REQ-VERIFY-001            → AC-01 (ActionContract Zod)
  REQ-VERIFY-002            → AC-02, AC-06 (VerifyStrategy interface + VerifyEngine dispatch)
  REQ-VERIFY-003            → AC-03, AC-04, AC-05 (3 MVP strategies)
  REQ-VERIFY-FAILURE-001    → AC-07 (FailureClassifier 5-class taxonomy)
  REQ-VERIFY-CONFIDENCE-001 → AC-08 (ConfidenceScorer multiplicative R4.4)
```

**Trust check:** run `pnpm spec:matrix --phase=3 --json`. Per `.phase-state/3/preflight-coverage.json`, the AC count = 9. Note: the matrix tool resolves test paths from repo root (not from package root); empirical pass counts come from `.phase-state/3/verify-test-results.json` (authoritative).

---

## §5 Resource cost breakdown — per-strategy verify wall-clock

Phase 3 is verification (per §1 phase-type table). Primary resource: re-run wall-clock per strategy (NF-Phase3-01 target < 2 s on static page; NF-Phase3-02 engine total < 3 s).

```
Per-strategy verify wall-clock — STUB session (integration test, 2026-05-14):
┌──────────────────────────┬───────────┬─────────┬──────────────────────────────┐
│ Strategy                 │ Wall-clock│ NF target│ Notes                       │
├──────────────────────────┼───────────┼─────────┼──────────────────────────────┤
│ UrlChangeStrategy        │ <1 ms     │ <2 s    │ Pure session.page.url() read │
│                          │           │         │ (1000x margin)               │
│ ElementAppearsStrategy   │ ~3 ms     │ <2 s    │ MutationSettleWaiter stub +  │
│                          │           │         │ 1 evaluate() call            │
│ ElementTextStrategy      │ ~1 ms     │ <2 s    │ 1 evaluate() call            │
│ Engine total per contract│ ~5 ms     │ <3 s    │ Strategy iteration + classify│
│                          │           │         │ + scorer overhead            │
│ Integration test (10 ctx)│ 10 ms     │ <30 s   │ All 10 contracts end-to-end  │
│                          │           │         │ (3000x margin per AC-09)     │
└──────────────────────────┴───────────┴─────────┴──────────────────────────────┘

ConfidenceScorer overhead per call:
─── < 1 μs (pure arithmetic; one `*` operation + Math.min) — NF-Phase3-04 holds

Real-network wall-clock (Phase 5 BrowseNode will measure):
─── deferred to Phase 5 — Phase 3 strategies are pure (consume BrowserSession adapter)
─── stub-test execution proves logic correctness; real-network proves NF budgets
─── expected: real Playwright wait + DOM probe adds ~100-500 ms per strategy
─── still well under NF-Phase3-01 2 s + NF-Phase3-02 3 s engine total
```

**Trust check:** open `tests/integration/phase3.test.ts`, look for the `Duration` line in Vitest output. Should show single-digit ms for all 9 tests + ~10 ms total — matches the table above.

---

## §6 Trust calibration — what to spot-check by hand

When a human reviewer has 20 minutes to gain confidence, here are 5 specific files-with-line-numbers where the most error-prone logic lives.

```
1. ConfidenceScorer.ts:32-50 — R4.4 multiplicative enforcement
   Risk: any additive arithmetic on confidence (e.g., `c - 0.05`, `c += 0.01`)
         silently violates Constitution R4.4. Compound failures would
         accumulate unbounded confidence values.
   How to verify: grep this file for `c [+\-]` or `confidence [+\-]` → must
         return ZERO matches in non-comment lines. ONLY `*` operator should
         touch confidence in live code. Comments may use `+`/`-` for prose.
         Constructor bounds check at L40-48 must throw RangeError on
         failureFactor ∉ (0, 1) or successFactor < 1.

2. VerifyEngine.ts:78-80 — register() forward-compat seam (AC-06)
   Risk: a hidden whitelist (e.g., `if (MVP_NAMES.includes(strategy.name))`)
         breaks the v1.1 plug-in promise. Spec AC-06 requires
         `engine.register({name:'no_captcha', ...})` to succeed without
         engine code change.
   How to verify: read the 3-line method body. Must be JUST a single
         `this.strategies.set(strategy.name, strategy)` call. The TS type
         (VerifyStrategy.name: VerifyStrategyName) is the only allowlist.
         No switch(name), no `.includes()`, no `if` guards.

3. ElementAppearsStrategy.ts:~60-100 — two-timer semantics
   Risk: a separate timer for the visibility check (in addition to the
         MutationSettleWaiter's settle timer) would let visibility checks
         run after the contract.expected.timeoutMs deadline.
   How to verify: there should be EXACTLY ONE timeout value flowing
         through (contract.expected.timeoutMs); MutationSettleWaiter
         receives it; after settle returns, remaining-budget tracking
         uses elapsed-since-start vs this same value. No second
         `setTimeout(10_000)` or hardcoded 10s anywhere.

4. UrlChangeStrategy.ts (~L50) — RegExp-vs-string dispatch order
   Risk: if `typeof === 'string'` check runs BEFORE `instanceof RegExp`,
         RegExp inputs fall through to string equality (RegExp.toString()
         === 'https://example.com' → always false). String match never
         fires for RegExp inputs.
   How to verify: read the dispatch — `instanceof RegExp` MUST come FIRST;
         only after that fallthrough, treat as string with strict
         equality (`actualUrl === expected.urlMatches`).

5. FailureClassifier.ts:~100-180 — classify() routing
   Risk: A new strategy added in v1.1 could fall through to the default
         `unknown` subclass silently — the routing has no validation that
         every VerifyStrategyName has a corresponding classify-branch.
   How to verify: read each `if (first?.strategy === 'X')` branch and
         confirm they cover the 3 MVP strategies (url_change,
         element_appears, element_text). For v1.1 strategies (no_captcha,
         network_request, etc.), the default `unknown` subclass is
         acceptable since impact.md forward-stability promise documents
         this. The 5 FailureClass values themselves must be LOCKED at
         the spec-frozen list; any new class needs fresh impact.md cycle.
```

**Trust calibration heuristic:** if 3 of these 5 spot-checks pass, treat the rest of Phase 3 as TRUSTED. If any fail, escalate to a deeper Stage 2.5 re-review.

---

## §7 Open ends linkage

DO NOT duplicate content from `phase-3-current.md`. Cross-link:

```
- Limitations carried forward → phase-3-current.md §4
  (6 advanced strategies deferred; no LLM-judged verification; no DB persistence;
   cross-action confidence aggregation Phase 5+8; LangGraph wiring Phase 5;
   Phase 7 has different 4D finding scoring model)

- Open risks for next phase   → phase-3-current.md §5
  (MutationSettleWaiter ↔ Phase 1 waitForSettle adapter shim — F-02 closure;
   session.page dynamic-getter contract from Phase 2;
   5-class FailureClass enum LOCKED; ActionContract.type Phase-5-owned;
   ConfidenceScorer factor empirical tuning v1.1;
   Stage 2.5 LOW cosmetic findings F-03/F-05/F-06 deferred)

- Stage 2.5 follow-up findings → .phase-state/3/code-review-findings.yaml
  (F-01 + F-04 CLOSED at 5ab011e; F-02 deferred to this rollup §5; F-03/F-05/F-06
   deferred as pure_cosmetic to v1.1 routine refactor)

- Stage 3 empirical results   → .phase-state/3/verify-test-results.json
  (574/574 agent-core; 12/12 acceptance; zero regression vs Phase 2 baseline)

- Stage 3b Gate 2 verdict     → .phase-state/3/verify-verdict.yaml
  (Correctness PASS; Coverage PASS; Completeness PASS for 3 surfaces — APPROVE)
```

---

## §8 How this doc was authored

Master orchestrator Stage 4 exit deliverable, paired with `phase-3-current.md`. ASCII diagrams generated from real impl state at HEAD `5ab011e` (Stage 2.5 follow-up; latest impl commit) after Gate 2 APPROVE stamp by Sabari on 2026-05-14. Subsequent edits should bump version + add a delta block per R18.

> **For future phases:** the master orchestrator skill at `.claude/skills/neural-master-orchestrator/SKILL.md` references the validation template; Stage 4 produces this file alongside the rollup.

---

*End of phase-3-validation.md v1.0. Sibling: phase-3-current.md v1.0 (R19 rollup). Authored 2026-05-14 at master orchestrator Stage 4 exit per CLAUDE.md §8c.*

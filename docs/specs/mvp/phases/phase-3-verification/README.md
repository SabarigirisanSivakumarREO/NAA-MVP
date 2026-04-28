---
title: Phase 3 — Verification & Confidence (thin)
artifact_type: phase-readme
status: approved
version: 1.0
phase_number: 3
phase_name: Verification
created: 2026-04-27
updated: 2026-04-27
owner: engineering lead
req_ids:
  - REQ-VERIFY-001
  - REQ-VERIFY-002
  - REQ-VERIFY-003
  - REQ-VERIFY-CONFIDENCE-001
  - REQ-VERIFY-FAILURE-001
delta:
  new:
    - Phase 3 README — thin verification (3 MVP strategies; 6 deferred to v1.1 per tasks-v2 v2.3.2)
  changed: []
  impacted: []
  unchanged: []
governing_rules:
  - Constitution R4 (Browser Agent Rules — R4.2 verify everything, R4.4 multiplicative confidence)
  - Constitution R9 (Adapter Pattern — VerifyEngine seam for v1.1 strategies)
  - Constitution R17, R19, R20
  - PRD §F-003 (Browser Agent verification surface)
---

# Phase 3 — Verification & Confidence (thin)

> **Summary (~150 tokens):** Thin verification layer for browse-mode actions. **9 MVP tasks** (T051-T055, T062-T065 from tasks-v2 v2.3.2; T056-T061 deferred to v1.1). Defines `ActionContract` (every browse action declares pre/post conditions), `VerifyStrategy` union type, **3 MVP strategies** (`url_change`, `element_appears`, `element_text` — covering 80%+ of Phase 5 Browse MVP verification needs), `VerifyEngine` (mutation-aware orchestrator that runs strategies after each action), `FailureClassifier` (typed failure taxonomy for routing), `ConfidenceScorer` enforcing R4.4 multiplicative decay (`current × 0.97` per failed verify, NOT additive), and a Phase 3 integration test. **6 strategies deferred to v1.1** (network_request, no_error_banner, snapshot_diff, custom_js, no_captcha, no_bot_block — most are stealth-adjacent and align with T007 deferral). VerifyEngine interface accepts the v1.1 strategies as a forward-compat seam.

## Goal

After Phase 3: every Phase 5 Browse MVP action emits an `ActionContract` (target, expected outcome, candidate strategies). `VerifyEngine.verify(contract, session)` runs the 3 MVP strategies in priority order, returns `VerifyResult { ok: boolean, strategy: string, evidence?: ... }`. On failure, `FailureClassifier` produces a typed failure for orchestrator routing (retry / replan / give-up). `ConfidenceScorer` decays multiplicatively per failed verify per R4.4 — never additively.

## Tasks (MVP — 9 tasks)

| Task | Description | MVP? |
|---|---|---|
| T051 | `ActionContract` Zod type | ✅ |
| T052 | `VerifyStrategy` union type + interface | ✅ |
| T053 | `url_change` strategy (post-navigation) | ✅ MVP |
| T054 | `element_appears` strategy (post-click DOM) | ✅ MVP |
| T055 | `element_text` strategy (post-action content change) | ✅ MVP |
| T056-T061 | 6 advanced strategies | ❌ **deferred to v1.1** per tasks-v2 v2.3.2 |
| T062 | `VerifyEngine` (mutation-aware orchestrator) | ✅ |
| T063 | `FailureClassifier` | ✅ |
| T064 | `ConfidenceScorer` (multiplicative — R4.4) | ✅ |
| T065 | Phase 3 integration test | ✅ |

Full descriptions in [tasks.md](tasks.md). Cross-reference: [tasks-v2.md T051-T065 (v2.3.2)](docs/specs/mvp/tasks-v2.md).

## Exit criteria

- [ ] `pnpm test` passes for `packages/agent-core/tests/integration/phase3.test.ts` (T065)
- [ ] All 3 MVP verify strategies green on synthetic action-result fixtures
- [ ] `VerifyEngine` interface accepts strategy by name; v1.1 strategy slots reserved (forward-compat)
- [ ] `ConfidenceScorer` uses **multiplicative** decay (`× 0.97`); ESLint or grep verifies no additive math (`-=`, `+=` on confidence) in source
- [ ] `FailureClassifier` produces typed failures with at least these classes: `verify_failed`, `safety_blocked`, `rate_limited`, `bot_detected_likely` (last is pre-positioned for v1.1's `no_bot_block` strategy)
- [ ] No direct Playwright imports outside Phase 1 boundary (R9 still holds)

## Depends on

- **Phase 1** (BrowserSession via BrowserEngine — verify strategies operate on `session.page`)
- **Phase 2** (MCP tools emit ActionContracts when invoked through Phase 5's orchestrator; Phase 3 doesn't directly depend on individual tools but reuses the BrowserSession from Phase 1)

## Blocks

- **Phase 5** (Browse MVP — every action node calls VerifyEngine before declaring success)
- **Phase 4** (Safety + Infra — FailureClassifier interface consumed by orchestrator routing logic)

## Rollup on exit

```bash
pnpm spec:rollup --phase 3
```

`phase-3-current.md` per R19. Active modules: `verification/`. Contracts: ActionContract, VerifyStrategy, VerifyEngine, ConfidenceScorer, FailureClassifier (all NEW). Forward risks for Phase 5: VerifyEngine integration into action nodes; for Phase 4: failure-class enum stability under safety + retry routing.

## Reading order for Claude Code

1. This README
2. [tasks.md](tasks.md) — find target task
3. [spec.md](spec.md) — AC/R-NN context
4. [plan.md](plan.md) — file map
5. [impact.md](impact.md) — 5 new shared contracts
6. `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` — REQ-VERIFY-* + R4 browser rules (R4.2 verify everything, R4.4 multiplicative confidence)
7. `docs/specs/mvp/constitution.md` R4, R9, R20

Do NOT load:
- Analysis specs (Phase 7 — different confidence model)
- Other phase folders
- v1.1 strategy details (deferred)

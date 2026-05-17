---
title: Phase 5b Rollup — Current System State
artifact_type: rollup
status: approved
version: 1.0
phase_number: 5b
phase_name: multi-viewport-triggers-cookie
phase_completed_on: 2026-05-17
created: 2026-05-17
updated: 2026-05-17
owner: engineering lead
authors: [Claude (master orchestrator Stage 4 exit)]
reviewers: [Sabari]
supersedes: null
supersededBy: null
derived_from:
  - docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/tasks.md
  - docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/spec.md
  - docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/impact.md
  - .phase-state/5b/verify-verdict.yaml
req_ids:
  - REQ-ANALYZE-PERCEPTION-V24-001
  - REQ-GATEWAY-AUDITREQ-VIEWPORTS-001
  - REQ-GATEWAY-AUDITREQ-COOKIE-001
  - REQ-STATE-EXPL-TRIGGER-002
  - REQ-STATE-EXPL-TRIGGER-003
  - REQ-STATE-EXPL-TRIGGER-004
  - REQ-STATE-EXPL-TRIGGER-005
  - REQ-STATE-EXPL-TRIGGER-006
  - REQ-BROWSE-COOKIE-001
  - REQ-SAFETY-005
delta:
  new:
    - 16 modules (2 orchestration + 2 analysis + 4 browser-runtime probes/cookie + 6 triggers + 5 multi-viewport heuristic JSON files)
    - AuditRequest widened with `viewports` + `cookie_policy` fields
    - popups[] dismissibility fields widened from `z.null()` to `z.boolean().nullable()`
    - `ViewportDiffFinding` (kind: "viewport_diff") emitted by ViewportDiffEngine
  changed:
    - Phase 1b popups[] Zod schema widened (R20 cross-cutting)
    - Phase 4b AuditRequest schema extended (additive; back-compat preserved)
  impacted:
    - Phase 6 — must define canonical HeuristicSchema before T5B-008 lint-only heuristics are promoted to Zod-validated
    - Phase 7 — BrowseGraph must integrate the 5 new triggers + DeepPerceiveNode + llm_call_log canonical wiring (Phase 5b uses injected stubs)
  unchanged:
    - Phase 5 single-viewport BrowseGraph flow (additive; backward-compat)
    - Phase 0/0a heuristic lint pipeline (5 new JSONs validated via existing `heuristic-lint.test.ts`)
governing_rules:
  - Constitution R19 (Rollup per Phase)
  - Constitution R20 (cross-cutting Phase 1b/1c/4b)
  - Constitution R26 (state exploration MUST NOT — 6 exclusions + ≤10 budget honored)
---

# Phase 5b — Multi-Viewport + Triggers + Cookie — Current System State Rollup

> **Summary (~200 tokens):** Phase 5b widens perception coverage along three independent axes: (1) **multi-viewport** — desktop 1440×900 + mobile iPhone-11 (375×812) sequential capture with diff scoring per page; (2) **trigger taxonomy** — 5 new MVP triggers (hover/scroll/time/exit_intent/form_input) plus candidate discovery with R26 budget (≤10 per type, per page); (3) **cookie policy** — banner detect across 7 named libraries + 1 generic with policy-driven preserve/dismiss (Accept-only in MVP). The phase ships 16 new modules + 5 heuristic JSONs + 1 schema widening (popups[]) and lands ~104 new tests across 19 ACs (100% passing per `.phase-state/5b/verify-verdict.yaml`). Net new LLM cost = $0 (perception-only; no analysis stage). DeepPerceiveNode, llm_call_log, and Phase 1c settle predicate are stubbed via injected seams pending Phase 6/7 canonical wiring.

> **Governed by:** Constitution R19. Rollup size cap: 300 lines / ~3000 tokens.

---

## 1. Active modules introduced this phase

| Module | Path | Purpose | Tests |
|---|---|---|---|
| `ViewportConfigService` | `packages/agent-core/src/orchestration/ViewportConfigService.ts` | Resolve AuditRequest.viewports → desktop+mobile config pairs | `tests/conformance/viewport-config-service.test.ts` |
| `MultiViewportOrchestrator` | `packages/agent-core/src/orchestration/MultiViewportOrchestrator.ts` | Sequential per-page capture across resolved viewports | `tests/conformance/multi-viewport-orchestrator.test.ts` |
| `ViewportDiffEngine` | `packages/agent-core/src/analysis/ViewportDiffEngine.ts` | Compute desktop/mobile diff → `ViewportDiffFinding` | `tests/conformance/viewport-diff-engine.test.ts` |
| `PopupBehaviorProbe` | `packages/agent-core/src/browser-runtime/PopupBehaviorProbe.ts` | Probe popup activation timing + trigger source | `tests/conformance/popup-behavior-probe.test.ts` |
| `PopupDismissibilityTester` | `packages/agent-core/src/browser-runtime/PopupDismissibilityTester.ts` | Test ESC-dismiss + click-outside-dismiss; populate popups[] fields | `tests/conformance/popup-dismissibility-tester.test.ts` |
| `DarkPatternDetector` | `packages/agent-core/src/analysis/DarkPatternDetector.ts` | Flag 5 dark patterns incl. `weighted_default` (3 textual deferred v1.1) | `tests/conformance/dark-pattern-detector.test.ts` |
| `HoverTrigger` | `packages/agent-core/src/browser-runtime/triggers/HoverTrigger.ts` | Hover-trigger candidate detection (REQ-STATE-EXPL-TRIGGER-002) | `tests/conformance/hover-trigger.test.ts` |
| `ScrollPositionTrigger` | `packages/agent-core/src/browser-runtime/triggers/ScrollPositionTrigger.ts` | Scroll-position trigger detection (REQ-STATE-EXPL-TRIGGER-003) | `tests/conformance/scroll-position-trigger.test.ts` |
| `TimeDelayTrigger` | `packages/agent-core/src/browser-runtime/triggers/TimeDelayTrigger.ts` | Time-delay trigger detection (REQ-STATE-EXPL-TRIGGER-004) | `tests/conformance/time-delay-trigger.test.ts` |
| `ExitIntentTrigger` | `packages/agent-core/src/browser-runtime/triggers/ExitIntentTrigger.ts` | Exit-intent (mouseleave string-match) candidate detection (REQ-STATE-EXPL-TRIGGER-005) | `tests/conformance/exit-intent-trigger.test.ts` |
| `FormInputTrigger` | `packages/agent-core/src/browser-runtime/triggers/FormInputTrigger.ts` | Form-input trigger with 6-category R26 exclusions (REQ-STATE-EXPL-TRIGGER-006) | `tests/conformance/form-input-trigger.test.ts` |
| `TriggerCandidateDiscovery` | `packages/agent-core/src/browser-runtime/triggers/TriggerCandidateDiscovery.ts` | Aggregate candidates; enforce ≤10 per (type, state, page) budget | `tests/conformance/trigger-candidate-discovery.test.ts` |
| `CookieBannerDetector` | `packages/agent-core/src/browser-runtime/CookieBannerDetector.ts` | Detect 7 named libraries + Generic (>5% fold + regex) | `tests/conformance/cookie-banner-detector.test.ts` |
| `CookieBannerPolicy` | `packages/agent-core/src/browser-runtime/CookieBannerPolicy.ts` | Apply AuditRequest.cookie_policy (preserve / Accept-only dismiss) | `tests/conformance/cookie-banner-policy.test.ts` |
| AuditRequest extension | `packages/agent-core/src/types/audit-request.ts` | `viewports[]` + `cookie_policy` (snake_case; back-compat) | `tests/conformance/audit-request-viewports.test.ts` + `audit-request-cookie-policy.test.ts` |
| 5 heuristic JSONs | `heuristics-repo/multi-viewport/MULTIVIEW-{CTA-001,CTA-002,FORM-001,PRICING-001,TRUST-001}.json` | Multi-viewport CRO heuristics (lint-only; Zod-validated Phase 6) | `apps/cli/tests/conformance/heuristic-lint.test.ts` |
| popups[] Zod widening | `packages/agent-core/src/perception/types.ts:484-486` | `isEscapeDismissible` / `isClickOutsideDismissible` from `z.null()` → `z.boolean().nullable()` | `tests/conformance/popup-zod-widened.test.ts` |

---

## 2. Data contracts now in effect

| Contract | Location | Spec | Notes |
|---|---|---|---|
| `AuditRequest.viewports[]` | `packages/agent-core/src/types/audit-request.ts` | REQ-GATEWAY-AUDITREQ-VIEWPORTS-001 | snake_case; desktop 1440×900 + mobile 375×812 default |
| `AuditRequest.cookie_policy` | `packages/agent-core/src/types/audit-request.ts` | REQ-GATEWAY-AUDITREQ-COOKIE-001 | enum: `preserve` \| `dismiss`; error `INVALID_COOKIE_POLICY` |
| `PageStateModel.popups[].isEscapeDismissible` | `packages/agent-core/src/perception/types.ts:484` | REQ-ANALYZE-PERCEPTION-V24-001 | widened `z.null()` → `z.boolean().nullable()` (R20 to Phase 1b) |
| `PageStateModel.popups[].isClickOutsideDismissible` | `packages/agent-core/src/perception/types.ts:485` | REQ-ANALYZE-PERCEPTION-V24-001 | same widening pattern |
| `ViewportDiffFinding` (kind: "viewport_diff") | `packages/agent-core/src/analysis/ViewportDiffEngine.ts` | spec.md AC-04 | Severity tiers align with heuristic tiers (R25 ok) |

---

## 3. System flows now operational

### Flow: Multi-viewport sequential perception

**Trigger:** AuditRequest with `viewports: [desktop, mobile]`
**Steps:** `ViewportConfigService.resolve()` → `MultiViewportOrchestrator.captureAll()` invokes per-viewport capture sequentially → `ViewportDiffEngine.diff()` emits `ViewportDiffFinding` per detected layout/CTA/pricing/trust/form delta.
**Output:** Two `PageStateModel` snapshots per page + zero-or-more `ViewportDiffFinding`s.
**Spec:** REQ-ANALYZE-PERCEPTION-V24-001

### Flow: Popup behavior + dismissibility enrichment

**Trigger:** PopupBehaviorProbe attached during perception capture
**Steps:** Probe records activation timing + trigger source → `PopupDismissibilityTester` runs ESC + click-outside in sandboxed context → populates previously-null `isEscapeDismissible` + `isClickOutsideDismissible` fields → `DarkPatternDetector` flags `weighted_default` / other patterns.
**Output:** Enriched `popups[]` entries; `dark_pattern_flag[]` per popup.
**Spec:** REQ-ANALYZE-PERCEPTION-V24-001

### Flow: Trigger candidate discovery

**Trigger:** Browse pre-pass on each page
**Steps:** 5 trigger probes (hover/scroll/time/exit_intent/form_input) emit candidates → `TriggerCandidateDiscovery` dedupes by (element_id, trigger_type) + enforces ≤10 per (trigger_type, state, page) budget (R26).
**Output:** Trigger candidate list passed to BrowseGraph (Phase 7 wiring pending).
**Spec:** REQ-STATE-EXPL-TRIGGER-002..006

### Flow: Cookie banner detect + policy

**Trigger:** Page navigation completes
**Steps:** `CookieBannerDetector.detect()` matches 7 named libraries (OneTrust / Cookiebot / TrustArc / Quantcast Choice / Didomi / Iubenda / Sourcepoint) + Generic (>5% fold + `/(cookie|consent|privacy|preferences)/i`) → `CookieBannerPolicy.apply()` preserves OR Accept-dismisses per AuditRequest.cookie_policy.
**Output:** Banner state preserved or Accept clicked; downstream perception runs against final state.
**Spec:** REQ-BROWSE-COOKIE-001

---

## 4. Known limitations carried forward

| Limitation | Phase to resolve | Workaround in place |
|---|---|---|
| DeepPerceiveNode stubbed via injected seam | Phase 7 | Test fixtures inject deterministic PageStateModel |
| llm_call_log not yet wired (no LLM calls in Phase 5b anyway) | Phase 6/8 | Cost assertion verified $0 net new spend |
| Phase 1c settle predicate stubbed | Phase 1c canonical wiring | Content-hash equality fallback in T5B-006 |
| 3 textual dark patterns (confirmshaming / friend-spam / false_urgency) | v1.1 | `weighted_default` + 4 structural flags shipped |
| Tab + accordion triggers | v1.1 | 6 MVP-active triggers cover bulk of CRO surface |
| Android Pixel 5 viewport | v1.1 | iPhone-11 covers iOS-skewed D2C pilot scope |
| Capture-then-dismiss cookie mode | v1.1 | preserve OR Accept-dismiss only |
| Reject-flow cookie | v1.1 | Accept-only MVP per act-015 |

---

## 5. Open risks for next phase

| Risk | Impact | Owner | Mitigation |
|---|---|---|---|
| Phase 6 must define HeuristicSchema before MULTIVIEW JSONs can be Zod-validated | MED — lint-only today; full validation gated | Phase 6 owner | T5B-008 currently passes Phase 0b heuristic-lint; promote to Zod when HeuristicSchema lands |
| Phase 7 BrowseGraph must integrate 5 new triggers + canonical DeepPerceiveNode + llm_call_log | HIGH — Phase 5b wiring uses injected stubs | Phase 7 owner | Stubs are clearly named + traceable via integration test `phase5b-full.test.ts` |
| Cross-stream commit-attribution collisions (commits 81195a9, 3e3e22a) | LOW — content correct, authorship muddled; non-functional | Sabari | Note in PR body; future parallel streams use task-prefix conventions |
| ExitIntentTrigger string-match on "mouseleave" is signal-not-proof | LOW | Phase 7 owner | PopupBehaviorProbe gates downstream interpretation |
| CookieBannerDetector `matchGeneric` has no candidate count cap | LOW — accepted MVP | Phase 7 owner | Monitor for runaway matches in production fixtures |

---

## 6. Conformance gate status

| Test | Status | Last run |
|---|---|---|
| `pnpm test:conformance -- viewport-config-service` | green | 2026-05-17 |
| `pnpm test:conformance -- multi-viewport-orchestrator` | green | 2026-05-17 |
| `pnpm test:conformance -- viewport-diff-engine` | green | 2026-05-17 |
| `pnpm test:conformance -- popup-behavior-probe` | green | 2026-05-17 |
| `pnpm test:conformance -- popup-dismissibility-tester` | green | 2026-05-17 |
| `pnpm test:conformance -- popup-zod-widened` | green | 2026-05-17 |
| `pnpm test:conformance -- dark-pattern-detector` | green | 2026-05-17 |
| `pnpm test:conformance -- hover-trigger / scroll-position-trigger / time-delay-trigger / exit-intent-trigger / form-input-trigger / trigger-candidate-discovery` | green (6) | 2026-05-17 |
| `pnpm test:conformance -- cookie-banner-detector / cookie-banner-policy` | green (2) | 2026-05-17 |
| `pnpm test:integration -- multi-viewport / phase5b-full` | green | 2026-05-17 |
| `apps/cli/tests/conformance/heuristic-lint.test.ts` (5 MULTIVIEW JSONs) | green | 2026-05-17 |

19/19 ACs passing per `.phase-state/5b/verify-verdict.yaml`.

---

## 7. What Phase 6 / Phase 7 should read

1. This file (`phase-5b-current.md`) — YOU ARE HERE
2. `phase-5b-validation.md` (sibling — ASCII proof artifacts)
3. `docs/specs/mvp/phases/phase-<N>-<name>/README.md`
4. `docs/specs/mvp/phases/phase-<N>-<name>/spec.md`
5. `docs/specs/mvp/phases/phase-<N>-<name>/tasks.md`

Do NOT load all Phase 5b artifacts. Compression is intentional.

---

## 8. Cost + time summary (this phase)

| Metric | Target | Actual |
|---|---|---|
| Duration (days) | ~2 (single-day intensive across 3 rounds) | 1 (2026-05-17) |
| Tasks completed | 20 (T5B-PRE-001 + T5B-001..T5B-019) | 20/20 |
| New tests | ~95 ± 10 | ~104 |
| LLM dev spend | $0 (perception-only phase) | $0 |
| Effort | 28.5h ± 3 | within budget |

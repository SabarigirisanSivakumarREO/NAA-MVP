---
title: Phase 5b Validation — Multi-Viewport + Triggers + Cookie
artifact_type: validation
status: implemented
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
  - docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/spec.md
  - docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/tasks.md
  - docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/phase-5b-current.md
  - .phase-state/5b/verify-verdict.yaml
governing_rules:
  - Constitution R19 (Rollup per Phase) — sibling artifact pair
  - CLAUDE.md §8c (Per-phase artifact maintenance)
---

# Phase 5b — Multi-Viewport + Triggers + Cookie — Validation

> **Purpose:** AI-built code creates a comprehension gap. This file translates Phase 5b's 16 new modules into 5 ASCII-shaped artifacts a human reviewer can verify with eyes alone in ~20 minutes. Read AFTER `phase-5b-current.md` but BEFORE diving into src. Each section is self-checkable: pick one node/edge, open the cited file:line, confirm "yes that matches." Three confirmations = trust the rest.

> **Governed by:** Constitution R19 (rollup partnership). HEAD at authoring: `3d1bd22`.

---

## §1 Module dependency graph

```
  █ adapters / types (R9 + R20 contracts)
    types/audit-request.ts ──┐ (Zod: viewports + cookie_policy)
                             │
                             ▼
  perception/
    types.ts (popups[] widened) ◄─── consumed by ───┐
                                                    │
  orchestration/                                    │
    ViewportConfigService.ts ──► AuditRequest       │
        │                                           │
        ▼                                           │
    MultiViewportOrchestrator.ts ──► ViewportConfigService
        │     │                                     │
        │     └──► BrowserManager (Phase 1) ────────┤
        ▼                                           │
    [per-viewport PageStateModel × 2]               │
        │                                           │
        ▼                                           │
  analysis/                                         │
    ViewportDiffEngine.ts ──► PageStateModel ───────┘
        │
        └──► [ViewportDiffFinding[]]
                                                          ┌───► PopupBehaviorProbe.ts ──► BrowserManager
  browser-runtime/ (Phase 5b enrichment + triggers)       │
                                                          ├───► PopupDismissibilityTester.ts ──► popups[] (writes)
    perception capture orchestrator (Phase 1c/5) ─────────┤
                                                          ├───► CookieBannerDetector.ts
                                                          │       │
                                                          │       ▼
                                                          │     CookieBannerPolicy.ts ──► AuditRequest.cookie_policy
                                                          │
                                                          └───► triggers/
                                                                  HoverTrigger.ts ───────┐
                                                                  ScrollPositionTrigger ─┤
                                                                  TimeDelayTrigger.ts ───┼──► TriggerCandidateDiscovery.ts
                                                                  ExitIntentTrigger.ts ──┤        │
                                                                  FormInputTrigger.ts ───┘        ▼
                                                                                          [Trigger[] with R26 ≤10 budget]

  analysis/
    DarkPatternDetector.ts ──► PageStateModel.popups[] (reads enriched fields)
                            └► dark_pattern_flag[] (writes; incl. weighted_default)

  heuristics-repo/multi-viewport/  (lint-only via Phase 0b)
    MULTIVIEW-CTA-001 / CTA-002 / FORM-001 / PRICING-001 / TRUST-001
```

**Predecessor edges:** Phase 5 BrowseGraph (single-viewport baseline), Phase 1b popups[] presence layer, Phase 1c settle predicate (stubbed via seam), Phase 4b AuditRequest envelope.

**Trust check:** grep `import` in `MultiViewportOrchestrator.ts` — should reference `ViewportConfigService` + `BrowserManager` (Phase 1) only; NO direct playwright import (R9).

---

## §2 Data flow — AuditRequest → findings

```
AuditRequest {                                 (Phase 4b; widened by T5B-001 + T5B-018)
  url, business_type, ...,
  viewports: [desktop, mobile],
  cookie_policy: "preserve" | "dismiss"
}
   │
   ▼
ViewportConfigService.resolve(viewports)       [orchestration/ViewportConfigService.ts]
   │
   ▼  [ResolvedViewport{ device_type, width, height, ua? }, ...]
   │
   ▼
MultiViewportOrchestrator.captureAll(url, ctx) [orchestration/MultiViewportOrchestrator.ts]
   │
   ├─ per viewport (sequential):
   │     ┌─► BrowserManager.newSession({viewport})
   │     ├─► CookieBannerDetector.detect(page) ──► [BannerHit?]      ► event: cookie.detected
   │     ├─► CookieBannerPolicy.apply(hit, cookie_policy) (async)    ► event: cookie.{preserved|accepted}
   │     ├─► PopupBehaviorProbe.attach(page) (pre-perception)
   │     ├─► DeepPerceiveNode.invoke (STUB → Phase 7) ──► [PageStateModel]
   │     ├─► PopupDismissibilityTester.test(popups, page)
   │     │     └─► writes isEscapeDismissible / isClickOutsideDismissible
   │     └─► finally: session.close()
   │
   ▼  [PageStateModel × 2]
   │
   ├─► ViewportDiffEngine.diff(desktop, mobile)                       [analysis/ViewportDiffEngine.ts]
   │     ──► [ViewportDiffFinding{kind:"viewport_diff", severity, ...}[]]
   │
   ├─► DarkPatternDetector.analyze(popups[])                          [analysis/DarkPatternDetector.ts]
   │     ──► [dark_pattern_flag: "weighted_default" | ...] written onto popups[]
   │
   ├─► triggers/* probes attached to page during capture
   │     └─► TriggerCandidateDiscovery.collect(...)                   [triggers/TriggerCandidateDiscovery.ts]
   │           ──► [TriggerCandidate[]]   (dedupe by (element_id, type); ≤10 per (type, state, page))
   │
   ▼
[ Findings + Triggers handed to Phase 7 BrowseGraph (canonical wiring pending) ]
```

**Trust check:** open `packages/agent-core/tests/integration/phase5b-full.test.ts` — the test boot order matches this diagram top-to-bottom.

---

## §3 Function call graph — T5B-019 integration entry

```
phase5bFullIntegration.run()                              [tests/integration/phase5b-full.test.ts]
├─ buildAuditRequest({ viewports, cookie_policy })        [types/audit-request.ts — Zod parse]
├─ ViewportConfigService.resolve(req.viewports)           [ViewportConfigService.ts:~30]
├─ for each viewport:
│  ├─ MultiViewportOrchestrator.captureForViewport(...)   [MultiViewportOrchestrator.ts:~40]
│  │  ├─ BrowserManager.newSession({viewport, ua})        [browser-runtime/BrowserManager.ts]
│  │  ├─ CookieBannerDetector.detect(page)                [CookieBannerDetector.ts:~50]
│  │  │  ├─ matchNamedLibrary(html) (×7)                  [CookieBannerDetector.ts:matchNamed*]
│  │  │  └─ matchGeneric(html, fold)                      [CookieBannerDetector.ts:matchGeneric]
│  │  ├─ CookieBannerPolicy.apply(hit, policy)            [CookieBannerPolicy.ts:~40]
│  │  │  └─ if dismiss → clickAcceptButton (Accept-only)
│  │  ├─ PopupBehaviorProbe.attach(page)                  [PopupBehaviorProbe.ts:~35]
│  │  ├─ deepPerceiveStub(page) (Phase 7 seam)
│  │  ├─ PopupDismissibilityTester.test(popups, page)     [PopupDismissibilityTester.ts:~30]
│  │  │  ├─ tryEscapeKey(page, popup)
│  │  │  └─ tryClickOutside(page, popup)
│  │  ├─ triggers/HoverTrigger.scan(page) ─┐
│  │  ├─ ScrollPositionTrigger.scan(page) ─┤
│  │  ├─ TimeDelayTrigger.scan(page) ──────┼─► TriggerCandidateDiscovery.aggregate(...)
│  │  ├─ ExitIntentTrigger.scan(page) ─────┤     ├─ dedupeByElementAndType(...)
│  │  ├─ FormInputTrigger.scan(page) ──────┘     └─ enforceR26Budget(≤10/type/state/page)
│  │  └─ finally: session.close()
│  └─ collect PageStateModel
├─ ViewportDiffEngine.diff(desktop_model, mobile_model)   [ViewportDiffEngine.ts:~50]
│  └─ classifyDelta() per CTA / pricing / form / trust
├─ DarkPatternDetector.analyze(allPopups)                 [DarkPatternDetector.ts:~40]
└─ assert: cost === 0, snapshotBytes × 2 ≤ Phase 0 budget, 19 ACs covered
```

**Trust check:** open `tests/integration/phase5b-full.test.ts` near line 1, walk top-to-bottom; each call site in the test should map to one row above.

---

## §4 AC → impl → test traceability matrix

```
┌───────┬─────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┬───────────┐
│  AC   │ Implementation                                              │ Test                                                    │ Status    │
├───────┼─────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┼───────────┤
│ AC-01 │ src/types/audit-request.ts (viewports field)                │ tests/conformance/audit-request-viewports.test.ts        │ green     │
│ AC-02 │ src/orchestration/ViewportConfigService.ts                  │ tests/conformance/viewport-config-service.test.ts        │ green     │
│ AC-03 │ src/orchestration/MultiViewportOrchestrator.ts              │ tests/conformance/multi-viewport-orchestrator.test.ts    │ green     │
│ AC-04 │ src/analysis/ViewportDiffEngine.ts                          │ tests/conformance/viewport-diff-engine.test.ts           │ green     │
│ AC-05 │ src/browser-runtime/PopupBehaviorProbe.ts                   │ tests/conformance/popup-behavior-probe.test.ts           │ green     │
│ AC-06 │ src/browser-runtime/PopupDismissibilityTester.ts            │ tests/conformance/popup-dismissibility-tester.test.ts    │ green     │
│ AC-07 │ src/analysis/DarkPatternDetector.ts                         │ tests/conformance/dark-pattern-detector.test.ts          │ green     │
│ AC-08 │ heuristics-repo/multi-viewport/MULTIVIEW-*.json (×5)        │ apps/cli/tests/conformance/heuristic-lint.test.ts        │ green     │
│ AC-09 │ T5B-009 integration boot                                    │ tests/integration/multi-viewport.test.ts                 │ green     │
│ AC-10 │ src/browser-runtime/triggers/HoverTrigger.ts                │ tests/conformance/hover-trigger.test.ts                  │ green     │
│ AC-11 │ src/browser-runtime/triggers/ScrollPositionTrigger.ts       │ tests/conformance/scroll-position-trigger.test.ts        │ green     │
│ AC-12 │ src/browser-runtime/triggers/TimeDelayTrigger.ts            │ tests/conformance/time-delay-trigger.test.ts             │ green     │
│ AC-13 │ src/browser-runtime/triggers/ExitIntentTrigger.ts           │ tests/conformance/exit-intent-trigger.test.ts            │ green     │
│ AC-14 │ src/browser-runtime/triggers/FormInputTrigger.ts            │ tests/conformance/form-input-trigger.test.ts             │ green     │
│ AC-15 │ src/browser-runtime/triggers/TriggerCandidateDiscovery.ts   │ tests/conformance/trigger-candidate-discovery.test.ts    │ green     │
│ AC-16 │ src/browser-runtime/CookieBannerDetector.ts                 │ tests/conformance/cookie-banner-detector.test.ts         │ green     │
│ AC-17 │ src/browser-runtime/CookieBannerPolicy.ts                   │ tests/conformance/cookie-banner-policy.test.ts           │ green     │
│ AC-18 │ src/types/audit-request.ts (cookie_policy field)            │ tests/conformance/audit-request-cookie-policy.test.ts    │ green     │
│ AC-19 │ T5B-019 full integration boot + cost + storage asserts      │ tests/integration/phase5b-full.test.ts                   │ green     │
└───────┴─────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────┴───────────┘
```

**Pre-existing (cross-cutting):** popups[] Zod widening (T5B-PRE-001) covered by `tests/conformance/popup-zod-widened.test.ts` (green; R20 anchor to Phase 1b).

**REQ-ID → AC map:**
- REQ-ANALYZE-PERCEPTION-V24-001 → AC-03, AC-04, AC-05, AC-06, AC-07, AC-08
- REQ-GATEWAY-AUDITREQ-VIEWPORTS-001 → AC-01, AC-02
- REQ-GATEWAY-AUDITREQ-COOKIE-001 → AC-16, AC-17, AC-18
- REQ-STATE-EXPL-TRIGGER-002..006 → AC-10..AC-14, AC-15
- REQ-BROWSE-COOKIE-001 → AC-16, AC-17
- REQ-SAFETY-005 → AC-14 (6-category R26 exclusion list)

19/19 ACs green per `.phase-state/5b/verify-verdict.yaml`.

---

## §5 Resource cost breakdown

Phase 5b is a perception-only phase: **net new LLM spend = $0**.

**LOC per module (production src only):**

```
┌──────────────────────────────────────────────────┬─────┐
│ Module                                           │ LOC │
├──────────────────────────────────────────────────┼─────┤
│ orchestration/ViewportConfigService.ts           │  66 │
│ orchestration/MultiViewportOrchestrator.ts       │  97 │
│ analysis/ViewportDiffEngine.ts                   │ 150 │
│ analysis/DarkPatternDetector.ts                  │ 134 │
│ browser-runtime/PopupBehaviorProbe.ts            │ 126 │
│ browser-runtime/PopupDismissibilityTester.ts     │ 112 │
│ browser-runtime/CookieBannerDetector.ts          │ 242 │
│ browser-runtime/CookieBannerPolicy.ts            │ 123 │
│ triggers/HoverTrigger.ts                         │  64 │
│ triggers/ScrollPositionTrigger.ts                │  51 │
│ triggers/TimeDelayTrigger.ts                     │  70 │
│ triggers/ExitIntentTrigger.ts                    │  81 │
│ triggers/FormInputTrigger.ts                     │ 131 │
│ triggers/TriggerCandidateDiscovery.ts            │ 186 │
├──────────────────────────────────────────────────┼─────┤
│ TOTAL (14 new src files; one widening in types)  │1633 │
└──────────────────────────────────────────────────┴─────┘
```

All files ≤ 300 LOC (R10 ✓). CookieBannerDetector at 242 is the largest (7-library detection + Generic fold scoring).

**LLM call count:** 0 (no `LLMAdapter.invoke` added; cost assertion verified in T5B-019).

**Storage per snapshot × 2 viewports:** verified ≤ Phase 0 reproducibility ceiling (~13 KB/page) per T5B-009 storage assertion.

**Test count + runtime:** ~104 new tests across 15 conformance + 2 integration files; per-test wall-clock dominated by Playwright session setup (~1.5s × ~20 integration cases).

---

## §6 Trust calibration — what to spot-check by hand

1. **`MultiViewportOrchestrator.ts:~40-80` — captureForViewport loop**
   Risk: parallel-not-sequential viewport capture violates spec (must be sequential to honor cost cap NF-01a ≤2×); or session not closed in finally (leak).
   How to verify: confirm `for...of` not `Promise.all`; confirm `try { ... } finally { await session.close() }` wraps each iteration.

2. **`triggers/FormInputTrigger.ts:1-131` — R26 exclusion list**
   Risk: missing one of 6 exclusion categories (password / cc-* / hidden / file / PII regex / captcha) silently captures sensitive form input.
   How to verify: grep for each category name; confirm 6 distinct checks; tests/conformance/form-input-trigger.test.ts must have 6 dedicated assertions.

3. **`triggers/TriggerCandidateDiscovery.ts:~100-186` — R26 ≤10 budget**
   Risk: budget enforced after dedupe but before yields a count > 10; off-by-one allows 11.
   How to verify: trace `enforceR26Budget` impl; assert `candidates.slice(0, 10)` or `< 10` boundary; test must include the >10 input case.

4. **`CookieBannerDetector.ts:matchGeneric` (~150-242)**
   Risk: Generic detector regex `/(cookie|consent|privacy|preferences)/i` paired with fold-percentage check could over-match (>5% threshold relaxed from >20% per act-018); false-positive on policy-link footers.
   How to verify: read the predicate; both conditions must AND (regex match AND >5% fold), not OR; conformance test must include a negative case (footer-only banner that should NOT match).

5. **`PopupDismissibilityTester.ts:~40-90` — ESC + click-outside test order**
   Risk: tests mutate page state; second test runs against post-ESC state (popup gone) and returns false-negative `isClickOutsideDismissible`.
   How to verify: between tests, popup must be re-shown (or test uses independent page contexts); conformance test must include a popup where ESC works but click-outside does not, and vice versa.

6. **`ViewportDiffEngine.ts:~50-150` — severity classifier**
   Risk: severity tiers misaligned with heuristic tiers (R25); CTA-divergence severity must match heuristic priority.
   How to verify: confirm severity enum matches heuristic JSON `severity` strings (CRITICAL/HIGH/MED/LOW); per file-header comment.

**Trust calibration heuristic:** if all 6 spot-checks pass, treat the rest of Phase 5b as TRUSTED. If any fail, escalate to a deeper Stage 2.5 re-review per CLAUDE.md §14 (master orchestrator may flip Gate 2 to RETURN-TO-IMPL).

---

## §7 Open ends linkage

- Limitations carried forward → `phase-5b-current.md` §4
- Open risks for next phase  → `phase-5b-current.md` §5
- Stage 3 verify verdict     → `.phase-state/5b/verify-verdict.yaml`

---

## §8 How this doc was authored

Master orchestrator Stage 4 exit deliverable, paired with `phase-5b-current.md`. ASCII diagrams generated from real impl state at HEAD `3d1bd22` after Gate 2 APPROVE stamp (2026-05-17T14:43:25Z). Subsequent edits bump version + add a delta block per R18.

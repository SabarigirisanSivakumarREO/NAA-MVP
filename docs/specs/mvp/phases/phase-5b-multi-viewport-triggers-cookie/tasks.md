---
title: Phase 5b — Multi-Viewport + Triggers + Cookie — Tasks
artifact_type: tasks
status: draft
version: 0.1
created: 2026-04-28
updated: 2026-04-28
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/tasks-v2.md (T5B-001..T5B-019, lines 580-696 — CANONICAL DEFINITIONS)
  - docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/spec.md
  - docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/plan.md

req_ids:
  - REQ-ANALYZE-PERCEPTION-V24-001
  - REQ-GATEWAY-AUDITREQ-VIEWPORTS-001
  - REQ-GATEWAY-AUDITREQ-COOKIE-001
  - REQ-STATE-EXPL-TRIGGER-002..006
  - REQ-SAFETY-005

impact_analysis: docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/impact.md
breaking: false
affected_contracts:
  - AuditRequest (extended)
  - AnalyzePerception popups[] (behavior fields)
  - PerceptionBundle (per-viewport)
  - HeuristicLoader manifest

delta:
  new:
    - Phase 5b tasks — sourced from tasks-v2.md (T5B-001..T5B-019)
  changed: []
  impacted: []
  unchanged:
    - All 19 task IDs and acceptance criteria are CANONICAL in tasks-v2.md; this file is a phase-scoped view

governing_rules:
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R18 (Append-only IDs)
  - Constitution R26 (State Exploration MUST NOT)
---

# Phase 5b Tasks (T5B-001 to T5B-019)

> **Summary (~80 tokens):** 19 tasks across 4 streams. Multi-viewport (T5B-001..009): AuditRequest + orchestrator + diff + popup behavior + dark patterns + heuristics + integration. Trigger taxonomy (T5B-010..015): 5 new triggers + candidate discovery. Cookie policy (T5B-016..018): detector + policy + AuditRequest field. Full integration (T5B-019). Total ~28h ±3. Canonical defs in `tasks-v2.md` lines 580-696.

**Source of truth:** `docs/specs/mvp/tasks-v2.md` lines 580-696. Acceptance criteria, file paths, and dependencies below are mirrored verbatim — **do NOT modify this file in lieu of updating `tasks-v2.md`**.

---

## Phase 5b sequencing

Per [plan.md](plan.md) §1: Week 8 multi-viewport (T5B-001..009), Week 9 trigger taxonomy (T5B-010..015), Week 10 cookie + full integration (T5B-016..019).

---

## Multi-Viewport Stream (T5B-001..T5B-009)

### T5B-001 — AuditRequest.viewports field
- **dep:** T080 (Phase 4 schema), T091 (BrowseGraph)
- **spec:** §18 REQ-GATEWAY-AUDITREQ-* + §07 §7.9.2
- **files:** `packages/agent-core/src/gateway/AuditRequest.ts`
- **acceptance:** Schema accepts `["desktop"]` and `["desktop","mobile"]`. Zod validates. Default `["desktop"]`. Rejects unknown viewport names.
- **conformance test:** `packages/agent-core/tests/conformance/audit-request-viewports.test.ts` (AC-01)

### T5B-002 — ViewportConfigService
- **dep:** T5B-001
- **spec:** §07 §7.9.2 (viewport_context)
- **files:** `packages/agent-core/src/orchestration/ViewportConfigService.ts`
- **acceptance:** Reads viewports from AuditRequest. Returns ordered list of viewport configs (`width`, `height`, `device_type`).
- **presets:** desktop 1440×900, mobile 375×812 (iPhone 11) — fixed in MVP
- **conformance test:** `packages/agent-core/tests/conformance/viewport-config-service.test.ts` (AC-02)

### T5B-003 — MultiViewportOrchestrator
- **dep:** T5B-002, T091 (BrowseGraph), T117 (DeepPerceiveNode — see Phase 7)
- **spec:** §07 §7.9.2 multi-viewport
- **files:** `packages/agent-core/src/orchestration/MultiViewportOrchestrator.ts`
- **acceptance:** Run perception per viewport on 1 page. Both desktop+mobile perceptions stored separately. Correlation ID matches across viewports. Sequential execution (no parallel browser contexts in MVP).
- **conformance test:** `packages/agent-core/tests/conformance/multi-viewport-orchestrator.test.ts` (AC-03)

### T5B-004 — ViewportDiffEngine
- **dep:** T5B-003
- **spec:** §07 §7.9.2 multi-viewport diff
- **files:** `packages/agent-core/src/analysis/ViewportDiffEngine.ts`
- **acceptance:** Compare desktop vs mobile perception. Identifies fold composition diff, CTA visibility diff, sticky element diff. Produces `ViewportDiffFinding` finding type with severity scoring.
- **diff dimensions:** see [plan.md §2.3](plan.md)
- **conformance test:** `packages/agent-core/tests/conformance/viewport-diff-engine.test.ts` (AC-04)

### T5B-005 — PopupBehaviorProbe
- **dep:** T1B-004 (PopupPresenceDetector — provides popups[] array to enrich)
- **spec:** §07 §7.9.2 popup behavior fields
- **files:** `packages/agent-core/src/browser/PopupBehaviorProbe.ts`
- **acceptance:** Watch popup trigger on test fixtures (load / time-on-page / scroll / exit-intent). Captures `triggerType` + timing in milliseconds. Updates `popups[]` in-place (mutates from Phase 1b output).
- **conformance test:** `packages/agent-core/tests/conformance/popup-behavior-probe.test.ts` (AC-05)

### T5B-006 — PopupDismissibilityTester
- **dep:** T1B-004
- **spec:** §07 §7.9.2 popup behavior fields
- **files:** `packages/agent-core/src/browser/PopupDismissibilityTester.ts`
- **acceptance:** Test escape key + click-outside on detected popups. Updates `popups[].isEscapeDismissible` and `isClickOutsideDismissible` from `null` → `true` / `false`. Restores page state after test.
- **kill criteria:** state restoration MUST be reliable; conformance test asserts before/after AnalyzePerception equality. Failure → STOP.
- **conformance test:** `packages/agent-core/tests/conformance/popup-dismissibility-tester.test.ts` (AC-06)

### T5B-007 — DarkPatternDetector
- **dep:** T5B-005, T5B-006
- **spec:** §07 §7.9.2 popup quality
- **files:** `packages/agent-core/src/analysis/DarkPatternDetector.ts`
- **acceptance:** Detect deceptive close UI / forced-action popup. Flags dark patterns with type tag: `deceptive_close` / `forced_action` / `no_close_button` / `hidden_dismiss`. Catches ≥1 known dark pattern in fixture set.
- **flag taxonomy:** see [plan.md §2.5](plan.md)
- **conformance test:** `packages/agent-core/tests/conformance/dark-pattern-detector.test.ts` (AC-07)

### T5B-008 — Multi-viewport heuristics pack
- **dep:** T101 (HeuristicSchema)
- **spec:** §09 + §07 §7.9.2
- **files:** `heuristics-repo/multi-viewport.json`
- **acceptance:** Load + Zod validate. 5 new heuristics for mobile-only / desktop-only issues (e.g., "primary CTA hidden below fold on mobile", "sticky CTA covers >40% viewport on mobile"). Tier assigned per heuristic.
- **conformance test:** `packages/agent-core/tests/conformance/multi-viewport-heuristics-pack.test.ts` (AC-08)

### T5B-009 — Phase 5b multi-viewport integration test (legacy)
- **dep:** T5B-001 through T5B-008
- **spec:** Phase 5b exit gate (multi-viewport portion)
- **files:** `packages/agent-core/tests/integration/multi-viewport.test.ts`
- **acceptance:** 1 audit with `viewports: ["desktop","mobile"]`. Findings include mobile-only issues + desktop-only issues + dark-pattern flags. Total cost on 2-viewport audit ≤2× single-viewport baseline. Popup behavior fields (timing, dismissibility) populated for all detected popups.
- **integration test:** `packages/agent-core/tests/integration/multi-viewport.test.ts` (AC-09)

---

## Trigger Taxonomy Stream (T5B-010..T5B-015)

### T5B-010 — HoverTrigger
- **dep:** T091 (BrowseGraph), T1C-007 (ElementGraph for candidate discovery)
- **spec:** §20 trigger taxonomy + spec §3.1
- **files:** `packages/agent-core/src/browser/triggers/HoverTrigger.ts`
- **acceptance:** Detect `:hover` rules + `aria-haspopup` on test fixture. Fire mouseenter event + dwell. Reveals tooltips and dropdown previews. Settles within 1s. **No-op silently on mobile viewport.**
- **conformance test:** `packages/agent-core/tests/conformance/hover-trigger.test.ts` (AC-10)

### T5B-011 — ScrollPositionTrigger
- **dep:** T091, T1C-007
- **spec:** §20 trigger taxonomy + spec §3.1
- **files:** `packages/agent-core/src/browser/triggers/ScrollPositionTrigger.ts`
- **acceptance:** Detect IntersectionObserver patterns + sticky elements. Scroll to Y-coordinates. Captures sticky CTA changes + lazy-loaded content reveal.
- **conformance test:** `packages/agent-core/tests/conformance/scroll-position-trigger.test.ts` (AC-11)

### T5B-012 — TimeDelayTrigger
- **dep:** T091
- **spec:** §20 trigger taxonomy + spec §3.1
- **files:** `packages/agent-core/src/browser/triggers/TimeDelayTrigger.ts`
- **acceptance:** Run page for N seconds (default 5s, max 10s). Diff DOM. Treat new nodes as time-triggered. Captures time-delayed banners and announcements.
- **conformance test:** `packages/agent-core/tests/conformance/time-delay-trigger.test.ts` (AC-12)

### T5B-013 — ExitIntentTrigger
- **dep:** T091
- **spec:** §20 trigger taxonomy + spec §3.1
- **files:** `packages/agent-core/src/browser/triggers/ExitIntentTrigger.ts`
- **acceptance:** Search scripts for `mouseleave` listeners on document/body. Simulate mouse to (x, -1). Triggers exit-intent popups. Populates `popups[].triggerType: exit_intent`. **No-op silently on mobile viewport.**
- **conformance test:** `packages/agent-core/tests/conformance/exit-intent-trigger.test.ts` (AC-13)

### T5B-014 — FormInputTrigger
- **dep:** T091, T017 (TypingBehavior)
- **spec:** §20 trigger taxonomy + spec §3.1
- **files:** `packages/agent-core/src/browser/triggers/FormInputTrigger.ts`
- **acceptance:** Type / select on `<select>` + variant pickers + quantity + address fields. Captures variant-driven price/availability changes. **R26: skip `autocomplete="cc-*"` and password fields.**
- **conformance test:** `packages/agent-core/tests/conformance/form-input-trigger.test.ts` (AC-14)

### T5B-015 — TriggerCandidateDiscovery
- **dep:** T5B-010 through T5B-014, T1C-007 (ElementGraph)
- **spec:** §20 + spec §3.2 + §3.3 priority ordering
- **files:** `packages/agent-core/src/browser/triggers/TriggerCandidateDiscovery.ts`
- **acceptance:** Pull all interactive_nodes from ax_tree + add hover/scroll/time/exit candidates. Returns prioritized candidate list ordered: variant > tabs > accordions > modals > cart > sticky > hover > carousels.
- **R26 budget:** ≤10 candidates per type per state; dedupe by `(element_id, trigger_type)`
- **conformance test:** `packages/agent-core/tests/conformance/trigger-candidate-discovery.test.ts` (AC-15)

---

## Cookie Policy Stream (T5B-016..T5B-018)

### T5B-016 — CookieBannerDetector
- **dep:** T091
- **spec:** spec §4.4
- **files:** `packages/agent-core/src/browser/CookieBannerDetector.ts`
- **acceptance:** Detect OneTrust + Cookiebot + TrustArc by selector signature. Generic detection: fixed-position element covering >20% of fold with "cookie" text. Returns banner descriptor with selector + library + dismissibility metadata.
- **library signatures:** see [plan.md §2.6](plan.md)
- **conformance test:** `packages/agent-core/tests/conformance/cookie-banner-detector.test.ts` (AC-16)

### T5B-017 — CookieBannerPolicy
- **dep:** T5B-016, T5B-018
- **spec:** spec §4.4 + §11.1.1 robots/ToS
- **files:** `packages/agent-core/src/browser/CookieBannerPolicy.ts`
- **acceptance:** Execute `dismiss` (auto-click accept or reject) or `preserve` (keep banner for analysis) per AuditRequest.cookie_policy. `block` mode rejected with structured error (consent breakage). Default = `dismiss`. Emit `COOKIE_BANNER_BLOCKING_FOLD` warning if banner covers >40% of fold and not dismissed.
- **conformance test:** `packages/agent-core/tests/conformance/cookie-banner-policy.test.ts` (AC-17)

### T5B-018 — AuditRequest.cookie_policy field
- **dep:** T5B-001 (AuditRequest.viewports)
- **spec:** §18 AuditRequest + spec §4.4
- **files:** `packages/agent-core/src/gateway/AuditRequest.ts` (extend)
- **acceptance:** Schema accepts `dismiss | preserve`. Zod validates. Default `dismiss`. Rejects `block` value with descriptive error.
- **conformance test:** `packages/agent-core/tests/conformance/audit-request-cookie-policy.test.ts` (AC-18)

---

## Full Integration (T5B-019)

### T5B-019 — Phase 5b full integration test
- **dep:** T5B-001 through T5B-018
- **spec:** Phase 5b extended exit gate
- **files:** `packages/agent-core/tests/integration/phase5b-full.test.ts`
- **acceptance:** Run 1 audit with `viewports:["desktop","mobile"]`, all 8 trigger types active, both cookie policies tested. Findings include: mobile-only / desktop-only issues + dark patterns + hover-revealed microcopy + exit-intent popups + time-delayed banners. Cost ≤2× single-viewport baseline. All warnings types emit on appropriate fixtures.
- **integration test:** `packages/agent-core/tests/integration/phase5b-full.test.ts` (AC-19)

---

## Phase exit checklist

Before declaring Phase 5b complete:

- [ ] AC-01..AC-19 conformance tests all passing
- [ ] T5B-009 multi-viewport integration test passes; cost ≤2× single-viewport baseline
- [ ] T5B-019 full integration test passes; all 8 trigger types active; both cookie policies tested
- [ ] R26 compliance: per-trigger budget ≤10; cc-*/password skipped; no infinite loops; no cross-origin trigger
- [ ] Phase 5 (T100) integration test passes unchanged on default AuditRequest (no Phase 5b opts)
- [ ] PopupDismissibilityTester state restoration verified (before/after equality)
- [ ] Cookie detection precision ≥95% on 5-fixture cookie set
- [ ] Net new LLM cost = $0 (no LLM calls in Phase 5b)
- [ ] `phase-5b-current.md` rollup drafted and approved
- [ ] PR Contract block (per CLAUDE.md §6) attached to merge PR

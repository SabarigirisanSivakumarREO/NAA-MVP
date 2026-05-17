---
title: Phase 5b — Multi-Viewport + Triggers + Cookie — Tasks
artifact_type: tasks
status: approved
version: 0.3
created: 2026-04-28
updated: 2026-05-17
owner: engineering lead
authors: [Claude (drafter), Claude (master orchestrator Pass 1 patch wave 2026-05-17), Claude (master orchestrator Pass 2 micro-wave 2026-05-17)]
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
  - AuditRequest (extended at `src/types/audit-request.ts` Phase 4b T4B-009 canonical path)
  - AnalyzePerception popups[] (Zod widened from `z.null()` → `z.boolean().nullable()` at `src/perception/types.ts:484-486`)
  - PerceptionBundle (per-viewport)
  - HeuristicLoader manifest (Phase 0b lint-only convention)

delta:
  new:
    - Phase 5b tasks — sourced from tasks-v2.md (T5B-001..T5B-019)
    - T5B-PRE-001 — popups[] Zod schema widening (R20 cross-phase; lands FIRST before T5B-005/006)
  changed:
    - v0.1 → v0.2 (Pass 1 patch wave 2026-05-17 — file paths corrected; T5B-008 reframed lint-only; T5B-PRE-001 prepended; per-task storage + state-equality + R26 budget assertions added)
    - T5B-001 + T5B-018 file path: `src/gateway/AuditRequest.ts` → `src/types/audit-request.ts` (extend Phase 4b T4B-009)
    - T5B-005/006 + T5B-010..017 file paths: `src/browser/` → `src/browser-runtime/`
    - T5B-008 — 5 separate JSON files at `heuristics-repo/multi-viewport/MULTIVIEW-<scope>-<NNN>.json`; conformance test → `apps/cli/tests/conformance/heuristic-lint.test.ts` (Phase 0b lint-only); Zod-schema validation gated to Phase 6
    - T5B-006 — state restoration equality via Phase 1c settle predicate + content-hash on `<body>` subtree + scrollY + formStates
    - T5B-009 — added storage ceiling assertion (per-snapshot bytes × 2 viewports ≤ Phase 0 budget)
    - T5B-014 — expanded R26 field exclusions from 3 → 6 categories; per-category conformance assertion
    - T5B-015 — per-page budget assertion `≤10 candidates per (trigger_type, state, page)`
  impacted: []
  unchanged:
    - All 19 task IDs and acceptance criteria are CANONICAL in tasks-v2.md; this file is a phase-scoped view (NOTE: T5B-PRE-001 is a Phase 5b-local prep task; will be authored into tasks-v2.md when Phase 6 sequencing finalizes)

governing_rules:
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R18 (Append-only IDs)
  - Constitution R26 (State Exploration MUST NOT)
---

# Phase 5b Tasks (T5B-001 to T5B-019)

> **Summary (~80 tokens):** 19 tasks across 4 streams. Multi-viewport (T5B-001..009): AuditRequest + orchestrator + diff + popup behavior + dark patterns + heuristics + integration. Trigger taxonomy (T5B-010..015): 5 new triggers + candidate discovery. Cookie policy (T5B-016..018): detector + policy + AuditRequest field. Full integration (T5B-019). Total ~28.5h ±3. Canonical defs in `tasks-v2.md` lines 580-696.

**Source of truth:** `docs/specs/mvp/tasks-v2.md` lines 580-696. Acceptance criteria, file paths, and dependencies below are mirrored verbatim — **do NOT modify this file in lieu of updating `tasks-v2.md`**.

---

## Phase 5b sequencing

Per [plan.md](plan.md) §1: Week 8 prep (T5B-PRE-001) + multi-viewport (T5B-001..009), Week 9 trigger taxonomy (T5B-010..015), Week 10 cookie + full integration (T5B-016..019).

---

## Pre-impl Stream (T5B-PRE-001) — R20 cross-phase Zod widening

### T5B-PRE-001 — popups[] behavior fields Zod widen (R20) ✅
- **dep:** none (foundational; lands FIRST before T5B-005/006 mutate)
- **spec:** Phase 5b spec §"affected_contracts" + impact §1 row "popups[] behavior fields"
- **files:** `packages/agent-core/src/perception/types.ts` (lines 484-486)
- **acceptance:** Widen `popups[].isEscapeDismissible` + `popups[].isClickOutsideDismissible` Zod from `z.null()` to `z.boolean().nullable()`. NON-BREAKING — `null` still accepted (literal type widens to nullable boolean). Phase 1b PopupPresenceDetector continues emitting null until T5B-005/006 mutate to boolean.
- **conformance test:** `packages/agent-core/tests/conformance/popup-zod-widened.test.ts` — assert `PopupSchema.parse({isEscapeDismissible: null})` AND `PopupSchema.parse({isEscapeDismissible: true})` AND `PopupSchema.parse({isEscapeDismissible: false})` all pass; `PopupSchema.parse({isEscapeDismissible: "string"})` rejects.

---

## Multi-Viewport Stream (T5B-001..T5B-009)

### T5B-001 — AuditRequest.viewports field ✅
- **dep:** T4B-009 (Phase 4b AuditRequest intake schema at `src/types/audit-request.ts`), T091 (BrowseGraph)
- **spec:** §18 REQ-GATEWAY-AUDITREQ-* + §07 §7.9.2
- **files:** `packages/agent-core/src/types/audit-request.ts` (extend Phase 4b T4B-009 canonical schema; full `src/gateway/AuditRequest.ts` envelope is Phase 6 deliverable per file header L21)
- **acceptance:** Schema accepts `["desktop"]` and `["desktop","mobile"]`. Zod validates. Default `["desktop"]`. Rejects unknown viewport names. Field named `viewports` at top level of AuditRequest schema (snake_case convention per Phase 4b T4B-009).
- **conformance test:** `packages/agent-core/tests/conformance/audit-request-viewports.test.ts` (AC-01)

### T5B-002 — ViewportConfigService ✅
- **dep:** T5B-001
- **spec:** §07 §7.9.2 (viewport_context)
- **files:** `packages/agent-core/src/orchestration/ViewportConfigService.ts`
- **acceptance:** Reads viewports from AuditRequest. Returns ordered list of viewport configs (`width`, `height`, `device_type`).
- **presets:** desktop 1440×900, mobile 375×812 (iPhone 11) — fixed in MVP
- **conformance test:** `packages/agent-core/tests/conformance/viewport-config-service.test.ts` (AC-02)

### T5B-003 — MultiViewportOrchestrator ✅
- **dep:** T5B-002, T091 (BrowseGraph), T117 (DeepPerceiveNode — see Phase 7)
- **spec:** §07 §7.9.2 multi-viewport
- **files:** `packages/agent-core/src/orchestration/MultiViewportOrchestrator.ts`
- **acceptance:** Run perception per viewport on 1 page. Both desktop+mobile perceptions stored separately. Correlation ID matches across viewports. Sequential execution (no parallel browser contexts in MVP).
- **conformance test:** `packages/agent-core/tests/conformance/multi-viewport-orchestrator.test.ts` (AC-03)

### T5B-004 — ViewportDiffEngine ✅
- **dep:** T5B-003
- **spec:** §07 §7.9.2 multi-viewport diff
- **files:** `packages/agent-core/src/analysis/ViewportDiffEngine.ts`
- **acceptance:** Compare desktop vs mobile perception. Identifies fold composition diff, CTA visibility diff, sticky element diff. Produces `ViewportDiffFinding` finding type with severity scoring.
- **diff dimensions:** see [plan.md §2.3](plan.md)
- **conformance test:** `packages/agent-core/tests/conformance/viewport-diff-engine.test.ts` (AC-04)

### T5B-005 — PopupBehaviorProbe ✅
- **dep:** T1B-004 (PopupPresenceDetector — provides popups[] array to enrich), T5B-PRE-001 (popups[] Zod widened)
- **spec:** §07 §7.9.2 popup behavior fields
- **files:** `packages/agent-core/src/browser-runtime/PopupBehaviorProbe.ts`
- **acceptance:** Watch popup trigger on test fixtures (load / time-on-page / scroll / exit-intent). Captures `triggerType` + timing in milliseconds. Updates `popups[]` in-place (mutates from Phase 1b output). Mutation requires T5B-PRE-001 Zod widening to accept boolean.
- **conformance test:** `packages/agent-core/tests/conformance/popup-behavior-probe.test.ts` (AC-05)

### T5B-006 — PopupDismissibilityTester ✅
- **dep:** T1B-004, T5B-PRE-001, T1C-007 (Phase 1c settle predicate)
- **spec:** §07 §7.9.2 popup behavior fields
- **files:** `packages/agent-core/src/browser-runtime/PopupDismissibilityTester.ts`
- **acceptance:** Test escape key + click-outside on detected popups. Updates `popups[].isEscapeDismissible` and `isClickOutsideDismissible` from `null` → `true` / `false`. Restores page state after test.
- **kill criteria:** state restoration MUST be reliable; conformance test asserts before/after **content-hash equality** on `<body>` subtree DOM + `window.scrollY` + form input values (formula: `sha256(snapshot.dom_outerHTML + scrollY + JSON.stringify(formStates))`); Phase 1c settle predicate gates capture. Failure → STOP.
- **conformance test:** `packages/agent-core/tests/conformance/popup-dismissibility-tester.test.ts` (AC-06)

### T5B-007 — DarkPatternDetector
- **dep:** T5B-005, T5B-006
- **spec:** §07 §7.9.2 popup quality; Phase 5b spec R-06
- **files:** `packages/agent-core/src/analysis/DarkPatternDetector.ts`
- **acceptance:** Detect 5 dark-pattern flags: `deceptive_close`, `forced_action`, `no_close_button`, `hidden_dismiss`, `weighted_default`. **weighted_default** matches `input[type=checkbox][checked]` OR `input[type=radio][checked]` inside detected popup/CMP banner with consent-related label text (regex `/(allow|accept|consent|track|cookie|sell)/i`). Catches ≥1 known dark pattern per flag-class in fixture set. Priority ordering: weighted_default > forced_action > deceptive_close > hidden_dismiss > no_close_button.
- **flag taxonomy:** see [plan.md §2.5](plan.md)
- **conformance test:** `packages/agent-core/tests/conformance/dark-pattern-detector.test.ts` (AC-07)

### T5B-008 — Multi-viewport heuristics pack (lint-only via Phase 0b)
- **dep:** Phase 0b heuristic-lint.test.ts already shipped (no Phase 6 HeuristicSchema dep — Zod-schema validation gated to Phase 6 per Gate 1 act-004 decision)
- **spec:** §09 + §07 §7.9.2
- **files:** 5 separate JSON files at `heuristics-repo/multi-viewport/`:
  - `MULTIVIEW-CTA-001.json` — "Primary CTA hidden below fold on mobile"
  - `MULTIVIEW-CTA-002.json` — "Sticky CTA covers >40% viewport on mobile"
  - `MULTIVIEW-FORM-001.json` — "Form layout breaks on mobile" (detection criteria defined in per-heuristic JSON per T5B-008; objective signals: horizontal overflow > 0px OR field-width < min-tap-target 44px on mobile viewport)
  - `MULTIVIEW-TRUST-001.json` — "Trust signals not surfaced on mobile fold"
  - `MULTIVIEW-PRICING-001.json` — "Pricing display truncated on mobile"
- **acceptance:** All 5 files conform to Phase 0b heuristic-lint schema (validated by `apps/cli/tests/conformance/heuristic-lint.test.ts`). Tier assigned per heuristic. Heuristic body refs `viewport.device_type === "mobile"` (NOT hardcoded pixel widths) to remain forward-compatible with v1.1 Android baseline addition.
- **conformance test:** `apps/cli/tests/conformance/heuristic-lint.test.ts` (Phase 0b lint runs across all `heuristics-repo/**/*.json`; lands 5 multi-viewport files in lint pass; AC-08)

### T5B-009 — Phase 5b multi-viewport integration test (legacy)
- **dep:** T5B-PRE-001 through T5B-008
- **spec:** Phase 5b exit gate (multi-viewport portion)
- **files:** `packages/agent-core/tests/integration/multi-viewport.test.ts`
- **acceptance:** 1 audit with `viewports: ["desktop","mobile"]`. Findings include mobile-only issues + desktop-only issues + dark-pattern flags. **Cost assertion (NF-01a):** `SUM(llm_call_log.cost_usd WHERE audit_run_id=X) <= 2 * baseline_single_viewport_usd`. **Storage assertion (impact §6):** per-snapshot bytes × 2 viewports ≤ Phase 0 reproducibility budget (≤ ~6.5KB-per-bundle × 2 ≤ 13KB-per-page-per-audit). Popup behavior fields (timing, dismissibility) populated for all detected popups.
- **integration test:** `packages/agent-core/tests/integration/multi-viewport.test.ts` (AC-09)

---

## Trigger Taxonomy Stream (T5B-010..T5B-015)

### T5B-010 — HoverTrigger ✅
- **dep:** T091 (BrowseGraph), T1C-007 (ElementGraph for candidate discovery)
- **spec:** §20 trigger taxonomy + spec §3.1
- **files:** `packages/agent-core/src/browser-runtime/triggers/HoverTrigger.ts`
- **acceptance:** Detect `:hover` rules + `aria-haspopup` on test fixture. Fire mouseenter event + dwell. Reveals tooltips and dropdown previews. Settles within 1s. **No-op silently on mobile viewport.**
- **conformance test:** `packages/agent-core/tests/conformance/hover-trigger.test.ts` (AC-10)

### T5B-011 — ScrollPositionTrigger ✅
- **dep:** T091, T1C-007
- **spec:** §20 trigger taxonomy + spec §3.1
- **files:** `packages/agent-core/src/browser-runtime/triggers/ScrollPositionTrigger.ts`
- **acceptance:** Detect IntersectionObserver patterns + sticky elements. Scroll to Y-coordinates. Captures sticky CTA changes + lazy-loaded content reveal.
- **conformance test:** `packages/agent-core/tests/conformance/scroll-position-trigger.test.ts` (AC-11)

### T5B-012 — TimeDelayTrigger ✅
- **dep:** T091
- **spec:** §20 trigger taxonomy + spec §3.1
- **files:** `packages/agent-core/src/browser-runtime/triggers/TimeDelayTrigger.ts`
- **acceptance:** Run page for N seconds (default 5s, max 10s). Diff DOM. Treat new nodes as time-triggered. Captures time-delayed banners and announcements.
- **conformance test:** `packages/agent-core/tests/conformance/time-delay-trigger.test.ts` (AC-12)

### T5B-013 — ExitIntentTrigger
- **dep:** T091
- **spec:** §20 trigger taxonomy + spec §3.1
- **files:** `packages/agent-core/src/browser-runtime/triggers/ExitIntentTrigger.ts`
- **acceptance:** Search scripts for `mouseleave` listeners on document/body. Simulate mouse to (x, -1). Triggers exit-intent popups. Populates `popups[].triggerType: exit_intent`. **No-op silently on mobile viewport.**
- **conformance test:** `packages/agent-core/tests/conformance/exit-intent-trigger.test.ts` (AC-13)

### T5B-014 — FormInputTrigger
- **dep:** T091, T017 (TypingBehavior)
- **spec:** §20 trigger taxonomy + spec §3.1
- **files:** `packages/agent-core/src/browser-runtime/triggers/FormInputTrigger.ts`
- **acceptance:** Type / select on `<select>` + variant pickers + quantity + address fields. Captures variant-driven price/availability changes. **R26: skip ALL 6 exclusion categories (per plan §2.7):** (1) `<input type="password">`, (2) `[autocomplete^="cc-"]` credit-card, (3) `<input type="hidden">`, (4) `<input type="file">` file upload, (5) `<input name>` matching `/(ssn\|tax\|pin\|nin\|aadhaar\|passport)/i` PII, (6) reCAPTCHA / hCaptcha iframes. Cross-origin iframes already excluded by R-18. Per-category conformance assertion.
- **conformance test:** `packages/agent-core/tests/conformance/form-input-trigger.test.ts` (AC-14)

### T5B-015 — TriggerCandidateDiscovery
- **dep:** T5B-010 through T5B-014, T1C-007 (ElementGraph)
- **spec:** §20 + spec §3.2 + §3.3 priority ordering
- **files:** `packages/agent-core/src/browser-runtime/triggers/TriggerCandidateDiscovery.ts`
- **acceptance:** Pull all interactive_nodes from ax_tree + add hover/scroll/time/exit candidates. Returns prioritized candidate list ordered: variant > tabs > accordions > modals > cart > sticky > hover > carousels.
- **R26 budget:** ≤10 candidates per type per state; dedupe by `(element_id, trigger_type)`
- **conformance test:** `packages/agent-core/tests/conformance/trigger-candidate-discovery.test.ts` (AC-15)

---

## Cookie Policy Stream (T5B-016..T5B-018)

### T5B-016 — CookieBannerDetector ✅
- **dep:** T091
- **spec:** spec §4.4
- **files:** `packages/agent-core/src/browser-runtime/CookieBannerDetector.ts`
- **acceptance:** Detect **7 libraries** (OneTrust + Cookiebot + TrustArc + Quantcast Choice + Didomi + Iubenda + Sourcepoint) by selector signature (per plan §2.6). Generic detection (relaxed per act-018): fixed-position element + regex `/(cookie\|consent\|privacy\|preferences)/i` + **>5% fold coverage** (was >20%) + accept/dismiss button. Returns banner descriptor with selector + library + dismissibility metadata. Conformance fixture set = 7 libraries + 1 generic = 8 fixtures (NF-06 precision ≥95%).
- **library signatures:** see [plan.md §2.6](plan.md)
- **conformance test:** `packages/agent-core/tests/conformance/cookie-banner-detector.test.ts` (AC-16)

### T5B-017 — CookieBannerPolicy
- **dep:** T5B-016, T5B-018
- **spec:** spec §4.4 + §11.1.1 robots/ToS
- **files:** `packages/agent-core/src/browser-runtime/CookieBannerPolicy.ts`
- **acceptance:** Execute `dismiss` (auto-click **Accept only** in MVP per act-015; reject-flow deferred to v1.1) or `preserve` (keep banner for analysis) per AuditRequest.cookie_policy. `block` mode rejected with structured error (consent breakage). Default = `dismiss`. Emit `COOKIE_BANNER_BLOCKING_FOLD` warning if banner covers >40% of fold and not dismissed.
- **conformance test:** `packages/agent-core/tests/conformance/cookie-banner-policy.test.ts` (AC-17)

### T5B-018 — AuditRequest.cookie_policy field ✅
- **dep:** T5B-001 (AuditRequest.viewports)
- **spec:** §18 AuditRequest + spec §4.4
- **files:** `packages/agent-core/src/types/audit-request.ts` (extend Phase 4b T4B-009 canonical path; field name `cookie_policy` snake_case per Phase 4b convention — verified at `src/types/audit-request.ts` L55+; full `src/gateway/AuditRequest.ts` envelope is Phase 6 deliverable)
- **acceptance:** Schema accepts `dismiss | preserve`. Zod validates. Default `dismiss`. Rejects `block` value with descriptive error. Snake_case field key `cookie_policy` locked to match Phase 4b intake convention (act-008).
- **conformance test:** `packages/agent-core/tests/conformance/audit-request-cookie-policy.test.ts` (AC-18)

---

## Full Integration (T5B-019)

### T5B-019 — Phase 5b full integration test
- **dep:** T5B-001 through T5B-018
- **spec:** Phase 5b extended exit gate
- **files:** `packages/agent-core/tests/integration/phase5b-full.test.ts`
- **acceptance:** Run 1 audit with `viewports:["desktop","mobile"]`, all 6 MVP-active triggers (click from Phase 5 + hover/scroll/time/exit_intent/form_input; tab/accordion deferred v1.1) active, both cookie policies tested. Findings include: mobile-only / desktop-only issues + dark patterns + hover-revealed microcopy + exit-intent popups + time-delayed banners. Cost ≤2× single-viewport baseline. All warnings types emit on appropriate fixtures.
- **integration test:** `packages/agent-core/tests/integration/phase5b-full.test.ts` (AC-19)

---

## Phase exit checklist

Before declaring Phase 5b complete:

- [ ] AC-01..AC-19 conformance tests all passing
- [ ] T5B-009 multi-viewport integration test passes; cost ≤2× single-viewport baseline
- [ ] T5B-019 full integration test passes; all 6 MVP-active triggers (click + hover/scroll/time/exit_intent/form_input; tab/accordion deferred v1.1) active; both cookie policies tested
- [ ] R26 compliance: per-trigger budget ≤10; cc-*/password skipped; no infinite loops; no cross-origin trigger
- [ ] Phase 5 (T100) integration test passes unchanged on default AuditRequest (no Phase 5b opts)
- [ ] PopupDismissibilityTester state restoration verified (before/after equality)
- [ ] Cookie detection precision ≥95% on 8-fixture cookie set (OneTrust + Cookiebot + TrustArc + Quantcast Choice + Didomi + Iubenda + Sourcepoint + 1 generic)
- [ ] Net new LLM cost = $0 (no LLM calls in Phase 5b)
- [ ] `phase-5b-current.md` rollup drafted and approved
- [ ] PR Contract block (per CLAUDE.md §6) attached to merge PR

---

## Delta Log

### v0.2 → v0.3 — 2026-05-17 (Pass 2 micro-wave per preflight-correctness-pass2.json)

Applied findings: F1, E2, C2.

- F1 (MED) — T5B-019 acceptance + Phase exit checklist trigger wording: "8 trigger types" → "6 MVP-active triggers (click + hover/scroll/time/exit_intent/form_input; tab/accordion deferred v1.1)".
- E2 (LOW) — Phase exit checklist cookie fixture line: "5-fixture" → "8-fixture (OneTrust + Cookiebot + TrustArc + Quantcast Choice + Didomi + Iubenda + Sourcepoint + 1 generic)".
- C2 (LOW) — T5B-008 MULTIVIEW-FORM-001 clarification: "Form layout breaks on mobile" gains objective-signals note (horizontal overflow > 0px OR field-width < 44px tap target on mobile viewport) deferring detection criteria to per-heuristic JSON.

### v0.1 → v0.2 — 2026-05-17 (Pass 1 patch wave per review-notes.md)

Applied actions: act-001, act-002, act-003, act-004, act-008, act-010, act-011, act-012, act-014, act-015, act-018, act-022.

- act-001 — File paths updated: `src/browser/` → `src/browser-runtime/` across T5B-005, T5B-006, T5B-013, T5B-014, T5B-015, T5B-016, T5B-017.
- act-002 — T5B-001 + T5B-018 file path: `src/gateway/AuditRequest.ts` → `src/types/audit-request.ts` (Phase 4b T4B-009 canonical path).
- act-003 — T5B-008 reframed: 5 per-heuristic JSON files at `heuristics-repo/multi-viewport/MULTIVIEW-<scope>-<NNN>.json`.
- act-004 — **USER DECISION (b) lint-only-conformance**: T5B-008 conformance test = Phase 0b `apps/cli/tests/conformance/heuristic-lint.test.ts`; Phase 6 HeuristicSchema dep removed; phase stays 19 tasks.
- act-008 — T5B-018 acceptance locks snake_case `cookie_policy` field naming per Phase 4b convention.
- act-010 — T5B-009 acceptance: storage ceiling assertion added (per-snapshot bytes × 2 viewports ≤ Phase 0 reproducibility budget ~13KB/page).
- act-011 — T5B-015 R26 budget assertion: ≤10 candidates per (trigger_type, state, page); dedupe by (element_id, trigger_type).
- act-012 — T5B-006 state restoration: Phase 1c settle predicate + content-hash on `<body>` subtree + scrollY + formStates.
- act-014 — frontmatter `updated: 2026-05-17`, version `0.1 → 0.2`, delta block appended (R18).
- act-015 — T5B-017 acceptance: cookie dismiss = **Accept only** (reject-flow deferred v1.1).
- act-018 — T5B-016 acceptance: 7-library detection (Quantcast Choice / Didomi / Iubenda / Sourcepoint added); Generic relaxed to >5% fold + regex; 8-fixture conformance set.
- act-022 — T5B-014 acceptance: 6 R26 exclusion categories (password / cc-* / hidden / file / PII regex / captcha); per-category conformance assertion.


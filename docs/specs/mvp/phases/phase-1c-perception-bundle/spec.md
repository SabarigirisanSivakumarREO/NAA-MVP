---
title: Phase 1c — PerceptionBundle Envelope v2.5
artifact_type: spec
status: draft
version: 0.2
created: 2026-04-28
updated: 2026-05-11
owner: engineering lead
authors: [Claude (drafter v0.1; master orchestrator session 15 v0.2 patch wave)]
reviewers: [Sabari (Gate 1 Pass 1 stamp 2026-05-11 — REVISE)]

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (F-004 Browser Perception)
  - docs/specs/mvp/constitution.md (R1-R26; especially R20 impact, R24 perception MUST NOT)
  - docs/specs/mvp/architecture.md (§6.4 tech stack, §6.5 file locations)
  - docs/specs/mvp/tasks-v2.md (T1C-001..T1C-012, lines 254-329)
  - docs/specs/final-architecture/07-analyze-mode.md §7.9.3 (REQ-ANALYZE-PERCEPTION-V25-001, REQ-PERCEPT-V25-002)
  - docs/specs/final-architecture/06-browse-mode.md §6.6 v2.5 (DOM traversal extensions; REQ-BROWSE-PERCEPT-007, REQ-BROWSE-PERCEPT-008)
  - docs/Improvement/perception_layer_spec.md (build-order items 1, 2, 6 + Shadow DOM / iframe / pseudo-element traversal)
  - docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md (predecessor; v2.4 baseline)
  - docs/specs/mvp/phases/phase-1b-perception-extensions/phase-1b-current.md (rollup §2 + §5 — token math + namespace contract + runtime wiring carryover)
  - docs/specs/mvp/phases/phase-1b-perception-extensions/impact.md §11 (Phase 1b namespace contract carried forward; v0.2 patch)
  - .phase-state/1c/preflight-verdict.yaml (Pass 1 REVISE verdict — 12 findings; v0.2 patch wave responds to all)

req_ids:
  - REQ-ANALYZE-PERCEPTION-V25-001
  - REQ-PERCEPT-V25-002
  - REQ-BROWSE-PERCEPT-007
  - REQ-BROWSE-PERCEPT-008

impact_analysis: docs/specs/mvp/phases/phase-1c-perception-bundle/impact.md
breaking: false
affected_contracts:
  - AnalyzePerception (wrapped, not modified)
  - PerceptionBundle (NEW shared contract)
  - PageStateModel (wrapped, not modified)
  - deep_perceive output type (changes from AnalyzePerception → PerceptionBundle; helper provided)

delta:
  v0_2:
    new:
      - Frontmatter version 0.1 → 0.2 + updated 2026-05-11 + reviewers list (Gate 1 Pass 1 stamp by Sabari = REVISE 2026-05-11)
      - 8 categorical-enum extensions added per AI Reviewer Pass 1 completeness audit (categorical surfaces: nondeterminism markers, iframe purposes, warning codes, hidden-element reasons)
      - Namespace-contract carryforward from Phase 1b impact.md §11 — Phase 1c MUST NOT write into `_extensions.*` (Phase 7's reservation); AC-10 + AC-12 conformance assertion added
      - Fixture-matrix clarification — final 5 fixtures with trait-rich SPA fixture exercising Optimizely + Shadow-DOM-deep + React-Portal-deep
      - R-08 + AC-08 — nondeterminism marker probe strategy per category (script-presence vs runtime-probe distinct)
    changed:
      - NF-01 re-baselined per AI Reviewer I2 — "per-state bundle size" redefined to ENVELOPE-ONLY ≤2K (excluding `bundle.raw.*`); Phase 1b empirical floor 12.5K wrapped as `bundle.raw.page_state_model_by_state[stateId]` cited; total per-state bundle including raw passthrough now ≤14.5K (12.5K Phase 1b worst + 2K envelope)
      - AC-05 + R-05 — iframe purpose enum extended {checkout, chat, video, analytics, social_embed, captcha, cmp, payment_3ds, other} + cross_origin override; distinct warnings for security-sensitive purposes
      - AC-06 + R-06 — hidden-element reasons extended from 5 → 7-case enum (added opacity_zero + html_hidden_attr)
      - AC-08 + R-08 — nondeterminism enum closed 9-case enum (auditor 6 + session_replay_active + privacy_sandbox_active + countdown_timer_detected); server-side / edge personalization documented as out-of-scope (undetectable from client)
      - AC-09 + R-09 — warning codes enum closed at 9 explicit codes (SETTLE_TIMEOUT_5S, SHADOW_DOM_NOT_TRAVERSED, IFRAME_SKIPPED, FONTS_NOT_READY, ANIMATION_NOT_SETTLED, COOKIE_BANNER_BLOCKING_FOLD, AUTH_REQUIRED_DETECTED, ELEMENT_GRAPH_TRUNCATED, EXTENSION_OUTPUT_MISSING) + 3 security-sensitive variants for iframe purposes (CAPTCHA_DETECTED, CMP_DETECTED, PAYMENT_3DS_DETECTED)
      - AC-10 — added namespace-contract conformance assertion: `bundle.raw.page_state_model_by_state[*]._extensions` is absent or empty for Phase 1c output
      - AC-12 — fixture enumeration explicit: 5 fixtures (homepage, PDP, cart, checkout, SPA-trait-rich); SPA-trait-rich exercises Optimizely + Shadow-DOM-deep + React-Portal-deep simultaneously
      - §92 Constraints — `AuditRequest.element_graph_size` configurability claim DROPPED; cap hardcoded at 30 for MVP (configurability can be added when Phase 6 Gateway lands AuditRequest; per AI Reviewer I4)
      - Key Entities §225-230 — nondeterminism + warning enums pinned to closed-enum sets
      - §263 Out of Scope — `state_graph.edges` defaults to empty array `[]` for Phase 1c (not omitted); Zod schema clarified
      - Assumptions §273-281 — runtime wiring of 10 Phase 1b extractors into ContextAssembler.capture() deferred to Phase 5 BrowseNode (per AI Reviewer I7); Phase 1c bundle assembly assumes inputs are present; if missing, EXTENSION_OUTPUT_MISSING warning emitted
    impacted:
      - plan.md (parallel v0.1 → v0.2 patch wave — settle algorithm Promise.race wrapper, kill criterion re-baseline, iframe purpose table extension, namespace contract notes)
      - tasks.md (parallel v0.1 → v0.2 patch wave — T1C-005 captcha/cmp/payment_3ds acceptance; T1C-009 ELEMENT_GRAPH_TRUNCATED dep rationale; T1C-012 fixture-matrix clarification)
      - impact.md (parallel v0.1 → v0.2 patch wave — new §11 Namespace Contract Carryforward; §3 runtime wiring deferred; element_graph_size decision)
    unchanged:
      - All 12 task IDs (T1C-001..T1C-012) stable per R18
      - All 12 AC IDs (AC-01..AC-12) stable per R18
      - All 12 R IDs (R-01..R-12) stable per R18
      - All 5 NF IDs (NF-01..NF-05) stable per R18 (NF-01 redefined semantically, ID preserved)
      - All 7 SC IDs (SC-001..SC-007) stable per R18
      - REQ-IDs unchanged
      - PerceptionBundle / FusedElement / ElementGraph / SettleResult key entities — contract shape unchanged; only enumerations tightened
  v0_1:
    new:
      - Phase 1c spec — introduces PerceptionBundle envelope, ElementGraph, FusedElement, settle predicate, DOM traversal extensions
      - AC-01 through AC-12 stable IDs for T1C-001..T1C-012 acceptance
      - R-01 through R-12 functional requirements
    changed: []
    impacted:
      - AnalyzePerception now lives inside `bundle.raw.analyze_perception_by_state[stateId]` — accessor helper provided for backward compat
      - PageStateModel now lives inside `bundle.raw.page_state_model_by_state[stateId]` — accessor helper provided
      - Token cap raised from 8K (v2.4) → 8.5K per state (v2.5 bundle) [SUPERSEDED by v0.2 NF-01 re-baseline]
      - tasks-v2.md (T1C-001..T1C-012 already canonical there)
    unchanged:
      - All v2.3 + v2.4 AnalyzePerception field shapes (R5.1 backward compat)
      - GR-001..GR-008 grounding rule field paths (still resolve via accessor)
      - 12 perception MCP tools (no new tools; bundle is built inside `page_analyze`/`deep_perceive`)

governing_rules:
  - Constitution R10 (Budget — envelope ≤2K per state; raw passthrough sized per Phase 1b NF-Phase1-01 v0.4)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R17 (Lifecycle States)
  - Constitution R18 (Delta-Based Updates — append-only AC-NN/R-NN IDs; v0.2 delta block appends; v0.1 preserved)
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes — PerceptionBundle is shared contract; Phase 1b §11 namespace contract carried forward in §11 v0.2)
  - Constitution R22 (Ratchet)
  - Constitution R24 (Perception MUST NOT — no judgment, no LLM, no prioritization, no content rewriting, no form submit)
---

# Feature Specification: Phase 1c — PerceptionBundle Envelope v2.5

> **Summary (~150 tokens — agent reads this first):** Wrap `AnalyzePerception` (v2.4) inside a `PerceptionBundle` envelope that adds (a) shared element identity across DOM / AX-tree / layout / visual via an `ElementGraph` of `FusedElement`s keyed by stable `element_id`; (b) `meta` + `performance` + `nondeterminism_flags` + `warnings` + `state_graph` for honest output; (c) Shadow DOM + React Portal + pseudo-element + iframe-policy + hidden-element traversal extensions; (d) a 5-second-capped settle predicate (network idle + DOM mutation stop + fonts ready + animations done). All AnalyzePerception fields are preserved and accessible via `bundleToAnalyzePerception(bundle)`. Twelve tasks (T1C-001..T1C-012). Token impact: per-state bundle ≤8.5K (cap was 8K for v2.4 standalone). Cost impact: zero LLM calls; ~+200ms per state for settle.

**Feature Branch:** master (spec authoring; per phase-0..phase-6 convention)
**Input:** Phase 1c scope from `docs/specs/mvp/tasks-v2.md` lines 254-329 + `docs/Improvement/perception_layer_spec.md` items 1, 2, 6 + `docs/specs/final-architecture/07-analyze-mode.md` §7.9.3 + §06.6.6 v2.5

---

## Mandatory References

1. `docs/specs/mvp/constitution.md` — R10, R11, R18, R20, R24.
2. `docs/specs/mvp/PRD.md` — F-004.
3. `docs/specs/final-architecture/07-analyze-mode.md` §7.9.3 (REQ-ANALYZE-PERCEPTION-V25-001 + settle predicate).
4. `docs/specs/final-architecture/06-browse-mode.md` §6.6 v2.5 (REQ-BROWSE-PERCEPT-007 + REQ-BROWSE-PERCEPT-008).
5. `docs/specs/mvp/tasks-v2.md` lines 254-329 (T1C-001..T1C-012).
6. `docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md` (predecessor; v2.4 baseline).
7. `docs/Improvement/perception_layer_spec.md` (full design rationale; especially §3.4 settle, §1.1-1.4 channels, §2 element graph fusion).

---

## Constraints Inherited from Neural Canonical Specs

- **R24 (Perception MUST NOT):** No judgment, no prioritization, no content rewriting, no form submission, no autonomous auth attempts, no state-mutating retries. Capture only.
- **Backward compatibility (R18):** AnalyzePerception v2.4 contract is preserved. `bundle.raw.analyze_perception_by_state[bundle.initial_state_id]` returns identical v2.4 shape. `bundleToAnalyzePerception(bundle)` helper available for legacy code paths.
- **Token cap (v0.2 re-baseline, NF-01):** PerceptionBundle ENVELOPE-ONLY ≤2K per state (meta + performance + nondeterminism_flags + warnings + state_graph + element_graph per state). `bundle.raw.*_by_state[stateId]` passthrough sized per Phase 1b NF-Phase1-01 v0.4 (PageStateModel ≤20K) + v2.4 AnalyzePerception. Total per-state bundle including raw passthrough is ≤14.5K in practice (Phase 1b empirical floor amazon.in = 12.5K PSM + 2K envelope overhead). Hard ceiling for ENVELOPE = 3K; for total per-state bundle = 22K (== Phase 1b cap + envelope).
- **Settle hard cap:** 5 seconds **TOTAL** (single overall guard wrapping all sub-steps; no soft-cap summation). On exceed → emit `SETTLE_TIMEOUT_5S` warning and proceed with state as-captured.
- **Element graph cap:** 30 elements per state — HARDCODED for MVP. Configurability via `AuditRequest.element_graph_size` is DEFERRED (introduced when Phase 6 Gateway lands AuditRequest; not a Phase 1c contract change).
- **Cross-origin iframes:** always skipped (security); same-origin descended only when policy classifies as `checkout` or `chat`. Security-sensitive same-origin iframes (`captcha`, `cmp`, `payment_3ds`) ALSO always skipped with distinct warning codes.
- **Namespace contract carryforward (Phase 1b impact.md §11):** Phase 1c MUST NOT write into `bundle.raw.page_state_model_by_state[*]._extensions.*` — that namespace is reserved for Phase 7 DeepPerceiveNode. Conformance asserted via AC-10 + AC-12.
- **Phase 1b extractor runtime wiring:** OUT OF SCOPE for Phase 1c. The 10 Phase 1b extractor `.script.ts` IIFEs are wired into `ContextAssembler.capture()` `page.evaluate()` by Phase 5 BrowseNode. Phase 1c bundle assembly assumes inputs are present; on missing extractor output, emits `EXTENSION_OUTPUT_MISSING` warning and proceeds.
- **Tech stack pinned (architecture §6.4).** No new vendor dependencies (Playwright + Sharp + native browser APIs).
- **No `console.log`** (R10.6) — Pino logger with correlation fields.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Cross-channel queries against fused element graph (Priority: P1)

A heuristic author wants to query "low-contrast, above-fold, interactive elements" without manually correlating indices across `ctas[]`, `clickTargets[]`, and computed-style maps. The v2.4 schema makes this query fragile (parallel arrays joined by index); v2.5 fuses them via `ElementGraph` keyed by stable `element_id`.

**Why this priority:** Fused identity unlocks an entire family of CRO heuristics (visual hierarchy, contrast vs interactivity, fold composition) that are currently impractical. Settle + traversal extensions are foundational gates this query family depends on.
**Independent Test:** Build a `PerceptionBundle` on a fixture; iterate `bundle.element_graph_by_state[initialStateId].elements` and filter by `(ax?.role === "button" && in_fold && style.contrast_ratio < 4.5)`. Confirm result list matches manual enumeration on the fixture.

**Acceptance Scenarios:**

1. **Given** a fixture with 5 above-fold buttons (3 with ratio <4.5, 2 above), **When** the bundle is built, **Then** the filter returns the 3 expected `element_id`s.
2. **Given** the same fixture re-run, **When** the bundle is rebuilt, **Then** the same 3 `element_id`s are produced (stability guarantee).

---

### User Story 2 — Honest output (nondeterminism flags + warnings) (Priority: P1)

A consultant publishing an audit on an Optimizely-instrumented site needs to see that Optimizely is active so findings can be flagged "may vary across visitors". Without `nondeterminism_flags`, the audit silently presents one variant as canonical.

**Why this priority:** Honest output is core to the project's positioning vs. Lighthouse / Hotjar competitors. False certainty erodes consultant trust faster than missing data does.
**Independent Test:** Run on a fixture instrumented with Optimizely; confirm `nondeterminism_flags` includes `"optimizely_active"`. Run on a Shadow-DOM-deep fixture; confirm `warnings` includes `SHADOW_DOM_NOT_TRAVERSED` if recursion depth >5.

**Acceptance Scenarios:**

1. **Given** Optimizely SDK loaded on the page, **When** the bundle is built, **Then** `bundle.nondeterminism_flags` contains `"optimizely_active"`.
2. **Given** a 7-level shadow-root nesting, **When** the bundle is built, **Then** `bundle.warnings` contains a `SHADOW_DOM_NOT_TRAVERSED` entry with `severity: "warn"`.

---

### User Story 3 — SPA settle before capture (Priority: P1)

An audit on a React SPA captures the page mid-route-transition and finds a half-rendered DOM; the resulting AnalyzePerception is corrupt. The settle predicate gates capture on (network idle + DOM mutation stop + fonts ready + animations done) with a 5-second hard cap.

**Why this priority:** Without settle, ~30% of SPA captures produce unusable perception data. Settle is a single shared utility that unblocks every downstream extractor.
**Independent Test:** Run on an SPA fixture with simulated 800ms route transition; confirm capture happens after the route resolves, not during. Run on a hung-fetch fixture; confirm capture happens at 5s cap with `SETTLE_TIMEOUT_5S` warning emitted.

**Acceptance Scenarios:**

1. **Given** an SPA route transition of 800ms, **When** `waitForSettle()` is called, **Then** capture begins between 800ms and 5000ms after route start.
2. **Given** a hung XHR fetch, **When** `waitForSettle()` runs, **Then** it returns at 5000ms ± 50ms with `capped_at_5s: true` and a `SETTLE_TIMEOUT_5S` warning is emitted on the bundle.

---

### User Story 4 — Backward-compat reader unchanged (Priority: P1)

A v2.4 consumer reading `analyzePerception.ctas[0].text` must keep working with zero code changes after Phase 1c ships.

**Why this priority:** Phase 5 browse-mode and Phase 7 evaluate node both consume AnalyzePerception via existing field paths. Breaking those blocks Phase 5/7.
**Independent Test:** Run the Phase 1 (T015) and Phase 1b (T1B-012) integration tests unchanged against the v2.5 code path; confirm both pass.

**Acceptance Scenarios:**

1. **Given** v2.4 consumer code reading `analyze.metadata.title`, **When** they migrate to `bundleToAnalyzePerception(bundle).metadata.title`, **Then** the value is identical.
2. **Given** GR-001..GR-008 grounding rules referencing `AnalyzePerception` field paths, **When** the bundle accessor returns the v2.4 shape, **Then** all rules resolve their paths unchanged.

---

### Edge Cases

- **Cross-origin iframe** → always skipped; emits `IFRAME_SKIPPED` with `severity: "info"`.
- **Stripe checkout iframe** (same-origin shim) → descended; iframe perception merged.
- **Shadow root recursion >5 levels** → halted, `SHADOW_DOM_NOT_TRAVERSED` emitted, traversal continues at root.
- **Web fonts never load** → emit `FONTS_NOT_READY`, settle proceeds anyway.
- **CSS animation longer than 1.5s** → emit `ANIMATION_NOT_SETTLED`, settle proceeds.
- **Cookie banner blocking >50% of fold** → emit `COOKIE_BANNER_BLOCKING_FOLD`, capture as-is (banner dismissal is Phase 5b decision).
- **Auth wall encountered** → emit `AUTH_REQUIRED_DETECTED`, halt capture (R6.4 — public pages only in MVP).
- **Element added/removed across states** → new `element_id` issued for added; removed elements' `element_id` does not appear in subsequent `state_id`'s graph.
- **Same DOM node persists across states** → `element_id` re-used.
- **`::before` content `""`** → skipped (empty content carries no meaning).
- **`::before` content of "•"** → skipped (punctuation-only).

---

## Acceptance Criteria *(mandatory — stable IDs, append-only)*

| ID | Criterion | Conformance test path | Linked REQ-ID(s) |
|----|-----------|----------------------|------------------|
| AC-01 | SettlePredicate waits for (network idle + DOM mutation stop + fonts ready + animations done + optional selector); 5s hard cap; emits `SETTLE_TIMEOUT_5S` when capped. | `packages/agent-core/tests/conformance/settle-predicate.test.ts` | REQ-PERCEPT-V25-002 |
| AC-02 | ShadowDomTraverser walks 3 nested shadow roots on test fixture; captures all elements; emits `SHADOW_DOM_NOT_TRAVERSED` warning at recursion depth >5. | `packages/agent-core/tests/conformance/shadow-dom-traverser.test.ts` | REQ-BROWSE-PERCEPT-007 |
| AC-03 | PortalScanner detects React Portal modals; marks `is_portal: true` on FusedElement; finds elements not reachable from logical parent tree. | `packages/agent-core/tests/conformance/portal-scanner.test.ts` | REQ-BROWSE-PERCEPT-007 |
| AC-04 | PseudoElementCapture returns `::before` / `::after` content (e.g., "NEW", "BESTSELLER", required-field markers) on badge fixture; skips empty / punctuation-only. | `packages/agent-core/tests/conformance/pseudo-element-capture.test.ts` | REQ-BROWSE-PERCEPT-007 |
| AC-05 | IframePolicyEngine processes the closed purpose enum {checkout, chat, video, analytics, social_embed, captcha, cmp, payment_3ds, other} + cross_origin override. Descend on same-origin {checkout (e.g., stripe.com), chat (e.g., intercom)}. Skip + emit `IFRAME_SKIPPED` (severity routing per purpose: video/social_embed/other = warn; analytics = info). Skip + emit distinct security-sensitive warnings for {captcha → `CAPTCHA_DETECTED`, cmp → `CMP_DETECTED` (Phase 5b owns consent dismissal), payment_3ds → `PAYMENT_3DS_DETECTED`}. Cross-origin ALWAYS skipped (security override). | `packages/agent-core/tests/conformance/iframe-policy-engine.test.ts` | REQ-BROWSE-PERCEPT-007 |
| AC-06 | HiddenElementCapture populates `hiddenElements[]` with closed reason enum {display_none, aria_hidden, visibility_hidden, offscreen, zero_dimension, opacity_zero, html_hidden_attr}; `selector + reason` correct on each. (`clip_path_inset` + `inert_attr` deferred to v0.3.) | `packages/agent-core/tests/conformance/hidden-element-capture.test.ts` | REQ-BROWSE-PERCEPT-008 |
| AC-07 | ElementGraphBuilder builds fused graph from 5 fixtures; top-30 elements per state; stable `element_id` (matches across re-runs of same URL); `ref_in_analyze_perception` cross-references populated. | `packages/agent-core/tests/conformance/element-graph-builder.test.ts` | REQ-ANALYZE-PERCEPTION-V25-001 |
| AC-08 | NondeterminismDetector emits flags from the closed enum {optimizely_active, vwo_active, google_optimize_active, adobe_target_active, personalization_cookies_detected, session_replay_active, ad_auction_detected, privacy_sandbox_active, countdown_timer_detected}. Probe strategy per category: script-presence (window.optimizely, window.VWO, window._gaq for Optimize, window.adobe.target), cookie-pattern (personalization_cookies catch-all), DOM-injection-hook (session-replay: Hotjar / FullStory / Mouseflow), JS-API-presence (navigator.runAdAuction, Topics API), runtime-probe (countdown_timer = visible JS countdown + "ends in" text). Server-side / edge personalization (Akamai EdgeWorkers, Cloudflare Workers, Vercel edge) is DOCUMENTED OUT-OF-SCOPE (not client-detectable). | `packages/agent-core/tests/conformance/nondeterminism-detector.test.ts` | REQ-ANALYZE-PERCEPTION-V25-001 |
| AC-09 | WarningEmitter emits the closed 12-code enum: {SETTLE_TIMEOUT_5S, SHADOW_DOM_NOT_TRAVERSED, IFRAME_SKIPPED, FONTS_NOT_READY, ANIMATION_NOT_SETTLED, COOKIE_BANNER_BLOCKING_FOLD, AUTH_REQUIRED_DETECTED, ELEMENT_GRAPH_TRUNCATED, EXTENSION_OUTPUT_MISSING, CAPTCHA_DETECTED, CMP_DETECTED, PAYMENT_3DS_DETECTED}. `severity` ∈ {info, warn, error} correctly routed per code (security-sensitive = warn; informational skips = info; settle/auth failures = warn). | `packages/agent-core/tests/conformance/warning-emitter.test.ts` | REQ-ANALYZE-PERCEPTION-V25-001 |
| AC-10 | PerceptionBundle Zod schema validates the full envelope; bundle is `Object.freeze`d after build; `bundleToAnalyzePerception(bundle)` returns identical v2.4 shape on baseline fixtures; per-state ENVELOPE-ONLY token budget ≤2K (hard ceiling 3K); namespace-contract assertion `bundle.raw.page_state_model_by_state[*]._extensions` is `undefined` or `{}` (Phase 7 reservation honored per Phase 1b §11). | `packages/agent-core/tests/conformance/perception-bundle.test.ts` | REQ-ANALYZE-PERCEPTION-V25-001 |
| AC-11 | Settle integration into `deep_perceive` skeleton — settle runs before AnalyzePerception capture; settle warnings propagate into `bundle.warnings`. (Full DeepPerceiveNode is Phase 7 — Phase 1c only wires the settle hook.) | `packages/agent-core/tests/conformance/deep-perceive-settle.test.ts` | REQ-PERCEPT-V25-002 |
| AC-12 | Phase 1c integration test on 5 fixtures: homepage (baseline), PDP (Phase 1b commerce reused), cart (Phase 1b reused), checkout (Stripe-iframe inner-page), SPA-trait-rich (Optimizely-instrumented + Shadow-DOM-deep + React-Portal-deep simultaneously). All channels populated. Per-state ENVELOPE ≤2K. ElementGraph ≤30 elements per state. Nondeterminism flags fire on SPA-trait-rich (optimizely_active). Warnings fire on SPA-trait-rich (SHADOW_DOM_NOT_TRAVERSED at depth 7). Namespace-contract assertion passes (no `_extensions.*` writes). T015 + T1B-012 still pass unchanged on v2.5 code via `bundleToAnalyzePerception()` accessor. | `packages/agent-core/tests/integration/perception-bundle.test.ts` | REQ-ANALYZE-PERCEPTION-V25-001 |

---

## Functional Requirements

| ID | Requirement | Cites PRD F-NNN | Linked architecture spec |
|----|-------------|-----------------|--------------------------|
| R-01 | System MUST wait for `(networkidle ‖ 2s) ∧ (DOM mutations idle for 300ms ∨ 3s) ∧ (document.fonts.ready ∨ skip) ∧ (no running animations ∨ 1.5s) ∧ optional selector` before capture, capped at 5s total. | F-004 | §07.7.9.3 settle predicate |
| R-02 | System MUST traverse Shadow DOM recursively up to depth 5; halt at depth 5 and emit `SHADOW_DOM_NOT_TRAVERSED`. | F-004 | §06.6.6 v2.5 |
| R-03 | System MUST detect React Portals + Vue Teleport + Angular CDK Overlay by scanning `<body>` direct children for elements not reachable from logical parent; mark `is_portal: true`. | F-004 | §06.6.6 v2.5 |
| R-04 | System MUST capture `::before` / `::after` `content` text via `getComputedStyle(el, '::before').content`; skip empty / punctuation-only; merge into `FusedElement.text_content`. | F-004 | §06.6.6 v2.5 |
| R-05 | System MUST classify iframe purpose via closed enum {checkout, chat, video, analytics, social_embed, captcha, cmp, payment_3ds, other}. Descend on same-origin {checkout, chat} only. Skip + emit `IFRAME_SKIPPED` (severity routing: video/social_embed/other = warn; analytics = info) for {video, analytics, social_embed, other}. Skip + emit security-sensitive distinct warnings for {captcha → `CAPTCHA_DETECTED` (warn); cmp → `CMP_DETECTED` (info; Phase 5b owns consent); payment_3ds → `PAYMENT_3DS_DETECTED` (warn)}. ALL cross-origin always skipped + `IFRAME_SKIPPED` (security override). | F-004 | §06.6.6 v2.5 |
| R-06 | System MUST capture hidden elements with `selector + reason` from closed enum {display_none, aria_hidden, visibility_hidden, offscreen, zero_dimension, opacity_zero, html_hidden_attr}. These do NOT contribute to ElementGraph but ARE recorded for heuristic visibility. (`clip_path_inset` + `inert_attr` deferred to v0.3.) | F-004 | §06.6.6 v2.5 + §07.7.9.3 |
| R-07 | System MUST build `ElementGraph` per state, keyed by stable `element_id` (hash of `tag + sorted_classes + dom_position_path + text_content_prefix(50)`); HARDCODED cap 30 elements per state for MVP (configurability deferred); populate `ref_in_analyze_perception` cross-references. On cap exceeded, emit `ELEMENT_GRAPH_TRUNCATED` warning with `truncated_count` field. | F-004 | §07.7.9.3 |
| R-08 | System MUST detect nondeterminism markers and emit `nondeterminism_flags[]` from closed enum {optimizely_active, vwo_active, google_optimize_active, adobe_target_active, personalization_cookies_detected, session_replay_active, ad_auction_detected, privacy_sandbox_active, countdown_timer_detected}. Probe strategy per category: (a) **script-presence** for A/B engines (window.optimizely / window.VWO / window._gaq Optimize remnants / window.adobe.target); (b) **DOM-injection-hook detection** for session-replay (Hotjar / FullStory / Mouseflow add `<script>` tags with vendor-specific source patterns); (c) **JS-API-presence** for ad-auction signals (navigator.runAdAuction / browsingTopics); (d) **cookie-pattern** for personalization_cookies catch-all; (e) **DOM scan** for countdown_timer (visible JS-driven countdown adjacent to "ends in" / "expires" text). Server-side / CDN-edge personalization (Akamai EdgeWorkers / Cloudflare Workers / Vercel edge) is **DOCUMENTED OUT-OF-SCOPE** — undetectable from client-side. | F-004 | §07.7.9.3 |
| R-09 | System MUST emit `warnings[]` from closed 12-code enum: {SETTLE_TIMEOUT_5S, SHADOW_DOM_NOT_TRAVERSED, IFRAME_SKIPPED, FONTS_NOT_READY, ANIMATION_NOT_SETTLED, COOKIE_BANNER_BLOCKING_FOLD, AUTH_REQUIRED_DETECTED, ELEMENT_GRAPH_TRUNCATED, EXTENSION_OUTPUT_MISSING, CAPTCHA_DETECTED, CMP_DETECTED, PAYMENT_3DS_DETECTED}. Each `warnings[]` entry: `{code, message, severity}` with `severity` ∈ {info, warn, error}. | F-004 | §07.7.9.3 |
| R-10 | System MUST validate `PerceptionBundle` via Zod; freeze the bundle (`Object.freeze`) after build; reject re-mutation. | F-004 + F-007 | §07.7.9.3 |
| R-11 | System MUST provide `bundleToAnalyzePerception(bundle, stateId?)` that returns the v2.4 AnalyzePerception shape unchanged for any state in the bundle (default: `initial_state_id`). | F-004 | §07.7.9.3 backward compat table |
| R-12 | System MUST integrate `waitForSettle()` into the `deep_perceive` capture path so every capture is gated on settle; settle results propagate to `bundle.warnings`. | F-004 | §07.7.9.3 + §07.5 |

---

## Non-Functional Requirements

| ID | Metric | Target | Cites PRD NF-NNN | Measurement method |
|----|--------|--------|------------------|--------------------|
| NF-01 | PerceptionBundle **envelope-only** token budget per state (meta + performance + nondeterminism_flags + warnings + state_graph + element_graph for the state) | ≤2K per state (warn at 1.8K; hard ceiling 3K). NOTE: `bundle.raw.*_by_state[stateId]` passthrough is NOT counted in NF-01 — that contribution is sized per Phase 1b NF-Phase1-01 v0.4 (PageStateModel ≤20K) and v2.4 AnalyzePerception (per-state ≤6.5K standalone, wrapped here). Phase 1b empirical floor: amazon.in PageStateModel = 12.5K wrapped; total per-state bundle including raw passthrough ≤14.5K in practice. | NF-001 | `getTokenCount()` in integration test on `bundle.meta + bundle.performance + bundle.nondeterminism_flags + bundle.warnings + bundle.state_graph + bundle.element_graph_by_state[stateId]` ONLY (excludes `bundle.raw.*`) |
| NF-02 | Per-state browser time vs v2.4 | ≤+200ms p50 (settle predicate) | NF-001 | Integration test timing diff |
| NF-03 | Net new LLM cost | $0 | NF-002 | `llm_call_log` row count diff = 0 |
| NF-04 | `element_id` stability across re-runs of same URL | 100% match on same DOM | — | Re-run integration test; compare element_id sets |
| NF-05 | Settle hard cap | 5s | — | Integration test with hung-fetch fixture |

---

## Key Entities

- **PerceptionBundle (NEW shared contract):** Top-level perception output. Wraps `AnalyzePerception` (v2.4) + `PageStateModel` (v3.x baseline post-Phase-1b extensions) + screenshots in `bundle.raw`. Adds `meta`, `performance`, `nondeterminism_flags`, `warnings`, `state_graph`, `element_graph_by_state`. Frozen post-build. Zod schema in `packages/agent-core/src/perception/PerceptionBundle.ts`. **Namespace contract (carried from Phase 1b impact.md §11):** Phase 1c does NOT write into `bundle.raw.page_state_model_by_state[*]._extensions.*` — that namespace is reserved for Phase 7 DeepPerceiveNode.
- **ElementGraph:** Per-state. `Map<element_id, FusedElement>` + `root_element_ids[]`. HARDCODED cap 30 elements per state for MVP (configurability deferred to Phase 6 AuditRequest).
- **FusedElement:** Single element record fusing DOM (tag, selector, xpath, text, attrs) + AX-tree (role, name, states, properties) + layout (bbox, in_fold, visible, z_index, overflow_clipped) + style (color, bg, font, contrast_ratio) + visual (crop_url) + interactivity (`is_interactive`) + parent/child IDs + cross-references back to v2.3/v2.4 arrays (`ref_in_analyze_perception`).
- **SettleResult:** `{ elapsed_ms, capped_at_5s }`. Emitted by `waitForSettle()`. Drives a `SETTLE_TIMEOUT_5S` warning when capped. Settle implementation MUST wrap sub-steps in a single overall 5s timer (`Promise.race`); no soft-cap summation that could exceed 5s.
- **Warning:** `{ code, message, severity }`. Closed 12-code enum (per R-09): {SETTLE_TIMEOUT_5S, SHADOW_DOM_NOT_TRAVERSED, IFRAME_SKIPPED, FONTS_NOT_READY, ANIMATION_NOT_SETTLED, COOKIE_BANNER_BLOCKING_FOLD, AUTH_REQUIRED_DETECTED, ELEMENT_GRAPH_TRUNCATED, EXTENSION_OUTPUT_MISSING, CAPTCHA_DETECTED, CMP_DETECTED, PAYMENT_3DS_DETECTED}. Severity routes to Pino log levels.
- **NondeterminismFlag:** Enum string. Closed 9-value enum (per R-08): {optimizely_active, vwo_active, google_optimize_active, adobe_target_active, personalization_cookies_detected, session_replay_active, ad_auction_detected, privacy_sandbox_active, countdown_timer_detected}. Consumer flags findings as "may vary across visitors" when present. Server-side / CDN-edge personalization is OUT OF SCOPE (undetectable client-side).
- **IframePurpose:** Closed 9-value enum (per R-05): {checkout, chat, video, analytics, social_embed, captcha, cmp, payment_3ds, other}. Plus `cross_origin` security override (always skip).
- **HiddenReason:** Closed 7-value enum (per R-06): {display_none, aria_hidden, visibility_hidden, offscreen, zero_dimension, opacity_zero, html_hidden_attr}.

---

## Success Criteria *(measurable, technology-agnostic)*

- **SC-001:** All 5 integration fixtures (homepage, PDP, cart, checkout, SPA-heavy) produce a valid Zod-validated bundle with all channels populated.
- **SC-002:** Bundle token budget stays ≤8.5K per state on every fixture.
- **SC-003:** Phase 1 (T015) and Phase 1b (T1B-012) integration tests pass unchanged on the v2.5 code path.
- **SC-004:** `element_id` stability test: re-running on the same fixture URL produces identical `element_id` sets in `ElementGraph`.
- **SC-005:** Net new LLM spend per audit = $0.
- **SC-006:** Settle predicate respects 5s hard cap; emits `SETTLE_TIMEOUT_5S` ≥99% of the time when triggered.
- **SC-007:** ElementGraph cap of 30 elements per state respected on all fixtures (configurable up to 60 via `AuditRequest.element_graph_size`).

---

## Constitution Alignment Check

- [x] Does NOT predict conversion rates (R5.3 + GR-007) — perception-only
- [x] Does NOT auto-publish findings without consultant review — no findings emitted in this phase
- [x] Does NOT UPDATE or DELETE rows from append-only tables (R7.4) — no DB writes
- [x] Does NOT import vendor SDKs outside adapters (R9) — Playwright via BrowserEngine, Sharp wrapped
- [x] Does NOT set temperature > 0 on `evaluate` / `self_critique` / `evaluate_interactive` (R10) — no LLM calls
- [x] Does NOT expose heuristic content outside the LLM evaluate prompt (R6) — no heuristic engagement
- [x] DOES include a conformance test stub for every AC-NN (PRD §9.6 + R3 TDD) — AC-01..AC-12 each cite a path
- [x] DOES carry frontmatter delta block on subsequent edits (R18)
- [x] DOES define kill criteria for tasks > 2 hrs OR shared-contract changes (R23) — tracked in plan.md
- [x] DOES reference REQ-IDs from `docs/specs/final-architecture/` for every R-NN (R11.2)

---

## Out of Scope (cite PRD §3.2 explicit non-goals)

- **State graph EDGES** (formal `edges[]` array populated with edge metadata) — Phase 13 master track. Phase 1c's `state_graph` Zod schema is `{nodes: z.array(StateNode).default([]), edges: z.array(StateEdge).default([])}` — `edges` resolves to `[]` (empty array, not omitted key) for Phase 1c; multi-state interaction discovery is out of scope for MVP Phase 1c.
- **Cross-channel query API** (utility layer over `bundle.element_graph_by_state[].elements`) — deferred to Phase 14 (§33 interactive evaluate). Phase 1c only ships the data structure.
- **DeepPerceiveNode full implementation** — Phase 7. Phase 1c only wires the settle hook (T1C-011).
- **Multi-viewport bundles** — Phase 5b.
- **Auth-required perception** (PRD §3.2 permanent non-goal) — emits `AUTH_REQUIRED_DETECTED` and halts.
- **Cross-origin iframe descent** — security non-goal; always skipped.
- **Conversion-rate prediction** — permanent non-goal (R5.3 + GR-007).

---

## Assumptions

- Phase 1b (T1B-001..T1B-012) ships and `phase-1b-current.md` rollup is approved before Phase 1c starts. **(SATISFIED 2026-05-09 — Phase 1b rollup v1.0 implemented; PR #4 merged at 23d65fa.)**
- `PageStateModel` (Phase 1 baseline + Phase 1b extensions) and `AnalyzePerception` v2.4 schemas remain available for wrapping; no concurrent breaking changes. Phase 1b empirical floor for PageStateModel size: amazon.in = 12,485 tokens (per Phase 1b rollup §2 + NF-Phase1-01 v0.4 cap 20K).
- Five integration fixtures are available or stubbable: homepage, PDP, cart, checkout, **SPA-trait-rich** (a single trait-rich fixture exercising Optimizely-instrumented + Shadow-DOM-deep depth-7 + React-Portal-deep simultaneously — collapses 3 separately-cited fixtures from v0.1 into one). SPA-trait-rich fixture authoring is in-scope of T1C-012.
- Sharp library is wired (used for contrast in v2.4) — no new vendor dependency.
- `bundleToAnalyzePerception()` accessor is sufficient for backward compat — no consumer requires deeper migration in MVP.
- Cross-origin iframes are uniformly skipped; same-origin iframe descent budget defaults to depth 1 (no nested iframe traversal beyond 1 level). Security-sensitive same-origin iframes (captcha / cmp / payment_3ds) ALSO skipped regardless of origin.
- DeepPerceiveNode skeleton (Phase 7 forward stub at T1C-011) accepts the settle hook without architecture change.
- **Runtime wiring of 10 Phase 1b extractors** (each `.script.ts` IIFE injected into `ContextAssembler.capture()` `page.evaluate()`) is **DEFERRED to Phase 5 BrowseNode** per AI Reviewer Gate 1 Pass 1 I7 resolution. Phase 1c bundle assembly assumes extractor outputs are present in `bundle.raw.page_state_model_by_state[stateId]`. If a Phase 1b extension group is missing at runtime, `EXTENSION_OUTPUT_MISSING` warning is emitted and bundle assembly proceeds with that field undefined.
- **Namespace contract from Phase 1b impact.md §11** is honored: Phase 1c writes neither `bundle.raw.page_state_model_by_state[*]._extensions.*` (reserved for Phase 7 DeepPerceiveNode) nor `bundle.raw.analyze_perception_by_state[*]._extensions.*`. Conformance asserted via AC-10 + AC-12.
- `AuditRequest.element_graph_size` configurability is OUT OF SCOPE for Phase 1c (per AI Reviewer Gate 1 Pass 1 I4 resolution). Cap hardcoded at 30 for MVP. Configurability may be added when Phase 6 Gateway lands AuditRequest.

---

## Next Steps

After approval (`status: draft → validated → approved`):

1. Run `/speckit.plan` (already drafted alongside this spec).
2. Run `/speckit.tasks` (T1C-001..T1C-012 mirrored from `tasks-v2.md`).
3. Run `/speckit.analyze` for cross-artifact consistency.
4. Phase 1c implementation begins after Phase 1b ships and `phase-1b-current.md` rollup is approved.

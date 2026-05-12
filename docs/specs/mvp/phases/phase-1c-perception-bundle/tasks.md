---
title: Phase 1c — PerceptionBundle Envelope v2.5 — Tasks
artifact_type: tasks
status: approved
version: 0.2
created: 2026-04-28
updated: 2026-05-12
owner: engineering lead
authors: [Claude (drafter v0.1; master orchestrator session 15 v0.2 patch wave)]
reviewers: [Sabari (Gate 1 Pass 1 stamp 2026-05-11 — REVISE; Gate 1 Pass 2 stamp 2026-05-12 — APPROVE)]

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/tasks-v2.md (T1C-001..T1C-012, lines 254-329 — CANONICAL DEFINITIONS)
  - docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md (v0.2)
  - docs/specs/mvp/phases/phase-1c-perception-bundle/plan.md (v0.2)
  - .phase-state/1c/preflight-verdict.yaml (Pass 1 verdict)

req_ids:
  - REQ-ANALYZE-PERCEPTION-V25-001
  - REQ-PERCEPT-V25-002
  - REQ-BROWSE-PERCEPT-007
  - REQ-BROWSE-PERCEPT-008

impact_analysis: docs/specs/mvp/phases/phase-1c-perception-bundle/impact.md
breaking: false
affected_contracts:
  - PerceptionBundle (new)
  - AnalyzePerception (wrapped only)
  - PageStateModel (wrapped only)
  - deep_perceive output type

delta:
  v0_2:
    new:
      - Frontmatter version 0.1 → 0.2 + updated 2026-05-11
      - T1C-005 acceptance extended with security-sensitive purposes (captcha, cmp, payment_3ds) + distinct warning codes; classifier order documented (security-first)
      - T1C-006 acceptance extended with 7-case closed reason enum (opacity_zero + html_hidden_attr added)
      - T1C-008 acceptance pinned to 9-value closed enum (matches R-08 v0.2 + AC-08 v0.2)
      - T1C-009 acceptance pinned to 12-code closed enum; T1C-007 dep rationale documented (emits ELEMENT_GRAPH_TRUNCATED)
      - T1C-010 acceptance updated with envelope-only NF-01 ≤2K (no longer ≤8.5K conflating envelope + raw)
      - T1C-010 acceptance includes namespace-contract conformance assertion (_extensions.* absent or empty)
      - T1C-012 fixture matrix clarified to 5 fixtures (homepage, PDP, cart, checkout, SPA-trait-rich) — SPA-trait-rich is a single trait-rich fixture exercising Optimizely + Shadow-DOM-deep + React-Portal-deep simultaneously (collapses 3 cited but un-enumerated traits from v0.1)
      - Phase exit checklist row added: namespace contract honored (no _extensions.* writes per Phase 1b §11 carryforward)
      - Phase exit checklist token-budget row updated to envelope-only NF-01
    changed:
      - T1C-005 acceptance — 5 iframe types → 9 purposes + cross_origin override; 3 distinct security-sensitive warning codes
      - T1C-006 acceptance — 5 reasons → 7 reasons closed enum
      - T1C-008 acceptance — vague enumeration → 9-value closed enum
      - T1C-009 acceptance — "8 documented warning codes" → 12-code closed enum
      - T1C-010 acceptance — token budget framing (envelope-only vs total)
      - T1C-012 fixture matrix — 5 fixtures (one trait-rich); explicit Optimizely + Shadow-DOM-deep coverage
    impacted: []
    unchanged:
      - 12 task IDs T1C-001..T1C-012 (R18 append-only)
      - Sequencing across Day 1-2 / Day 3 / Day 4
      - Per-task dep declarations (only acceptance text refined)
      - Conformance test file paths
      - Total effort estimate 16h ±2 (plan.md v0.2 §4 unchanged)
  v0_1:
    new:
      - Phase 1c tasks — sourced from tasks-v2.md (T1C-001..T1C-012)
    changed: []
    impacted: []
    unchanged:
      - All 12 task IDs and acceptance criteria are CANONICAL in tasks-v2.md; this file is a phase-scoped view

governing_rules:
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R18 (Append-only IDs — v0.2 delta block appended; v0.1 preserved)
---

# Phase 1c Tasks (T1C-001 to T1C-012)

> **Summary (~80 tokens):** 12 tasks. T1C-002..T1C-006 are parallel traversal extensions. T1C-001 settle predicate is standalone. T1C-007 ElementGraphBuilder closes the traversal set. T1C-008..T1C-010 compose the bundle envelope. T1C-011 wires settle into the Phase 7 DeepPerceiveNode skeleton. T1C-012 is the 5-fixture exit gate. Total ~16h ±2. Canonical defs in `tasks-v2.md` lines 254-329.

**Source of truth:** `docs/specs/mvp/tasks-v2.md` lines 254-329. Acceptance criteria, file paths, and dependencies below are mirrored verbatim — **do NOT modify this file in lieu of updating `tasks-v2.md`**.

---

## Phase 1c sequencing

Per [plan.md](plan.md) §1: parallelize Day 1-2 (T1C-001/002/003/004/005/006), Day 3 (T1C-007/008/009), Day 4 (T1C-010/011/012).

---

## T1C-001 — SettlePredicate
- **dep:** T006 (BrowserManager)
- **spec:** REQ-PERCEPT-V25-002 + spec §3.4
- **files:** `packages/agent-core/src/perception/SettlePredicate.ts`
- **acceptance:** Wait for settle on SPA fixtures (network idle + mutation stop + fonts ready + animations done + optional selector). Returns within 5s hard cap. Emits `SETTLE_TIMEOUT_5S` warning if capped.
- **conformance test:** `packages/agent-core/tests/conformance/settle-predicate.test.ts` (AC-01)

## T1C-002 — ShadowDomTraverser
- **dep:** T013 (ContextAssembler)
- **spec:** REQ-BROWSE-PERCEPT-007 (Shadow DOM)
- **files:** `packages/agent-core/src/perception/ShadowDomTraverser.ts`
- **acceptance:** Walk 3 nested shadow roots on test fixture. Captures all elements. Emits `SHADOW_DOM_NOT_TRAVERSED` warning if recursion depth >5.
- **conformance test:** `packages/agent-core/tests/conformance/shadow-dom-traverser.test.ts` (AC-02)

## T1C-003 — PortalScanner
- **dep:** T013
- **spec:** REQ-BROWSE-PERCEPT-007 (React Portals + Vue Teleport + Angular CDK Overlay)
- **files:** `packages/agent-core/src/perception/PortalScanner.ts`
- **acceptance:** Detect React Portal modals on fixture. Marks `is_portal: true` on FusedElement. Finds elements not reachable from logical parent tree.
- **conformance test:** `packages/agent-core/tests/conformance/portal-scanner.test.ts` (AC-03)

## T1C-004 — PseudoElementCapture
- **dep:** T013
- **spec:** REQ-BROWSE-PERCEPT-007 (pseudo-element content)
- **files:** `packages/agent-core/src/perception/PseudoElementCapture.ts`
- **acceptance:** Capture `::before` / `::after` content on badge fixture. Returns "NEW" / "BESTSELLER" / required-field markers. Skips empty / punctuation-only content.
- **conformance test:** `packages/agent-core/tests/conformance/pseudo-element-capture.test.ts` (AC-04)

## T1C-005 — IframePolicyEngine *(v0.2 acceptance extended)*
- **dep:** T013, T1B-009 (CommerceBlockExtractor for purposeGuess context)
- **spec:** REQ-BROWSE-PERCEPT-007 (iframe policy)
- **files:** `packages/agent-core/src/perception/IframePolicyEngine.ts`
- **acceptance (v0.2):** Process the closed 9-purpose enum {checkout, chat, video, analytics, social_embed, captcha, cmp, payment_3ds, other} + cross_origin override. Descend on same-origin {checkout, chat} only. Skip + emit `IFRAME_SKIPPED` for {video, analytics, social_embed, other} (severity routing: video/social_embed/other = warn; analytics = info). Skip + emit distinct security-sensitive warnings for {captcha → `CAPTCHA_DETECTED` (warn); cmp → `CMP_DETECTED` (info); payment_3ds → `PAYMENT_3DS_DETECTED` (warn)}. **Classifier order:** cross_origin check FIRST (security override); then security-sensitive purposes (captcha + cmp + payment_3ds) BEFORE checkout/chat (prevents nested captcha-inside-checkout misclassification). Cross-origin always skipped + `IFRAME_SKIPPED`.
- **conformance test:** `packages/agent-core/tests/conformance/iframe-policy-engine.test.ts` (AC-05) — must include fixtures for all 9 purposes + cross_origin override
- **classifier:** see [plan.md §2.6](plan.md) (v0.2 table with 9 purposes)

## T1C-006 — HiddenElementCapture *(v0.2 acceptance extended)*
- **dep:** T013
- **spec:** REQ-BROWSE-PERCEPT-008
- **files:** `packages/agent-core/src/perception/HiddenElementCapture.ts`
- **acceptance (v0.2):** Capture hidden elements via closed 7-case reason enum {display_none, aria_hidden, visibility_hidden, offscreen, zero_dimension, opacity_zero, html_hidden_attr}. `hiddenElements[]` populated with `{selector, reason}` per element. Detection rules: `display_none` via `getComputedStyle().display === "none"`; `visibility_hidden` via `getComputedStyle().visibility === "hidden"`; `aria_hidden` via `getAttribute("aria-hidden") === "true"`; `offscreen` via `getBoundingClientRect()` outside viewport; `zero_dimension` via `width === 0 || height === 0`; `opacity_zero` via `getComputedStyle().opacity === "0"`; `html_hidden_attr` via `hasAttribute("hidden")`. `clip_path_inset` + `inert_attr` are DEFERRED to v0.3 (skip-link a11y patterns + newer HTML5 inert).
- **conformance test:** `packages/agent-core/tests/conformance/hidden-element-capture.test.ts` (AC-06) — must cover all 7 reasons

## T1C-007 — ElementGraphBuilder
- **dep:** T1C-002, T1C-003, T1C-004, T1C-005, T1C-006, T1B-011 (v2.4 schema)
- **spec:** §07 §7.9.3 ElementGraph + FusedElement
- **files:** `packages/agent-core/src/perception/ElementGraphBuilder.ts`
- **acceptance:** Build fused graph from 5 fixture pages. Top-30 elements per state with stable `element_id`. AX + DOM + bbox + style + crop_url joined. `ref_in_analyze_perception` cross-references populated to link FusedElement back to v2.3/v2.4 array indices. `element_id` stable across re-runs of same URL.
- **stability rules:** see [plan.md §2.3](plan.md)
- **conformance test:** `packages/agent-core/tests/conformance/element-graph-builder.test.ts` (AC-07)

## T1C-008 — NondeterminismDetector *(v0.2 acceptance extended)*
- **dep:** T013
- **spec:** §07 §7.9.3 nondeterminism_flags
- **files:** `packages/agent-core/src/perception/NondeterminismDetector.ts`
- **acceptance (v0.2):** Detect markers from the closed 9-value enum {optimizely_active, vwo_active, google_optimize_active, adobe_target_active, personalization_cookies_detected, session_replay_active, ad_auction_detected, privacy_sandbox_active, countdown_timer_detected}. Probe strategy per category (per spec R-08 v0.2): script-presence for A/B engines (window.optimizely, window.VWO, Google Optimize residual `window._gaq` patterns, window.adobe.target); DOM-injection-hook detection for session-replay (Hotjar / FullStory / Mouseflow script tag pattern matching); JS-API-presence for ad auctions (navigator.runAdAuction / browsingTopics); cookie-pattern for personalization_cookies catch-all; visible JS countdown + "ends in" / "expires" text for countdown_timer. `nondeterminism_flags[]` populated with specific flags per detector. Server-side / CDN-edge personalization detection (Akamai EdgeWorkers, Cloudflare Workers, Vercel edge) is **OUT OF SCOPE** — undetectable client-side.
- **conformance test:** `packages/agent-core/tests/conformance/nondeterminism-detector.test.ts` (AC-08) — must cover all 9 flags with positive + negative fixture cases each

## T1C-009 — WarningEmitter *(v0.2 acceptance extended)*
- **dep:** T1C-001, T1C-002, T1C-005, T1C-007 (dep on T1C-007 rationale: ElementGraphBuilder emits `ELEMENT_GRAPH_TRUNCATED` on cap > 30 per R-07 + R-09 v0.2)
- **spec:** §07 §7.9.3 warnings
- **files:** `packages/agent-core/src/perception/WarningEmitter.ts`
- **acceptance (v0.2):** Emit warnings from the closed 12-code enum: {SETTLE_TIMEOUT_5S, SHADOW_DOM_NOT_TRAVERSED, IFRAME_SKIPPED, FONTS_NOT_READY, ANIMATION_NOT_SETTLED, COOKIE_BANNER_BLOCKING_FOLD, AUTH_REQUIRED_DETECTED, ELEMENT_GRAPH_TRUNCATED, EXTENSION_OUTPUT_MISSING, CAPTCHA_DETECTED, CMP_DETECTED, PAYMENT_3DS_DETECTED}. Bundle has `warnings[]` with `{code, message, severity}` per entry. Severity routing per spec R-09 v0.2: info (informational skips like analytics IFRAME_SKIPPED, CMP_DETECTED) / warn (security-sensitive + traversal-failure) / error (none in MVP — reserved for future use).
- **conformance test:** `packages/agent-core/tests/conformance/warning-emitter.test.ts` (AC-09) — must cover all 12 codes with at least one positive-emit fixture each

## T1C-010 — PerceptionBundle (Zod schema + envelope) *(v0.2 acceptance extended)*
- **dep:** T1C-001 through T1C-009
- **spec:** §07 §7.9.3 PerceptionBundle
- **files:** `packages/agent-core/src/perception/PerceptionBundle.ts`
- **acceptance (v0.2):** Wrap existing AnalyzePerception + extended PageStateModel + ElementGraph + state nodes. Bundle Zod-validates the full envelope. Backward-compat helper `bundleToAnalyzePerception(bundle, stateId?)` returns existing v2.4 shape from bundle. **ENVELOPE-ONLY token budget ≤2K per state** (per NF-01 v0.2 — measured on `meta + performance + nondeterminism_flags + warnings + state_graph + element_graph_by_state[stateId]`, EXCLUDING `bundle.raw.*`). Bundle is immutable after capture (Object.freeze). **Namespace-contract conformance assertion (NEW v0.2 — per Phase 1b impact.md §11 carryforward):** `bundle.raw.page_state_model_by_state[*]._extensions` is `undefined` or `{}` (Phase 7 DeepPerceiveNode reservation honored).
- **conformance test:** `packages/agent-core/tests/conformance/perception-bundle.test.ts` (AC-10) — must include envelope-only token-budget assertion + namespace-contract assertion

## T1C-011 — Settle integration into deep_perceive
- **dep:** T1C-001, T117 (DeepPerceiveNode from Phase 7 — forward-stub here, populate in Phase 7)
- **spec:** §07 §7.5 deep_perceive
- **files:** `packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts` (extend skeleton)
- **acceptance:** Run settle before AnalyzePerception capture. Settle predicate gates capture; settle warnings propagate to bundle.
- **note:** if Phase 7 DeepPerceiveNode skeleton (T117) is not yet present at Phase 1c implementation time, ship T1C-011 as a forward-stub interface only; full DPN integration moves to Phase 7. Document in `phase-1c-current.md` rollup.
- **conformance test:** `packages/agent-core/tests/conformance/deep-perceive-settle.test.ts` (AC-11)

## T1C-012 — Phase 1c integration test *(v0.2 fixture matrix clarified)*
- **dep:** T1C-001 through T1C-011
- **spec:** Phase 1c exit gate
- **files:** `packages/agent-core/tests/integration/perception-bundle.test.ts`
- **acceptance (v0.2):** Build PerceptionBundle on **5 fixture sites**:
  1. **homepage** — baseline content (re-use Phase 1 example.com or Peregrine content fixture)
  2. **PDP** — Phase 1b commerce fixture (re-use amazon-in-pdp.json)
  3. **cart** — Phase 1b cart fixture (re-use peregrine-cart.json)
  4. **checkout** — Stripe-iframe inner-page (NEW fixture for Phase 1c; exercises T1C-005 checkout descent)
  5. **SPA-trait-rich** — single trait-rich fixture exercising **simultaneously**: Optimizely-instrumented (`window.optimizely` script-presence) + Shadow-DOM-deep (depth-7 nested shadow roots → `SHADOW_DOM_NOT_TRAVERSED` at depth 5) + React-Portal-deep (modal portal via `createPortal` outside logical tree). Collapses what v0.1 cited as 3 separate fixtures.
  
  All channels populated on each fixture. **ENVELOPE-ONLY ≤2K per state** (per NF-01 v0.2). ElementGraph ≤30 elements per state. `bundleToAnalyzePerception()` returns identical v2.4 shape on baseline fixtures. Nondeterminism flag `optimizely_active` fires on SPA-trait-rich. Warning `SHADOW_DOM_NOT_TRAVERSED` fires on SPA-trait-rich. **Namespace-contract assertion passes** (`bundle.raw.page_state_model_by_state[*]._extensions` is `undefined` or `{}` — Phase 1b §11 carryforward). Backward-compat with v2.4 consumers verified — existing T015 (Phase 1 test) and T1B-012 (Phase 1b test) still pass.
- **integration test:** `packages/agent-core/tests/integration/perception-bundle.test.ts` (AC-12)

---

## Phase exit checklist *(v0.2 updated)*

Before declaring Phase 1c complete:

- [ ] AC-01..AC-12 conformance tests all passing
- [ ] Phase 1 (T015) and Phase 1b (T1B-012) integration tests pass unchanged on v2.5 code via `bundleToAnalyzePerception()` accessor
- [ ] **Envelope-only token budget ≤2K per state** verified across 5 integration fixtures (per NF-01 v0.2)
- [ ] **Namespace-contract assertion passes** on all integration fixtures (`_extensions.*` absent or empty per Phase 1b §11 carryforward)
- [ ] **Settle 5s hard cap honored** — every fixture resolves within 5050ms (NF-05; v0.2 Promise.race wrapper)
- [ ] `element_id` stability test passes (same URL re-run produces identical IDs)
- [ ] `llm_call_log` row count diff = 0 (zero new LLM calls — NF-03)
- [ ] Settle p50 regression ≤+200ms vs Phase 1b T015 baseline (NF-02)
- [ ] `phase-1c-current.md` rollup drafted and approved
- [ ] `phase-1c-validation.md` sibling validation doc authored (R19 + master orchestrator Stage 4 requirement)
- [ ] PR Contract block (per CLAUDE.md §6) attached to merge PR
- [ ] No stray edits outside `packages/agent-core/src/perception/` and the DeepPerceiveNode skeleton

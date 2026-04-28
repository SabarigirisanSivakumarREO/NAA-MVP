---
title: Phase 1c — PerceptionBundle Envelope v2.5 — Tasks
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
  - docs/specs/mvp/tasks-v2.md (T1C-001..T1C-012, lines 254-329 — CANONICAL DEFINITIONS)
  - docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md
  - docs/specs/mvp/phases/phase-1c-perception-bundle/plan.md

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
  new:
    - Phase 1c tasks — sourced from tasks-v2.md (T1C-001..T1C-012)
  changed: []
  impacted: []
  unchanged:
    - All 12 task IDs and acceptance criteria are CANONICAL in tasks-v2.md; this file is a phase-scoped view

governing_rules:
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R18 (Append-only IDs)
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

## T1C-005 — IframePolicyEngine
- **dep:** T013, T1B-009 (CommerceBlockExtractor for purposeGuess context)
- **spec:** REQ-BROWSE-PERCEPT-007 (iframe policy)
- **files:** `packages/agent-core/src/perception/IframePolicyEngine.ts`
- **acceptance:** Process 5 iframe types. checkout (stripe.com) + chat (intercom) → descend. video (youtube) + analytics (gtm) + social_embed (twitter) → skip + emit `IFRAME_SKIPPED` warning. Cross-origin always skipped.
- **conformance test:** `packages/agent-core/tests/conformance/iframe-policy-engine.test.ts` (AC-05)
- **classifier:** see [plan.md §2.6](plan.md)

## T1C-006 — HiddenElementCapture
- **dep:** T013
- **spec:** REQ-BROWSE-PERCEPT-008
- **files:** `packages/agent-core/src/perception/HiddenElementCapture.ts`
- **acceptance:** Capture `display:none` + `aria-hidden=true` + `visibility:hidden` + offscreen + zero-dimension. `hiddenElements[]` populated with selector + reason.
- **conformance test:** `packages/agent-core/tests/conformance/hidden-element-capture.test.ts` (AC-06)

## T1C-007 — ElementGraphBuilder
- **dep:** T1C-002, T1C-003, T1C-004, T1C-005, T1C-006, T1B-011 (v2.4 schema)
- **spec:** §07 §7.9.3 ElementGraph + FusedElement
- **files:** `packages/agent-core/src/perception/ElementGraphBuilder.ts`
- **acceptance:** Build fused graph from 5 fixture pages. Top-30 elements per state with stable `element_id`. AX + DOM + bbox + style + crop_url joined. `ref_in_analyze_perception` cross-references populated to link FusedElement back to v2.3/v2.4 array indices. `element_id` stable across re-runs of same URL.
- **stability rules:** see [plan.md §2.3](plan.md)
- **conformance test:** `packages/agent-core/tests/conformance/element-graph-builder.test.ts` (AC-07)

## T1C-008 — NondeterminismDetector
- **dep:** T013
- **spec:** §07 §7.9.3 nondeterminism_flags
- **files:** `packages/agent-core/src/perception/NondeterminismDetector.ts`
- **acceptance:** Detect Optimizely / VWO / Google Optimize via script presence + cookie patterns. Detect personalization cookies. Detect ad auctions. Detect time-based content via runtime probe. `nondeterminism_flags[]` populated with specific flags per detector.
- **conformance test:** `packages/agent-core/tests/conformance/nondeterminism-detector.test.ts` (AC-08)

## T1C-009 — WarningEmitter
- **dep:** T1C-001, T1C-002, T1C-005, T1C-007
- **spec:** §07 §7.9.3 warnings
- **files:** `packages/agent-core/src/perception/WarningEmitter.ts`
- **acceptance:** Emit warnings during capture across all 8 documented warning codes. Bundle has `warnings[]` with code + message + severity. Severity routing: info / warn / error.
- **conformance test:** `packages/agent-core/tests/conformance/warning-emitter.test.ts` (AC-09)

## T1C-010 — PerceptionBundle (Zod schema + envelope)
- **dep:** T1C-001 through T1C-009
- **spec:** §07 §7.9.3 PerceptionBundle
- **files:** `packages/agent-core/src/perception/PerceptionBundle.ts`
- **acceptance:** Wrap existing AnalyzePerception + ElementGraph + state nodes. Bundle Zod-validates. Backward-compat helper `bundleToAnalyzePerception()` returns existing v2.4 shape from bundle. Token budget ≤8.5K per state. Bundle is immutable after capture (Object.freeze).
- **conformance test:** `packages/agent-core/tests/conformance/perception-bundle.test.ts` (AC-10)

## T1C-011 — Settle integration into deep_perceive
- **dep:** T1C-001, T117 (DeepPerceiveNode from Phase 7 — forward-stub here, populate in Phase 7)
- **spec:** §07 §7.5 deep_perceive
- **files:** `packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts` (extend skeleton)
- **acceptance:** Run settle before AnalyzePerception capture. Settle predicate gates capture; settle warnings propagate to bundle.
- **note:** if Phase 7 DeepPerceiveNode skeleton (T117) is not yet present at Phase 1c implementation time, ship T1C-011 as a forward-stub interface only; full DPN integration moves to Phase 7. Document in `phase-1c-current.md` rollup.
- **conformance test:** `packages/agent-core/tests/conformance/deep-perceive-settle.test.ts` (AC-11)

## T1C-012 — Phase 1c integration test
- **dep:** T1C-001 through T1C-011
- **spec:** Phase 1c exit gate
- **files:** `packages/agent-core/tests/integration/perception-bundle.test.ts`
- **acceptance:** Build PerceptionBundle on 5 fixture sites (homepage, PDP, cart, checkout, SPA-heavy). All channels populated. Bundle ≤8.5K tokens per state. ElementGraph ≤30 elements. `bundleToAnalyzePerception()` returns identical v2.4 shape on baseline fixtures. Nondeterminism flags emit on Optimizely-enabled fixture. Warnings emit on Shadow-DOM-deep fixture. Backward-compat with v2.4 consumers verified — existing T015 (Phase 1 test) and T1B-012 (Phase 1b test) still pass.
- **integration test:** `packages/agent-core/tests/integration/perception-bundle.test.ts` (AC-12)

---

## Phase exit checklist

Before declaring Phase 1c complete:

- [ ] AC-01..AC-12 conformance tests all passing
- [ ] Phase 1 (T015) and Phase 1b (T1B-012) integration tests pass unchanged on v2.5 code
- [ ] Token budget ≤8.5K per state verified across 5 integration fixtures
- [ ] `element_id` stability test passes (same URL re-run produces identical IDs)
- [ ] `llm_call_log` row count diff = 0 (zero new LLM calls — NF-03)
- [ ] Settle p50 regression ≤+200ms vs v2.4 (NF-02)
- [ ] `phase-1c-current.md` rollup drafted and approved
- [ ] PR Contract block (per CLAUDE.md §6) attached to merge PR
- [ ] No stray edits outside `packages/agent-core/src/perception/` and the DeepPerceiveNode skeleton

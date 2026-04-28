---
title: Phase 1b — Perception Extensions v2.4 — Tasks
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
  - docs/specs/mvp/tasks-v2.md (T1B-001..T1B-012, lines 176-251 — CANONICAL DEFINITIONS)
  - docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md
  - docs/specs/mvp/phases/phase-1b-perception-extensions/plan.md

req_ids:
  - REQ-ANALYZE-PERCEPTION-V24-001

impact_analysis: docs/specs/mvp/phases/phase-1b-perception-extensions/impact.md
breaking: false
affected_contracts:
  - AnalyzePerception

delta:
  new:
    - Phase 1b tasks — sourced from tasks-v2.md (T1B-001..T1B-012)
  changed: []
  impacted: []
  unchanged:
    - All 12 task IDs and acceptance criteria are CANONICAL in tasks-v2.md; this file is a phase-scoped view

governing_rules:
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R18 (Append-only IDs)
---

# Phase 1b Tasks (T1B-001 to T1B-012)

> **Summary (~80 tokens):** 12 tasks. T1B-001..T1B-010 implement the 10 perception extractors (mostly independent; one dependency chain via T1B-005 ← T1B-004). T1B-011 closes the v2.4 Zod schema. T1B-012 is the phase exit gate (5-fixture integration). Total effort ~11h ±2. Canonical task definitions live in `tasks-v2.md` lines 176-251 — this file references them with phase-scoped sequencing.

**Source of truth:** `docs/specs/mvp/tasks-v2.md` lines 176-251. Acceptance criteria, file paths, and dependencies below are mirrored verbatim — **do NOT modify this file in lieu of updating `tasks-v2.md`**.

---

## Phase 1b sequencing

Per [plan.md](plan.md) §1, parallelize Day 1-2 (T1B-001/002/003/006/009/010), Day 3 (T1B-004/008/007), Day 4 (T1B-005/011/012).

---

## T1B-001 — PricingExtractor
- **dep:** T013, T014
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (pricing block)
- **files:** `packages/agent-core/src/perception/extensions/PricingExtractor.ts`
- **acceptance:** Extract from PDP fixture. `pricing.{displayFormat, amount, amountNumeric, currency, taxInclusion, anchorPrice, discountPercent, comparisonShown, boundingBox}` populated when present; `null` when absent.
- **conformance test:** `packages/agent-core/tests/conformance/pricing-extractor.test.ts` (AC-01)

## T1B-002 — ClickTargetSizer
- **dep:** T013
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (clickTargets[])
- **files:** `packages/agent-core/src/perception/extensions/ClickTargetSizer.ts`
- **acceptance:** Compute `clickTargets[]` on 5 fixtures. `isMobileTapFriendly` true for ≥48×48 px (WCAG 2.5.5), false for <48×48; `elementType` correctly classified as cta / link / form_control / icon_button.
- **conformance test:** `packages/agent-core/tests/conformance/click-target-sizer.test.ts` (AC-02)

## T1B-003 — StickyElementDetector
- **dep:** T013
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (stickyElements[])
- **files:** `packages/agent-core/src/perception/extensions/StickyElementDetector.ts`
- **acceptance:** Detect sticky CTA / cart / nav on test fixtures. `stickyElements[]` populated with `type`, `positionStrategy` ("sticky" / "fixed"), `viewportCoveragePercent`, `isAboveFold`, `containsPrimaryCta`.
- **conformance test:** `packages/agent-core/tests/conformance/sticky-element-detector.test.ts` (AC-03)

## T1B-004 — PopupPresenceDetector (presence-only — behavior in Phase 5b)
- **dep:** T013
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (popups[] presence layer)
- **files:** `packages/agent-core/src/perception/extensions/PopupPresenceDetector.ts`
- **acceptance:** Detect modal / cookie banner / consent at page load. `popups[]` populated with `type`, `isInitiallyOpen`, `hasCloseButton`, `closeButtonAccessibleName`, `viewportCoveragePercent`, `blocksPrimaryContent`. Behavior fields (`isEscapeDismissible`, `isClickOutsideDismissible`) **null** until Phase 5b populates them.
- **conformance test:** `packages/agent-core/tests/conformance/popup-presence-detector.test.ts` (AC-04)

## T1B-005 — FrictionScorer
- **dep:** T1B-004, T013
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (frictionScore)
- **files:** `packages/agent-core/src/perception/extensions/FrictionScorer.ts`
- **acceptance:** Compute on form + popup fixtures. `frictionScore.{totalFormFields, requiredFormFields, popupCount, forcedActionCount, raw, normalized}` computed; `normalized` ∈ [0, 1].
- **formula:** see [plan.md §2.4](plan.md)
- **conformance test:** `packages/agent-core/tests/conformance/friction-scorer.test.ts` (AC-05)

## T1B-006 — SocialProofDepthEnricher
- **dep:** T013
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (socialProofDepth)
- **files:** `packages/agent-core/src/perception/extensions/SocialProofDepthEnricher.ts`
- **acceptance:** Extract from review-block fixture. `socialProofDepth.{reviewCount, starDistribution, recencyDays, hasAggregateRating, hasIndividualReviews, thirdPartyVerified}` populated.
- **conformance test:** `packages/agent-core/tests/conformance/social-proof-depth.test.ts` (AC-06)

## T1B-007 — MicrocopyTagger
- **dep:** T013, ground-truth fixture set (ASK FIRST if not authored)
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (microcopy.nearCtaTags[])
- **files:** `packages/agent-core/src/perception/extensions/MicrocopyTagger.ts`
- **acceptance:** Tag near-CTA microcopy on 5 fixtures with manual ground truth. Tags applied: `risk_reducer` / `urgency` / `security` / `guarantee` / `social_proof` / `value_prop`. Achieves ≥80% precision against ground truth.
- **kill criteria:** if precision <70% after one tuning pass, drop nearCtaTags to `[]` and defer LLM-tagging to Phase 6 (see plan.md §3).
- **conformance test:** `packages/agent-core/tests/conformance/microcopy-tagger.test.ts` (AC-07)

## T1B-008 — AttentionScorer
- **dep:** T013
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (attention)
- **files:** `packages/agent-core/src/perception/extensions/AttentionScorer.ts`
- **acceptance:** Compute dominant element + 3 contrast hotspots on test fixtures. `attention.dominantElement` populated with `type` / `selector` / `score` ∈ [0, 1]; `contrastHotspots[]` has 3 entries with `boundingBox` + `contrastScore`.
- **conformance test:** `packages/agent-core/tests/conformance/attention-scorer.test.ts` (AC-08)

## T1B-009 — CommerceBlockExtractor
- **dep:** T013
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (commerce)
- **files:** `packages/agent-core/src/perception/extensions/CommerceBlockExtractor.ts`
- **acceptance:** Extract on PDP / cart / checkout fixtures. `commerce.{isCommerce, stockStatus, stockMessage, shippingSignals[], returnPolicyPresent, returnPolicyText, guaranteeText}` populated when commerce; `isCommerce` false on non-commerce pages.
- **conformance test:** `packages/agent-core/tests/conformance/commerce-block-extractor.test.ts` (AC-09)

## T1B-010 — CurrencySwitcherDetector
- **dep:** T013
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (metadata.currencySwitcher)
- **files:** `packages/agent-core/src/perception/extensions/CurrencySwitcherDetector.ts`
- **acceptance:** Detect switcher in nav fixtures. `metadata.currencySwitcher.{present, currentCurrency, availableCurrencies, isAccessibleAt}` populated; `null` when no switcher present.
- **conformance test:** `packages/agent-core/tests/conformance/currency-switcher-detector.test.ts` (AC-10)

## T1B-011 — AnalyzePerception v2.4 schema (Zod)
- **dep:** T1B-001 through T1B-010, T014
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (full schema)
- **files:** `packages/agent-core/src/perception/schema.ts`
- **acceptance:** Zod schema validates all 10 new field groups. Backward-compat with v2.3 maintained — existing v2.3 consumers continue to work without modification. Total payload ≤6.5K tokens.
- **conformance test:** `packages/agent-core/tests/conformance/analyze-perception-v24-schema.test.ts` (AC-11)

## T1B-012 — Phase 1b integration test
- **dep:** T1B-001 through T1B-011
- **spec:** Phase 1b exit gate
- **files:** `packages/agent-core/tests/integration/perception-extensions.test.ts`
- **acceptance:** Run on 5 fixture sites (homepage, PDP, cart, checkout, content). All 10 extensions populate without error. Backward-compat verified. Token budget ≤6.5K. No regression on v2.3 fields.
- **integration test:** `packages/agent-core/tests/integration/perception-extensions.test.ts` (AC-12)

---

## Phase exit checklist

Before declaring Phase 1b complete:

- [ ] AC-01..AC-12 conformance tests all passing
- [ ] Phase 1 (v2.3) integration test (T015) passes unchanged on v2.4 code
- [ ] Token budget ≤6.5K verified across 5 integration fixtures
- [ ] `llm_call_log` row count diff = 0 (zero new LLM calls — NF-03)
- [ ] Browser-time p50 regression ≤+150ms vs v2.3 (NF-02)
- [ ] `phase-1b-current.md` rollup drafted and approved
- [ ] PR Contract block (per CLAUDE.md §6) attached to merge PR
- [ ] No stray edits outside `packages/agent-core/src/perception/extensions/` and `packages/agent-core/src/perception/schema.ts`

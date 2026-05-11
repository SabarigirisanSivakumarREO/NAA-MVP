---
title: Phase 1b — Perception Extensions (PageStateModel extension) — Tasks
artifact_type: tasks
status: approved
version: 0.2
created: 2026-04-28
updated: 2026-05-09
owner: engineering lead
authors: [Claude (drafter v0.1), Claude (master orchestrator REVISE v0.2)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/tasks-v2.md (T1B-001..T1B-012, lines 176-251 — CANONICAL DEFINITIONS; T1B-000 added in this phase per Path B — pending v2.3.4 alignment)
  - docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md v0.2
  - docs/specs/mvp/phases/phase-1b-perception-extensions/plan.md v0.2
  - .phase-state/1b/preflight-verdict.yaml (Gate 1 REVISE — Path B + popup option a + bundled polish)

req_ids:
  - REQ-ANALYZE-PERCEPTION-V24-001

impact_analysis: docs/specs/mvp/phases/phase-1b-perception-extensions/impact.md
breaking: false
affected_contracts:
  - PageStateModel

delta:
  new:
    - v0.1 (2026-04-28) — Phase 1b tasks sourced from tasks-v2.md (T1B-001..T1B-012)
    - v0.2 — T1B-000 PageStateModel substrate extension task (Path B per Gate 1 REVISE) — pending tasks-v2.md v2.3.4 alignment
  changed:
    - v0.2 — Contract name AnalyzePerception → PageStateModel (C1)
    - v0.2 — T1B-001..T1B-010 deps add T1B-000 (substrate dependency)
    - v0.2 — T1B-004 popup type list expanded 6 → 11 (popup option a)
    - v0.2 — T1B-007 Cialdini-collapse note added
    - v0.2 — T1B-011 file path schema.ts → types.ts (C3)
    - v0.2 — T1B-012 fixture set 5 fresh → 3 reuse + 2 new (H3)
  impacted: []
  unchanged:
    - All T1B-NNN stable IDs preserved (R18)
    - T1B-001..T1B-012 acceptance criteria text canonical in tasks-v2.md (only minor wording polish locally)
    - Phase exit checklist structure

governing_rules:
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R11.4 (Fix spec before implementing)
  - Constitution R18 (Append-only IDs)
---

# Phase 1b Tasks (T1B-000 to T1B-012)

> **Summary (~90 tokens):** 13 tasks. T1B-000 (NEW v0.2 — Path B) extends Phase 1's PageStateModel with substrate fields. T1B-001..T1B-010 implement the 10 perception extractors (read substrate via ExtractCtx). T1B-011 closes the extended Zod schema. T1B-012 is the phase exit gate (5-fixture integration; 3 Phase 1 reuse + 2 new). Total effort ~13.5h ±2.5. Canonical task definitions for T1B-001..T1B-012 live in `tasks-v2.md` lines 176-251; T1B-000 is pending v2.3.4 alignment.

**Source of truth:** `docs/specs/mvp/tasks-v2.md` lines 176-251 (T1B-001..T1B-012). T1B-000 is a Phase 1b-local addition pending canonical alignment in tasks-v2.md v2.3.4. Acceptance criteria, file paths, and dependencies below for T1B-001..T1B-012 are mirrored from tasks-v2.md with v0.2 polish — **do NOT modify this file in lieu of updating `tasks-v2.md`**.

---

## Phase 1b sequencing

Per [plan.md](plan.md) §1:
- **Day 0 (sequential):** T1B-000 substrate extension first
- **Day 1-2 (parallelizable; all depend on T1B-000):** T1B-001 / 002 / 003 / 006 / 009 / 010
- **Day 3:** T1B-004 (popup option a — 11-type enum) / 008 / 007 (ground-truth dependent)
- **Day 4:** T1B-005 / 011 / 012

---

## T1B-000 — PageStateModel substrate extension *(v0.2 NEW — Path B)* — ✅ DONE 2026-05-09 (commit 7bbfe77)
- **dep:** T013 (ContextAssembler), T014 (PageStateModel types.ts) — both shipped Phase 1
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (substrate prerequisites per spec R-00)
- **files:**
  - `packages/agent-core/src/perception/types.ts` (extends Phase 1's existing PageStateModelSchema additively)
  - `packages/agent-core/src/perception/extensions/SubstrateExtension.ts` (NEW — implements the extraction)
  - `packages/agent-core/src/perception/ContextAssembler.ts` (modifies — its single page.evaluate() call invokes SubstrateExtension)
  - `packages/agent-core/tests/fixtures/perception/peregrine-pdp.json` (modifies — adds substrate fields to the existing walking-skeleton fixture so it stays valid)
- **acceptance:** PageStateModel gains `ctas[]` (text/selector/sizePx/index/role from AX-tree), `formFields[]` (input/select/textarea enumeration with type + required), `metadata.schemaOrg` (parsed JSON-LD), `metadata.ogTags` (Record<string,string>), `headings[]` (h1..h6 level + text + selector), `primaryActions` (the dominant CTA per page — typically the first non-link button in viewport). Phase 1's 6 sub-schemas validate identically. Phase 1 integration test (T015) passes unchanged. Walking-skeleton 7/7 passes unchanged.
- **kill criteria:** if substrate ships wrong shape (e.g., schemaOrg parse fails on amazon.in / Peregrine), STOP T1B-001..T1B-010 dispatch; redesign first. See plan.md §3 last row.
- **conformance test:** `packages/agent-core/tests/conformance/page-state-model-extended.test.ts` (AC-00 + AC-11 shared)

## T1B-001 — PricingExtractor
- **dep:** T013, T014, **T1B-000** (substrate)
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (pricing block)
- **files:** `packages/agent-core/src/perception/extensions/PricingExtractor.ts`
- **acceptance:** Extract from PDP fixture. `pricing.{displayFormat, amount, amountNumeric, currency, taxInclusion, anchorPrice, discountPercent, comparisonShown, boundingBox}` populated when present; `null` when absent. Reads `ctx.metadata.schemaOrg` (JSON-LD Offer) + on-page text patterns.
- **conformance test:** `packages/agent-core/tests/conformance/pricing-extractor.test.ts` (AC-01)

## T1B-002 — ClickTargetSizer
- **dep:** T013, **T1B-000** (substrate ctas[])
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (clickTargets[])
- **files:** `packages/agent-core/src/perception/extensions/ClickTargetSizer.ts`
- **acceptance:** Compute `clickTargets[]` on 5 fixtures (3 Phase 1 reuse + 2 new). `isMobileTapFriendly` true for ≥48×48 px (per WCAG 2.5.5 / Google mobile-friendly threshold), false for <48×48; `elementType` correctly classified as cta / link / form_control / icon_button (4-type coarse enum; finer-grained types deferred per spec §Out of Scope).
- **conformance test:** `packages/agent-core/tests/conformance/click-target-sizer.test.ts` (AC-02)

## T1B-003 — StickyElementDetector
- **dep:** T013, **T1B-000** (substrate ctas[] for containsPrimaryCta)
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (stickyElements[])
- **files:** `packages/agent-core/src/perception/extensions/StickyElementDetector.ts`
- **acceptance:** Detect sticky CTA / cart / nav on test fixtures. `stickyElements[]` populated with `type` (open string), `positionStrategy` ("sticky" / "fixed"), `viewportCoveragePercent`, `isAboveFold`, `containsPrimaryCta`.
- **conformance test:** `packages/agent-core/tests/conformance/sticky-element-detector.test.ts` (AC-03)

## T1B-004 — PopupPresenceDetector (presence-only — behavior in Phase 5b)
- **dep:** T013, **T1B-000** (substrate)
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (popups[] presence layer)
- **files:** `packages/agent-core/src/perception/extensions/PopupPresenceDetector.ts`
- **acceptance:** Detect popup PRESENCE at page load. `popups[]` populated with `type` ∈ {`modal`, `lightbox`, `drawer`, `toast`, `cookie_banner`, `consent_form`, `slide_in_panel`, `exit_intent_overlay`, `chat_widget`, `paywall`, `other`} *(v0.2 — 11-type enum per popup option a; `other` is the fallback)*, `isInitiallyOpen`, `hasCloseButton`, `closeButtonAccessibleName`, `viewportCoveragePercent`, `blocksPrimaryContent`. Behavior fields (`isEscapeDismissible`, `isClickOutsideDismissible`) **null** until Phase 5b populates them.
- **conformance test:** `packages/agent-core/tests/conformance/popup-presence-detector.test.ts` (AC-04)

## T1B-005 — FrictionScorer
- **dep:** T1B-004, T013, **T1B-000** (substrate formFields[])
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (frictionScore)
- **files:** `packages/agent-core/src/perception/extensions/FrictionScorer.ts`
- **acceptance:** Compute on form + popup fixtures. `frictionScore.{totalFormFields, requiredFormFields, popupCount, forcedActionCount, raw, normalized}` computed; `normalized` ∈ [0, 1]. Reads `ctx.formFields[]` (from T1B-000) + `ctx.popups[]` (from T1B-004).
- **formula:** see [plan.md §2.4](plan.md)
- **conformance test:** `packages/agent-core/tests/conformance/friction-scorer.test.ts` (AC-05)

## T1B-006 — SocialProofDepthEnricher
- **dep:** T013, **T1B-000** (substrate metadata.schemaOrg)
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (socialProofDepth)
- **files:** `packages/agent-core/src/perception/extensions/SocialProofDepthEnricher.ts`
- **acceptance:** Extract from review-block fixture. `socialProofDepth.{reviewCount, starDistribution, recencyDays, hasAggregateRating, hasIndividualReviews, thirdPartyVerified}` populated. Reads `ctx.metadata.schemaOrg` for JSON-LD AggregateRating where available.
- **conformance test:** `packages/agent-core/tests/conformance/social-proof-depth.test.ts` (AC-06)

## T1B-007 — MicrocopyTagger
- **dep:** T013, **T1B-000** (substrate ctas[] for index lookup), ground-truth fixture set (ASK FIRST if not authored)
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (microcopy.nearCtaTags[])
- **files:** `packages/agent-core/src/perception/extensions/MicrocopyTagger.ts`
- **acceptance:** Tag near-CTA microcopy on 5 fixtures with manual ground truth. Reads `ctx.ctas[]` (T1B-000) by index. Tags applied: `risk_reducer` / `urgency` / `security` / `guarantee` / `social_proof` / `value_prop` / `other` (7-tag taxonomy — Cialdini-principle granularity deferred to Phase 6 LLM-tagging per spec §Out of Scope v0.2). Achieves ≥80% precision against ground truth.
- **kill criteria:** if precision <70% after one tuning pass, drop nearCtaTags to `[]` and defer LLM-tagging to Phase 6 (see plan.md §3).
- **conformance test:** `packages/agent-core/tests/conformance/microcopy-tagger.test.ts` (AC-07)

## T1B-008 — AttentionScorer
- **dep:** T013, **T1B-000** (substrate primaryActions for dominantElement candidate)
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (attention)
- **files:** `packages/agent-core/src/perception/extensions/AttentionScorer.ts`
- **acceptance:** Compute dominant element + 3 contrast hotspots on test fixtures. `attention.dominantElement` populated with `type` / `selector` / `score` ∈ [0, 1] (or `null` if no element scores >0.3); `contrastHotspots[]` has 3 entries with `boundingBox` + `contrastScore` from Sharp pipeline.
- **conformance test:** `packages/agent-core/tests/conformance/attention-scorer.test.ts` (AC-08)

## T1B-009 — CommerceBlockExtractor
- **dep:** T013, **T1B-000** (substrate metadata.schemaOrg + primaryActions), T1B-001 (pricing from R-01 runs first)
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (commerce)
- **files:** `packages/agent-core/src/perception/extensions/CommerceBlockExtractor.ts`
- **acceptance:** Extract on PDP / cart / checkout fixtures. `commerce.{isCommerce, stockStatus, stockMessage, shippingSignals[], returnPolicyPresent, returnPolicyText, guaranteeText}` populated when commerce; `isCommerce` false on non-commerce pages. Reads `ctx.metadata.schemaOrg` (Offer/AggregateOffer) + `ctx.primaryActions` (ATC CTA pattern) + `ctx.pricing` (R-01 result — runs first; no circular dep).
- **conformance test:** `packages/agent-core/tests/conformance/commerce-block-extractor.test.ts` (AC-09)

## T1B-010 — CurrencySwitcherDetector
- **dep:** T013, **T1B-000** (substrate)
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (metadata.currencySwitcher)
- **files:** `packages/agent-core/src/perception/extensions/CurrencySwitcherDetector.ts`
- **acceptance:** Detect switcher in nav fixtures (interactive button/select; not passive lists). `metadata.currencySwitcher.{present, currentCurrency, availableCurrencies, isAccessibleAt}` populated with `isAccessibleAt` ∈ {`header`, `footer`, `none`}; `null` when no switcher present. account_menu / settings_modal / sidebar locations deferred per spec §Out of Scope v0.2.
- **conformance test:** `packages/agent-core/tests/conformance/currency-switcher-detector.test.ts` (AC-10)

## T1B-011 — PageStateModel extended schema (Zod)
- **dep:** T1B-000, T1B-001 through T1B-010, T014
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (full schema)
- **files:** `packages/agent-core/src/perception/types.ts` (extends Phase 1's existing PageStateModelSchema; same file as T014 + T1B-000)
- **acceptance:** Zod schema validates all 10 new Phase 1b field groups + T1B-000 substrate. Backward-compat maintained — Phase 1's 6 sub-schemas validate identically; Phase 1 consumers (walking-skeleton; ContextAssembler.capture() callers) continue to work without modification. Total payload ≤20K tokens (Phase 1's NF-Phase1-01 v0.4 cap unchanged).
- **conformance test:** `packages/agent-core/tests/conformance/page-state-model-extended.test.ts` (AC-11; same file as AC-00 conformance test)

## T1B-012 — Phase 1b integration test
- **dep:** T1B-000 through T1B-011
- **spec:** Phase 1b exit gate
- **files:** `packages/agent-core/tests/integration/perception-extensions.test.ts`
- **acceptance:** Run on 5 fixture sites: 3 reused from Phase 1 (example.com homepage, amazon.in PDP, Peregrine PDP) + 2 new (Peregrine cart, Peregrine content). All 10 Phase 1b extensions populate without error + T1B-000 substrate populates without error on all 5. Backward-compat verified via Phase 1 integration test (T015) re-run + walking-skeleton 7/7 acceptance re-run. Token budget ≤20K on every fixture (Phase 1 cap unchanged). Zero new LLM calls (`llm_call_log` diff = 0).
- **integration test:** `packages/agent-core/tests/integration/perception-extensions.test.ts` (AC-12)

---

## Phase exit checklist

Before declaring Phase 1b complete:

- [ ] AC-00..AC-12 conformance tests all passing (13 tests)
- [ ] Phase 1 integration test (T015 in `tests/integration/phase1.test.ts`) passes unchanged
- [ ] Walking-skeleton acceptance suite (7/7 at `tests/acceptance/walking-skeleton.spec.ts`) passes unchanged
- [ ] Token budget ≤20K verified across 5 integration fixtures (Phase 1's NF-Phase1-01 v0.4 cap — unchanged)
- [ ] `llm_call_log` row count diff = 0 (zero new LLM calls — NF-03)
- [ ] Browser-time p50 regression ≤+150ms vs Phase 1 baseline (NF-02)
- [ ] Phase 1b rollup at `phase-1b-current.md` drafted and approved (Stage 4 master-orchestrator deliverable)
- [ ] PR Contract block (per CLAUDE.md §6 + PRD §10.9) attached to merge PR
- [ ] No stray edits outside `packages/agent-core/src/perception/extensions/` and `packages/agent-core/src/perception/types.ts` and `packages/agent-core/src/perception/ContextAssembler.ts` and the Peregrine fixture
- [ ] Namespace contract honored — no additions under `_extensions.*` (see impact.md §11)

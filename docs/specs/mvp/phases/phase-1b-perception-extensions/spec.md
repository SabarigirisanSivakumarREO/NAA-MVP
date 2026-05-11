---
title: Phase 1b — Perception Extensions (PageStateModel extension)
artifact_type: spec
status: validated
version: 0.2
created: 2026-04-28
updated: 2026-05-09
owner: engineering lead
authors: [Claude (drafter v0.1), Claude (master orchestrator REVISE v0.2)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (F-004 Browser Perception)
  - docs/specs/mvp/constitution.md (R1-R26; especially R10 budget, R11 spec discipline, R20 impact, R24 perception MUST NOT)
  - docs/specs/mvp/architecture.md (§6.4 tech stack, §6.5 file locations)
  - docs/specs/mvp/tasks-v2.md (T1B-001..T1B-012, lines 176-251)
  - docs/specs/final-architecture/07-analyze-mode.md §7.9.2 (REQ-ANALYZE-PERCEPTION-V24-001)
  - docs/specs/final-architecture/16-implementation-phases.md (Phase 1b row, week 2-3)
  - docs/Improvement/perception_layer_spec.md (gap-closure items 1-10)
  - docs/specs/mvp/phases/phase-1-perception/spec.md v0.4 (Phase 1 prerequisite — PageStateModel baseline; supersedes the architecture-spec "AnalyzePerception v2.3" name)
  - docs/specs/mvp/phases/phase-1-perception/phase-1-current.md (R19 rollup — token budget NF-Phase1-01 v0.4 = 20K; _extensions namespace reserved for Phase 7)
  - .phase-state/1b/preflight-verdict.yaml (Gate 1 REVISE 2026-05-09 — Path B + popup option a + bundled polish)

req_ids:
  - REQ-ANALYZE-PERCEPTION-V24-001

impact_analysis: docs/specs/mvp/phases/phase-1b-perception-extensions/impact.md
breaking: false
affected_contracts:
  - PageStateModel

delta:
  new:
    - v0.1 (2026-04-28) — Phase 1b spec; adds 10 perception extensions; AC-01..AC-12 + R-01..R-11 stable IDs
    - v0.2 (2026-05-09) — T1B-000 PageStateModel substrate extension task (Path B per Gate 1 REVISE)
    - v0.2 — 4 new popup types (slide_in_panel, exit_intent_overlay, chat_widget, paywall) in R-04 + AC-04 (popup option a per Gate 1)
    - v0.2 — Cialdini-collapse rationale note in R-07 + §Out of Scope (completeness SPEC_GAP closure)
    - v0.2 — 3 optional §Out of Scope deferrals (finer-grained click targets; account-tied currency)
  changed:
    - v0.2 — Contract name AnalyzePerception → PageStateModel (C1; Phase 1 ships PageStateModel per phase-1-current.md)
    - v0.2 — Token budget 5K → 6.5K (cap 8K) → 21.5K (Phase 1's 20K NF-Phase1-01 v0.4 baseline + ~1.5K Phase 1b delta) (C4)
    - v0.2 — Section refs §7.7.9.2 → §7.9.2 (M2)
    - v0.2 — R-02 WCAG 2.5.5 citation tightened (M3)
    - v0.2 — R-09 isCommerce ordering clarified — pricing detection (R-01) runs first within same evaluate (M3)
    - v0.2 — Fixture set 5 fresh → 3 Phase 1 reuse (example.com, amazon.in, Peregrine PDP) + 2 new (Peregrine cart, content) (H3)
    - v0.2 — Feature Branch field updated to feat/phase-1b-perception-extensions (L1)
  impacted:
    - PageStateModel schema (Phase 1's 6 sub-schemas + T1B-000 substrate + Phase 1b extensions) — additive only, backward-compatible
    - tasks-v2.md (T1B-001..T1B-012 canonical there; T1B-000 added in this phase's tasks.md; v2.3.4 punch-list queued for canonical alignment)
  unchanged:
    - All AC-NN / R-NN / NF-NN / SC-NNN / T1B-NNN stable IDs preserved (R18)
    - Constitution Alignment Check structure (R5.3 / GR-007 / R7.4 / R9 / R10 / R6 / R3 all still passing)
    - Kill criteria structure (only token-budget threshold value updates; rest stable)
    - 12 perception MCP tools (no new tools — extensions live inside contextAssembler.capture(); MCP wrapping deferred to Phase 2)

governing_rules:
  - Constitution R10 (Budget — extensions stay inside one page.evaluate(); zero LLM cost)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R11.4 (Fix spec before implementing)
  - Constitution R17 (Lifecycle States)
  - Constitution R18 (Delta-Based Updates — append-only AC-NN/R-NN IDs)
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes — PageStateModel is shared contract)
  - Constitution R22 (Ratchet — every claim cites a source)
  - Constitution R24 (Perception MUST NOT — no analysis, no judgment, no LLM calls)
---

# Feature Specification: Phase 1b — Perception Extensions (PageStateModel extension)

> **Summary (~170 tokens — agent reads this first):** Extend Phase 1's `PageStateModel` with 10 new field groups that capture signals top-1% CRO consultants depend on but the Phase 1 baseline misses — pricing display, click target sizing (Fitt's Law / WCAG 2.5.5), sticky elements, popup PRESENCE (behavior in Phase 5b), aggregate friction score, social-proof depth, near-CTA microcopy semantic tags, visual attention / contrast hotspots, commerce signals (stock / shipping / returns), and currency switcher. Path B per Gate 1 REVISE: T1B-000 first adds the substrate fields (ctas[]/formFields[]/schemaOrg/ogTags/headings[]/primaryActions) that downstream extractors read; T1B-001..T1B-010 implement the extensions; T1B-011 closes the Zod schema; T1B-012 is the 5-fixture exit gate. All extractions live inside `contextAssembler.capture()` (Phase 1's actual producer) — zero new LLM calls. Token impact: +1.5K Phase 1b delta absorbed into Phase 1's 20K NF-Phase1-01 v0.4 budget (cap stays at 20K; empirical Phase 1 floor is amazon.in 12,485 + Peregrine 4,012, so ~7K headroom remains).

**Feature Branch:** feat/phase-1b-perception-extensions
**Input:** Phase 1b scope from `docs/specs/mvp/tasks-v2.md` lines 176-251 + `docs/Improvement/perception_layer_spec.md` items 1-10 + `docs/specs/final-architecture/07-analyze-mode.md` §7.9.2 + Phase 1 rollup at `phase-1-perception/phase-1-current.md` (PageStateModel canonical surface)

---

## Mandatory References

When reading this spec, agents must already have loaded:

1. `docs/specs/mvp/constitution.md` — R10 (budget), R11 (spec discipline), R18 (delta), R20 (impact), R24 (perception MUST NOT).
2. `docs/specs/mvp/PRD.md` — F-004 Browser Perception.
3. `docs/specs/final-architecture/07-analyze-mode.md` §7.9 (architectural baseline; still names contract `AnalyzePerception` — see Supersession note below) + §7.9.2 (v2.4 extensions, REQ-ANALYZE-PERCEPTION-V24-001).
4. `docs/specs/mvp/tasks-v2.md` lines 176-251 (T1B-001..T1B-012). T1B-000 is a Phase 1b-local addition pending canonical alignment in tasks-v2.md v2.3.4.
5. `docs/specs/mvp/phases/phase-1-perception/phase-1-current.md` — Phase 1 rollup; canonical surface for `PageStateModel` (6 sub-schemas: Metadata, AccessibilityTree, FilteredDOM, InteractiveGraph, Visual, Diagnostics) + NF-Phase1-01 v0.4 token budget (20K) + `_extensions` namespace reservation for Phase 7.
6. `docs/Improvement/perception_layer_spec.md` — design rationale for the 10 gap-closure items.

**Supersession note (R11.4 — v0.2):** The architecture spec §7.9 uses the legacy contract name `AnalyzePerception`. Phase 1 shipped the implementation as `PageStateModel` (per `packages/agent-core/src/perception/types.ts`, `phase-1-current.md`). This spec uses `PageStateModel` throughout to match the implementation. A future architecture-spec rewrite (queued for v2.3.4 punch-list) will align the name in §7.9.

---

## Constraints Inherited from Neural Canonical Specs

- **R24 (Perception MUST NOT):** Phase 1b stays inside the perception layer. No heuristic judgment, no LLM calls, no scoring, no recommendations — only structured field capture. Heuristics that consume Phase 1b fields are authored later in Phase 6 / Phase 0b.
- **Single-evaluate budget (architecture §7.4):** all extractors run inside the same `page.evaluate()` invocation that `contextAssembler.capture()` already dispatches. Adding a separate browser round-trip per extractor is forbidden (cost discipline).
- **Backward compatibility (R5.1):** Phase 1b is additive against Phase 1's `PageStateModel`. No Phase 1 sub-schema (Metadata, AccessibilityTree, FilteredDOM, InteractiveGraph, Visual, Diagnostics) renamed, removed, or retyped. Phase 1 consumers (walking-skeleton fixture path; `ContextAssembler.capture()` callers) continue without modification.
- **Token cap (NF-Phase1-01 v0.4):** `PageStateModel` payload stays ≤20,000 tokens after Phase 1b (Phase 1's existing budget; Phase 1b's ~1.5K delta absorbed into the ~7K headroom remaining from empirical Phase 1 floor — amazon.in 12,485 + Peregrine 4,012). If a fixture exceeds 20K, the Phase 1 4-stage shrink ladder applies (no Phase 1b-specific cap).
- **Tech stack pinned (architecture §6.4):** TypeScript 5, Playwright pinned, no new vendor dependencies. Sharp already wired for image/contrast computation in Phase 1.
- **No conversion predictions (R5.3 + GR-007):** Phase 1b fields are factual captures only (e.g., `frictionScore.normalized` is a derived metric, not a conversion-rate forecast).
- **No `console.log`** (R10.6) — Pino logger with extractor name + page url + audit_run_id correlation.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Heuristic author analyzes pricing-display patterns (Priority: P1)

A consultant authoring an e-commerce pricing-display heuristic needs to know whether a PDP shows an anchor price, what the discount % is, and whether tax is inclusive. Phase 1's `PageStateModel` ships FilteredDOM and InteractiveGraph but no pricing block; Phase 1b's T1B-000 substrate adds `ctas[]` + `formFields[]` + `schemaOrg` first, then T1B-001 PricingExtractor reads schema.org `Offer` / JSON-LD via the substrate.

**Why this priority:** Pricing display is the single highest-leverage CRO signal for e-commerce (PDPs, cart, checkout). Without it, the heuristic engine cannot author the most valuable rules in the e-commerce vertical.
**Independent Test:** Run `page_analyze` on a Shopify PDP fixture; confirm `pricing.{displayFormat, amount, anchorPrice, discountPercent, taxInclusion}` populate; confirm `pricing` is `null` on a non-commerce page.

**Acceptance Scenarios:**

1. **Given** a PDP fixture with strikethrough `$99` next to `$49`, **When** `page_analyze` runs, **Then** `pricing.amount === "$49"`, `pricing.anchorPrice === "$99"`, `pricing.discountPercent === 50`, `pricing.comparisonShown === true`.
2. **Given** a content page with no pricing, **When** `page_analyze` runs, **Then** `pricing === null` (not `{}`, not throwing).

---

### User Story 2 — Mobile-audit consumer reads click-target sizing (Priority: P1)

A mobile-only audit needs every interactive element's pixel size to flag <48×48 tap targets per WCAG 2.5.5. Phase 1 ships `InteractiveGraph` (clickable elements with selectors) but no per-element bounding-rect sizes; T1B-000 substrate adds `ctas[]` with size + index; T1B-002 ClickTargetSizer reads `ctas[]` and computes WCAG-mobile-friendliness.

**Why this priority:** Mobile UX heuristics are unworkable without size data. Same heuristic ("CTA too small") fires opposite recommendations on desktop vs. mobile.
**Independent Test:** Render a fixture with a 32×32 icon button and a 64×64 primary CTA; confirm `clickTargets[]` lists both with `isMobileTapFriendly` correctly classified.

**Acceptance Scenarios:**

1. **Given** an `<a>` tag styled to 64×64 px, **When** `page_analyze` runs, **Then** `clickTargets[]` contains an entry with `sizePx.{width: 64, height: 64}` and `isMobileTapFriendly: true`.
2. **Given** an icon button at 32×32 px, **Then** the entry shows `isMobileTapFriendly: false`.
3. **Given** the button is above the fold, **Then** `isAboveFold: true`.

---

### User Story 3 — Backward-compat reader continues unchanged (Priority: P1)

A Phase 1 consumer reading `pageStateModel.metadata.title` or `pageStateModel.filteredDOM.top30` must keep working with zero code changes after Phase 1b ships. T1B-000's substrate additions + Phase 1b's 10 extension groups are strictly additive.

**Why this priority:** Phase 1's PageStateModel already powers the walking-skeleton acceptance suite (7/7 tests via `tests/acceptance/walking-skeleton.spec.ts`). Breaking Phase 1 readers blocks the Wednesday demo cadence and Phase 5 browse-mode landing.
**Independent Test:** Run Phase 1 integration test (`T015` in `tests/integration/phase1.test.ts`) unchanged against the v0.2 schema; confirm pass. Re-run walking-skeleton 7/7 acceptance; confirm pass.

**Acceptance Scenarios:**

1. **Given** Phase 1 consumer code reading `pageStateModel.metadata.title`, **When** PageStateModel grows with T1B-000 substrate + Phase 1b extensions, **Then** `metadata.title` still exists with the same shape.
2. **Given** Phase 1 fixture (`peregrine-pdp.json`), **When** `contextAssembler.capture()` runs on the extended schema, **Then** every Phase 1 sub-schema field is populated identically; new T1B-000 + Phase 1b fields appear as additive top-level entries (no `_extensions.*` use — Phase 7's namespace reserved per `phase-1-current.md` §5).

---

### User Story 4 — Popup-presence heuristic gates on Phase 5b behavior (Priority: P2)

A popup-quality heuristic ("popup blocks fold AND is not Escape-dismissible → bad") needs presence in Phase 1b and behavior in Phase 5b. Phase 1b populates the presence layer; behavior fields are `null` until Phase 5b probes them.

**Why this priority:** Popups are visible drivers of bounce, but full evaluation needs runtime probing. Splitting presence (Phase 1b, static) from behavior (Phase 5b, dynamic) lets us ship presence early.
**Independent Test:** Open a fixture with a cookie banner at load; confirm `popups[]` populates with `isInitiallyOpen: true`, `hasCloseButton: true`, AND `isEscapeDismissible: null` (filled by Phase 5b later).

**Acceptance Scenarios:**

1. **Given** a modal open at page load, **When** Phase 1b runs, **Then** `popups[].isInitiallyOpen === true`, `hasCloseButton`, `closeButtonAccessibleName`, `viewportCoveragePercent`, `blocksPrimaryContent` all populated; `isEscapeDismissible === null`, `isClickOutsideDismissible === null`.
2. **Given** an exit-intent overlay firing on mouseleave, **When** Phase 1b runs, **Then** `popups[].type === "exit_intent_overlay"` (one of the 10 enum values per R-04 v0.2).
3. **Given** a slide-in panel mounted at scroll-50%, a chat widget bottom-right, a paywall blocking article content, **Then** each is classified to its specific `type` enum value (not generic `modal`).

---

### Edge Cases

- **No pricing on page** → `pricing: null` (not empty object).
- **No commerce on page** → `commerce.isCommerce === false`, all other commerce fields `null`.
- **No popups on page** → `popups: []` (empty array, not null).
- **Currency switcher not present** → `metadata.currencySwitcher: null`.
- **Hidden CTAs** (display:none) → excluded from `clickTargets[]` per perception convention.
- **Shadow DOM elements** → `clickTargets[]` and `popups[]` traverse shadow roots when v2.3 base traversal does (Phase 1c extends shadow traversal further).
- **Pricing in JSON-LD only, no on-page text** → `pricing.hasPricing === true`, `amount === null`, source flagged in implementation note.
- **Multi-currency page** without switcher (just a list) → `currencySwitcher.present === false`, `availableCurrencies` listed only if there's a real switcher widget.

---

## Acceptance Criteria *(mandatory — stable IDs, append-only)*

| ID | Criterion | Conformance test path | Linked REQ-ID(s) |
|----|-----------|----------------------|------------------|
| AC-00 | *(v0.2 NEW — Path B substrate)* T1B-000 PageStateModel substrate extension populates `ctas[]` (text/selector/sizePx/index), `formFields[]` (selector/type/required), `metadata.schemaOrg` (JSON-LD fragments), `metadata.ogTags` (Record<string,string>), `headings[]` (level/text/selector), `primaryActions` (the dominant CTA per page). Phase 1 sub-schemas (Metadata.title/lang/statusCode, AccessibilityTree, FilteredDOM, InteractiveGraph, Visual, Diagnostics) populate identically to Phase 1's surface. | `packages/agent-core/tests/conformance/page-state-model-extended.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-01 | PricingExtractor populates `pricing.{displayFormat, amount, amountNumeric, currency, taxInclusion, anchorPrice, discountPercent, comparisonShown, boundingBox}` on a PDP fixture; emits `null` on a content page. Reads from `metadata.schemaOrg` (JSON-LD Offer) + on-page text. | `packages/agent-core/tests/conformance/pricing-extractor.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-02 | ClickTargetSizer emits `clickTargets[]` on 5 fixtures (3 Phase 1 reuse + 2 new) with `isMobileTapFriendly` true for ≥48×48 px and false for <48×48; `elementType` correctly classified as cta / link / form_control / icon_button. Reads from T1B-000 `ctas[]`. | `packages/agent-core/tests/conformance/click-target-sizer.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-03 | StickyElementDetector populates `stickyElements[]` with `type` (open string), `positionStrategy`, `viewportCoveragePercent`, `isAboveFold`, `containsPrimaryCta` on sticky-CTA / sticky-cart / sticky-nav fixtures. | `packages/agent-core/tests/conformance/sticky-element-detector.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-04 | PopupPresenceDetector populates `popups[]` with presence-layer fields at page load. `type` enum ∈ {`modal`, `lightbox`, `drawer`, `toast`, `cookie_banner`, `consent_form`, `slide_in_panel`, `exit_intent_overlay`, `chat_widget`, `paywall`, `other`} *(v0.2 expanded from 6 to 11 — `other` is a fallback for unclassified)*. Behavior fields (`isEscapeDismissible`, `isClickOutsideDismissible`) remain `null` until Phase 5b. | `packages/agent-core/tests/conformance/popup-presence-detector.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-05 | FrictionScorer computes `frictionScore.{totalFormFields, requiredFormFields, popupCount, forcedActionCount, raw, normalized}` on form + popup fixtures; `normalized` ∈ [0, 1]. Reads from T1B-000 `formFields[]` + T1B-004 `popups[]`. | `packages/agent-core/tests/conformance/friction-scorer.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-06 | SocialProofDepthEnricher populates `socialProofDepth.{reviewCount, starDistribution, recencyDays, hasAggregateRating, hasIndividualReviews, thirdPartyVerified}` from review-block fixture; uses JSON-LD AggregateRating (read from T1B-000 `metadata.schemaOrg`) where available. | `packages/agent-core/tests/conformance/social-proof-depth.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-07 | MicrocopyTagger tags near-CTA microcopy (within 100px of T1B-000 `ctas[i]`) on 5 fixtures with manual ground truth at ≥80% precision; tag set: `risk_reducer / urgency / security / guarantee / social_proof / value_prop / other`. *(v0.2: Cialdini-principle granularity — scarcity, authority, reciprocity, commitment_consistency, liking — deferred to Phase 6 LLM-tagging; collapsed here per regex-precision constraint NF-04.)* | `packages/agent-core/tests/conformance/microcopy-tagger.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-08 | AttentionScorer emits `attention.dominantElement` (type / selector / score ∈ [0,1]) and `contrastHotspots[]` (3 entries with boundingBox + contrastScore) on test fixtures. | `packages/agent-core/tests/conformance/attention-scorer.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-09 | CommerceBlockExtractor populates `commerce.{isCommerce, stockStatus, stockMessage, shippingSignals[], returnPolicyPresent, returnPolicyText, guaranteeText}` on PDP / cart / checkout fixtures; `isCommerce: false` on non-commerce. Reads T1B-000 `metadata.schemaOrg` (Offer/AggregateOffer) + on-page patterns + AC-01 `pricing` (already computed earlier in same evaluate). | `packages/agent-core/tests/conformance/commerce-block-extractor.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-10 | CurrencySwitcherDetector populates `metadata.currencySwitcher` with `present`, `currentCurrency`, `availableCurrencies`, `isAccessibleAt` ∈ {`header`, `footer`, `none`}; emits `null` on pages with no switcher. | `packages/agent-core/tests/conformance/currency-switcher-detector.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-11 | `PageStateModelSchema` (extended in `types.ts` per Phase 1's T014 + T1B-000 substrate + T1B-001..T1B-010 additions) validates all 10 new Phase 1b field groups; Phase 1's 6 sub-schemas validate identically; full payload ≤20K tokens (Phase 1's NF-Phase1-01 v0.4 budget; Phase 1b delta absorbed). | `packages/agent-core/tests/conformance/page-state-model-extended.test.ts` (extends T1B-000 conformance) | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-12 | Phase 1b integration test runs on 5 fixture sites (3 reused from Phase 1: example.com homepage, amazon.in PDP, Peregrine PDP; + 2 new: Peregrine cart, Peregrine content). All 10 Phase 1b extensions populate without error; Phase 1 integration test (T015) still passes; walking-skeleton 7/7 still passes; token budget ≤20K. | `packages/agent-core/tests/integration/perception-extensions.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |

---

## Functional Requirements *(mandatory — cross-ref existing PRD F-IDs where applicable)*

| ID | Requirement | Cites PRD F-NNN | Linked architecture spec |
|----|-------------|-----------------|--------------------------|
| R-00 *(v0.2 NEW — Path B)* | System MUST extend `PageStateModel` (`packages/agent-core/src/perception/types.ts`) with substrate fields populated by `ContextAssembler.capture()` inside the existing `page.evaluate()` call: `ctas[]` (computed from InteractiveGraph + AX-tree role=button/link with text + size), `formFields[]` (`<input>`/`<select>`/`<textarea>` enumeration), `metadata.schemaOrg` (parsed JSON-LD), `metadata.ogTags` (Record<string,string> from `<meta property="og:*">`), `headings[]` (`<h1..h6>` level + text + selector), `primaryActions` (the dominant CTA — usually the first non-link button in viewport). Backward compat: Phase 1's 6 sub-schemas validate identically. | F-004 | §7.9.2 |
| R-01 | System MUST populate `pricing` block when on-page text or JSON-LD reveals a price; emit `null` otherwise. Compute `discountPercent` from `anchorPrice` ÷ `amount` when both present. R-01 runs FIRST within the evaluate pipeline (before R-09 which references it). | F-004 | §7.9.2 |
| R-02 | System MUST measure every interactive element's bounding-rect width × height in CSS pixels; classify `isMobileTapFriendly` per [WCAG 2.5.5 Target Size (Enhanced) — Level AAA](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html) (≥44×44 CSS pixels; spec implementation uses ≥48×48 as the operational threshold matching Google's mobile-friendly recommendation). | F-004 | §7.9.2 |
| R-03 | System MUST detect sticky / fixed elements via `getComputedStyle` `position` ∈ {sticky, fixed}; record `viewportCoveragePercent` and `containsPrimaryCta` (overlap with T1B-000 `ctas[]`). | F-004 | §7.9.2 |
| R-04 | System MUST detect popup PRESENCE at page load; classify `type` ∈ {`modal`, `lightbox`, `drawer`, `toast`, `cookie_banner`, `consent_form`, `slide_in_panel`, `exit_intent_overlay`, `chat_widget`, `paywall`, `other`} *(v0.2 — expanded from 6 to 11; `other` fallback for unclassified per popup option a per Gate 1)*; leave behavior fields null for Phase 5b. | F-004 | §7.9.2 |
| R-05 | System MUST compute `frictionScore` as a deterministic weighted sum of `totalFormFields`, `requiredFormFields`, `popupCount`, `forcedActionCount`; `normalized` clamped to [0, 1]. Weights documented in plan.md. Reads from T1B-000 `formFields[]` + T1B-004 `popups[]`. | F-004 | §7.9.2 |
| R-06 | System MUST extract `socialProofDepth` from on-page review widgets and JSON-LD AggregateRating (read from T1B-000 `metadata.schemaOrg`); compute `recencyDays` from review timestamp(s). | F-004 | §7.9.2 |
| R-07 | System MUST tag microcopy within 100px of every CTA in T1B-000 `ctas[]`; emit zero tags when no microcopy is near. Precision ≥80% against ground-truth fixtures. *(v0.2 — Cialdini-principle granularity collapsed: scarcity → urgency; authority → social_proof; reciprocity/commitment_consistency/liking deferred to Phase 6 LLM-tagging. Rationale: regex-only constraint per NF-04.)* | F-004 | §7.9.2 |
| R-08 | System MUST score visual attention via contrast (Sharp), size (bbox area), position (above-fold weight), and color saturation; emit top-3 hotspots and a single dominant element (or `null` if no element scores >0.3). | F-004 | §7.9.2 |
| R-09 | System MUST detect commerce signals via JSON-LD Offer/AggregateOffer (T1B-000 `metadata.schemaOrg`) + on-page text patterns; `isCommerce` requires either Offer schema OR ATC/Add-to-bag CTA OR `pricing` block (R-01 result — runs first in same evaluate; no circular dep). | F-004 | §7.9.2 |
| R-10 | System MUST detect a currency-switcher widget (interactive button/select element, not a passive list); record current and available currencies; locate `isAccessibleAt` ∈ {`header`, `footer`, `none`}. | F-004 | §7.9.2 |
| R-11 | System MUST validate the extended `PageStateModelSchema` via Zod, enforcing additive backward compat — Phase 1's 6 sub-schemas validate identically; total payload ≤20K tokens (NF-Phase1-01 v0.4 unchanged); fail fast on schema drift. | F-004 + F-007 | §7.9.2 + §7.4 |

---

## Non-Functional Requirements

| ID | Metric | Target | Cites PRD NF-NNN | Measurement method |
|----|--------|--------|------------------|--------------------|
| NF-01 | Token budget per PageStateModel payload (Phase 1's NF-Phase1-01 v0.4) | ≤20K (Phase 1 cap unchanged); Phase 1b delta ≤+1.5K absorbed into existing headroom | NF-001 | `tiktoken cl100k_base` count per page in integration test |
| NF-02 | Extra browser time per page (vs Phase 1's baseline — empirical: example.com 1.7s, amazon.in 3.1s, Peregrine 4.8s) | ≤+150ms p50 | NF-001 | Integration test timing across 5 fixtures |
| NF-03 | Net new LLM cost per audit | $0 (zero new calls) | NF-002 | `llm_call_log` row count diff vs Phase 1 baseline |
| NF-04 | MicrocopyTagger precision against fixture ground truth | ≥80% | — | Ground-truth comparison in conformance test |

---

## Key Entities

- **PageStateModel (extended):** Phase 1 ships at `packages/agent-core/src/perception/types.ts` with 6 sub-schemas (Metadata, AccessibilityTree, FilteredDOM, InteractiveGraph, Visual, Diagnostics). Phase 1b T1B-000 adds substrate fields (`ctas[]`, `formFields[]`, `metadata.schemaOrg`, `metadata.ogTags`, `headings[]`, `primaryActions`). Phase 1b T1B-001..T1B-010 add 9 new top-level field groups + 1 nested in `metadata` (currencySwitcher). All additive at top level (NOT under `_extensions.*` — that namespace is reserved for Phase 7 DeepPerceiveNode per `phase-1-current.md` §5; see impact.md §11 Namespace contract). Backward compat: Phase 1's 6 sub-schemas unchanged.
- **T1B-000 substrate (NEW v0.2 — Path B):** Substrate fields that Phase 1b extractors depend on. `ctas[]` = enumerated CTAs with text + selector + sizePx + index; `formFields[]` = `<input>`/`<select>`/`<textarea>` enumeration with selector + type + required flag; `metadata.schemaOrg` = parsed JSON-LD `<script type="application/ld+json">` blocks; `metadata.ogTags` = OpenGraph meta tags Record<string,string>; `headings[]` = `<h1..h6>` enumeration with level + text + selector; `primaryActions` = the dominant CTA on the page (typically the first non-link button in viewport, e.g., "Add to bag" on a PDP).
- **PricingBlock:** New top-level. Nullable. Populated when on-page or structured-data pricing detected. Exclusively factual — no judgment of "expensive" vs "cheap".
- **ClickTarget:** Per-element record built from T1B-000 `ctas[]` + sizePx. Adds `isMobileTapFriendly` flag + `elementType` classification.
- **StickyElement:** Per-element record for sticky/fixed positioned elements. Cross-references T1B-000 `ctas[]` for the `containsPrimaryCta` flag. `type` is open-string per R-03 (not a closed enum).
- **Popup (presence):** Per-element record for at-load-time popup-class elements. `type` is a closed enum of 11 values per R-04 v0.2 (modal, lightbox, drawer, toast, cookie_banner, consent_form, slide_in_panel, exit_intent_overlay, chat_widget, paywall, other). Behavior fields explicitly `null` until Phase 5b populates them.
- **FrictionScore:** Aggregate metric derived from T1B-000 `formFields[]` count + T1B-004 `popups[]` count. Deterministic. No probability or conversion-rate semantics (R5.3 / GR-007).
- **SocialProofDepth:** Single object (not array). Composed of review-block extraction + JSON-LD AggregateRating (from T1B-000 `metadata.schemaOrg`) + third-party widget detection.
- **MicrocopyTag:** Per-CTA record. References T1B-000 `ctas[]` by index. Tag taxonomy fixed at 7 values (collapsed from full Cialdini-principle universe per regex-precision constraint NF-04; see R-07 v0.2 note).
- **Attention:** Single object with one dominant element + 3 contrast hotspots. Sharp computes contrast.
- **CommerceBlock:** Single object. Activates when at least one commerce signal present (Offer schema, ATC CTA from `primaryActions`, or `pricing` block from R-01).
- **CurrencySwitcher:** Nested in `metadata`. Nullable. Detects interactive switcher (button/select), not passive currency lists. Location ∈ {`header`, `footer`, `none`}.

---

## Success Criteria *(measurable, technology-agnostic)*

- **SC-001:** All 10 Phase 1b field groups populate correctly on the 5-fixture integration test — 3 Phase 1 fixtures reused (example.com homepage, amazon.in PDP, Peregrine PDP) + 2 new (Peregrine cart, Peregrine content) — zero extractor errors. T1B-000 substrate also populates correctly on all 5.
- **SC-002:** Extended PageStateModel payload stays ≤20K tokens on every fixture (Phase 1's NF-Phase1-01 v0.4 cap unchanged). Phase 1b's ~1.5K delta absorbed into the ~7K headroom remaining from Phase 1's empirical floor (amazon.in 12,485 + Peregrine 4,012).
- **SC-003:** Zero regression on Phase 1 baseline — Phase 1 integration test (T015 in `tests/integration/phase1.test.ts`) passes unchanged after PageStateModel extends. Walking-skeleton acceptance suite (7/7 at `tests/acceptance/walking-skeleton.spec.ts`) passes unchanged.
- **SC-004:** Per-page browser time grows by ≤150ms p50 vs Phase 1's baseline timings (no new round-trip — extensions live in the same `page.evaluate()` that `ContextAssembler` already dispatches).
- **SC-005:** Net new LLM spend per audit = $0 (Phase 1b adds zero LLM calls).
- **SC-006:** MicrocopyTagger precision ≥80% on the curated fixture-ground-truth set.

---

## Constitution Alignment Check *(mandatory — must pass before status: approved)*

- [x] Does NOT predict conversion rates (R5.3 + GR-007) — `frictionScore` is a derived count, not a conversion forecast; tag taxonomy excludes "converts/lifts" wording
- [x] Does NOT auto-publish findings without consultant review (warm-up rule, F-016) — Phase 1b only emits perception data; findings come later (Phase 7)
- [x] Does NOT UPDATE or DELETE rows from append-only tables (R7.4) — no DB writes in this phase
- [x] Does NOT import vendor SDKs outside adapters (R9) — Playwright access remains via `BrowserEngine` adapter from Phase 1
- [x] Does NOT set temperature > 0 on `evaluate` / `self_critique` / `evaluate_interactive` (R10) — no LLM calls in Phase 1b
- [x] Does NOT expose heuristic content outside the LLM evaluate prompt (R6) — no heuristic engagement in this phase
- [x] DOES include a conformance test stub for every AC-NN (PRD §9.6 + R3 TDD) — AC-01..AC-12 each have a test path
- [x] DOES carry frontmatter delta block on subsequent edits (R18)
- [x] DOES define kill criteria for tasks > 2 hrs OR shared-contract changes (R23) — tracked in plan.md
- [x] DOES reference REQ-IDs from `docs/specs/final-architecture/` for every R-NN (R11.2) — all 11 cite REQ-ANALYZE-PERCEPTION-V24-001 (§7.9.2)

---

## Out of Scope (cite PRD §3.2 explicit non-goals)

- **Popup BEHAVIOR fields** (`isEscapeDismissible`, `isClickOutsideDismissible`, timing, exit-intent fire-detection probing, scroll-trigger probing, dark-pattern detection) — deferred to Phase 5b (requires runtime probing). Phase 1b detects popup PRESENCE + the 11-value type enum only.
- **Multi-viewport diff** (mobile vs desktop fold composition) — deferred to Phase 5b.
- **State graph / interaction discovery** — deferred to Phase 1c PerceptionBundle envelope and the master-plan State Exploration phase.
- **Heuristics that consume Phase 1b fields** — authored later (Phase 0b heuristic-authoring + Phase 6 Heuristic KB filter on ContextProfile).
- **Conversion-rate prediction** (permanent non-goal, R5.3 + GR-007) — `frictionScore.normalized` is a deterministic count-based metric only.
- **Authenticated pages** (PRD §3.2 permanent non-goal).
- *(v0.2)* **Cialdini-principle granularity in microcopy tags** — Phase 1b collapses scarcity→urgency, authority→social_proof partially; reciprocity / commitment_consistency / liking deferred to Phase 6 LLM-tagging. Rationale: NF-04 ≥80% precision constraint is regex-feasible only on the 7 high-precision-detectable tags listed in AC-07.
- *(v0.2)* **Finer-grained ClickTarget elementType taxonomy** — Phase 1b uses 4-type coarse enum (cta / link / form_control / icon_button). nav_item, tab, accordion_header, pagination_button, breadcrumb_link deferred — heuristics for these element classes are not on the v1.0 roadmap.
- *(v0.2)* **Currency-switcher locations beyond header/footer** — account_menu, settings_modal, sidebar deferred. Low-traffic patterns; account-tied currency requires authenticated session (PRD §3.2 permanent non-goal).
- *(v0.2)* **MCP tool wrapping** — `browser_get_state` MCP tool that exposes PageStateModel to LLMs ships in Phase 2 (⚪ not started). Phase 1b extends the model; Phase 2 exposes it.

---

## Assumptions

- Phase 1's `PageStateModel` is implemented and tested per Phase 1 (T006-T015). Phase 1b runs after Phase 1 ships (CONFIRMED 2026-05-09 per `phase-1-current.md`).
- The contract name `AnalyzePerception` in architecture spec §7.9 is the legacy/architectural name; Phase 1 shipped the implementation as `PageStateModel` (per `packages/agent-core/src/perception/types.ts`). Phase 1b uses the impl name; architecture-spec rewrite queued for v2.3.4 punch-list.
- T1B-000 substrate extension precedes T1B-001..T1B-010 extractors per Path B (selected at Gate 1 REVISE 2026-05-09 per `.phase-state/1b/preflight-verdict.yaml`).
- The same `page.evaluate()` infrastructure used in Phase 1's `ContextAssembler.capture()` accepts T1B-000 substrate + Phase 1b extensions without architectural change.
- Sharp library is already installed and wired (Phase 1 uses Sharp via `ScreenshotExtractor`); contrast computation reuses Sharp pipeline.
- Five integration fixtures: 3 reused from Phase 1 (example.com, amazon.in, Peregrine PDP — already wired in `tests/integration/phase1.test.ts`) + 2 new (Peregrine cart, Peregrine content — to be authored as part of T1B-012). Fixture authoring is in-scope for T1B-012.
- MicrocopyTagger ground-truth set (≥10 hand-tagged CTA contexts per tag class) is available before AC-07 conformance run; if not, Phase 1b ASKs for ground-truth authoring (kill criterion per plan.md §3).
- No new vendor dependencies — all extractions use existing Playwright + Sharp + native browser APIs.

---

## Next Steps

After this spec is approved (`status: draft → validated → approved`):

1. Run `/speckit.plan` to generate plan.md (already drafted alongside this spec).
2. Run `/speckit.tasks` to align tasks.md with `tasks-v2.md` T1B-001..T1B-012.
3. Run `/speckit.analyze` for cross-artifact consistency.
4. Phase 1b implementation begins after Phase 1 (T006-T015) ships and `phase-1-current.md` rollup is approved.

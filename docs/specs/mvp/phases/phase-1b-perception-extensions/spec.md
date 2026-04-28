---
title: Phase 1b — Perception Extensions v2.4
artifact_type: spec
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
  - docs/specs/mvp/PRD.md (F-004 Browser Perception)
  - docs/specs/mvp/constitution.md (R1-R26; especially R10 budget, R11 spec discipline, R20 impact, R24 perception MUST NOT)
  - docs/specs/mvp/architecture.md (§6.4 tech stack, §6.5 file locations)
  - docs/specs/mvp/tasks-v2.md (T1B-001..T1B-012, lines 176-251)
  - docs/specs/final-architecture/07-analyze-mode.md §7.9.2 (REQ-ANALYZE-PERCEPTION-V24-001)
  - docs/specs/final-architecture/16-implementation-phases.md (Phase 1b row, week 2-3)
  - docs/Improvement/perception_layer_spec.md (gap-closure items 1-10)
  - docs/specs/mvp/phases/phase-1-perception/spec.md (Phase 1 prerequisite — AnalyzePerception v2.3 baseline)

req_ids:
  - REQ-ANALYZE-PERCEPTION-V24-001

impact_analysis: docs/specs/mvp/phases/phase-1b-perception-extensions/impact.md
breaking: false
affected_contracts:
  - AnalyzePerception

delta:
  new:
    - Phase 1b spec — adds 10 perception extensions on top of v2.3 baseline
    - AC-01 through AC-12 stable IDs for T1B-001..T1B-012 acceptance
    - R-01 through R-11 functional requirements
  changed: []
  impacted:
    - AnalyzePerception schema (v2.3 → v2.4) — additive only, backward-compatible
    - tasks-v2.md (T1B-001..T1B-012 already canonical here)
  unchanged:
    - All v2.3 baseline fields (R5.1 backward compat invariant)
    - 12 perception MCP tools (no new tools — extensions live inside page_analyze)

governing_rules:
  - Constitution R10 (Budget — extensions stay inside one page.evaluate(); zero LLM cost)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R17 (Lifecycle States)
  - Constitution R18 (Delta-Based Updates — append-only AC-NN/R-NN IDs)
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes — AnalyzePerception is shared contract)
  - Constitution R22 (Ratchet — every claim cites a source)
  - Constitution R24 (Perception MUST NOT — no analysis, no judgment, no LLM calls)
---

# Feature Specification: Phase 1b — Perception Extensions v2.4

> **Summary (~150 tokens — agent reads this first):** Extend the v2.3 `AnalyzePerception` schema with 10 new field groups that capture signals top-1% CRO consultants depend on but the baseline schema misses — pricing display, click target sizing (Fitt's Law / WCAG 2.5.5), sticky elements, popup PRESENCE (behavior in Phase 5b), aggregate friction score, social-proof depth, near-CTA microcopy semantic tags, visual attention / contrast hotspots, commerce signals (stock / shipping / returns), and currency switcher. All 10 extractions live inside the same single `page.evaluate()` call as v2.3 — zero new LLM calls, +1.5K tokens (5K → 6.5K, under 8K cap). Twelve tasks (T1B-001..T1B-012) cover the 10 extractors, the v2.4 Zod schema, and a 5-fixture integration test. Closes the 9 perception gaps from the master-checklist coverage audit + currency-switcher gap.

**Feature Branch:** master (spec authoring; per phase-0..phase-6 convention)
**Input:** Phase 1b scope from `docs/specs/mvp/tasks-v2.md` lines 176-251 + `docs/Improvement/perception_layer_spec.md` items 1-10 + `docs/specs/final-architecture/07-analyze-mode.md` §7.9.2

---

## Mandatory References

When reading this spec, agents must already have loaded:

1. `docs/specs/mvp/constitution.md` — R10 (budget), R11 (spec discipline), R18 (delta), R20 (impact), R24 (perception MUST NOT).
2. `docs/specs/mvp/PRD.md` — F-004 Browser Perception.
3. `docs/specs/final-architecture/07-analyze-mode.md` §7.9 (v2.3 baseline) + §7.9.2 (v2.4 extensions, REQ-ANALYZE-PERCEPTION-V24-001).
4. `docs/specs/mvp/tasks-v2.md` lines 176-251 (T1B-001..T1B-012).
5. `docs/specs/mvp/phases/phase-1-perception/spec.md` — Phase 1 v2.3 baseline (predecessor).
6. `docs/Improvement/perception_layer_spec.md` — design rationale for the 10 gap-closure items.

---

## Constraints Inherited from Neural Canonical Specs

- **R24 (Perception MUST NOT):** Phase 1b stays inside the perception layer. No heuristic judgment, no LLM calls, no scoring, no recommendations — only structured field capture. Heuristics that consume v2.4 fields are authored later in Phase 6 / Phase 0b.
- **Single-evaluate budget (architecture §07.4):** all 10 extractors run inside the same `page.evaluate()` call as v2.3. Adding a separate browser round-trip per extractor is forbidden (cost discipline).
- **Backward compatibility (R18):** v2.4 is additive. No v2.3 field renamed, removed, or retyped. v2.3 consumers continue without modification.
- **Token cap (architecture §7.9.2):** AnalyzePerception payload ≤6.5K tokens after Phase 1b. Hard ceiling 8K (§7.9.2). Heuristic prompts that ingest v2.4 see proportional token cost.
- **Tech stack pinned (architecture §6.4):** TypeScript 5, Playwright pinned, no new vendor dependencies. Sharp already wired for image/contrast computation in v2.3.
- **No conversion predictions (R5.3 + GR-007):** v2.4 fields are factual captures only (e.g., `frictionScore.normalized` is a derived metric, not a conversion-rate forecast).
- **No `console.log`** (R10.6) — Pino logger with extractor name + page url + audit_run_id correlation.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Heuristic author analyzes pricing-display patterns (Priority: P1)

A consultant authoring an e-commerce pricing-display heuristic needs to know whether a PDP shows an anchor price, what the discount % is, and whether tax is inclusive. The v2.3 baseline gives only `ctas[]` and `formFields[]` — no pricing block.

**Why this priority:** Pricing display is the single highest-leverage CRO signal for e-commerce (PDPs, cart, checkout). Without it, the heuristic engine cannot author the most valuable rules in the e-commerce vertical.
**Independent Test:** Run `page_analyze` on a Shopify PDP fixture; confirm `pricing.{displayFormat, amount, anchorPrice, discountPercent, taxInclusion}` populate; confirm `pricing` is `null` on a non-commerce page.

**Acceptance Scenarios:**

1. **Given** a PDP fixture with strikethrough `$99` next to `$49`, **When** `page_analyze` runs, **Then** `pricing.amount === "$49"`, `pricing.anchorPrice === "$99"`, `pricing.discountPercent === 50`, `pricing.comparisonShown === true`.
2. **Given** a content page with no pricing, **When** `page_analyze` runs, **Then** `pricing === null` (not `{}`, not throwing).

---

### User Story 2 — Mobile-audit consumer reads click-target sizing (Priority: P1)

A mobile-only audit needs every interactive element's pixel size to flag <48×48 tap targets per WCAG 2.5.5. v2.3 gives `ctas[]` text + selector, but no size.

**Why this priority:** Mobile UX heuristics are unworkable without size data. Same heuristic ("CTA too small") fires opposite recommendations on desktop vs. mobile.
**Independent Test:** Render a fixture with a 32×32 icon button and a 64×64 primary CTA; confirm `clickTargets[]` lists both with `isMobileTapFriendly` correctly classified.

**Acceptance Scenarios:**

1. **Given** an `<a>` tag styled to 64×64 px, **When** `page_analyze` runs, **Then** `clickTargets[]` contains an entry with `sizePx.{width: 64, height: 64}` and `isMobileTapFriendly: true`.
2. **Given** an icon button at 32×32 px, **Then** the entry shows `isMobileTapFriendly: false`.
3. **Given** the button is above the fold, **Then** `isAboveFold: true`.

---

### User Story 3 — Backward-compat reader continues unchanged (Priority: P1)

A v2.3 consumer reading `analyzePerception.ctas[]` and `analyzePerception.metadata.lang` must keep working with zero code changes after Phase 1b ships.

**Why this priority:** v2.3 already powers Phase 5 browse-mode integration tests. Breaking v2.3 readers blocks Phase 5 acceptance.
**Independent Test:** Run the Phase 1 integration test (T015) unchanged against the v2.4 schema; confirm pass.

**Acceptance Scenarios:**

1. **Given** v2.3 consumer code reading `metadata.title`, **When** v2.4 schema replaces v2.3, **Then** `metadata.title` still exists with same shape.
2. **Given** v2.3 fixture comparison, **When** `page_analyze` runs on v2.4, **Then** every v2.3 field is populated identically.

---

### User Story 4 — Popup-presence heuristic gates on Phase 5b behavior (Priority: P2)

A popup-quality heuristic ("popup blocks fold AND is not Escape-dismissible → bad") needs presence in Phase 1b and behavior in Phase 5b. Phase 1b populates the presence layer; behavior fields are `null` until Phase 5b probes them.

**Why this priority:** Popups are visible drivers of bounce, but full evaluation needs runtime probing. Splitting presence (Phase 1b, static) from behavior (Phase 5b, dynamic) lets us ship presence early.
**Independent Test:** Open a fixture with a cookie banner at load; confirm `popups[]` populates with `isInitiallyOpen: true`, `hasCloseButton: true`, AND `isEscapeDismissible: null` (filled by Phase 5b later).

**Acceptance Scenarios:**

1. **Given** a modal open at page load, **When** Phase 1b runs, **Then** `popups[].isInitiallyOpen === true`, `hasCloseButton`, `closeButtonAccessibleName`, `viewportCoveragePercent`, `blocksPrimaryContent` all populated; `isEscapeDismissible === null`, `isClickOutsideDismissible === null`.

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
| AC-01 | PricingExtractor populates `pricing.{displayFormat, amount, amountNumeric, currency, taxInclusion, anchorPrice, discountPercent, comparisonShown, boundingBox}` on a PDP fixture; emits `null` on a content page. | `packages/agent-core/tests/conformance/pricing-extractor.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-02 | ClickTargetSizer emits `clickTargets[]` on 5 fixtures with `isMobileTapFriendly` true for ≥48×48 px and false for <48×48; `elementType` correctly classified as cta / link / form_control / icon_button. | `packages/agent-core/tests/conformance/click-target-sizer.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-03 | StickyElementDetector populates `stickyElements[]` with `type`, `positionStrategy`, `viewportCoveragePercent`, `isAboveFold`, `containsPrimaryCta` on sticky-CTA / sticky-cart / sticky-nav fixtures. | `packages/agent-core/tests/conformance/sticky-element-detector.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-04 | PopupPresenceDetector populates `popups[]` with presence-layer fields at page load. Behavior fields (`isEscapeDismissible`, `isClickOutsideDismissible`) remain `null` until Phase 5b. | `packages/agent-core/tests/conformance/popup-presence-detector.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-05 | FrictionScorer computes `frictionScore.{totalFormFields, requiredFormFields, popupCount, forcedActionCount, raw, normalized}` on form + popup fixtures; `normalized` ∈ [0, 1]. | `packages/agent-core/tests/conformance/friction-scorer.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-06 | SocialProofDepthEnricher populates `socialProofDepth.{reviewCount, starDistribution, recencyDays, hasAggregateRating, hasIndividualReviews, thirdPartyVerified}` from review-block fixture; uses JSON-LD AggregateRating where available. | `packages/agent-core/tests/conformance/social-proof-depth.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-07 | MicrocopyTagger tags near-CTA microcopy on 5 fixtures with manual ground truth at ≥80% precision; tag set: `risk_reducer / urgency / security / guarantee / social_proof / value_prop / other`. | `packages/agent-core/tests/conformance/microcopy-tagger.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-08 | AttentionScorer emits `attention.dominantElement` (type / selector / score ∈ [0,1]) and `contrastHotspots[]` (3 entries with boundingBox + contrastScore) on test fixtures. | `packages/agent-core/tests/conformance/attention-scorer.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-09 | CommerceBlockExtractor populates `commerce.{isCommerce, stockStatus, stockMessage, shippingSignals[], returnPolicyPresent, returnPolicyText, guaranteeText}` on PDP / cart / checkout fixtures; `isCommerce: false` on non-commerce. | `packages/agent-core/tests/conformance/commerce-block-extractor.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-10 | CurrencySwitcherDetector populates `metadata.currencySwitcher` with `present`, `currentCurrency`, `availableCurrencies`, `isAccessibleAt`; emits `null` on pages with no switcher. | `packages/agent-core/tests/conformance/currency-switcher-detector.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-11 | AnalyzePerception v2.4 Zod schema validates all 10 new field groups; v2.3 baseline fields validate identically; full payload ≤6.5K tokens. | `packages/agent-core/tests/conformance/analyze-perception-v24-schema.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |
| AC-12 | Phase 1b integration test runs on 5 fixture sites (homepage, PDP, cart, checkout, content). All 10 extensions populate without error; Phase 1 (v2.3) integration test still passes; token budget ≤6.5K. | `packages/agent-core/tests/integration/perception-extensions.test.ts` | REQ-ANALYZE-PERCEPTION-V24-001 |

---

## Functional Requirements *(mandatory — cross-ref existing PRD F-IDs where applicable)*

| ID | Requirement | Cites PRD F-NNN | Linked architecture spec |
|----|-------------|-----------------|--------------------------|
| R-01 | System MUST populate `pricing` block when on-page text or JSON-LD reveals a price; emit `null` otherwise. Compute `discountPercent` from `anchorPrice` ÷ `amount` when both present. | F-004 | §07.7.9.2 |
| R-02 | System MUST measure every interactive element's bounding-rect width × height in CSS pixels; classify `isMobileTapFriendly` via WCAG 2.5.5 (≥48×48). | F-004 | §07.7.9.2 |
| R-03 | System MUST detect sticky / fixed elements via `getComputedStyle` `position` ∈ {sticky, fixed}; record `viewportCoveragePercent` and `containsPrimaryCta` (overlap with v2.3 `ctas[]`). | F-004 | §07.7.9.2 |
| R-04 | System MUST detect popup PRESENCE at page load (modal/lightbox/drawer/toast/cookie_banner/consent_form); leave behavior fields null for Phase 5b. | F-004 | §07.7.9.2 |
| R-05 | System MUST compute `frictionScore` as a deterministic weighted sum of `totalFormFields`, `requiredFormFields`, `popupCount`, `forcedActionCount`; `normalized` clamped to [0, 1]. Weights documented in plan.md. | F-004 | §07.7.9.2 |
| R-06 | System MUST extract `socialProofDepth` from on-page review widgets and JSON-LD AggregateRating; compute `recencyDays` from review timestamp(s). | F-004 | §07.7.9.2 |
| R-07 | System MUST tag microcopy within 100px of every CTA in `ctas[]`; emit zero tags when no microcopy is near. Precision ≥80% against ground-truth fixtures. | F-004 | §07.7.9.2 |
| R-08 | System MUST score visual attention via contrast (Sharp), size (bbox area), position (above-fold weight), and color saturation; emit top-3 hotspots and a single dominant element (or `null` if no element scores >0.3). | F-004 | §07.7.9.2 |
| R-09 | System MUST detect commerce signals via JSON-LD Offer/AggregateOffer + on-page text patterns; `isCommerce` requires either Offer schema OR ATC/Add-to-bag CTA OR price block. | F-004 | §07.7.9.2 |
| R-10 | System MUST detect a currency-switcher widget (interactive, not a passive list); record current and available currencies; locate as `header` / `footer` / `none`. | F-004 | §07.7.9.2 |
| R-11 | System MUST validate the full v2.4 payload via Zod, enforcing additive backward compat — every v2.3 field path must validate identically; total payload ≤6.5K tokens; fail fast on schema drift. | F-004 + F-007 | §07.7.9.2 + §07.4 |

---

## Non-Functional Requirements

| ID | Metric | Target | Cites PRD NF-NNN | Measurement method |
|----|--------|--------|------------------|--------------------|
| NF-01 | Token budget per AnalyzePerception payload | ≤6.5K (warn at 6K) | NF-001 | `getTokenCount()` log per page in integration test |
| NF-02 | Extra browser time per page (vs v2.3) | ≤+150ms p50 | NF-001 | Integration test timing across 5 fixtures |
| NF-03 | Net new LLM cost per audit | $0 (zero new calls) | NF-002 | `llm_call_log` row count diff vs v2.3 baseline |
| NF-04 | MicrocopyTagger precision against fixture ground truth | ≥80% | — | Ground-truth comparison in conformance test |

---

## Key Entities

- **AnalyzePerception (v2.4):** Extends the v2.3 schema in `packages/agent-core/src/perception/schema.ts`. Adds 9 top-level field groups + 1 nested in `metadata`. All additive. Lifecycle states unchanged from v2.3.
- **PricingBlock:** New top-level. Nullable. Populated when on-page or structured-data pricing detected. Exclusively factual — no judgment of "expensive" vs "cheap".
- **ClickTarget:** Per-element record (one per interactive element captured by v2.3 traversal). Adds size + mobile-friendly flag. Reuses v2.3 selector convention.
- **StickyElement:** Per-element record for sticky/fixed positioned elements. Cross-references v2.3 `ctas[]` for the `containsPrimaryCta` flag.
- **Popup (presence):** Per-element record for at-load-time popup-class elements. Behavior fields explicitly `null` until Phase 5b populates them.
- **FrictionScore:** Aggregate metric derived from form + popup counts. Deterministic. No probability or conversion-rate semantics (R5.3 / GR-007).
- **SocialProofDepth:** Single object (not array). Composed of review-block extraction + JSON-LD AggregateRating + third-party widget detection.
- **MicrocopyTag:** Per-CTA record. References `ctas[]` by index. Tag taxonomy fixed at 7 values (R5.3 — no conversion language).
- **Attention:** Single object with one dominant element + 3 contrast hotspots. Sharp computes contrast.
- **CommerceBlock:** Single object. Activates when at least one commerce signal present.
- **CurrencySwitcher:** Nested in `metadata`. Nullable. Detects interactive switcher (button/select), not passive currency lists.

---

## Success Criteria *(measurable, technology-agnostic)*

- **SC-001:** All 10 v2.4 field groups populate correctly on the 5-fixture integration test (homepage, PDP, cart, checkout, content) — zero extractor errors.
- **SC-002:** AnalyzePerception payload stays ≤6.5K tokens on every fixture; never exceeds 8K hard cap.
- **SC-003:** Zero regression on v2.3 baseline — Phase 1 integration test (T015) passes unchanged after the v2.4 schema swap.
- **SC-004:** Per-page browser time grows by ≤150ms p50 vs v2.3 (no new round-trip — extensions live in the same `page.evaluate()`).
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

- **Popup BEHAVIOR fields** (`isEscapeDismissible`, `isClickOutsideDismissible`, timing, exit-intent, scroll-trigger, dark-pattern detection) — deferred to Phase 5b (requires runtime probing).
- **Multi-viewport diff** (mobile vs desktop fold composition) — deferred to Phase 5b.
- **State graph / interaction discovery** — deferred to Phase 1c PerceptionBundle envelope and the master-plan State Exploration phase.
- **Heuristics that consume v2.4 fields** — authored later (Phase 0b heuristic-authoring + Phase 6 Heuristic KB filter on ContextProfile).
- **Conversion-rate prediction** (permanent non-goal, R5.3 + GR-007) — `frictionScore.normalized` is a deterministic count-based metric only.
- **Authenticated pages** (PRD §3.2 permanent non-goal).

---

## Assumptions

- v2.3 AnalyzePerception schema is implemented and tested per Phase 1 (T006-T015). Phase 1b runs after Phase 1 ships.
- The same `page.evaluate()` infrastructure used in v2.3 (`page_analyze` MCP tool, §08.4) accepts the v2.4 extensions without architectural change.
- Sharp library is already installed (used for image annotation in v2.3); contrast computation reuses Sharp pipeline.
- Five integration fixtures are available or stubbable: homepage, PDP, cart, checkout, content. If unavailable, Phase 1b ASKs for fixture authoring before T1B-012 acceptance.
- MicrocopyTagger ground-truth set (≥10 hand-tagged CTA contexts per tag class) is available before AC-07 conformance run; if not, Phase 1b ASKs for ground-truth authoring.
- No new vendor dependencies — all extractions use existing Playwright + Sharp + native browser APIs.

---

## Next Steps

After this spec is approved (`status: draft → validated → approved`):

1. Run `/speckit.plan` to generate plan.md (already drafted alongside this spec).
2. Run `/speckit.tasks` to align tasks.md with `tasks-v2.md` T1B-001..T1B-012.
3. Run `/speckit.analyze` for cross-artifact consistency.
4. Phase 1b implementation begins after Phase 1 (T006-T015) ships and `phase-1-current.md` rollup is approved.

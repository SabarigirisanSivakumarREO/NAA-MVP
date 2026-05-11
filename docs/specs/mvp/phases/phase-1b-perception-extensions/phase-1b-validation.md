---
title: Phase 1b Validation — Perception Extensions (PageStateModel extension)
artifact_type: validation
status: implemented
version: 1.0
phase_number: 1b
phase_name: Perception Extensions (PageStateModel extension)
phase_completed_on: 2026-05-09
created: 2026-05-09
updated: 2026-05-09
owner: engineering lead
authors: [Claude (master orchestrator session 14)]
reviewers: [Sabari (Gate 2 stamp 2026-05-09)]
supersedes: null
supersededBy: null
derived_from:
  - docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md v0.2
  - docs/specs/mvp/phases/phase-1b-perception-extensions/tasks.md v0.2
  - docs/specs/mvp/phases/phase-1b-perception-extensions/phase-1b-current.md
  - .phase-state/1b/code-review-findings.yaml (Stage 2.5 APPROVE-FOR-GATE-2)
  - .phase-state/1b/preflight-coverage.json (spec:matrix 13/13 ACs)
governing_rules:
  - Constitution R19 (Rollup per Phase) — sibling artifact pair
  - CLAUDE.md §8c (Per-phase artifact maintenance)
---

# Phase 1b — Perception Extensions — Validation

> **Purpose (~150 tokens — read this first):** Phase 1b shipped ~5,200 LOC across 10 new extractors + substrate + schema closure + pipeline + 5 fixtures. The rollup tells you *what was built* in prose; this file tells you *how it fits together* in 5 ASCII-shaped artifacts a human can verify with eyes alone in ~20 minutes. Each section is self-checkable: pick one node/edge in a diagram, open the cited file at the line, confirm "yes that matches." Three confirmations = trust the diagram.

> **Governed by:** Constitution R19 (rollup partnership). Validation doc size cap: 400 lines / ~4000 tokens.

---

## §1 Module dependency graph

ASCII import graph for src files introduced or modified this phase. Direction: arrow points from importer to imported.

**Conventions:**
- `┌─┐` boxes = modules
- `─►` runtime imports
- `--►` type-only imports
- `█` = R9 adapter boundary

```
                                     █ sharp (npm)
                                          ▲
                                          │ (Phase 1 precedent;
                                          │  F-005 v0.2.1 polish candidate)
                                          │
                                     AttentionScorer.ts ─┐
                                                         │
  █ playwright (npm)                                     │
       ▲                                                 │
       │ (sole import; R9)                               │
       │                                                 │
  BrowserManager.ts ─────► BrowserEngine.ts              │
       │                                                 │
       │ (Phase 1)                                       │
       ▼                                                 │
  ContextAssembler.ts ────────────────────► types.ts     │
       │     │                                  ▲        │
       │     │                                  │        │
       │     └──► SubstrateExtension.ts ────────┤        │
       │     └──► SubstrateExtension.script.ts ─┤        │
       │                                        │        │
       └────────────────────────────────────────┘        │
                                                         │
              ┌──────────────────────────────────────────┘
              │
              ▼
  extensions/ (10 extractors — pure functions; ALL import types.ts ONLY)
   ├─► PricingExtractor.ts            ┐
   ├─► ClickTargetSizer.ts            │
   ├─► StickyElementDetector.ts       │  ALL ────► types.ts (PageStateModel +
   ├─► PopupPresenceDetector.ts       │              ExtractCtx + sub-schemas)
   ├─► FrictionScorer.ts              │
   ├─► SocialProofDepthEnricher.ts    │
   ├─► MicrocopyTagger.ts             │
   ├─► CommerceBlockExtractor.ts      │
   └─► CurrencySwitcherDetector.ts    ┘

  pipeline.ts (T1B-012) ────► PageStateModelSchema (from types.ts)
                                    │
                                    └──► (no extractor imports — pure validator+synthesizer)
```

**Boundary checks (auto-grep — see §6 spot-check #3):**
- `playwright` import sites: EXACTLY 1 → `BrowserManager.ts`
- `sharp` import sites: EXACTLY 1 → `AttentionScorer.ts` (F-005 v0.2.1 candidate; precedent set by Phase 1 ScreenshotExtractor.ts)
- `jsdom` import sites: ZERO in src/ (test-only; via `vitest.config.ts` environmentMatchGlobs)
- `_extensions.*` write sites: ZERO across all extractor src files (R20 namespace contract preserved)

---

## §2 Data flow

Single-evaluate substrate-first pipeline. T1B-000 populates substrate; 10 extractors read substrate via ExtractCtx; T1B-011 closes Zod schema; T1B-012 pipeline validates+synthesizes for fixture-mode.

```
              ┌───────────────────────────────────────────────────┐
  Trigger:    │ contextAssembler.capture(url)  [runtime path]     │
              │ OR runPerceptionExtensionsPipeline(fixture) [test]│
              └────────────────────┬──────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ Phase 1 baseline             │
                    │ (newSession → stealth →      │
                    │  goto → MutationMonitor →    │
                    │  ariaSnapshot → HardFilter → │
                    │  SoftFilter → screenshot)    │
                    └──────────────┬───────────────┘
                                   │ produces 6 sub-schemas
                                   ▼
                    ┌──────────────────────────────────┐
                    │ T1B-000 SubstrateExtension       │
                    │ (inside page.evaluate())         │
                    └──┬───────────────────────────────┘
                       │ adds 6 substrate fields:
                       │   ctas[]/formFields[]/
                       │   metadata.schemaOrg/.ogTags/
                       │   headings[]/primaryActions
                       ▼
                    ExtractCtx (carrier; 10 extractors read this)
                       │
   ┌───────────────────┴───────────────────────────────────────────┐
   │                                                               │
   │  EXTRACTOR PIPELINE (order matters — R-09 reads R-01's output)│
   │                                                               │
   │  T1B-001 Pricing ─────► ctx.pricing ─────────┐                │
   │                                              │                │
   │  T1B-002 ClickTargetSizer ───► clickTargets[]│                │
   │  T1B-003 StickyElementDetector ─► stickyElements[]            │
   │  T1B-004 PopupPresenceDetector ─► popups[] ──┤                │
   │  T1B-005 FrictionScorer ←─── reads popups[]  │ + formFields[] │
   │                          └─► frictionScore                    │
   │  T1B-006 SocialProofDepth ─► socialProofDepth                 │
   │  T1B-007 MicrocopyTagger (reads ctas[]) ─► microcopy          │
   │  T1B-008 AttentionScorer (Sharp single-pass) ─► attention     │
   │  T1B-009 CommerceBlock ◄── reads ctx.pricing (R-01 result) ───┤
   │                          └─► commerce                         │
   │  T1B-010 CurrencySwitcher ─► metadata.currencySwitcher        │
   │                                                               │
   └────────────────────────────┬──────────────────────────────────┘
                                ▼
                    ┌──────────────────────────────┐
                    │ T1B-011 PageStateModelSchema │
                    │ (.strict() Zod parse)        │
                    └──────────────┬───────────────┘
                                   ▼
                    Extended PageStateModel
                    (Phase 1 6 sub-schemas + T1B-000 substrate + 10 extension groups)
                    Token budget: ≤20K (NF-Phase1-01 v0.4 unchanged)

                    (consumers: walking-skeleton 7/7 + T015 5/5 + AC-12 27/27)
```

**Invariants:**
- T1B-000 ALWAYS runs first (substrate is prerequisite for extractors that read schemaOrg / ctas / formFields)
- T1B-001 Pricing runs BEFORE T1B-009 Commerce (R-09 reads R-01 result via `.optional()` chain)
- T1B-004 PopupPresenceDetector runs BEFORE T1B-005 FrictionScorer (R-05 reads popups[] for forcedActionCount)
- ALL extractors are PURE FUNCTIONS — no global state, no DOM mutations, synchronous
- ZERO writes to `_extensions.*` anywhere (R20 namespace contract; Phase 7 reservation)

---

## §3 Function call graph

Pure-function tree for the substrate-first pipeline. Read top-to-bottom in DAG order.

```
runPerceptionExtensionsPipeline(fixture: unknown)             [pipeline.ts:T1B-012]
  ├─► PageStateModelSchema.parse(fixture)                      [types.ts:line ~460]
  │
  └─► if (missing extension groups) → synthesize from substrate
      ├─► hasOfferType(metadata.schemaOrg)                     [pipeline.ts]
      ├─► detectATCPattern(primaryActions.text)
      └─► countFormFields(formFields[]) + countPopups(popups[])
                                          │
                                          ▼
                              (returns extended PageStateModel)

Per-extractor call sites (each independent; called by ContextAssembler at runtime
                          OR by pipeline.ts synthesis path for offline fixtures):

extractSubstrate(doc, viewport)                        [SubstrateExtension.ts]
  ├─► extractCtas(doc, viewport)                       (≤50 LOC)
  ├─► extractFormFields(doc)                           (≤50 LOC)
  ├─► extractSchemaOrg(doc)                            (≤50 LOC — tolerates malformed JSON-LD silently)
  ├─► extractOgTags(doc)                               (≤50 LOC)
  ├─► extractHeadings(doc)                             (≤50 LOC)
  └─► extractPrimaryAction(doc, viewport, ctas)        (≤50 LOC — NN-LL1 heuristic cascade)

extractPricing(doc, ctx)                               [PricingExtractor.ts]
  ├─► for each schemaOrg fragment: findOffer(frag) → readOfferPrice
  ├─► scanOnPagePrice(doc)
  ├─► findStrikeAnchor(doc)
  ├─► detectTaxInclusion(doc)
  └─► computeDiscountPercent(strikeAnchor, sale)

sizeClickTargets(ctx)                                  [ClickTargetSizer.ts]
  └─► for each ctx.ctas[i]: classifyElementType + computeMobileTapFriendly

detectStickyElements(doc, viewport, ctx)               [StickyElementDetector.ts]
  ├─► scan getComputedStyle.position ∈ {sticky, fixed}
  └─► classifyType + computeViewportCoverage + checkContainsPrimaryCta

detectPopupPresence(doc, viewport, ctx)                [PopupPresenceDetector.ts]
  ├─► scan candidate elements (positioned + role/aria signals)
  ├─► classifyPopup (11-rule fall-through; NN-LL2)
  ├─► extractIsInitiallyOpen + hasCloseButton + closeButtonAccessibleName
  └─► behavior fields literal null (Phase 5b reservation)

computeFrictionScore(ctx)                              [FrictionScorer.ts]
  ├─► countRequired(ctx.formFields)
  ├─► countForced(ctx.popups) — blocksPrimaryContent OR (isInitiallyOpen && !hasCloseButton)
  └─► weighted sum + clamp01(raw/30)

enrichSocialProofDepth(doc, ctx)                       [SocialProofDepthEnricher.ts]
  ├─► findAggregateRating (recursive walk of schemaOrg)
  ├─► scanOnPageReviewBlocks(doc)
  └─► detectThirdPartyVerified(doc)

tagMicrocopy(doc, ctx)                                 [MicrocopyTagger.ts]
  └─► for each ctx.ctas[i]: findNearbyText(100px) → applyTagPatterns (7-tag regex)

scoreAttention(doc, viewport, ctx, screenshot?)        [AttentionScorer.ts]
  ├─► buildContrastMap(screenshot)  — single Sharp pass (320×180 + Sobel)
  └─► for each candidate: compositeScore = 0.4·contrast + 0.3·size + 0.2·position + 0.1·saturation

extractCommerceBlock(doc, ctx)                         [CommerceBlockExtractor.ts]
  ├─► classifyIsCommerce(ctx)  — Offer schema OR ATC pattern OR pricing
  ├─► extractStockStatus(doc, ctx.metadata.schemaOrg)
  ├─► extractShippingSignals(doc)
  └─► extractReturnPolicy(doc)

detectCurrencySwitcher(doc, ctx)                       [CurrencySwitcherDetector.ts]
  ├─► trySelect(doc) (3-tier priority tier 1)
  ├─► tryButton(doc)
  └─► tryRadio(doc)
```

**Function size invariant:** all ≤50 LOC per R10 (verified by code review; F-004 R10 SHOULD soft-cap overages are FILE-level, not function-level).

---

## §4 AC → impl → test traceability

13 ACs (AC-00..AC-12) mapped to exactly 1 task + 1-2 src files + 1 conformance test. T1B-000 + T1B-011 share the AC-00 + AC-11 test file (schema closure exercises substrate); T1B-012 is the phase exit gate.

| AC | Task | Spec ref | Src files | Conformance test | Tests |
|---|---|---|---|---|---|
| AC-00 | T1B-000 | spec.md:184 R-00 | `SubstrateExtension.ts` + `SubstrateExtension.script.ts` + `types.ts` (Metadata + 6 substrate fields) | `page-state-model-extended.test.ts` (shared with AC-11) | 4 |
| AC-01 | T1B-001 | spec.md:186 R-01 | `PricingExtractor.ts` + `types.ts:PricingSchema` | `pricing-extractor.test.ts` | 4 |
| AC-02 | T1B-002 | spec.md:187 R-02 | `ClickTargetSizer.ts` + `types.ts:ClickTargetSchema` | `click-target-sizer.test.ts` | 5 |
| AC-03 | T1B-003 | spec.md:188 R-03 | `StickyElementDetector.ts` + `types.ts:StickyElementSchema` | `sticky-element-detector.test.ts` | 5 |
| AC-04 | T1B-004 | spec.md:189 R-04 | `PopupPresenceDetector.ts` + `types.ts:PopupSchema + PopupTypeSchema (11-value)` | `popup-presence-detector.test.ts` | 5 |
| AC-05 | T1B-005 | spec.md:190 R-05 | `FrictionScorer.ts` + `types.ts:FrictionScoreSchema` | `friction-scorer.test.ts` | 5 |
| AC-06 | T1B-006 | spec.md:191 R-06 | `SocialProofDepthEnricher.ts` + `types.ts:SocialProofDepthSchema` | `social-proof-depth.test.ts` | 5 |
| AC-07 | T1B-007 | spec.md:192 R-07 | `MicrocopyTagger.ts` + `types.ts:MicrocopySchema + MicrocopyTagSchema (7-value)` | `microcopy-tagger.test.ts` | 5 |
| AC-08 | T1B-008 | spec.md:193 R-08 | `AttentionScorer.ts` + `types.ts:AttentionSchema` | `attention-scorer.test.ts` | 5 |
| AC-09 | T1B-009 | spec.md:194 R-09 | `CommerceBlockExtractor.ts` + `types.ts:CommerceBlockSchema + StockStatusSchema` | `commerce-block-extractor.test.ts` | 5 |
| AC-10 | T1B-010 | spec.md:195 R-10 | `CurrencySwitcherDetector.ts` + `types.ts:CurrencySwitcherSchema` | `currency-switcher-detector.test.ts` | 5 |
| AC-11 | T1B-011 | spec.md:196 R-11 | `types.ts` (extended PageStateModelSchema — 16 inferred-type exports; 8 closed enums) | `page-state-model-extended.test.ts` (shared with AC-00) | (in 4 above) |
| AC-12 | T1B-012 | spec.md:197 (exit gate) | `pipeline.ts` + 4 new fixtures (example-com, amazon-in-pdp, peregrine-cart, peregrine-content) + 1 modified (peregrine-pdp) | `perception-extensions.test.ts` (integration) | 27 |

**Total tests turned RED→GREEN this phase: 80** (4 AC-00/11 + 4 AC-01 + 5 each AC-02..AC-10 + 27 AC-12). All authored RED in Wave 1 commit `01bb246`.

**Phase 1 regression check (Stage 3 verification):**
- 9 Phase 1 conformance files: 29 tests UNCHANGED + GREEN
- `phase1.test.ts` T015 integration: 5 tests UNCHANGED + GREEN
- `walking-skeleton.spec.ts` acceptance: 7 tests UNCHANGED + GREEN
- `phase-0-setup.spec.ts` acceptance: 5 tests UNCHANGED + GREEN (AC-02 self-resolved per R3.1 TDD cycle)

---

## §5 Resource cost breakdown

| Resource | Pre-Phase-1b | Post-Phase-1b | Δ |
|---|---|---|---|
| Phase 1b LLM calls per audit | — | 0 | 0 (per NF-03 zero-LLM phase) |
| Phase 1b LLM cost per audit | — | $0 | $0 |
| PageStateModel payload tokens (NF-Phase1-01 cap = 20K) | ~12.5K-13K (amazon.in floor) | ~14K-14.5K (amazon.in floor + Phase 1b delta) | ≤ +1.5K within cap |
| Browser time per page (p50) | 2.8s-6.2s (per fixture) | 2.8s-6.2s + ≤150ms | +~150ms (under NF-02 kill threshold of +200ms) |
| Storage per audit (reproducibility_snapshots, Phase 9 T160) | ~20K-23KB JSON | ~21.5K-26KB JSON | ~+7% (within storage budget) |
| agent-core src LOC (perception layer) | ~1,200 LOC (Phase 1) | ~3,300 LOC (Phase 1 + Phase 1b) | +~2,100 LOC (10 extractors + substrate + pipeline + schema closure) |
| agent-core test LOC (conformance + integration) | ~880 LOC (Phase 1) | ~2,460 LOC (Phase 1 + Phase 1b) | +~1,580 LOC (13 test files) |
| Fixture LOC (perception) | 222 LOC (peregrine-pdp.json) | 1,343 LOC (5 fixtures + Wave 2 patch) | +~1,121 LOC |
| Master orchestrator LLM cost (Phase 1b — Stage 1-4) | — | ~$9-10 | ~$9-10 of $10 per-phase ceiling (95% used; on track) |

**R10 SHOULD-cap overages introduced (queued for v0.2.1 polish):**

| File | Pre-1b | Post-1b | % over 300 | Owner |
|---|---|---|---|---|
| `packages/agent-core/src/perception/types.ts` | 297 | 659 | +120% | F-004; schema closure cost (proper R10 strict-typing tradeoff) |
| `packages/agent-core/src/perception/extensions/CommerceBlockExtractor.ts` | — | 317 | +6% | F-004; stock-status enum mapping helpers |
| `packages/agent-core/src/perception/ContextAssembler.ts` | 300 | 349 | +16% | pre-existing borderline; Wave 2 added 49 LOC |
| `packages/agent-core/src/perception/extensions/SubstrateExtension.ts` | — | 342 | +14% | F-004; local DOM types (avoids tsconfig lib expansion) |

All other extension files ≤270 LOC. Acceptable per R10 SHOULD (vs MUST); split candidates queued.

---

## §6 Trust spot-checks (3-5 sites a reviewer should hand-verify)

If all 3-5 pass, the rest of the phase is TRUSTED.

1. **`SubstrateExtension.ts:71-89` + `SubstrateExtension.script.ts:33-43` — NN-LL1 primaryActions heuristic cascade**
   - Risk: subagent invented a different cascade than the 4-rule spec (submit-type → ATC-pattern → ≥100×40 prominent → null)
   - How to verify: open both files; check the heuristic implementation matches the documented order; constants `PRIMARY_ACTION_TEXT_PATTERN`, `MIN_PROMINENT_CTA_WIDTH_PX = 100`, `MIN_PROMINENT_CTA_HEIGHT_PX = 40` are present and used in fall-through order

2. **`PopupPresenceDetector.ts` (~line 70-130) — NN-LL2 11-rule fall-through**
   - Risk: rules ordered wrong; `modal` placed before `paywall`/`consent_form`/`cookie_banner` collapses regulatory dialogs into `modal`
   - How to verify: open `classifyPopup` function; rules MUST be ordered: paywall → consent_form → cookie_banner → exit_intent_overlay → slide_in_panel → chat_widget → toast → drawer → lightbox → modal → other. First match wins; no scoring/blending. Behavior fields `isEscapeDismissible` + `isClickOutsideDismissible` MUST be literal `null` (Phase 5b reservation)

3. **R9 + R20 boundary grep**
   - Risk: extension file imports `'playwright'` directly (R9 violation) OR writes to `_extensions.*` (R20 namespace violation)
   - How to verify: run from repo root:
     ```bash
     grep -rn "from 'playwright'\\|require('playwright')" packages/agent-core/src/perception/extensions/ packages/agent-core/src/perception/SubstrateExtension*
     # Expected: zero results (Playwright stays in BrowserManager.ts)

     grep -rn "_extensions\\b" packages/agent-core/src/perception/extensions/
     # Expected: zero writes; only AttentionScorer should reference _extensions in a forward-comment context if at all
     ```

4. **`types.ts:280-410` — PageStateModelSchema closed-enum surface (T1B-011 closure)**
   - Risk: schema accepts a value not in the closed enum (e.g., PopupTypeSchema misses one of the 11 values; MicrocopyTagSchema collapses to 6 instead of 7)
   - How to verify: open `types.ts`; locate `PopupTypeSchema`, `ClickTargetElementTypeSchema`, `MicrocopyTagSchema`, `StockStatusSchema`, `ShippingSignalTypeSchema`, `AttentionElementTypeSchema`, `CurrencySwitcherLocationSchema`. Count values per schema: 11 / 4 / 7 / 5 / 5 / 5 / 3 respectively. Each schema is `z.enum([...])` (closed) NOT `z.string()` (open) UNLESS spec mandates open (R-03 sticky element `type` is the only open-string field)

5. **`FrictionScorer.ts:111-127` — weighted-sum formula matches plan §2.4**
   - Risk: weights inverted (e.g., popup×1.5 instead of ×2); clamp01 missing; normalization denominator wrong
   - How to verify: open `computeFrictionScore`; formula MUST read `total*1 + required*1.5 + popupCount*2 + forcedActionCount*4`. Normalization MUST be `clamp01(raw / 30)`. forcedActionCount MUST count popups where `blocksPrimaryContent === true OR (isInitiallyOpen === true && !hasCloseButton)`. Test fixture (15 fields / 5 required / 1 popup / 0 forced) must yield raw=24.5, normalized≈0.817

**Trust calibration heuristic:** if all 5 spot-checks pass, treat the rest of the phase as TRUSTED. If any fail, escalate to a deeper Stage 2.5 re-review against `.phase-state/1b/code-review-findings.yaml`.

---

## §7 Open ends linkage

- Limitations carried forward → [`phase-1b-current.md`](phase-1b-current.md) §4 (runtime wiring deferred to Phase 5 + Phase 1c; 2 spec contradictions queued v0.2.1; 4 R10 SHOULD overages; Sharp adapter; substrate-parity test)
- Open risks for next phase → [`phase-1b-current.md`](phase-1b-current.md) §5 (Phase 1c envelope; Phase 5 BrowseNode runtime wiring; Phase 7 token budget when EvaluateNode ingests full extended PSM)
- Stage 2.5 follow-up findings → [`.phase-state/1b/code-review-findings.yaml`](../../../../.phase-state/1b/code-review-findings.yaml) (F-001..F-006; all LOW; queued v0.2.1)

---

## §8 How this doc was authored

Master orchestrator Stage 4 exit deliverable, paired with [`phase-1b-current.md`](phase-1b-current.md). ASCII diagrams generated from real impl state at HEAD `90c44ab` (Wave 6 commit) + Stage 4 status-bump commit (forthcoming). Subsequent edits should bump version + add a delta block per R18.

**Authoring time:** ~15 minutes (template-driven; diagrams hand-shaped from impl inventory; spot-checks distilled from Stage 2.5 review findings).

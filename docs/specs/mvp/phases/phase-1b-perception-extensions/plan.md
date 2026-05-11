---
title: Phase 1b — Perception Extensions (PageStateModel extension) — Implementation Plan
artifact_type: plan
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
  - docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md v0.2
  - docs/specs/mvp/tasks-v2.md (T1B-001..T1B-012; T1B-000 added in this phase's tasks.md, pending v2.3.4 alignment)
  - docs/specs/final-architecture/07-analyze-mode.md §7.9.2
  - docs/specs/mvp/phases/phase-1-perception/phase-1-current.md (PageStateModel canonical surface + NF-Phase1-01 v0.4 token budget + _extensions namespace reservation)
  - docs/Improvement/perception_layer_spec.md (gap-closure items 1-10)
  - .phase-state/1b/preflight-verdict.yaml (Gate 1 REVISE — Path B + popup option a + bundled polish)

req_ids:
  - REQ-ANALYZE-PERCEPTION-V24-001

impact_analysis: docs/specs/mvp/phases/phase-1b-perception-extensions/impact.md
breaking: false
affected_contracts:
  - PageStateModel

delta:
  new:
    - v0.1 (2026-04-28) — sequencing, extractor design notes, kill criteria
    - v0.2 — T1B-000 PageStateModel substrate extension task at Day 0 (Path B per Gate 1 REVISE)
    - v0.2 — ExtractCtx TypeScript interface declared in §2.2 (H2 from Gate 1)
  changed:
    - v0.2 — Contract name AnalyzePerception → PageStateModel (C1)
    - v0.2 — File paths schema.ts → types.ts; analyzePerception.ts → ContextAssembler.ts (C3)
    - v0.2 — Token budget kill threshold 6.5K → 20K (C4 — Phase 1's NF-Phase1-01 v0.4 baseline)
    - v0.2 — Browser-time kill baseline rebased on Phase 1's actual capture timings (C4 follow-on)
    - v0.2 — Backward-compat verification target rewritten on PageStateModel sub-schemas (H4)
    - v0.2 — Total effort estimate 11h ± 2 → 13.5h ± 2.5 (T1B-000 adds ~2.5h)
  impacted: []
  unchanged:
    - All T1B-NNN task IDs (R18)
    - Kill criteria taxonomy structure (only threshold values updated)
    - FrictionScorer formula in §2.4 (unchanged)

governing_rules:
  - Constitution R10 (Budget)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R11.4 (Fix spec before implementing)
  - Constitution R20 (Impact Analysis)
  - Constitution R23 (Kill Criteria)
  - Constitution R24 (Perception MUST NOT)
---

# Phase 1b Implementation Plan

> **Summary (~140 tokens):** Path B (Gate 1 REVISE 2026-05-09). Day 0: T1B-000 extends Phase 1's `PageStateModel` (`packages/agent-core/src/perception/types.ts`) with substrate fields (`ctas[]`, `formFields[]`, `metadata.schemaOrg`, `metadata.ogTags`, `headings[]`, `primaryActions`). Day 1-2: 6 parallel extractors. Day 3: PopupPresenceDetector + AttentionScorer + MicrocopyTagger (ground-truth-dependent). Day 4: FrictionScorer + schema closure + 5-fixture integration. All extractions share one `page.evaluate()` call dispatched by `ContextAssembler.capture()`. Kill criteria triggers on token-budget breach (>20K — Phase 1's NF-Phase1-01 v0.4 cap), browser-time regression (>+200ms p50 vs Phase 1's empirical baseline), or microcopy precision <70%. Total estimated effort: 13.5h ± 2.5 across 13 tasks (T1B-000..T1B-012).

---

## 1. Sequencing

T1B-000 is sequential (substrate must land before extractors). T1B-001..T1B-010 are then largely independent. Recommended order optimizes for early integration-test signal:

```
Day 0 (sequential — Path B substrate):
  T1B-000 PageStateModel substrate extension   ← Day 0 prerequisite; extends types.ts with ctas/formFields/schemaOrg/ogTags/headings/primaryActions

Day 1-2 (parallelizable; all depend on T1B-000):
  T1B-001 PricingExtractor          ← reads metadata.schemaOrg (JSON-LD Offer) + on-page text
  T1B-002 ClickTargetSizer          ← reads ctas[] sizePx
  T1B-003 StickyElementDetector     ← exercises getComputedStyle path; reads ctas[] for containsPrimaryCta
  T1B-006 SocialProofDepthEnricher  ← reads metadata.schemaOrg (AggregateRating)
  T1B-009 CommerceBlockExtractor    ← reads metadata.schemaOrg (Offer/AggregateOffer) + primaryActions + pricing (R-01 result)
  T1B-010 CurrencySwitcherDetector  ← extends metadata only

Day 3:
  T1B-004 PopupPresenceDetector     ← presence layer + 11-type enum (popup option a); dependency for T1B-005
  T1B-008 AttentionScorer           ← Sharp contrast pipeline (slowest extractor)
  T1B-007 MicrocopyTagger           ← needs ground-truth set first; reads ctas[] by index

Day 4:
  T1B-005 FrictionScorer            ← reads T1B-004 popups[] + T1B-000 formFields[]
  T1B-011 PageStateModel extended schema (Zod)  ← closes the set; extends types.ts
  T1B-012 Integration test          ← exit gate; 5 fixtures (3 Phase 1 reuse + 2 new Peregrine cart/content)
```

Dependencies (from tasks-v2.md + this phase's tasks.md):
- T1B-000 ← T013 (ContextAssembler) + T014 (PageStateModel types.ts) — Phase 1 prerequisites already shipped
- T1B-001..T1B-010 ← T1B-000 (substrate must land first)
- T1B-005 ← T1B-004 + T1B-000
- T1B-007 ← T1B-000 + ground-truth fixture set (ASK FIRST if not available)
- T1B-008 ← T013 (Sharp pipeline already wired in Phase 1's `ScreenshotExtractor`; no new dep)
- T1B-011 ← T1B-000..T1B-010 (closes the schema by extending types.ts further)
- T1B-012 ← T1B-001..T1B-011 (full set)

---

## 2. Architecture

### 2.1 File layout

```
packages/agent-core/src/perception/
├── types.ts                                 # Phase 1's PageStateModel (T014) — extended by T1B-000 + T1B-001..T1B-011 (NOT a new file; existing file from Phase 1)
├── ContextAssembler.ts                      # Phase 1's producer (T013) — its single `page.evaluate()` accepts T1B-000 substrate extraction + Phase 1b extension hooks
└── extensions/                              # NEW directory in Phase 1b
    ├── SubstrateExtension.ts                # T1B-000 — populates ctas[]/formFields[]/schemaOrg/ogTags/headings[]/primaryActions
    ├── PricingExtractor.ts                  # T1B-001
    ├── ClickTargetSizer.ts                  # T1B-002
    ├── StickyElementDetector.ts             # T1B-003
    ├── PopupPresenceDetector.ts             # T1B-004
    ├── FrictionScorer.ts                    # T1B-005 (depends on PopupPresenceDetector + T1B-000)
    ├── SocialProofDepthEnricher.ts          # T1B-006
    ├── MicrocopyTagger.ts                   # T1B-007
    ├── AttentionScorer.ts                   # T1B-008
    ├── CommerceBlockExtractor.ts            # T1B-009
    └── CurrencySwitcherDetector.ts          # T1B-010
```

Test layout:

```
packages/agent-core/tests/conformance/
├── page-state-model-extended.test.ts        # AC-00 (T1B-000) + AC-11 (T1B-011) — extends Phase 1's perception-types.test.ts
├── pricing-extractor.test.ts                # AC-01
├── click-target-sizer.test.ts               # AC-02
├── sticky-element-detector.test.ts          # AC-03
├── popup-presence-detector.test.ts          # AC-04
├── friction-scorer.test.ts                  # AC-05
├── social-proof-depth.test.ts               # AC-06
├── microcopy-tagger.test.ts                 # AC-07 (needs ground truth)
├── attention-scorer.test.ts                 # AC-08
├── commerce-block-extractor.test.ts         # AC-09
└── currency-switcher-detector.test.ts       # AC-10

packages/agent-core/tests/integration/
└── perception-extensions.test.ts            # AC-12 (5 fixtures: 3 Phase 1 reuse + 2 new Peregrine cart/content)
```

### 2.2 Extension contract

Each Phase 1b extractor exports a single function with the signature:

```ts
export function extractX(doc: Document, viewport: Viewport, ctx: ExtractCtx): XResult;
```

`ExtractCtx` is the substrate populated by T1B-000:

```ts
export interface ExtractCtx {
  // Populated by T1B-000 SubstrateExtension; available to all T1B-001..T1B-010 extractors:
  ctas: Array<{ index: number; text: string; selector: string; sizePx: { width: number; height: number }; }>;
  formFields: Array<{ selector: string; type: 'text' | 'email' | 'password' | 'tel' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'other'; required: boolean; }>;
  metadata: {                                  // Phase 1's existing Metadata sub-schema fields are also here
    schemaOrg: Array<Record<string, unknown>>; // parsed JSON-LD fragments
    ogTags: Record<string, string>;            // <meta property="og:*"> tags
  };
  headings: Array<{ level: 1 | 2 | 3 | 4 | 5 | 6; text: string; selector: string; }>;
  primaryActions: { selector: string; text: string; } | null;  // dominant CTA on the page (e.g., Add-to-bag on PDP)

  // Phase 1b extractors that run later in the pipeline may also access earlier-stage outputs (read-only):
  pricing?: PricingBlock | null;               // populated by T1B-001 (R-01 runs first)
  popups?: Popup[];                            // populated by T1B-004 (T1B-005 consumes this)
}
```

- Synchronous; runs inside the existing `page.evaluate()` call dispatched by `ContextAssembler.capture()` (R24 — no new round-trip).
- Pure function — no global state, no side effects, no logging from inside the page (Pino logs from outside the evaluate boundary).
- Pipeline order matters: T1B-000 first → T1B-001 (pricing) → T1B-002/003/004/006/008/009/010 (independent) → T1B-005 (reads T1B-004) → T1B-007 (reads T1B-000 + ground truth). T1B-011 then closes the Zod schema.

### 2.3 Schema integration (T1B-011)

`PageStateModelSchema` (from Phase 1's `types.ts`) is extended with T1B-000 substrate fields + 10 Phase 1b extension field groups. Backward compat enforced via:

- All Phase 1 sub-schemas (Metadata, AccessibilityTree, FilteredDOM, InteractiveGraph, Visual, Diagnostics) keep their exact names, types, optionality. T1B-000 adds fields *to* Metadata (`schemaOrg`, `ogTags`) and top-level (`ctas`, `formFields`, `headings`, `primaryActions`).
- All new fields use `.nullable()` or `.optional()` where appropriate so Phase 1 consumers (walking-skeleton fixture path; `ContextAssembler.capture()` callers) don't fail when reading Phase 1 fixtures replayed against the extended schema.
- Zod `safeParse` runs in conformance test against the Phase 1 baseline fixture (`peregrine-pdp.json`) — must succeed without the new fields populated (the fixture is updated in T1B-000 commit to populate them; Phase 1's other fixtures stay as-is to verify backward compat).
- `_extensions` namespace remains UNTOUCHED — Phase 1b additions are top-level / inside `metadata`; Phase 7 DeepPerceiveNode owns `_extensions.deepPerceive` (see impact.md §11 Namespace contract).

### 2.4 FrictionScorer formula (R-05 disclosure)

```
raw = totalFormFields × 1
    + requiredFormFields × 1.5
    + popupCount × 2
    + forcedActionCount × 4

normalized = clamp(raw / 30, 0, 1)
```

The `30` denominator is calibrated such that a typical e-comm checkout (15 fields, 5 required, 1 popup) lands near `normalized ≈ 0.83`. Calibration documented inline; subject to revision in Phase 6 once heuristics consume the metric.

---

## 3. Risks & kill criteria *(R23)*

| Risk | Trigger | Action |
|---|---|---|
| Token budget breach | Extended PageStateModel payload >20K on any fixture (Phase 1's NF-Phase1-01 v0.4 cap) | KILL: drop AttentionScorer.contrastHotspots from 3 to 1, OR lossy-compress microcopy text fields, OR move SocialProofDepth to behind a flag. Re-measure. If still over, fall back to Phase 1's 4-stage shrink ladder. If still over, escalate (ASK FIRST) — do not silently exceed. |
| Browser-time regression | p50 +200ms vs Phase 1 baseline (empirical: example.com 1.7s, amazon.in 3.1s, Peregrine 4.8s per phase-1-current.md) across 5 fixtures | KILL: profile inside `page.evaluate()`. AttentionScorer Sharp call is the most likely culprit. Move per-element contrast to a single full-page pass. |
| MicrocopyTagger precision <70% after one tuning pass | AC-07 fails twice | KILL: drop from rule-based regex to LLM-tagged in Phase 6 (NOT in 1b — keeps Phase 1b zero-LLM). Mark `microcopy.nearCtaTags[] = []` and document the gap. |
| Ground-truth fixture set unavailable | Before AC-07 run | KILL: ASK FIRST per R11.3 — Phase 1b cannot ship T1B-007 acceptance without ground truth. |
| Backward-compat regression | Phase 1 integration test (T015 in `tests/integration/phase1.test.ts`) OR walking-skeleton 7/7 (`tests/acceptance/walking-skeleton.spec.ts`) fails | KILL: stop. Spec-conflict resolution per R1.4. Do NOT silently rename or change Phase 1 sub-schema shapes. |
| Cross-cutting impact discovered mid-implementation | Schema needs to grow beyond §7.9.2 spec OR `_extensions` namespace creep | KILL: pause, update impact.md, ASK FIRST. Do NOT extend the schema unilaterally (R20). Do NOT touch `_extensions.*` — that's Phase 7's reserved namespace. |
| T1B-000 substrate ships wrong shape | T1B-000 conformance test (AC-00) fails on Phase 1 fixtures OR T1B-001/005/006/007/009 can't read substrate cleanly | KILL: stop T1B-001..T1B-010 dispatch; redesign substrate first. Path B's whole premise is that substrate is correct before extractors run. |

---

## 4. Effort estimate

| Task | Effort | Notes |
|---|---|---|
| **T1B-000 PageStateModel substrate extension** | **2.5h** | **Path B prerequisite. Extends types.ts with ctas[]/formFields[]/schemaOrg/ogTags/headings[]/primaryActions. Updates ContextAssembler's page.evaluate() body. Patches Peregrine fixture to populate new fields. Runs Phase 1 conformance suite as smoke gate.** |
| T1B-001 PricingExtractor | 1.0h | JSON-LD + on-page text extraction (reads ctx.metadata.schemaOrg from T1B-000) |
| T1B-002 ClickTargetSizer | 0.5h | reads ctx.ctas sizePx + WCAG threshold |
| T1B-003 StickyElementDetector | 0.5h | getComputedStyle filter |
| T1B-004 PopupPresenceDetector | 1.5h | classification across 11-type enum (was 1.0h before popup option a expansion; +0.5h for 4 new branches) |
| T1B-005 FrictionScorer | 0.5h | weighted sum; depends on T1B-004 + ctx.formFields[] from T1B-000 |
| T1B-006 SocialProofDepthEnricher | 1.0h | review-block + JSON-LD AggregateRating (reads ctx.metadata.schemaOrg) |
| T1B-007 MicrocopyTagger | 2.0h | ground-truth review + regex tuning; reads ctx.ctas[] by index |
| T1B-008 AttentionScorer | 1.5h | Sharp contrast pipeline + scoring |
| T1B-009 CommerceBlockExtractor | 1.0h | Offer schema (ctx.metadata.schemaOrg) + ATC pattern detection (ctx.primaryActions) + R-01 pricing reference |
| T1B-010 CurrencySwitcherDetector | 0.5h | header/footer scan + switcher detection |
| T1B-011 PageStateModel extended schema (Zod) | 0.5h | additive Zod types in types.ts |
| T1B-012 Integration test | 1.0h | 5 fixtures (3 Phase 1 reuse + 2 new Peregrine cart/content); backward-compat run via T015 + walking-skeleton acceptance |
| **Total** | **13.5h ± 2.5** | Single engineer (T1B-000 adds 2.5h vs v0.1's 11h baseline; T1B-004 adds 0.5h for popup expansion) |

> Tasks above 2.0h: T1B-007 at 2.0h is the boundary. T1B-000 at 2.5h is just over and gets explicit kill criteria (per §3 table — "T1B-000 substrate ships wrong shape").

---

## 5. Verification

- **Per-task:** conformance test passes on its fixtures.
- **Per-phase:** integration test (T1B-012) on 5 fixtures (3 Phase 1 reuse + 2 new) + Phase 1 baseline test (T015 in `tests/integration/phase1.test.ts`) re-runs unchanged + walking-skeleton acceptance suite (`tests/acceptance/walking-skeleton.spec.ts`) 7/7 re-runs unchanged.
- **Token budget:** `tiktoken cl100k_base` count logged from inside the integration test; assertion enforces ≤20K on every fixture (Phase 1's NF-Phase1-01 v0.4 cap — same as Phase 1).
- **Cost:** verify `llm_call_log` row count diff = 0 between Phase 1 baseline and Phase 1b extended audit runs (Phase 1b adds zero LLM calls).
- **Backward compat:** Phase 1 conformance suite (10 tests: T-PHASE1-TESTS + T006-T015 conformance tests + `perception-types.test.ts`) re-runs against extended PageStateModel — must pass unchanged.
- **Namespace contract:** verify Phase 1b additions are at top-level / inside `metadata`; verify NO additions under `_extensions.*` (Phase 7's reserved namespace per `phase-1-current.md` §5; see impact.md §11).

---

## 6. Out of scope for this plan

- Phase 5b popup-behavior probing (covered in Phase 5b plan)
- Phase 1c PerceptionBundle envelope (covered in Phase 1c plan)
- Heuristic authoring against v2.4 fields (Phase 0b + Phase 6)
- Multi-viewport perception (Phase 5b)

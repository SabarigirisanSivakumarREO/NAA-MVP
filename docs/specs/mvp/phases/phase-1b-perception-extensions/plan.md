---
title: Phase 1b — Perception Extensions v2.4 — Implementation Plan
artifact_type: plan
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
  - docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md
  - docs/specs/mvp/tasks-v2.md (T1B-001..T1B-012)
  - docs/specs/final-architecture/07-analyze-mode.md §7.9.2
  - docs/Improvement/perception_layer_spec.md (gap-closure items 1-10)

req_ids:
  - REQ-ANALYZE-PERCEPTION-V24-001

impact_analysis: docs/specs/mvp/phases/phase-1b-perception-extensions/impact.md
breaking: false
affected_contracts:
  - AnalyzePerception

delta:
  new:
    - Phase 1b plan — sequencing, extractor design notes, kill criteria
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R10 (Budget)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R20 (Impact Analysis)
  - Constitution R23 (Kill Criteria)
  - Constitution R24 (Perception MUST NOT)
---

# Phase 1b Implementation Plan

> **Summary (~120 tokens):** Implement 10 perception extractors + v2.4 Zod schema + integration test in week 2-3, after Phase 1 (v2.3 baseline) ships. All 10 extractors share one `page.evaluate()` call; serial implementation order is dictated only by dependency (`FrictionScorer` reads `popups[]`, schema closes the set). Kill criteria triggers on token-budget breach (>6.5K), browser-time regression (>+200ms p50), or microcopy precision <70% after one tuning pass. Total estimated effort: 9-13 engineering hours across 12 tasks.

---

## 1. Sequencing

T1B-001..T1B-010 are largely independent extractors. Recommended order optimizes for early integration-test signal:

```
Day 1-2 (parallelizable):
  T1B-001 PricingExtractor          ← high-leverage signal, exercises JSON-LD path
  T1B-002 ClickTargetSizer          ← exercises bounding-rect path
  T1B-003 StickyElementDetector     ← exercises getComputedStyle path
  T1B-006 SocialProofDepthEnricher  ← exercises JSON-LD AggregateRating
  T1B-009 CommerceBlockExtractor    ← exercises JSON-LD Offer + heuristic patterns
  T1B-010 CurrencySwitcherDetector  ← extends metadata only

Day 3:
  T1B-004 PopupPresenceDetector     ← presence layer; dependency for T1B-005
  T1B-008 AttentionScorer           ← Sharp contrast pipeline (slowest extractor)
  T1B-007 MicrocopyTagger           ← needs ground-truth set first

Day 4:
  T1B-005 FrictionScorer            ← reads popups[] (T1B-004) + formFields[] (v2.3)
  T1B-011 AnalyzePerception v2.4 schema (Zod)  ← closes the set
  T1B-012 Integration test          ← exit gate
```

Dependencies (from tasks-v2.md):
- T1B-005 ← T1B-004 + T013
- T1B-007 ← ground-truth fixture set (ASK FIRST if not available)
- T1B-008 ← Sharp pipeline already wired in v2.3 (no new dep)
- T1B-011 ← T1B-001..T1B-010 + T014 (existing perception schema location)
- T1B-012 ← T1B-001..T1B-011 (full set)

---

## 2. Architecture

### 2.1 File layout

```
packages/agent-core/src/perception/
├── schema.ts                                # v2.4 Zod schema — extends v2.3 in-place (T1B-011)
├── analyzePerception.ts                     # v2.3 `page.evaluate()` driver — extension hooks added (existing)
└── extensions/
    ├── PricingExtractor.ts                  # T1B-001
    ├── ClickTargetSizer.ts                  # T1B-002
    ├── StickyElementDetector.ts             # T1B-003
    ├── PopupPresenceDetector.ts             # T1B-004
    ├── FrictionScorer.ts                    # T1B-005 (depends on PopupPresenceDetector)
    ├── SocialProofDepthEnricher.ts          # T1B-006
    ├── MicrocopyTagger.ts                   # T1B-007
    ├── AttentionScorer.ts                   # T1B-008
    ├── CommerceBlockExtractor.ts            # T1B-009
    └── CurrencySwitcherDetector.ts          # T1B-010
```

Test layout:

```
packages/agent-core/tests/conformance/
├── pricing-extractor.test.ts                # AC-01
├── click-target-sizer.test.ts               # AC-02
├── sticky-element-detector.test.ts          # AC-03
├── popup-presence-detector.test.ts          # AC-04
├── friction-scorer.test.ts                  # AC-05
├── social-proof-depth.test.ts               # AC-06
├── microcopy-tagger.test.ts                 # AC-07 (needs ground truth)
├── attention-scorer.test.ts                 # AC-08
├── commerce-block-extractor.test.ts         # AC-09
├── currency-switcher-detector.test.ts       # AC-10
└── analyze-perception-v24-schema.test.ts    # AC-11

packages/agent-core/tests/integration/
└── perception-extensions.test.ts            # AC-12 (5 fixtures)
```

### 2.2 Extension contract

Each extractor exports a single function with the signature:

```ts
export function extractX(doc: Document, viewport: Viewport, ctx: ExtractCtx): XResult;
```

- Synchronous; runs inside the existing `page.evaluate()` call (R24 — no new round-trip).
- `ctx` carries v2.3 outputs already computed (`ctas[]`, `formFields[]`, `metadata`, structured-data parses) so extractors can reference them without re-querying the DOM.
- Pure function — no global state, no side effects, no logging from inside the page (Pino logs from outside the evaluate boundary).

### 2.3 Schema integration (T1B-011)

`AnalyzePerception` v2.4 schema is the existing v2.3 Zod schema with 10 new fields appended. Backward compat enforced via:

- All v2.3 fields keep their exact names, types, optionality.
- v2.4 fields use `.nullable()` or `.optional()` where appropriate so older consumers don't fail when reading v2.3 fixtures replayed against v2.4 code.
- Zod `safeParse` runs in conformance test against a v2.3 baseline fixture — must succeed without the v2.4 fields populated.

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
| Token budget breach | Payload >6.5K on any fixture | KILL: drop AttentionScorer.contrastHotspots from 3 to 1, OR lossy-compress microcopy text fields, OR move SocialProofDepth to behind a flag. Re-measure. If still over, escalate (ASK FIRST) — do not silently exceed. |
| Browser-time regression | p50 +200ms vs v2.3 across 5 fixtures | KILL: profile inside `page.evaluate()`. AttentionScorer Sharp call is the most likely culprit. Move per-element contrast to a single full-page pass. |
| MicrocopyTagger precision <70% after one tuning pass | AC-07 fails twice | KILL: drop from rule-based regex to LLM-tagged in Phase 6 (NOT in 1b — keeps v2.4 zero-LLM). Mark `microcopy.nearCtaTags[] = []` and document the gap. |
| Ground-truth fixture set unavailable | Before AC-07 run | KILL: ASK FIRST per R11.3 — Phase 1b cannot ship T1B-007 acceptance without ground truth. |
| Backward-compat regression | Phase 1 integration test (T015) fails | KILL: stop. Spec-conflict resolution per R1.4. Do NOT silently rename or change v2.3 field shapes. |
| Cross-cutting impact discovered mid-implementation | Schema needs to grow beyond §7.9.2 spec | KILL: pause, update impact.md, ASK FIRST. Do NOT extend the schema unilaterally (R20). |

---

## 4. Effort estimate

| Task | Effort | Notes |
|---|---|---|
| T1B-001 PricingExtractor | 1.0h | JSON-LD + on-page text extraction |
| T1B-002 ClickTargetSizer | 0.5h | bounding-rect loop + WCAG threshold |
| T1B-003 StickyElementDetector | 0.5h | getComputedStyle filter |
| T1B-004 PopupPresenceDetector | 1.0h | classification heuristic + presence-only fields |
| T1B-005 FrictionScorer | 0.5h | weighted sum; depends on T1B-004 |
| T1B-006 SocialProofDepthEnricher | 1.0h | review-block + JSON-LD AggregateRating |
| T1B-007 MicrocopyTagger | 2.0h | ground-truth review + regex tuning |
| T1B-008 AttentionScorer | 1.5h | Sharp contrast pipeline + scoring |
| T1B-009 CommerceBlockExtractor | 1.0h | Offer schema + ATC pattern detection |
| T1B-010 CurrencySwitcherDetector | 0.5h | header/footer scan + switcher detection |
| T1B-011 v2.4 Zod schema | 0.5h | additive types |
| T1B-012 Integration test | 1.0h | 5 fixtures; backward-compat run |
| **Total** | **11.0h ± 2** | Single engineer |

> Tasks above 2.0h (none in Phase 1b after the per-extractor split) would require kill criteria per task. T1B-007 at 2.0h is the closest — kill criteria already documented above.

---

## 5. Verification

- **Per-task:** conformance test passes on its fixtures.
- **Per-phase:** integration test (T1B-012) on 5 fixtures + Phase 1 baseline test (T015) re-runs unchanged.
- **Token budget:** `getTokenCount()` logged from inside the integration test; assertion enforces ≤6.5K on every fixture.
- **Cost:** verify `llm_call_log` row count diff = 0 between v2.3 and v2.4 audit runs.
- **Backward compat:** Phase 1 conformance suite (T006-T015 conformance tests) re-runs against v2.4 schema — must pass unchanged.

---

## 6. Out of scope for this plan

- Phase 5b popup-behavior probing (covered in Phase 5b plan)
- Phase 1c PerceptionBundle envelope (covered in Phase 1c plan)
- Heuristic authoring against v2.4 fields (Phase 0b + Phase 6)
- Multi-viewport perception (Phase 5b)

---
title: Phase 1c — Impact Analysis
artifact_type: impact
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
  - docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md
  - docs/specs/mvp/constitution.md (R20 — Impact Analysis Before Cross-Cutting Changes)
  - docs/specs/final-architecture/07-analyze-mode.md §7.9.3

req_ids:
  - REQ-ANALYZE-PERCEPTION-V25-001
  - REQ-PERCEPT-V25-002
  - REQ-BROWSE-PERCEPT-007
  - REQ-BROWSE-PERCEPT-008

breaking: false
affected_contracts:
  - PerceptionBundle (NEW shared contract)
  - AnalyzePerception (wrapped, not modified)
  - PageStateModel (wrapped, not modified)
  - deep_perceive output type (changes; helper provided)

delta:
  new:
    - Phase 1c impact analysis — required by R20 (PerceptionBundle is new shared contract; deep_perceive output type changes)
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes)
  - Constitution R18 (Delta-Based Updates)
  - Constitution R5.1 (Backward Compat Invariant)
---

# Phase 1c Impact Analysis

> **Why this file exists:** Constitution R20. Phase 1c introduces a NEW shared contract (`PerceptionBundle`) and changes the return type of `deep_perceive`. Backward-compat is preserved via accessor helper `bundleToAnalyzePerception()`, but the shared-contract gate requires explicit per-consumer audit.

---

## 1. Contract changes

| Contract | Before | After | Breaking? |
|---|---|---|---|
| PerceptionBundle | — | New top-level perception contract | New (additive) |
| AnalyzePerception | Top-level return value of `page_analyze` / `deep_perceive` | Lives inside `bundle.raw.analyze_perception_by_state[stateId]` | **No** — accessor `bundleToAnalyzePerception(bundle)` returns identical shape |
| PageStateModel | Top-level return value of `getState` | Lives inside `bundle.raw.page_state_model_by_state[stateId]` | **No** — accessor provided |
| `deep_perceive` output type | `AnalyzePerception` | `PerceptionBundle` | **Type-level breaking** for direct consumers; mitigated by accessor helper |

The bundle envelope is purely additive at the data level. Type-level migration is required for `deep_perceive` direct consumers — three call sites in MVP scope (see §3 below).

---

## 2. Producers affected

| Producer | File | Change required | Owner |
|---|---|---|---|
| `page_analyze` MCP tool (§08.4) | `packages/agent-core/src/mcp/tools/page-analyze.ts` | Returns AnalyzePerception unchanged in MVP — bundle assembly happens in `deep_perceive`, not `page_analyze` | None |
| `deep_perceive` (Phase 7 / §07.5) | `packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts` | Wraps AnalyzePerception capture in PerceptionBundle; gates on settle | Phase 1c T1C-011 (forward stub) → Phase 7 T117 (full integration) |
| New: settle predicate | `packages/agent-core/src/perception/SettlePredicate.ts` | Implemented in T1C-001 | Phase 1c |
| New: traversal extensions | `packages/agent-core/src/perception/{ShadowDom,Portal,PseudoElement,Iframe,Hidden}*.ts` | Implemented in T1C-002..T1C-006 | Phase 1c |
| New: ElementGraphBuilder | `packages/agent-core/src/perception/ElementGraphBuilder.ts` | Implemented in T1C-007 | Phase 1c |
| New: NondeterminismDetector + WarningEmitter | `packages/agent-core/src/perception/{NondeterminismDetector,WarningEmitter}.ts` | T1C-008 + T1C-009 | Phase 1c |
| New: PerceptionBundle Zod schema | `packages/agent-core/src/perception/PerceptionBundle.ts` | T1C-010 | Phase 1c |
| Phase 1c integration test | `packages/agent-core/tests/integration/perception-bundle.test.ts` | T1C-012 | Phase 1c |

---

## 3. Consumers affected (per R20 audit)

| Consumer | Location | Reads AnalyzePerception? | Migration required? | Action |
|---|---|---|---|---|
| `evaluate` LLM node (§7.5) | `packages/agent-core/src/analysis/nodes/EvaluateNode.ts` (Phase 7) | Yes | **Yes** — switch from `state.analyze_perception` to `bundleToAnalyzePerception(state.bundle)` | Phase 7 EvaluateNode references the accessor. No data shape change — only the access path. |
| GR-001..GR-008 grounding rules | `packages/agent-core/src/analysis/grounding/*` (Phase 7) | Yes (field paths) | **No** — accessor returns v2.4 shape unchanged | Field paths still resolve. |
| `annotate_and_store` (§7.10) | `packages/agent-core/src/delivery/AnnotateAndStore.ts` (Phase 7/9) | Reads screenshot URL | **Yes** — switch from top-level URL to `bundle.raw.full_page_screenshot_url_by_state[stateId]` | Helper accessor provided. |
| Phase 5 Browse-mode integration | `packages/agent-core/src/orchestration/browse-mode/*` (Phase 5) | Reads AnalyzePerception fields | **No** — Phase 5 reads from MCP tool outputs that retain v2.4 shape | None |
| Phase 6 Heuristic KB filter | `packages/agent-core/src/heuristics/*` | Reads AnalyzePerception field paths | **No** — accessor returns v2.4 shape | None |
| Reproducibility snapshot | `packages/agent-core/src/reproducibility/*` | Stores full perception payload | **Yes** — snapshot now stores PerceptionBundle (5K → 8.5K per state) | Storage budget reviewed — OK within Phase 0 estimate. |
| `audit_events` log | DB | Logs perception payload | **Yes** — log row size grows ~70% | Append-only; no migration. |
| Cross-page PatternDetector | `packages/agent-core/src/analysis/cross-page/*` (Phase 8) | Reads AnalyzePerception fields | **No** — accessor returns v2.4 shape | None |
| Delivery layer (PDF / dashboard) | `packages/agent-core/src/delivery/*`, `apps/dashboard/*` | Surfaces AnalyzePerception fields to consultant | **No** — surfacing logic reads from accessor | None |
| External MCP consumers (out of scope MVP) | n/a | n/a | n/a | n/a |

**Net break risk:** type-level only. All consumers continue to read identical v2.4 field shapes via the accessor. Three direct call sites need a one-line edit (EvaluateNode + AnnotateAndStore + DeepPerceiveNode).

---

## 4. Heuristic engine impact

PerceptionBundle enables (but does not author) new heuristic categories:

- Cross-channel correlation queries (e.g., "low-contrast above-fold buttons")
- Nondeterminism-aware findings (e.g., "do not finalize this finding — Optimizely active")
- Settle-aware findings (e.g., "fonts not ready when CTA rendered" via `FONTS_NOT_READY` warning)
- Element-graph–shaped heuristics (parent/child traversal)

GR-001..GR-008 unchanged. New grounding rules (GR-013+) may be authored later.

---

## 5. Cost impact

| Metric | v2.4 | v2.5 | Δ |
|---|---|---|---|
| New LLM calls per audit | — | 0 | 0 |
| Net per-audit LLM cost | $X | $X | $0 |
| Browser time per state (p50) | T (v2.4) | T+~200ms (settle predicate) | +~200ms |
| Bundle token size per state | 6.5K | 8.5K | +2K |
| Phase 7 evaluate prompt context | ~6.5K | ~8.5K | +2K (~$0.006 per evaluate at Sonnet 4 input rate) |

**Net audit cost impact:** ~$0.06 per audit (10 evaluate calls × +$0.006). Well below $15 cap (R10).

---

## 6. Storage impact

`reproducibility_snapshots` row size grows ~70% (5K → 8.5K). Phase 0 storage estimate accommodates 10K-per-snapshot ceiling — within budget.

`audit_events` log entries that include perception grow proportionally. Append-only — no migration (R7.4).

**No DB schema migration required for Phase 1c.**

---

## 7. Reproducibility impact

`reproducibility_snapshot.perception_schema_version` field is updated from `"v2.4"` to `"v2.5"`. Bundle is `Object.freeze`d — immutable post-capture. `element_id` stability rule documented in plan.md §2.3 ensures replay-equivalence: same URL + same code = identical `element_id` set.

V2.4 snapshots remain valid for replay through the accessor helper (the bundle's `raw.analyze_perception_by_state[initial_state_id]` reconstructs the v2.4 shape from on-disk v2.4 data when replayed against v2.5 code, by treating the v2.4 snapshot as a single-state bundle).

---

## 8. Documentation impact

| Doc | Change |
|---|---|
| `docs/specs/final-architecture/07-analyze-mode.md` §7.9.3 | Already documents v2.5 (REQ-ANALYZE-PERCEPTION-V25-001). No change. |
| `docs/specs/final-architecture/06-browse-mode.md` §6.6 v2.5 | Already documents traversal extensions. No change. |
| `docs/specs/mvp/PRD.md` F-004 | Reference v2.5 schema after Phase 1c ships (next PRD bump). |
| `docs/specs/mvp/phases/INDEX.md` | Add Phase 1c row (handled by INDEX regeneration step). |
| `docs/specs/mvp/constitution.md` | R26 (State Exploration MUST NOT) already covers some envelope MUST-NOTs; v2.5-specific MUST-NOTs are listed in spec §7.9.3 — no constitution update required. |
| `docs/specs/mvp/phases/phase-1b-perception-extensions/phase-1b-current.md` | Phase 1b rollup notes Phase 1c as immediate successor. |

---

## 9. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Token budget breach (>8.5K/state) | Medium | High | Plan §3 — drop ElementGraph cap to 20; truncate text_content_prefix; OR drop xpath |
| Settle p50 regression >+250ms | Medium | Medium | Plan §3 — profile settle steps; tune animation cap |
| `element_id` instability across re-runs | Low | High | Plan §3 — switch from nth-child to ancestor-chain encoding |
| ShadowDOM cap (5) too aggressive | Low | Low | Bump to 8 if real-site emit rate >5%, with engineering-lead sign-off |
| IframePolicyEngine false-positive descent | Low | High (security) | Cross-origin check upstream of purpose classifier; ASK FIRST on classifier disputes |
| Backward-compat regression via accessor | Low | High | T015 + T1B-012 re-run as smoke gate before merge |
| DeepPerceiveNode (T117) not present | Medium | Low (T1C-011 ships as forward-stub) | T1C-011 documented as forward-stub-only; full integration moves with Phase 7 |
| Reproducibility snapshot bloat | Low | Low | Storage estimate already accommodates 10K/snapshot ceiling |

---

## 10. Sign-off requirements

Per R20:

- [x] This impact.md exists (R20 hard requirement)
- [ ] Engineering lead sign-off on backward-compat audit (§3 above)
- [ ] Phase 7 / Phase 9 owners sign off on the three direct-call-site edits (EvaluateNode + AnnotateAndStore + DeepPerceiveNode)
- [ ] Phase 1b ships and `phase-1b-current.md` rollup is approved
- [ ] Storage budget review against Phase 0 reproducibility-snapshot estimates
- [ ] SPA-heavy + Optimizely-instrumented + Shadow-DOM-deep fixtures authored or scheduled

---
title: Phase 1b — Impact Analysis
artifact_type: impact
status: implemented
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
  - docs/specs/mvp/phases/phase-1b-perception-extensions/plan.md v0.2
  - docs/specs/mvp/phases/phase-1b-perception-extensions/tasks.md v0.2
  - docs/specs/mvp/phases/phase-1-perception/phase-1-current.md (Phase 1 rollup — PageStateModel canonical surface; _extensions namespace reservation per §5)
  - docs/specs/mvp/constitution.md (R20 — Impact Analysis Before Cross-Cutting Changes)
  - docs/specs/final-architecture/07-analyze-mode.md §7.9.2
  - .phase-state/1b/preflight-verdict.yaml (Gate 1 REVISE — H1 namespace contract gap closure)

req_ids:
  - REQ-ANALYZE-PERCEPTION-V24-001

breaking: false
affected_contracts:
  - PageStateModel

delta:
  new:
    - v0.1 (2026-04-28) — Phase 1b impact analysis (R20 mandate; AnalyzePerception shared contract)
    - v0.2 — §11 Namespace contract section (H1 from Gate 1; closes Phase 1 rollup §5 carry-forward risk)
    - v0.2 — Per-consumer table extended with T1B-000 substrate-extension impact row
    - v0.2 — Phase 4b T4B-013 ContextProfile cross-phase note in §3 (M4 from Gate 1)
  changed:
    - v0.2 — Contract name AnalyzePerception → PageStateModel (C1; Phase 1 ships PageStateModel)
    - v0.2 — Producer page_analyze MCP tool → contextAssembler.capture() (C5; MCP wrapping deferred to Phase 2)
    - v0.2 — Token math 5K → 6.5K → 20K Phase 1 baseline + 1.5K Phase 1b delta (C4)
    - v0.2 — Backward-compat audit re-anchored on PageStateModel sub-schemas (H4)
    - v0.2 — Risk register adds T1B-000 substrate-shape risk
    - v0.2 — Sign-off checkbox added for Path B engineering-lead decision
  impacted:
    - tasks-v2.md v2.3.4 punch-list (T1B-000 canonical alignment queued)
  unchanged:
    - §4 Heuristic engine impact taxonomy (Phase 1b enables 10 heuristic categories — unchanged structure)
    - §6 Storage impact (append-only; no DB schema migration)
    - §7 Reproducibility impact (perception_schema_version bump; both versions remain replayable)

governing_rules:
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes)
  - Constitution R18 (Delta-Based Updates)
  - Constitution R5.1 (Backward Compat Invariant)
---

# Phase 1b Impact Analysis

> **Why this file exists:** Constitution R20 — any modification to a shared contract (PageStateModel, AuditState, Finding lifecycle, adapter interfaces, DB schema, MCP tool interfaces, grounding rule interfaces) requires an `impact.md` BEFORE implementation code. PageStateModel is a shared contract (consumed by Phase 5/6/7 + delivery layer). Phase 1b extends it with T1B-000 substrate + 10 new field groups.

---

## 1. Contract changed

| Contract | Before (Phase 1 ships) | After (Phase 1b) | Breaking? |
|---|---|---|---|
| PageStateModel | 6 sub-schemas (Metadata, AccessibilityTree, FilteredDOM, InteractiveGraph, Visual, Diagnostics); ≤20K-token payload per NF-Phase1-01 v0.4; `_extensions` reserved for Phase 7 | T1B-000 substrate (ctas[], formFields[], metadata.schemaOrg, metadata.ogTags, headings[], primaryActions) + 10 new top-level groups (pricing, clickTargets[], stickyElements[], popups[], frictionScore, socialProofDepth, microcopy.nearCtaTags[], attention, commerce, metadata.currencySwitcher); ≤20K-token cap unchanged (Phase 1b's ~1.5K delta absorbed into existing headroom) | **No** — additive only at top-level / inside `metadata` |

The Phase 1b additions are listed in `docs/specs/final-architecture/07-analyze-mode.md` §7.9.2 (REQ-ANALYZE-PERCEPTION-V24-001 — under the legacy "AnalyzePerception" name; the implementation lives at `packages/agent-core/src/perception/types.ts` as `PageStateModelSchema`). T1B-000 substrate is a Path B addition selected at Gate 1 REVISE 2026-05-09 — see §11 below.

**Token math:** Phase 1's empirical floor (per phase-1-current.md) is amazon.in 12,485 + Peregrine 4,012, so ~7K headroom remains under the 20K cap. Phase 1b's ~1.5K delta (substrate ~500 + extensions ~1K) fits comfortably; SC-002 + AC-11 enforce.

---

## 2. Producers affected

| Producer | File | Change required | Owner |
|---|---|---|---|
| `ContextAssembler.capture()` | `packages/agent-core/src/perception/ContextAssembler.ts` | Its single `page.evaluate()` call invokes T1B-000 SubstrateExtension first, then T1B-001..T1B-010 extractors in order; assembles extended PageStateModel. MCP wrapping deferred to Phase 2 (`browser_get_state` consumes PageStateModel as-is). | Phase 1b T1B-000 (orchestration wiring) + T1B-001..T1B-010 (per-extractor) |
| T1B-000 SubstrateExtension | `packages/agent-core/src/perception/extensions/SubstrateExtension.ts` (NEW) | Populates ctas[]/formFields[]/schemaOrg/ogTags/headings[]/primaryActions inside page.evaluate(); Path B prerequisite for all downstream extractors | Phase 1b T1B-000 |
| 10 Phase 1b extractors | `packages/agent-core/src/perception/extensions/*.ts` (NEW directory) | Pure functions reading ExtractCtx (T1B-000 substrate); emit extension field groups | Phase 1b T1B-001..T1B-010 |
| PageStateModel Zod schema | `packages/agent-core/src/perception/types.ts` (extends Phase 1's existing file) | Append T1B-000 substrate + 10 new field groups; preserve Phase 1 sub-schema shapes verbatim | Phase 1b T1B-011 |
| Perception integration test | `packages/agent-core/tests/integration/perception-extensions.test.ts` (NEW) | New test (T1B-012) covering 5 fixtures (3 Phase 1 reuse + 2 new Peregrine cart/content) | Phase 1b T1B-012 |
| Peregrine fixture | `packages/agent-core/tests/fixtures/perception/peregrine-pdp.json` (modified) | T1B-000 commit patches the existing walking-skeleton fixture to include substrate fields so walking-skeleton 7/7 keeps passing through Phase 1b implementation | Phase 1b T1B-000 |

**Note on MCP wrapping (C5 resolution):** Phase 1b extends `PageStateModel` at the perception layer. MCP tools (`browser_get_state` per Phase 2 T-PHASE2-*) consume PageStateModel as-is once Phase 2 lands. Phase 1b is NOT responsible for MCP tool authoring.

---

## 3. Consumers affected

R20 mandates a per-consumer audit. Each consumer below is verified for backward compatibility against Phase 1's `PageStateModel` (the actual shipped surface — not the legacy architectural "v2.3" name).

| Consumer | Location | Reads Phase 1 sub-schemas? | Reads Phase 1b extensions? | Impact | Action |
|---|---|---|---|---|---|
| Walking-skeleton acceptance | `tests/acceptance/walking-skeleton.spec.ts` | Yes (Peregrine fixture path) | Yes (T1B-000 commit patches the fixture to include substrate fields) | Zero functional — fixture gets richer but the 7 AC-W assertions stay green | T1B-000 commit must include fixture patch + run walking-skeleton 7/7 as smoke gate |
| `ContextAssembler.capture()` callers | Various (currently CLI orchestrator via `apps/cli/src/commands/audit.ts`; later Phase 5 BrowseNode) | Yes | Optional | Zero — Phase 1 sub-schemas unchanged; new fields are additive top-level | None |
| Phase 5 Browse-mode integration *(not yet started)* | `packages/agent-core/src/orchestration/browse-mode/*` | Will read PageStateModel | Optional | Zero — Phase 5 will read both Phase 1 sub-schemas + Phase 1b extensions naturally | None |
| Phase 6 Heuristic KB filter *(not yet started)* | `packages/agent-core/src/heuristics/*` | Will read PageStateModel via ContextProfile filter | Yes — heuristics gate on archetype/page_type/device which depends on Phase 1b `commerce` + T1B-000 substrate | Phase 6 T4B-013 ContextProfile filter depends on Phase 1b's `commerce.isCommerce` for archetype routing | Phase 6 spec v0.4 already aware (cited in T4B-013 contract); incremental gain |
| Phase 4b ContextProfile filter *(not yet started)* | `packages/agent-core/src/heuristics/context-profile/*` | Yes (T4B-013) | Yes — explicit dependency on `commerce` + page_type routing signals from Phase 1b | Phase 4b's archetype/page_type/device selectors REQUIRE Phase 1b's `commerce.isCommerce` + T1B-000 `metadata.schemaOrg` for archetype inference | Phase 4b spec already lists Phase 1b as upstream dependency |
| Phase 7 Analysis Pipeline *(not yet started)* | `packages/agent-core/src/analysis/*` | Yes | Optional | LLM `evaluate` prompt template will see slightly larger PageStateModel (+~1.5K tokens) | Token budget at 20K (NF-Phase1-01 v0.4) absorbs delta; Phase 7 EvaluateNode should slice intelligently per page (already documented in Phase 1 rollup §5 risk row 3) |
| Delivery layer (PDF / dashboard) *(not yet started)* | `packages/agent-core/src/delivery/*` + `apps/dashboard/*` | Yes (when wired) | No (Phase 1b extensions not surfaced to consultant UI in MVP) | Zero | None |
| Reproducibility snapshot *(not yet started)* | `packages/agent-core/src/reproducibility/*` (Phase 9 T160) | Yes (full payload) | Yes — auto-captured | Snapshot rows grow ~7% (20K Phase 1 + 1.5K Phase 1b delta within cap) | Verify storage budget at Phase 9; no schema change needed |
| `audit_events` log *(not yet started)* | DB (Phase 4 T072) | Yes | Yes — auto-logged | Log row sizes grow proportionally | Within Phase 0 storage estimate (no schema change) |
| Cross-page PatternDetector (Phase 8) *(not yet started)* | `packages/agent-core/src/analysis/cross-page/*` | Yes | Yes (esp. `pricing`, `commerce`, `headings[]`) | Phase 8 gains new pattern signals (price-anchor patterns; cross-page heading hierarchy) | Phase 8 spec already aware; incremental gain, no breaking change |

**No consumer breaks.** Backward compatibility is enforced via:
- T1B-011 Zod additive schema (no Phase 1 sub-schema renames/retypes)
- Phase 1 integration test (T015 in `tests/integration/phase1.test.ts`) re-run unchanged
- Walking-skeleton acceptance suite (7/7) re-run unchanged
- T1B-000 commit's fixture patch keeps `peregrine-pdp.json` valid against the extended schema

---

## 4. Heuristic engine impact

Phase 1b enables (but does not author) new heuristic categories:

- Pricing-display heuristics (anchor / discount / tax-inclusive)
- Mobile click-target heuristics (Fitt's Law / WCAG 2.5.5)
- Sticky-element heuristics (CTA visibility / cart persistence)
- Popup presence heuristics (cookie-banner intrusiveness; full popup heuristics require Phase 5b behavior)
- Friction-score heuristics (form length × required ratio)
- Social-proof depth heuristics (review count / recency / star distribution)
- Microcopy semantic heuristics (risk reducers / urgency)
- Attention / contrast hotspots heuristics (visual hierarchy)
- Commerce-specific heuristics (stock messaging / shipping CTAs / return-policy clarity)
- Currency-switcher heuristics (international UX)

Heuristics are authored in Phase 0b (LLM-assisted authoring) + filtered in Phase 6 (KB engine). Phase 1b only EMITS the data; Phase 6 enforces ContextProfile filtering.

**No GR-001..GR-008 grounding rule changes** in Phase 1b. New grounding rules (GR-013+) may be authored later as heuristics consuming v2.4 fields ship.

---

## 5. Cost impact

| Metric | Phase 1 baseline | Phase 1b (extended) | Δ |
|---|---|---|---|
| New LLM calls per audit | — | 0 | 0 |
| Net per-audit LLM cost | $X | $X | $0 |
| Browser time per page (p50) | Phase 1 empirical: example.com 1.7s, amazon.in 3.1s, Peregrine 4.8s | Phase 1 baseline + ≤150ms p50 | +~150ms |
| PageStateModel payload tokens (cap NF-Phase1-01 v0.4 = 20K) | ≤20K (empirical floor: amazon.in 12,485; Peregrine 4,012) | ≤20K (Phase 1b delta ~+1.5K absorbed into existing headroom) | +~1.5K within cap |
| Reproducibility snapshot row size *(Phase 9 T160)* | ~20K | ~21.5K | +~1.5K |
| Heuristic prompt token cost (Phase 7) | baseline | +~1.5K per evaluate call | +~$0.0045 per evaluate at Sonnet 4 input rate |

**Net audit cost impact:** Phase 7 evaluate prompt grows by ~1.5K input tokens per page. At ~10 evaluate calls per audit, that is ~15K extra input tokens, worth ~$0.045 per audit at Sonnet 4 input rates — well below the $15 per-audit hard cap (R10).

**T1B-000 substrate cost share:** ~500 tokens of the ~1.5K Phase 1b delta. Substrate fields (ctas[]/formFields[]/schemaOrg/ogTags/headings[]/primaryActions) are referenced by 5 of the 10 extractors (T1B-001/002/005/006/009; also T1B-003 reads ctas[] and T1B-007 reads ctas[] by index). Path B's substrate-first design eliminates ~5x duplicated JSON-LD scanning that Path A would have introduced — net token impact is equivalent or slightly lower than Path A.

---

## 6. Storage impact

`reproducibility_snapshots` table row size grows ~7% (20K → 21.5K). Phase 0 storage estimate already accommodates this growth (21.5K JSON serializes to ~24-30KB; storage cost negligible at 100-audit-per-day ceiling).

`audit_events` log entries that include perception payloads grow proportionally. Append-only — no migration required (R7.4).

**No DB schema migration required for Phase 1b.** (Reproducibility snapshots table ships in Phase 9 T160; Phase 1b just defines the contract that table will serialize.)

---

## 7. Reproducibility impact

`reproducibility_snapshot.perception_schema_version` field bumps. Phase 1 ships with `"phase-1-v1.0"` (PageStateModel baseline); Phase 1b lands as `"phase-1b-v0.2"` (PageStateModel extended). Existing Phase 1 snapshots remain valid for replay; Phase 1b snapshots include the new fields.

Replays of Phase 1 snapshots against Phase 1b code path: backward compat enforced — Phase 1 snapshots will deserialize cleanly against the extended Zod schema (new T1B-000 substrate + Phase 1b extension fields default to `null` / empty arrays / undefined where `.optional()` / `.nullable()`).

---

## 8. Documentation impact

| Doc | Change |
|---|---|
| `docs/specs/final-architecture/07-analyze-mode.md` §7.9.2 | Already documents v2.4 (REQ-ANALYZE-PERCEPTION-V24-001). No change. |
| `docs/specs/mvp/PRD.md` F-004 | Reference v2.4 schema after Phase 1b ships (next PRD bump). |
| `docs/specs/mvp/phases/INDEX.md` | Add Phase 1b row (handled by INDEX regeneration step). |
| `docs/specs/mvp/phases/phase-1-perception/phase-1-current.md` | Phase 1 rollup notes Phase 1b as immediate successor. |

---

## 9. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Token budget breach | Medium | High | Plan §3 kill criteria — drop hotspots / compress microcopy / flag-gate SocialProofDepth; fall back to Phase 1's 4-stage shrink ladder |
| **T1B-000 substrate ships wrong shape** *(v0.2 NEW — Path B risk)* | **Low** | **High** | **Plan §3 kill criteria last row — STOP T1B-001..T1B-010 dispatch if AC-00 fails. Path B's whole premise is substrate-first; cannot proceed if substrate is wrong. T1B-000 commit must run Phase 1 conformance suite + walking-skeleton 7/7 as smoke gate.** |
| MicrocopyTagger precision <80% | Medium | Medium | Plan §3 — drop to `[]` and defer to Phase 6 LLM-tagging |
| AttentionScorer browser-time regression | Medium | Medium | Plan §3 — single full-page contrast pass, not per-element |
| Reproducibility snapshot bloat | Low | Low | Storage estimate already includes growth budget |
| Phase 5 / Phase 7 / delivery consumer regression | Low | High | Phase 1 integration test (T015) re-run + walking-skeleton 7/7 re-run as smoke gate before merge |
| Schema drift between extractor output and Zod schema | Low | High | T1B-011 Zod schema is single source of truth (in types.ts); per-extractor unit tests reuse schema parse |
| **Namespace creep into `_extensions.*`** *(v0.2 NEW — H1 risk)* | **Low** | **High** | **§11 below documents that Phase 1b additions are top-level / inside `metadata` only. NO additions under `_extensions.*` (Phase 7's reserved namespace per phase-1-current.md §5). Conformance test AC-11 + AC-00 grep-asserts.** |

---

## 10. Sign-off requirements

Per R20, Phase 1b implementation MUST NOT begin until:

- [x] This impact.md exists (R20 hard requirement)
- [x] Phase 1 ships and `phase-1-current.md` rollup is approved *(SATISFIED 2026-05-09 — Phase 1 implemented, rollup landed)*
- [x] **Engineering-lead decision on C1+C2 strategy** — **Path B selected 2026-05-09 per Gate 1 REVISE** (see `.phase-state/1b/preflight-verdict.yaml` + this artifact's v0.2 delta block)
- [ ] Engineering lead sign-off on backward-compat audit (§3 above) — pending Pass 2 AI Reviewer verdict + Gate 1 APPROVE stamp
- [ ] Cost / storage budget reviewed against Phase 0 estimates — pending Pass 2 review
- [ ] Ground-truth fixture set for MicrocopyTagger authored or scheduled — Phase 1b T1B-007 implementer ASKs if not available at implementation time

---

## 11. Namespace contract *(v0.2 NEW — H1 from Gate 1)*

Per Phase 1 rollup §5 row 1 carry-forward risk:

> *"Phase 1b (T1B-001 PricingExtractor) consumes `_extensions` shape — needs to honor Phase 7 namespace reservation. Phase 1b lead must Document namespace contract in Phase 1b impact.md before T1B-001 lands."*

### Decision

**Phase 1b extensions live at top-level of PageStateModel or inside `metadata`. NOT under `_extensions.*`.**

Specifically, Phase 1b adds:
- **Top-level new groups:** `ctas[]`, `formFields[]`, `headings[]`, `primaryActions` (T1B-000 substrate); `pricing`, `clickTargets[]`, `stickyElements[]`, `popups[]`, `frictionScore`, `socialProofDepth`, `microcopy`, `attention`, `commerce` (T1B-001..T1B-009)
- **Nested in `metadata`:** `metadata.schemaOrg`, `metadata.ogTags` (T1B-000); `metadata.currencySwitcher` (T1B-010)
- **NOT touched:** `_extensions` — remains reserved for Phase 7 DeepPerceiveNode (`_extensions.deepPerceive` namespace)

### Rationale

1. **Architectural intent.** Architecture spec §7.9.2 (REQ-ANALYZE-PERCEPTION-V24-001) declares Phase 1b extensions as *core* PageStateModel growth — not as a deep-perceive overlay. They belong at the same hierarchy level as Phase 1's sub-schemas (Metadata, AccessibilityTree, FilteredDOM, etc.).

2. **Phase 7's `_extensions` reservation is for deep-perceive LLM enrichments.** Per phase-1-current.md §1 + types.ts:26 (*"PageStateModelSchema also `.strict()` but explicitly carries `_extensions`"*), the `_extensions` field is reserved for Phase 7 DeepPerceiveNode's `_extensions.deepPerceive` namespace — LLM-derived enrichments layered on top of the perception capture. Phase 1b's static-extraction fields are NOT LLM-derived; they're factual captures from `page.evaluate()`.

3. **Phase 6 heuristic ContextProfile filter.** Phase 6's T4B-013 ContextProfile filter (per phase-6-heuristics/spec.md v0.4) indexes against `archetype` / `page_type` / `device` selectors that depend on Phase 1b's `commerce.isCommerce` + `metadata.schemaOrg` reads. Putting these inside `_extensions.perception` would require additional path traversal — top-level keeps the filter implementation flat.

4. **Walking-skeleton acceptance preservation.** The walking-skeleton `peregrine-pdp.json` fixture validates against `PageStateModelSchema`. T1B-000 commit patches the fixture to populate the new top-level + metadata fields. If we'd used `_extensions.perception`, every walking-skeleton consumer (`tests/acceptance/walking-skeleton.spec.ts`, currently 7/7 green) would need a path change.

### Future namespace reservation

Phase 7 DeepPerceiveNode will populate `_extensions.deepPerceive.{semantic_intent, brand_voice_signal, conversion_friction_classification, attention_anomaly}` — distinct LLM-derived enrichments that consume Phase 1 + Phase 1b's structured captures but produce judgmental categorizations. Phase 7's impact.md will document its namespace contract analogously when Phase 7 enters its master orchestrator Gate 1 cycle.

### Conformance enforcement

- T1B-000 conformance test (AC-00) grep-asserts: no Phase 1b additions under `_extensions.*`.
- T1B-011 conformance test (AC-11) `safeParse` against the extended `PageStateModelSchema` — `_extensions` field stays as Phase 1's reservation (defined; not populated by Phase 1b).
- R20 impact-analysis discipline: any future Phase 1b polish that proposes touching `_extensions.*` triggers ASK FIRST per CLAUDE.md §13.

---

## 12. Cross-phase note *(v0.2 NEW — M4 from Gate 1)*

Phase 1b's `commerce.isCommerce` field + T1B-000's `metadata.schemaOrg` are upstream dependencies for **Phase 4b T4B-013 ContextProfile filter** (per `phase-4b-context-capture/spec.md`). T4B-013 selects which Phase 6 heuristics apply per page archetype, using `commerce.isCommerce` for D2C/SaaS/marketplace classification and `metadata.schemaOrg` (Product, AggregateOffer, FAQPage, etc.) for page-type inference (PDP, PLP, cart, checkout, content, FAQ).

When Phase 4b implementation begins (currently ⚪ not started), the T4B-013 implementer should verify Phase 1b ships before T4B-013 dispatch. Phase 4b spec already cites Phase 1b as upstream dependency.

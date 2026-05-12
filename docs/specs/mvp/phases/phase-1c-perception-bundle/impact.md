---
title: Phase 1c — Impact Analysis
artifact_type: impact
status: implemented
version: 0.2
created: 2026-04-28
updated: 2026-05-12
owner: engineering lead
authors: [Claude (drafter v0.1; master orchestrator session 15 v0.2 patch wave)]
reviewers: [Sabari (Gate 1 Pass 1 stamp 2026-05-11 — REVISE; Gate 1 Pass 2 stamp 2026-05-12 — APPROVE; Gate 2 stamp 2026-05-12 — APPROVE)]

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md (v0.2)
  - docs/specs/mvp/constitution.md (R20 — Impact Analysis Before Cross-Cutting Changes)
  - docs/specs/final-architecture/07-analyze-mode.md §7.9.3
  - docs/specs/mvp/phases/phase-1b-perception-extensions/impact.md §11 (Namespace Contract — carried forward in §11 v0.2)
  - .phase-state/1c/preflight-verdict.yaml (Pass 1 verdict — I4 AuditRequest + I6 namespace + I7 runtime wiring resolved here)

req_ids:
  - REQ-ANALYZE-PERCEPTION-V25-001
  - REQ-PERCEPT-V25-002
  - REQ-BROWSE-PERCEPT-007
  - REQ-BROWSE-PERCEPT-008

breaking: false
affected_contracts:
  - PerceptionBundle (NEW shared contract)
  - AnalyzePerception (wrapped, not modified)
  - PageStateModel (wrapped, not modified — Phase 1b extensions inherited verbatim)
  - deep_perceive output type (changes; helper provided)

delta:
  v0_2:
    new:
      - Frontmatter version 0.1 → 0.2 + updated 2026-05-11
      - NEW §11 Namespace Contract Carryforward (mirrors Phase 1b impact.md §11) — Phase 1c writes neither `bundle.raw.page_state_model_by_state[*]._extensions.*` nor `bundle.raw.analyze_perception_by_state[*]._extensions.*`; AC-10 + AC-12 conformance assertions enforce
      - NEW §12 Runtime Wiring Ownership (AI Reviewer I7 resolution) — runtime wiring of 10 Phase 1b extractors into `ContextAssembler.capture()` `page.evaluate()` is DEFERRED to Phase 5 BrowseNode; Phase 1c bundle assembly assumes inputs present
      - NEW §13 AuditRequest Decision (AI Reviewer I4 resolution) — `element_graph_size` configurability NOT added; cap hardcoded at 30 for MVP
    changed:
      - §1 contract changes table — AnalyzePerception "Top-level return value" → clarified that `bundle.raw.analyze_perception_by_state` is namespace-contract-guarded (no `_extensions` writes)
      - §3 consumer audit — Phase 5 BrowseNode action updated to "owns runtime wiring of Phase 1b extractors (deferred from Phase 1c per AI Reviewer I7)"
      - §5 cost impact — re-baselined per NF-01 v0.2 envelope-only definition
      - §10 sign-off requirements — added Pass 2 readiness item
    impacted: []
    unchanged:
      - All §3 consumer mappings (EvaluateNode + AnnotateAndStore + DeepPerceiveNode + GR-001..GR-008 + Phase 5/6/8 etc.)
      - §6 storage impact (snapshot bloat assessment)
      - §7 reproducibility impact
      - §8 documentation impact list
      - §9 risk register
  v0_1:
    new:
      - Phase 1c impact analysis — required by R20 (PerceptionBundle is new shared contract; deep_perceive output type changes)
    changed: []
    impacted: []
    unchanged: []

governing_rules:
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes — carries Phase 1b §11 namespace contract forward)
  - Constitution R18 (Delta-Based Updates — v0.2 delta block appends; v0.1 preserved)
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
| Phase 5 Browse-mode integration | `packages/agent-core/src/orchestration/browse-mode/*` (Phase 5) | Reads AnalyzePerception fields **AND** OWNS runtime wiring of Phase 1b extractors (per v0.2 §12; deferred from Phase 1c per AI Reviewer I7) | **Yes** — Phase 5 BrowseNode owns wiring the 10 Phase 1b `.script.ts` IIFEs into `ContextAssembler.capture()`'s `page.evaluate()` call so extractor outputs land in `bundle.raw.page_state_model_by_state[stateId]` at runtime. Phase 1c bundle assembly assumes these are present; if missing, emits `EXTENSION_OUTPUT_MISSING` warning. | Phase 5 lead must add the runtime composition task to Phase 5 spec/plan/tasks |
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

## 5. Cost impact *(v0.2 re-baselined against NF-01 envelope-only definition)*

| Metric | v2.4 | v2.5 (Phase 1c v0.2) | Δ |
|---|---|---|---|
| New LLM calls per audit | — | 0 | 0 |
| Net per-audit LLM cost | $X | $X | $0 |
| Browser time per state (p50) | T (v2.4) | T+~200ms (settle predicate) | +~200ms |
| Bundle ENVELOPE-only token size per state | — (no envelope in v2.4) | ≤2K (NF-01 v0.2; hard ceiling 3K) | +2K (new layer) |
| Bundle TOTAL per state (envelope + raw.AnalyzePerception + raw.PageStateModel) | 6.5K (AnalyzePerception only) | ≤14.5K typical (Phase 1b empirical floor 12.5K PSM amazon.in + 2K envelope) | +8K total (driven by Phase 1b PSM extension, not by Phase 1c envelope) |
| Phase 7 evaluate prompt context | ~6.5K | ~14.5K worst case; Phase 7 EvaluateNode should slice intelligently — do NOT blindly stuff full bundle into evaluate prompt (per Phase 1b rollup §5 open risk row 3) | +8K worst case (~$0.024 per evaluate at Sonnet 4 input rate) |

**Net audit cost impact:** ~$0.24 per audit (10 evaluate calls × +$0.024 worst case). Well below $15 cap (R10). Realistic average lower because Phase 7 EvaluateNode is expected to slice the bundle per heuristic rather than stuff the full payload.

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

## 9. Risk register *(v0.2 re-baselined)*

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Envelope token budget breach (>2K/state per NF-01 v0.2) | Low (envelope is tightly bounded by the closed enums + cap-30 ElementGraph) | High | plan.md v0.2 §3 — drop ElementGraph cap to 20; truncate text_content_prefix; OR drop xpath |
| Total per-state bundle breach (>14.5K) | Low (Phase 1b empirical floor + 2K envelope) | Medium | Informational — most likely a Phase 1b PSM growth, not a Phase 1c regression |
| Settle p50 regression >+250ms | Medium | Medium | plan.md v0.2 §3 — profile settle steps; tune animation cap |
| Settle 5s hard cap missed | Low (v0.2 Promise.race wrapper) | High | plan.md v0.2 §2.2 implementation matches contract; STOP if cap missed |
| `element_id` instability across re-runs | Low | High | plan.md §3 — switch from nth-child to ancestor-chain encoding |
| ShadowDOM cap (5) too aggressive | Low | Low | Bump to 8 if real-site emit rate >5%, with engineering-lead sign-off |
| IframePolicyEngine false-positive descent into security-sensitive iframe | Low (v0.2 classifier checks captcha/cmp/payment_3ds BEFORE checkout/chat) | High (security) | plan.md v0.2 §2.6 documents classifier order; ASK FIRST on classifier disputes |
| Phase 1b runtime-wiring deferral causes EXTENSION_OUTPUT_MISSING flood (v0.2 NEW) | Medium (expected if Phase 5 doesn't land before Phase 1c integration test) | Low (degraded perception, not broken) | T1C-012 fixtures pre-populate extractor outputs to validate envelope assembly; real-network testing waits for Phase 5 |
| Backward-compat regression via accessor | Low | High | T015 + T1B-012 re-run as smoke gate before merge |
| DeepPerceiveNode (T117) not present | Medium | Low (T1C-011 ships as forward-stub) | T1C-011 documented as forward-stub-only; full integration moves with Phase 7 |
| Reproducibility snapshot bloat | Low | Low | Storage estimate already accommodates 10K/snapshot ceiling |
| Namespace contract violation (Phase 1c writes _extensions.* by mistake) (v0.2 NEW) | Low | High (Phase 7 collision) | AC-10 + AC-12 conformance assertions enforce; CI fails before merge |

---

## 10. Sign-off requirements *(v0.2 updated)*

Per R20:

- [x] This impact.md exists (R20 hard requirement)
- [x] Phase 1b ships and `phase-1b-current.md` rollup is approved (SATISFIED 2026-05-09 — Phase 1b PR #4 merged at 23d65fa)
- [x] **AI Reviewer Gate 1 Pass 1 stamped REVISE 2026-05-11; v0.2 patch wave addresses all 12 findings**
- [ ] Engineering lead sign-off on backward-compat audit (§3 above)
- [ ] Phase 7 / Phase 9 owners sign off on the three direct-call-site edits (EvaluateNode + AnnotateAndStore + DeepPerceiveNode)
- [ ] Phase 5 BrowseNode lead sign-off on runtime-wiring ownership (§12 v0.2 — Phase 5 owns; not Phase 1c)
- [ ] Storage budget review against Phase 0 reproducibility-snapshot estimates
- [ ] SPA-trait-rich integration fixture authored (collapses Optimizely + Shadow-DOM-deep + React-Portal-deep into one fixture per v0.2 spec Assumptions)
- [ ] AI Reviewer Gate 1 Pass 2 stamps APPROVE

---

## 11. Namespace Contract Carryforward *(NEW v0.2 — per Phase 1b impact.md §11)*

**Origin:** Phase 1b authored a namespace contract in its impact.md §11 reserving `_extensions.*` for Phase 7 DeepPerceiveNode. Phase 1b's rollup §5 row 1 explicitly handed this constraint to Phase 1c: *"Phase 1c must respect impact.md §11 namespace contract (no writes to `_extensions.*`)."*

**Phase 1c carryforward** (enforced by AC-10 + AC-12):

| Surface | Rule | Enforcement |
|---|---|---|
| `bundle.raw.page_state_model_by_state[*]._extensions` | MUST be `undefined` or `{}` for all states emitted by Phase 1c | AC-10 conformance test asserts; AC-12 integration test asserts across 5 fixtures |
| `bundle.raw.analyze_perception_by_state[*]._extensions` | MUST be `undefined` or `{}` (AnalyzePerception v2.4 has no `_extensions` field; check is defensive) | AC-10 conformance test asserts |
| `bundle.meta`, `bundle.performance`, `bundle.nondeterminism_flags`, `bundle.warnings`, `bundle.state_graph`, `bundle.element_graph_by_state` | Phase 1c-owned — Phase 1c writes here freely | Zod schema authoritative |
| `bundle.raw.full_page_screenshot_url_by_state` | Inherited from v2.4 + Phase 1; Phase 1c does not transform | Pass-through |

**Why this matters:** Phase 7 DeepPerceiveNode will write LLM-enriched data into `_extensions.deepPerceive` on PageStateModel. If Phase 1c accidentally writes into the same namespace, Phase 7 collides and over-writes Phase 1c data (or vice versa). The conformance assertion in AC-10 fires at unit-test time so the gate cannot be missed.

**Test pattern:**

```ts
test("Phase 1c PerceptionBundle honors namespace contract (Phase 1b §11)", () => {
  const bundle = buildBundleForFixture("amazon-in-pdp");
  for (const stateId of Object.keys(bundle.raw.page_state_model_by_state)) {
    const psm = bundle.raw.page_state_model_by_state[stateId];
    expect(psm._extensions).toSatisfy(
      (v) => v === undefined || (typeof v === "object" && Object.keys(v).length === 0),
      "Phase 1c MUST NOT write into PageStateModel._extensions (Phase 7 reservation per Phase 1b §11)"
    );
  }
});
```

---

## 12. Runtime Wiring Ownership *(NEW v0.2 — per AI Reviewer Gate 1 Pass 1 I7 resolution)*

**Question raised at Pass 1:** Phase 1b rollup §4 row 1 said *"Phase 5 BrowseNode + Phase 1c PerceptionBundle own runtime wiring"* of 10 Phase 1b extractors. Phase 1c task set had no such task. Who owns it?

**v0.2 resolution: Phase 5 BrowseNode owns it. Phase 1c does NOT.**

| Concern | v0.2 decision |
|---|---|
| Wiring 10 `.script.ts` IIFEs into `ContextAssembler.capture()` `page.evaluate()` | **Phase 5 BrowseNode** owns. To be added to Phase 5 spec/plan/tasks. |
| Phase 1c bundle assembly behavior on missing extractor output | Emit `EXTENSION_OUTPUT_MISSING` warning; proceed with bundle assembly with that field undefined. |
| Phase 1c integration test (T1C-012) validation | T1C-012 authors **pre-populated fixtures** (manually-constructed `PageStateModel` JSON files with extractor outputs filled in) — exercises envelope assembly correctness independent of Phase 5 runtime status. |
| Real-network end-to-end (live page → bundle with all extractor outputs populated) | Validates only when Phase 5 ships its wiring. **NOT a Phase 1c exit criterion.** |

**Why defer to Phase 5:**
- Phase 5 owns the live browser orchestration (`BrowseNode` extends BrowserManager); it's the natural home for the `page.evaluate()` composition layer
- Phase 1c is a data-contract phase (Bundle envelope + Zod + accessor); not a runtime-execution phase
- Splitting these reduces coupling: Phase 1c can ship + verify with offline fixtures; Phase 5 wires up runtime later
- Phase 1b's two-file pattern (`*.ts` pure function + `*.script.ts` IIFE) was specifically designed for this split

**Implication for Phase 5 spec:** Phase 5 spec must add a task like *"T-PHASE-5-EXTENSION-WIRING: Inject 10 Phase 1b extractor `.script.ts` IIFEs into `ContextAssembler.capture()` `page.evaluate()` composition; ensure outputs land in `bundle.raw.page_state_model_by_state[stateId]` shape."*

---

## 13. AuditRequest Configuration Decision *(NEW v0.2 — per AI Reviewer Gate 1 Pass 1 I4 resolution)*

**Question raised at Pass 1:** v0.1 spec/plan cited `AuditRequest.element_graph_size` as a configurable knob (default 30, max 60), but `AuditRequest` is a Phase 6 Gateway contract; impact.md §3 listed no Phase-1c-driven `AuditRequest` change. Where is this field defined?

**v0.2 resolution: Drop configurability for MVP. Hardcode ElementGraph cap at 30.**

| Surface | v0.2 decision |
|---|---|
| ElementGraph cap | HARDCODED at 30 for MVP (constant inside `ElementGraphBuilder`) |
| `AuditRequest.element_graph_size` field | **NOT added in Phase 1c.** No change to Phase 6 Gateway contract. |
| Future configurability | Deferred. When Phase 6 lands `AuditRequest`, the field can be added then (additive change; backward-compat preserved). |
| Affected contracts (this impact.md §1) | `AuditRequest` is therefore NOT a Phase 1c affected_contract. |

**Why hardcode:**
- The cap-30 value comes from the architecture spec §07.7.9.3 and serves NF-01 envelope-only budget
- Configurability would add a Phase 6 dependency (currently Phase 1c is decoupled from Phase 6)
- No consumer (in Phase 1c scope) actually requires the configurability — it was speculative
- Per CLAUDE.md "Don't add features beyond what the task requires" — drop the speculative knob

**Implication for Phase 6 spec:** Phase 6 lead may add `element_graph_size` (with default 30) to `AuditRequest` if/when a real consumer needs it. Until then, Phase 1c ships with hardcoded constant.

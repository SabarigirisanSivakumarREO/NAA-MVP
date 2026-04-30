---
title: Tasks — Phase 6 Heuristic KB Engine
artifact_type: tasks
status: draft
version: 0.4
created: 2026-04-27
updated: 2026-04-30
owner: engineering lead
authors: [Claude (drafter)]

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-6-heuristics/spec.md
  - docs/specs/mvp/phases/phase-6-heuristics/plan.md
  - docs/specs/mvp/phases/phase-6-heuristics/impact.md
  - docs/specs/mvp/tasks-v2.md (T101-T112; T103-T105 are Phase 0b workstream; T4B-013 v0.2 extension)
  - docs/specs/mvp/constitution.md (R5.4/R5.5, R6, R9, R15.3, R23)
  - docs/specs/mvp/phases/phase-4b-context-capture/spec.md (T4B-013 — v0.2 extension)

req_ids:
  - REQ-HK-001
  - REQ-HK-EXT-001
  - REQ-HK-EXT-019
  - REQ-HK-EXT-050
  - REQ-HK-020a
  - REQ-HK-020b
  - REQ-CONTEXT-DOWNSTREAM-001          # v0.2 — T4B-013 extension

impact_analysis: docs/specs/mvp/phases/phase-6-heuristics/impact.md

delta:
  new:
    - Phase 6 tasks.md — 9 MVP engine tasks
    - T103-T105 explicitly declared as Phase 0b workstream (deferred this session)
    - T106 + T107 carry extended kill criteria
    - v0.2 — T106 acceptance extended to surface T4B-013 dependency (Phase 4b owns the `loadForContext()` impl deliverable). HeuristicSchemaExtended (T101) gains `archetype` / `page_type` / `device` selector fields per AC-11.
  changed:
    - v0.1 → v0.2 — adds T4B-013 dependency notes; HeuristicSchemaExtended manifest selectors
    - v0.2 → v0.3 — added Cross-phase note at top pointing readers to phase-0b-heuristics/tasks.md for T103/T104/T105 (engine vs content split made explicit; analyze L5 finding from Phase 0b /speckit.analyze pass — spans phases since T103-T105 are owned by Phase 0b but referenced in Phase 6)
    - v0.3 → v0.4 — Session 7 /speckit.analyze polish — H1 fix: T-PHASE6-LOGGER (Phase 2 Foundational, line 115) now registers the full 6-path Pino redaction config matching spec.md:101 authoritative list — `['*.body', '*.benchmark.value', '*.benchmark.standard_text', '*.benchmark.unit', '*.benchmark.metric', '*.provenance.citation_text']` — closing the R6 enforcement gap that the prior 3-path with wrong wildcard syntax (`*.benchmark.*.value` etc) would have left open. Frontmatter sync with parallel spec.md v0.3→v0.4 (M1) + plan.md v0.2→v0.4 catch-up (M1 + v0.3 sync + H3) + impact.md v0.1→v0.4 catch-up (v0.2 + v0.3 + H2). No AC-NN/R-NN/SC-NNN ID changes; T101-T112 + T-PHASE6-* task bodies preserved verbatim except T-PHASE6-LOGGER redaction-path list.
  impacted:
    - Phase 4b T4B-013 — drives the loadForContext() implementation; lands AFTER Phase 6 baseline ships
    - Phase 0b heuristic authoring — heuristic manifests now MUST include archetype/page_type/device selectors
  unchanged:
    - All 9 baseline task IDs and acceptance criteria (T4B-013 owns implementation; Phase 6 owns schema field reservation)

governing_rules:
  - Constitution R3, R5.4/R5.5, R6, R9, R15.3, R23

description: "Phase 6 task list — 9 engine tasks; T103-T105 Phase 0b deferred; first R6 runtime enforcement."
---

# Tasks: Phase 6 — Heuristic KB Engine

**Input:** spec.md + plan.md + impact.md
**Prerequisites:** spec + impact `approved` (MEDIUM risk)
**Test policy:** TDD per R3.1.
**Organization:** Single user story; 9 MVP engine tasks.

> **Cross-phase note:** T103/T104/T105 (heuristic CONTENT authoring — Baymard / Nielsen / Cialdini packs) are the **Phase 0b workstream** per F-012 v1.2 amendment, NOT scheduled here. See [phase-0b-heuristics/tasks.md](../phase-0b-heuristics/tasks.md). Phase 6 owns the **engine** (T101, T102, T106-T112); Phase 0b owns the **content**.

---

## Task ID Assignment

T101, T102, T106-T112 (9 MVP engine). T103-T105 are **Phase 0b workstream** (heuristic content authoring per F-012 amendment) — deferred this session, NOT scheduled here.

---

## Path Conventions

Phase 6 touches:
- `packages/agent-core/src/analysis/heuristics/` (NEW directory)
- `packages/agent-core/src/adapters/DecryptionAdapter.ts` (NEW)
- `packages/agent-core/src/observability/logger.ts` (modify — add correlation + redaction)
- `packages/agent-core/tests/fixtures/heuristics/` (NEW — synthetic test fixtures)
- `packages/agent-core/tests/conformance/` (10 new tests)
- `packages/agent-core/tests/integration/phase6.test.ts`
- `heuristics-repo/README.md` (NEW — Phase 0b authoring workflow doc)

---

## Default Kill Criteria *(R23)*

```yaml
kill_criteria:
  resource: { token_budget_pct: 85, wall_clock_factor: 2x, iteration_limit: 3 }
  quality:
    - "any previously-passing test breaks"
    - "pnpm test:conformance fails"
    - "spec defect (R11.4)"
    - "R6 IP boundary violated: heuristic body text appears in any Pino log line, API response, dashboard, or LangSmith trace (Pino transport spy detects)"
    - "R15.3 schema enforcement bypassed: a heuristic without benchmark OR provenance loads successfully"
  scope:
    - "diff introduces forbidden pattern (R13)"
    - "task expands beyond plan.md file table"
    - "T103-T105 (heuristic content authoring) implementation lands (Phase 0b workstream — wrong session)"
  on_trigger: ["snapshot WIP, log, escalate, do NOT silently retry"]
```

T106 + T107 carry extended kill criteria.

---

## Phase 1 — Setup

`impact.md` MUST be `status: approved` (MEDIUM risk). No new deps.

---

## Phase 2 — Foundational

- [ ] **T-PHASE6-TESTS [P] [SETUP]** Author 10 conformance tests + Phase 6 integration test FIRST. AC-01..AC-10 FAIL initially.
- [ ] **T-PHASE6-LOGGER [SETUP]** Modify `observability/logger.ts` to register `heuristic_loader_session_id`, `kb_size`, `filter_stage` correlation fields **+ the full 6-path Pino redaction config** mapping to BenchmarkSchema discriminated-union shape (per spec.md:101 / plan.md:171 authoritative list): `['*.body', '*.benchmark.value', '*.benchmark.standard_text', '*.benchmark.unit', '*.benchmark.metric', '*.provenance.citation_text']`. Note the syntax: paths target the discriminated-union FLAT shape (`*.benchmark.value`, NOT `*.benchmark.*.value`). `*.body` redacts heuristic body text; `*.benchmark.value` covers the quantitative branch's measurement; `*.benchmark.standard_text` covers the qualitative branch's reference text; `*.benchmark.unit` + `*.benchmark.metric` cover the quantitative branch's IP context (revealing units leaks); `*.provenance.citation_text` is the heuristic's canonical excerpt. Provenance fields `source_url` / `verified_by` / `verified_date` / `draft_model` are NOT redacted (public metadata). **R6 enforcement is the focal rule for this phase — every path here must be present, exactly as listed, before T106 lands.** Conformance test in `tests/conformance/r6-ip-boundary.test.ts` (T-PHASE6-TESTS) asserts each path independently with both quantitative and qualitative benchmark fixtures.
- [ ] **T-PHASE6-FIXTURES [P] [SETUP]** Author synthetic test heuristics in `tests/fixtures/heuristics/`: 30 valid (10 each Baymard / Nielsen / Cialdini test) + 3 invalid (missing benchmark, missing provenance, malformed JSON). All fixtures use plausible but obviously-fake content (e.g., body text marked "TEST FIXTURE — not a real heuristic").

---

## Phase 3 — User Story 1: KB engine loads + filters + prioritizes ready for Phase 7 LLM consumption (Priority: P1) 🎯 MVP

**Goal:** HeuristicLoader.loadAll() + filterByBusinessType + filterByPageType + prioritizeHeuristics produce a ≤ 30-entry filtered set Phase 7 EvaluateNode consumes; R6 boundary preserved.

**Independent Test:** `pnpm -F @neural/agent-core test integration/phase6`.

**AC IDs covered:** AC-01 through AC-10.

### Implementation tasks

- [ ] **T101 [SETUP] [US-1] HeuristicSchema (base + Extended)** (AC-01, AC-02, AC-11 partial, REQ-HK-001 + REQ-HK-EXT-001..019 + REQ-CONTEXT-DOWNSTREAM-001)
  - **Brief:**
    - **Outcome:** `analysis/heuristics/types.ts` exports `HeuristicSchemaBase` + `HeuristicSchemaExtended` + `ProvenanceSchema` + `BenchmarkSchema` (discriminated union: quantitative / qualitative). Extended `.extend()`s base with §9.10 fields. **Both `benchmark` and `provenance` REQUIRED** (R15.3). **v0.2 — `HeuristicSchemaExtended` adds optional manifest selectors `archetype`, `page_type`, `device` (each accepting an array of enum values matching ContextProfile dimensions)** for AC-11 / T4B-013 filtering.
    - **Constraints:** File < 300 lines. Zero `z.any()`. `provenance.draft_model` accepts `'human'` literal OR LLM-model-id pattern. `provenance.verified_date` ISO-8601 regex.
    - **Acceptance:** AC-01 + AC-02 — fixtures parse; missing benchmark / provenance fixtures rejected. **v0.2:** AC-11 partial — manifest selector fields validate when present; absent fields default to "applies to all" (no selector → no filter).
    - **Files:** `packages/agent-core/src/analysis/heuristics/types.ts`
    - **dep:** T-PHASE6-TESTS, T-PHASE6-LOGGER, T-PHASE6-FIXTURES
    - **Kill criteria:** default block
    - **Phase 4b dependency note:** T4B-013 lands `loadForContext()` AFTER T106 ships baseline loader; manifest selector fields here are the contract surface T4B-013 reads.

- [ ] **T102 [P] [US-1] HeuristicKnowledgeBase container** (AC-03)
  - **Brief:**
    - **Outcome:** `analysis/heuristics/kb.ts` exports `HeuristicKnowledgeBase` interface + `InMemoryKB` impl. Indexes by `id`. Provides `get`, `list`, `byBusinessType`, `byPageType` query helpers (read-only views; no mutation).
    - **Constraints:** File < 200 lines.
    - **Acceptance:** AC-03.
    - **Files:** `packages/agent-core/src/analysis/heuristics/kb.ts`
    - **dep:** T101
    - **Kill criteria:** default block

- [ ] **T106 [US-1] HeuristicLoader (R6 IP boundary)** (AC-04, REQ-HK-001; AC-11 contract surface — implementation deliverable lives in Phase 4b T4B-013) **— extended kill criteria**
  - **Brief:**
    - **Outcome:** `analysis/heuristics/loader.ts` exports `HeuristicLoader` interface + `FileSystemHeuristicLoader` impl. Reads `heuristicsDir/*.json`; per file: decryptor.decrypt → JSON.parse → HeuristicSchemaExtended.parse. Admits valid; logs rejection (id-only) for invalid; returns InMemoryKB. **R6 enforcement:** every log line uses `heuristic.id` ONLY; never body / benchmark / provenance content. Pino redaction config (from T-PHASE6-LOGGER) is safety net.
    - **Per-task kill criteria (extends default):**
      - "Any heuristic content (body, benchmark value, provenance fields) appears in Pino log line during loadAll()" → R23 STOP. R6.1 / R6.4 violation.
      - "Loader logs rejection WITH the rejected heuristic's body" → R23 STOP. R6 violation even on error path.
      - "JSON.parse error message contains heuristic content (e.g., partial body in error.text)" → wrap parser; emit error with id + error_class only.
    - **Constraints:** File < 200 lines. Pure function `loadAll()`. Errors are typed; no string content from heuristic body in error messages.
    - **Acceptance:** AC-04 — Pino transport spy verifies no body content in logs.
    - **Files:** `packages/agent-core/src/analysis/heuristics/loader.ts`
    - **dep:** T101, T102, T108

- [ ] **T107 [US-1] Two-stage filter** (AC-05, AC-06, AC-07, REQ-HK-020a + REQ-HK-020b) **— extended kill criteria**
  - **Brief:**
    - **Outcome:** `analysis/heuristics/filter.ts` exports three pure functions:
      - `filterByBusinessType(kb, businessType): ReadonlyArray<HeuristicExtended>` — Stage 1; reduces 100 → 60-70 per §9.6 acceptance
      - `filterByPageType(stage1Result, pageType): ReadonlyArray<HeuristicExtended>` — Stage 2; reduces 60-70 → 15-20
      - `prioritizeHeuristics(stage2Result, cap): ReadonlyArray<HeuristicExtended>` — sort by business_impact_weight desc + id asc; take top N
    - **Per-task kill criteria (extends default):**
      - "Stage 1 reduction missed (returns < 50 or > 80 on 100-fixture test)" → R23 INVESTIGATE. §9.6 may need re-tuning.
      - "Stage 2 reduction missed (returns < 10 or > 30 on Stage 1 result)" → same.
      - "prioritizeHeuristics non-deterministic (different output on same input)" → R23 STOP. Reproducibility (R10) breaks.
    - **Constraints:** Pure functions; no side effects. File < 200 lines.
    - **Acceptance:** AC-05, AC-06, AC-07 — all green on 100 synthetic fixtures.
    - **Files:** `packages/agent-core/src/analysis/heuristics/filter.ts`
    - **dep:** T101, T102

- [ ] **T108 [P] [US-1] DecryptionAdapter** (AC-08, REQ-HK-001 — encryption seam)
  - **Brief:**
    - **Outcome:** `adapters/DecryptionAdapter.ts` exports `DecryptionAdapter` interface + `PlaintextDecryptor` MVP impl returning input as utf-8 string. Used by HeuristicLoader. Forward seam: v1.1 plugs `AES256GCMDecryptor` against the same interface.
    - **Constraints:** File < 100 lines. PlaintextDecryptor is pure; no I/O.
    - **Acceptance:** AC-08 — fixture-MockDecryptor verifies seam.
    - **Files:** `packages/agent-core/src/adapters/DecryptionAdapter.ts`
    - **dep:** T-PHASE6-TESTS
    - **Kill criteria:** default block + extra: any AES-256-GCM concrete impl lands in MVP → STOP, that's v1.1

- [ ] **T109 [P] [US-1] TierValidator** (AC-09)
  - **Brief:**
    - **Outcome:** `analysis/heuristics/tier-validator.ts` exports `TierValidator.validate(heuristic): Tier | TierValidationError`. Maps `heuristic.category` to Tier 1 (visual/structural) / Tier 2 (content/persuasion) / Tier 3 (subjective). Configurable category-to-tier map.
    - **Constraints:** File < 150 lines. Pure function.
    - **Acceptance:** AC-09 — 4 fixtures (3 valid + 1 invalid) pass.
    - **Files:** `packages/agent-core/src/analysis/heuristics/tier-validator.ts`
    - **dep:** T101
    - **Kill criteria:** default block

- [ ] **T110 [P] [US-1] heuristics-repo/README.md** (Phase 0b workflow documentation)
  - **Brief:**
    - **Outcome:** `heuristics-repo/README.md` documents Phase 0b authoring workflow per PRD F-012 amendment 2026-04-26: directory layout (`baymard.json`, `nielsen.json`, `cialdini.json`), schema reference (HeuristicSchemaExtended), provenance requirements (R15.3.1), human verification gate (R15.3.2). Phase 0b consumes this doc.
    - **Constraints:** Plain markdown < 100 lines. No actual heuristic content.
    - **Acceptance:** README explains the 5-step authoring workflow + cites Phase 6 schema as the validation gate.
    - **Files:** `heuristics-repo/README.md`
    - **dep:** T101 (schema authority)
    - **Kill criteria:** default block

- [ ] **T111 [P] [US-1] analysis/heuristics/index.ts barrel + analysis/index.ts** (typed surface only)
  - **Brief:**
    - **Outcome:** `analysis/heuristics/index.ts` re-exports the typed surface (schemas, KB interface, loader interface, filter functions, TierValidator) but NOT raw heuristic content getters. `analysis/index.ts` re-exports the heuristics submodule.
    - **Constraints:** Each file < 50 lines. Only types + functions exported, never test fixtures.
    - **Acceptance:** Import surface allows `import { HeuristicLoader, filterByBusinessType, ... } from '@neural/agent-core/analysis/heuristics'`.
    - **Files:** `packages/agent-core/src/analysis/heuristics/index.ts`, `packages/agent-core/src/analysis/index.ts`
    - **dep:** T101, T102, T106, T107, T109
    - **Kill criteria:** default block

### Phase 6 acceptance gate

- [ ] **T112 [US-1] Phase 6 integration test** (AC-10)
  - **Brief:**
    - **Outcome:** `tests/integration/phase6.test.ts` runs full cycle: instantiate FileSystemHeuristicLoader pointing at `tests/fixtures/heuristics/` → loadAll() → KB has expected count → filterByBusinessType('ecommerce') → expected reduction → filterByPageType('checkout') → expected reduction → prioritizeHeuristics(30) → cap met → tier validator runs on each. **R6 verification:** Pino transport spy captures all log lines from the cycle; assert no fixture body text in any line. Total wall-clock < 30 s.
    - **Constraints:** File < 250 lines.
    - **Acceptance:** AC-10.
    - **Files:** `packages/agent-core/tests/integration/phase6.test.ts`
    - **dep:** T101-T111
    - **Kill criteria:** default block + extra: wall-clock > 30 s → STOP. R6 leak detected → STOP.

**Checkpoint:** All 10 ACs pass. Phase 6 ready for rollup.

---

## Phase N — Polish

- [ ] **T-PHASE6-DOC [P]** Update root README dev quickstart (note: heuristics-repo/ exists but content is Phase 0b workstream).
- [ ] **T-PHASE6-ROLLUP** Author `phase-6-current.md` per R19. Active modules: `analysis/heuristics/`. Contracts: 7 NEW. Forward dependency: Phase 0b populates content; Phase 7 consumes filtered output.

---

## Dependencies & Execution Order

```
T-PHASE6-TESTS  +  T-PHASE6-LOGGER  +  T-PHASE6-FIXTURES         # SETUP (parallel)
              │              │              │
              └──────┬───────┴──────────────┘
                     ▼
                   T101                                          # Schemas
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
     T102          T108          T109                            # KB, DecryptionAdapter, TierValidator (parallel)
                     │
                   T106                                          # HeuristicLoader (depends on T101+T102+T108)
                     │
                   T107                                          # Two-stage filter (depends on T101+T102)
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
     T110          T111          T112                            # README, barrel, integration test (parallel after main code)
                     │
T-PHASE6-DOC, T-PHASE6-ROLLUP
```

---

## Implementation Strategy

1. SETUP — T-PHASE6-TESTS + T-PHASE6-LOGGER + T-PHASE6-FIXTURES (parallel).
2. T101 (schemas).
3. Parallel batch A: T102, T108, T109.
4. T106 (loader — single-threaded; R6 enforcement).
5. T107 (filter).
6. Parallel batch B: T110, T111, T112.
7. Polish.

---

## Notes

- T103-T105 deferred to Phase 0b — kill criterion catches accidental implementation.
- R6 IP boundary first runtime activation: triple defense (code review, Pino redaction, transport spy).
- AES-256-GCM v1.1 — interface ready; concrete impl deferred.
- Synthetic fixtures only in this session; Phase 0b delivers real content.

---

## Cross-references

- spec.md, plan.md, impact.md
- `docs/specs/mvp/tasks-v2.md` T101-T112
- `docs/specs/final-architecture/09-heuristic-kb.md` §9.1, §9.6, §9.10
- `docs/specs/mvp/PRD.md` §F-012 + 2026-04-26 amendment
- `docs/specs/mvp/constitution.md` R5.4/R5.5, R6, R9, R15.3, R20, R23

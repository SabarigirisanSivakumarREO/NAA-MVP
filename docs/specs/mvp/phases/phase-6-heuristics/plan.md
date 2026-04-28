---
title: Implementation Plan — Phase 6 Heuristic KB Engine
artifact_type: plan
status: draft
version: 0.2
created: 2026-04-27
updated: 2026-04-27
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-6-heuristics/spec.md
  - docs/specs/mvp/phases/phase-6-heuristics/impact.md
  - docs/specs/mvp/architecture.md (§6.4, §6.5)
  - docs/specs/mvp/constitution.md (R5.4/R5.5, R6, R9, R15.3)

req_ids:
  - REQ-HK-001
  - REQ-HK-EXT-001
  - REQ-HK-EXT-019
  - REQ-HK-EXT-050
  - REQ-HK-020a
  - REQ-HK-020b

impact_analysis: docs/specs/mvp/phases/phase-6-heuristics/impact.md
breaking: false
affected_contracts:
  - HeuristicSchema
  - HeuristicSchemaExtended
  - HeuristicKnowledgeBase
  - HeuristicLoader
  - HeuristicFilter
  - TierValidator
  - DecryptionAdapter

delta:
  new:
    - First plan with R6 IP-boundary as runtime concern
    - 9 MVP engine tasks; T103-T105 deferred to Phase 0b
    - v0.2 — Phase 0 research item 3 details Pino redaction patterns mapped to BenchmarkSchema (analyze finding F006)
  changed:
    - v0.1 → v0.2 — Pino redaction pattern specification tightened
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R5.4/R5.5, R6, R9, R15.3, R17, R20, R23
---

# Implementation Plan: Phase 6 — Heuristic KB Engine

> **Summary (~100 tokens):** 9 MVP tasks: T101 schemas (base + Extended + provenance + benchmark), T102 KB container, T106 HeuristicLoader (R6 IP boundary), T107 two-stage filter, T108 DecryptionAdapter (PlaintextDecryptor MVP), T109 TierValidator, T110-T111 helpers, T112 Phase 6 integration test. **No new external deps.** T103-T105 (heuristic content) deferred to Phase 0b. impact.md MEDIUM-risk; first runtime activation of R6.

**Branch:** `phase-6-heuristics`
**Date:** 2026-04-27
**Spec / Impact:** see this folder.

---

## Summary

Phase 6 builds the heuristic engine: schema-level validation gate (R15.3 enforced), in-memory KB, R6-protected loader, two-stage filter per §9.6, encryption seam (PlaintextDecryptor MVP), tier validator. Engine ships against synthetic test heuristics; Phase 0b delivers real content.

---

## Technical Context

| Field | Value | Used in Phase 6? |
|---|---|---|
| TypeScript / Node | 5.x / 22 LTS | ✅ |
| Zod | 3.x | ✅ (HeuristicSchemaExtended is the largest Zod schema in MVP) |
| Pino | latest | ✅ (new correlation: heuristic_loader_session_id, kb_size, filter_stage) + redaction config |
| Vitest | latest | ✅ |
| All other stack items | various | ❌ Phase 6 doesn't touch them |

**No new external deps.** Phase 6 uses Phase 0+4 infrastructure only.

**Performance / Scale:** NF-Phase6-01..04.

---

## Constitution Check

- [x] R5.3 — N/A (no findings)
- [x] R5.4 two-stage filter BEFORE LLM — implemented per §9.6
- [x] R5.5 LLM user message injection — Phase 6 produces ready-to-inject form (Phase 7 consumes)
- [x] R6.1-R6.4 IP boundary — first runtime enforcement; Pino transport spy + redaction config
- [x] R6.2 — interface ready; concrete v1.1
- [x] R7.* — N/A (no DB)
- [x] R9 — HeuristicLoader + DecryptionAdapter (4th + 5th adapter categories)
- [x] R10 — N/A (no LLM in Phase 6)
- [x] R15.3 — schema enforces benchmark + provenance (both required)
- [x] R20 impact.md — REQUIRED, MEDIUM risk; authored
- [x] R23 kill criteria — default + per-task on T106 + T107

---

## Project Structure

```
docs/specs/mvp/phases/phase-6-heuristics/
├── README.md
├── spec.md
├── impact.md          # R20 — MEDIUM risk
├── plan.md            # this file
├── tasks.md
├── checklists/requirements.md
└── phase-6-current.md # rollup at exit
```

### Source Code

```
packages/agent-core/src/
├── analysis/                                   # NEW directory tree (Phase 6 first to populate)
│   ├── heuristics/
│   │   ├── types.ts                            # T101 — schemas + provenance + benchmark
│   │   ├── kb.ts                               # T102 — KB container
│   │   ├── loader.ts                           # T106 — HeuristicLoader interface + FileSystemHeuristicLoader
│   │   ├── filter.ts                           # T107 — filterByBusinessType + filterByPageType + prioritizeHeuristics
│   │   ├── tier-validator.ts                   # T109
│   │   └── index.ts                            # barrel (typed surface only)
│   └── index.ts                                # higher barrel
├── adapters/                                   # extends Phase 1+2+4
│   └── DecryptionAdapter.ts                    # T108 — interface + PlaintextDecryptor
└── observability/
    └── logger.ts                               # MODIFIED — add heuristic correlation fields + register Pino redaction patterns for heuristic content

heuristics-repo/                                # NEW directory at repo root
├── README.md                                   # explains Phase 0b authoring workflow
└── (Phase 0b populates the actual content)

packages/agent-core/tests/
├── fixtures/heuristics/                        # NEW — synthetic test fixtures
│   ├── baymard-test.json                       # ~10 entries
│   ├── nielsen-test.json                       # ~10 entries
│   ├── cialdini-test.json                      # ~10 entries
│   └── invalid/
│       ├── missing-benchmark.json
│       ├── missing-provenance.json
│       └── malformed-json.json
├── conformance/                                # 9 new
│   ├── heuristic-schema-base.test.ts
│   ├── heuristic-schema-extended.test.ts
│   ├── kb-container.test.ts
│   ├── heuristic-loader.test.ts
│   ├── r6-ip-boundary.test.ts                  # Pino transport spy
│   ├── filter-business-type.test.ts
│   ├── filter-page-type.test.ts
│   ├── prioritize.test.ts
│   ├── decryption-adapter.test.ts
│   └── tier-validator.test.ts
└── integration/
    └── phase6.test.ts                           # AC-10
```

`package.json`: no new deps.

---

## Phase 0 — Research

**Open design choices resolved:**

1. **Schema split:** base + Extended in one file `types.ts` (Extended `.extend()`s base). File ~250 lines (under 300 cap).
2. **R6 enforcement strategy:** Pino redaction config + grep-based source check + Pino transport spy in conformance tests. Three-layer defense.
3. **Pino redaction patterns (per spec v0.2 — F006 clarification):** register `['*.body', '*.benchmark.value', '*.benchmark.standard_text', '*.benchmark.unit', '*.benchmark.metric', '*.provenance.citation_text']` as redact paths in default Pino config. Mapping to Zod discriminated-union BenchmarkSchema: `value` covers the quantitative branch's measurement; `standard_text` covers the qualitative branch's reference text; `unit` + `metric` cover the quantitative branch's context; `provenance.citation_text` is the heuristic's own canonical excerpt and counts as IP. `source_url` / `verified_by` / `verified_date` / `draft_model` are NOT redacted (public metadata). Logger-level enforcement; Pino transport spy in conformance test verifies each path independently.
4. **Synthetic fixtures:** 30 test heuristics covering all schema fields + 3 negative-case fixtures. Lives in `tests/fixtures/heuristics/`.
5. **Filter algorithm:** Stage 1 includes if `heuristic.business_types.includes(businessType)`. Stage 2 includes if `heuristic.page_types.includes(pageType)`. Prioritize: sort by `business_impact_weight` desc, tie-break by `id` ascending, take top N.

---

## Phase 1 — Design

(Detailed in spec + impact; key inline:)

1. **HeuristicSchemaExtended `.strict()`** — no extra fields silently accepted; provenance + benchmark required.
2. **`FileSystemHeuristicLoader`** — reads each `*.json` from heuristicsDir; for each: decryptor.decrypt → JSON.parse → HeuristicSchemaExtended.parse → admit or log-rejection-with-id-only.
3. **R6 logging discipline** — every log line emitted by `loader.ts` references heuristic by `id`; never body text. Code review enforces; Pino redaction is safety net.
4. **Pure functions for filter** — `filterByBusinessType` etc. are stateless; KB is the only state holder.
5. **TierValidator** — pure function; reads `category` field + applies tier-classification map (Tier 1: visual/structural, Tier 2: content/persuasion, Tier 3: subjective).

---

## Complexity Tracking

**None — plan respects all 23 Constitution rules.**

R6 first runtime enforcement is *expected* — the rule existed since Constitution v1.0; Phase 6 just makes it active. Not a violation.

---

## Approval Gates

| Gate | Approver | Evidence |
|---|---|---|
| Spec → Plan transition | spec author + product owner | spec `approved` AND impact.md `approved` |
| R6 IP boundary strategy | engineering lead | three-layer enforcement designed |
| R15.3 schema enforcement | engineering lead | benchmark + provenance required in HeuristicSchemaExtended |
| Plan → Tasks transition | engineering lead | This plan `approved` |

---

## Cross-references

- spec.md, impact.md
- `docs/specs/mvp/tasks-v2.md` T101-T112
- `docs/specs/final-architecture/09-heuristic-kb.md` §9.1, §9.6, §9.10
- `docs/specs/mvp/PRD.md` §F-012 + 2026-04-26 amendment
- `docs/specs/mvp/constitution.md` R5.4/R5.5, R6, R9, R15.3, R20, R23

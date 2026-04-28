---
title: Phase 6 — Heuristic KB Engine
artifact_type: phase-readme
status: approved
version: 1.0
phase_number: 6
phase_name: Heuristic KB
created: 2026-04-27
updated: 2026-04-27
owner: engineering lead
req_ids:
  - REQ-HK-001
  - REQ-HK-EXT-001
  - REQ-HK-EXT-019
  - REQ-HK-EXT-050
  - REQ-HK-020a
  - REQ-HK-020b
delta:
  new:
    - Phase 6 README
  changed: []
  impacted: []
  unchanged: []
governing_rules:
  - Constitution R5 (Analysis Agent Rules — R5.4 heuristics filtered before LLM, R5.5 injected in user message)
  - Constitution R6 (Heuristic IP Protection — first activation in Phase 6)
  - Constitution R9 (Adapter Pattern — HeuristicLoader)
  - Constitution R15 (Quality Gates — R15.3 benchmark + provenance required on every heuristic)
  - Constitution R17, R19, R20
  - PRD §F-012 (Heuristic Knowledge Base; amended 2026-04-26 for LLM-assisted authoring in Phase 0b)
---

# Phase 6 — Heuristic KB Engine

> **Summary (~150 tokens):** The heuristic engine — schema, loader, two-stage filter, encryption stub, tier validator. **9 MVP engine tasks** (T101, T102, T106-T112; T103-T105 heuristic CONTENT authoring is Phase 0b workstream, deferred this session). HeuristicSchema (base + Extended with forward-compat fields per §9.10), HeuristicKnowledgeBase container, HeuristicLoader (R6 IP boundary — content never leaks to logs/API), two-stage filter (`filterByBusinessType` Stage 1 in audit_setup → `filterByPageType` Stage 2 in page_router → prioritizeHeuristics top 30 cap), encryption stub (AES-256-GCM deferred to v1.1 per PRD §3.2; loader interface ready), tier validator. **First phase to activate R6 IP protection at runtime** — heuristic content loaded into memory but NEVER serialized into logs/API/dashboards/LangSmith.

## Goal

After Phase 6: HeuristicLoader can load a Phase 0b-produced heuristics directory, validate every heuristic against `HeuristicSchemaExtended` (rejects invalid; logs only IDs, never content), and expose a typed in-memory KB. The two-stage filter reduces ~100 heuristics → 30 filtered. Tier validator confirms each heuristic has a valid Tier 1/2/3 classification. R6 IP boundary enforced: no heuristic body text leaves the in-memory KB outside the LLM evaluate prompt (Phase 7). Phase 6 ships **engine only**; the heuristic CONTENT (T103-T105: 50 Baymard + 35 Nielsen + 15 Cialdini) is Phase 0b's deliverable, deferred this session.

## Tasks (MVP — 9 engine tasks)

| Task | Description | MVP this session? |
|---|---|---|
| T101 | HeuristicSchema (base + Extended Zod) | ✅ |
| T102 | HeuristicKnowledgeBase container schema | ✅ |
| T103 | Author 50 Baymard heuristics | ❌ **Phase 0b (deferred)** |
| T104 | Author 35 Nielsen heuristics | ❌ **Phase 0b (deferred)** |
| T105 | Author 15 Cialdini heuristics | ❌ **Phase 0b (deferred)** |
| T106 | HeuristicLoader (R6 IP boundary) | ✅ |
| T107 | Two-stage filter (`filterByBusinessType` + `filterByPageType` + `prioritizeHeuristics`) | ✅ |
| T108 | Encryption stub interface (AES-256-GCM concrete impl deferred to v1.1) | ✅ |
| T109 | Tier validator (Tier 1/2/3 classification) | ✅ |
| T110-T112 | Helper modules + Phase 6 integration test (against synthetic test heuristics) | ✅ |

T103-T105 are heuristic content authoring per PRD F-012 amendment 2026-04-26 (LLM-assisted, engineering-owned, requires R15.3 provenance + human verification). Deferred this session per agreed scope; lands in a separate Phase 0b session.

Full descriptions: [tasks.md](tasks.md). Cross-reference: [tasks-v2.md T101-T112](docs/specs/mvp/tasks-v2.md).

## Exit criteria

- [ ] HeuristicSchemaExtended validates synthetic test heuristics with 0 z.any() escapes
- [ ] HeuristicLoader loads from `heuristics-repo/` directory (test fixtures); rejects malformed entries; logs only IDs (NEVER content) — R6 conformance test verifies via Pino transport spy
- [ ] Two-stage filter: 100 synthetic heuristics → ~60-70 (Stage 1) → ~15-20 (Stage 2) → top 30 (prioritized) — verified against test fixtures
- [ ] Encryption interface accepts a `Decryptor` impl (AES-256-GCM stub returns plaintext in MVP; v1.1 plugs real decrypt)
- [ ] Tier validator confirms every loaded heuristic has Tier 1/2/3 classification
- [ ] No heuristic content (text, benchmarks, principles) appears in API responses, dashboards, Pino logs, or LangSmith traces — R6 grep + Pino redaction test
- [ ] Phase 6 integration test green using synthetic heuristics

## Depends on

- **Phase 0** (monorepo + agent-core skeleton + Vitest)
- **Phase 4** (LLMAdapter — Phase 7 will inject heuristics into LLM user prompt; Phase 6 doesn't call LLM but its data shape must align with Phase 7's evaluate prompt expectations)

## Blocks

- **Phase 7** (Analysis Pipeline — EvaluateNode injects filtered heuristics into LLM user message per R5.5)

## Out of scope this session (deferred to Phase 0b)

- T103: 50 Baymard heuristics with provenance + human verification
- T104: 35 Nielsen heuristics with provenance + human verification
- T105: 15 Cialdini heuristics with provenance + human verification
- AES-256-GCM concrete decryption (v1.1 — pre-pilot per PRD §3.2)

## Rollup on exit

```bash
pnpm spec:rollup --phase 6
```

`phase-6-current.md` per R19. Active modules: `analysis/heuristics/`. Contracts: HeuristicSchema (base + Extended), HeuristicKnowledgeBase, HeuristicLoader, two-stage filter, tier validator, decryption stub. Forward risks for Phase 7 (EvaluateNode injects filtered heuristics; if Phase 7 expectation drifts from Phase 6 schema shape, evaluate breaks). Forward dependency on Phase 0b (content authoring) — Phase 7 acceptance tests can run with synthetic heuristics until Phase 0b ships.

## Reading order for Claude Code

1. This README
2. [tasks.md](tasks.md), [spec.md](spec.md), [impact.md](impact.md), [plan.md](plan.md)
3. `docs/specs/final-architecture/09-heuristic-kb.md` — heuristic KB canonical (§9.1 base + §9.10 extensions)
4. `docs/specs/mvp/PRD.md` §F-012 amendment 2026-04-26 (LLM-assisted authoring + R15.3 provenance)
5. `docs/specs/mvp/constitution.md` R6 (IP protection — focal rule), R5.4 + R5.5 (heuristic filtering + injection), R15.3 (provenance)

Do NOT load:
- Analysis pipeline specs (Phase 7 consumes Phase 6's KB output but is its own scope)
- Phase 0b heuristic-authoring spec (separate workstream; out of scope this session)

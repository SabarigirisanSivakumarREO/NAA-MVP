---
title: Phase 0b — Heuristic Authoring (LLM-Assisted, Engineering-Owned) — README
artifact_type: readme
status: draft
version: 0.2
created: 2026-04-28
updated: 2026-04-30
owner: engineering lead

delta:
  v0_2:
    changed:
      - Effort estimate synced with plan.md §9 ("~24h" → "~26h engineering + ~7h verifier"; analyze L1 finding from Phase 0b /speckit.analyze pass)
  v0_1:
    new:
      - Phase 0b README initial draft
---

# Phase 0b — Heuristic Authoring (LLM-Assisted, Engineering-Owned)

> **Summary (~150 tokens — agent reads this first):** Author the 30-heuristic MVP knowledge base via LLM-assisted drafting + mandatory human verification (per PRD F-012 v1.2 amendment 2026-04-26 + Constitution R15.3). Engineering-owned workstream — NOT a parallel CRO track. **8 tasks:** T0B-001..T0B-005 build the authoring infrastructure (drafting prompt template, verification protocol, PR Contract Proof block extension, `pnpm heuristic:lint` CLI, `heuristics-repo/README.md` workflow doc); T103/T104/T105 produce the actual heuristic JSON content (~15 Baymard + ~10 Nielsen + ~5 Cialdini = 30 total per F-012 v1.2). Every heuristic carries a `benchmark` block (R15.3) AND a `provenance` block (R15.3.1: `source_url`, `citation_text`, `draft_model`, `verified_by`, `verified_date`); LLM-drafted content remains IP-protected per R15.3.3 + R6. Phase 6 engine is the runtime validation gate (HeuristicSchemaExtended Zod parse on load).

---

## What's in this folder

| File | Purpose |
|---|---|
| `spec.md` | Full feature spec (P1-P3 user stories, AC-01..AC-15, R-01..R-12, NF-01..NF-05) |
| `plan.md` | Sequencing, drafting prompt template, verification protocol, kill criteria, effort estimate |
| `tasks.md` | T0B-001..T0B-005 + T103/T104/T105 phase-scoped view (T0B-NNN canonical here; T103-T105 canonical in `tasks-v2.md`) |
| `impact.md` | R20 impact analysis — LOW risk (content-only; HeuristicSchemaExtended already locked in Phase 6) |
| `checklists/requirements.md` | Spec-quality checklist |

---

## Quick links

- **PRD F-012 amendment:** [`docs/specs/mvp/PRD.md`](../../PRD.md) §4 F-012 (LLM-assisted authoring + provenance)
- **Constitution rules:** R6 (IP), R15.3/.1/.2/.3 (benchmark + provenance + verification + IP), R20 (impact)
- **Architecture spec:** [`docs/specs/final-architecture/09-heuristic-kb.md`](../../../final-architecture/09-heuristic-kb.md) §9.1 (HeuristicSchema base)
- **Engine spec (downstream):** [`docs/specs/mvp/phases/phase-6-heuristics/`](../phase-6-heuristics/) — HeuristicSchemaExtended is the validation gate
- **Context filter (downstream):** [`docs/specs/mvp/phases/phase-4b-context-capture/`](../phase-4b-context-capture/) T4B-013 — `loadForContext()` filters heuristics by `archetype`/`page_type`/`device`
- **Examples:** [`docs/specs/mvp/examples.md`](../../examples.md) §10 (✅ GOOD heuristic / ❌ BAD heuristic)
- **Canonical tasks (workflow):** [`docs/specs/mvp/tasks-v2.md`](../../tasks-v2.md) Phase 0b section (v2.3.3+)
- **Canonical tasks (content):** [`docs/specs/mvp/tasks-v2.md`](../../tasks-v2.md) Phase 6 section — T103/T104/T105 (definitions live there; ownership is Phase 0b)

---

## Status

| Field | Value |
|---|---|
| Status | ⚪ Not started |
| Depends on | Phase 0 (T001-T005 setup) + T101 HeuristicSchemaExtended (Phase 6) + T4B-013 manifest selectors contract (Phase 4b refresh) |
| Blocks | Phase 6 implementation (engine needs content to load + integration test against), Phase 7 EvaluateNode (consumes filtered heuristic packs) |
| Estimated effort | ~26h engineering + ~7h verifier (single engineer over 4 weeks; see [plan.md §9](plan.md) for itemized breakdown) |
| Heuristic count | 30 (≈15 Baymard + ≈10 Nielsen + ≈5 Cialdini) per F-012 v1.2 amendment |
| LLM cost | ~$5-10 total drafting cost (Claude Sonnet 4 × 30 heuristics × ~3K tokens/draft) |
| Affected contracts | None new — consumes Phase 6's HeuristicSchemaExtended; produces JSON files for `heuristics-repo/` |
| Risk level | LOW — content authoring; engine contract already locked in Phase 6 |

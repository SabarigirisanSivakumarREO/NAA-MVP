---
title: Phase 6 Validation — Heuristics KB Engine
artifact_type: validation
status: implemented
version: 1.0
phase_number: 6
phase_name: heuristics
phase_completed_on: 2026-05-17
created: 2026-05-17
updated: 2026-05-17
owner: engineering lead
authors: [Claude (Opus 4.7)]
reviewers: [Sabari]
supersedes: null
supersededBy: null
derived_from:
  - docs/specs/mvp/phases/phase-6-heuristics/spec.md
  - docs/specs/mvp/phases/phase-6-heuristics/tasks.md
  - docs/specs/mvp/phases/phase-6-heuristics/phase-6-current.md
  - .phase-state/6/code-review-findings.yaml
  - .phase-state/6/verify-test-results.json
governing_rules:
  - Constitution R19 (Rollup per Phase) — sibling artifact pair
  - CLAUDE.md §8c (Per-phase artifact maintenance)
---

# Phase 6 — Heuristics — Validation

> **Purpose:** 5 ASCII proofs a human reviewer can confirm by eyes in ~20 minutes. Read after `phase-6-current.md`. Each section self-checkable: pick one cited line, open file, confirm match. Three matches = trust the rest.

> **Governed by:** Constitution R19. Cap 400 lines / ~4000 tokens.

---

## §1 Module dependency graph

```
  packages/agent-core/src/
  ├── observability/
  │     logger.ts  ──── exports createHeuristicLogger + 6-path redact config
  │        ▲
  │        │ (Pino bindings, redact)
  │        │
  ├── adapters/
  │     DecryptionAdapter.ts  ── interface only (pure types)
  │        ▲
  │        │  implements
  │        │
  ├── analysis/
  │     heuristics/
  │     ├── kb.ts ──────────────► (no deps; immutable Map container)
  │     ├── decryption.ts ──────► adapters/DecryptionAdapter.ts (identity impl)
  │     ├── tier-validator.ts ──► (uses HeuristicSchema types only)
  │     ├── loader.ts ──────────► kb.ts + decryption.ts + tier-validator.ts
  │     │                         + logger.ts + Zod HeuristicSchema (Phase 4b)
  │     ├── filter.ts ──────────► kb.ts + types
  │     ├── filters.ts ─────────► kb.ts + types
  │     ├── prioritize.ts ──────► kb.ts + types
  │     └── index.ts (barrel) ──► re-exports all above
  │
  └── analysis/index.ts ────────► barrel re-export of heuristics surface
```

Arrows = runtime imports. No external SDK imports introduced; logger.ts already imported `pino` pre-Phase-6.

**Trust check:** open `analysis/heuristics/loader.ts`, grep `^import`, expect kb / decryption / tier-validator / logger / types only.

---

## §2 Data flow — canonical entry point

```
heuristicsDir ──┐
                ▼
  HeuristicLoader.loadAll(dir) (async)             ► event: heuristic loader started
                │
                ├─ readdir + filter *.json
                │
                ├─ for each file:
                │     ├─ readFile (async)
                │     ├─ JSON.parse (try/catch) ── on fail ──► warn(error_class=SyntaxError) + skip
                │     │
                │     ├─ DecryptionAdapter.decrypt(raw) ── identity in MVP ──► [decrypted JSON]
                │     │
                │     ├─ HeuristicSchema.safeParse(decrypted)
                │     │     │ fail ─► warn + skip
                │     │     ▼ ok
                │     │
                │     ├─ TierValidator.assert(heuristic.archetype)
                │     │     │ fail ─► warn + skip
                │     │     ▼ ok
                │     │
                │     └─ kb.add(heuristic.id, heuristic)
                │
                ▼
  ──► [HeuristicKnowledgeBase {size, get, iterate}]    ► event: heuristic loader complete
                │
                ▼
  filterByBusinessType(kb, businessType)
   ──► [Heuristic[] where applicable_business_types includes businessType]
                │
                ▼
  filterByPageType(_, pageType)
   ──► [Heuristic[] where applicable_page_types includes pageType]
                │
                ▼
  prioritizeHeuristics(_)
   ──► [Heuristic[] (≤ 30, sorted by priority/impact)]
                │
                ▼
  EvaluateNode (Phase 7) consumes filtered + prioritized list
```

**Trust check:** in `loader.ts` find `safeParse` call site; confirm warn-and-continue path on failure (no throw).

---

## §3 Function flow — HeuristicLoader.loadAll

```
HeuristicLoader.loadAll(heuristicsDir)                 [loader.ts]
├─ session_id = randomUUID()
├─ logger = createHeuristicLogger({heuristic_loader_session_id, heuristicsDir})
├─ logger.info("heuristic loader started")
├─ files = await fs.readdir(dir)
├─ kb = new HeuristicKnowledgeBase()
├─ rejected = 0
├─ for (file of files.filter(*.json)) {
│   ├─ try {
│   │   ├─ raw = await fs.readFile(file, 'utf8')
│   │   ├─ json = JSON.parse(raw)                       ◄ may throw SyntaxError
│   │   ├─ decrypted = DecryptionAdapter.decrypt(json)  ◄ identity passthrough
│   │   ├─ result = HeuristicSchema.safeParse(decrypted)
│   │   │   └─ if !result.success: warn(rejected_id, error_class) + continue
│   │   ├─ TierValidator.assert(result.data.archetype)   ◄ may throw
│   │   └─ kb.add(result.data.id, result.data)
│   │  } catch (err) {
│   │   ├─ rejected++
│   │   └─ logger.warn({rejected_id: file, error_class: err.name, kb_size_so_far: kb.size})
│   │  }
│  }
├─ logger.info({kb_size: kb.size, rejected_count: rejected}, "heuristic loader complete")
└─ return kb
```

**Trust check:** open loader.ts, find the for-of loop. Confirm `try` wraps each iteration so a single bad file never aborts the corpus.

---

## §4 AC → impl → test traceability

```
┌────────┬─────────────────────────────────────────────┬─────────────────────────────────────────┬────────┬──────────────┐
│ AC     │ Impl file                                   │ Test file                               │ Status │ Notes        │
├────────┼─────────────────────────────────────────────┼─────────────────────────────────────────┼────────┼──────────────┤
│ AC-01  │ analysis/heuristics/types.ts (T101)         │ tests/unit/analysis/heuristics/types    │ ✅ 40/40│ fwd-pulled   │
│ AC-02  │ analysis/heuristics/types.ts (T101)         │ tests/unit/analysis/heuristics/types    │ ✅      │ fwd-pulled   │
│ AC-03  │ analysis/heuristics/kb.ts                   │ tests/conformance/kb-container          │ ✅      │              │
│ AC-04  │ analysis/heuristics/loader.ts               │ tests/conformance/heuristic-loader      │ ✅ 4/4  │              │
│ AC-05  │ analysis/heuristics/filter.ts               │ tests/conformance/filter-business-type  │ ✅ 3/3  │              │
│ AC-06  │ analysis/heuristics/filters.ts              │ tests/conformance/filter-page-type      │ ✅ 3/3  │              │
│ AC-07  │ analysis/heuristics/prioritize.ts           │ tests/conformance/prioritize            │ ✅ 4/4  │ cr-001 LOW   │
│ AC-08  │ adapters/DecryptionAdapter.ts +             │ tests/conformance/decryption-adapter    │ ✅      │ identity MVP │
│        │ analysis/heuristics/decryption.ts           │                                         │        │              │
│ AC-09  │ analysis/heuristics/tier-validator.ts       │ tests/conformance/tier-validator        │ ✅      │              │
│ AC-10  │ all above (integration)                     │ tests/integration/phase6                │ ✅ 1/1  │              │
│ AC-11  │ analysis/heuristics/types.ts (T101 partial) │ tests/unit/.../types + Phase 4b T4B-013 │ ✅ partial│ full contract surface shipped Phase 4b │
└────────┴─────────────────────────────────────────────┴─────────────────────────────────────────┴────────┴──────────────┘

R6 redaction (REQ-HK-001, spec.md:101 6-path list):
┌────────────────────────────────────┬──────────────────────────────┬─────────────────────────────────────┬────────┐
│ Path                               │ Branch                       │ Asserted in                         │ Status │
├────────────────────────────────────┼──────────────────────────────┼─────────────────────────────────────┼────────┤
│ *.body                             │ all                          │ r6-ip-boundary.test.ts              │ ✅     │
│ *.benchmark.value                  │ quantitative                 │ r6-ip-boundary.test.ts              │ ✅     │
│ *.benchmark.standard_text          │ qualitative                  │ r6-ip-boundary.test.ts              │ ✅     │
│ *.benchmark.unit                   │ quantitative                 │ r6-ip-boundary.test.ts              │ ✅     │
│ *.benchmark.metric                 │ quantitative                 │ r6-ip-boundary.test.ts              │ ✅     │
│ *.provenance.citation_text         │ all                          │ r6-ip-boundary.test.ts              │ ✅     │
└────────────────────────────────────┴──────────────────────────────┴─────────────────────────────────────┴────────┘
```

**Trust check:** `pnpm -F @neural/agent-core exec vitest run tests/conformance/r6-ip-boundary.test.ts` → 2 passed.

---

## §5 Resource cost breakdown

Phase 6 is offline (no LLM in engine). Primary resource = corpus load wall-clock + memory footprint.

```
Per-test corpus (33 valid fixtures: 10 baymard + 10 nielsen + 10 cialdini + 3 fixture extras):

┌──────────────────────────────┬──────────┬──────────────────────────────────┐
│ Stage                        │ Duration │ Notes                            │
├──────────────────────────────┼──────────┼──────────────────────────────────┤
│ readdir + filter             │   <1 ms  │ filesystem cache hot             │
│ readFile × 33                │   ~5 ms  │ small JSON files                 │
│ JSON.parse × 33              │   ~2 ms  │                                  │
│ Zod safeParse × 33           │   ~3 ms  │ HeuristicSchema discriminated U  │
│ TierValidator × 33           │   <1 ms  │                                  │
│ kb.add × 33                  │   <1 ms  │ Map insert                       │
├──────────────────────────────┼──────────┼──────────────────────────────────┤
│ TOTAL loader.loadAll         │ ~10-15ms │ observed in conformance + intg   │
└──────────────────────────────┴──────────┴──────────────────────────────────┘

Phase 6 full test suite (9 files, 31 tests):
─ wall-clock: 1.31s (transform 322ms + collect 1.48s + tests 264ms)
─ zero LLM cost (engine is content-agnostic; no analysis here)
─ zero DB writes (no Postgres dependency in Phase 6 surface)

Production projection (30-heuristic corpus, MVP target):
─ loadAll ~10 ms cold, ~5 ms warm
─ filterByBusinessType + filterByPageType + prioritize ~<1 ms combined
─ EvaluateNode (Phase 7) sees ≤30 heuristics with negligible engine overhead
```

**Trust check:** rerun Phase 6 suite (`pnpm -F @neural/agent-core exec vitest run tests/conformance/heuristic-*.test.ts ...`), confirm duration < 2s.

---

## §6 Trust calibration — spot-check by hand

```
1. loader.ts (the `for (file of files)` loop body)
   Risk: a single bad file aborting the whole corpus instead of warn-and-continue
   How to verify: try { ... } must wrap each iteration; catch warns + continues;
                  rejected counter increments; no throw escapes the loop

2. logger.ts (redact path array)
   Risk: typo in any of the 6 paths silently disables that redaction
   How to verify: grep for ['*.body', '*.benchmark.value', '*.benchmark.standard_text',
                  '*.benchmark.unit', '*.benchmark.metric', '*.provenance.citation_text'];
                  all six strings must appear EXACTLY in the redact config

3. prioritize.ts (cap-to-30 logic)
   Risk: off-by-one cap (29 or 31), or stable-sort lost across runs
   How to verify: returned array length ≤ 30; sort key matches spec; conformance
                  test prioritize.test.ts has 4 cases — confirm they exercise cap

4. tier-validator.ts (archetype enum)
   Risk: enum drift — should be exactly {baymard, nielsen, cialdini}; extra value
         would let unknown archetypes through
   How to verify: open tier-validator.ts; confirm allowed set; cross-check spec.md AC-09

5. kb.ts (Map immutability claim)
   Risk: kb.add mutates internal Map after freeze, or get() leaks live reference
   How to verify: confirm container exposes only read methods externally; any
                  mutation happens via dedicated add() pre-freeze
```

If all 5 spot-checks pass → trust the rest of Phase 6.

---

## §7 Open ends linkage

- Limitations carried forward → `phase-6-current.md` §4
- Open risks for next phase   → `phase-6-current.md` §5
- Stage 2.5 follow-up findings → `.phase-state/6/code-review-findings.yaml` (1 LOW: prioritize logger plumbing — defer to Phase 7)

---

## §8 How this doc was authored

Master orchestrator Stage 4 exit deliverable, paired with `phase-6-current.md`. ASCII diagrams generated from impl state at HEAD post-Stage-2 (commits 09c1df6..161f8eb) after Gate 2 APPROVE stamp 2026-05-17.

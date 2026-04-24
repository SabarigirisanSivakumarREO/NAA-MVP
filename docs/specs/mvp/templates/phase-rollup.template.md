---
title: Phase <N> Rollup — Current System State
artifact_type: rollup
status: approved       # immediately approved at phase exit; → verified when Phase N+1 begins; → superseded when Phase N+1 rollup exists
version: 1.0
phase_number: <N>
phase_name: <name>
phase_completed_on: 2026-MM-DD
created: 2026-MM-DD
updated: 2026-MM-DD
owner: <engineering lead>
authors: [<name>]
reviewers: [<name>]
supersedes: phase-<N-1>-current.md    # if applicable
supersededBy: null                     # set when Phase N+1 rollup lands
derived_from:
  - docs/specs/mvp/phases/phase-<N>-<name>/tasks.md
  - docs/specs/mvp/phases/phase-<N>-<name>/spec.md
req_ids: []
delta:
  new:
    - Phase <N> modules + contracts listed below
  changed:
    - <any modifications vs Phase N-1 state>
  impacted:
    - <downstream phases depending on this state>
  unchanged:
    - <what from phase N-1 carries through unchanged>
governing_rules:
  - Constitution R19 (Rollup per Phase)
---

# Phase <N> — <Name> — Current System State Rollup

> **Summary (~200 tokens):** Compressed view of what the system looks like after Phase <N> completion. Phase <N+1> work reads this FIRST instead of loading all Phase <N> artifacts. Captures: active modules, data contracts in effect, system flows operational, known limitations carried forward, open risks for next phase.

> **Governed by:** Constitution R19. Rollup size cap: 300 lines / ~3000 tokens.

---

## 1. Active modules introduced this phase

List every module that now exists + is in use. Paths relative to repo root.

| Module | Path | Purpose | Tests |
|---|---|---|---|
| <ModuleA> | `packages/agent-core/src/...` | <one-line purpose> | `tests/unit/<path>.test.ts` (N tests) |
| <ModuleB> | ... | ... | ... |

---

## 2. Data contracts now in effect

Shared types + Zod schemas consumed by downstream phases. Cite source-of-truth spec.

| Contract | Location | Spec | Notes |
|---|---|---|---|
| `PageStateModel` | `packages/agent-core/src/perception/types.ts` | §06 REQ-BROWSE-PERCEPT-001 | MVP baseline; no v2.3 enrichments yet |
| `AnalyzePerception` (baseline) | `packages/agent-core/src/analysis/types.ts` | §07.9 | v2.3 enrichments pending Phase 2 |
| ... | ... | ... | ... |

---

## 3. System flows now operational

End-to-end behaviors enabled by this phase. Short narrative per flow.

### Flow: <flow name>

**Trigger:** <what starts it>
**Steps:** <1-2 sentences>
**Output:** <what it produces>
**Spec:** <REQ-ID>

---

## 4. Known limitations carried forward

Issues NOT solved by this phase; must be tracked into Phase N+1 or later.

| Limitation | Phase to resolve | Workaround in place |
|---|---|---|
| No mobile viewport support | Phase 12 | Desktop 1440×900 only |
| No state exploration | Phase 10 | Default state only; accept ~30% PDP coverage loss |
| ... | ... | ... |

---

## 5. Open risks for next phase

Things the next phase must be aware of when starting.

| Risk | Impact | Owner | Mitigation |
|---|---|---|---|
| <risk> | <impact> | <person> | <planned mitigation> |

---

## 6. Conformance gate status

Which conformance tests pass at phase exit.

| Test | Status | Last run |
|---|---|---|
| `pnpm test:conformance -- grounding` | ✅ green | 2026-MM-DD |
| `pnpm test:conformance -- scoring` | ✅ green | 2026-MM-DD |
| ... | ... | ... |

---

## 7. What Phase <N+1> should read

When Phase <N+1> starts, the recommended reading order is:

1. This file (`phase-<N>-current.md`) — YOU ARE HERE
2. `docs/specs/mvp/phases/phase-<N+1>-<name>/README.md`
3. `docs/specs/mvp/phases/phase-<N+1>-<name>/spec.md`
4. `docs/specs/mvp/phases/phase-<N+1>-<name>/tasks.md`
5. Specific REQ-IDs cited per task (open only what you need)

Do NOT load all Phase <N> artifacts. The compression is intentional.

---

## 8. Cost + time summary (this phase)

| Metric | Target | Actual |
|---|---|---|
| Duration (weeks) | <planned> | <actual> |
| Engineering hours | <planned> | <actual> |
| LLM spend on dev | <planned> | <actual> |
| Tasks completed | <planned> | <actual> |

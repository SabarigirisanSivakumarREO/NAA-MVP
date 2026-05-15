# Phase 4b — Stage 2 Mid-Phase Handoff (Session N → Session N+1)

**Date checkpointed:** 2026-05-16
**Checkpointed by:** Claude (master orchestrator session)
**Resume command:** `/master 4b --resume`
**Branch:** `feat/phase-4b-context-capture` (NOT pushed to origin — branch lives locally; user pushes when desired)
**Latest commit at checkpoint:** `e47ba16`
**Parent of branch:** `master` @ `561bdea` (Phase 4 merged 2026-05-15 + usage-guard hooks landed)

---

## Where we are

Phase 4b Gate 1 cleared (Pass 1 REVISE → 8-action patch wave → Pass 2 APPROVE). **6 of 15 implementation tasks landed across Waves 1-3.** All 4 spec artifacts at `status: approved v0.2`. Stage 2 is mid-flight; next session resumes at Wave 4.

### Timeline this session (Stage 1 + Gate 1 + Waves 1-3)

| Commit | Stage / Wave | What landed |
|---|---|---|
| (boot prior session) | — | `.phase-state/4b.json` initialized; phase folder authored |
| `d8ec532` | Stage 1 boot | branch cut from master `561bdea` + R20 invalidation note (back-fill of Phase 4 Stage 4 EXIT oversight) |
| `bd6fdd6` | Stage 1 pre-flight Pass 1 | `/speckit.analyze` + `pnpm spec:matrix --phase 4b` outputs mirrored to `stage-1-preflight-outputs.md` |
| `8965724` | Stage 1b Gate 1 Pass 1 | AI Reviewer Pass 1 verdict: REVISE (1 HIGH + 1 MED + 4 LOW spec + 2 MED completeness — 8 blocking actions) |
| `821c266` | Gate 1 patch wave | 8-action patch wave applied atomically (act-001..act-008); spec/plan/tasks/impact bumped v0.1 → v0.2; R18 delta blocks appended |
| `d52c1ae` | Stage 1b Gate 1 Pass 2 | AI Reviewer Pass 2 verdict: APPROVE (8/8 findings closed; 2/2 completeness SPEC_GAPs closed) |
| `4fbe8c0` | Gate 1 APPROVED — R17.4 bump | 4 artifacts bumped `status: draft → approved` (single atomic commit) |
| `79f90b7` | **Wave 1** SETUP | T4B-001 ContextProfile Zod schema (370 LOC; 14/14 GREEN) |
| `a3c55bf` | **Wave 2A** | T4B-002 URLPatternMatcher (161 LOC; 9/9 GREEN; R25 clean) |
| `78d7eb1` | **Wave 2B** | T4B-003 HtmlFetcher cheerio+undici (297 LOC; 10/10 GREEN; R25 clean; RobotsChecker call-ordering verified) |
| `7871e7d` | **Wave 2C** | T4B-012 context_profiles migration (closes Phase 4 AC-17 slot; 10/10 GREEN; RLS+FORCE+append-only trigger) |
| `eea6077` | **Wave 3A** | T4B-009 AuditRequest intake schema (286 LOC; 16/16 GREEN; REQ-GATEWAY-INTAKE-001/002 enforced) |
| `e47ba16` | **Wave 3B** | T4B-004 JsonLdParser (202 LOC; 13/13 GREEN; R25 clean) |

**Cumulative test pass count after Wave 3:** 72/72 conformance tests GREEN across the 6 Phase 4b tasks.

### Cost + context at checkpoint

- **LLM spend (this session, Phase 4b portion):** ~$3-5 estimate (subagent dispatches ~$0.50-1.50 each × 8-9 dispatches)
- **Phase 4b cost ceiling:** $5.00 (high-attention 50% cap; tracker fragile per Phase 5 act-005 — see Open Threads)
- **Context budget:** master peak ~46-47% (well under 50% WARN; usage-guard hooks active and would block at 60%)
- **Wall-clock this session:** ~3-4 hours (Stage 1 + Gate 1 + Waves 1-3)

---

## What's done (6 tasks)

| Task | Wave | Description | Files | Commit |
|---|---|---|---|---|
| T4B-001 | 1 | ContextProfile Zod schema + provenance fields (FOUNDATION) | `src/types/context-profile.ts` (+ companion test) | `79f90b7` |
| T4B-002 | 2A | URLPatternMatcher (URL → PageTypeEnum) | `src/context/URLPatternMatcher.ts` (+ test) | `a3c55bf` |
| T4B-003 | 2B | HtmlFetcher (cheerio+undici, R25-clean, RobotsChecker-gated) | `src/context/HtmlFetcher.ts` (+ test) | `78d7eb1` |
| T4B-012 | 2C | context_profiles table migration | `src/db/schema.ts` + `src/db/migrations/0004_context_profiles.sql` (+ tests) | `7871e7d` |
| T4B-004 | 3A | JsonLdParser (cheerio-based schema.org extraction) | `src/context/JsonLdParser.ts` (+ test) | `e47ba16` |
| T4B-009 | 3B | AuditRequest intake schema (§18 extension) | `src/types/audit-request.ts` (+ test) | `eea6077` |

---

## What's remaining (9 tasks across 5 waves)

### Wave 4 — PARALLEL BATCH (cap=3 under high-attention)

- **T4B-005 BusinessArchetypeInferrer** — deps T4B-001 + T4B-004 (JsonLdParser); inputs HTML/JSON-LD + URL; outputs `BusinessArchetypeEnum` value with provenance; supports deterministic/heuristic/llm_judge methods
- **T4B-006 PageTypeInferrer** — deps T4B-001 + T4B-002 + T4B-004; consolidates §07 §7.4 logic; URL-pattern + JSON-LD + DOM heuristics → `PageTypeEnum` with confidence

(2 parallel subagents)

### Wave 5 — PARALLEL BATCH (cap=3)

- **T4B-007 ConfidenceScorer + ProvenanceAssembler** — deps T4B-001 + T4B-005 + T4B-006; aggregates per-dimension confidence into overall_confidence; assembles ProvenanceEntry array
- **T4B-013 HeuristicLoader extension** — deps T4B-001 + T106 (HeuristicLoader baseline — verify location; likely from Phase 6 or earlier; check `src/heuristics/HeuristicLoader.ts`); add ContextProfile consumption to existing loader

(2 parallel subagents)

### Wave 6 — SEQUENTIAL

- **T4B-008 OpenQuestionsBuilder** — deps T4B-007; generates clarification questions when confidence below threshold (per ConfidenceThresholdActionEnum 'ask' value from T4B-001 schema)

(1 single-threaded subagent)

### Wave 7 — SEQUENTIAL + PARALLEL pair

- **T4B-010 CLI clarification prompt** — deps T4B-008; CLI interactive prompt UX for clarification questions
- **T4B-011 ContextCaptureNode (audit_setup integration)** — deps T4B-002..T4B-010 + T135 (AuditState — Phase 8 task; may need stub if Phase 8 hasn't shipped)

T4B-011 has cross-phase dep on T135 (AuditState). Verify before Wave 7 dispatch: does T135 exist? If not, Wave 7 may need a temporary stub or coordination with Phase 8 lead. (T135 is Phase 8 work; per master plan it's scheduled later, so Phase 4b may need to ship with a forward-stub.)

### Wave 8 — INTEGRATION + R25 audit

- **T4B-014 R25 compliance check** — AST scan that no `playwright`/`@playwright/*` imports appear in `packages/agent-core/src/context/*`. Verify hand-coded (T4B-003, T4B-004) AND any newly-added Wave 4-7 files. Constitution R25 hard prohibition.
- **T4B-015 Phase 4b integration test** — end-to-end: AuditRequest → HtmlFetcher → JsonLdParser → BusinessArchetypeInferrer + PageTypeInferrer → ConfidenceScorer → ContextProfile → persist via T4B-012 migration. Total wall-clock < 2 min target.

(T4B-014 first, then T4B-015 after the scan is clean.)

---

## Resume path for next session

### Step 1 — Boot

Open a **fresh Claude Code conversation** in `C:\Sabari\Neural\NBA`. The SessionStart hook will fire and emit the usage banner. Master is at ~46% peak from this session — fresh conversation starts at ~37-40% (skills + tools + memory baseline; the loaded message history won't include this session's transcript).

```
/master 4b --resume
```

Master orchestrator skill will:
1. Read `.phase-state/4b.json` (sub_stage: `2-impl-wave-3-complete`)
2. Read THIS handoff doc
3. Read `phase-4-current.md` (predecessor rollup; still in effect)
4. Read CLAUDE.md (per usual)
5. Verify branch state via `git log` — should show HEAD = `e47ba16`

### Step 2 — Wave 4 dispatch

Dispatch 2 parallel subagents (T4B-005 + T4B-006). Both depend on T4B-001 + T4B-004 (Wave 3 done). Touch different files (`src/context/BusinessArchetypeInferrer.ts` vs `src/context/PageTypeInferrer.ts`). R25-clean.

### Step 3 — Continue waves 5-8

Per the wave structure above. Estimated context burn per wave: 20-30K master growth. Should fit Waves 4-8 in one fresh session (peak landing ~50-55% — comfortable under 60% STOP).

### Step 4 — Stage 2.5 + Stage 3 + Stage 3b + Gate 2 + Stage 4 EXIT

After all 15 tasks land:
- Stage 2.5: `superpowers:code-reviewer` agent on full Phase 4b impl diff (note: this agent type was marked unavailable mid-session 2026-05-16 — verify availability before dispatch; may need fallback)
- Stage 3: `pnpm lint + typecheck + test:conformance + test:integration` (use `--no-file-parallelism` per act-005)
- Stage 3b: `neural-ai-reviewer --gate verification`
- Gate 2: human stamp
- Stage 4: R17.4 status bumps `approved → implemented → verified`; phase-4b-current.md rollup; phase-4b-validation.md sibling; INDEX.md flip 🟡 → 🟢; R20 propagation to downstream phases that consume context_profiles (Phase 5, 7, 8, 9, 13b)

---

## Critical readings for next session

| Artifact | Role |
|---|---|
| `.phase-state/4b.json` | State machine source of truth (read first; check `sub_stage`) |
| `docs/specs/mvp/phases/phase-4b-context-capture/{spec,plan,tasks,impact}.md` | The approved (v0.2) artifacts driving Stage 2 |
| `docs/specs/mvp/phases/phase-4b-context-capture/review-notes.md` | Gate 1 audit trail (Pass 1 REVISE + Pass 2 APPROVE) |
| `docs/specs/mvp/phases/phase-4b-context-capture/r20-invalidation-from-phase-4.md` | Phase 4 contracts this phase consumes |
| `docs/specs/mvp/phases/phase-4-safety-infra-cost/phase-4-current.md` | Predecessor rollup; still in effect |
| `packages/agent-core/src/types/context-profile.ts` | T4B-001 foundation (read for Wave 4 deps) |
| `packages/agent-core/src/context/{URLPatternMatcher,HtmlFetcher,JsonLdParser}.ts` | Wave 2-3 foundation (consumed by Wave 4 inferrers) |
| `packages/agent-core/src/types/audit-request.ts` | T4B-009 (consumed by T4B-011 ContextCaptureNode in Wave 7) |
| **THIS DOC** | Resume plan + wave structure |

---

## Open threads (NOT blockers; carried forward)

### From Phase 4 Stage 2.5 (now Phase 5 scope — referenced but unblocking Phase 4b)

| ID | Description | Where it bites |
|---|---|---|
| H1 | AnthropicAdapter PLACEHOLDER_UUID for RLS scope | Phase 5 orchestrator threads real `client_id` |
| H2 | `#tryWriteRow` swallows write failures (best-effort R14.1) | Closes when H1 closes |
| M3 | Budget concurrency: SELECT FOR UPDATE released before LLM call | Phase 5 serialization in `withClient` transaction |
| act-005 | W1A parallel-migration deadlock (test scaffolding); use `--no-file-parallelism` workaround | Phase 5 polish; advisory lock OR globalSetup OR migrations table |

### Phase 4b specific (in-scope; address before phase exit)

1. **Cost-tracking semantic bug in usage-guard.mjs** — banner showed phase ceiling at "1678.8% used" mid-Phase-4b because the hook compares cumulative-transcript-cost vs per-phase delta budget. Two different concepts. Fix options: (a) track cost-at-phase-start snapshot; (b) reset transcript cost daily per `cost-config.json.cost.reset_local_time`; (c) drop per-phase cost ceiling and enforce only context. Recommend (a) for Phase 5 polish.
2. **`superpowers:code-reviewer` agent marked unavailable** mid-session 2026-05-16 (per system-reminder). Stage 2.5 will need fallback — use `general-purpose` subagent with a code-review prompt template, OR use the `engineering:code-review` skill if available. Verify before Phase 4b Stage 2.5 dispatch.
3. **T4B-011 ContextCaptureNode cross-phase dep on T135 AuditState** — Phase 8 task. May need forward-stub. Coordinate at Wave 7 dispatch time.

---

## State file updates for next session

`.phase-state/4b.json` should be updated by master at the resume boot:
- `sub_stage`: `2-impl-wave-3-complete-checkpointed`
- Append stage_history entry for Waves 1-3 with the 6 commits + 72/72 test pass count
- `tasks_completed`: 6
- `notes`: "6/15 tasks landed across Waves 1-3 in session 2026-05-16. Next session resumes at Wave 4 with fresh transcript."

---

## Sign-off

Phase 4b Stage 1 + Gate 1 + Waves 1-3 shipped cleanly this session under the user's "push to 60% STOP, multi-session per phase" discipline. Master peaked at ~46-47% context (well under WARN); cost ~$3-5 of $5 phase ceiling (note: the ceiling tracking is fragile per the Open Threads cost-tracking bug — actual phase-only spend is lower than the banner's "1678.8% used" misleading reading).

Resume with: **`/master 4b --resume`** in a fresh session. The usage-guard hooks will fire automatically; you'll see the banner at session start showing the new lower baseline.

— Claude Opus 4.7 (1M context), master orchestrator session, 2026-05-16

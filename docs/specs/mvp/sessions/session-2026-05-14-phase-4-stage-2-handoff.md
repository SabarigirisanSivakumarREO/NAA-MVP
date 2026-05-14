# Phase 4 — Stage 2 Implementation Handoff (Session 19 → Session 20)

**Date checkpointed:** 2026-05-14
**Checkpointed by:** Claude (master orchestrator session 19)
**Resume command:** `/master 4 --resume`
**Branch:** `feat/phase-4-safety-infra-cost`
**Latest commit at checkpoint:** `fcb1708`

---

## Where we are

Phase 4 Gate 1 cleared. All 4 spec artifacts at `status: approved`. Stage 2 (Implementation) not yet started.

### Stage 1 + Gate 1 timeline (this session)

| Commit | Stage | Notes |
|---|---|---|
| `2506ff1` | (pre-Phase-4 master HEAD) | Phase 3 rollup + NEURAL_OVERVIEW |
| — | boot | `.phase-state/4.json` initialized; branch cut at 2506ff1 |
| — | stage-1 pre-flight Pass 1 | analyze + matrix + 3-sub-audit reviewer → REVISE (11 findings) |
| `66cbc7a` | gate-1 patch wave | 10-action patch wave (spec→v0.4, plan→v0.3, tasks→v0.4, impact→v0.2) |
| — | stage-1 pre-flight Pass 2 | matrix re-run + closure verification → APPROVE (0 blocking findings) |
| `477416b` | gate-1 APPROVED — R17 status bump (spec + impact + review-notes) | first half of bump commit |
| `fcb1708` | gate-1 APPROVED — R17 status bump (plan + tasks) | follow-up for stale-read race |

### Cost + context budget at checkpoint

- **Spend:** ~$1.60 / $30 phase ceiling (high-attention 50% cap active). Ceiling remaining: $28.40.
- **Wall-clock:** ~75 min for boot + Stage 1 + Gate 1 + R17 bump.
- **Context budget:** ~65% — near 70% checkpoint threshold per master orchestrator [`references/context-budget.md`](../../../.claude/skills/neural-master-orchestrator/references/context-budget.md).

---

## What Stage 2 will do (the plan)

**Goal:** Implement 13 MVP tasks (T066-T076 + T080 + T080a) across 3 pillars. Author all conformance tests FIRST per R3.1 TDD.

### Execution waves (from tasks.md Phase 3 + Implementation Strategy)

```
Wave 1 [SETUP, 3 parallel subagents]
├── T-PHASE4-TESTS (author 17 conformance tests + integration test, all RED)
├── T-PHASE4-LOGGER (extend observability/logger.ts with 6 new correlation fields)
└── T-PHASE4-TYPES (author types/llm.ts LLMCallRecord + types/audit-events.ts 22-type enum)

Wave 2 [FOUNDATION, single-threaded]
└── T070 (Drizzle schema — 10 base + 5 extension = 15 tables; RLS on 10; append-only triggers on 5; context_profiles slot reservation per AC-17)

Wave 3 [PARALLEL BATCH A, 3 subagents under high-attention cap]
├── T066 (ActionClassifier)
├── T071 (AuditLogger)
└── T074 (StorageAdapter + PostgresStorage)

Wave 4 [SEQUENTIAL, 2 subagents]
├── T067 (SafetyCheck) ← depends on T066+T068+T069+T072
└── T072 (SessionRecorder) ← depends on T070+T074+T-PHASE4-TYPES

Wave 5 [PARALLEL BATCH B, 3 subagents — split cap=3 around the 4 items]
├── T068 (DomainPolicy)
├── T069 (CircuitBreaker)
├── T076 (StreamEmitter)
└── T075 (ScreenshotStorage + LocalDiskStorage) — wait or replace one

Wave 6 [CORNERSTONE, single-threaded, full review surface]
└── T073 (LLMAdapter + AnthropicAdapter + TemperatureGuard + BudgetGate + ESLint rule)
    KILL CRITERIA EXTENDED — see tasks.md T073 brief

Wave 7 [SAFETY UTILITY + INTEGRATION]
├── T080a (RobotsChecker — per AC-16 in-memory Map cache + audit_completed cleanup)
└── T080 (Phase 4 integration test ← depends on T066-T076 + T080a)

Wave 8 [POLISH]
├── T-PHASE4-DOC (README dev quickstart)
├── T-PHASE4-ADAPTERS-README (adapters/README.md list)
└── T-PHASE4-ROLLUP (phase-4-current.md authored at Stage 4)
```

### High-attention adjustments (already in state file)

- **Parallel fan-out cap: 3** (not the typical 9 — applies to Waves 3 + 5)
- **Per-phase cost ceiling: $30** (50% of default $60)
- **AI Reviewer two-pass critic: mandatory** (no skip at any gate)
- **User availability flag: set** (pause for ad-hoc check-ins on T070 + T073)
- **Verbose logging mode: on**

### Critical kill criteria (R23)

Default kill criteria + per-task extensions on:
- **T070:** RLS bypass detected; append-only UPDATE/DELETE succeeds; migration non-idempotent; Drizzle/SQL shape drift → STOP
- **T073:** TemperatureGuard bypass; LLM call without llm_call_log row; failover retry-count wrong; @anthropic-ai/sdk imported outside AnthropicAdapter.ts; budget race condition → STOP
- **T080a:** UA spoofing of crawlers reaches network layer → STOP

---

## What Session 20 (fresh session) should do on resume

### Step 1 — Boot

```
/master 4 --resume
```

Master orchestrator skill will:
1. Read `.phase-state/4.json` (reconcile vs git HEAD)
2. Detect `current_stage: gate-1-pass-2-approved-checkpointed-for-stage-2` (or equivalent — see state file)
3. Verify Pass 2 verdict APPROVE recorded
4. Verify R17 status bumps landed (4 artifacts approved)
5. Read THIS handoff doc
6. Read Phase 3 rollup (still in effect)
7. Read CLAUDE.md (per usual)

### Step 2 — Stage 2 dispatch

Master will:
1. Invoke `/speckit.implement` which triggers `before_implement` hook (`neural-dev-workflow-brief`) — emits phase brief + kill criteria + R17.4 verification gate
2. Build dispatch plan per the Wave structure above
3. Launch Wave 1 (3 parallel subagents — SETUP wave)
4. Per-subagent brief includes: target file paths, AC IDs, file-size caps, kill criteria, R18 delta discipline, NO heuristic content (R6)

### Step 3 — Watch for failure modes

Per master SKILL.md "Failure modes":
- Subagent diff fails forbidden-pattern check 3× → escalate
- R20 cross-phase invalidation (Phase 4 IS the largest R20 source — 19 shared contracts; downstream Phase 5/7/8/9 pre-flights auto-invalidated when Phase 4 exits)
- Cost ceiling hit (remember reduced ceiling = $30) → pause
- User can `/master 4 --abort` to roll back; WIP snapshotted to `.phase-state/4/abort-snapshot/`

---

## Key artifacts for Session 20 to consult

| Artifact | Role |
|---|---|
| `.phase-state/4.json` | State machine source of truth (resume from `current_stage`) |
| `.phase-state/4/preflight-correctness.json` | Pass 1 findings + closure metadata |
| `.phase-state/4/preflight-coverage.json` | Matrix output (17 ACs declared; tests land in Wave 1) |
| `.phase-state/4/preflight-verdict.yaml` | Pass 1 REVISE verdict (audit trail) |
| `.phase-state/4/preflight-verdict-pass2.yaml` | Pass 2 APPROVE verdict (R17.4 gate justification) |
| `docs/specs/mvp/phases/phase-4-safety-infra-cost/review-notes.md` | Human-readable Gate 1 audit trail (Pass 2 final) |
| `docs/specs/mvp/phases/phase-4-safety-infra-cost/{spec,plan,tasks,impact}.md` | The approved artifacts driving Stage 2 |
| `docs/specs/mvp/phases/phase-3-verification/phase-3-current.md` | Predecessor rollup (Phase 3 contracts still active in effect) |
| `docs/specs/final-architecture/{11-safety-cost,13-data-layer,34-observability}.md` | Authoritative architecture refs (cited by spec) |
| THIS DOC | Stage 2 dispatch plan + waves + kill criteria summary |

---

## What the Stage 2 subagent briefs must include

Per master orchestrator skill artifact #4 (subagent brief template):

```
## Outcome
- Files to create/modify
- AC IDs covered
- Acceptance test commands

## Constraints (from CLAUDE.md §5 + R-NN)
- File ≤ 300 lines / function ≤ 50 lines (R10)
- Zod schemas BEFORE implementation (every external boundary)
- Pino with correlation fields (R14)
- No `any` without TODO+issue (R2.1)
- Named exports only (R10)
- R3.1 TDD — tests fail RED first

## Phase-4-specific constraints
- @anthropic-ai/sdk only in AnthropicAdapter.ts (R9 + ESLint)
- pg + drizzle-orm only in PostgresStorage.ts + db/ internals (R9 + ESLint)
- Temperature > 0 forbidden on evaluate/self_critique/evaluate_interactive (R10 / TemperatureGuard)
- Every LLM call → atomic llm_call_log row BEFORE return (R14.1)
- 22 audit_event types per tasks.md T-PHASE4-TYPES inline enumeration (lock per impact.md:281)
- Append-only triggers on 5 tables; RLS on 10 client-scoped tables

## Kill criteria (R23)
- Default block (see tasks.md L92-117)
- Plus per-task extensions for T070 / T073 / T080a

## Forbidden
- `console.log` (R10.6 — use Pino)
- Heuristic content in any output (R6)
- Direct vendor SDK imports outside adapter files (R9)
- T077-T079 implementation attempts (reserved)
```

---

## On Stage 2 exit (after T080 integration test green + Stage 2.5 code review + Stage 3 verification)

Master will pause at **Gate 2** for human stamp. Master orchestrator skill drives:
- Stage 2.5 → `superpowers:code-reviewer` agent on full impl diff
- Stage 3 → `pnpm lint + typecheck + test + test:conformance + test:integration` + failure classification
- Stage 3b → `neural-ai-reviewer --gate verification` (3 sub-audits again)
- 🚦 Gate 2 → human stamp APPROVE or RETURN-TO-IMPL
- On APPROVE → Stage 4 exit (R17.4 bump approved → implemented → verified; phase-4-current.md rollup; phase-4-validation.md trust artifact; INDEX.md flip; R20 cross-phase propagation)

---

## Session 19 sign-off

Phase 4 Gate 1 is cleared. The 10-action patch wave (commit 66cbc7a) closed the F-01 CRITICAL migration defect that would have caused trigger creation to fail at Stage 2, plus 10 other spec defects.

Stage 2 implementation is the highest-density implementation slice in MVP (18 shared contracts now → 19 with RobotsChecker; 15-table DB schema; first LLM contact). High-attention mode discipline applies: parallel cap of 3; user availability for ad-hoc check-ins on T070 + T073; verbose logging.

Resume with: `/master 4 --resume` in a fresh session.

— Claude Opus 4.7 (1M context), master orchestrator session 19, 2026-05-14

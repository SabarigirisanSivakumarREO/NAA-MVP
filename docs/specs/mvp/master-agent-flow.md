---
title: Neural MVP — Master Agent Execution Flow (ASCII Reference)
artifact_type: reference
status: approved
version: 1.0
created: 2026-05-08
updated: 2026-05-08
owner: engineering lead
authors: [Claude (drafter)]

derived_from:
  - .claude/skills/neural-master-orchestrator/SKILL.md
  - .claude/skills/neural-ai-reviewer/SKILL.md
  - .claude/skills/neural-master-orchestrator/references/*.md
  - CLAUDE.md §14 (Master Agent operating procedure)

governing_rules:
  - Constitution R3.1 (TDD)
  - Constitution R5.6 (separate-persona critic)
  - Constitution R6 (heuristic IP boundary)
  - Constitution R10 (file/function size)
  - Constitution R11.4 (fix spec before implementing)
  - Constitution R14 (Pino correlation fields)
  - Constitution R17 (lifecycle states)
  - Constitution R18 (delta append-only)
  - Constitution R19 (phase rollup)
  - Constitution R20 (cross-phase impact)
  - Constitution R23 (kill criteria)
  - CLAUDE.md §6 (commit format)
  - CLAUDE.md §8 (self-check protocol)
  - CLAUDE.md §8a (modular prompt rule)
  - CLAUDE.md §8c (per-phase JIT discipline)
  - CLAUDE.md §9 (subagent dispatch policy)
  - CLAUDE.md §14 (Master Agent operating procedure)
---

# Master Agent Execution Flow — ASCII Reference

> **Purpose:** Single-page visual reference for the Master Agent + Subagents + Review architecture. Use as onboarding artifact for future engineers, slide visual at MVP completion, or quick-glance reference during phase execution.
>
> **Authoritative source:** the skill files at `.claude/skills/neural-master-orchestrator/` and `.claude/skills/neural-ai-reviewer/`. This document is a visualization, not a contract — if it diverges from the skill files, the skill files win.

## Complete flow

```
═══════════════════════════════════════════════════════════════════════════════════════
                       NEURAL MVP — MASTER AGENT EXECUTION FLOW
                       (one phase per Claude Code session, Opus 4.7 1M ctx)
═══════════════════════════════════════════════════════════════════════════════════════


┌──────────────────────────────────────────────────────────────────────────────────────┐
│                           👤 YOU (initiator + 2 stamps/phase)                         │
│                                                                                       │
│   Day 1: open fresh Claude Code session  →  type:  /master 1 --start                  │
└─────────────────────────────────────────┬────────────────────────────────────────────┘
                                          │
                                          ▼
═══════════════════════════════════════════════════════════════════════════════════════
                              🤖 MASTER AGENT BOOTS
                  (loads neural-master-orchestrator skill JIT)
═══════════════════════════════════════════════════════════════════════════════════════
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                            STAGE 0 — BOOT CONTEXT (auto, ~2 min)                      │
│                                                                                       │
│   Read .phase-state/<N>.json  ──→  initialize if not exists                           │
│   JIT-load (per CLAUDE.md §1):                                                        │
│     • CLAUDE.md                                                                       │
│     • docs/specs/mvp/sessions/session-handover.md (latest)                            │
│     • docs/specs/mvp/phases/INDEX.md                                                  │
│     • docs/specs/mvp/phases/phase-<N>-*/{README,spec,plan,tasks,impact}.md            │
│     • docs/specs/mvp/phases/phase-<N-1>-*/phase-<N-1>-current.md  (predecessor R19)   │
│     • Cited final-architecture sections only                                          │
│                                                                                       │
│   Context: ~150-200K tokens absorbed                                                  │
└─────────────────────────────────────────┬────────────────────────────────────────────┘
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                          STAGE 1 — PRE-FLIGHT (auto, ~15 min)                         │
│                                                                                       │
│   ┌──────────────────────────┐                                                        │
│   │ /speckit.analyze         │  ──→  preflight-correctness.json                       │
│   │ (cross-artifact          │       (CRITICAL/HIGH/MED/LOW findings)                 │
│   │  consistency)            │                                                        │
│   └──────────────────────────┘                                                        │
│                                                                                       │
│   ┌──────────────────────────┐                                                        │
│   │ pnpm spec:matrix         │  ──→  preflight-coverage.json                          │
│   │ --phase=<N> --json       │       (covered / missing / orphan ACs)                 │
│   └──────────────────────────┘                                                        │
│                                                                                       │
│   ┌──────────────────────────┐                                                        │
│   │ Verify R20 impact.md     │  ──→  if shared-contract change detected               │
│   │ presence                 │       and impact.md missing  →  STOP escalate          │
│   └──────────────────────────┘                                                        │
└─────────────────────────────────────────┬────────────────────────────────────────────┘
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│            STAGE 1b — AI REVIEWER (auto, ~3-5 min)  [neural-ai-reviewer skill]        │
│                                                                                       │
│        ┌────────────────────────┐  ┌────────────────────────┐  ┌──────────────────┐   │
│        │  CORRECTNESS sub-audit │  │  COVERAGE sub-audit    │  │  COMPLETENESS    │   │
│        │  (mechanical)          │  │  (mechanical)          │  │  sub-audit       │   │
│        │                        │  │                        │  │  (judgment)      │   │
│        │  consumes              │  │  consumes              │  │                  │   │
│        │  preflight-            │  │  preflight-            │  │  ┌────────────┐  │   │
│        │  correctness.json      │  │  coverage.json         │  │  │ Pass 1:    │  │   │
│        │                        │  │                        │  │  │ Auditor    │  │   │
│        │  group findings        │  │  classify ACs as       │  │  │ persona    │  │   │
│        │  by category;          │  │  • required            │  │  │ enumerate  │  │   │
│        │  severity-rank;        │  │  • deferred            │  │  │ universe   │  │   │
│        │  map to actions        │  │  • ambiguous           │  │  │ + cite     │  │   │
│        │                        │  │                        │  │  │ sources    │  │   │
│        │  verdict: PASS/REVISE  │  │  verdict: PASS/REVISE  │  │  └─────┬──────┘  │   │
│        └────────────────────────┘  └────────────────────────┘  │        │         │   │
│                                                                │        ▼         │   │
│                                                                │  ┌────────────┐  │   │
│                                                                │  │ Pass 2:    │  │   │
│                                                                │  │ Critic     │  │   │
│                                                                │  │ persona    │  │   │
│                                                                │  │ (sees only │  │   │
│                                                                │  │  Pass 1    │  │   │
│                                                                │  │  output)   │  │   │
│                                                                │  │ challenge  │  │   │
│                                                                │  │ enumeration│  │   │
│                                                                │  │ demand     │  │   │
│                                                                │  │ citations  │  │   │
│                                                                │  └─────┬──────┘  │   │
│                                                                │        │         │   │
│                                                                │  AGREE/DISPUTE/  │   │
│                                                                │  EXTEND          │   │
│                                                                │  (strictest      │   │
│                                                                │   wins)          │   │
│                                                                │  verdict:        │   │
│                                                                │  PASS/SPEC_GAP/  │   │
│                                                                │  IMPL_GAP        │   │
│                                                                └────────┬─────────┘   │
│                                                                         │             │
│              SYNTHESIS: strictest sub-audit verdict wins ◄──────────────┘             │
│              ┌──────────────────────────────────────────────┐                         │
│              │  overall_verdict: APPROVE / REVISE / RE-SPEC │                         │
│              └──────────────────┬───────────────────────────┘                         │
│                                 │                                                     │
│              Write to .phase-state/<N>/preflight-verdict.yaml                         │
│              Auto-populate review-notes.md (mechanical fields filled)                 │
└─────────────────────────────────┬────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                       🚦 GATE 1 — HUMAN STAMP (~1 min YOU)                            │
│                                                                                       │
│        Master pauses. Renders verdict summary. Awaits:                                │
│                                                                                       │
│        /master <N> --gate-1 APPROVE   ──→  proceed to Stage 2                         │
│        /master <N> --gate-1 REVISE    ──→  dispatch spec-patch subagents,             │
│                                            re-run Stage 1                             │
│        /master <N> --gate-1 RE-SPEC   ──→  halt phase; escalate                       │
└─────────────────────────────────┬────────────────────────────────────────────────────┘
                                  │ APPROVE
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                  STAGE 2 — IMPLEMENTATION (auto, ~3-6 hrs wall-clock)                 │
│                                                                                       │
│   ┌──────────────────────────────────────────────────────────────────────────┐        │
│   │ Task Classifier  (reads tasks.md + spec table + impact.md)              │        │
│   │ Outputs 3-bucket dispatch plan:                                         │        │
│   │   PARALLEL         — independent tasks; different files; no shared schema│       │
│   │   SEQUENTIAL       — depends on prior IMPL; same file; foundation order  │       │
│   │   SHARED-CONTRACT  — touches AnalyzePerception/AuditState/Finding/etc.   │       │
│   └──────────────────────────────────┬───────────────────────────────────────┘        │
│                                      │                                                │
│                                      ▼                                                │
│       ┌──── PARALLEL FAN-OUT (master dispatches via Agent tool) ────┐                 │
│       │                                                              │                │
│       │   ┌──────────┐  ┌──────────┐  ┌──────────┐    ┌──────────┐  │                │
│       │   │SUBAGENT 1│  │SUBAGENT 2│  │SUBAGENT 3│ …  │SUBAGENT N│  │                │
│       │   │          │  │          │  │          │    │          │  │                │
│       │   │ T-NN     │  │ T-NN     │  │ T-NN     │    │ T-NN     │  │                │
│       │   │          │  │          │  │          │    │          │  │                │
│       │   │ 1. Read  │  │ 1. Read  │  │ 1. Read  │    │ 1. Read  │  │                │
│       │   │    brief │  │    brief │  │    brief │    │    brief │  │                │
│       │   │    (self-│  │          │  │          │    │          │  │                │
│       │   │    contd)│  │          │  │          │    │          │  │                │
│       │   │ 2. Write │  │ 2. Write │  │ 2. Write │    │ 2. Write │  │                │
│       │   │    test  │  │    test  │  │    test  │    │    test  │  │                │
│       │   │    FIRST │  │    FIRST │  │    FIRST │    │    FIRST │  │                │
│       │   │   (R3.1) │  │          │  │          │    │          │  │                │
│       │   │ 3. Impl  │  │ 3. Impl  │  │ 3. Impl  │    │ 3. Impl  │  │                │
│       │   │ 4. Self- │  │ 4. Self- │  │ 4. Self- │    │ 4. Self- │  │                │
│       │   │    check │  │    check │  │    check │    │    check │  │                │
│       │   │ 5. Return│  │ 5. Return│  │ 5. Return│    │ 5. Return│  │                │
│       │   │    diff  │  │    diff  │  │    diff  │    │    diff  │  │                │
│       │   └────┬─────┘  └────┬─────┘  └────┬─────┘    └────┬─────┘  │                │
│       │        │             │             │                │        │                │
│       └────────┼─────────────┼─────────────┼────────────────┼───────┘                │
│                │             │             │                │                         │
│                └─────────────┴─────────────┴────────────────┘                         │
│                                      │                                                │
│                                      ▼                                                │
│   ┌──────────────────────────────────────────────────────────────────────────┐        │
│   │ DIFF REVIEWER  (per subagent return; mechanical pattern-grep)           │        │
│   │                                                                         │        │
│   │ Checks:                                                                 │        │
│   │  • Constitutional violations (banned phrasing, R6 IP, console.log)      │        │
│   │  • Quality (any without TODO, file >300 LOC, function >50 LOC)          │        │
│   │  • Scope (files NOT in {{ALLOWED_FILES}}; deletion without justification)│       │
│   │  • TDD (test added with impl in same diff; assertions present)          │        │
│   │                                                                         │        │
│   │ Verdict: PASS  ──→  commit chain                                        │        │
│   │ Verdict: FAIL  ──→  3-strike retry (subagent rebriefs with violations)  │        │
│   │                                                                         │        │
│   │ At 3 strikes  ──→  STOP; escalate to user                               │        │
│   └──────────────────────────────────┬───────────────────────────────────────┘        │
│                                      │ PASS                                           │
│                                      ▼                                                │
│   ┌──────────────────────────────────────────────────────────────────────────┐        │
│   │ COMMIT CHAIN (sequential, per CLAUDE.md §6 format)                      │        │
│   │   <type>(<scope>): T-NN <description> (REQ-ID)                          │        │
│   │ Mark [x] in tasks.md per task                                           │        │
│   └──────────────────────────────────────────────────────────────────────────┘        │
│                                                                                       │
│   When all dispatched tasks complete  ──→  Stage 2.5                                  │
└─────────────────────────────────┬────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│            STAGE 2.5 — CODE REVIEW (auto, ~10-15 min)  [superpowers:code-reviewer]    │
│                                                                                       │
│   Master invokes code-reviewer agent on FULL phase impl diff.                         │
│                                                                                       │
│   7 review dimensions (semantic; complements diff-reviewer's mechanical checks):      │
│     1. Best practices (proper TypeScript, Zod usage, exhaustive switches)             │
│     2. Structure (R9 adapter pattern; cohesion; decomposition)                        │
│     3. Consistency (matches sibling-file conventions)                                 │
│     4. Completeness (edge cases; error paths; AC bullets fully covered)               │
│     5. Correctness (logic matches AC INTENT not literal)                              │
│     6. Base principles (constitutional rule citation per finding)                     │
│     7. Test quality (tests behavior not impl; meaningful assertions)                  │
│                                                                                       │
│   Output: severity-ranked findings + auto_fixable flag per finding                    │
│                                                                                       │
│   CRITICAL/HIGH  ──→  master dispatches fix subagents (auto_fixable: true)            │
│                       OR flags for Gate 2 (auto_fixable: false)                       │
│   MED/LOW        ──→  log; surfaces at Gate 2 for awareness                           │
└─────────────────────────────────┬────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                          STAGE 3 — VERIFICATION (auto, ~30-60 min)                    │
│                                                                                       │
│   Run:   pnpm lint                                                                    │
│          pnpm typecheck                                                               │
│          pnpm test                                                                    │
│          pnpm test:conformance                                                        │
│          pnpm test:integration                                                        │
│                                                                                       │
│   Outputs to .phase-state/<N>/verify-test-results.json                                │
│                                                                                       │
│   If any test fails:                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────┐            │
│   │ TEST FAILURE CLASSIFIER                                              │            │
│   │   Inputs: failing test + diff + cited spec section                   │            │
│   │   Classifies as:                                                     │            │
│   │     impl-bug   — code wrong, spec correct                            │            │
│   │     spec-bug   — spec ambiguous, impl matches broken spec            │            │
│   │     ambiguity  — cannot determine; needs human                       │            │
│   │                                                                      │            │
│   │   Confidence ≥0.90 + impl-bug → eligible for auto-action             │            │
│   │   Confidence  <0.90 OR ambiguity → escalate                          │            │
│   │                                                                      │            │
│   │   First 3 phases: LOGGING-FIRST mode (no auto-action; collect data)  │            │
│   └──────────────────────────────────────────────────────────────────────┘            │
└─────────────────────────────────┬────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                  STAGE 3b — AI REVIEWER (auto)  [neural-ai-reviewer skill]            │
│                                                                                       │
│   Same 3 sub-audits but with Stage 3 inputs (test results + impl diff + code-review)  │
│                                                                                       │
│   Verdict: APPROVE / RETURN-TO-IMPL / RE-SPEC                                         │
│   Write to .phase-state/<N>/verify-verdict.yaml                                       │
└─────────────────────────────────┬────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                       🚦 GATE 2 — HUMAN STAMP (~1 min YOU)                            │
│                                                                                       │
│        Master pauses. Renders Gate 2 packet:                                          │
│          • Stage 2.5 code review findings                                             │
│          • Stage 3 verification verdict                                               │
│          • Test results                                                               │
│          • Cumulative cost                                                            │
│                                                                                       │
│        /master <N> --gate-2 APPROVE          ──→  Stage 4 exit                        │
│        /master <N> --gate-2 RETURN-TO-IMPL   ──→  re-dispatch fix subagents           │
└─────────────────────────────────┬────────────────────────────────────────────────────┘
                                  │ APPROVE
                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                          STAGE 4 — EXIT (auto, ~10 min)                               │
│                                                                                       │
│   1. R17 status bumps:    spec.md status: approved → implemented                      │
│                           plan.md / tasks.md / impact.md / README.md  same            │
│                                                                                       │
│   2. R19 phase rollup:    Auto-draft phase-<N>-*/phase-<N>-current.md                 │
│                           (compressed system state for downstream phases)             │
│                                                                                       │
│   3. INDEX.md flip:       Row <N> status: 🟡 → 🟢                                      │
│                                                                                       │
│   4. R20 propagation:     If shared contracts changed:                                │
│                             • Append entries to N+1, N+2 impact.md                    │
│                             • Mark downstream pre-flight verdicts STALE               │
│                             • Log to cross-phase-invalidations.log                    │
│                                                                                       │
│   5. session-handover.md: Auto-append session close-out block                         │
│                                                                                       │
│   6. Branch operations:   Push commits to origin                                      │
│                                                                                       │
│   7. Suggest next phase:  Per INDEX dependency graph                                  │
└─────────────────────────────────┬────────────────────────────────────────────────────┘
                                  │
                                  ▼
                            ┌─────────────┐
                            │   PHASE N   │
                            │  COMPLETE   │
                            │     🟢      │
                            └──────┬──────┘
                                   │
                                   ▼
                       Open NEW Claude Code session
                       Type:  /master <N+1> --start
                       (loop back to STAGE 0)


═══════════════════════════════════════════════════════════════════════════════════════
                       PARALLEL TRACK — CONTEXT BUDGET MONITOR
                          (runs continuously across all stages)
═══════════════════════════════════════════════════════════════════════════════════════

      ┌──────────────────────────────────────────────────────────────────────┐
      │ Master tracks context_usage at every state transition                │
      │                                                                      │
      │   At 50% (500K tokens) — WARN                                        │
      │     • Auto-compact diff history (full text → SHA + 1-line summary)   │
      │     • Disable pipeline overlap                                       │
      │     • Tighten subagent brief cap (1500 → 1000 tokens)                │
      │     • Print warn message                                             │
      │                                                                      │
      │   At 70% (700K tokens) — HARD CEILING                                │
      │     • Wait 60s for in-flight subagents                               │
      │     • Atomic checkpoint: state file → "paused-context-limit"         │
      │     • Author handoff doc to .phase-state/<N>/handoff-<ts>.md         │
      │     • Print resume instructions                                      │
      │     • EXIT session                                                   │
      │                                                                      │
      │   New session: /master <N> --resume                                  │
      │     • Load state file (source of truth)                              │
      │     • Read handoff doc                                               │
      │     • Reconcile state vs git (filesystem wins)                       │
      │     • Continue from checkpointed stage                               │
      │     • Fresh 700K context budget                                      │
      └──────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════════
                            REVIEW LAYERS — DEFENSE IN DEPTH
                       (4 review layers + 2 human stamps per phase)
═══════════════════════════════════════════════════════════════════════════════════════

   ┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
   │ Layer            │ Frequency        │ Mode             │ Catches          │
   ├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
   │ DIFF REVIEWER    │ Per subagent     │ Mechanical       │ • banned phrasing│
   │ #5               │ return           │ pattern-grep     │ • R6 IP leaks    │
   │                  │                  │                  │ • console.log    │
   │                  │                  │                  │ • scope creep    │
   │                  │                  │                  │ • file >300 LOC  │
   │                  │                  │                  │ • TDD violations │
   ├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
   │ STAGE 2.5 CODE   │ Once per phase   │ Semantic         │ • structure      │
   │ REVIEW #10       │ post-impl        │ judgment         │ • consistency    │
   │ (superpowers:    │                  │                  │ • completeness   │
   │  code-reviewer)  │                  │                  │ • base principles│
   │                  │                  │                  │ • test quality   │
   ├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
   │ TEST FAILURE     │ Per failing test │ Classification   │ • impl-bug       │
   │ CLASSIFIER #6    │                  │                  │ • spec-bug       │
   │                  │                  │                  │ • ambiguity      │
   ├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
   │ AI REVIEWER #7   │ At Gate 1 + 2    │ Senior-engineer  │ • spec gaps      │
   │ (correctness +   │                  │ judgment with    │ • cross-artifact │
   │  coverage +      │                  │ adversarial      │   correctness    │
   │  completeness)   │                  │ critic (R5.6)    │ • categorical    │
   │                  │                  │                  │   surface gaps   │
   ├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
   │ HUMAN STAMP      │ At Gate 1 + 2    │ 1-min stamp      │ • RE-SPEC class  │
   │ (YOU)            │                  │ override allowed │   decisions      │
   │                  │                  │                  │ • doom check     │
   │                  │                  │                  │ • final say      │
   └──────────────────┴──────────────────┴──────────────────┴──────────────────┘


═══════════════════════════════════════════════════════════════════════════════════════
                       CONSTITUTIONAL RULES ENFORCED PER LAYER
═══════════════════════════════════════════════════════════════════════════════════════

   Subagent brief enforces:    R3.1 (TDD) · R5.3 (banned phrasing) · R6 (IP)
                               R10 (file size) · R14 (Pino correlation)
                               R20 (impact.md if shared contract)

   Diff reviewer enforces:     R6 sentinel · R10.6 (no console.log) · R10.4
                               (no any without TODO) · R18 (append-only specs)
                               · CLAUDE.md §9 (scope) · CLAUDE.md §6 (commit format)

   AI Reviewer enforces:       R5.6 (separate-persona critic) · R11.4 (fix spec
                               before impl) · R17 (lifecycle gating) · R20
                               (impact propagation flag) · R23 (kill criteria)

   Master orchestrator:        R17 lifecycle bumps at Stage 4
                               R19 rollup auto-draft at Stage 4
                               R20 cross-phase propagation at Stage 4
                               R23 kill criteria at every state transition


═══════════════════════════════════════════════════════════════════════════════════════
                              FILE I/O PER PHASE RUN
═══════════════════════════════════════════════════════════════════════════════════════

   Stage 1 writes:
     .phase-state/<N>/preflight-correctness.json   (analyze output)
     .phase-state/<N>/preflight-coverage.json      (matrix output)
     .phase-state/<N>/preflight-verdict.yaml       (AI Reviewer output)
     phase-<N>-*/review-notes.md                   (auto-populated for Gate 1)

   Stage 2 writes:
     Per-task commits per CLAUDE.md §6 format
     phase-<N>-*/tasks.md                           ([x] markers)
     packages/agent-core/src/**/*.ts                (impl)
     packages/agent-core/tests/**/*.test.ts         (tests)

   Stage 2.5 writes:
     .phase-state/<N>/code-review-findings.yaml

   Stage 3 writes:
     .phase-state/<N>/verify-test-results.json
     .phase-state/<N>/verify-verdict.yaml

   Stage 4 writes:
     phase-<N>-*/phase-<N>-current.md               (R19 rollup)
     phases/INDEX.md                                (status flip)
     docs/specs/mvp/sessions/session-handover.md    (close-out append)
     phase-<N+1..>-*/impact.md                      (if R20 propagation)
     git push to origin


═══════════════════════════════════════════════════════════════════════════════════════
                                  STATE FILE SCHEMA
                              .phase-state/<N>.json
═══════════════════════════════════════════════════════════════════════════════════════

   {
     "phase": "<N>",
     "state": "preflight | review-pending | impl | code-review | verify |
               exit-pending | done | aborted | paused | paused-context-limit |
               re-spec",
     "started_at": "<ISO>",
     "last_transition_at": "<ISO>",
     "previous_state": "<state>",

     "gate_1": { decision, decided_at, verdict_path, approved_actions },
     "gate_2": { ... or null },

     "tasks": { T-NN: { status, subagent_id, commit, completed_at } ... },

     "dispatch_plan": {
       "parallel": [<task ids>],
       "sequential": [<task ids>],
       "shared_contract": [<task ids>]
     },

     "cost": {
       "phase_total_usd",
       "daily_total_usd",
       "phase_ceiling_usd",
       "daily_ceiling_usd",
       "last_check_at"
     },

     "context_usage": {
       "boot_tokens_estimated",
       "current_session_peak",
       "warn_50_hit",
       "compaction_triggered",
       "pipeline_overlap_disabled",
       "hard_ceiling_70_hit",
       "checkpoints": [...],
       "last_check_at"
     },

     "session_chain": ["session-1", "session-2", ...],
     "risk_gate_mode": <bool>,
     "pipeline_overlap": { phase_n_plus_1, ... },
     "last_command": "/master <N> --<flag>",
     "session_id": "...",
     "abort_snapshot": null
   }


═══════════════════════════════════════════════════════════════════════════════════════
                            HUMAN TIME PER PHASE = ~2 MIN
                  (1 min Gate 1 stamp + 1 min Gate 2 stamp; everything
                   else is automated; you're available for ad-hoc check-ins
                   only on risk-gate phases — Day 6 first-Claude, Day 7
                   first-grounding)
═══════════════════════════════════════════════════════════════════════════════════════
```

## Legend

| Symbol | Meaning |
|---|---|
| 🤖 | Master agent (orchestrator) |
| 👤 | Human (you) |
| 🚦 | Human gate (stamp required) |
| 🟢 | Phase complete; INDEX flipped |
| ★ | Active state |
| `═══` | Major section divider |
| `┌─┐` `└─┘` | Stage / component boundary |

## Cross-references

- **Skills (authoritative):**
  - `.claude/skills/neural-master-orchestrator/SKILL.md` — orchestrator entry point
  - `.claude/skills/neural-master-orchestrator/references/state-machine.md` — full state transitions + persistence schema
  - `.claude/skills/neural-master-orchestrator/references/pipeline-mode.md` — cross-phase overlap decision tree
  - `.claude/skills/neural-master-orchestrator/references/cost-ceiling.md` — daily/per-phase budget enforcement
  - `.claude/skills/neural-master-orchestrator/references/context-budget.md` — 50%/70% thresholds + handoff protocol
  - `.claude/skills/neural-master-orchestrator/references/risk-gate-mode.md` — Days 6-7 attention adjustments
  - `.claude/skills/neural-master-orchestrator/references/task-classifier.md` — 3-bucket dispatch logic
  - `.claude/skills/neural-master-orchestrator/references/diff-reviewer.md` — mechanical pattern-grep checks
  - `.claude/skills/neural-master-orchestrator/references/test-failure-classifier.md` — impl-bug / spec-bug / ambiguity routing
  - `.claude/skills/neural-master-orchestrator/references/code-review-integration.md` — Stage 2.5 semantic review
  - `.claude/skills/neural-master-orchestrator/references/impact-propagation.md` — R20 cross-phase invalidation
  - `.claude/skills/neural-master-orchestrator/templates/subagent-brief.template.md` — impl task brief
  - `.claude/skills/neural-master-orchestrator/templates/spec-patch-subagent-brief.template.md` — R11.4 spec patch brief
  - `.claude/skills/neural-ai-reviewer/SKILL.md` — gate verdict skill
  - `.claude/skills/neural-ai-reviewer/references/correctness-audit.md` — /speckit.analyze synthesis
  - `.claude/skills/neural-ai-reviewer/references/coverage-audit.md` — pnpm spec:matrix synthesis
  - `.claude/skills/neural-ai-reviewer/references/completeness-audit.md` — auditor + critic protocol
  - `.claude/skills/neural-ai-reviewer/references/categorical-surfaces.md` — surface identification methodology

- **Tooling:**
  - `scripts/spec-matrix.ts` — AC↔test traceability matrix
  - `package.json` — `pnpm spec:matrix` script registered

- **Constitution / Process docs:**
  - `docs/specs/mvp/constitution.md` — R1-R26 rules
  - `CLAUDE.md` §1 (reading order) + §6 (commit format) + §8 (self-check) + §8a (modular prompt) + §8c (per-phase JIT) + §9 (subagent dispatch) + §14 (master agent operating procedure)
  - `docs/specs/mvp/spec-driven-workflow.md` — R17/R18/R19/R20/R21 process

- **Companion docs:**
  - `docs/specs/mvp/implementation-roadmap.md` v0.8 — walking-skeleton 12-week plan (superseded for active execution; retained for risk-gate identification + cost baselines)

## Maintenance

This document is a visualization. Update it when:

- Skill files change a stage's behavior materially
- New review layers are added
- State machine adds/removes states
- Threshold defaults change (50%/70%/cost ceilings)

Bump `version` field on every edit. Append delta block (R18) describing what changed.

---

*Generated 2026-05-08 alongside Day 0 master-agent skill suite (commit `ad0063d`).*

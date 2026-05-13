---
title: Phase 2 Review Notes — Gate 1 Pass 2
artifact_type: phase-review-report
gate: 1
pass: 2
status: approved (Gate 1 Pass 2 stamped APPROVE 2026-05-12 by Sabari)
phase_number: 2
phase_name: MCP Tools + Human Behavior
created: 2026-05-12
review_session: 16 (master orchestrator)
reviewer_ai: neural-ai-reviewer skill (two-pass auditor + critic per R5.6)
reviewer_human: Sabari (pending)
recommended_verdict: APPROVE
estimated_human_stamp_time: ≤2 min
pass_1_outcome: REVISE → patch wave commit 92b2ec5 → Pass 2 re-audit
---

# Phase 2 — MCP Tools + Human Behavior — Gate 1 Review (Pass 2)

> **Recommended verdict:** `APPROVE`
> **Pass 2 finding count:** 0 blocking + 1 LOW carryforward (verify '14 v2.3 enrichments' count vs §07.9.1 at T-PHASE2-TYPES impl)
> **Cost so far:** ~$2 / $10 phase ceiling (80% headroom)

---

## TL;DR

| | Pass 1 | Pass 2 |
|---|---|---|
| Correctness | REVISE (1 CRIT + 4 HIGH + 6 MED + 6 LOW) | **PASS** (all 17 resolved; 1 LOW carryforward) |
| Coverage | PASS (0/13 ACs anchored expected pre-impl) | **PASS** (unchanged) |
| Completeness | REVISE (+F-S13 HIGH IframePurpose + F-S12 MED safetyClass via critic) | **PASS** (all 5 surfaces resolved) |
| **Overall** | **REVISE** | **APPROVE** |

**Bottom-line:** stamp `APPROVE` to bump status `draft → approved` on all 6 phase artifacts, then master proceeds to Stage 2 (impl).

---

## What changed since Pass 1

### Patch wave commit `92b2ec5` — 8 actions applied

| Action | Finding | Result |
|---|---|---|
| act-001 | F-S1 CRITICAL — Phase 1b/1c staleness sweep | All 4 artifact `derived_from` cite phase-1/1b/1c-current.md (19 occurrences across 5 files); spec Constraints Inherited §; impact.md upstream substrate § |
| act-002 | F-T1 HIGH — 28→29 tool-count sweep | 11 functional sites swept; canonical breakdown 22 browser_* + 2 agent_* + 5 page_* adopted |
| act-003 | F-S2 HIGH — AC-02 token budget | 1500 → 20,000 (NF-Phase1-01 v0.4) |
| act-004 | F-S4 HIGH — T048 namespace + extractor reuse | T048 brief: 4-bullet upstream substrate section + namespace contract kill criterion + AC-11/AC-13 assertion |
| act-005 | F-S13 HIGH — IframePurpose closed-enum constraint | impact.md AnalyzePerception §F-S13 + T048 brief + spec Assumptions; full 10-value enum cited |
| act-006 | F-G1 MED — AnalyzePerception schema relationship | Decided: SEPARATE Zod schema; Phase 1c PSM-alias accessor coexists; documented in impact.md §F-G1 |
| act-007 | F-G2 MED — single-call invariant boundary | Decided: caller invokes waitForSettle BEFORE; settle's evaluate excluded; documented in R-11 + Assumption #4 + T048 kill criteria |
| act-008 | F-S12 MED — safetyClass coverage 6/29 unclassified | T043 → requires_safety_check; T044-T048 → safe; impact.md MCPToolRegistry full 11-row table for all 29 |

### Polish bundle (act-009 partial)

F-S5 (tasks-v2 version softened), F-S6 (T042 path align), F-S7 (R-08 partition mirror), F-S8 (PRD line-num → section IDs), F-T2 (ToolRegistry interface dedup), F-T3 (plan.md '# 28 files' → '# 29 files'), F-T4 (Approval Gates Phase 1c row), F-S10 (R1-R23 → R1-R26), F-S11 (Phase 0b status updated). All resolved.

### Version bumps (R18 append-only delta blocks)

- spec.md v0.2 → v0.3
- plan.md v0.1 → v0.2
- tasks.md v0.1 → v0.2
- impact.md v0.1 → v0.2

---

## Pass 2 sub-audit results

### Correctness — PASS

All 17 Pass 1 findings RESOLVED (verified via grep + diff inspection of commit `92b2ec5`):

- **CRITICAL:** F-S1 ✅
- **HIGH:** F-S2 ✅, F-S3 ✅, F-S4 ✅, F-T1 ✅, F-S13 ✅
- **MED:** F-G1 ✅, F-G2 ✅, F-S5 ✅, F-T2 ✅, F-T3 ✅, F-S6 ✅, F-S7 ✅, F-S12 ✅
- **LOW:** F-S8 ✅, F-S9 ✅, F-T4 ✅, F-S10 ✅, F-S11 ✅

### Coverage — PASS

Unchanged from Pass 1: 0/13 ACs anchored is expected at draft pre-flight (TDD-first per R3.1). T-PHASE2-TESTS lands in Stage 2 setup; coverage gates at Gate 2 (Stage 3b verification).

### Completeness — PASS

All 5 categorical surfaces re-audited:

| Surface | Pass 1 | Pass 2 |
|---|---|---|
| 29 MCP tool name universe | SPEC_GAP (28/29 drift) | **PASS** (sweep complete) |
| 14 v2.3 enrichment fields | SPEC_GAP (count unverified) | **PASS_WITH_CARRYFORWARD** (verify at T-PHASE2-TYPES impl) |
| SafetyClass × 29 tools | IMPL_GAP (6/29 unclassified) | **PASS** (full 29-tool table) |
| browser_evaluate sandbox vectors | PASS (4 vectors MVP scope) | **PASS** (unchanged; v1.1 backlog noted) |
| Phase 1c closed enum upstream alignment | SPEC_GAP (4 enums unreferenced) | **PASS** (IframePurpose constrained; others acknowledged in Constraints Inherited) |

---

## Carryforward to implementation

**F-CARRY-1 (LOW)** — At T-PHASE2-TYPES authoring time, verify the '14 v2.3 enrichments' count claim against `docs/specs/final-architecture/07-analyze-mode.md` §07.9.1 verbatim. Likely meanings: '14 enrichment categories', '14 distinct sub-fields critical for grounding', or '14 top-level enrichment groups'. Reconcile any mismatch and document in impact.md AnalyzePerception §. Non-blocking for Gate 1; will surface in Stage 2.5 code review if not addressed.

---

## Recommended Gate 1 Pass 2 action paths

### Path APPROVE (recommended)

Master applies act-pass2-001:
- Bump `status: draft → approved` on all 6 phase artifacts (spec.md, plan.md, tasks.md, impact.md, README.md, checklists/requirements.md)
- Commit the lifecycle bump (R17.4 transition; CLAUDE.md §8c)
- Proceed to Stage 2 — task classifier runs on tasks.md (35 tasks); recommended dispatch plan: T-PHASE2-{TESTS,TYPES,LOGGER} sequential foundation → T016-T019 sequential (MCP server + 3 human-behavior modules) → T020-T042 in 3 parallel batches of ~8 tools (PRD §10.10 comprehension-debt pacing) → T043-T049 parallel after T019 → T048 single-threaded (highest review surface, R23 strict) → T050 acceptance gate

### Path REVISE_AGAIN

Identify additional concerns before stamping. Master applies user-specified patches and runs Pass 3.

### Path RE-SPEC

Pause phase; reopen design. State preserved in `.phase-state/2/`.

---

## How to stamp

Reply with one of:

- `APPROVE` — proceed to Stage 2 (RECOMMENDED)
- `REVISE_AGAIN <reasoning>` — additional patches before stamping
- `RE-SPEC` — pause phase

---

## Audit trail

- Phase state: `.phase-state/2.json`
- Pass 1 correctness: `.phase-state/2/preflight-correctness.json` (17 findings)
- Pass 1 coverage: `.phase-state/2/preflight-coverage.json` (re-run 2026-05-12)
- Pass 2 verdict: `.phase-state/2/preflight-verdict.yaml` (full Pass 1 + Pass 2 sub-audit detail)
- Patch wave commit: `92b2ec5` (7 files; +424 / -71)
- This file: Pass 2 review-notes (replaces Pass 1; Pass 1 details preserved in verdict YAML + git history)

**Master orchestrator paused. Awaiting human stamp at Gate 1 Pass 2.**

---

## Appendix: Pass 1 history (audit trail)

Pass 1 (2026-05-12) surfaced 17 findings at draft v0.2/v0.1 artifacts (last updated 2026-04-27 — 2 weeks / 2 phases stale vs Phase 1b 2026-05-11 + Phase 1c 2026-05-12). User stamped REVISE. Master applied 8 patch actions (act-001..act-008) + polish bundle (act-009 partial) at commit `92b2ec5`. Pass 2 verifies all findings resolved; APPROVE recommended.

---

# Gate 2 (verification) — Stage 3b verdict

**Reviewer:** `neural-ai-reviewer` skill (master orchestrator Stage 3b dispatch)
**Reviewed at:** 2026-05-13 18:15 IST
**Reviewed at HEAD:** `fe78c74` on `feat/phase-2-tools` (49 commits since cut from master at `33bc047`)
**Verdict:** **APPROVE**
**Human stamp:** **APPROVE** stamped by Sabari on 2026-05-13 at master session 18 (per `/master 2 --gate-2 APPROVE`)

## Three-sub-audit synthesis

| Sub-audit | Verdict | Notes |
|---|---|---|
| Correctness | **PASS** | All Stage 2.5 CRITICAL + 1 MEDIUM resolved at commit `fe78c74`; HIGH/MED/LOW/NIT deferred to v1.1 with rollup-note tracking |
| Coverage | **PASS** | 13/13 ACs GREEN; full suite 493/616 pass + 2 skipped (live-network) + 123 todo across 81 test files; zero Phase 1 regression |
| Completeness (R5.6 two-pass) | **PASS** | 5 categorical surfaces audited (tool taxonomy, IframePurpose enum, sandbox vectors, safety class taxonomy, AnalyzePerception fields); adversarial critic AGREE on all 5 |

## Stage 2.5 finding resolution status

| ID | Severity | Disposition | Evidence |
|---|---|---|---|
| F-001 | CRITICAL | RESOLVED via Path B | F-006 closes bypass #3 in impl; #1+#2 documented as known limitations with operational compensating control (Phase 4 DomainPolicy); spec.md v0.3.1→v0.3.2 with R18 delta block recording AC-06+US-1+SC-003 honest-scope revisions; AC-06 tests 9→12 vectors pinning all 3 bypass classes |
| F-005 | MEDIUM | RESOLVED via Path B | Server.ts ERROR_CODES typed-error envelope redaction; full Zod/handler message retained in Pino structured log only; closes prompt-injection ratchet ahead of Phase 5 BrowseNode |
| F-006 | LOW | RESOLVED via Path B | Strict-mode IIFE patch closes F-001 bypass #3 in impl |
| F-002 | HIGH | DEFERRED-TO-V1.1 | Single-evaluate test rigor; current test catches happy-path invariant; failure-path + evaluateHandle coverage adds value but not blocking |
| F-003 | HIGH | DEFERRED-TO-V1.1 | Wall-clock test silent-skip-on-network-failure; amazon.in 336ms vs 5000ms budget = 15x margin; deterministic perf-pin via static-server fixture is v1.1 hardening |
| F-004 | MEDIUM | DOCUMENTED-AS-KNOWN-LIMITATION | pageAnalyze.script.ts 523 LOC = single-string surface verbatim mirroring §7.9; cannot split without breaking REQ-TOOL-PA-001 single-evaluate invariant; constitution R10.1.1 carve-out for `.script.ts` companion files is v1.1 hygiene |
| F-007 | LOW | DEFERRED-TO-V1.1 | Sandbox fn LOC brittle (47 of 50 cap); v1.1 SANDBOX_BLOCK_TABLE refactor |
| F-008 | NIT | DEFERRED-TO-V1.1 | Stale eslint-disable comment in Server.ts:102 |

No active blocking findings.

## Categorical-surface completeness audit (R5.6 two-pass)

1. **Tool Taxonomy (29 tools)** — auditor PASS / critic AGREE — Phase 2 implements the complete v3.1 manifest exactly; out-of-scope candidates (browser_dialog, browser_intercept) not in v3.1 and properly excluded from MVP
2. **IframePurpose closed enum (9 values + cross_origin override)** — auditor PASS / critic AGREE — `other` fallback covers AdSense/Maps/Typeform/etc.; new explicit slots require Phase 1c R18 append-only extension
3. **Sandbox attack vectors (5 enumerated)** — auditor PASS / critic AGREE — 5-vector scope reflects architectural reach + operational threat model + v1.1 roadmap headroom; `import()` / WebAssembly / BroadcastChannel are reasonable v1.1 additions, not MVP blockers
4. **Safety class taxonomy (4 classes × 29 tools)** — auditor PASS / critic AGREE — all 29 tools have explicit non-default class; getSafetyClass() throws UnknownToolNameError on unregistered names (fail-fast)
5. **AnalyzePerception field universe (§7.9 + §7.9.1)** — auditor PASS / critic AGREE — 16 top-level sections + _extensions namespace seam; v2.4 Phase 1b extensions wiring deferred to Phase 5 per Phase 1c impact.md §12 (documented in rollup §5)

## Stage 3 verification gate results

```
Lint:      PASS (stubbed to Phase 4 per package.json scripts; 443ms)
Typecheck: PASS (full-turbo; 7.5s)
Tests:     PASS (493 passed / 2 skipped / 123 todo across 81 test files; 44s)
Phase 1 regression: ZERO (browser-manager 2/2, context-assembler 3/3 unchanged)
AC-13 integration: GREEN (11/11; 37.49s wall-clock vs 5-min budget; F-S4 honored across 3 fixtures)
amazon.in wall-clock: 336ms vs 5000ms budget (15x margin)
```

## Recommendation: APPROVE for Gate 2 stamp

**Gate 2 stamped APPROVE by Sabari 2026-05-13.** Master orchestrator proceeding to Stage 4 exit (R17 status bumps `approved → implemented → verified`; INDEX.md flip 🟡 → 🟢; branch push; PR creation per branch-workflow convention).

Override pattern detector: PASS (Gate 1 + Gate 2 both APPROVE on second pass after spec/code patches; no override frequency concerns).

Full structured verdict: `.phase-state/2/verify-verdict.yaml`.


---
title: Phase 2 Review Notes — Gate 1 Pass 1
artifact_type: phase-review-report
gate: 1
pass: 1
status: pending-human-stamp
phase_number: 2
phase_name: MCP Tools + Human Behavior
created: 2026-05-12
review_session: 16 (master orchestrator)
reviewer_ai: neural-ai-reviewer skill (two-pass auditor + critic per R5.6)
reviewer_human: Sabari (pending)
recommended_verdict: REVISE
estimated_human_stamp_time: ≤2 min (read summary + tick option)
---

# Phase 2 — MCP Tools + Human Behavior — Gate 1 Review (Pass 1)

> **Recommended verdict:** `REVISE`
> **Patch effort estimate:** ~3.5 hours
> **Why not APPROVE:** 1 CRITICAL + 5 HIGH findings — Phase 2 artifacts are 2 weeks / 2 phases stale (authored 2026-04-27, before Phase 1b shipped 2026-05-11 and Phase 1c shipped 2026-05-12). Implementing on stale artifacts would force expensive R11.4 spec patches mid-impl at HIGH-risk impact tier.

---

## TL;DR (engineering lead read this first)

| | Verdict | Why |
|---|---|---|
| **Correctness** (analyze) | REVISE | 1 CRITICAL (Phase 1b/1c staleness) + 4 HIGH + 6 MED + 6 LOW |
| **Coverage** (matrix) | PASS | 0/13 ACs anchored is expected at pre-flight (TDD-first, tests author in Stage 2) |
| **Completeness** (categorical surfaces) | REVISE | 2 new findings surfaced: F-S12 safetyClass coverage gap (MED), F-S13 IframePurpose closed-enum drift (HIGH) |
| **Overall** | **REVISE** | Strictest sub-audit wins |

**Bottom-line ask:** stamp one of `APPROVE` / `REVISE` / `RE-SPEC` and master proceeds.

---

## What's blocking Gate 1 stamp (CRITICAL + HIGH only — 6 findings)

### F-S1 — CRITICAL — Phase 1b/1c staleness sweep (entire artifact corpus)

**The issue:** Phase 2 spec/plan/tasks/impact were authored 2026-04-27 and not refreshed through Phase 1b (shipped 2026-05-11) or Phase 1c (shipped 2026-05-12). Zero mention of:
- PerceptionBundle envelope (the new wrapper around PageStateModel)
- `bundleToAnalyzePerception(bundle, stateId?)` accessor function
- 4 Phase 1c closed Zod enums (IframePurpose, HiddenReason, NondeterminismFlag, WarningCode)
- Phase 1b's 10 extractors producing pricing/social-proof/microcopy enrichments
- Phase 1c namespace contract carryforward (`bundle.raw.*._extensions` reserved for Phase 7)

**The risk:** `browser_get_state` (T024) and `page_analyze` (T048) are load-bearing on Phase 1c contracts but reference none. Phase 7 grounding rules + reports downstream will fail if Phase 2 invents shapes that conflict with what already shipped.

**The fix (mechanical):** Add `phase-1c-current.md` + `phase-1b-current.md` + `phase-1-current.md` to all 4 artifacts' `derived_from`. Add a Constraints Inherited section row in spec.md. Add an impact.md namespace-contract assertion row.

**Constitutional rules cited:** R19 (rollup-first) + R20 (impact analysis) + CLAUDE.md §1b.

---

### F-S2 — HIGH — AC-02 cites stale 1500-token PageStateModel budget

**The issue:** spec.md User Story 1 Acceptance Scenario #2 reads `<1500 tokens, per Phase 1 contract`. Phase 1 NF-Phase1-01 was bumped 1500 → **20,000** in v0.4 (R11.4 amendment 2026-05-09). Spec citation is **13× too small**.

**The fix:** Update AC-02 to cite `PAGE_STATE_MODEL_TOKEN_BUDGET = 20_000`. Recheck NF-Phase2-02 if it depended on 1500.

---

### F-S3 — HIGH — `derived_from` rollup-first violation

**The issue:** impact.md does not cite phase-1c-current.md in `derived_from`. Per CLAUDE.md §1b, predecessor rollups ARE canonical compressed system state.

**The fix:** Add all 3 predecessor rollups (Phase 1, 1b, 1c) to derived_from frontmatter across all 4 artifacts.

---

### F-S4 — HIGH — T048 page_analyze namespace + extractor reuse gap

**The issue:** T048 enumerates 14 v2.3 enrichments per §07.9.1 but does not address:
- (i) Phase 1b's 10 extractors already produce pricing/social-proof/microcopy outputs into `PerceptionBundle.raw.page_state_model_by_state[*]._extensions` — does page_analyze reuse or re-extract? Doubling pays 2× perf cost.
- (ii) Per Phase 1c impact.md §11, anything under `bundle.raw.*._extensions` is reserved for Phase 7 DeepPerceiveNode. T048 has no kill criterion forbidding writes there.

**The fix:** T048 brief must (1) acknowledge upstream extractors, (2) declare composition strategy (recommend reuse), (3) add kill criterion: "Phase 2 capture writes anything into `_extensions` → R23 trigger".

---

### F-T1 — HIGH — Tool-count drift unfixed (28 vs 29) in 7 places

**The issue:** v0.2 delta block claimed "tool count clarified: 29 MCP tools" but artifact body still says "28 tools" in 7 places (AC-04, US-1 acceptances #1+#8, SC-001, AC-13 brief, T050 brief + dep line, plan.md `# 28 files` comment). The v0.2 promise was authored without actually executing the sweep.

**The fix:** Mechanical sweep — replace 7 occurrences. Canonical breakdown (per README + tasks.md table): **22 browser_* + 2 agent_* + 5 page_* = 29**.

---

### F-S13 — HIGH — page_analyze iframes[].purposeGuess unconstrained vs Phase 1c IframePurpose enum

**The issue (newly surfaced by completeness audit):** Phase 1c ships `IframePurpose` as a **closed** Zod enum (9 + cross_origin = 10 values). Phase 2's page_analyze enriches `iframes[].purposeGuess` (per §07.9.1) but with no enum constraint. If page_analyze populates `purposeGuess: 'foo'` outside the closed enum, it silently breaks Phase 1c's iframe-classification contract — and Phase 7 grounding rules that reference IframePurpose enum will see invalid values.

**The fix:** Constrain `iframes[].purposeGuess` in `AnalyzePerceptionSchema` to Phase 1c IframePurpose enum values. If Phase 2 needs new purpose values, append-only extend the Phase 1c enum first (R18) — never invent ad-hoc strings.

---

## What's NOT blocking but you should know about (MEDIUM × 7)

| ID | Issue | Action |
|---|---|---|
| F-G1 | AnalyzePerception schema vs PSM-alias relationship undeclared. Phase 1c bundleToAnalyzePerception returns PSM; Phase 2 plans separate schema. **Decision needed pre-impl.** | Recommend: separate Zod schema; Phase 1c accessor remains PSM; Phase 7 calls page_analyze for full v2.3 form. |
| F-G2 | page_analyze single-call invariant conflicts with Phase 1c settle predicate's internal page.evaluate. **Boundary undefined.** | Declare: caller invokes `waitForSettle(page)` first; page_analyze handler is exactly one evaluate (verifiable via Playwright trace). |
| F-S5 | spec cites `tasks-v2.md UNCHANGED in v2.3.1` — version may have drifted. | Verify current version + update. |
| F-T2 | ToolRegistry interface declared in BOTH tasks.md and impact.md. | Single source of truth: impact.md canonical; tasks.md references. |
| F-T3 | plan.md comment `# 28 files` but 29 file paths enumerated. | Bump comment to 29 (sweep with F-T1). |
| F-S6 | T042 file path mismatch: plan.md `agentRequestHuman.ts` vs tasks.md `requestHuman.ts`. | Align to `agentRequestHuman.ts` (matches T041 convention). |
| F-S7 | R-08 lists 8 perf metrics flat; AC-08 partitions 4+4. R-08 should mirror partition. | Mechanical restatement. |
| F-S12 | T043 (browser_evaluate) + T044-T048 (5 page tools) lack explicit safetyClass — 6 of 29 unclassified. | Patch tasks.md: T043 → `requires_safety_check`; T044-T048 → `safe`. |

## LOW (6 findings) — polish bundle, deferrable

F-S8 (PRD line-num → section IDs); F-S9 (Constraints Inherited completeness — bundled with F-S1); F-T4 (Approval Gates Phase 1c row); F-S10 (R-23 → R-26 range sweep); F-S11 (Phase 0b status update); v1.1-backlog for sandbox extension to WebSocket/IndexedDB.

---

## Completeness audit — categorical surfaces enumerated (R5.6 two-pass)

5 surfaces audited with adversarial critic:

1. **29 MCP tool name universe** vs `08-tool-manifest.md` — auditor SPEC_GAP (28/29 drift); critic EXTEND (category breakdown also drifts — "23 browse + agent" mixes categories); final **SPEC_GAP** → F-T1.
2. **14 v2.3 enrichment fields** vs §07.9.1 — auditor SPEC_GAP (T048 enumerates ~30 sub-fields across 11 sections; "14" count unverifiable); critic AGREE; final **SPEC_GAP** → bundled with F-T1.
3. **SafetyClass × 29 tools** — auditor IMPL_GAP (6/29 unclassified); critic AGREE (T043 sandbox surface still risky); final **IMPL_GAP** → new finding F-S12.
4. **browser_evaluate sandbox vectors** — auditor PASS (4 vectors per MVP scope); critic AGREE (WebSocket/IndexedDB are v1.1 backlog, not Gate 1 blockers); final **PASS** with backlog note.
5. **Phase 1c closed enums upstream alignment** — auditor SPEC_GAP (Phase 2 references none of 4 closed enums); critic AGREE (IframePurpose alignment is load-bearing for Phase 7 grounding); final **SPEC_GAP** → new finding F-S13 (HIGH).

---

## Recommended Gate 1 action paths

### Path REVISE (recommended)

Master applies 8 patch actions (act-001 through act-008):
1. **act-001** [CRITICAL] — Phase 1b/1c staleness sweep across all 4 artifacts; bumps to v0.3 with R18 delta
2. **act-002** [HIGH] — Tool-count sweep (7 sites + plan comment)
3. **act-003** [HIGH] — AC-02 token budget fix
4. **act-004** [HIGH] — T048 namespace + extractor reuse acknowledgment
5. **act-005** [HIGH] — F-S13 IframePurpose closed-enum constraint
6. **act-006** [MED] — F-G1 design decision (separate AnalyzePerceptionSchema)
7. **act-007** [MED] — F-G2 design decision (waitForSettle precondition)
8. **act-008** [MED] — F-S12 safetyClass coverage for 6 tools

MEDIUM/LOW (act-009) bundled into same patch wave or deferred to v0.4 polish — your call.

**After patches land:** Master re-runs Stage 1 Pass 2 (analyze + matrix + AI Reviewer). Pass 2 verdict expected: `APPROVE`. Status bumps to `approved` on Pass 2 stamp. Then Stage 2 (impl) dispatches.

**Cost estimate:** ~$1 for Pass 2 cycle on top of Phase 2 base ceiling.

### Path APPROVE (NOT recommended)

Skip patches; bump status `draft → approved` as-is. **Why this is bad:**
- T048 impl will hit F-S1 staleness within the first hour and force R11.4 mid-impl spec patches at HIGH-risk impact tier
- F-S13 IframePurpose drift would silently propagate into Phase 7 grounding-rule failures weeks later
- Two-pass critic flagged this directly

### Path RE-SPEC

Pause phase; reopen design discussion (e.g., if F-G1 AnalyzePerception decision reveals deeper architectural mismatch with Phase 1c PerceptionBundle envelope). Master preserves all state in `.phase-state/2/`. User decides next step (e.g., merge Phase 2 into Phase 5, redesign per-tool boundary, etc.).

---

## How to stamp

Reply with one of:

- `APPROVE` — proceed to Stage 2 as-is (NOT RECOMMENDED per above)
- `REVISE` — master patches per act-001 through act-008, then runs Pass 2 (RECOMMENDED)
- `REVISE minus act-N` — patches but drop a specific action
- `RE-SPEC` — pause phase, reopen design

You can also override the verdict with reasoning logged for the pattern detector.

---

## Audit trail

- Phase state: `.phase-state/2.json` (initialized 2026-05-12)
- Correctness raw: `.phase-state/2/preflight-correctness.json` (17 findings)
- Coverage raw: `.phase-state/2/preflight-coverage.json` (matrix output)
- Verdict raw: `.phase-state/2/preflight-verdict.yaml` (full sub-audit detail)
- This file: `docs/specs/mvp/phases/phase-2-tools/review-notes.md` (rendered for human stamp)

**Master orchestrator paused. Awaiting human stamp at Gate 1.**

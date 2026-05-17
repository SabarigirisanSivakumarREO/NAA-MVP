---
title: Phase 5b — Engineering Review Notes (Gate 1)
artifact_type: review-notes
status: draft
version: 0.1 (Pass 1)
phase_number: 5b
created: 2026-05-17
updated: 2026-05-17
owner: engineering lead
authors: [neural-ai-reviewer (Stage 1b master orchestrator session 17)]
reviewers: [pending Sabari stamp]
gate: 1 (pre-flight)
recommendation: REVISE
---

# Phase 5b Pass 1 Review Notes

## Inputs reviewed

- `docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/{README,spec,plan,tasks,impact}.md` @ v0.1 status:draft
- `.phase-state/5b/preflight-correctness.json` (analyze output — 16 findings)
- `.phase-state/5b/preflight-coverage.json` (matrix — 19/19 ACs pre-impl missing; expected)
- Predecessor rollups: phase-5/current.md (verified), phase-1b/current.md (implemented), phase-1c/current.md (implemented), phase-4b/current.md (approved)

## Verdict: REVISE — Pass 1 patch wave required

Pass 1 surfaced **22 actions** (5 correctness HIGH + 7 correctness MED + 3 correctness LOW.spec_defect + 6 completeness SPEC_GAPs + 1 LOW pure_cosmetic log-only). Per fix-all-spec-defects policy (Session 19, 2026-05-13), all 21 spec-defect actions block Gate 1 APPROVE.

## Why REVISE (and not RE-SPEC)

- No CRITICAL findings. No constitutional MUST violated.
- All findings are spec/plan path drift, naming convention misalignment, dependency sequencing, and completeness gaps. Solvable via single patch wave.
- Phase scope, kill criteria, and design intent are sound.
- Predecessor deps (5/1b/1c) shipped. 4b approved but not yet verified — coordinate AuditRequest schema extension.

## Categorical surfaces audited (completeness sub-audit)

| Surface | Universe size (auditor) | Required for MVP | Critic verdict | Final |
|---|---|---|---|---|
| viewport_set | 5 (desktop, mobile, tablet, smartwatch, TV) | 2 (desktop+mobile) | EXTEND (Android baseline) | SPEC_GAP |
| cookie_banner_library | 8 (OneTrust, Cookiebot, TrustArc, Generic, Quantcast, Didomi, Iubenda, Sourcepoint) | 4 | EXTEND (Quantcast+Didomi+Iubenda) | SPEC_GAP |
| popup_trigger_type | 9 (load, time, scroll, exit, focus, blur, idle, form_abandon, custom) | 4 | AGREE (defer 5) | SPEC_GAP (Out of Scope addition) |
| dark_pattern_flag | 8 (4 popup-structural + 4 popup-textual+CMP) | 4 | DISPUTE (weighted_default required) | SPEC_GAP |
| cookie_policy_mode | 5 (dismiss, preserve, block, dismiss-reject, capture-snapshot-then-dismiss) | 2+1-rejected | EXTEND (capture-then-dismiss noted) | SPEC_GAP (Out of Scope addition) |
| form_input_trigger_field_exclusions | 7 (cc-*, password, hidden, file, ssn/tax/pin, captcha, cross-origin iframe) | 3 | EXTEND (file+PII+captcha) | SPEC_GAP |

## Action register (22 total — Pass 1 patch wave)

| ID | Severity | Target | Description |
|---|---|---|---|
| act-001 | HIGH | plan.md §2.1 | Rename `src/browser/` -> `src/browser-runtime/` |
| act-002 | HIGH | plan+impact+tasks | Redirect `src/gateway/AuditRequest.ts` -> `src/types/audit-request.ts` |
| act-003 | HIGH | plan+tasks | T5B-008 heuristic file convention -> `heuristics-repo/multi-viewport/<ID>.json` per-heuristic (5 files) |
| act-004 | HIGH | plan+tasks+impact | T5B-008 Phase 6 sequencing: ASK USER — (a) defer post-Phase-6 / (b) lint-only-conformance / (c) gated Zod |
| act-005 | HIGH | spec.md | Amend req_ids to `REQ-STATE-EXPL-TRIGGER-002..006` (drop 001/007/008) |
| act-006 | HIGH | impact+spec | Verify popups[] Zod widening; mark impact.md cross-cutting Phase 1b/1c |
| act-007 | MED | spec+plan+tasks | Lock NF-01 cost = $USD via `llm_call_log` |
| act-008 | MED | spec+tasks | Lock AuditRequest field naming (cookie_policy vs cookiePolicy) |
| act-009 | MED | spec | Split NF-01 → NF-01a/b/c per-feature cost caps |
| act-010 | MED | impact+tasks | Add storage ceiling assertion to T5B-009 OR Phase 9 defer |
| act-011 | MED | spec+tasks | Lock R-17 to ≤10 per (trigger_type, state, page) |
| act-012 | MED | tasks+plan | Define popup state-equality via Phase 1c settle-predicate |
| act-013 | MED | README+plan | Unify effort to 28h±3 across artifacts |
| act-014 | LOW | all artifacts | Bump `updated: 2026-05-17` + delta blocks per R18 |
| act-015 | LOW | spec | Lock cookie dismiss = accept-only MVP; drop "or reject" from R-15 |
| act-016 | LOW | impact §3 | Verify Phase 0 SnapshotBuilder shipped before claiming snapshot extension |
| act-017 | HIGH | plan §2.2 | Justify iPhone 11 mobile preset OR add Android baseline |
| act-018 | HIGH | spec+plan+NF-06 | Expand cookie libraries: Quantcast+Didomi+Iubenda; relax Generic detection |
| act-019 | MED | spec Out of Scope | Document popup-trigger deferrals (focus/blur/idle/form_abandon/custom) |
| act-020 | HIGH | spec+plan+AC-07 | Add `weighted_default` dark-pattern flag (CMP pre-checked); defer 3 textual patterns |
| act-021 | MED | spec Out of Scope | Document capture-snapshot-then-dismiss cookie mode deferral |
| act-022 | HIGH | spec+plan+T5B-014 | Expand FormInputTrigger exclusions: file+PII+captcha |

## Decision required from user (before Pass 1 patch wave)

**act-004 (T5B-008 Phase 6 sequencing)** — ASK FIRST per CLAUDE.md §6:

| Option | Implication |
|---|---|
| (a) Defer T5B-008 to post-Phase-6 | Phase 5b ships 18 tasks; T5B-008 lands when Phase 6 HeuristicSchema exists; T5B-009/019 conformance asserts on stub heuristics in interim |
| (b) Reframe T5B-008 as lint-only-conformance against `apps/cli/tests/conformance/heuristic-lint.test.ts` (already shipped Phase 0b) | Phase 5b ships 19 tasks; T5B-008 emits 5 JSON files validated by Phase 0b lint test; Zod-schema validation gated to Phase 6 |
| (c) Lock Phase 5b on Phase 6 | Phase 6 must ship FIRST; Phase 5b sequenced after; reorders INDEX.md depends-on |

Recommend **(b)** — lowest scope risk, lint test already shipped, content not blocked.

## Next steps

1. User stamps Gate 1 with REVISE acknowledgement + decision on act-004
2. Master applies Pass 1 patch wave (21 spec patches, single commit, R18 delta blocks on every artifact)
3. Re-run `/speckit.analyze` Pass 2 → AI Reviewer Pass 2 verdict
4. If Pass 2 = APPROVE clean → bump `status: draft → approved` on spec/plan/tasks/impact + commit
5. Proceed to Stage 2 implementation

## Constitutional anchors enforced

R11.4 — fix spec before implementing (act-001..006)
R10 — code quality + budget discipline (act-007..013)
R18 — delta blocks on every patched artifact (act-014)
R20 — impact analysis for cross-phase touch (act-006 popups[] schema)
R26 — state exploration MUST NOT (act-022 FormInputTrigger exclusions)

## Audit trail

- Reviewer: `neural-ai-reviewer` skill
- Verdict source: `.phase-state/5b/preflight-verdict.yaml`
- Correctness source: `.phase-state/5b/preflight-correctness.json` (16 findings)
- Coverage source: `.phase-state/5b/preflight-coverage.json` (19/19 ACs pre-impl)
- Completeness: dynamic enumeration per `references/categorical-surfaces.md` (6 surfaces audited)
- Critic challenge: applied per R5.6 to all 6 completeness surfaces; 1 DISPUTE + 4 EXTEND + 1 AGREE

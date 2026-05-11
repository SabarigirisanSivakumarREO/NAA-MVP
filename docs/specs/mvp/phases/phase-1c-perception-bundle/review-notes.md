---
title: Phase 1c — Pre-flight Review Notes (Gate 1 Pass 1)
artifact_type: review-notes
status: draft
version: 1.0
phase_number: 1c
phase_name: PerceptionBundle Envelope v2.5
created: 2026-05-11
updated: 2026-05-11
owner: engineering lead
reviewers: [Sabari (Gate 1 stamper)]
authors: [Claude (master orchestrator session 15 — Stage 1 pre-flight)]

supersedes: null
supersededBy: null

derived_from:
  - .phase-state/1c/preflight-correctness.json (analyze output)
  - .phase-state/1c/preflight-coverage.json (matrix output)
  - .phase-state/1c/preflight-verdict.yaml (AI Reviewer synthesis)

req_ids:
  - REQ-ANALYZE-PERCEPTION-V25-001
  - REQ-PERCEPT-V25-002
  - REQ-BROWSE-PERCEPT-007
  - REQ-BROWSE-PERCEPT-008

governing_rules:
  - Constitution R11.4 (Spec patches BEFORE impl when AI Reviewer flags spec gap)
  - Constitution R17 (Lifecycle States — verdict gates draft → approved transition)
  - Constitution R20 (Impact Analysis — namespace contract carry-over from Phase 1b)
  - Constitution R22 (The Ratchet)
  - Constitution R23 (Kill Criteria)
---

# Phase 1c — Pre-flight Review Notes (Gate 1 Pass 1)

## TL;DR

**Verdict: REVISE.** 2 HIGH defects + 5 MEDIUM scope ambiguities + 5 LOW polish items. 0 CRITICAL.
**Root cause:** Phase 1c spec was authored 2026-04-28; Phase 1b shipped 2026-05-09 with material schema growth. The Phase 1c artifacts have not been rebased against Phase 1b reality.
**Fix scope:** A single v0.1 → v0.2 patch wave (~2-3h authoring) addresses all 12 findings. Mirrors Phase 1b's own Gate 1 Pass 1 → Pass 2 pattern.

## Sub-audit verdicts

| Sub-audit | Verdict | Why |
|---|---|---|
| Correctness | REVISE | 2 HIGH defects (settle-algorithm bug, token-cap infeasibility) |
| Coverage | PASS | 100% R-NN → task coverage; 12/12 AC test paths anchored |
| Completeness | REVISE | 4 of 6 categorical surfaces returned SPEC_GAP (nondeterminism markers, iframe purposes, warning codes, hidden-element reasons) |
| **Overall** | **REVISE** | Strictest wins; never relax coverage |

## What's blocking approval (the 2 HIGH defects)

### HIGH-1 (I1) — Settle algorithm doesn't honor 5s total hard cap

**File:** `plan.md` §2.2 (lines 111-124)
**Conflict with:** spec R-01 ("capped at 5s total") + AC-01 + NF-05

The sample `waitForSettle()` runs steps sequentially with per-step `.catch(() => {})` soft caps:
- `networkidle` 2000ms
- DOM mutations idle 3000ms
- fonts.ready (`?? true` — Promise vs boolean bug; LOW I8)
- animations 1500ms
- optional selector 2000ms

**Worst-case sum: ~8.5s.** No overall timer. Plan.md comment "5-second hard cap is the SUM of soft caps" is wrong arithmetic.

**Fix:** Wrap in `Promise.race([settleSteps(), sleepReject(5000)])` OR maintain a single elapsed-time guard that short-circuits each subsequent step when `elapsed >= 5000`.

### HIGH-2 (I2) — Bundle ≤8.5K per-state cap is mathematically infeasible

**File:** `spec.md` NF-01 + `plan.md` §3 kill criterion
**Conflict with:** Phase 1b rollup §2 empirical floor (amazon.in PageStateModel = 12,485 tokens; NF-Phase1-01 v0.4 cap = 20K)

Phase 1c's NF-01 says "≤8.5K per state (was AnalyzePerception ≤6.5K standalone)" — but the **wrapped** PageStateModel inside `bundle.raw.page_state_model_by_state[stateId]` is already 12.5K on a real production fixture. Bundle envelope overhead (meta + warnings + element_graph + nondeterminism) adds another ~2K. **Real-world per-state size ≥14K.** Plan.md §3 kill criterion ("Bundle >8.5K on any fixture") fires on every fixture.

**Fix options:**
- (a) Raise NF-01 cap to ≥15K (12.5K Phase 1b max + 2K envelope overhead), with Phase 1b empirical citation
- (b) Redefine "per-state bundle size" to mean envelope-only (excluding `bundle.raw.*`); keep ≤2K envelope budget

Option (b) is cleaner conceptually (envelope IS the new contract; raw is wrapped predecessor data).

## What's revealing scope ambiguity (the 5 MEDIUM findings)

### MED-1 (I3) — Analytics iframe severity routing
spec says "emit IFRAME_SKIPPED"; plan says "skip silent (info severity)". Pick one.

### MED-2 (I4) — `AuditRequest.element_graph_size` is referenced but undefined
Configurable knob cited in spec + plan but AuditRequest is Phase 6's contract; impact.md §3 lists no Phase-1c change. Either add field (R20 — list in `affected_contracts`) OR drop configurability claim.

### MED-3 (I5) — Fixture matrix is 5 OR 7?
AC-12 says "5 fixtures (homepage, PDP, cart, checkout, SPA-heavy)" but also requires "nondeterminism flags fire on Optimizely fixture" + "warnings fire on Shadow-DOM-deep fixture". Neither is in the 5. impact.md §10 lists 3 NEW fixtures (SPA-heavy + Optimizely-instrumented + Shadow-DOM-deep). Recommend: collapse SPA-heavy = Optimizely-instrumented = Shadow-DOM-deep into one trait-rich SPA fixture (5 total).

### MED-4 (I6) — Phase 1b namespace contract not carried forward
Phase 1b rollup §5 row 1 explicitly hands Phase 1c the constraint "no writes to `_extensions.*` (Phase 7's reservation)". Phase 1c artifacts are silent. **R20 audit trail incomplete.** Patch impact.md §1 + §3 + add AC-10/AC-12 conformance assertion.

### MED-5 (I7) — Phase 1b extractor runtime wiring ownership unresolved
Phase 1b rollup §4 row 1 says "Phase 5 BrowseNode + Phase 1c PerceptionBundle own runtime wiring" of 10 Phase 1b extractors into `ContextAssembler.capture()` `page.evaluate()`. Phase 1c task set (T1C-001..T1C-012) doesn't include such wiring. T1C-010 PerceptionBundle assembles the envelope but assumes inputs are present.

Decision needed:
- (a) Add **T1C-010.5** "ContextAssembler runtime composition of Phase 1b extractors" (~+3h to phase effort)
- (b) Defer explicitly to Phase 5 BrowseNode + document in plan.md §6 Out of Scope + rollup

## Completeness sub-audit — categorical surface gaps

The two-pass adversarial review (auditor + critic) on 6 surfaces found **4 SPEC_GAPs** (all MEDIUM):

| Surface | Spec enumerates | Reality | Gap |
|---|---|---|---|
| nondeterminism_markers | 6 cases (claims "7 documented values") | 20+ vendors known; auditor + critic add 3 (session_replay, server_side_personalization, cdn_edge_swap) | enumerate closed 9-case enum; document server-side as undetectable |
| iframe_purpose_classifier | 5 named + "other" | Captcha (security), CMP (consent), payment_3ds (auth) are security-distinct fall-throughs | extend enum: add captcha + cmp + payment_3ds with distinct warnings |
| warning_codes | 7 enumerated (claims "8 documented codes") | ELEMENT_GRAPH_TRUNCATED implied by T1C-007 dep; EXTENSION_OUTPUT_MISSING implied by I7 | enumerate 9+ closed-enum codes |
| hidden_element_reasons | 5 reasons | CSS/ARIA/HTML5 standards add `opacity:0` + `[hidden]` (common) | enumerate 7-case enum (opacity_zero + html_hidden_attr added) |

Two surfaces PASS:
- **portal_libraries** — spec's body-direct-children scan mechanism is framework-agnostic; covers any portal pattern
- **pseudo_elements** — `::before`/`::after` are the only `content`-injecting pseudos; spec scope is CSS-correct

## What's NOT blocking (the 5 LOW findings)

- **I8** — `fonts.ready ?? true` Promise vs boolean bug; trivial fix
- **I9** — Specify `state_graph.edges` defaults to `[]` for Phase 1c
- **I10** — T1C-009 dep on T1C-007 needs justification or removal
- **I11** — R-08 ad-auctions / time-based-content runtime probe strategy circular
- **I12** — Informational only (no R9 violations introduced)

Bundle these into the same v0.1 → v0.2 patch wave.

## Three-option decision

### Option A — REVISE (recommended)
Author v0.1 → v0.2 patch wave addressing all 12 findings.
- **Estimated effort:** ~2-3h Claude authoring + ~30min re-analyze
- **Estimated cost:** ~$2.00 (~$1.50 patch wave + ~$0.50 Pass-2 AI Reviewer)
- **Outcome:** Pass 2 verdict expected APPROVE; status bumps draft → approved
- **Precedent:** Phase 1b followed exactly this pattern (Pass 1 REVISE → patch wave → Pass 2 APPROVE)

### Option B — APPROVE (NOT recommended)
Accept the 2 HIGH defects as known caveats; defer fixes to v0.2.1 polish (post-impl).
- **Risk:** Kill criteria from plan.md §3 (token cap, settle p50) will fire during Stage 3 verification on real fixtures; Gate 2 likely returns RETURN-TO-IMPL anyway
- **Net effect:** Same patch work, but rotated to post-impl when context is harder to load

### Option C — RE-SPEC (NOT recommended)
Pause Phase 1c; re-open design discussion with Phase 5/6/7 leads on scope (I5 fixture matrix, I7 runtime wiring ownership).
- **Use only if:** I7 ownership decision blocks Phase 5 BrowseNode planning AND can't be resolved unilaterally

## Cost summary

| Item | Cost |
|---|---|
| Stage 1 (analyze + matrix + AI Reviewer) | ~$1.80 |
| Phase 1c ceiling | $10.00 |
| Remaining budget | $8.20 |
| Estimated Option A patch wave + re-review | ~$2.00 |
| Net remaining after Option A | ~$6.20 |
| Stage 2 + 3 implementation (12 tasks × ~$0.30-0.50 each) | ~$3.60-$6.00 |
| Net headroom over phase ceiling under Option A | ~$0.20 - $2.60 (tight; monitor) |

## Predecessor carry-forward awareness

Phase 1b rollup carried forward 3 specific risks for Phase 1c (per rollup §5):
1. **Namespace contract** (`_extensions` Phase 7 reservation) — captured here as I6 ✅
2. **Runtime wiring of 10 Phase 1b extractors** — captured here as I7 ✅
3. **Phase 7 evaluate token budget** — out of Phase 1c scope (Phase 7 lead owns)

Plus 6 LOW items from Phase 1b Stage 2.5 carryover (`.phase-state/1b/code-review-findings.yaml`) — none of these are Phase 1c blockers; documented as v0.2.1 polish bundle.

## Action — Gate 1 stamp required

The human stamper (Sabari) selects one of:

```
/master 1c --gate-1 APPROVE      # Option B — proceed with current artifacts
/master 1c --gate-1 REVISE       # Option A — apply 12 patches, re-run AI Reviewer
/master 1c --gate-1 RE-SPEC      # Option C — pause; brainstorm
```

Recommendation: **REVISE.**

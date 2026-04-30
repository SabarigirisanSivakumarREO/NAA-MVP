---
title: Phase 1 Engineering Lead Review Notes
artifact_type: review-notes
status: complete
version: 1.0
phase_number: 1
phase_name: perception
reviewed_at: 2026-04-30
reviewer: Sabari (engineering lead)
template_used: docs/specs/mvp/templates/phase-review-prompt.md v1.0
analyze_pass_reference: Session 7 (2026-04-30) — analyze findings M1-M4 + L1-L7 applied as v0.3 polish; 0 CRITICAL/0 HIGH

recommendation: APPROVE (with conditions C1 BINDING + C2/C3 OPTIONAL)

artifacts_reviewed:
  - phase-1-perception/README.md (v1.0)
  - phase-1-perception/spec.md (v0.3)
  - phase-1-perception/plan.md (v0.3)
  - phase-1-perception/tasks.md (v0.3)
  - phase-1-perception/impact.md (v0.3)
  - phase-1-perception/checklists/requirements.md

constitution_version_validated: docs/specs/mvp/constitution.md R1-R26
---

# Phase 1 (Browser Perception Foundation) — Engineering Lead Review Notes

> **One-line verdict:** APPROVE — design is sound; 0 HIGH findings; 1 MEDIUM doom finding (D5) gets a BINDING condition (C1) on T015 timeout budgeting; 2 LOW polish items (C2, C3) are OPTIONAL deferrals.

---

## 1. Phase scope

| Field | Value |
|---|---|
| Phase folder | `docs/specs/mvp/phases/phase-1-perception/` |
| Risk level (per impact.md) | MEDIUM (precedent-setting + token-budget brittleness) |
| Highest-risk surface | PageStateModel token-cap invariant on real-world pages + R9 first-concrete-adapter precedent |
| First-runtime constitutional activations | R9 (first concrete adapter — `BrowserEngine`); R20 (first cross-cutting impact.md authored); R4.4 (multiplicative confidence decay first applied in `SoftFilter`); R4.5 (canonical component name discipline first enforced) |
| Phase precedes/follows | precedes: 1b, 1c, 2, 5; follows: 0 |
| Estimated effort | Not pinned in plan.md (see C3) — kill-criteria triggers reference >2hr per task for T013 + T015 |

---

## 2. Step 1 — Read-order findings

No read-order findings. README → spec → impact → plan → tasks → checklists read coherently. v0.3 polish (Session 7 analyze) cleaned up the prior stale citations and operator inconsistencies; on second pass, the artifacts compose cleanly.

| ID | Severity | Location | Finding | Recommended action |
|---|---|---|---|---|
| — | — | — | None | — |

---

## 3. Step 2 — Per-artifact judgment findings

### README.md

No judgment findings. Goal statement is concrete and stakeholder-readable ("calling `contextAssembler.capture(url)` returns a complete `PageStateModel`..."). Exit criteria are 5 verifiable bullets. Depends-on / blocks list cross-checks against INDEX.md row 1.

### spec.md

One observation, no findings: R-09 (post-v0.3) cites REQ-BROWSE-PERCEPT-004 for screenshot fallback — but PERCEPT-004 in `06-browse-mode.md:374` couples screenshot fallback **with Mode C routing**. Phase 1's R-09 covers only the screenshot-generation half; Mode C routing is deferred (out of scope per spec.md:257). The citation is technically correct (Phase 1 ships the capability that PERCEPT-004 will trigger) but a future reader may expect Mode C wiring in Phase 1 and not find it. Acceptable because Out of Scope explicitly lists "MCP tools — Phase 2" and Mode C is downstream. No action needed.

### impact.md

**J1 (MEDIUM)** — *Forward Contract misses Phase 1b + Phase 1c as direct consumers.*

`impact.md §Forward Contract` lists Phase 2, Phase 5, Phase 7 consumers explicitly but omits Phase 1b (Perception Extensions v2.4) and Phase 1c (PerceptionBundle Envelope v2.5). Per `tasks-v2.md:236`, `T1B-001 PricingExtractor` has `dep: T013, T014` — direct PageStateModel consumer. Per `INDEX.md:31`, Phase 1c "wraps PageStateModel into a PerceptionBundle envelope" — direct schema-extension consumer. A Phase 1b/1c implementer reading `impact.md` to understand "what depends on PageStateModel" will not find their phase listed.

This is a discoverability/documentation finding, not a spec-correctness finding — the implementations will work because tasks-v2.md captures the dep edge. But the Forward Contract section is the canonical "who consumes this contract" map; missing Phase 1b/1c there means future cross-phase impact analyses (when PageStateModel evolves) may overlook them.

**Severity: MEDIUM** — affects discoverability of cross-phase impact, not correctness. Mitigation: append Phase 1b + 1c rows to the Forward Contract table (5-minute v0.3.1 polish). Deferred per condition C2 below.

### plan.md

**J2 (LOW)** — *No total effort estimate.*

`plan.md` documents kill-criteria triggers ("> 2hr for T013 + T015") but doesn't sum a phase-level engineering-hour estimate. Phase 0b's plan included `~26h engineering + ~7h verifier`; Phase 1 doesn't. This is calibration data future you will want when sequencing weeks. Optional polish.

### tasks.md

No judgment findings. Dependency graph (lines 320-343) is acyclic; TDD ordering (T-PHASE1-TESTS + T014 first) is preserved per R3.1; kill criteria attached to all >2hr / shared-contract tasks (T013, T015, T014, T010, T007). v0.3 frontmatter sync correctly attributes M3 propagation to T008 header.

### checklists/requirements.md

All 17 checkboxes ticked. No frontmatter version (consistent with Phase 0 + 0b pattern). No findings.

---

## 4. Step 3 — Doom check ★

**Highest-risk surface chosen:** PageStateModel token-cap invariant on real-world pages (per Phase 1 calibration row in template; aligns with impact.md `risk_level: MEDIUM` rationale at lines 145-150).

**Doom-check question asked:** *If a contractor joined the team next week and ran Phase 1's workflow blindly on amazon.in (the integration test's hardest fixture), where would the rails fail?*

**Walk-through:**

The contractor reads README, runs T-PHASE1-TESTS + T014, implements T006-T012 in dependency order, lands T013 (ContextAssembler), then runs T015 (integration test) against amazon.in. The integration test asserts wall-clock < 60s for 3 sites and PageStateModel < 1500 tokens each. The contractor uses default Playwright timeouts everywhere because no Phase 1 artifact pins them.

`page.goto('https://www.amazon.in')` defaults to `'load'` event with a 30s timeout. amazon.in serves heavy JavaScript with progressive rendering; the `'load'` event can fire 15-25s in. `mutationMonitor.observe()` then waits up to 10s for settle (per AC-06). `accessibilityExtractor.extract()` calls `page.accessibility.snapshot({ interestingOnly: false })` — on a deep amazon.in DOM, this can take 3-5s. `screenshotExtractor.capture()` adds 1-2s. Per-site total: 30 + 10 + 5 + 2 ≈ **47s in worst case for a single site**.

For 3 sites at worst case: **141s** — well over the **60s** AC-10 / NF-Phase1-03 budget. The integration test flakes; T015 fails; Phase 1 acceptance gate fails; downstream phases stall.

The existing kill criterion for T015 ("Wall-clock > 60s for 3 sites → ContextAssembler is too slow") is **reactive** — it triggers AFTER the flake, telling the contractor to investigate. There is no **preventive** budget pinning in plan.md or tasks.md. A contractor with default Playwright instincts will not arrive at the right per-step timeout values and will spend a debugging session to back into them.

The mitigation is straightforward: the contractor (or anyone re-implementing T015 in a future phase rev) needs an explicit per-step timeout table summing to ≤ 20s per site (giving 3× sites = 60s with margin). Example budget:

- `page.goto({ waitUntil: 'domcontentloaded', timeout: 10000 })` — fail-fast on cold-start CDN
- `mutationMonitor.observe({ timeoutMs: 5000 })` — settle window
- `accessibilityExtractor.extract()` — soft-budget 3s; warn if exceeded
- `screenshotExtractor.capture()` — soft-budget 1s; sharp resize is the slow path
- `tokenize()` — sub-second; not in critical path

**Findings:**

| ID | Severity | Failure path | Why existing rails miss it | Recommended mitigation |
|---|---|---|---|---|
| **D5** | MEDIUM | Per-step Playwright timeout budget for T015 (page.goto + mutation settle + AX extract + screenshot) is not pinned in any Phase 1 artifact. Default Playwright `'load'` + 30s × 3 sites ≈ 141s worst-case → exceeds NF-Phase1-03 60s budget. Existing T015 kill criterion is reactive, not preventive. | plan.md "Phase 0 Research" item 4 settles MutationMonitor to 10s; no other timeout is pinned. AC-10 budgets total wall-clock but doesn't decompose. Tasks.md T013 caps single capture at 30s but T015 doesn't reference that cap. | At T015 implementation time, define explicit per-step timeout table summing to ≤ 20s per site (≤ 60s for 3 sites). Document in plan.md §Phase 1 Design or T015 brief. **Captured as binding condition C1 below.** |

The other doom-walk paths (Playwright version drift, headed-vs-headless divergence, MutationObserver injection race, post-shrink token leak to Phase 7) all have existing mitigations (Zod schema parses, spec assumptions, deterministic shrink ladder, downstream consumer responsibility). D5 is the only judgment-grade gap.

---

## 5. Step 4 — Kill criteria validation

| Trigger | Source (tasks.md §) | Concrete action defined? | Realistic threshold? | Verdict |
|---|---|---|---|---|
| token_budget_pct: 85 | default §Default Kill Criteria | ✅ snapshot WIP / log / escalate | ✅ | REAL |
| wall_clock_factor: 2x | default | ✅ same | ✅ | REAL |
| iteration_limit: 3 | default | ✅ same | ✅ | REAL |
| previously-passing test breaks | default | ✅ snapshot/log/escalate | ✅ | REAL |
| pnpm test:conformance fails after task complete | default | ✅ same | ✅ | REAL |
| implementation reveals spec defect | default (R11.4 path) | ✅ fix spec first | ✅ | REAL |
| Playwright type leaks outside R9 boundary | default | ✅ snapshot/log/escalate | ✅ — observable via grep | REAL |
| PageStateModel exceeds 1500 tokens for control fixture (example.com) | default | ✅ same | ✅ — example.com is degenerate; failure here = real bug | REAL |
| diff introduces forbidden pattern (any/console.log/SDK-import-outside-adapter/disabled-test) | default | ✅ same | ✅ | REAL |
| task expands beyond plan.md file table | default | ✅ same | ✅ | REAL |
| ESLint introduces unsupported rules | default | ✅ same | ✅ — Phase 4 scope | REAL |
| T007: any attempt to add `playwright-extra` dep | T007 inline | ✅ STOP, v1.1 scope | ✅ | REAL |
| T010: any additive confidence math (R4.4 violation) | T010 inline | ✅ STOP, R4.4 violation | ✅ — grep enforced | REAL |
| T013: PageStateModel exceeds 1500 tokens for example.com | T013 per-task | ✅ investigate sub-schema bloat (likely AccessibilityTree) | ✅ | REAL |
| T013: Session leaks (zombie Chromium after capture()) | T013 per-task | ✅ check `finally { session.close() }` | ✅ — observable via `ps aux` count delta | REAL |
| T013: Wall-clock > 30s for single capture() on example.com | T013 per-task | ✅ perception extractor inefficiency | ✅ | REAL |
| T014: any attempt to populate `_extensions` from Phase 1 code | T014 inline | ✅ STOP, Phase 7+ scope | ✅ — grep enforced | REAL |
| T015: Wall-clock > 60s for 3 sites | T015 per-task | ✅ ContextAssembler is too slow | ⚠️ — see D5 (reactive only; no preventive budget) | REAL but reactive |
| T015: amazon.in CAPTCHA wall produces invalid PageStateModel (e.g., 0 nodes) | T015 per-task | ✅ re-evaluate spec assumption | ✅ | REAL |
| T015: Shopify demo URL flakes 3+ times | T015 per-task | ✅ mark `skip` rather than retry | ✅ | REAL |

**Findings:** All kill criteria have concrete actions and realistic thresholds. T015 wall-clock criterion is REAL but reactive — see D5 above for the preventive complement (BINDING condition C1).

---

## 6. Step 5 — Recommendation

### Recommendation: **APPROVE (with conditions)**

### Rationale

1. Zero CRITICAL / zero HIGH findings.
2. Zero read-order findings (Step 1) — v0.3 polish from Session 7 analyze cleaned up the surface inconsistencies that would have surfaced here.
3. One MEDIUM judgment finding (J1 — impact.md Forward Contract gap) is documentation-grade, not correctness-grade; OPTIONAL polish.
4. One LOW judgment finding (J2 — no total effort estimate) is calibration-grade; OPTIONAL polish.
5. One MEDIUM doom finding (D5 — Playwright timeout budgeting under-specified for T015) has REAL kill-criterion mitigation but only reactively; converting to preventive at T015 impl time is BINDING.
6. All 19 kill criteria validated REAL with concrete actions and realistic thresholds.
7. R9 first-adapter precedent is correctly framed (re-typed `BrowserPage` wrapper prevents Playwright type leakage; impact.md Provenance section traces R9 to Cockburn ports + adapters per R22.5).
8. R20 impact.md authored at v0.3 with both shared contracts (`BrowserEngine` + `PageStateModel`) properly captured (additive, breaking: false, risk MEDIUM).

This is the same APPROVE-with-conditions pattern used for Phase 0b's review (D1+D2 BINDING + D3 OPTIONAL).

### Conditions on approval

| ID | Severity | Condition | Owner | When |
|---|---|---|---|---|
| **C1** | BINDING (mitigates D5) | T015 implementation MUST define explicit per-step Playwright timeout budgets (page.goto, mutation settle, AX extract, screenshot, tokenize) summing to ≤ 20s per site (≤ 60s for 3 sites). Document the budget in T015 brief or in plan.md §Phase 1 Design at impl time. Use `waitUntil: 'domcontentloaded'` not `'load'` for `page.goto` to avoid SPA progressive-render hang. | T015 implementer | During T015 impl (Phase 1 Week 2 per implementation-roadmap.md) |
| **C2** | OPTIONAL (mitigates J1) | Append Phase 1b + Phase 1c rows to impact.md §Forward Contract — Phase 1b T1B-001..T1B-012 import `PageStateModel` + extend perception layer; Phase 1c T1C-001..T1C-012 wrap `PageStateModel` into `PerceptionBundle` envelope. Could be a v0.3.1 patch. | impact.md author | Anytime before Phase 1b/1c implementation begins (week 2-3) |
| **C3** | OPTIONAL (mitigates J2) | Add per-task hour estimate + phase-level total to plan.md §9 (or equivalent). Phase 0b had `~26h engineering + ~7h verifier`; Phase 1 should too for week-sequencing calibration. | plan.md author | Anytime; not blocking implementation |

### What user does next

1. Bump `status: draft → approved` on `phase-1-perception/{spec,plan,tasks,impact}.md`. README is already at `status: approved` v1.0.
2. Commit message includes: `(R17.4 review approved per phase-1-perception/review-notes.md; conditions C1 BINDING / C2 OPTIONAL / C3 OPTIONAL)`.
3. Surface C1 to whichever session implements T015 (week 2 per implementation-roadmap.md). C2 + C3 are anytime polish.
4. Update INDEX.md Phase 1 row status remains ⚪ "not started" (R17 lifecycle: status flips ⚪ → 🟡 only when first task code lands per CLAUDE.md §8c).
5. Optionally run `/speckit.analyze` again on Phase 1 v0.3 to confirm zero regressions before bumping status. (Skippable since the v0.3 polish was the analyze-driven fix and no body changes happened beyond the documented set.)

---

## 7. Sign-off

| Field | Value |
|---|---|
| Reviewer name | Sabari (engineering lead) |
| Reviewed on | 2026-04-30 |
| Reviewer role | engineering lead (solo-team self-review with adversarial doom-check discipline per template Calibration §) |
| Time spent | ~45 min (MEDIUM-risk phase per template guidance) |
| Recommendation | APPROVE (with conditions C1 BINDING + C2/C3 OPTIONAL) |
| Constitutional rules verified | R1-R26 (with attention to: R4 Browser Agent Rules, R4.4 multiplicative decay, R4.5 canonical component names, R9 first concrete adapter, R10.1-R10.6 file/function size + Pino, R11.2 REQ-ID traceability, R13 forbidden patterns including temperature=0 stale-xref correction, R20 impact.md, R23 kill criteria) |
| Status transition authorized | YES, draft → approved (per APPROVE recommendation; conditions C1 BINDING does not block approval — it's an implementation-time requirement on T015) |
| Reviewer signature | Reviewed independently of authoring; v0.3 polish (M1-M4 + L1-L7) applied earlier this session resolved all analyze-grade findings; doom check ran fresh on PageStateModel + R9 first-adapter surfaces; surfaced 1 MEDIUM doom finding (D5) on Playwright timeout budgeting that gets BINDING condition C1 at T015 impl time. |

---

## Cross-references

- [phase-review-prompt.md](../../templates/phase-review-prompt.md) v1.0 — the template that generated this report
- [`/speckit.analyze`](../../../../.claude/skills/speckit-analyze/) — mechanical consistency check (ran earlier this session; v0.3 polish applied)
- [Constitution R17.4](../../constitution.md) — lifecycle gate this review supports
- [CLAUDE.md §8d](../../../../CLAUDE.md) — phase review invocation guidance
- [`phase-1-current.md` rollup](phase-1-current.md) — to be authored at phase exit (R19); this review will be cited there
- [phase-0b-heuristics/review-notes.md](../phase-0b-heuristics/review-notes.md) v1.0 — prior review using same template (Phase 0b Session 6)

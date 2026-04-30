---
title: Neural MVP Implementation Roadmap (Walking Skeleton)
artifact_type: roadmap
status: draft
version: 0.3
created: 2026-04-29
updated: 2026-04-29
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: v0.1 (in-place — see delta block); v0.2 in-place delta
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (§2.4 success criteria, §10 boundaries)
  - docs/specs/mvp/constitution.md (R3 TDD, R5.3, R6, R7.4, R10/R13, R17 lifecycle, R20 impact, R23 kill criteria)
  - docs/specs/mvp/phases/INDEX.md v1.3 (canonical phase order)
  - docs/specs/mvp/phases/phase-{0,0b,1,2,3,4,4b,5,5b,6,7,8,9}-*/tasks.md (Spec Kit-generated, updated templates) — ALL 15 phase folders loaded
  - docs/specs/mvp/CLAUDE.md (file-organization conventions)

req_ids: []

impact_analysis: null
breaking: false
affected_contracts: []

delta:
  v0_3:
    new:
      - Weeks 7-12 detail (replaces "Weeks 8-12 — Sketch pending v0.3" placeholder)
      - Phase 5b sequencing folded into weeks 9-11 (multi-viewport wk 9, triggers wk 10, cookie+integration wk 11)
      - Phase 3 verification folded into week 8 (small phase; lands alongside Phase 5)
      - All 263 MVP tasks now cherry-picked into the weekly slice plan
      - Cross-week R20 impact.md surface fully enumerated for weeks 7-12
    changed:
      - "Weeks 8-12 — Sketch pending v0.3" placeholder replaced with detailed weekly sections (week 7 already in v0.2)
      - §8 Promotion table verified against full task corpus; one row clarified (T-SKELETON-008 has two-stage promotion: wk 3 basic DB write → wk 11 two-store warm-up aware)
    impacted: []
    unchanged:
      - 12-week cadence + slice structure (still aligned with v0.2 §4 table)
      - 10 T-SKELETON tasks, stub conventions, two-tier test strategy, frontmatter discipline
      - All phase folder artifacts; tasks-v2.md; constitution; PRD
  v0_2:
    new:
      - Methodology pivot from "phase-cherry-pick" (v0.1) to "walking skeleton + progressive de-stubbing"
      - Stub conventions section (codifies what makes a "complete-but-stubbed" implementation)
      - T-SKELETON-NNN task IDs introduced (sequencing-only; not in any phase tasks.md)
      - 12-week slice table — every week ships a working `pnpm cro:audit` demo
      - Two-tier test strategy (contract tests always run; behavior tests `.skip()` until real impl)
      - Promotion table — explicit stub-to-real mapping per week
    changed:
      - v0.1 → v0.2 — bi-weekly stakeholder demo cadence replaced with weekly demo cadence
      - First grounded finding moved from week 8 (v0.1) to week 7 (v0.2) under skeleton model
      - Cherry-pick task referencing supplemented with stub-replacement contract
    impacted:
      - No phase artifact modified
      - tasks-v2.md v2.3.3 unchanged (still legacy reference catalog)
      - constitution.md R1-R26 still apply per task — including to stubs (R5.3, R6 enforced on stub data)
    unchanged:
      - All 15 phase folder spec/plan/tasks artifacts
      - Phase order in INDEX.md v1.3 (the SEQUENCING is overlaid; the phase definitions are unchanged)

governing_rules:
  - Constitution R3 (TDD applies to stubs and real impls)
  - Constitution R5.3 + GR-007 (banned phrasing applies to stub findings)
  - Constitution R6 (IP boundary applies to stub heuristics — synthetic fixtures only)
  - Constitution R10/R13 (temperature=0 — applies once real LLM lands week 5)
  - Constitution R17 (lifecycle states for this artifact)
  - Constitution R20 (impact.md required for stub-to-real transitions on shared contracts)
  - Constitution R23 (kill criteria per slice)
  - PRD §10.10 (Comprehension-debt pacing)

description: "Walking-skeleton implementation overlay — week 1 ships a stubbed end-to-end pipeline; each subsequent week replaces one stub with its real implementation. Stubs live in real file paths and gradually de-stub in place; same `pnpm cro:audit` demo surface every week."
---

# Neural MVP Implementation Roadmap — Walking Skeleton

> **Summary (~110 tokens):** Week 1 ships a thin tracer-bullet end-to-end pipeline using stubs at every layer, all living in their real file paths. Each subsequent week replaces ONE stub with the real implementation per the corresponding phase task(s). Stakeholders run the SAME `pnpm cro:audit` command every week; output shape is constant from week 1, but more of it is "real" each week. First real Claude evaluate at week 5; first grounded finding at week 7; multi-page audit week 8; PDF week 10; T175 acceptance week 12. This file is overlay-only — no phase artifact is modified.

---

## 1. Purpose & methodology pivot

**v0.1 (superseded)** tried to cherry-pick task IDs across phases at bi-weekly cadence. It surfaced an architectural reality: Neural's analytical "wow" output (grounded findings + PDF) lives at the END of a layered dependency graph (Phases 7-9). Cherry-picking can't escape that — weeks 1-5 demos kept being "infrastructure plumbing" rather than "Neural working."

**v0.2** adopts the **walking skeleton** pattern (Pragmatic Programmer). Week 1 builds a thin end-to-end pipeline using stubs at every layer. Each subsequent week, ONE stub becomes the real implementation per its phase task(s). The demo command (`pnpm cro:audit`) produces Neural-shaped output from week 1 — but each week, more of it is genuinely real.

### Why this works for Neural specifically

1. **Stakeholders see Neural's output shape from day one.** They watch the same artifact (a "finding") become more credible every week.
2. **Constitution rules still apply per-task.** Stubs are *complete-but-stubbed* implementations (see §3) — not half-finished, not bypasses.
3. **Critical risk gates fire earlier:** first real Claude call at week 5 (was week 6 in v0.1); first grounded finding at week 7 (was week 8 in v0.1).
4. **Test discipline is preserved** via two-tier strategy (§5).

### What this is NOT

- NOT a separate codebase or `--skeleton` CLI flag. Stubs occupy real file paths and gradually de-stub in place.
- NOT a license to bypass spec-driven development — every stub task and replacement task references its REQ-IDs and acceptance criteria.
- NOT a license to ship "vibe code" — stubs are typed, Zod-validated, deterministic, and tested.

---

## 2. Cadence

| Cadence | Audience | Artifact polish |
|---|---|---|
| **Weekly demo** (every week, end-of-week) | Engineering team + REO Digital leadership + future pilot consultants | Polished — recorded, scripted, run against pinned URL set |

**No separate engineering vs stakeholder cadence in v0.2** — every week is a demo. Engineering check-ins fold into the same Wednesday slot.

**Demo prep cost:** ~half a day per week. Acceptable because the demo command stays constant; only the underlying implementation changes.

---

## 3. Stub conventions (CRITICAL — read before authoring any stub)

A stub is **complete-but-stubbed**: it implements the full real contract (interface shape, Zod-validated outputs, deterministic behavior, error handling) but hardcodes the data instead of computing it.

### Mandatory stub characteristics

| Requirement | Rationale |
|---|---|
| Lives at the real file path (e.g., `packages/agent-core/src/browser-runtime/BrowserManager.ts`) | "Default codepath gradually de-stubs in place" |
| Implements the same TypeScript interface + Zod schemas the real impl will satisfy | Contract conformance verified weekly |
| Returns deterministic hardcoded data (no Math.random, no Date.now in core paths) | Reproducibility (R10/NF-006) |
| Tagged with `// TODO(skeleton-WkN): replace with real impl per <task-id>` at the function/class level | Replacement clearly traceable |
| Passes contract tests (see §5) | TDD discipline (R3.1) |
| Has a behavior test marked `.skip()` with `// REQ-<ID>: un-skip when real impl lands week N` | Behavior coverage queued |
| Stub data adheres to all constitution invariants (no banned phrasing per R5.3, no real heuristic content per R6) | No silent rule violations |

### Forbidden stub patterns

- ❌ Stub that throws `NotImplementedError` (R3.3 forbids broken paths in main)
- ❌ Stub with conversion predictions in fake findings (R5.3 + GR-007 absolute ban — applies even to stubs)
- ❌ Stub that uses real heuristic content from `heuristics-repo/` (R6 — use synthetic fixtures from `tests/fixtures/heuristics/` only)
- ❌ Stub bypassing Zod validation ("it's just a stub")
- ❌ Stub that calls real external APIs (no Anthropic, no Playwright in stub bodies — those are what's being stubbed)
- ❌ Stub that violates R7.4 by writing to append-only tables before Phase 4 schema lands (week 3)

### Stub-to-real promotion: when does R20 apply?

R20 (impact.md required for shared-contract changes) applies when the STUB-TO-REAL transition touches:
- AnalyzePerception schema
- PageStateModel schema
- AuditState
- Finding lifecycle types
- Adapter interfaces (LLMAdapter, StorageAdapter, BrowserEngine, ScreenshotStorage, HeuristicLoader, NotificationAdapter, DiscoveryStrategy)
- DB schema
- MCP tool interfaces
- Grounding rule interfaces

In practice: most stub-to-real transitions in weeks 2-12 hit at least one of these. **Treat R20 as default-on for stub-to-real PRs.** The impact.md may be short ("breaking: false; migration: stub data replaced by computed data; affected modules: <list>") but it MUST exist.

---

## 4. 12-week slice overview

| Wk | What becomes REAL this week | `pnpm cro:audit --url=<URL>` produces… | First-time gates triggered |
|---|---|---|---|
| 1 | T-SKELETON-001..010 — stubbed end-to-end pipeline + Phase 0 setup | Fake but Neural-shaped finding to terminal — "this is the output shape" | R3.1 TDD baseline |
| 2 | **Real browser + perception** (Phase 1: T006-T015) | Real PageStateModel feeding still-stubbed pipeline | R9 first adapter (Playwright) |
| 3 | **Real DB persistence** (Phase 4 partial: T070, T074, T071, T072) | Findings persisted to real Postgres + RLS-enforced + audit_events stream | R7.1, R7.2, R7.4 first activations |
| 4 | **Real heuristic engine** (Phase 6: T101-T112) + **first 5-10 real heuristics** (Phase 0b: T103 partial) | Real heuristic IDs flow into still-stubbed evaluate; R6 transport spy verifies redaction | **R6 first runtime activation** |
| 5 | **Real Claude evaluate** (Phase 4 T073 + Phase 7 T117-T119 + Phase 4b T4B-013 + Phase 2 MCP subset) | First REAL Claude raw findings to terminal | **R10/R13 + R6 LangSmith + R14.1 first activations ★ first risk gate** |
| 6 | **Real self-critique** (Phase 7 T120-T121, R5.6 separate LLM call) | Critique verdicts visible: KEEP/REVISE/DOWNGRADE/REJECT; ~30% raw findings rejected | R5.6 first activation |
| 7 | **Real grounding** (Phase 7 T122-T130, all 9 rules incl. GR-012) | First GROUNDED finding | **★ second critical risk gate ★** |
| 8 | **Real multi-page audit** (Phase 5 + Phase 5b + Phase 8 partial) — T148 fixture | example.com 3-page audit → grounded findings table | Phase 8 acceptance starts |
| 9 | **Real annotation + scoring + cross-page patterns** (Phase 7 T131-T134 + Phase 8 T139-T148) | Annotated screenshots + 4D priorities + PatternFinding when 3+ pages violate same heuristic | Phase 8 EXIT GATE |
| 10 | **Real branded PDF** (Phase 9 T156-T168 + T245-T249) | PDF in `./out/` — 8 sections per F-018 | **R6 channels 3+4 first activation** (Hono API + Next render redaction) |
| 11 | **Real dashboard + warm-up + cross-page LLM patterns + email** (Phase 9 T169-T173 + T260-T261 + T163) | Consultant reviews held findings in dashboard; email fires on completion | F-016 warm-up first runtime |
| 12 | **T175 final acceptance + observability dashboard** (Phase 9 T174-T175 + T239-T244) | bbc.com 2-page polished MVP — full pipeline + PDF + dashboard + email + 22-event taxonomy | **★ MVP COMPLETE gate ★** |

---

## 5. Test strategy under walking skeleton

Two tiers, both required:

### Tier A — Contract tests (always run, every week)

- Verify interface shape: return types match Zod schemas, arguments accepted, basic happy path doesn't throw
- Pass for BOTH stub and real impls
- Live at `packages/agent-core/tests/contract/<component>.test.ts`
- Authored before week 1 stub lands; never removed

### Tier B — Behavior tests (`.skip()` until real impl arrives)

- Verify real behavior (real Chromium opens; real Claude returns 4+ findings; real RLS blocks cross-client query)
- Authored alongside contract tests but marked:
  ```typescript
  test.skip('REQ-BROWSE-NODE-003: real Chromium actually launches — un-skip in week 2', async () => { ... })
  ```
- Un-skipped in the same commit that replaces the stub with real impl
- Run as part of `pnpm test` once un-skipped

### Why two tiers

- **Test suite stays green every week** — no broken-test debt
- **Un-skip count is a visible progress metric** — "X of Y behavior tests active this week"
- **TDD discipline preserved (R3.1)** — both stub and real are written test-first

### Conformance suite (Phase-level, R21)

Phase conformance tests (`pnpm test:conformance -- <component>`) are written when the corresponding phase ships. They reference REQ-IDs and live at `packages/agent-core/tests/conformance/`. Walking skeleton does not change how conformance tests are authored — they're written against real implementations as those land.

---

## 6. Week 1 — T-SKELETON-NNN task definitions

These tasks are **sequencing-only** and live ONLY in this roadmap. They do not appear in any phase tasks.md or in tasks-v2.md.

### T-SKELETON-001 — Skeleton CLI orchestrator

- **dep:** T001-T003 (Phase 0 monorepo + agent-core + CLI)
- **files:** `packages/agent-core/src/audit.ts` (NEW — main audit() function), `apps/cli/src/commands/audit.ts` (NEW — subcommand wired to audit())
- **acceptance:** `pnpm cro:audit --url=<URL>` invokes `audit({ url, ...defaults })`; output written to `./out/<slug>-audit.txt`; exit 0 on happy path; exit non-zero on input validation failure
- **stub characteristics:** orchestrator is REAL; calls 8 stub functions in order
- **promotion:** stays real through week 12 (this is the orchestrator, not a stub)
- **kill criteria:** default block

### T-SKELETON-002 — stubBrowserCapture

- **dep:** T001
- **files:** `packages/agent-core/src/browser-runtime/BrowserManager.ts` (NEW — stubbed)
- **acceptance:** `BrowserManager.capture(url): Promise<PageStateModel>` returns a hardcoded PageStateModel JSON validating against `PageStateModelSchema` (Phase 1 T014 schema — must land in week 1 alongside this stub for contract conformance)
- **stub data:** loaded from `packages/agent-core/tests/fixtures/perception/example-com.json`
- **promotion:** replaced by Phase 1 T006+T013 in **week 2** — R20 impact.md required (touches PageStateModel contract surface; v0.1 spec already exists)
- **kill criteria:** default block + stub returns malformed PageStateModel → STOP

> **Cross-week ordering note:** T014 (PageStateModel schema) MUST land in week 1 alongside T-SKELETON-002 for contract test feasibility. T014's Phase 1 task position permits early landing.

### T-SKELETON-003 — stubLoadHeuristics

- **dep:** T-SKELETON-002 (uses fixtures dir)
- **files:** `packages/agent-core/src/analysis/heuristics/loader.ts` (NEW — stubbed)
- **acceptance:** `HeuristicLoader.loadAll(): Promise<HeuristicKB>` returns 3 synthetic heuristics from `packages/agent-core/tests/fixtures/heuristics/skeleton-{1,2,3}.json` (NEW fixtures; `body` text marked "TEST FIXTURE — not a real heuristic" per R6)
- **stub data:** synthetic; conforms to HeuristicSchemaExtended (T101 schema — also lands week 1 for contract feasibility)
- **promotion:** replaced by Phase 6 T106 in **week 4** — R20 impact.md (HeuristicLoader interface)
- **kill criteria:** default block + stub heuristic body content appears in any log → STOP (R6 violation even on stub data)

> **Cross-week ordering note:** T101 (HeuristicSchemaExtended) MUST land in week 1 alongside T-SKELETON-003.

### T-SKELETON-004 — stubEvaluate

- **dep:** T-SKELETON-002, T-SKELETON-003
- **files:** `packages/agent-core/src/analysis/nodes/EvaluateNode.ts` (NEW — stubbed)
- **acceptance:** `EvaluateNode.run(perception, heuristics): Promise<RawFinding[]>` returns 2 hardcoded raw findings (one per fixture page-state); each finding tagged `{ source: 'skeleton-stub' }` for telemetry
- **stub data:** hardcoded; must NOT contain banned phrasing (R5.3 + GR-007) — verify via static-check unit test on the stub data
- **promotion:** replaced by Phase 7 T117+T119 (real Claude call) in **week 5** — R20 impact.md (EvaluateNode behavior + LLMAdapter activation)
- **kill criteria:** default block + stub finding contains banned phrasing → STOP (R5.3 violation)

### T-SKELETON-005 — stubCritique

- **dep:** T-SKELETON-004
- **files:** `packages/agent-core/src/analysis/nodes/SelfCritiqueNode.ts` (NEW — stubbed)
- **acceptance:** `SelfCritiqueNode.run(rawFindings): Promise<CritiqueFinding[]>` returns input passthrough with verdict='KEEP' on every finding
- **promotion:** replaced by Phase 7 T120+T121 (real R5.6 separate LLM call) in **week 6** — R20 impact.md
- **kill criteria:** default block

### T-SKELETON-006 — stubGround

- **dep:** T-SKELETON-005
- **files:** `packages/agent-core/src/analysis/grounding/EvidenceGrounder.ts` (NEW — stubbed)
- **acceptance:** `EvidenceGrounder.ground(critiqued): Promise<{ grounded, rejected }>` returns input passthrough — all critiqued findings → grounded; rejected[] empty
- **promotion:** replaced by Phase 7 T122-T130 (9 grounding rules) in **week 7** — R20 impact.md (Finding lifecycle gates)
- **kill criteria:** default block

### T-SKELETON-007 — stubAnnotate

- **dep:** T-SKELETON-006
- **files:** `packages/agent-core/src/analysis/nodes/AnnotateNode.ts` (NEW — stubbed)
- **acceptance:** `AnnotateNode.run(grounded): Promise<grounded>` no-op — passes findings through; no screenshot annotation
- **promotion:** replaced by Phase 7 T131 (real Sharp annotation) in **week 9** — R20 impact.md
- **kill criteria:** default block

### T-SKELETON-008 — stubStore

- **dep:** T-SKELETON-007
- **files:** `packages/agent-core/src/analysis/nodes/StoreNode.ts` (NEW — stubbed)
- **acceptance:** `StoreNode.run(findings): Promise<void>` writes findings to `./out/<slug>-findings.json` (no DB — Phase 4 not yet landed)
- **promotion:** replaced by Phase 7 T132 (real PostgresStorage write) in **week 3** when Phase 4 schema lands — R20 impact.md (DB schema + RLS surface)
- **kill criteria:** default block + stub attempts DB write before Phase 4 lands → STOP

### T-SKELETON-009 — stubReport

- **dep:** T-SKELETON-008
- **files:** `packages/agent-core/src/delivery/Report.ts` (NEW — stubbed)
- **acceptance:** `Report.render(audit): Promise<string>` returns plain-text report; written to `./out/<slug>-audit.txt` by orchestrator
- **promotion:** replaced by Phase 9 T245-T249 (HTML template + Playwright `page.pdf()`) in **week 10** — R20 impact.md
- **kill criteria:** default block

### T-SKELETON-010 — Skeleton acceptance test (TDD R3.1)

- **dep:** T-SKELETON-001..009
- **files:** `tests/acceptance/walking-skeleton.spec.ts` (NEW)
- **acceptance:** Playwright Test asserting `pnpm cro:audit --url=https://example.com` exits 0 + writes `./out/example-com-audit.txt` with at least 1 fake finding line; runs in <30s
- **stub characteristics:** the test itself is REAL; it just runs against a stubbed pipeline in week 1
- **promotion:** stays real through week 12; weeks 5+ assert on real Claude output by un-skipping behavior tests
- **kill criteria:** default block

---

## 7. Per-week deliverables (weeks 1-6 detailed; weeks 7-12 sketch pending v0.3)

### Week 1 — Skeleton ships

**Phase tasks landing this week:**
- T-PHASE0-TEST + T001-T005 (Phase 0 setup)
- T014 forward-pulled from Phase 1 (PageStateModel schema — needed for T-SKELETON-002 contract)
- T101 forward-pulled from Phase 6 (HeuristicSchemaExtended — needed for T-SKELETON-003 contract)
- T0B-001, T0B-002, T0B-003, T0B-005 (Phase 0b infra; T0B-004 now unblocked since T101 lands week 1)
- T-SKELETON-001..010

**Wednesday demo:**

```bash
$ pnpm cro:audit --url=https://example.com
[skeleton] orchestrator started audit_run=skl-001
[skeleton] perception captured (stub data — example-com.json fixture)
[skeleton] heuristics loaded (3 synthetic)
[skeleton] evaluate produced 2 raw findings (stub)
[skeleton] critique passed 2/2 (stub passthrough)
[skeleton] grounded 2/2 (stub passthrough)
[skeleton] annotate (no-op)
[skeleton] stored to ./out/example-com-findings.json
[skeleton] report ./out/example-com-audit.txt (plain text)
✓ Audit completed in 0.3s
```

Open `./out/example-com-audit.txt` — show stakeholders the Neural-shaped output. Make it explicit: every layer is currently stubbed; in 11 weeks, every layer will be real, and this same command will produce a real grounded CRO audit.

### Week 2 — Browser + perception become real

**Phase tasks landing:**
- T-PHASE1-TESTS, T006, T007, T008, T009, T010, T011, T012, T013, T015 (Phase 1 in full; T014 already landed week 1)

**Stub replaced:** T-SKELETON-002 → real BrowserManager + ContextAssembler

**Wednesday demo:** same `pnpm cro:audit --url=https://example.com`. Now Chromium actually opens; real AX-tree captured; real screenshot. Pipeline downstream still stubbed but consumes real perception.

**Un-skip event:** behavior tests for browser launch, AX-tree node count, screenshot bytes ≤150KB, PageStateModel ≤1500 tokens.

### Week 3 — DB persistence becomes real

**Phase tasks landing:**
- T-PHASE4-TESTS, T-PHASE4-LOGGER, T-PHASE4-TYPES, T070, T071, T072, T074, T075, T076 (Phase 4 partial: schema + storage + observability; T073 LLM cornerstone deferred to week 5)

**Stub replaced:** T-SKELETON-008 → real PostgresStorage write; ScreenshotStorage active

**Wednesday demo:** `pnpm cro:audit --url=https://example.com` then live psql:

```sql
SELECT id, status FROM audit_runs;
SELECT event_type, ts FROM audit_events WHERE audit_run_id = '...';
SELECT id, source, observation FROM findings;  -- still stub data, but real DB
```

Show RLS enforcement (cross-client query returns 0 rows). Show append-only trigger (UPDATE attempt fails).

**R20 impact.md:** required (DB schema + RLS surface).

### Week 4 — Heuristic engine + R6 first runtime activation ★

**Phase tasks landing:**
- T-PHASE6-TESTS, T-PHASE6-LOGGER, T-PHASE6-FIXTURES, T102, T106, T107, T108, T109, T110-T112 (Phase 6 in full)
- T103 partial (~10 of ~15 Baymard heuristics from Phase 0b); T0B-004 lint CLI active
- T080, T080a (Phase 4 finish: integration test + RobotsChecker)

**Stub replaced:** T-SKELETON-003 → real HeuristicLoader

**Wednesday demo:** `pnpm cro:audit --url=https://example.com --show-heuristics`. Pipeline now loads real Baymard heuristics; pipes IDs (not body) into still-stubbed evaluate. Pino transport spy verifies R6 — zero body fragments in any log line.

**Un-skip event:** R6 conformance test (heuristic body NEVER appears in Pino logs / API responses / dashboard / LangSmith traces).

**R20 impact.md:** required (HeuristicLoader interface).

### Week 5 — First real Claude evaluate ★ first critical risk gate

**Phase tasks landing (heavy week — see week-4 forward-pull recommendation in §7):**
- T066-T069 (Phase 4 safety pillar — needed for safe MCP tool execution downstream)
- T073 (Phase 4 LLM cornerstone: LLMAdapter + AnthropicAdapter + TemperatureGuard + BudgetGate)
- **Phase 2 minimum subset for T117:** T-PHASE2-TESTS, T-PHASE2-TYPES (AnalyzePerception schema), T-PHASE2-LOGGER, T019 (MCPServer skeleton), T024 (browser_get_state), T025 (browser_screenshot), T046 (page_screenshot_full), T048 (page_analyze v2.3 — CRITICAL T117 dep), T049 (RateLimiter). Remaining 19 Phase 2 browse tools (T020-T023, T026-T045, T047, T050) deferred to **week 8** alongside Phase 5 BrowseNode.
- **Phase 4b minimum subset for T119:** T4B-001 (ContextProfile schema), T4B-002 (URLPatternMatcher), T4B-003 (HtmlFetcher), T4B-004 (JsonLdParser), T4B-005 (BusinessArchetypeInferrer), T4B-006 (PageTypeInferrer), T4B-007 (ConfidenceScorer + ProvenanceAssembler), T4B-013 (HeuristicLoader extension — CRITICAL T119 dep). Remaining 7 Phase 4b tasks (T4B-008, T4B-009, T4B-010, T4B-011, T4B-012, T4B-014, T4B-015) deferred to **week 8** alongside Phase 5 + Phase 8.
- T113-T116 (Phase 7 Block A: state + utilities — AnalysisState extension, detectPageType, assignConfidenceTier, CostTracker)
- T117 (DeepPerceiveNode — calls page_analyze MCP tool)
- T118 (Evaluate prompt template)
- T119 (EvaluateNode — first real LLMAdapter.invoke call)
- T104 (Phase 0b Nielsen ~10)

**Stub replaced:** T-SKELETON-004 → real EvaluateNode + DeepPerceiveNode

**Wednesday demo (★ first risk gate ★):** `pnpm cro:audit --url=https://example.com --no-critique --no-ground` (temp flag — removed in week 7 once full pipeline real). First REAL Claude raw findings. Show:
- LangSmith trace — heuristic IDs visible, body REDACTED (R6)
- llm_call_log row — model, tokens, cost, temperature=0 (R10/R14.1)
- Raw findings in terminal — assess subjectively: do they read like real CRO observations?

**Failure modes this catches:** Claude returns 0 findings (prompt broken), 50 findings (filter loose), banned phrasing leaks, hallucinated element refs.

**Un-skip event:** R10 TemperatureGuard, R14.1 atomic logging, R6 LangSmith channel.

**R20 impact.md:** required (LLMAdapter activation + EvaluateNode behavior).

### Week 6 — Real self-critique (R5.6 SEPARATE LLM call)

**Phase tasks landing:**
- T120 (self-critique prompt template)
- T121 (SelfCritiqueNode — separate LLM call per R5.6)
- T105 (Phase 0b Cialdini ~5 — 30-heuristic pack complete)
- T103 finish (~5 remaining Baymard)

**Stub replaced:** T-SKELETON-005 → real SelfCritiqueNode

**Wednesday demo:** `pnpm cro:audit --url=https://example.com --no-ground`. Now critique runs as separate LLM call. Show:
- llm_call_log shows 2 rows per page (evaluate + self_critique) — verifies R5.6
- Raw findings → critiqued: ~30% rejected, some downgraded, some revised
- System prompts differ across the 2 LLM calls (different personas) — code review verifies

**Un-skip event:** R5.6 enforcement test.

### Week 7 — Real grounding ★ second critical risk gate

**Phase tasks landing:**
- T122-T128 (8 grounding rules: GR-001 through GR-008)
- T129 (GR-008)
- T130 (EvidenceGrounder + GR-012 benchmark validation folded)

**Stub replaced:** T-SKELETON-006 → real EvidenceGrounder

**Wednesday demo (★ second risk gate ★):** `pnpm cro:audit --url=https://example.com`. Full 3-filter pipeline live for the first time. Show:
- 5 raw → 4 critiqued → 3 grounded (1 rejected by GR-001 element-doesn't-exist; 1 rejected by GR-007 banned phrasing)
- rejected_findings DB rows with `rule_id` + `reason`
- First REAL grounded finding to terminal

**Failure modes this catches:** grounding rejects 0% (rules too lenient), grounding rejects 95% (rules too strict), GR-007 fires on legitimate findings (false positive on banned-phrase regex).

**Un-skip event:** all 9 grounding rule conformance tests + Finding lifecycle (raw→critiqued→grounded/rejected).

### Week 8 — Real multi-page navigation + audit orchestrator (Phase 3 + Phase 5 + Phase 8 starts)

**Phase tasks landing:**
- T-PHASE3-TESTS, T-PHASE3-LOGGER, T051, T052, T053, T054, T055, T062, T063, T064, T065 (Phase 3 verification — 9 MVP tasks; small phase, lands now to unblock Phase 5 BrowseNode)
- T-PHASE5-TESTS, T-PHASE5-LOGGER, T081, T082, T083, T084, T085, T086, T087, T088, T089, T090, T091, T092, T093, T094, T095, T096 (Phase 5 — 16 MVP tasks; BrowseGraph + 5 integration tests)
- T135, T136, T137, T138, T139, T140, T141, T142 (Phase 8 Block A — full AuditState schema + nodes + edges; cross-page PatternDetector folded into T139)

**Stub replaced:** T-SKELETON-001 (orchestrator) refactored — now wraps `AuditGraph.invoke()` instead of calling stubs sequentially. The skeleton orchestrator becomes a thin CLI-side adapter; LangGraph composes the pipeline.

**Wednesday demo:** `pnpm cro:audit --url=https://example.com --pages 3`. First multi-page audit through real BrowseGraph + AnalysisGraph. Show:
- 3 pages crawled (real Playwright navigation between pages)
- Per-page audit_events stream
- Findings collected across all 3 pages (cross-page patterns not yet emitted — that fires at T139 in week 9)
- Verify-engine + multiplicative confidence-decay active per Phase 3 (R4.4 grep test green)

**Un-skip event:** Phase 5 integration tests (T092-T096) green; Phase 3 R4.4 source-grep conformance test green; AuditGraph compile + execution.

**R20 impact.md:** required (AuditState extension to full §5.7 schema — major shared-contract change; sequential PR coordination with Phase 4b T4B-011 + Phase 7 T113 per Phase 8 plan §2).

### Week 9 — Phase 7 + Phase 8 finish, T148-T150 ★ MVP COMPLETE gate ★ + Phase 5b multi-viewport

**Phase tasks landing:**
- T131, T132, T133, T134 (Phase 7 finish — AnnotateNode + StoreNode + AnalysisGraph + integration EXIT GATE)
- T143, T144, T145, T146, T147 (Phase 8 Block B — graph + PostgresCheckpointer + CLI + ConsoleReporter + JsonReporter)
- T148, T149, T150 (Phase 8 acceptance ★ MVP COMPLETE gate)
- T151-T155 (reserved slots for fixes from acceptance — escalate per plan §7 if all 5 consumed)
- T5B-001..T5B-009 (Phase 5b multi-viewport stream — opt-in feature; runs in parallel with Phase 7+8 finish)

**Stubs replaced:** T-SKELETON-007 → real AnnotateNode (T131 — Sharp severity-color overlay); T-SKELETON-008 promoted from "basic DB write" (week 3) to "DB write with grounding lifecycle" (T132); T-SKELETON-005 (stubCritique) re-verified end-to-end with real Phase 8 orchestration.

**Wednesday demo (★ MVP COMPLETE gate ★):** T148/T149/T150 acceptance run live on screen:

```bash
$ pnpm cro:audit --url https://example.com --pages 3 --output ./test-output
[gateway] audit_request_id=req-001 audit_run=ar-148
[browse] page 1/3 example.com — captured (1180 tokens)
[browse] page 2/3 example.com/about — captured
[browse] page 3/3 example.com/contact — captured
[analyze] page 1/3: 4 raw → 3 critiqued → 2 grounded (1 rejected by GR-007)
[analyze] page 2/3: 5 raw → 4 critiqued → 3 grounded
[analyze] page 3/3: 3 raw → 2 critiqued → 2 grounded
[cross-page] PatternDetector: 0 patterns (no heuristic violated on 3+ pages)
[audit_complete] 7 grounded findings, total cost $2.31, time 8m 14s
✓ Audit completed; output written to ./test-output/
```

Then:
- example.com 3-page audit: ≥3 grounded findings, ≥1 rejected, cost <$5, time <15min, annotated screenshots in `pages/*/`
- amazon.in 3-page audit: handles anti-bot gracefully (degraded acceptance acceptable per Phase 8 plan §7)
- bbc.com 3-page audit: 3 pages successfully audited
- PostgresCheckpointer resume verified — kill mid-audit, resume, zero duplicate LLM calls (NF-04)

**Un-skip event:** Phase 7 EXIT GATE (T134); Phase 8 EXIT GATE (T148+T149+T150 = AC-21 ★ MVP COMPLETE).

### Week 10 — Real branded PDF + Executive Summary + ActionPlan + Phase 5b triggers

**Phase tasks landing:**
- T156, T157, T158, T159 (Phase 9 Block A foundations — AuditRequest contract + Gateway + CLI integration)
- T161 (TemperatureGuard — extends to `executive_summary` tag)
- T162 (AccessModeMiddleware — fail-secure default `published_only`)
- T165, T166, T167, T168 (4D ScoringPipeline + IMPACT_MATRIX + EFFORT_MAP + Suppression)
- T245, T246, T247, T248, T249 (Phase 9 Block C delivery — ExecutiveSummaryGenerator + ActionPlanGenerator + Next.js HTML template + Playwright `page.pdf()`)
- T5B-010..T5B-015 (Phase 5b trigger taxonomy stream — 6 triggers + candidate discovery)

**Stub replaced:** T-SKELETON-009 → real Report (T245-T249 PDF pipeline). Plain-text TXT report (week 1 stub) becomes branded PDF.

**Wednesday demo:** `pnpm cro:audit --url=https://bbc.com --pages 2 --output ./out`. PDF emerges in `./out/bbc-com-report.pdf`. Open it, show stakeholders:
- 8 sections in correct order: Cover (REO Digital branding), Executive Summary, Action Plan (4 quadrants), Findings by Category, Cross-Page Patterns, Methodology, Appendix, Reproducibility Note
- ExecutiveSummary score (0-100) + grade (A-F) + top 5 findings + 3-5 recommended next steps
- ActionPlan 4 quadrants populated (quick_wins / strategic / incremental / deprioritized)
- PDF size ≤5MB; render <30s
- ExecutiveSummary GR-007 retry-then-fallback verified — no banned phrasing in `recommended_next_steps`

**Un-skip event:** AC-26 (PDF render <30s, ≤5MB, R2 upload); AC-22 (ExecutiveSummary GR-007 retry-then-fallback); AC-24 (ActionPlan deterministic 4-quadrant bucketing); AC-23 (ExecutiveSummary integration in AuditCompleteNode).

**R20 impact.md:** required (Report contract introduces R6 channels 3+4 first runtime activation; Hono API responses + Next.js render must redact heuristic body).

### Week 11 — Real dashboard + warm-up + email + T160 SnapshotBuilder full + Phase 5b cookie

**Phase tasks landing:**
- **T160** (Phase 9 SnapshotBuilder full composition — REPLACES Phase 8 T145 scaffold; sequential merge: T156→T158→T160 must precede T159 CLI refactor)
- T163, T164 (WarmupManager + Extended StoreNode two-store aware)
- T169, T170, T171, T172, T173 (Phase 9 Block B dashboard — Next.js 15 + shadcn/ui + Tailwind + Clerk)
- T256, T257 (DiscoveryStrategy interface + integration — Sitemap + Manual MVP; NavigationCrawl deferred to v1.1)
- T260, T261 (NotificationAdapter + EmailNotificationAdapter via Resend + integration in audit_complete)
- T5B-016, T5B-017, T5B-018 (Phase 5b cookie banner detection + policy)
- T5B-019 (Phase 5b full integration test)
- **Phase 8 T148-T150 RE-RUN** after T159 CLI refactor + T160 SnapshotBuilder land per supersession protocol

**Stubs promoted:** T-SKELETON-008 promoted from "DB write with grounding lifecycle" (week 9) to **"two-store warm-up aware"** (T164). Final form.

**Wednesday demo:** Full path live with consultant in the loop:

```
1. Consultant logs into dashboard at /console — Clerk auth gate
2. Clicks "New Audit" — submits via GatewayService (same path as CLI)
3. Watches live SSE progress on audit detail page
4. Audit completes; held findings appear in /console/review inbox sorted by priority
5. Consultant clicks finding → annotated screenshot + evidence + heuristic_id (NOT body — R6 channel 4)
6. Consultant clicks "Edit" → modifies recommendation → finding_edits row preserves original (R7.4)
7. Consultant clicks "Approve" → finding moves from held to published (warm-up still active, so still held until graduation)
8. Email fires via Resend: audit_completed notification with PDF link
9. Consultant clicks /console/clients/[id] → sees warm-up status (audits_completed / required, rejection_rate)
```

Then run R6 channels 3+4 conformance — recursive deep-scan against API responses + rendered HTML detects ZERO heuristic body fingerprints.

**Un-skip event:** AC-36 (R6 channels 3+4); AC-15 (review UI); AC-18 (finding detail); AC-29 (NotificationAdapter); AC-30 (audit_completed email <60s); AC-19 (warm-up display); AC-05+AC-06 (T160 SnapshotBuilder full composition).

**R20 impact.md:** required (T160 SnapshotBuilder supersedes T145; AccessModeMiddleware fail-secure default activates; NotificationAdapter NEW interface).

### Week 12 — T175 final acceptance + observability + ops dashboard ★ MVP SPEC COMPLETE ★

**Phase tasks landing:**
- T239 (Pino structured logging — R6 channel 1 reaffirm; correlation fields complete)
- T240 (audit_events table migration — append-only; 22-event taxonomy)
- T241 (Event emission in all graph nodes — 22 event types fire end-to-end)
- T242 (heuristic_health_metrics materialized view + nightly refresh)
- T243 (Alerting rules + BullMQ — 7 alert rules + debounced via NotificationAdapter)
- T174 (Phase 9 integration test)
- **T175** (★★ ACCEPTANCE TEST — bbc.com 2-page foundations ★★ MVP SPEC COMPLETE)
- **T244** (Operational dashboard — admin role; 6 sections; built LAST per REQ-DELIVERY-OPS-003 + §35.6)

**Wednesday demo (★ MVP SPEC COMPLETE ★):** T175 final acceptance run live, then ops dashboard tour:

```bash
$ pnpm cro:audit --url=https://bbc.com --pages 2 --output ./out
[gateway] audit_request_id=req-175 audit_run=ar-175
[snapshot] reproducibility_snapshot pinned: temp=0, model=claude-sonnet-4-*, 6 versions
… full pipeline …
[delivery] PDF generated: ./out/bbc-com-report.pdf (3.2 MB, 18s render)
[notification] email sent to consultant@reodigital.com via Resend
[obs] 22 event types emitted; verify via: SELECT DISTINCT event_type FROM audit_events WHERE audit_run_id='ar-175'
✓ MVP SPEC COMPLETE acceptance: AC-21 + AC-26 + AC-30 + AC-36 all green
```

Then admin opens `/console/admin/operations`:
- Section 1 — Active audits with live progress
- Section 2 — 24h summary (audits, findings, costs)
- Section 3 — Heuristic health table (top 30 by health_score from materialized view)
- Section 4 — Alert feed (recent BullMQ-fired alerts)
- Section 5 — Cost trend (rolling 7d)
- Section 6 — Failure breakdown (audit_runs.completion_reason taxonomy)

**Un-skip event:** AC-21 (T175 ★ MVP SPEC COMPLETE); AC-31 (Pino R6 channel 1); AC-32 (audit_events table); AC-33 (22-event emission); AC-34 (heuristic health + alerting); AC-35 (ops dashboard); AC-37 (composite ★ MVP SPEC COMPLETE ★ gate).

**R20 impact.md:** required (22-event taxonomy first end-to-end activation; ops dashboard introduces admin-only RBAC surface).

**MVP SHIPPABLE for first external pilot — with v1.1 R6.2 AES-256-GCM at-rest hardening added BEFORE pilot per PRD §3.2.**

---

## 8. Stub-to-real promotion table (single source of truth)

| Stub task | Replaced by | Replacement week | R20 impact.md? | Risk |
|---|---|---|---|---|
| T-SKELETON-001 (orchestrator) | Stays real through wk 12 | — | No | Low |
| T-SKELETON-002 (stubBrowserCapture) | T006+T013 (Phase 1) | 2 | Yes (PageStateModel surface) | Med |
| T-SKELETON-003 (stubLoadHeuristics) | T106 (Phase 6) | 4 | Yes (HeuristicLoader interface) | Med |
| T-SKELETON-004 (stubEvaluate) | T117+T119 (Phase 7) | 5 | Yes (EvaluateNode + LLMAdapter activation) | **HIGH** |
| T-SKELETON-005 (stubCritique) | T121 (Phase 7) | 6 | Yes (SelfCritique behavior + R5.6 invariant) | Med |
| T-SKELETON-006 (stubGround) | T122-T130 (Phase 7) | 7 | Yes (Finding lifecycle + grounding gate) | **HIGH** |
| T-SKELETON-007 (stubAnnotate) | T131 (Phase 7) | 9 | Yes (annotation pipeline) | Low |
| T-SKELETON-008 (stubStore) | **Two-stage:** wk 3 → basic Phase 4 PostgresStorage write + RLS; wk 9 → Phase 7 T132 StoreNode (grounding lifecycle); wk 11 → Phase 9 T164 two-store warm-up aware | 3, 9, 11 | Yes at each stage (DB schema + RLS at wk 3; Finding lifecycle at wk 9; warm-up + access_mode at wk 11) | Med |
| T-SKELETON-009 (stubReport) | T245-T249 (Phase 9) | 10 | Yes (Report contract + R6 channels 3+4) | Med |
| T-SKELETON-010 (acceptance test) | Stays real; assertions tighten weekly | — | No | Low |

**Two HIGH-risk transitions to plan extra review for:** week 5 (first Claude) and week 7 (first grounding). Both already flagged as critical risk gates in §4.

---

## 9. Demo prep checklist (per week)

| Step | Owner | Day |
|---|---|---|
| Pin demo URL set (e.g., example.com + amazon.in) | engineering lead | Mon |
| Author/update demo script in `docs/specs/mvp/demo-scripts/wk-NN.md` | impl agent | Mon |
| Dry-run against pinned URLs; capture happy-path recording | impl agent | Tue |
| Document failure-path screenshots if any kill criteria triggered | impl agent | Tue |
| 30-min Wednesday slot — share screen, run live, accept feedback | engineering lead | Wed |
| Post-demo: log feedback to `docs/specs/mvp/demo-feedback.md` | engineering lead | Wed (end-of-day) |

**Total prep cost: ~half a day per week.** Acceptable because the demo command (`pnpm cro:audit --url=<URL>`) stays constant — only the underlying impl varies.

---

## 10. Constitution invariants under walking skeleton

Re-stated for clarity (apply per-task, including to stubs):

| Rule | Stub-time enforcement |
|---|---|
| **R3.1 TDD** | Contract test written first, watched fail, stub implements until passes. Behavior test added (`.skip()`). |
| **R5.3 + GR-007** absolute conversion-prediction ban | Static check on stub finding data: regex must not match banned phrases ("increase conversion", "boost revenue", "%lift", "ROI of N"). |
| **R6** heuristic IP boundary | Stub heuristics use `tests/fixtures/heuristics/skeleton-*.json` only; body marked "TEST FIXTURE". Pino transport spy verifies no body content in logs from week 1. |
| **R7.4** append-only | Pre-Phase-4 (weeks 1-2): no DB writes. Post-Phase-4 (week 3+): UPDATE/DELETE attempts on the 5 append-only tables fail at trigger level. |
| **R10/R13** temperature=0 | Pre-T073 (weeks 1-4): no LLM calls. Post-T073 (week 5+): TemperatureGuard rejects temp > 0. |
| **R14.1** atomic LLM logging | Same as R10 — activates week 5 with real Claude. |
| **R20** impact.md | Required for stub-to-real transitions on shared contracts (8 of 10 skeleton tasks per §8). |
| **R23** kill criteria | Per-task block in this roadmap §6 stub task definitions. Phase tasks carry their own per `tasks.md`. |

---

## 11. Cross-references

- **[implementation-roadmap-visual.md](implementation-roadmap-visual.md)** — at-a-glance visual companion: capability progression matrix, milestone timeline, demo-evolution flow, live progress tracker. Open this for tracking; open the current file for per-week task IDs.
- `docs/specs/mvp/PRD.md` §2.4 (success criteria), §10 (boundaries), §10.10 (pacing)
- `docs/specs/mvp/constitution.md` R3, R5.3, R6, R7.4, R10/R13, R14.1, R17, R20, R23
- `docs/specs/mvp/phases/INDEX.md` v1.3 (phase order)
- `docs/specs/mvp/phases/phase-{0,0b,1,1b,1c,2,3,4,4b,5,5b,6,7,8,9}-*/tasks.md` (canonical task definitions — ALL 15 phase folders are the cherry-pick source)
- `docs/specs/mvp/tasks-v2.md` v2.3.3 (legacy reference catalog; NOT the cherry-pick source)
- Note: Phase 1b + 1c (perception extensions v2.4 + PerceptionBundle envelope v2.5) are not separately scheduled in this roadmap; they fold into Phase 1 work (week 2) since their task counts (12 each) are scoped extensions of the same browser-runtime/perception layer

---

## 12. Maintenance

- **Bump `version` field on every edit.** Append delta block recording what changed (R18.3 — delta entries are append-only).
- **v0.3 status: complete for all 12 weeks.** Future versions land via additive deltas only — task ID drift in upstream `tasks.md` files, slice-detail refinement, or post-implementation lessons learned.
- **This file SHALL NOT modify any phase artifact, tasks-v2.md, PRD.md, or constitution.md.**
- **If a referenced task ID changes upstream**, update upstream first; this roadmap re-references after.
- **`/speckit.analyze`** treats this file as an implementation overlay, not a Spec Kit artifact (does not affect spec/plan/tasks consistency).
- **Stub-to-real promotion** weeks 5 and 7 are HIGH-risk gates — extra reviewer required per PRD §10.9 PR Contract risk-tier guidance.
- **Phase 1b + 1c folding**: confirm with engineering lead whether v2.4 perception extensions (T1B-001..T1B-012) and v2.5 PerceptionBundle envelope (T1C-001..T1C-012) ride alongside Phase 1 in week 2 OR slip to weeks 3-4. Current draft assumes week 2 ride-along; if too heavy, split into a week-2/3 stretch.

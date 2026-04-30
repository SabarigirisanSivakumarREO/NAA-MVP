---
title: Tasks — Phase 1 Browser Perception
artifact_type: tasks
status: approved
version: 0.3
created: 2026-04-27
updated: 2026-04-30
owner: engineering lead
authors: [Claude (drafter)]

supersedes: null
supersededBy: null

impact_analysis: docs/specs/mvp/phases/phase-1-perception/impact.md

derived_from:
  - docs/specs/mvp/phases/phase-1-perception/spec.md (AC-01 through AC-10)
  - docs/specs/mvp/phases/phase-1-perception/plan.md (technical decomposition)
  - docs/specs/mvp/phases/phase-1-perception/impact.md (BrowserEngine + PageStateModel contracts)
  - docs/specs/mvp/tasks-v2.md v2.3.1 (T006-T015 — T007 reduced)
  - docs/specs/mvp/constitution.md (R3 TDD, R4 browser rules, R9 adapter, R23 kill)
  - .claude/skills/neural-dev-workflow/references/templates.md (Brief format + kill criteria)

req_ids:
  - REQ-BROWSE-NODE-003
  - REQ-BROWSE-HUMAN-005
  - REQ-BROWSE-HUMAN-006
  - REQ-BROWSE-PERCEPT-001
  - REQ-BROWSE-PERCEPT-002
  - REQ-BROWSE-PERCEPT-003
  - REQ-BROWSE-PERCEPT-005
  - REQ-BROWSE-PERCEPT-006

delta:
  new:
    - Phase 1 tasks.md
    - T006-T015 from tasks-v2 v2.3.1 with T007 reduced scope
    - Per-task explicit kill criteria for T013 + T015 (estimated > 2 hrs)
    - v0.2 — frontmatter now carries `impact_analysis:` link (R20 mandate; analyze finding C5 from polish round)
    - v0.2 — T009 acceptance documents the < 20-node degenerate-page floor (analyze finding A1)
    - v0.2 — T013 brief now documents the deterministic shrink ladder for oversize handling (analyze finding A4)
    - v0.2 — T014 brief now documents `_extensions` reservation for Phase 7+ (analyze finding X2)
  changed:
    - v0.1 → v0.2 — analyze-driven polish (A1, A4, X2 + C5); no task scope changes
    - v0.2 → v0.3 — frontmatter version sync with parallel spec.md/plan.md/impact.md polish (analyze findings M1-M4 + L1-L2 + L5-L6); ONE body edit on line 183 (T008 header) to propagate M3 — drops misattributed `REQ-BROWSE-PERCEPT-002` from T008, leaving only `REQ-BROWSE-PERCEPT-001`. PERCEPT-002 is HardFilter (T009 / R-06) per `docs/specs/final-architecture/06-browse-mode.md:370`; AccessibilityExtractor does no filtering. L3 (T-PHASE1-* tasks not in tasks-v2.md) and L4 (tasks-v2 v2.3.1 → v2.3.3 citation) deferred to v2.3.4 punch-list per INDEX.md v1.4.
  impacted:
    - spec.md + plan.md + impact.md (v0.2 → v0.3) — frontmatter sync
  unchanged:
    - T006, T007, T009-T015 + T-PHASE1-* polish tasks (TESTS, DOC, LOGGER, ADAPTERS-README, ROLLUP) — bodies, dependency graph, default + per-task kill criteria all preserved verbatim from v0.2 (only T008 header REQ-ID list trimmed for M3)

governing_rules:
  - Constitution R3 (TDD)
  - Constitution R4 (Browser Agent Rules)
  - Constitution R9 (Adapter Pattern)
  - Constitution R11 (Spec discipline)
  - Constitution R17 (Lifecycle)
  - Constitution R23 (Kill Criteria)

description: "Phase 1 task list — T006-T015 from tasks-v2 v2.3.1; T007 reduced; default + per-task kill criteria; impact.md prerequisite."
---

# Tasks: Phase 1 — Browser Perception Foundation

**Input:** spec.md + plan.md + impact.md (this folder)
**Prerequisites:** spec.md `approved` AND impact.md `approved` (R20)
**Test policy:** TDD per R3.1 — write conformance tests + Phase 1 integration test FIRST, watch FAIL, then implement T006-T015.
**Organization:** Single user story (US-1 from spec.md). 10 tasks contributing to one acceptance scenario per AC.

---

## Task ID Assignment

Phase 1 IDs pulled from `docs/specs/mvp/tasks-v2.md` v2.3.1 (T006-T015). T007 carries reduced scope per v2.3.1 amendment.

Format: `[T-NNN] [P?] [US-N?] Description (AC-NN, REQ-ID)`

---

## Path Conventions (architecture.md §6.5)

Phase 1 only touches:
- `packages/agent-core/src/adapters/` (BrowserEngine interface)
- `packages/agent-core/src/browser-runtime/` (BrowserManager, StealthConfig)
- `packages/agent-core/src/perception/` (extractors, types)
- `packages/agent-core/src/observability/` (correlation field update)
- `packages/agent-core/tests/conformance/` (9 conformance tests)
- `packages/agent-core/tests/integration/` (phase1.test.ts)
- `packages/agent-core/package.json` (deps: playwright, sharp, tiktoken)

No MCP, grounding, heuristics, dashboard, db, or apps/ touched.

---

## Default Kill Criteria *(R23 — applies to all tasks)*

```yaml
kill_criteria:
  resource:
    token_budget_pct: 85
    wall_clock_factor: 2x
    iteration_limit: 3
  quality:
    - "any previously-passing test breaks"
    - "pnpm test:conformance -- <component> fails after task supposedly complete"
    - "implementation reveals spec defect (R11.4 — fix spec first)"
    - "Playwright type leaks outside BrowserManager.ts + BrowserEngine.ts (R9 violation)"
    - "PageStateModel exceeds 1500 tokens for control fixture example.com (NF-Phase1-01 violated)"
  scope:
    - "diff introduces forbidden pattern (R13: any without TODO, console.log, direct SDK import outside adapter, disabled test)"
    - "task expands beyond plan.md file table"
    - "ESLint introduces unsupported rules (Phase 4 scope)"
  on_trigger:
    - "snapshot WIP to wip/killed/<task-id>-<reason>"
    - "log to task thread with specific failure mode"
    - "escalate to human"
    - "do NOT silently retry; do NOT --no-verify"
```

T013 + T015 carry additional per-task kill criteria inline.

---

## Phase 1 — Setup (no separate setup phase needed; impact.md is the prerequisite gate)

`impact.md` MUST be `status: approved` before any T006-T015 implementation begins. R20 enforcement.

Add Phase 1 deps to `packages/agent-core/package.json`:
- `playwright` (latest pinned at install time; matches architecture.md §6.4)
- `sharp` (latest)
- `tiktoken` (latest; for cl100k_base tokenizer)

---

## Phase 2 — Foundational (Blocking Prerequisites)

Two foundations must precede the rest:

- [ ] **T-PHASE1-TESTS [P] [SETUP]** Author all 9 conformance test files at `packages/agent-core/tests/conformance/*.test.ts` + the Phase 1 integration test at `packages/agent-core/tests/integration/phase1.test.ts`. Every `test()` block per AC-01 through AC-10 MUST FAIL initially (modules don't exist yet). R3.1 TDD enforcement.
- [ ] **T014 [SETUP]** PageStateModel types + Zod schemas (`perception/types.ts`). Even though it's listed last in tasks-v2 ordering, type definitions block 4 of 5 extractors. Land BEFORE T008-T013.

**Checkpoint:** Conformance tests + integration test exist and FAIL. PageStateModel + sub-schemas exported. Then T006 → T007 → T008 ... → T013 → T015 can proceed.

---

## Phase 3 — User Story 1: Browser captures usable PageStateModel for any public URL (Priority: P1) 🎯 MVP

**Goal:** ContextAssembler.capture(url) returns a complete < 1500-token PageStateModel for example.com, amazon.in, and Shopify demo.

**Independent Test:** `pnpm -F @neural/agent-core test integration/phase1` — all 3 sites pass.

**AC IDs covered:** AC-01 through AC-10.

### Implementation tasks

- [ ] **T006 [US-1] BrowserManager** (AC-01, REQ-BROWSE-NODE-003)
  - **Brief:**
    - **Outcome:** `packages/agent-core/src/adapters/BrowserEngine.ts` exports `BrowserEngine` interface + `SessionOptsSchema` + `BrowserSession` types. `packages/agent-core/src/browser-runtime/BrowserManager.ts` exports `BrowserManager` class implementing `BrowserEngine` via Playwright Chromium. `BrowserManager.newSession(opts?)` launches headless Chromium, applies opts, returns BrowserSession with Pino child logger (correlation field `session_id` = uuid).
    - **Context:** plan.md "Phase 1 Design" — adapter interface design. impact.md captures the contract. R9 enforced: BrowserManager + BrowserEngine.ts are the ONLY files importing `playwright`. BrowserSession.page is the Phase-1-minimal wrapper exposing only goto/accessibility.snapshot/screenshot/addInitScript/evaluate/waitForLoadState.
    - **Constraints:** Files < 300 lines (BrowserManager likely ~150-200; BrowserEngine.ts ~50-80). Functions < 50 lines. Named exports. No `console.log`. No `any` without TODO+issue.
    - **Non-goals:** No StealthConfig integration (T007). No extractors (T008-T013). No MCP tool integration (Phase 2).
    - **Acceptance:** `tests/conformance/browser-manager.test.ts` AC-01 block PASSES. Smoke test: `new BrowserManager().newSession()` → `session.close()` → no zombie Chromium process.
    - **Integration:** Provides BrowserSession for T007 + T008 + T011 + T012. Sets the R9 adapter precedent.
    - **Verify:** `pnpm test:conformance -- browser-manager` green; manual `ps aux | grep chromium` after close — count delta == 0.
  - **Files:** `packages/agent-core/src/adapters/BrowserEngine.ts`, `packages/agent-core/src/browser-runtime/BrowserManager.ts`; modify `packages/agent-core/package.json` to add `playwright` dep
  - **dep:** T002 (Phase 0), T-PHASE1-TESTS, T014, impact.md approved
  - **Smoke test:** `BrowserManager().newSession()` opens + closes amazon.in cleanly
  - **Kill criteria:** default block

- [ ] **T007 [US-1] StealthConfig (REDUCED SCOPE)** (AC-02, REQ-BROWSE-HUMAN-005, REQ-BROWSE-HUMAN-006 reduced per v2.3.1)
  - **Brief:**
    - **Outcome:** `packages/agent-core/src/browser-runtime/StealthConfig.ts` exports `applyStealthConfig(context: BrowserContext, opts?: StealthOptions): Promise<void>` that randomizes per-session: (a) user-agent from a pool of 5-10 modern Chrome strings, (b) viewport from 3 sizes (1280×720, 1440×900, 1920×1080), (c) WebGL vendor/renderer via `addInitScript` patching `WebGLRenderingContext.prototype.getParameter`. Two consecutive sessions yield different (UA, viewport, fingerprint) tuples.
    - **Context:** plan.md "Phase 0 Research" item 5. tasks-v2 v2.3.1 explicitly REDUCED scope — NO `playwright-extra` dep, NO `playwright-extra-plugin-stealth`. Acceptance does NOT require bot.sannysoft.com pass.
    - **Constraints:** No `playwright-extra` import. File < 100 lines. Function < 50 lines. UA pool defined as a const array (not external). Viewport sizes hardcoded. WebGL patch is the only `addInitScript` injected by this module.
    - **Non-goals:** No bot detection evasion. No canvas/audio fingerprint. No navigator props beyond webdriver=undefined (handled separately if at all).
    - **Acceptance:** `tests/conformance/stealth-config.test.ts` AC-02 block PASSES. Verifies: (a) two sessions report different UA strings, (b) viewport in [1280×720, 1440×900, 1920×1080], (c) `navigator.webdriver === undefined`, (d) installed deps do NOT include `playwright-extra`.
    - **Integration:** Used by ContextAssembler (T013) before navigation.
    - **Verify:** `pnpm test:conformance -- stealth-config` green; `pnpm ls playwright-extra` returns empty (not installed).
  - **Files:** `packages/agent-core/src/browser-runtime/StealthConfig.ts`
  - **dep:** T006
  - **Smoke test:** Two sequential `applyStealthConfig` calls yield different fingerprint tuples; bot.sannysoft.com NOT a test target in MVP
  - **Kill criteria:** default block + extra: any attempt to add `playwright-extra` dep → STOP, that's v1.1 scope

- [ ] **T008 [P] [US-1] AccessibilityExtractor** (AC-03, REQ-BROWSE-PERCEPT-001)
  - **Brief:**
    - **Outcome:** `perception/AccessibilityExtractor.ts` exports `accessibilityExtractor.extract(page: BrowserPage): Promise<AccessibilityTree>`. Uses `page.accessibility.snapshot({ interestingOnly: false })` to capture full tree; recursively walks to count nodes; logs warning at < 50 nodes. Returns `AccessibilityTreeSchema`-validated object.
    - **Context:** plan.md "Phase 0 Research" item 1 — AX-tree fetch decision. T014 PageStateModel sub-schemas already in place (T014 prereq).
    - **Constraints:** Pure function (no side effects beyond Pino logging). File < 200 lines. No `any` outside Playwright AccessibilityNode boundary (re-typed via Zod parse).
    - **Non-goals:** No filtering (HardFilter T009). No relevance scoring (SoftFilter T010).
    - **Acceptance:** AC-03 — > 50 nodes for amazon.in homepage; tree includes a searchbox role.
    - **Integration:** Output feeds HardFilter (T009).
    - **Verify:** `pnpm test:conformance -- accessibility-extractor` green.
  - **Files:** `packages/agent-core/src/perception/AccessibilityExtractor.ts`
  - **dep:** T006, T014
  - **Smoke test:** Extract AX-tree from amazon.in returns > 50 nodes including searchbox
  - **Kill criteria:** default block

- [ ] **T009 [US-1] HardFilter** (AC-04, REQ-BROWSE-PERCEPT-002)
  - **Brief:**
    - **Outcome:** `perception/HardFilter.ts` exports `hardFilter.apply(tree: AccessibilityTree): { tree: AccessibilityTree; reductionPct: number; reductionFloorWaived: boolean }`. Recursively prunes nodes where any of: `hidden=true`, `disabled=true`, `aria-hidden="true"`, `boundingBox.width=0 OR height=0`. Computes reduction percent. **Degenerate-page floor (per spec v0.2 AC-04):** if input has < 20 pre-filter nodes, reduction floor (> 50%) is waived; filter is still applied but no minimum reduction enforced; `reductionFloorWaived: true` in return payload.
    - **Context:** plan.md "Phase 1 Design" perception step 2. spec.md AC-04 v0.2 documents floor. Pure function.
    - **Constraints:** File < 150 lines. Function < 50 lines. No mutation of input (return new tree). No `any`.
    - **Non-goals:** No relevance scoring.
    - **Acceptance:** AC-04 — > 50% reduction on amazon.in fixture (≥ 20 nodes); on a degenerate fixture (< 20 nodes), `reductionFloorWaived: true` in return; conformance test covers both cases.
    - **Integration:** Feeds SoftFilter (T010).
    - **Verify:** `pnpm test:conformance -- hard-filter` green; both typical-page and degenerate-page test cases pass.
  - **Files:** `packages/agent-core/src/perception/HardFilter.ts`
  - **dep:** T008
  - **Smoke test:** apply() drops > 50% of nodes on amazon.in fixture; degenerate-page fixture returns with floor waived flag
  - **Kill criteria:** default block

- [ ] **T010 [US-1] SoftFilter** (AC-05, REQ-BROWSE-PERCEPT-003)
  - **Brief:**
    - **Outcome:** `perception/SoftFilter.ts` exports `softFilter.apply(tree: AccessibilityTree): FilteredDOM`. Computes `score = baseRoleWeight × textWeight × positionWeight × visibilityWeight` using MULTIPLICATIVE decay (R4.4 — NOT additive). Returns `top30: Array` ordered descending by score.
    - **Context:** plan.md "Phase 1 Design" perception step 3. R4.4 confidence decay rule applies — multiplicative is non-negotiable.
    - **Constraints:** File < 200 lines. Function < 50 lines. Each weight function < 30 lines. Score in (0, 1] (multiplicative bound). No additive math (`current - 0.05` style is FORBIDDEN — R4.4 violation).
    - **Non-goals:** No mutation tracking.
    - **Acceptance:** AC-05 — top 30 returned, descending order, scores in (0, 1].
    - **Integration:** FilteredDOM feeds ContextAssembler (T013).
    - **Verify:** `pnpm test:conformance -- soft-filter` green; grep tests confirm no additive scoring.
  - **Files:** `packages/agent-core/src/perception/SoftFilter.ts`
  - **dep:** T009
  - **Smoke test:** apply() returns 30 items, scores descending, all in (0, 1]
  - **Kill criteria:** default block + extra: any additive confidence math (`-=`, `+=` on scores) → STOP, R4.4 violation

- [ ] **T011 [P] [US-1] MutationMonitor** (AC-06, REQ-BROWSE-PERCEPT-005, REQ-BROWSE-PERCEPT-006)
  - **Brief:**
    - **Outcome:** `perception/MutationMonitor.ts` exports `mutationMonitor.observe(page: BrowserPage, opts: { timeoutMs: number; settleWindowMs?: number }): Promise<{ stable: boolean; mutationsObserved: number }>`. Injects MutationObserver via `addInitScript` pre-navigation; observer logs mutations to `window.__neuralMutationLog`; method polls until 500 ms passes with no new mutations OR timeout.
    - **Context:** plan.md "Phase 0 Research" item 4 — settle algorithm.
    - **Constraints:** File < 200 lines. The injected observer script < 30 lines. No busy loop — uses `MutationObserver` events. Failures non-fatal (return `stable: false`).
    - **Non-goals:** No automatic dismissal (Phase 5 OverlayDismisser).
    - **Acceptance:** AC-06 — settles < 2 s on static, returns `stable: false` after 10 s on dynamic.
    - **Integration:** Used by ContextAssembler (T013) post-navigation, pre-extraction.
    - **Verify:** `pnpm test:conformance -- mutation-monitor` green.
  - **Files:** `packages/agent-core/src/perception/MutationMonitor.ts`
  - **dep:** T006
  - **Smoke test:** Inject + observe + settle within 2 s on example.com
  - **Kill criteria:** default block

- [ ] **T012 [P] [US-1] ScreenshotExtractor** (AC-07)
  - **Brief:**
    - **Outcome:** `perception/ScreenshotExtractor.ts` exports `screenshotExtractor.capture(page: BrowserPage): Promise<Visual>`. Uses `page.screenshot({ type: 'jpeg', quality: 80, fullPage: false })`; if Buffer.length > 150 KB, Sharp re-encodes via `sharp(buf).resize({ width: 1280 }).jpeg({ mozjpeg: true, quality: 70 }).toBuffer()`. Single retry max.
    - **Context:** plan.md "Phase 0 Research" item 3 — Sharp compression strategy.
    - **Constraints:** File < 150 lines. No retry beyond 1. Returns `Visual` with `sizeBytes ≤ 153600` and `width ≤ 1280`.
    - **Non-goals:** No annotation (Phase 7 annotate node). No R2 upload (Phase 4).
    - **Acceptance:** AC-07 — JPEG ≤ 150 KB ≤ 1280 px wide.
    - **Integration:** Output feeds ContextAssembler (T013) optional `visual` field.
    - **Verify:** `pnpm test:conformance -- screenshot-extractor` green; `Buffer.length ≤ 153600` enforced.
  - **Files:** `packages/agent-core/src/perception/ScreenshotExtractor.ts`; modify `packages/agent-core/package.json` to add `sharp` dep
  - **dep:** T006
  - **Smoke test:** Capture amazon.in homepage → JPEG ≤ 150 KB ≤ 1280 px
  - **Kill criteria:** default block

- [ ] **T013 [US-1] ContextAssembler** (AC-08, REQ-BROWSE-PERCEPT-001) **— extended kill criteria**
  - **Brief:**
    - **Outcome:** `perception/ContextAssembler.ts` exports `contextAssembler.capture(url: string, opts?: CaptureOpts): Promise<PageStateModel>`. Orchestration order: newSession → applyStealthConfig → page.goto → mutationMonitor.observe → accessibilityExtractor.extract → hardFilter.apply → softFilter.apply → screenshotExtractor.capture → assemble candidate PageStateModel → tokenize via tiktoken cl100k_base. Owns session lifecycle — closes session in `finally`.
    - **Oversize-handling (per spec v0.2 §Key Entities + plan v0.2 design item 6) — deterministic shrink ladder:** if candidate > 1500 tokens: (Stage 1) reduce AccessibilityTree depth 10 → 6, re-tokenize; (Stage 2) reduce FilteredDOM top-30 → top-20, re-tokenize; (Stage 3) drop `Visual` sub-section, re-tokenize; (Stage 4) accept with `diagnostics.errors: ['oversized-after-shrink']` if still > 1500. If any stage brings count under 1500, accept with `diagnostics.warnings: ['shrunk-from-N-tokens']` recording original size. NEVER throw on oversize. Same input → same output (deterministic).
    - **Context:** plan.md v0.2 "Phase 1 Design" perception step 6. This task integrates 6 components plus the BrowserEngine — highest integration risk in Phase 1.
    - **Constraints:** File < 250 lines. Methods < 50 lines (likely 1-2 helper methods + 3 shrink helpers, one per stage). Pino correlation: session_id + page_url + extractor (set per sub-call via child logger).
    - **Non-goals:** No retry on extractor failures (each extractor handles its own); ContextAssembler aggregates errors into `diagnostics.errors`. Does NOT populate `_extensions` (Phase 7+ responsibility).
    - **Acceptance:** AC-08 — PageStateModel returned for example.com / amazon.in / Shopify demo, < 1500 tokens each.
    - **Integration:** Output is the contract for Phase 2 MCP tools (`browser_get_state`).
    - **Verify:** `pnpm test:conformance -- context-assembler` green.
  - **Files:** `packages/agent-core/src/perception/ContextAssembler.ts`, `packages/agent-core/src/perception/index.ts` (barrel); modify `packages/agent-core/package.json` to add `tiktoken` dep
  - **dep:** T006, T007, T008, T009, T010, T011, T012, T014
  - **Smoke test:** Capture from example.com returns PageStateModel < 500 tokens
  - **Per-task kill criteria (extends default):**
    - "PageStateModel exceeds 1500 tokens for example.com fixture" → R23 trigger; investigate sub-schema bloat (most likely AccessibilityTree retained too many fields).
    - "Session leaks (zombie Chromium process after capture())" → R23 trigger; missing `finally { await session.close() }`.
    - "Wall-clock for single capture() > 30 s on example.com" → R23 trigger; perception extractor inefficiency.

- [ ] **T014 [P] [SETUP] PageStateModel types + Zod schemas** (AC-09, REQ-BROWSE-PERCEPT-001)
  - **Brief:**
    - **Outcome:** `perception/types.ts` exports `PageStateModelSchema` + sub-schemas (Metadata, AccessibilityNode/AccessibilityTree, FilteredDOM, InteractiveGraph, Visual, Diagnostics) + inferred TS types via `z.infer`. All schemas `.strict()` EXCEPT the top-level `PageStateModelSchema` which includes the explicit `_extensions: z.record(z.string(), z.unknown()).optional()` field. **Diagnostics schema MUST include `warnings: z.array(z.string()).default([])`** (used by T013 shrink ladder) in addition to existing `errors` array.
    - **Forward-compatibility seam (per spec v0.2 + impact v0.2 + analyze finding X2):** `_extensions` is RESERVED for Phase 7+ deep_perceive composition. Phase 1 MUST NOT populate `_extensions` (write a unit test asserting `model._extensions === undefined` after Phase 1 capture). Phase 7 will namespace under `_extensions.deepPerceive`. This avoids forcing Phase 1 schema migration when later phases attach data.
    - **Context:** plan.md v0.2 "Phase 1 Design" — sub-schema definitions + design item 7 (extensibility seam). Drives every other Phase 1 task — must land first (alongside T-PHASE1-TESTS).
    - **Constraints:** File ≤ 300 lines (R10.1). No `z.any()` escapes — every field typed explicitly. AccessibilityNode is recursive (`z.lazy()`); MUST include a depth limit to prevent infinite recursion on aria-owns cycles (max depth 10, configurable for shrink ladder).
    - **Non-goals:** No runtime extraction logic. No population of `_extensions` (Phase 7+ responsibility).
    - **Acceptance:** AC-09 — all sub-types validate fixture data; zero `z.any()`; schema export named; recursion depth limit verified via cyclic-reference fixture; `_extensions` field present and Phase 1 reserved test passes.
    - **Integration:** Foundation for T008-T013. `_extensions` seam for Phase 7+.
    - **Verify:** `pnpm test:conformance -- perception-types` green.
  - **Files:** `packages/agent-core/src/perception/types.ts`
  - **dep:** T002 (Phase 0)
  - **Smoke test:** `PageStateModelSchema.parse(<fixture>)` succeeds; cyclic AX-tree fixture parses without infinite recursion; Phase 1 capture leaves `_extensions === undefined`
  - **Kill criteria:** default block + extra: any attempt to populate `_extensions` from Phase 1 code → STOP, that's Phase 7+ scope

- [ ] **T015 [US-1] Phase 1 integration test** (AC-10) **— extended kill criteria**
  - **Brief:**
    - **Outcome:** `tests/integration/phase1.test.ts` runs ContextAssembler against 3 fixture URLs (example.com, amazon.in, Shopify demo); asserts PageStateModel < 1500 tokens each + valid Zod parse + no zombie processes.
    - **Context:** This is the gate for Phase 1 exit. Vitest integration suite (NOT Playwright Test — internal Playwright API used; Playwright Test is for `tests/acceptance/` Phase 9).
    - **Constraints:** File < 200 lines. Wall-clock < 60 s for all 3 sites (NF-Phase1-03). Skips Shopify demo if URL unavailable (no failure on infra issue).
    - **Non-goals:** No analysis. No LLM. No DB writes.
    - **Acceptance:** AC-10 — exits 0; 3 sites produce valid < 1500-token PageStateModel.
    - **Integration:** Phase 1 acceptance gate. After this passes, Phase 1 complete; rollup follows.
    - **Verify:** `pnpm -F @neural/agent-core test integration/phase1` exits 0 within 60 s.
  - **Files:** `packages/agent-core/tests/integration/phase1.test.ts`
  - **dep:** T013 (and transitively all of T006-T014)
  - **Smoke test:** is itself the smoke test
  - **Per-task kill criteria (extends default):**
    - "Wall-clock > 60 s for 3 sites" → R23 trigger; ContextAssembler is too slow.
    - "amazon.in CAPTCHA wall produces invalid PageStateModel (e.g., 0 nodes)" → re-evaluate spec assumption; per spec edge case, the CAPTCHA wall PageStateModel should still validate.
    - "Shopify demo URL flakes 3+ times" → mark `skip` rather than retry; flag for fixture refresh.

**Checkpoint:** After T006-T015 + T-PHASE1-TESTS green, all 10 ACs pass. Phase 1 ready for rollup (R19) → `phase-1-current.md`.

---

## Phase N — Polish & Cross-Cutting Concerns

- [ ] **T-PHASE1-DOC [P]** Update root `README.md` with Phase 1 dev quickstart: `pnpm -F @neural/agent-core test integration/phase1` to validate. Reference [phase-1-perception spec.md](docs/specs/mvp/phases/phase-1-perception/spec.md).
- [ ] **T-PHASE1-LOGGER** Update `packages/agent-core/src/observability/logger.ts` to register new correlation fields (session_id, page_url, extractor) in default schema. (Strictly speaking, this can fold into T006 — left here as a polish gate to avoid silent schema drift.)
- [ ] **T-PHASE1-ADAPTERS-README** Update `packages/agent-core/src/adapters/README.md` to reference BrowserEngine as the first concrete adapter and the v1.1 stealth-plugin slot.
- [ ] **T-PHASE1-ROLLUP** Author `phase-1-current.md` per R19 + `templates/phase-rollup.template.md`. Sections: active modules (browser-runtime/, perception/), data contracts (BrowserEngine + PageStateModel — both NEW), system flows operational (`contextAssembler.capture(url) → PageStateModel`), known limitations (no stealth plugin until v1.1, no overlay dismissal until Phase 5), open risks for Phase 2 (MCP tool composition against BrowserSession + PageStateModel).

---

## Dependencies & Execution Order

### Within Phase 1

```
T-PHASE1-TESTS  +  T014                     # author tests + Zod schemas FIRST
        │              │
        └─────┬────────┘
              ▼
            T006                            # BrowserEngine + BrowserManager (R9 first adapter)
              │
        ┌─────┼─────┬───────┐
        ▼     ▼     ▼       ▼
      T007  T008  T011    T012              # Stealth (depends T006), Acc (T006+T014), Mutation (T006), Screenshot (T006)
              │
              ▼
            T009                            # HardFilter (depends T008)
              │
              ▼
            T010                            # SoftFilter (depends T009)
              │
              ▼
            T013                            # ContextAssembler (depends T007-T012 + T014)
              │
              ▼
            T015                            # Phase 1 integration test (depends T013)
              │
              ▼
T-PHASE1-DOC, T-PHASE1-LOGGER, T-PHASE1-ADAPTERS-README, T-PHASE1-ROLLUP
```

### Comprehension-Debt Pacing (PRD §10.10)

Phase 1 is parallelizable in a controlled way:

- After T006 + T014 land, **T008/T011/T012 are mutually independent** — could be 3 parallel subagents. T007 also independent.
- However: 4 parallel subagents on Phase 1's first concrete adapter ≥ research-cited working-memory limit. Recommended: 2 parallel after T006 + T014, NOT 4.
- HardFilter (T009) → SoftFilter (T010) is sequential (data-dependent).
- ContextAssembler (T013) is single-threaded — it integrates everything; do NOT parallelize.

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Author T-PHASE1-TESTS + T014 → run, watch all 10 AC blocks FAIL.
2. Implement T006 (BrowserManager + BrowserEngine adapter — sets R9 precedent).
3. Implement T007 (StealthConfig reduced) + T008 (AccessibilityExtractor) in parallel.
4. Implement T011 (MutationMonitor) + T012 (ScreenshotExtractor) in parallel.
5. Implement T009 (HardFilter) → T010 (SoftFilter) sequentially.
6. Implement T013 (ContextAssembler) — integrates everything.
7. Implement T015 (Phase 1 integration test).
8. T-PHASE1-DOC + T-PHASE1-LOGGER + T-PHASE1-ADAPTERS-README + T-PHASE1-ROLLUP polish.
9. Phase 1 done.

### Per-task workflow (apply `neural-dev-workflow` skill)

Standard: Brief format → Kill criteria → Test-first → Implement → Validate (`pnpm lint && pnpm typecheck && pnpm test && pnpm test:conformance -- <component>`) → Commit (`feat(perception): T0NN <summary> (REQ-BROWSE-...)`).

For T006 specifically: PR Contract MUST highlight the R9 adapter precedent in the "Review focus" block (PRD §10.9). For T013 + T015: PR Contract risk tier MEDIUM (cross-component integration).

---

## Notes

- `[P]` = different files, no dep → parallelizable.
- `[US-1]` = single user story for Phase 1.
- TDD: T-PHASE1-TESTS + T014 must land before T006-T013 implementation (R3.1).
- One task = one commit (R11.5).
- Apply kill criteria immediately on trigger (R23.4).
- T007's stealth-plugin v1.1 backlog item is captured in tasks-v2.md v2.3.1 delta block.

---

## Cross-references

- spec.md, plan.md, impact.md, README.md (this folder)
- `docs/specs/mvp/tasks-v2.md` v2.3.1 — T006-T015 with T007 reduced
- `docs/specs/mvp/constitution.md` R3, R4, R9, R10, R11, R17-R20, R22-R23
- `docs/engineering-practices/git-workflow.md` — commit format
- `.claude/skills/neural-dev-workflow/` — Brief, Kill Criteria, PR Contract

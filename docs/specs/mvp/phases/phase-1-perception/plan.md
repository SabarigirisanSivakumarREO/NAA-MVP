---
title: Implementation Plan — Phase 1 Browser Perception
artifact_type: plan
status: draft
version: 0.3
created: 2026-04-27
updated: 2026-04-30
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-1-perception/spec.md
  - docs/specs/mvp/phases/phase-1-perception/impact.md
  - docs/specs/mvp/architecture.md (§6.4 tech stack — no overrides; §6.5 project structure)
  - docs/specs/mvp/constitution.md (R1-R26)
  - docs/specs/mvp/testing-strategy.md (§9.6 conformance pattern)
  - docs/specs/mvp/risks.md (§15 risk register)

req_ids:
  - REQ-BROWSE-NODE-003
  - REQ-BROWSE-HUMAN-005
  - REQ-BROWSE-HUMAN-006
  - REQ-BROWSE-PERCEPT-001
  - REQ-BROWSE-PERCEPT-002
  - REQ-BROWSE-PERCEPT-003
  - REQ-BROWSE-PERCEPT-005
  - REQ-BROWSE-PERCEPT-006

impact_analysis: docs/specs/mvp/phases/phase-1-perception/impact.md
breaking: false
affected_contracts:
  - BrowserEngine
  - PageStateModel

delta:
  new:
    - First plan introducing R9 adapter (BrowserEngine) + first cross-layer Zod schema (PageStateModel)
    - Tech stack subset declared: Playwright + Sharp + tiktoken active in Phase 1 (rest deferred)
    - v0.2 — Phase 1 Design item 6 now documents the deterministic shrink ladder for ContextAssembler oversize handling (analyze finding A4)
    - v0.2 — Phase 1 Design item 7 (NEW) documents PageStateModel `_extensions` reservation for Phase 7+ (analyze finding X2)
    - v0.3 — Phase 1 Design item 2 now includes `reductionFloorWaived: boolean` in HardFilter return shape so plan aligns with spec.md AC-04 v0.2 + tasks.md T009 v0.2 (analyze finding L5)
  changed:
    - v0.1 → v0.2 — analyze-driven fixes (A1, A4, X2); design content sharpened, no scope changes
    - v0.2 → v0.3 — analyze-driven polish — M1 (R10→R13 stale xref for temperature=0 in Constitution Check); M2 (constitution citation R1-R23 → R1-R26 in derived_from); L5 (HardFilter return shape includes `reductionFloorWaived`); L6 (architecture.md derived_from collapsed from 2 lines to 1); no scope changes
  impacted:
    - spec.md + impact.md + tasks.md (v0.2 → v0.3) for parallel polish sync
  unchanged:
    - Tech stack table, Project Structure narrative, Approval Gates

governing_rules:
  - Constitution R4 (Browser Agent Rules)
  - Constitution R9 (Loose Coupling / Adapter Pattern)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R17 (Lifecycle)
  - Constitution R20 (Impact Analysis — see impact.md)
  - Constitution R23 (Kill Criteria)
---

# Implementation Plan: Phase 1 — Browser Perception Foundation

> **Summary (~100 tokens):** Build the perception pipeline in 10 sequential / partially-parallel tasks. T006 lands `BrowserManager` implementing the new `BrowserEngine` adapter interface. T007 adds reduced-scope `StealthConfig` (UA + viewport + WebGL fingerprint rotation; no playwright-extra). T014 defines `PageStateModel` Zod schemas (must land before extractors that produce its sub-types). T008-T012 implement five extractors. T013 composes them into ContextAssembler. T015 is the integration test against 3 sites. Adds Sharp + tiktoken deps. impact.md REQUIRED per R20 (BrowserEngine + PageStateModel are shared contracts).

**Branch:** `phase-1-perception` (created at implementation time)
**Date:** 2026-04-27
**Spec:** `docs/specs/mvp/phases/phase-1-perception/spec.md`
**Impact:** `docs/specs/mvp/phases/phase-1-perception/impact.md`

---

## Summary

Phase 1 establishes the browser perception layer. The R9 adapter pattern lands for the first time in `BrowserEngine`, with `BrowserManager` as its sole implementation. Five perception extractors (AccessibilityExtractor, HardFilter, SoftFilter, MutationMonitor, ScreenshotExtractor) feed into `ContextAssembler` which produces a `PageStateModel` under 1500 tokens. The reduced-scope `StealthConfig` (per tasks-v2 v2.3.1) provides per-session rotation without the deferred plugin. A Phase 1 integration test validates the pipeline against three real sites.

---

## Technical Context

| Field | Value | Source | Used in Phase 1? |
|---|---|---|---|
| Language | TypeScript 5.x | architecture.md §6.4 | ✅ yes |
| Runtime | Node.js 22 LTS | architecture.md §6.4 | ✅ yes |
| Monorepo | Turborepo 2.x + pnpm 9.x | architecture.md §6.4 | ✅ yes (Phase 0 prerequisite) |
| Validation | Zod 3.x | architecture.md §6.4 + R2.2 | ✅ yes (PageStateModel + sub-schemas + SessionOpts) |
| Browser | Playwright (default Chromium; stealth plugin deferred to v1.1) | architecture.md §6.4 | ✅ yes (`@playwright/test` for integration test type, `playwright` for runtime) |
| Image | Sharp | architecture.md §6.4 | ✅ yes (T012 ScreenshotExtractor) |
| Tokenizer | tiktoken (cl100k_base) — NEW Phase 1 dep | new — pinned per spec.md NF-Phase1-01 | ✅ yes (PageStateModel size budget) |
| Logging | Pino | architecture.md §6.4 + R10.6 | ✅ yes (correlation: session_id, page_url, extractor) |
| Testing | Vitest unit + Playwright Test integration | architecture.md §6.4 + R3 | ✅ yes |
| Orchestration | LangGraph.js | architecture.md §6.4 | ❌ Phase 8 |
| MCP | `@modelcontextprotocol/sdk` | architecture.md §6.4 | ❌ Phase 2 |
| Primary LLM | Claude Sonnet 4 | architecture.md §6.4 + R10 | ❌ Phase 4 |
| Database | Postgres + pgvector | architecture.md §6.4 | ❌ Phase 4 |
| ORM | Drizzle | architecture.md §6.4 | ❌ Phase 4 |
| Cache / Queue | Redis + BullMQ | architecture.md §6.4 | ❌ Phase 4 |
| API framework | Hono | architecture.md §6.4 | ❌ Phase 9 |
| Frontend | Next.js + shadcn + Tailwind | architecture.md §6.4 | ❌ Phase 9 |
| Auth | Clerk | architecture.md §6.4 | ❌ Phase 9 |
| Storage | Cloudflare R2 | architecture.md §6.4 | ❌ Phase 4 |
| PDF | Playwright `page.pdf()` | architecture.md §6.4 | ❌ Phase 9 |
| Email | Resend | architecture.md §6.4 | ❌ Phase 9 |
| Deployment | Fly.io + Vercel | architecture.md §6.4 | ❌ Phase 9 |

**Performance / Scale targets:**
- NF-Phase1-01: PageStateModel < 1500 tokens (cl100k_base)
- NF-Phase1-02: MutationMonitor settle < 2s on static
- NF-Phase1-03: Phase 1 integration test < 60s wall-clock for 3 sites
- NF-Phase1-04: Screenshot ≤ 150 KB
- NF-Phase1-05: Zero Chromium zombie processes after `close()`

**Project Type:** monorepo `packages/agent-core` extension. No new top-level structure.

**Constraints:** None active in Phase 1 from PRD NF-001..NF-010 yet (no audits run). Phase-specific NFs above govern.

---

## Constitution Check (GATE — must pass before research)

- [x] R5.3 + GR-007: No conversion-rate predictions — Phase 1 has no findings
- [x] R6: Heuristic content boundary preserved — no heuristics loaded in Phase 1
- [x] R7.1: All DB access via Drizzle — no DB access in Phase 1
- [x] R7.2: RLS on client-scoped tables — no tables yet
- [x] R7.4: No UPDATE/DELETE on append-only tables — no tables yet
- [x] R9 (FIRST CONCRETE ADAPTER): All Playwright access through `BrowserEngine` adapter; `BrowserManager` is the sole implementer; no `import ... from 'playwright'` outside `BrowserManager.ts` + `adapters/BrowserEngine.ts`. ESLint rule lands in Phase 4; for Phase 1, code review enforces.
- [x] R13 Forbidden Patterns: TemperatureGuard enforces temperature=0 on evaluate/self_critique/evaluate_interactive (constitution.md §13 line 411; `(R10)` was a stale xref per note_on_stale_xref) — no LLM calls in Phase 1
- [x] R10.1-R10.6: Files < 300 lines, functions < 50 lines, named exports, no commented-out code, no `console.log` — every file in plan stays within these limits; Pino used for browser events
- [x] R10.6 (CLI exception irrelevant in Phase 1): no CLI work in Phase 1; all logging is server-side via Pino with new correlation fields (session_id, page_url, extractor)
- [x] R11.2: Every implementation decision traces to a REQ-ID — REQ-BROWSE-NODE-003, REQ-BROWSE-HUMAN-005/006 (reduced), REQ-BROWSE-PERCEPT-001/002/003/005/006
- [x] R20: SHARED CONTRACTS TOUCHED — `BrowserEngine` + `PageStateModel`. impact.md authored at `docs/specs/mvp/phases/phase-1-perception/impact.md`; risk_level MEDIUM, breaking false.
- [x] R23: Kill criteria — default block applies; T013 ContextAssembler + T015 integration test get *additional* per-task kill criteria (estimated > 2 hrs, integration-heavy)

All checks pass → plan eligible for `validated → approved` once impact.md is approved.

---

## Project Structure

### Documentation (this feature)

```text
docs/specs/mvp/phases/phase-1-perception/
├── README.md              # phase summary + exit criteria
├── spec.md                # /speckit.specify output
├── impact.md              # R20 — REQUIRED (BrowserEngine + PageStateModel)
├── plan.md                # this file
├── tasks.md               # /speckit.tasks output
├── checklists/
│   └── requirements.md    # spec quality checklist
└── phase-1-current.md     # rollup at phase exit (R19; created by user)
```

No `research.md` (zero NEEDS CLARIFICATION).
No `data-model.md` (PageStateModel schema lives in code at `perception/types.ts`; impact.md captures it).
No `quickstart.md` (developer onboarding stays in root README from Phase 0).
No `contracts/` directory (interfaces live in `adapters/` per architecture.md §6.5).

### Source Code (per architecture.md §6.5)

```text
packages/agent-core/src/
├── adapters/
│   ├── README.md                    # already from Phase 0; updated to reference BrowserEngine
│   └── BrowserEngine.ts             # NEW — adapter interface (R9)
├── browser-runtime/
│   ├── BrowserManager.ts            # NEW — Playwright wrapper, implements BrowserEngine
│   └── StealthConfig.ts             # NEW — reduced-scope rotation (no playwright-extra)
├── perception/
│   ├── types.ts                     # NEW — PageStateModel Zod schemas
│   ├── AccessibilityExtractor.ts    # NEW
│   ├── HardFilter.ts                # NEW
│   ├── SoftFilter.ts                # NEW
│   ├── MutationMonitor.ts           # NEW
│   ├── ScreenshotExtractor.ts       # NEW
│   ├── ContextAssembler.ts          # NEW
│   └── index.ts                     # NEW — barrel export
├── observability/                   # already from Phase 0; new correlation fields registered here
│   └── logger.ts                    # MODIFIED — add session_id, page_url, extractor to default schema
└── tests/
    ├── conformance/                 # NEW — 9 conformance tests, one per extractor + types
    │   ├── browser-manager.test.ts
    │   ├── stealth-config.test.ts
    │   ├── accessibility-extractor.test.ts
    │   ├── hard-filter.test.ts
    │   ├── soft-filter.test.ts
    │   ├── mutation-monitor.test.ts
    │   ├── screenshot-extractor.test.ts
    │   ├── context-assembler.test.ts
    │   └── perception-types.test.ts
    └── integration/
        └── phase1.test.ts           # NEW — T015 acceptance against 3 sites
```

**Files this feature creates / modifies:**

| File path | Layer | Purpose | New or existing? |
|---|---|---|---|
| `packages/agent-core/src/adapters/BrowserEngine.ts` | adapters | Adapter interface + SessionOpts Zod | new |
| `packages/agent-core/src/browser-runtime/BrowserManager.ts` | browser-runtime | Playwright Chromium wrapper | new |
| `packages/agent-core/src/browser-runtime/StealthConfig.ts` | browser-runtime | Per-session UA/viewport/WebGL rotation (reduced) | new |
| `packages/agent-core/src/perception/types.ts` | perception | PageStateModel + sub-schemas | new |
| `packages/agent-core/src/perception/AccessibilityExtractor.ts` | perception | AX-tree from Playwright | new |
| `packages/agent-core/src/perception/HardFilter.ts` | perception | Invisible/disabled/zero-dim removal | new |
| `packages/agent-core/src/perception/SoftFilter.ts` | perception | Relevance scoring + top 30 | new |
| `packages/agent-core/src/perception/MutationMonitor.ts` | perception | DOM stability via MutationObserver | new |
| `packages/agent-core/src/perception/ScreenshotExtractor.ts` | perception | JPEG ≤ 150 KB ≤ 1280 px (Sharp) | new |
| `packages/agent-core/src/perception/ContextAssembler.ts` | perception | Orchestrator → PageStateModel | new |
| `packages/agent-core/src/perception/index.ts` | perception | Barrel export | new |
| `packages/agent-core/src/observability/logger.ts` | observability | Add session_id/page_url/extractor correlation fields | modified (from Phase 0) |
| `packages/agent-core/src/adapters/README.md` | adapters | Reference BrowserEngine as first concrete implementation | modified (from Phase 0) |
| `packages/agent-core/tests/conformance/browser-manager.test.ts` | conformance | AC-01 | new |
| `packages/agent-core/tests/conformance/stealth-config.test.ts` | conformance | AC-02 | new |
| `packages/agent-core/tests/conformance/accessibility-extractor.test.ts` | conformance | AC-03 | new |
| `packages/agent-core/tests/conformance/hard-filter.test.ts` | conformance | AC-04 | new |
| `packages/agent-core/tests/conformance/soft-filter.test.ts` | conformance | AC-05 | new |
| `packages/agent-core/tests/conformance/mutation-monitor.test.ts` | conformance | AC-06 | new |
| `packages/agent-core/tests/conformance/screenshot-extractor.test.ts` | conformance | AC-07 | new |
| `packages/agent-core/tests/conformance/context-assembler.test.ts` | conformance | AC-08 | new |
| `packages/agent-core/tests/conformance/perception-types.test.ts` | conformance | AC-09 | new |
| `packages/agent-core/tests/integration/phase1.test.ts` | integration | AC-10 + acceptance gate for Phase 1 | new |
| `packages/agent-core/package.json` | manifest | Add `playwright`, `sharp`, `tiktoken` deps | modified (from Phase 0) |

**Structure Decision:** All paths fit architecture.md §6.5. No §6.5 amendment needed.

---

## Phase 0 — Research

**No research needed.** Zero NEEDS CLARIFICATION markers. Open design choices resolved:

1. **Playwright AX-tree fetch method:** `page.accessibility.snapshot({ interestingOnly: false })` — captures hidden + ignored nodes too, then HardFilter prunes. Alternative (`interestingOnly: true`) drops too many nodes for filter logic to verify > 50% reduction.
2. **Tokenizer for size budget:** `tiktoken` `cl100k_base` (Claude/GPT-4 family). Pinned dep version chosen at T014 implementation time.
3. **Sharp compression strategy for screenshots:** native Playwright JPEG with quality 80 first; if > 150 KB, Sharp re-encodes with `mozjpeg` + reduces dimensions iteratively (one retry max — kill criterion).
4. **MutationMonitor settle algorithm:** poll for 500 ms with no mutations; once observed, mark stable. Maximum 10 s timeout, then return `stable: false` with `diagnostics.unstable: true`. NOT a busy loop — uses `MutationObserver` events.
5. **Reduced StealthConfig pool sizes:** 5-10 modern Chrome user-agent strings (real strings from current Chrome stable + Edge); 3 viewport sizes (1280×720, 1440×900, 1920×1080); WebGL vendor/renderer pair fixed to "Google Inc." / "ANGLE (Intel HD Graphics)" via `addInitScript` patching `WebGLRenderingContext.prototype.getParameter`.

---

## Phase 1 — Design

### Adapter interface (T006 dep)

`BrowserEngine` exposes `newSession(opts?)` returning `BrowserSession`. `BrowserSession.page` is a Phase-1-minimal wrapper of Playwright `Page` exposing only methods Phase 1 uses (`goto`, `accessibility.snapshot`, `screenshot`, `addInitScript`, `evaluate`, `waitForLoadState`). This re-typing prevents Playwright type leakage into perception modules.

### PageStateModel Zod schemas (T014 dep — must land before extractors that emit sub-types)

Sub-schemas:
- `MetadataSchema` — url, title, statusCode, navigationStartedAt (ISO), navigationEndedAt (ISO).
- `AccessibilityNodeSchema` — recursive (children: AccessibilityNodeSchema[]); fields role, name, value, description, hidden, disabled, focused, expanded, selected, level, valueMin, valueMax, valueText, autocomplete, haspopup, multiline, multiselectable, orientation, pressed, readonly, required, modal, keyshortcuts, roledescription, boundingBox.
- `AccessibilityTreeSchema` — root: AccessibilityNodeSchema, totalNodeCount: number.
- `FilteredDOMSchema` — top30: Array<{ id: string; role: string; name?: string; boundingBox: { x, y, w, h }; relevanceScore: number }>.
- `InteractiveGraphSchema` — clickable: Array<{ id, role, name?, score }>; typeable: same shape; submittable: same shape.
- `VisualSchema` — screenshotPath?: string; mimeType: 'image/jpeg'; sizeBytes: number; width: number; height: number.
- `DiagnosticsSchema` — axNodeCount, mutationsObserved, stable: boolean, lowAxNodeCount: boolean, unstable: boolean, errors: string[].

All schemas `.strict()` (no extra props).

### Per-extractor design

1. **AccessibilityExtractor** (T008): calls `page.accessibility.snapshot({ interestingOnly: false })`; recursively counts nodes; warns at < 50 nodes; returns root + count.
2. **HardFilter** (T009): pure function on AccessibilityTree; drops nodes by hidden/disabled/aria-hidden/zero-dim; recursive; returns `{ tree: AccessibilityTree; reductionPct: number; reductionFloorWaived: boolean }` — per spec v0.2 AC-04, when input has < 20 pre-filter nodes the > 50% reduction floor is waived and `reductionFloorWaived: true` so downstream diagnostics can distinguish degenerate-page filtering from typical-page filtering.
3. **SoftFilter** (T010): pure function on filtered tree; scoring formula `score = baseRoleWeight × textWeight × positionWeight × visibilityWeight` (multiplicative per R4.4); top 30 by descending score; returns FilteredDOM.
4. **MutationMonitor** (T011): `addInitScript` injects MutationObserver harness into page; polls window.__neuralMutationLog; computes settle; returns Diagnostics fragment.
5. **ScreenshotExtractor** (T012): `page.screenshot({ type: 'jpeg', quality: 80, fullPage: false })`; if > 150 KB, Sharp re-encodes; one retry max with reduced dimensions; returns Visual.
6. **ContextAssembler** (T013): orchestrates in this order: newSession (BrowserEngine) → applyStealthConfig → page.goto → MutationMonitor.observe → AccessibilityExtractor.extract → HardFilter.apply → SoftFilter.apply → ScreenshotExtractor.capture → assemble PageStateModel → tokenize via tiktoken cl100k_base. **Owns session lifecycle** — MUST close in `finally` to satisfy NF-Phase1-05 (no zombie Chromium). **Deterministic shrink ladder** (per spec.md v0.2 Key Entities) when token count > 1500: (a) AccessibilityTree depth 10 → 6, (b) FilteredDOM top-30 → top-20, (c) drop Visual sub-section. If any stage brings count under 1500, accept with `diagnostics.warnings: ['shrunk-from-N-tokens']`. If all 3 stages applied and still > 1500, accept with `diagnostics.errors: ['oversized-after-shrink']` — NOT a thrown error. The ladder is deterministic so same input → same output.

7. **PageStateModel `_extensions` field** (T014 — forward-compatibility seam per analyze X2): `_extensions?: Record<string, unknown>` reserved at the top level of `PageStateModelSchema`. Phase 1 MUST NOT populate this field. Documented at T014 + impact.md "Forward Contract" section. Phase 7 namespaces enrichment under `_extensions.deepPerceive` to avoid forcing a Phase 1 schema migration when the deep_perceive node lands.

### Test strategy

Per R3.1 TDD, T-PHASE1-TESTS (acceptance test for AC-01..AC-10) authored FIRST and observed FAILING before any extractor lands. Conformance tests (per AC) authored alongside or just before each implementation task; all must FAIL initially.

The T015 integration test fixture URLs:
- `https://example.com` (simple control)
- `https://www.amazon.in` (complex e-commerce; bot detection MAY produce CAPTCHA wall — acceptance still passes if PageStateModel < 1500 tokens, per spec edge case)
- A Shopify demo storefront (specific URL TBD at implementation time; if unavailable, test marks `skip` rather than fail)

---

## Complexity Tracking

**None — plan respects all 23 Constitution rules.**

The new adapter (`BrowserEngine`) is the *expected* outcome of R9; not a violation. impact.md provides provenance per R22.

---

## Approval Gates

| Gate | Approver | Evidence |
|---|---|---|
| Spec → Plan transition | spec author + product owner | spec.md `status: approved` AND impact.md `status: approved` |
| Tech stack adherence | engineering lead | All §6.4 fields match canonical (table above; new deps Sharp + tiktoken pinned at T014 time) |
| Constitution check | engineering lead | All checkboxes ticked above |
| Impact analysis approved | engineering lead | impact.md `status: approved` (R20 mandatory) |
| Plan → Tasks transition | engineering lead | This plan `status: approved` |

After all gates pass, run `/speckit.tasks` to decompose into `tasks.md`.

---

## Cross-references

- spec.md, impact.md, README.md (this folder)
- `docs/specs/mvp/phases/phase-0-setup/spec.md` — Phase 0 prerequisite
- `docs/specs/mvp/architecture.md` §6.4 + §6.5
- `docs/specs/mvp/constitution.md` R4, R9, R10, R11, R17-R20, R22-R23
- `docs/specs/mvp/tasks-v2.md` v2.3.1 — T006-T015 with T007 reduced
- `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` — REQ-BROWSE-* canonical
- `docs/specs/final-architecture/06-browse-mode.md` — REQ-BROWSE-* in MVP context

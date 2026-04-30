---
title: Phase 1 — Browser Perception Foundation
artifact_type: spec
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
  - docs/specs/mvp/PRD.md (F-003 Browser Agent, F-004 Browser Perception)
  - docs/specs/mvp/constitution.md (R1-R26; especially R4 browser rules + R9 adapter pattern)
  - docs/specs/mvp/architecture.md (§6.4 tech stack, §6.5 file locations)
  - docs/specs/mvp/tasks-v2.md (T006-T015 — T007 SCOPE REDUCED v2.3.1)
  - docs/specs/AI_Browser_Agent_Architecture_v3.1.md (canonical browser agent spec; v1.1 stealth deferred)
  - docs/specs/final-architecture/06-browse-mode.md (REQ-BROWSE-* IDs)
  - docs/specs/mvp/phases/phase-1-perception/README.md
  - docs/specs/mvp/phases/phase-0-setup/spec.md (Phase 0 prerequisite — monorepo + agent-core skeleton)

req_ids:
  - REQ-BROWSE-NODE-003
  - REQ-BROWSE-HUMAN-005 (MVP-reduced scope)
  - REQ-BROWSE-HUMAN-006 (MVP-reduced scope)
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
    - Phase 1 spec — first phase to introduce shared contracts (BrowserEngine adapter + PageStateModel schema) per R20
    - AC-01 through AC-10 stable IDs for T006-T015 acceptance
    - R-01 through R-11 functional requirements
    - v0.2 — AC-04 now defines a node-count floor for degenerate pages (analyze finding A1)
    - v0.2 — Key Entities + R-10 now document the ContextAssembler oversize-handling shrink algorithm (analyze finding A4)
    - v0.2 — Key Entities now documents PageStateModel `_extensions` reservation for Phase 7+ deep_perceive composition (analyze finding X2)
    - v0.3 — R-09 now cites REQ-BROWSE-PERCEPT-004 for screenshot fallback (analyze finding M4)
  changed:
    - v0.1 → v0.2 frontmatter affected_contracts standardized to short form (was prose); descriptive prose retained in body (analyze finding C3)
    - v0.1 → v0.2 4 polish fixes from /speckit.analyze report (A1, A4, C3, X2) without changing AC-NN IDs (R18 append-only preserved)
    - v0.2 → v0.3 6 polish fixes from /speckit.analyze report — M1 (R10→R13 stale xref for temperature=0); M2 (constitution citation R1-R23 → R1-R26); M3 (R-05 drops misattributed REQ-BROWSE-PERCEPT-002 since AccessibilityExtractor does no filtering); M4 (R-09 cites REQ-BROWSE-PERCEPT-004 for screenshot fallback); L1 (dedupe BrowserEngine heading); L2 (token-budget operator standardized to `<` not `≤`); no AC-NN/R-NN/SC-NNN IDs changed (R18 append-only preserved)
  impacted:
    - Constitution R9 — first concrete adapter implementation lands here (BrowserEngine)
    - tasks-v2.md v2.3.1 — T007 scope reduction reflected in this spec
    - plan.md + impact.md + tasks.md (v0.1 → v0.2) for parallel fixes
    - plan.md + impact.md + tasks.md (v0.2 → v0.3) for parallel polish sync (plan absorbs M1+M2+L5+L6; impact + tasks frontmatter sync only)
  unchanged:
    - AC-01..AC-10 stable IDs and acceptance scenarios (R18 append-only)
    - R-01..R-11 functional requirement IDs and statements
    - Out of Scope, Success Criteria, Constitution Alignment Check sections preserved verbatim

governing_rules:
  - Constitution R4 (Browser Agent Rules)
  - Constitution R9 (Loose Coupling / Adapter Pattern)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R17 (Lifecycle States)
  - Constitution R18 (Delta-Based Updates)
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes)
  - Constitution R22 (Ratchet)
  - Constitution R23 (Kill Criteria)
---

# Feature Specification: Phase 1 — Browser Perception Foundation

> **Summary (~150 tokens — agent reads this first):** Build the browser perception pipeline. Open a Playwright Chromium session via the new `BrowserEngine` adapter, capture an accessibility tree from any public web page, filter it down to a compact action-oriented `PageStateModel` under 1500 tokens, monitor DOM mutations for stability within 2 seconds, and produce a JPEG screenshot fallback. Ten tasks (T006-T015) cover BrowserManager (R9 adapter implementation), reduced-scope StealthConfig (UA + viewport + WebGL rotation only — full stealth plugin deferred to v1.1 per tasks-v2 v2.3.1), AccessibilityExtractor + HardFilter + SoftFilter, MutationMonitor, ScreenshotExtractor, ContextAssembler, PageStateModel Zod schemas, and a Phase 1 integration test on three sites (example.com, amazon.in, Shopify demo). No MCP tools, no LLM calls, no verification — pure perception.

**Feature Branch:** `phase-1-perception` (created at implementation time)
**Input:** Phase 1 scope from `docs/specs/mvp/phases/INDEX.md` row 1 + `tasks-v2.md` T006-T015 (v2.3.1)

---

## Mandatory References

1. `docs/specs/mvp/constitution.md` — R4 (Browser Agent Rules) + R9 (Adapter Pattern) are first-class concerns this phase. R10 (file/function size) + R11 (spec discipline) + R17-R23 (lifecycle/delta/rollup/impact/Ratchet/kill) all apply.
2. `docs/specs/mvp/PRD.md` §F-003 (Browser Agent) + §F-004 (Browser Perception) — canonical scope. NF-001..NF-010 not yet observable in Phase 1 (no audits run; PageStateModel size constraint < 1500 tokens is the only measurable target).
3. `docs/specs/mvp/architecture.md` §6.4 (Playwright pinned; stealth deferred to v1.1) + §6.5 (file location decision tree).
4. `docs/specs/mvp/tasks-v2.md` T006-T015 (v2.3.1 — T007 reduced).
5. `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` — canonical browser agent spec for REQ-BROWSE-* IDs.
6. `docs/specs/final-architecture/06-browse-mode.md` — browse-mode REQ-IDs.
7. `docs/specs/mvp/phases/phase-0-setup/spec.md` — Phase 0 prerequisites (monorepo, agent-core skeleton, Vitest, observability logger, adapters/ scaffold).

---

## Constraints Inherited from Neural Canonical Specs

- **Tech stack pinned (architecture.md §6.4):** Playwright (latest, default Chromium), TypeScript 5, Node 22 LTS, Vitest, Pino. NO `playwright-extra` and NO `playwright-extra-plugin-stealth` in Phase 1 — both deferred to v1.1.
- **R4 Browser Agent Rules:**
  - **R4.1** Perception first, action second — Phase 1 implements the *perception* half only; action lands in Phase 2 (MCP tools).
  - **R4.4** Multiplicative confidence decay (`current × 0.97`). Confidence-bearing extractors in Phase 1 (`SoftFilter` relevance scoring) MUST use multiplicative decay.
  - **R4.5** Tool names from v3.1 are EXACT. Component names in this phase MUST match canonical: `BrowserManager`, `AccessibilityExtractor`, `HardFilter`, `SoftFilter`, `MutationMonitor`, `ScreenshotExtractor`, `ContextAssembler`, `PageStateModel`. NEVER rename to "PageSnapshot" / "DOMScraper" / etc.
- **R9 Adapter Pattern (FIRST CONCRETE ADAPTER):**
  - `BrowserEngine` interface goes in `packages/agent-core/src/adapters/BrowserEngine.ts`.
  - `BrowserManager` (T006) implements `BrowserEngine`.
  - Direct `import { chromium } from 'playwright'` is FORBIDDEN outside `BrowserManager.ts` + the adapter interface file. ESLint rule lands in Phase 4 (when adapters become numerous); for Phase 1, code review enforces.
- **No `console.log` in production** (R10.6) — every browser event logs via Pino (skeleton from Phase 0) with correlation fields. New Phase 1 correlation fields: `session_id`, `page_url`, `extractor`.
- **No `any` without `// TODO: type this` + tracking issue** (R2.1, R13).
- **Files < 300 lines, functions < 50 lines, named exports** (R10.1-R10.3).
- **Phase 1 introduces ONE shared contract: PageStateModel** (Zod schema in `perception/types.ts`). Per R20, impact.md REQUIRED. Also introduces the `BrowserEngine` adapter interface (separate impact entry).
- **Phase 1 has NO append-only tables yet, NO LLM calls, NO heuristic content** — R5, R6, R7.4, R10 (temperature) trivially satisfied.

---

## User Scenarios & Testing

### User Story 1 — Browser captures a usable PageStateModel for any public URL (Priority: P1) 🎯 MVP

The browser agent receives a target URL, opens a Chromium session, navigates, waits for DOM stability, extracts the accessibility tree, filters it to a compact action-oriented model under 1500 tokens, captures a screenshot, and closes cleanly — all via the `BrowserEngine` adapter (R9 boundary).

**Why this priority:** This is the single user story for Phase 1. Without a working `PageStateModel`, no Phase 2 MCP tool can act, and no Phase 7 deep-perception can analyze. It is the entire MVP slice for this phase.

**Independent Test:** Run `pnpm -F @neural/agent-core test integration/phase1` against three target sites: example.com (simple), amazon.in (complex e-commerce), a Shopify demo store. All three produce a valid `PageStateModel` < 1500 tokens.

**Acceptance Scenarios:**

1. **Given** Phase 0 infrastructure is green, **When** the engineer constructs `new BrowserManager().newSession()`, **Then** a Playwright Chromium browser launches headless and returns a `BrowserSession` with `page`, `context`, and `close()` handles.
2. **Given** a `BrowserSession`, **When** the engineer calls `applyStealthConfig(context)`, **Then** the session reports a randomized user-agent (from a pool of 5-10 modern Chrome strings), one of three viewport sizes, and a stable WebGL fingerprint via `addInitScript` — and a second session reports a *different* tuple.
3. **Given** a stabilized page, **When** `accessibilityExtractor.extract(page)` runs, **Then** an AX-tree of > 50 nodes returns including the page's primary search/CTA element.
4. **Given** an AX-tree, **When** `hardFilter.apply(tree)` runs, **Then** invisible / disabled / aria-hidden / zero-dimension nodes are removed and the count drops by > 50%.
5. **Given** a hard-filtered tree, **When** `softFilter.apply(tree)` runs, **Then** the top 30 elements by relevance score are returned, ordered descending by score.
6. **Given** a navigated page, **When** `mutationMonitor.observe(page, {timeoutMs: 10000})` runs, **Then** DOM stability is reported within 2 seconds for a static page and within the 10-second timeout for a slow-loading page; failures are non-fatal.
7. **Given** a stabilized page, **When** `screenshotExtractor.capture(page)` runs, **Then** a JPEG buffer ≤ 150 KB and ≤ 1280 px wide is returned.
8. **Given** all extractors, **When** `contextAssembler.capture(url)` runs end-to-end, **Then** a `PageStateModel` is returned with sections `metadata` + `accessibilityTree` + `filteredDOM` + `interactiveGraph` + `visual?` + `diagnostics`, total tokenized size < 1500 tokens.
9. **Given** the `PageStateModel` Zod schema in `perception/types.ts`, **When** any extractor output is validated, **Then** every sub-type validates without `any` or unchecked fields.
10. **Given** the integration test `tests/integration/phase1.test.ts`, **When** it runs against example.com, amazon.in, and a Shopify demo, **Then** all three sites yield a `< 1500 token` `PageStateModel` and the test exits 0.

### Edge Cases

- **Navigation failure (DNS error / timeout):** logged via Pino at warn level; non-fatal; `BrowserSession.close()` still works.
- **AX-tree returns < 10 nodes (e.g., heavy SPA before hydration):** `MutationMonitor` retries once after 2s; if still < 10, screenshot fallback engages and PageStateModel still returns (with `diagnostics.lowAxNodeCount: true`).
- **Page never stabilizes within 10s:** mutation monitor returns `stable: false`; ContextAssembler still produces a PageStateModel with `diagnostics.unstable: true` rather than blocking forever.
- **ScreenshotExtractor produces > 150 KB:** Sharp resize + recompress to ≤ 150 KB before returning. Unbounded retry not allowed — fail after 1 retry with smaller dimensions.
- **Bot detection fires on amazon.in:** Documented, expected with reduced-scope T007. Phase 1 acceptance does NOT require evading detection — that's v1.1's job. Test asserts a PageStateModel returns with the actual page content (which on a bot wall might be a CAPTCHA page); the test should still pass with `< 1500 token` PageStateModel of the CAPTCHA wall, NOT fail.
- **Cookie banner blocks initial render:** Phase 1 does NOT include OverlayDismisser (that lands in Phase 5 Browse MVP). MutationMonitor settles after the banner finishes animating; PageStateModel reflects whatever is visible.

---

## Acceptance Criteria *(stable IDs, append-only)*

| ID | Criterion | Conformance test path | Linked task |
|----|-----------|----------------------|-------------|
| AC-01 | `new BrowserManager().newSession()` launches a Playwright Chromium browser headless and returns a `BrowserSession` with `page`, `context`, `close()` handles; `close()` releases all OS handles (no zombie processes) | `packages/agent-core/tests/conformance/browser-manager.test.ts` | T006 |
| AC-02 | `applyStealthConfig(context)` randomizes UA + viewport + WebGL fingerprint per session; consecutive sessions report different tuples; does NOT load `playwright-extra` (verified by inspecting installed deps); reduced scope per tasks-v2 v2.3.1 | `packages/agent-core/tests/conformance/stealth-config.test.ts` | T007 |
| AC-03 | `accessibilityExtractor.extract(page)` returns AX-tree of > 50 nodes for amazon.in homepage; tree includes the primary search element (role=searchbox or input[type=search]) | `packages/agent-core/tests/conformance/accessibility-extractor.test.ts` | T008 |
| AC-04 | `hardFilter.apply(tree)` removes nodes where any of: `hidden=true`, `disabled=true`, `aria-hidden="true"`, `boundingBox.width=0 OR height=0`; on typical pages (≥ 20 pre-filter nodes) reduction MUST be > 50% (amazon.in fixture); on degenerate pages (< 20 pre-filter nodes) no minimum reduction enforced — filter still applied but result returned as-is, with `reductionFloorWaived: true` in the return payload for diagnostics | `packages/agent-core/tests/conformance/hard-filter.test.ts` | T009 |
| AC-05 | `softFilter.apply(tree)` returns top 30 elements by relevance score; score uses multiplicative decay per R4.4 (NOT additive); output is ordered descending by score | `packages/agent-core/tests/conformance/soft-filter.test.ts` | T010 |
| AC-06 | `mutationMonitor.observe(page, opts)` injects a `MutationObserver` via `addInitScript`, polls for settle (no mutations in 500 ms window), reports `stable: true` within 2 s on static pages and `stable: false` after 10 s timeout; failures are non-fatal | `packages/agent-core/tests/conformance/mutation-monitor.test.ts` | T011 |
| AC-07 | `screenshotExtractor.capture(page)` returns a JPEG `Buffer` ≤ 150 KB and ≤ 1280 px wide; uses Sharp for compression if Playwright's native output exceeds the cap | `packages/agent-core/tests/conformance/screenshot-extractor.test.ts` | T012 |
| AC-08 | `contextAssembler.capture(url)` returns a complete `PageStateModel` with all 6 sections; total tokenized size < 1500 tokens for example.com, amazon.in, Shopify demo | `packages/agent-core/tests/conformance/context-assembler.test.ts` | T013 |
| AC-09 | `perception/types.ts` exports Zod schemas for: `PageStateModel`, `Metadata`, `AccessibilityTree`, `FilteredDOM`, `InteractiveGraph`, `Visual`, `Diagnostics`; every schema validates fixture data without `z.any()` or unchecked unions | `packages/agent-core/tests/conformance/perception-types.test.ts` | T014 |
| AC-10 | `tests/integration/phase1.test.ts` runs ContextAssembler against 3 fixture URLs (example.com, amazon.in, Shopify demo); all 3 produce valid PageStateModel < 1500 tokens and the test suite exits 0 | `packages/agent-core/tests/integration/phase1.test.ts` (this test IS the conformance proof) | T015 |

AC-NN IDs are append-only on subsequent edits per Constitution R18.

---

## Functional Requirements

| ID | Requirement | Cites PRD F-NNN | Linked architecture spec |
|----|-------------|-----------------|--------------------------|
| R-01 | System MUST define a `BrowserEngine` adapter interface in `packages/agent-core/src/adapters/BrowserEngine.ts` that abstracts all Playwright surface used by Phase 1 (newContext, newPage, navigation, AX-tree fetch, screenshot, addInitScript) | F-003, R9 | architecture.md §6.5; `06-browse-mode.md` REQ-BROWSE-NODE-003 |
| R-02 | System MUST implement `BrowserManager` in `packages/agent-core/src/browser-runtime/BrowserManager.ts` that wraps Playwright Chromium and returns `BrowserSession` (Zod-validated) implementing `BrowserEngine` | F-003 | REQ-BROWSE-NODE-003 |
| R-03 | System MUST provide `StealthConfig` in `browser-runtime/StealthConfig.ts` with reduced scope: per-session UA + viewport + WebGL fingerprint rotation via Playwright native API; NO `playwright-extra` dependency in MVP | F-003 (reduced) | REQ-BROWSE-HUMAN-005, REQ-BROWSE-HUMAN-006 (MVP-reduced); tasks-v2 v2.3.1 |
| R-04 | System MUST define `PageStateModel` Zod schema (with sub-schemas: `Metadata`, `AccessibilityTree`, `FilteredDOM`, `InteractiveGraph`, `Visual`, `Diagnostics`) in `packages/agent-core/src/perception/types.ts` | F-004 | REQ-BROWSE-PERCEPT-001 |
| R-05 | System MUST implement `AccessibilityExtractor` in `perception/AccessibilityExtractor.ts` that fetches Playwright AX-tree (via `page.accessibility.snapshot`) returning > 50 nodes for typical e-commerce pages | F-004 | REQ-BROWSE-PERCEPT-001 |
| R-06 | System MUST implement `HardFilter` in `perception/HardFilter.ts` removing invisible / disabled / aria-hidden / zero-dim nodes; > 50% reduction on typical pages | F-004 | REQ-BROWSE-PERCEPT-002 |
| R-07 | System MUST implement `SoftFilter` in `perception/SoftFilter.ts` scoring elements by relevance with multiplicative decay (R4.4); returns top 30 | F-004 | REQ-BROWSE-PERCEPT-003 |
| R-08 | System MUST implement `MutationMonitor` in `perception/MutationMonitor.ts` injecting `MutationObserver`, settling within 2 s on static, 10 s timeout on dynamic pages | F-003 | REQ-BROWSE-PERCEPT-005, REQ-BROWSE-PERCEPT-006 |
| R-09 | System MUST implement `ScreenshotExtractor` in `perception/ScreenshotExtractor.ts` producing JPEG ≤ 150 KB ≤ 1280 px wide (Sharp for compression) | F-004 | REQ-BROWSE-PERCEPT-004 (screenshot fallback when filtered node count < 10) |
| R-10 | System MUST implement `ContextAssembler` in `perception/ContextAssembler.ts` orchestrating extractors → `PageStateModel`. If candidate model > 1500 tokens, MUST apply the deterministic shrink ladder (Key Entities §Oversize-handling) before accepting with `diagnostics.errors: ['oversized-after-shrink']`. MUST close session in `finally` to prevent zombie processes (NF-Phase1-05). | F-004 | REQ-BROWSE-PERCEPT-001 |
| R-11 | System MUST provide `tests/integration/phase1.test.ts` validating end-to-end pipeline on 3 sites | F-003 + F-004 acceptance | (integration test, no REQ-ID) |

---

## Non-Functional Requirements

| ID | Metric | Target | Cites PRD NF-NNN | Measurement method |
|----|--------|--------|------------------|--------------------|
| NF-Phase1-01 | `PageStateModel` size | < 1500 tokens | (rolls up to NF-008 perception size budget) | tokenize via `tiktoken` (or equivalent) on JSON-stringified output |
| NF-Phase1-02 | MutationMonitor settle on static page | < 2 seconds | (rolls up to NF-001 audit < 30 min) | Pino timing log `mutation_monitor.settle_ms` |
| NF-Phase1-03 | Phase 1 integration test wall-clock | < 60 seconds total for 3 sites | (rolls up to NF-001) | Vitest test timing |
| NF-Phase1-04 | Screenshot output size | ≤ 150 KB | (storage cost ceiling per audit run) | Buffer `length` check |
| NF-Phase1-05 | BrowserSession close → 0 zombie processes | 0 dangling Chromium processes after `close()` | (resource hygiene; rolls up to operational stability) | `ps aux | grep chromium` count delta around `close()` (manual; not in automated test) |

---

## Key Entities

**`PageStateModel`** (NEW shared contract — see `impact.md`)
- Lives in `packages/agent-core/src/perception/types.ts`
- Composed of: `Metadata` (url, title, statusCode, navigationStartedAt, navigationEndedAt), `AccessibilityTree` (root + filtered nodes), `FilteredDOM` (top-30 elements with bounding boxes), `InteractiveGraph` (clickable / typeable / submittable structure), `Visual` (optional screenshot reference), `Diagnostics` (axNodeCount, mutationsObserved, stable, lowAxNodeCount, unstable, errors, warnings)
- Total tokenized JSON < 1500 tokens (cl100k_base) — see oversize-handling below
- Includes `_extensions?: z.record(z.string(), z.unknown())` field — RESERVED for Phase 7+ deep_perceive enrichment without forcing a schema migration. Phase 1 itself MUST NOT populate `_extensions`; Phase 7 will namespace its enrichments under `_extensions.deepPerceive` per R20 forward-compatibility hygiene.

**Oversize-handling algorithm (R-10 / T013)**

When `ContextAssembler` produces a candidate `PageStateModel` exceeding the 1500-token budget (NF-Phase1-01), it applies a deterministic shrink ladder *before* declaring failure:

1. **Stage 1 — AccessibilityTree depth reduction:** truncate recursion depth from default 10 → 6 levels. Re-tokenize.
2. **Stage 2 — FilteredDOM truncation:** reduce top-30 → top-20 elements. Re-tokenize.
3. **Stage 3 — Visual drop:** omit the `Visual` sub-section entirely (screenshot still available out-of-band; just not referenced in the model). Re-tokenize.
4. **Stage 4 — Accept oversized:** if all 3 shrink stages applied and still > 1500, return the model with `diagnostics.errors: ['oversized-after-shrink']`. Do NOT throw.

If any stage brings the model back under 1500 tokens, accept with `diagnostics.warnings: ['shrunk-from-N-tokens']` recording the original size. The shrink ladder is deterministic — same input always produces same output.

**`BrowserEngine`** (NEW adapter interface — see `impact.md`)
- Lives in `packages/agent-core/src/adapters/BrowserEngine.ts`
- Methods: `newSession(opts?: SessionOpts): Promise<BrowserSession>`, `BrowserSession` exposes `page: BrowserPage` (re-typed Phase-1-minimal wrapper; NOT raw Playwright `Page` — prevents Playwright type leakage upstream), `context`, `close(): Promise<void>`
- Phase 4+ adds methods (`evaluate`, `screenshot variants`, `pdf`); for Phase 1, the interface is minimal but extensible

**`BrowserSession`** (Phase-1 internal type)
- Returned by `BrowserManager.newSession()`
- Owns its own Pino child logger with `session_id` correlation field

---

## Success Criteria

- **SC-001:** A new browser session yields a usable PageStateModel for example.com, amazon.in, and a Shopify demo in under 60 seconds total (NF-Phase1-03).
- **SC-002:** All 10 acceptance criteria (AC-01 through AC-10) pass in CI.
- **SC-003:** No direct `import ... from 'playwright'` exists outside `BrowserManager.ts` and `adapters/BrowserEngine.ts` (R9 boundary verified by grep).
- **SC-004:** The `BrowserEngine` adapter interface lets Phase 4+ (LLMAdapter / verification) compose against a stable seam without further changes.
- **SC-005:** PageStateModel Zod schema validates all fixture data with zero `z.any()` escapes.

---

## Constitution Alignment Check

- [x] Does NOT predict conversion rates (R5.3 + GR-007) — Phase 1 has no findings
- [x] Does NOT auto-publish findings without consultant review (warm-up rule, F-016) — N/A in Phase 1
- [x] Does NOT UPDATE or DELETE rows from append-only tables (R7.4) — no DB writes in Phase 1
- [x] Does NOT import vendor SDKs outside adapters (R9) — `BrowserEngine` adapter introduced; `BrowserManager` is the only Playwright importer
- [x] Does NOT set temperature > 0 on `evaluate` / `self_critique` / `evaluate_interactive` (R13 Forbidden Patterns; constitution.md §13 line 411 codifies temperature=0 invariant — `(R10)` was a stale xref per constitution.md note_on_stale_xref) — no LLM calls in Phase 1
- [x] Does NOT expose heuristic content outside the LLM evaluate prompt (R6) — no heuristics in Phase 1
- [x] DOES include conformance test stubs for every AC-NN — see `packages/agent-core/tests/conformance/*.test.ts` paths in AC table
- [x] DOES carry frontmatter delta block — see frontmatter
- [x] DOES define kill criteria — default block in tasks.md applies; T013 ContextAssembler + T015 integration test flagged for explicit kill criteria (estimated > 2 hrs each + integration-heavy)
- [x] DOES reference REQ-IDs — REQ-BROWSE-NODE-003, REQ-BROWSE-HUMAN-005/006 (MVP-reduced), REQ-BROWSE-PERCEPT-001/002/003/005/006
- [x] DOES include impact.md — required by R20 (BrowserEngine adapter + PageStateModel are shared contracts); see this folder's `impact.md`

All boxes ticked → spec eligible for `validated → approved` after impact.md authored.

---

## Out of Scope

- **MCP tools** (browser_get_state, browser_click, browser_type, etc.) — Phase 2
- **OverlayDismisser + 12 selector patterns** — Phase 5 Browse MVP
- **RateLimiter + CircuitBreaker** — Phase 5
- **Verification engine + 9 verify strategies** — Phase 3
- **Human behavior** (ghost-cursor, Gaussian typing) — Phase 2 (T016-T017)
- **`playwright-extra` + stealth plugin** — v1.1 (deferred per PRD §3.1 + tasks-v2 v2.3.1)
- **bot.sannysoft.com full-pass acceptance** — v1.1
- **PDF generation** — Phase 9 Delivery
- **LLM calls / Anthropic SDK** — Phase 4 (LLMAdapter introduction)
- **Drizzle / DB persistence** — Phase 4
- **Authentication / Clerk** — Phase 9
- **CI / GitHub Actions** — Phase 9

---

## Assumptions

- **Playwright headless Chromium is the only browser engine in MVP.** Firefox + WebKit support deferred indefinitely.
- **AX-tree from Playwright is the primary perception source.** Falls back to screenshot only when AX-tree returns < 10 nodes (handled in Phase 5; Phase 1 just logs `lowAxNodeCount`).
- **Network conditions are unrestricted in tests.** Phase 1 integration tests assume the developer has internet access; offline / cached fixtures land in v1.2 per PRD §3.2.
- **Shopify demo URL** is a stable Shopify test storefront URL provided in the test fixture (e.g., a publicly-accessible demo); if unavailable, the test marks that case `skip` rather than failing the suite.
- **Reduced T007 stealth scope is acceptable for the integration test on amazon.in.** If amazon.in's bot detection produces a CAPTCHA wall, Phase 1 acceptance still passes if the PageStateModel of the CAPTCHA wall is valid and < 1500 tokens. T007's purpose is per-session rotation, not detection evasion.
- **PageStateModel token count is computed via `tiktoken` cl100k_base** (Claude/GPT-4 family tokenizer) — pinned in Phase 1 deps.
- **`addInitScript` for fingerprint rotation** runs before navigation; no race with page-load fingerprinting code in MVP scope.

---

## Next Steps

1. Author `impact.md` (REQUIRED by R20) documenting `BrowserEngine` adapter interface + `PageStateModel` schema introduction.
2. Run `/speckit.plan` (or write `plan.md` directly) to derive implementation plan.
3. Run `/speckit.tasks` to produce `tasks.md` referencing T006-T015 from tasks-v2.md v2.3.1.
4. Run `/speckit.analyze` for cross-artifact consistency check.
5. Phase 1 implementation runs in a separate session (per agreed workflow split).

---

## Cross-references

- `docs/specs/mvp/phases/phase-0-setup/spec.md` — Phase 0 prerequisite (this phase depends on it)
- `docs/specs/mvp/tasks-v2.md` v2.3.1 — T006-T015 with T007 reduced
- `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` REQ-BROWSE-* — canonical browser spec
- `docs/specs/final-architecture/06-browse-mode.md` — browse-mode REQ-IDs
- `docs/specs/mvp/PRD.md` §F-003, §F-004
- `docs/specs/mvp/architecture.md` §6.4 (Playwright pinned, stealth deferred), §6.5 (file structure)
- `docs/specs/mvp/constitution.md` R4, R9, R20

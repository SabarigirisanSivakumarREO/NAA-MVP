---
title: Phase 1 — Browser Perception Foundation
artifact_type: phase-readme
status: approved
version: 1.0
phase_number: 1
phase_name: Perception
created: 2026-04-27
updated: 2026-04-27
owner: engineering lead
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
    - Phase 1 README created
  changed: []
  impacted: []
  unchanged: []
governing_rules:
  - Constitution R4 (Browser Agent Rules)
  - Constitution R9 (Loose Coupling / Adapter Pattern)
  - Constitution R17, R19
  - PRD §F-003 (Browser Agent), §F-004 (Browser Perception)
---

# Phase 1 — Browser Perception Foundation

> **Summary (~150 tokens):** Establish the browser agent's perception pipeline. Open a Playwright Chromium session, capture an accessibility tree, filter it down to a compact action-oriented `PageStateModel` under 1500 tokens, monitor DOM mutations for stability, and produce a screenshot fallback. 10 tasks (T006-T015): BrowserManager + reduced-scope StealthConfig (v1.1 stealth plugin deferred per tasks-v2.md v2.3.1), AccessibilityExtractor + HardFilter + SoftFilter, MutationMonitor, ScreenshotExtractor, ContextAssembler, PageStateModel Zod types, Phase 1 integration test on 3 sites. No MCP tools, no LLM calls, no verification — pure perception. Blocks Phase 2 (MCP tools) and Phase 5 (Browse MVP).

## Goal

After Phase 1, calling `contextAssembler.capture(url)` returns a complete `PageStateModel` (metadata + accessibilityTree + filteredDOM + interactiveGraph + visual + diagnostics) under 1500 tokens for example.com, amazon.in, and a Shopify demo storefront. The browser closes cleanly. No detected automation arms race in MVP — basic per-session UA/viewport/fingerprint rotation only (full stealth deferred to v1.1).

## Tasks

| Task | Description |
|---|---|
| T006 | BrowserManager — Playwright wrapper implementing BrowserEngine adapter |
| T007 | StealthConfig — reduced scope: UA + viewport + WebGL fingerprint rotation (no playwright-extra in MVP) |
| T008 | AccessibilityExtractor — Playwright AX-tree, > 50 nodes |
| T009 | HardFilter — removes invisible/disabled/aria-hidden/zero-dim (> 50% reduction) |
| T010 | SoftFilter — relevance scoring, top 30 |
| T011 | MutationMonitor — MutationObserver, settles within 2s |
| T012 | ScreenshotExtractor — JPEG < 150 KB, ≤ 1280 px wide |
| T013 | ContextAssembler — assembles PageStateModel from extractors |
| T014 | PageStateModel types + Zod schemas |
| T015 | Phase 1 integration test on 3 sites |

Full task descriptions in `tasks.md` (this folder). Cross-reference: `docs/specs/mvp/tasks-v2.md` T006-T015.

## Exit criteria

- [ ] `pnpm test` passes for `packages/agent-core/tests/integration/phase1.test.ts` (T015)
- [ ] PageStateModel produced for 3 sites under 1500 tokens each
- [ ] BrowserManager opens + closes cleanly without dangling handles
- [ ] All Zod schemas in `perception/types.ts` validate fixture data
- [ ] No direct Playwright imports outside `adapters/BrowserEngine.ts` + `browser-runtime/` (R9)

## Depends on

- Phase 0 (monorepo + agent-core skeleton + Vitest + observability logger)

## Blocks

- Phase 2 (MCP Tools — needs BrowserManager + PageStateModel)
- Phase 5 (Browse MVP — needs full browser perception pipeline)

## Rollup on exit

```bash
pnpm spec:rollup --phase 1
```

Generates `phase-1-current.md` per R19 + `templates/phase-rollup.template.md`. Engineering lead completes manual sections (active modules, contracts in effect — `BrowserEngine` adapter interface + `PageStateModel` schema, system flows operational, known limitations, open risks for Phase 2).

## Reading order for Claude Code

When picking up a Phase 1 task:

1. This README (you are here)
2. `tasks.md` — find target task
3. `spec.md` — AC and R-NN context for the task
4. `plan.md` — tech context + file map for the task
5. `docs/specs/final-architecture/06-browse-mode.md` — full browse-mode spec (REQ-BROWSE-*)
6. `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` — canonical browser agent spec
7. `docs/specs/mvp/PRD.md` §F-003 + §F-004 — MVP scope
8. `docs/specs/mvp/constitution.md` R4 + R9 (browser + adapter rules)

Do NOT load:
- Analysis specs (§07) — Phase 7+
- Other phase folders
- v3.1 stealth sections in detail (deferred to v1.1)

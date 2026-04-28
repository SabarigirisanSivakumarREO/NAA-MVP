---
title: Impact Analysis — Phase 1 Browser Perception (BrowserEngine adapter + PageStateModel)
artifact_type: impact
status: draft
version: 0.2
created: 2026-04-27
updated: 2026-04-27
owner: engineering lead

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-1-perception/spec.md
  - docs/specs/mvp/phases/phase-1-perception/plan.md
  - docs/specs/mvp/templates/impact.template.md (R20 template)

req_ids:
  - REQ-BROWSE-NODE-003
  - REQ-BROWSE-PERCEPT-001

breaking: false
risk_level: medium

affected_contracts:
  - BrowserEngine
  - PageStateModel

delta:
  new:
    - v0.2 — explicit "Forward Contract" section now defines what Phase 2 + Phase 7 will import from Phase 1 (analyze finding X2)
  changed:
    - v0.1 → v0.2 frontmatter affected_contracts standardized to short form (was prose); descriptive prose retained in body (analyze finding C3)
  impacted: []
  unchanged:
    - All prior content (v0.1 sections preserved)

governing_rules:
  - Constitution R9 (Loose Coupling / Adapter Pattern)
  - Constitution R18 (Delta-Based Updates)
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes)
  - Constitution R22 (Ratchet — provenance for new contracts)
---

# Impact Analysis: BrowserEngine adapter + PageStateModel

## Why R20 applies

Phase 1 introduces TWO new shared contracts:

1. **`BrowserEngine` adapter interface** (`packages/agent-core/src/adapters/BrowserEngine.ts`) — Neural's first concrete adapter. Sets the precedent for every future adapter (LLMAdapter Phase 4, StorageAdapter Phase 4, ScreenshotStorage Phase 4, NotificationAdapter Phase 9). Future phases consume this interface, so any Phase 1 mistake here ripples.

2. **`PageStateModel`** (`packages/agent-core/src/perception/types.ts`) — first cross-layer Zod schema in Neural. Phase 2 MCP tools consume it (`browser_get_state` returns it), Phase 5 Browse MVP composes it, Phase 7 deep_perceive merges its content with `AnalyzePerception`. Schema changes after Phase 1 land force migrations across at least 3 phases.

Both are **additive** in Phase 1 (no prior version exists), so `breaking: false`. But the precedent is high-impact.

## Affected modules

### Phase 1 itself (this phase)

| File | Layer | Role |
|---|---|---|
| `packages/agent-core/src/adapters/BrowserEngine.ts` | adapters | Adapter interface definition |
| `packages/agent-core/src/browser-runtime/BrowserManager.ts` | browser-runtime | Concrete `BrowserEngine` implementation |
| `packages/agent-core/src/browser-runtime/StealthConfig.ts` | browser-runtime | Consumer of `BrowserSession.context` |
| `packages/agent-core/src/perception/types.ts` | perception | `PageStateModel` Zod schema |
| `packages/agent-core/src/perception/AccessibilityExtractor.ts` | perception | Reads `BrowserSession.page`; produces `PageStateModel.accessibilityTree` |
| `packages/agent-core/src/perception/HardFilter.ts` | perception | Operates on `AccessibilityTree` |
| `packages/agent-core/src/perception/SoftFilter.ts` | perception | Operates on `AccessibilityTree`; produces `FilteredDOM` |
| `packages/agent-core/src/perception/MutationMonitor.ts` | perception | Reads `BrowserSession.page`; produces `Diagnostics.stable` |
| `packages/agent-core/src/perception/ScreenshotExtractor.ts` | perception | Reads `BrowserSession.page`; produces `Visual` |
| `packages/agent-core/src/perception/ContextAssembler.ts` | perception | Orchestrates above; produces full `PageStateModel` |

### Downstream phases (consumers; NOT modified in Phase 1, but listed for forward visibility)

| Phase | File(s) | Role |
|---|---|---|
| Phase 2 | `packages/agent-core/src/mcp/tools/browser_get_state.ts` | Returns `PageStateModel` |
| Phase 2 | `packages/agent-core/src/mcp/tools/browser_navigate.ts` | Uses `BrowserEngine.newSession()` |
| Phase 5 | `packages/agent-core/src/browser-runtime/OverlayDismisser.ts` | Operates on `BrowserSession.page`; emits `PageStateModel.diagnostics` updates |
| Phase 7 | `packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts` | Composes `AnalyzePerception` from `PageStateModel` + extra `page.evaluate()` data |

## Affected contracts — before / after shapes

### `BrowserEngine` (NEW)

**Before:** does not exist.

**After:**

```ts
// packages/agent-core/src/adapters/BrowserEngine.ts
import { z } from 'zod';

export const SessionOptsSchema = z.object({
  headless: z.boolean().default(true),
  viewport: z.object({ width: z.number().int(), height: z.number().int() }).optional(),
  userAgent: z.string().optional(),
}).strict();
export type SessionOpts = z.infer<typeof SessionOptsSchema>;

export interface BrowserSession {
  readonly id: string;          // for Pino correlation
  readonly page: BrowserPage;   // re-typed (NOT raw Playwright Page) — wraps the subset Phase 1+ needs
  readonly context: BrowserContext;
  close(): Promise<void>;
}

export interface BrowserEngine {
  newSession(opts?: SessionOpts): Promise<BrowserSession>;
}
```

`BrowserPage` and `BrowserContext` are intentionally Phase-1-minimal: only the methods the perception layer uses (navigate, accessibility.snapshot, screenshot, evaluate, addInitScript). Phase 2 + Phase 4 will extend this interface as MCP tools and verification engine require — those extensions need their own impact.md if they cross other layer boundaries.

### `PageStateModel` (NEW)

**Before:** does not exist.

**After:**

```ts
// packages/agent-core/src/perception/types.ts
export const PageStateModelSchema = z.object({
  metadata: MetadataSchema,
  accessibilityTree: AccessibilityTreeSchema,
  filteredDOM: FilteredDOMSchema,
  interactiveGraph: InteractiveGraphSchema,
  visual: VisualSchema.optional(),
  diagnostics: DiagnosticsSchema,
}).strict();
export type PageStateModel = z.infer<typeof PageStateModelSchema>;
```

Sub-schemas (Metadata, AccessibilityTree, FilteredDOM, InteractiveGraph, Visual, Diagnostics) defined in same file. Total JSON-stringified size MUST tokenize to < 1500 tokens via `cl100k_base` per NF-Phase1-01.

## Breaking changes

None. Both contracts are additive. `breaking: false`.

## Migration plan

Not applicable (additive). Future schema changes to either contract will require their own impact.md per R20.

## Risk level: MEDIUM

**Why MEDIUM (not LOW):**
- This sets the *pattern* for all future adapters and shared schemas in Neural. A subtle mistake (e.g., leaking `playwright.Page` directly through `BrowserSession.page` instead of re-typing) would compound across every consumer.
- The token-budget invariant (`PageStateModel < 1500 tokens`) is brittle: if a sub-schema (e.g., FilteredDOM) bloats in a later phase, the whole pipeline silently regresses unless conformance tests catch it.

**Why not HIGH:**
- No DB schema, no auth, no payments, no untrusted-input paths touched.
- No prior version to migrate from.
- Failure mode is contained to Phase 1 + immediate consumers (Phase 2/5/7); rollback = revert Phase 1.

## Forward Contract — what Phase 2 + Phase 7 will import (R20 forward-compatibility)

Per analyze finding X2, this section makes the Phase 1 → downstream import surface explicit so consumers can plan against a stable seam.

### Phase 2 (MCP Tools — T016-T050) WILL import

| Phase 2 file | Imports from Phase 1 | Purpose |
|---|---|---|
| `packages/agent-core/src/mcp/tools/browser_get_state.ts` | `ContextAssembler`, `PageStateModel`, `PageStateModelSchema` from `@neural/agent-core/perception` | Returns `PageStateModel` to MCP client |
| `packages/agent-core/src/mcp/tools/browser_navigate.ts` | `BrowserEngine`, `BrowserSession` from `@neural/agent-core/adapters` | Acquires session for navigation |
| `packages/agent-core/src/mcp/tools/browser_click.ts` etc. | `BrowserSession` (`session.page` actions) | Action surface |

**Forward stability promise:** the export surface in `packages/agent-core/src/perception/index.ts` and `packages/agent-core/src/adapters/BrowserEngine.ts` is the Phase 1 → Phase 2 contract boundary. Adding methods is non-breaking; renaming or removing requires a v0.x → v0.y impact.md update on this file.

### Phase 7 (Analysis Pipeline — T117 DeepPerceiveNode) WILL import

| Phase 7 file | Imports from Phase 1 | Purpose |
|---|---|---|
| `packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts` | `PageStateModel` from `@neural/agent-core/perception` | Composes `AnalyzePerception` (v2.3 enriched) by reading `PageStateModel.metadata`, `accessibilityTree`, and `filteredDOM`, then calling its own `page.evaluate()` for the 14 v2.3 enrichments |
| Phase 7 may write enrichment data | `PageStateModel._extensions.deepPerceive` (RESERVED in v0.2 of this spec) | Phase 7 can attach extra data without forcing Phase 1 schema bump (analyze finding X2) |

**Forward extensibility seam:** `PageStateModel._extensions: Record<string, unknown>` is reserved in T014. Phase 1 MUST NOT populate `_extensions`. Phase 7 will namespace under `_extensions.deepPerceive` (and any future enrichment phase under its own key). This avoids the schema-migration tax that would otherwise hit Phase 1 every time a downstream phase needs to attach data.

### Phase 5 (Browse MVP — T052-T103) WILL import

| Phase 5 module | Imports from Phase 1 | Purpose |
|---|---|---|
| `packages/agent-core/src/browser-runtime/OverlayDismisser.ts` | `BrowserSession` | Operates on session.page; emits Diagnostics updates |
| `packages/agent-core/src/orchestration/nodes/BrowseNode.ts` | `ContextAssembler`, `PageStateModel` | Wraps capture flow into LangGraph node |

---

## Verification

| Check | Test |
|---|---|
| BrowserEngine interface stable across Phase 1 implementations | Type-check passes; `BrowserManager extends BrowserEngine` compiles |
| PageStateModel < 1500 tokens on 3 sites | `tests/integration/phase1.test.ts` (T015) — AC-10 |
| No raw Playwright type leakage upstream | Grep: `from 'playwright'` MUST only appear in `adapters/BrowserEngine.ts` + `browser-runtime/BrowserManager.ts` (verified manually + ESLint rule lands Phase 4) |
| Zod schemas catch malformed extractor output | `tests/conformance/perception-types.test.ts` (T014) — AC-09 |

## Provenance (R22.2)

```yaml
why:
  source: docs/specs/mvp/PRD.md §F-003 + §F-004; docs/specs/AI_Browser_Agent_Architecture_v3.1.md REQ-BROWSE-NODE-003 + REQ-BROWSE-PERCEPT-001
  evidence: >
    BrowserEngine adapter is the first concrete instance of Constitution R9 (Loose Coupling).
    R9 was retroactively audited 2026-04-24 (R22.5) with provenance citing Cockburn ports & adapters
    + Addy Osmani's "Every component in a harness encodes an assumption about what the model can't."
    Phase 1's BrowserEngine sets the pattern for v1.2 GPT-4o failover, MockLLMAdapter test setup,
    and TemperatureGuard enforcement at a single boundary — none of those are possible without
    a clean adapter seam landing first.
    PageStateModel is the cross-layer perception contract referenced in v3.1 REQ-BROWSE-PERCEPT-001.
  linked_failure: >
    Hypothetical: tightly coupled Playwright code in Phase 1 forces Phase 2 MCP tools to
    re-import Playwright directly, defeating R9 from day one.
```

## Approval

| Gate | Approver | Evidence |
|---|---|---|
| Impact analysis review | engineering lead | this document `status: approved` |
| Constitution R20 compliance | engineering lead | All sections above completed |
| Phase 1 spec → plan transition | spec author + product owner | spec.md `status: approved` AND this impact.md `status: approved` |

---
title: Impact Analysis — Phase 1 Browser Perception (BrowserEngine adapter + PageStateModel)
artifact_type: impact
status: approved
version: 0.4
created: 2026-04-27
updated: 2026-05-09
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
    - v0.3.1 — Forward Contract section EXTENDED to include Phase 1b (Perception Extensions v2.4) + Phase 1c (PerceptionBundle Envelope v2.5) as direct PageStateModel consumers (Session 7 R17.4 review J1 finding / C2 OPTIONAL — consumed by master orchestrator Gate 1 REVISE)
  changed:
    - v0.1 → v0.2 frontmatter affected_contracts standardized to short form (was prose); descriptive prose retained in body (analyze finding C3)
    - v0.2 → v0.3 — frontmatter version sync with parallel spec.md/plan.md/tasks.md polish (analyze findings M1-M4 + L1-L2 + L5-L6); impact.md body unchanged
    - v0.3 → v0.3.1 (2026-05-08 master orchestrator Gate 1 REVISE) — Forward Contract section appended with Phase 1b + Phase 1c rows (per Session 7 review J1 / standing condition C2 OPTIONAL). Aligns impact.md with `tasks-v2.md:236` T1B-001 PricingExtractor `dep: T013, T014` + INDEX.md row 1c "wraps PageStateModel into a PerceptionBundle envelope". Frontmatter sync with parallel spec.md/plan.md/tasks.md REVISE patches. No risk level / breaking flag changes.
    - v0.3.1 → v0.3.2 (2026-05-08 Stage 2 Wave 2 R11.4 — surfaced by T006 dispatch) — BrowserPage minimal-surface narrative (line ~122) updated to cite `ariaSnapshot` instead of removed `accessibility.snapshot` (Playwright 1.57+ removed the legacy API). BrowserEngine "Before/After" interface block (line 100-119) preserved verbatim — the canonical TypeScript interface lives in `packages/agent-core/src/adapters/BrowserEngine.ts` (also patched in same commit), and that file is the Single Source of Truth for the type signature; this impact.md narrative tracks the high-level minimal-surface contract. No risk level / breaking flag changes; the Phase 1 BrowserEngine forward contract is still additive (new shared contract introduced; no prior consumers existed). Frontmatter sync with parallel spec.md (v0.3.2) / plan.md (v0.3.2) / tasks.md (v0.6).
    - v0.3.2 → v0.4 (2026-05-09 Wave 7 R11.4 — surfaced by T015) — three "1500"-token references updated to "20,000" tokens to align with spec.md v0.4 NF-Phase1-01 amendment: PageStateModel "After" sub-schema narrative (line ~144), Risks "token-budget invariant" bullet (line ~158; brittleness wording preserved — invariant is now "PageStateModel < 20,000 tokens" but the regression-detection point still applies), Verification table row (line ~220) acceptance criterion. Frontmatter sync with parallel spec.md / plan.md / tasks.md v0.4 + v0.7. No risk level / breaking flag changes; the relaxation is additive (more headroom for downstream consumers), not breaking.
  impacted:
    - spec.md + plan.md + tasks.md (v0.2 → v0.3) — frontmatter sync
    - spec.md (v0.3 → v0.3.1) + plan.md (v0.3 → v0.3.1) + tasks.md (v0.4 → v0.5) — parallel sync for v0.3.1 master orchestrator REVISE
  unchanged:
    - BrowserEngine + PageStateModel before/after sections (lines 87-138 v0.2 verbatim)
    - Risk level MEDIUM, breaking: false
    - Provenance section + Verification section + Approval section
    - All v0.2 Forward Contract rows for Phase 2, 5, 7 (only Phase 1b + 1c are NEW additions)

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

`BrowserPage` and `BrowserContext` are intentionally Phase-1-minimal: only the methods the perception layer uses (navigate, ariaSnapshot, screenshot, evaluate, addInitScript). Phase 2 + Phase 4 will extend this interface as MCP tools and verification engine require — those extensions need their own impact.md if they cross other layer boundaries. (R11.4 v0.3.2 patch — Playwright 1.57+ replaced the legacy `accessibility.snapshot()` with `ariaSnapshot()` returning a YAML string; T008 `AccessibilityExtractor` owns the YAML→`AccessibilityNodeSchema` parse-back so downstream consumers continue to see the legacy AX-tree object shape.)

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

Sub-schemas (Metadata, AccessibilityTree, FilteredDOM, InteractiveGraph, Visual, Diagnostics) defined in same file. Total JSON-stringified size MUST tokenize to < 20,000 tokens via `cl100k_base` per NF-Phase1-01 v0.4.

## Breaking changes

None. Both contracts are additive. `breaking: false`.

## Migration plan

Not applicable (additive). Future schema changes to either contract will require their own impact.md per R20.

## Risk level: MEDIUM

**Why MEDIUM (not LOW):**
- This sets the *pattern* for all future adapters and shared schemas in Neural. A subtle mistake (e.g., leaking `playwright.Page` directly through `BrowserSession.page` instead of re-typing) would compound across every consumer.
- The token-budget invariant (`PageStateModel < 20,000 tokens` v0.4) is brittle: if a sub-schema (e.g., FilteredDOM) bloats in a later phase, the whole pipeline silently regresses unless conformance tests catch it.

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

### Phase 1b (Perception Extensions v2.4 — T1B-001..T1B-012) WILL import *(NEW v0.3.1; Session 7 review C2 OPTIONAL consumed)*

| Phase 1b module | Imports from Phase 1 | Purpose |
|---|---|---|
| `packages/agent-core/src/perception/extensions/PricingExtractor.ts` (T1B-001) | `PageStateModel`, `PageStateModelSchema`, `BrowserSession` from `@neural/agent-core/perception` + `@neural/agent-core/adapters` | Reads `session.page` via the Phase 1 wrapper; produces v2.4 pricing-block enrichment data; namespaces under `_extensions.pricing` per the forward-compatibility seam |
| Phase 1b general extension layer | `PageStateModel._extensions: Record<string, unknown>` (RESERVED in T014) | Phase 1b extensions populate `_extensions.<extension_name>` keys (e.g., `_extensions.pricing`, `_extensions.trustSignals`) — Phase 1's reserved seam absorbs Phase 1b enrichment without forcing a Phase 1 schema migration |

**Forward stability promise carried forward to Phase 1b:** `T1B-001` per `docs/specs/mvp/tasks-v2.md` line 236 has `dep: T013, T014` — direct PageStateModel + ContextAssembler consumer. The Phase 1 `_extensions` seam (reserved in T014, documented in spec.md Key Entities + plan.md design item 7) is the intended cross-phase contract that Phase 1b populates without bumping `PageStateModelSchema`.

### Phase 1c (PerceptionBundle Envelope v2.5 — T1C-001..T1C-012) WILL import *(NEW v0.3.1; Session 7 review C2 OPTIONAL consumed)*

| Phase 1c module | Imports from Phase 1 | Purpose |
|---|---|---|
| `packages/agent-core/src/perception/bundle/PerceptionBundle.ts` (T1C-001) | `PageStateModel`, `PageStateModelSchema` from `@neural/agent-core/perception` | Wraps the Phase 1 `PageStateModel` into a `PerceptionBundle` envelope (v2.5) — adds outer-layer metadata (capture pipeline version, bundle id, parent-bundle pointer for multi-page audits) WITHOUT modifying the inner `PageStateModel` shape |
| Phase 1c bundle-envelope schema | `PageStateModelSchema` (full schema; not just inferred type) | The bundle wraps the schema, NOT a flattened inferred type — preserves `.strict()` validation when the bundle is parsed |

**Forward stability promise carried forward to Phase 1c:** Per `INDEX.md` row 1c, Phase 1c "wraps PageStateModel into a PerceptionBundle envelope". The wrapping is additive (envelope around inner schema); does NOT force Phase 1 schema bump. Adding new envelope fields in v2.5+ requires Phase 1c's own impact.md, NOT a Phase 1 update.

---

## Verification

| Check | Test |
|---|---|
| BrowserEngine interface stable across Phase 1 implementations | Type-check passes; `BrowserManager extends BrowserEngine` compiles |
| PageStateModel < 20,000 tokens on 3 sites (v0.4) | `tests/integration/phase1.test.ts` (T015) — AC-10 |
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

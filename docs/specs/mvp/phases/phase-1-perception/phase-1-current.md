---
title: Phase 1 Rollup — Current System State
artifact_type: rollup
status: implemented
version: 1.0
phase_number: 1
phase_name: Browser Perception Foundation
phase_completed_on: 2026-05-09
created: 2026-05-09
updated: 2026-05-09
owner: engineering lead
authors: [Claude (master orchestrator session 13)]
reviewers: [Sabari (Gate 2 stamp 2026-05-09)]
supersedes: phase-0-setup/phase-0-current.md
supersededBy: null
derived_from:
  - docs/specs/mvp/phases/phase-1-perception/tasks.md v0.7
  - docs/specs/mvp/phases/phase-1-perception/spec.md v0.4
  - docs/specs/mvp/phases/phase-1-perception/plan.md v0.4
  - docs/specs/mvp/phases/phase-1-perception/impact.md v0.4
  - .phase-state/1/code-review-findings.yaml (Stage 2.5 verdict APPROVE-FOR-GATE-2)
req_ids:
  - REQ-BROWSE-NODE-003
  - REQ-BROWSE-HUMAN-005 (MVP-reduced)
  - REQ-BROWSE-HUMAN-006 (MVP-reduced)
  - REQ-BROWSE-PERCEPT-001
  - REQ-BROWSE-PERCEPT-002
  - REQ-BROWSE-PERCEPT-003
  - REQ-BROWSE-PERCEPT-005
  - REQ-BROWSE-PERCEPT-006
delta:
  new:
    - First R9 concrete adapter (BrowserEngine + BrowserManager) — sets the boundary precedent for all future Phase 2 / 4 / 5 / 7 adapters
    - First shared cross-layer Zod contract (PageStateModel + sub-schemas) — consumed by Phase 1b (T1B-001 PricingExtractor), Phase 1c (PerceptionBundle), Phase 2 (browser_get_state MCP tool), Phase 7 (DeepPerceiveNode)
    - First real Playwright integration shipping in agent-core
    - First tiktoken cl100k_base + Sharp dependency additions
  changed:
    - NF-Phase1-01 token budget bumped 1500 → 20,000 (R11.4 v0.4 amendment; Gate 2 path (a) at 2026-05-09; empirical floor measured by T015 against amazon.in homepage 12,485 + Peregrine 4,012)
    - Stale cross-reference fixed: NF-Phase1-01 previously claimed to roll up to PRD NF-008 (Boundaries + Safety); now correctly cites PRD F-004 acceptance bullet (the canonical perception size source)
    - PRD.md F-004 acceptance bullet (line ~290) updated to match the new 20K budget magnitude
    - Phase 0 fixture-stub `BrowserManager.capture(_url)` is preserved verbatim through Phase 1 — T-SKELETON-002 walking-skeleton dependency holds; R20 supersession (audit.ts migration) deferred to Phase 5 BrowseNode
    - BrowserPage R9 boundary gained 3 forward-compatible methods during Wave 3 / 7: setViewportSize (T007), setContent (T011), pages() on BrowserContext (T007). All documented in BrowserEngine.ts header.
  impacted:
    - Phase 1b — PageStateModel sub-schemas + AccessibilityNode shape are the upstream contract for T1B-001 PricingExtractor; ContextAssembler `_extensions` reservation seam ready for Phase 7
    - Phase 1c — PageStateModel envelope wrapping happens here; Phase 1c reads phase-1-current.md (this file) FIRST per R19 + CLAUDE.md §1b
    - Phase 2 — MCP tool `browser_get_state` consumes PageStateModel as-is; metadata.title + statusCode now real (Stage 2.5 N3 fix)
    - Phase 5 — BrowseMVP owns the audit.ts → ContextAssembler migration (R20 supersession deferred from this phase)
    - Phase 7 — DeepPerceiveNode reads PageStateModel + namespaces enrichments under `_extensions.deepPerceive`
  unchanged:
    - All AC-NN / R-NN / SC-NNN / T-NNN IDs stable across v0.3 → v0.4 lifecycle (R18 append-only preserved)
    - Walking-skeleton acceptance suite (7/7 PASS) preserved through T013 ContextAssembler landing
    - apps/cli/src/commands/audit.ts unchanged (still uses BrowserManager.capture fixture stub; R20 supersession deferred to Phase 5)
governing_rules:
  - Constitution R19 (Rollup per Phase)
  - Constitution R17 (Lifecycle)
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes)
---

# Phase 1 — Browser Perception Foundation — Current System State Rollup

> **Summary (~200 tokens):** The browser perception pipeline is operational. `contextAssembler.capture(url)` opens a Playwright Chromium session via the `BrowserEngine` adapter (R9 first concrete), applies reduced-scope stealth (UA + viewport + WebGL rotation; no playwright-extra), navigates with `waitUntil:'domcontentloaded'`, settles via MutationMonitor, extracts the AX-tree via `page.ariaSnapshot()` YAML→object parse-back, applies HardFilter then SoftFilter, captures a JPEG screenshot ≤150KB ≤1280px, assembles a `PageStateModel` < 20,000 tokens (NF-Phase1-01 v0.4), and closes cleanly with no zombie processes. Validated against example.com, amazon.in, and a real Peregrine PDP. 142/142 tests PASS. The fixture-stub walking-skeleton path (`BrowserManager.capture()` + `audit.ts`) is intentionally preserved verbatim — Phase 5 BrowseNode owns the migration.

> **Governed by:** Constitution R19. Rollup size cap: 300 lines / ~3000 tokens.

---

## 1. Active modules introduced this phase

| Module | Path | Purpose | Tests |
|---|---|---|---|
| `BrowserEngine` (interface) | `packages/agent-core/src/adapters/BrowserEngine.ts` | R9 boundary — Phase-1-minimal Playwright wrapper (BrowserPage + BrowserContext + BrowserSession + SessionOpts) | (interface; consumed by tests below) |
| `BrowserManager` | `packages/agent-core/src/browser-runtime/BrowserManager.ts` | First R9 concrete; sole `import 'playwright'` site; `newSession()` + walking-skeleton `capture()` fixture stub | `tests/conformance/browser-manager.test.ts` (2 tests) + `tests/unit/browser-runtime/BrowserManager.test.ts` (8 tests) |
| `applyStealthConfig` | `packages/agent-core/src/browser-runtime/StealthConfig.ts` | Per-session UA + viewport + WebGL fingerprint rotation; reduced scope (no playwright-extra) | `tests/conformance/stealth-config.test.ts` (4 tests) |
| `accessibilityExtractor` | `packages/agent-core/src/perception/AccessibilityExtractor.ts` | `page.ariaSnapshot()` YAML → AccessibilityNodeSchema parse-back + node count | `tests/conformance/accessibility-extractor.test.ts` (2 tests) |
| `hardFilter` | `packages/agent-core/src/perception/HardFilter.ts` | Pure recursive prune of hidden/disabled/aria-hidden/zero-dim nodes; degenerate-page floor flag | `tests/conformance/hard-filter.test.ts` (4 tests) |
| `softFilter` | `packages/agent-core/src/perception/SoftFilter.ts` | Multiplicative relevance scoring (R4.4) + top-30 ranking | `tests/conformance/soft-filter.test.ts` (4 tests) |
| `mutationMonitor` | `packages/agent-core/src/perception/MutationMonitor.ts` | Injected MutationObserver + 500ms settle window; non-fatal on failure | `tests/conformance/mutation-monitor.test.ts` (3 tests) |
| `screenshotExtractor` | `packages/agent-core/src/perception/ScreenshotExtractor.ts` | Playwright JPEG + Sharp recompression (width-aware gate per Stage 2.5 I1 fix); single retry max | `tests/conformance/screenshot-extractor.test.ts` (2 tests) |
| `contextAssembler` | `packages/agent-core/src/perception/ContextAssembler.ts` | Orchestrates 6 components → PageStateModel; tiktoken cl100k_base; deterministic 4-stage shrink ladder; session lifecycle in finally | `tests/conformance/context-assembler.test.ts` (3 tests) + `tests/integration/phase1.test.ts` (5 tests including 3-site NF-Phase1-03) |
| `perception/types.ts` | `packages/agent-core/src/perception/types.ts` | PageStateModel + 6 sub-schemas + `_extensions` reservation; `PAGE_STATE_MODEL_TOKEN_BUDGET = 20_000` (v0.4) | `tests/conformance/perception-types.test.ts` (5 tests) + `tests/unit/perception/types.test.ts` (15 tests) |
| `perception/index.ts` | `packages/agent-core/src/perception/index.ts` | Barrel export — singletons + types for Phase 2 / 7 consumption | (consumed by integration tests) |

**Logger module** (`packages/agent-core/src/observability/logger.ts`) extended with `LogBindings` interface + `createChildLogger` helper enumerating Phase 0 + Phase 1 correlation field names (T-PHASE1-LOGGER).

**Adapters README** (`packages/agent-core/src/adapters/README.md`) updated to register `BrowserEngine` as the first concrete R9 adapter (T-PHASE1-ADAPTERS-README).

**Root README** updated with Phase 1 Quickstart + perception API code sample (T-PHASE1-DOC).

---

## 2. Data contracts now in effect

| Contract | Location | Spec source-of-truth | Notes |
|---|---|---|---|
| `BrowserEngine` (R9 interface) | `packages/agent-core/src/adapters/BrowserEngine.ts` | spec.md v0.4 R-01 + impact.md v0.4 §"BrowserEngine (NEW)" | Phase-1-minimal — extensions tracked in BrowserEngine.ts header. Phase 2/4/5 will compose against this seam. |
| `PageStateModel` (Zod schema) | `packages/agent-core/src/perception/types.ts` | spec.md v0.4 R-04 + Key Entities; impact.md v0.4 §"PageStateModel (NEW)" | < 20,000 tokens (NF-Phase1-01 v0.4). `_extensions` reserved for Phase 7+ deep_perceive. Phase 1 MUST NOT populate `_extensions`. |
| Sub-schemas (Metadata, AccessibilityNode/Tree, FilteredDOM, InteractiveGraph, Visual, Diagnostics) | same file | spec.md v0.4 §Key Entities | All `.strict()`. Composed into PageStateModelSchema. |
| `PAGE_STATE_MODEL_TOKEN_BUDGET = 20_000` constant | `packages/agent-core/src/perception/types.ts` | spec.md v0.4 NF-Phase1-01 + plan.md v0.4 + PRD.md F-004 line 290 | Single source of truth for downstream consumers; ContextAssembler shrink ladder + T015 + AC-08 conformance all import. |
| Forward Contract (impact.md v0.4) | `docs/specs/mvp/phases/phase-1-perception/impact.md` | impact.md v0.4 §Forward Contract | Lists Phase 1b + 1c + 2 + 5 + 7 consumer expectations. |

---

## 3. System flows now operational

### Flow: real-page perception capture (`contextAssembler.capture(url)`)

**Trigger:** any caller passing a public URL string.
**Steps:** newSession (Playwright Chromium headless) → applyStealthConfig (UA + viewport + WebGL rotation on the existing about:blank page) → mutationMonitor.observe (pre-nav observer install) → page.goto(`waitUntil:'domcontentloaded'`, 10s timeout) → mutationMonitor.observe (post-nav settle, 5s window) → accessibilityExtractor.extract (ariaSnapshot YAML → AccessibilityTree) → hardFilter.apply → softFilter.apply (top-30 multiplicative score) → screenshotExtractor.capture (best-effort; visual optional) → readPageMetadata (title + statusCode via evaluate) → assemble → fitToTokenBudget (4-stage deterministic shrink ladder if > 20K tokens) → PageStateModelSchema.parse → return.
**Output:** `PageStateModel` < 20,000 tokens (NF-Phase1-01 v0.4).
**Spec:** AC-01 + AC-08 + AC-10; REQ-BROWSE-NODE-003 + REQ-BROWSE-PERCEPT-001..006.
**Session lifecycle:** `BrowserManager.newSession()` returns a `BrowserSession` whose owner MUST `await session.close()` in a `finally` clause. `ContextAssembler.capture()` does this internally; standalone callers (T007/T008/T011/T012 conformance tests) do it explicitly. NF-Phase1-05: zero zombie Chromium processes verified by T006 conformance.

### Flow: walking-skeleton fixture path (preserved unchanged)

**Trigger:** `pnpm cro:audit` (CLI) → `apps/cli/src/commands/audit.ts` → `BrowserManager.capture(url)` (fixture stub).
**Steps:** Loads `peregrine-pdp.json` verbatim regardless of URL; T014 depth check; PageStateModelSchema.parse; return.
**Output:** Deterministic offline `PageStateModel` for walking-skeleton acceptance.
**Spec:** T-SKELETON-002 (week 1 walking skeleton).
**R20 supersession deferred to Phase 5:** Phase 5 BrowseNode will migrate `audit.ts` to use `contextAssembler.capture()` and either retire the fixture stub or repurpose it for offline test mode. Walking-skeleton acceptance suite (`tests/acceptance/walking-skeleton.spec.ts`, 7/7 PASS) holds in the meantime.

---

## 4. Known limitations carried forward

| Limitation | Phase to resolve | Workaround in place |
|---|---|---|
| **Reduced-scope stealth** — UA + viewport + WebGL only; bot.sannysoft.com NOT a target; amazon.in CAPTCHA wall is acceptable per spec | v1.1 (full playwright-extra-plugin-stealth) | Per-session rotation gives basic anti-fingerprinting; CAPTCHA pages still produce valid PageStateModel < 20K tokens |
| **No overlay dismissal** — cookie banners / modals are part of captured PageStateModel | Phase 5 (OverlayDismisser) | MutationMonitor settles after banner finishes animating; PageStateModel reflects whatever is visible |
| **No mobile viewport support** — desktop only (1280×720, 1440×900, 1920×1080) | Phase 5b (Multi-Viewport) | Single desktop viewport per session |
| **Walking-skeleton fixture stub still wired into audit.ts** — `pnpm cro:audit` always returns peregrine-pdp.json regardless of URL | Phase 5 BrowseNode (R20 supersession) | T013 ContextAssembler is the production capture path; CLI wiring deferred to Phase 5 |
| **No state exploration / interactive evaluation** — perception captures one default state per page | Phase 10 (StateExplorer) | Default page state only |
| **PageStateModel `_extensions` field reserved but unused** — Phase 1 MUST NOT populate it | Phase 7 (DeepPerceiveNode under `_extensions.deepPerceive` namespace) | Schema seam ready; current capture leaves field undefined |
| **No offline / cached test fixtures for integration suite** — T015 hits real network | v1.2 (offline fixture cache) | Network-dependent; Peregrine `skipOnFlake: true` in fixture row; CAPTCHA-wall edge case acceptable |
| **AccessibilityExtractor empty-YAML retry inside `extract()`** (Stage 2.5 I4) — duplicates MutationMonitor settle responsibility; belt-and-suspenders for standalone T008 conformance test | Phase 2 (remove the retry once perceived flake stabilizes; OR make it a config knob) | 1000ms retry inside extract(); ContextAssembler already calls observe before extract so duplication is harmless in production path |
| **ContextAssembler shrink ladder Stage 1 is coarse** (Stage 2.5 N1) — depth 10 → 6 in one step regardless of overage magnitude | Phase 7+ (finer ladder if downstream LLM token costs need tighter context) | Acceptable at v0.4 budget (20K headroom absorbs amazon.in 12,485 + Peregrine 4,012) |
| **StealthConfig.lastAppliedSignature module-level mutable state** (Stage 2.5 N2) — two concurrent BrowserManagers in same process share the guard; could cause spurious rerolls | Phase 5/9 (parallel audit support) | Acceptable for Phase 1 single-audit scope |
| **BrowserManager.ts uses `as never` 4 times to narrow Playwright signatures** (Stage 2.5 N4) — documented as deliberate R9 boundary narrowing | Phase 4 (T073 ESLint exception specifically for this file) | Code-review enforces; localized to the boundary file |

---

## 5. Open risks for next phase

| Risk | Impact | Owner | Mitigation |
|---|---|---|---|
| Phase 1b (T1B-001 PricingExtractor) consumes `_extensions` shape — needs to honor Phase 7 namespace reservation | Schema migration if Phase 1b populates `_extensions.pricing` then Phase 7 adds `_extensions.deepPerceive` | Phase 1b lead | Document namespace contract in Phase 1b impact.md before T1B-001 lands |
| Phase 5 BrowseMVP must migrate audit.ts → ContextAssembler.capture() AND keep walking-skeleton 7/7 green | Breakage of CLI quickstart + walking-skeleton acceptance | Phase 5 lead | R20 supersession requires impact.md update + parallel test fixture migration; either retire fixture stub or guard it behind a `--offline` flag |
| Phase 2 MCP `browser_get_state` tool reads PageStateModel — token budget at v0.4 (20K) may exceed Phase 7 EvaluateNode prompt budget | Single MCP call could overflow Claude context window if multi-page audits accumulate | Phase 2 + Phase 7 leads | Phase 2 should slice by section (metadata only, AX-tree only, etc.); Phase 7 EvaluateNode should not blindly stuff full PSM into evaluate prompt |
| AccessibilityExtractor's 1000ms empty-YAML retry adds latency on lazy-AX pages (amazon.in) | +1s on per-page wall-clock vs an evicted retry | Phase 2 follow-up | Document in Phase 2 impact.md; remove retry when standalone T008 conformance test is updated to call mutationMonitor.observe in setup |
| ScreenshotExtractor returns visual section even on width-rotated viewports (Stage 2.5 I1 fixed) — but VisualSchema does NOT enforce min dimensions; very-narrow viewports could produce useless 1px-wide images | Cosmetic / quality issue | Phase 5b Multi-Viewport | Add `width.min(640)` or similar guard at VisualSchema boundary if mobile viewport profiles produce too-narrow screenshots |

---

## 6. Conformance gate status (at phase exit)

| Test | Status | Last run |
|---|---|---|
| `pnpm test:conformance -- browser-manager` | ✅ green (2/2) | 2026-05-09 |
| `pnpm test:conformance -- stealth-config` | ✅ green (4/4) | 2026-05-09 |
| `pnpm test:conformance -- accessibility-extractor` | ✅ green (2/2; real network amazon.in) | 2026-05-09 |
| `pnpm test:conformance -- hard-filter` | ✅ green (4/4) | 2026-05-09 |
| `pnpm test:conformance -- soft-filter` | ✅ green (4/4; R4.4 multiplicative grep gate clean) | 2026-05-09 |
| `pnpm test:conformance -- mutation-monitor` | ✅ green (3/3) | 2026-05-09 |
| `pnpm test:conformance -- screenshot-extractor` | ✅ green (2/2; real network amazon.in) | 2026-05-09 |
| `pnpm test:conformance -- context-assembler` | ✅ green (3/3; example.com 1.7s) | 2026-05-09 |
| `pnpm test:conformance -- perception-types` | ✅ green (5/5) | 2026-05-09 |
| `pnpm test:integration -- phase1` (T015 AC-10) | ✅ green (5/5; example.com 4.6s, amazon.in 3.1s, peregrine 4.8s, 3-site total 10.2s) | 2026-05-09 |
| `pnpm test:integration -- walking-skeleton` | ✅ green (7/7 PASS preserved through T013) | 2026-05-09 |
| Full suite (`pnpm test`) | ✅ **142/142 tests across 20/20 files** | 2026-05-09 |
| `pnpm typecheck` | ✅ clean | 2026-05-09 |
| `pnpm lint` (Phase 4 stub) | ✅ clean (real ESLint deferred to T073) | 2026-05-09 |

---

## 7. What Phase 2 (MCP Tools) should read

When Phase 2 starts, the recommended reading order is:

1. This file (`phase-1-perception/phase-1-current.md`) — YOU ARE HERE
2. `docs/specs/mvp/phases/phase-2-tools/README.md`
3. `docs/specs/mvp/phases/phase-2-tools/spec.md`
4. `docs/specs/mvp/phases/phase-2-tools/tasks.md`
5. Specific REQ-IDs cited per task — open only what you need from `docs/specs/final-architecture/06-browse-mode.md` + `docs/specs/AI_Browser_Agent_Architecture_v3.1.md`

Do NOT load all Phase 1 artifacts. The compression is intentional. The shared contracts you need (`BrowserEngine`, `PageStateModel`) live in `packages/agent-core/src/adapters/BrowserEngine.ts` + `packages/agent-core/src/perception/types.ts` — read those files directly when defining MCP tools.

**Phase 1b (Perception Extensions v2.4)** consumers should also read:
- `phase-1-perception/impact.md` v0.4 §Forward Contract (Phase 1b row)
- T1B-001 PricingExtractor brief in `phase-1b-perception-extensions/tasks.md`

---

## 8. Cost + time summary (this phase)

| Metric | Target | Actual |
|---|---|---|
| Duration (sessions) | 2 sessions (12, 13) | 2 sessions over 2026-05-08 → 2026-05-09 |
| Engineering hours (planned) | ~24-30 h (plan.md v0.4 §Effort estimate; minus T014 already done) | Master orchestrator dispatched 9 subagents across 8 waves; per-task LLM cost ≈ $4.50 |
| Master orchestration overhead | (no prior baseline) | ≈ $1.20 (R11.4 patches, commit shaping, Stage 2.5 review, rollup authoring) |
| LLM spend total | $10 phase ceiling | **~$5.70 / $10.00** (43% headroom remaining) |
| Tasks completed | 14 atomic tasks (T-PHASE1-TESTS, T006-T015, T-PHASE1-{DOC,LOGGER,ADAPTERS-README,ROLLUP}) | 14/14 — all `[x]` in tasks.md |
| Phase 1 commits | (no target) | 17 commits ahead of `feat/master-agent-implementation` cut point |

---

## 9. Stage 2.5 carryover for Phase 2 (and later)

Per `.phase-state/1/code-review-findings.yaml` — non-blocking findings deferred:

- **I4** (MEDIUM, Phase 2): remove or config-flag the AccessibilityExtractor empty-YAML retry once standalone conformance flake stabilizes
- **I5** (LOW, Phase 5): R20 supersession — migrate `apps/cli/src/commands/audit.ts` from `BrowserManager.capture()` fixture stub to `contextAssembler.capture()` real Playwright; update walking-skeleton.spec.ts accordingly
- **N1** (LOW, Phase 7+): finer-grained shrink ladder (e.g., depth 10 → 8 → 6) when downstream LLM token costs need tighter PageStateModel context
- **N2** (INFO, Phase 5/9): StealthConfig.lastAppliedSignature module-level state — replace with per-instance state when parallel audits land
- **N3** (LOW, Phase 2 follow-up): VisualSchema add `width.min(N)` guard if mobile viewport profiles produce very-narrow screenshots
- **N4** (INFO, Phase 4 T073): ESLint rule allowing `as never` specifically in `BrowserManager.ts` (the R9 boundary)

These are documented here so future phase rollups inherit the audit trail.

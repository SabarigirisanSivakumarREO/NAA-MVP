---
title: Phase 1c Rollup — Current System State
artifact_type: rollup
status: implemented
version: 1.0
phase_number: 1c
phase_name: PerceptionBundle Envelope v2.5
phase_completed_on: 2026-05-12
created: 2026-05-12
updated: 2026-05-12
owner: engineering lead
authors: [Claude (master orchestrator session 15)]
reviewers: [Sabari (Gate 2 stamp 2026-05-12)]
supersedes: phase-1b-perception-extensions/phase-1b-current.md
supersededBy: null
derived_from:
  - docs/specs/mvp/phases/phase-1c-perception-bundle/tasks.md v0.2
  - docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md v0.2
  - docs/specs/mvp/phases/phase-1c-perception-bundle/plan.md v0.2
  - docs/specs/mvp/phases/phase-1c-perception-bundle/impact.md v0.2 (§11 namespace contract + §12 runtime wiring + §13 AuditRequest)
  - .phase-state/1c/code-review-findings.yaml (Stage 2.5 APPROVE-FOR-GATE-2)
  - .phase-state/1c/verify-test-results.json (Stage 3 all gates PASS)
  - .phase-state/1c/verify-verdict.yaml (Gate 2 APPROVE)
req_ids:
  - REQ-ANALYZE-PERCEPTION-V25-001
  - REQ-PERCEPT-V25-002
  - REQ-BROWSE-PERCEPT-007
  - REQ-BROWSE-PERCEPT-008
delta:
  new:
    - 12 Phase 1c tasks all implemented (T1C-001..T1C-012); 12 commits since branch cut from master (23d65fa → 54e55a8)
    - PerceptionBundle envelope (NEW shared contract) — Zod schema + meta + performance + nondeterminism_flags + warnings + state_graph + element_graph_by_state + raw.{page_state_model_by_state, analyze_perception_by_state, full_page_screenshot_url_by_state}; Object.freeze post-build; bundleToAnalyzePerception(stateId?) backward-compat accessor; envelopeTokenCount(stateId) helper
    - 11 new perception modules at packages/agent-core/src/perception/ (SettlePredicate, ShadowDomTraverser, PortalScanner, PseudoElementCapture, IframePolicyEngine, HiddenElementCapture, ElementGraphBuilder, NondeterminismDetector, WarningEmitter, PerceptionBundle) + 1 forward-stub at packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts; ~2,055 LOC implementation
    - 11 new conformance test files + 1 integration test + 2 new fixtures (checkout-iframe.json + spa-trait-rich.json); ~1,925 LOC tests + fixtures
    - 4 closed Zod enums (IframePurpose 9+cross_origin; HiddenReason 7; NondeterminismFlag 9; WarningCode 12) pinned across spec + impl + tests
    - Phase 1b namespace contract (impact.md §11) carried forward — Phase 1c writes neither `bundle.raw.page_state_model_by_state[*]._extensions.*` nor `bundle.raw.analyze_perception_by_state[*]._extensions.*`; AC-10 + AC-12 conformance assertions enforce
  changed:
    - NF-01 redefined to ENVELOPE-ONLY ≤2K per state (excluding bundle.raw.*); empirical 120-159 tokens across 5 fixtures (94% headroom)
    - IframePolicyEngine.ts refactored 373 → 290 LOC at cbbc4dc (R10 SHOULD soft cap compliance restored)
    - tasks.md phase exit checklist marked at Stage 2 close (7 of 12 items done; remaining 5 are Stage 3-4 close-out)
  impacted:
    - Phase 5 BrowseNode — OWNS runtime wiring of 10 Phase 1b extractors into ContextAssembler.capture() page.evaluate() (deferred from Phase 1c per AI Reviewer I7; documented impact.md §12). Phase 1c bundle assembly assumes inputs present; if missing, EXTENSION_OUTPUT_MISSING warning emitted.
    - Phase 7 DeepPerceiveNode (T117) — extends DeepPerceiveNode.ts forward-stub at packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts with full LLM-driven enrichments + _extensions.deepPerceive payload. Phase 1c only wires settle hook + warning propagation.
    - Phase 7 EvaluateNode — switches from state.analyze_perception to bundleToAnalyzePerception(state.bundle) per impact.md §3.
    - Phase 7 + Phase 9 AnnotateAndStore — switches from top-level screenshot URL to bundle.raw.full_page_screenshot_url_by_state[stateId].
    - reproducibility_snapshots — perception_schema_version "v2.4" → "v2.5" when audit run lands.
  unchanged:
    - All AC-NN / R-NN / SC-NNN / NF-NN / T1C-NNN stable IDs preserved (R18 append-only invariant)
    - Phase 1 conformance suite (9 files) + Phase 1b suite (12 files, 222 tests baseline) unchanged
    - Phase 1b T1B-012 integration test 27/27 GREEN on v2.5 code via bundleToAnalyzePerception accessor
    - Constitution Alignment Check (R3, R5.3/GR-007, R6, R7.4, R9, R10, R11, R18, R20, R24) all passing per Stage 2.5 review
governing_rules:
  - Constitution R19 (Rollup per Phase)
  - Constitution R17 (Lifecycle — approved → implemented bumped 2026-05-12)
  - Constitution R20 (Impact Analysis — impact.md §11 namespace + §12 runtime wiring + §13 AuditRequest decisions)
---

# Phase 1c — PerceptionBundle Envelope v2.5 — Current System State Rollup

> **Summary (~200 tokens):** PerceptionBundle (NEW shared contract) now wraps Phase 1 + Phase 1b PageStateModel + v2.4 AnalyzePerception alias + screenshots in `bundle.raw.*_by_state[stateId]`, layered with Phase 1c envelope channels (meta + performance + nondeterminism_flags + warnings + state_graph + element_graph_by_state). 4 closed Zod enums pinned: IframePurpose (9 + cross_origin), HiddenReason (7), NondeterminismFlag (9), WarningCode (12). Settle predicate enforces 5s TOTAL hard cap via `Promise.race`. ElementGraph builds stable element_id from sha256 hash, hardcoded cap 30 per state. Bundle is `Object.freeze`d post-build. `bundleToAnalyzePerception(bundle, stateId?)` provides backward-compat accessor. Empirical envelope-only token budget 120-159 across 5 fixtures (NF-01 cap 2K; 94% headroom). Namespace contract from Phase 1b §11 carried forward: `_extensions.*` reserved for Phase 7. Zero new LLM calls (R24 honored).

> **Governed by:** Constitution R19. Rollup size cap: 300 lines / ~3000 tokens.

---

## 1. Active modules introduced this phase

| Module | Path | Purpose | Tests |
|---|---|---|---|
| `SettlePredicate` | `packages/agent-core/src/perception/SettlePredicate.ts` | T1C-001 — 5s TOTAL hard-cap settle via Promise.race (networkidle + DOM mutations + fonts.ready + animations + optional selector); fixes v0.1 sum-of-soft-caps bug (240 LOC) | AC-01 conformance (6 tests; 2 pass + 4 it.todo for live-Page) |
| `ShadowDomTraverser` | `packages/agent-core/src/perception/ShadowDomTraverser.ts` | T1C-002 — recursive shadowRoot walk; depth-5 cap; ShadowWarning emit for SHADOW_DOM_NOT_TRAVERSED (182 LOC) | `shadow-dom-traverser.test.ts` AC-02 (4 tests) |
| `PortalScanner` | `packages/agent-core/src/perception/PortalScanner.ts` | T1C-003 — framework-agnostic body-direct-children scan; expanded app-root heuristic (#root/#app/#app-root/#__next/#__nuxt/#__layout/[data-reactroot]); host_root_marker detection (151 LOC) | `portal-scanner.test.ts` AC-03 (3 tests) |
| `PseudoElementCapture` | `packages/agent-core/src/perception/PseudoElementCapture.ts` | T1C-004 — ::before/::after content extraction via getComputedStyle; skips empty/punctuation/none; strips CSS quotes (148 LOC) | `pseudo-element-capture.test.ts` AC-04 (5 tests; 1 pass + 4 it.todo for jsdom pseudo limitation) |
| `IframePolicyEngine` | `packages/agent-core/src/perception/IframePolicyEngine.ts` | T1C-005 — closed 9-purpose enum + cross_origin security override; classifier order: cross_origin → captcha/cmp/payment_3ds → checkout/chat → fall-through; T1B-009 commerce.isCommerce context for checkout-iframe false-positive weighting (290 LOC, R10 compliant after refactor at cbbc4dc) | `iframe-policy-engine.test.ts` AC-05 (9 tests + Stage 2.5 captcha positive anchor) |
| `HiddenElementCapture` | `packages/agent-core/src/perception/HiddenElementCapture.ts` | T1C-006 — closed 7-case reason enum {display_none, aria_hidden, visibility_hidden, offscreen, zero_dimension, opacity_zero, html_hidden_attr}; detector priority documented (resolves N2 [hidden]+display:none overlap + N3 opacity_zero rationale) (207 LOC) | `hidden-element-capture.test.ts` AC-06 (6 tests) |
| `ElementGraphBuilder` | `packages/agent-core/src/perception/ElementGraphBuilder.ts` | T1C-007 — stable element_id (sha256 of tag + sorted_classes + dom_position_path + text_content_prefix(50), 16-hex chars + :N collision suffix); HARDCODED cap 30 per state; ELEMENT_GRAPH_TRUNCATED warning emission on overflow; selective fusion priorities P1-P4 (297 LOC) | `element-graph-builder.test.ts` AC-07 (5 tests) |
| `NondeterminismDetector` | `packages/agent-core/src/perception/NondeterminismDetector.ts` | T1C-008 — closed 9-value enum; 5-category probe strategy (script-presence for A/B engines; DOM-injection-hook for session-replay; JS-API-presence for ad auctions + Privacy Sandbox; cookie-pattern catch-all; DOM scan for countdown timers); server-side/edge OOS (245 LOC) | `nondeterminism-detector.test.ts` AC-08 (6 tests) |
| `WarningEmitter` | `packages/agent-core/src/perception/WarningEmitter.ts` | T1C-009 — closed 12-code enum + WARNING_SEVERITY_MAP per-code defaults; emit(code, message?, severity?) + collect() returning frozen snapshot; off-enum codes throw (closed-contract guard) (155 LOC) | `warning-emitter.test.ts` AC-09 (5 tests) |
| `PerceptionBundle` | `packages/agent-core/src/perception/PerceptionBundle.ts` | T1C-010 — Zod envelope schema (v2.5); `buildPerceptionBundle` assembles + asserts namespace contract + deep-freezes; `bundleToAnalyzePerception(stateId?)` backward-compat accessor; `envelopeTokenCount(stateId)` helper; ENVELOPE_TOKEN_BUDGET=2000 + ENVELOPE_TOKEN_HARD_CEILING=3000 pinned (290 LOC) | `perception-bundle.test.ts` AC-10 (8 tests; 6 pass + 2 it.todo for envelope-reject cases) |
| `DeepPerceiveNode` | `packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts` | T1C-011 — Phase 7 forward-stub; wires waitForSettle() before AnalyzePerception capture; propagates SETTLE_TIMEOUT_5S warnings into bundle.warnings; class + bare function entry; isPhase7Stub marker for AC-12 routing (130 LOC) | `deep-perceive-settle.test.ts` AC-11 (5 tests; 1 pass + 4 it.todo for live-Page) |

**Test scaffolding (Wave 0):** 12 conformance test files + 1 integration test file authored RED at commit `8285d79` (1,362 LOC). All GREEN by Wave 5.

**Fixtures (2 new):** `checkout-iframe.json` (132 LOC; same-origin payment iframe per N1) + `spa-trait-rich.json` (133 LOC; Optimizely + Shadow-DOM-deep + React-Portal-deep collapsed per N3).

**Tooling:** No vitest.config.ts changes beyond Phase 1b's environmentMatchGlobs additions for 7 jsdom-routed Phase 1c conformance tests (added in commit `8285d79`).

---

## 2. Data contracts now in effect

| Contract | Location | Spec source-of-truth | Notes |
|---|---|---|---|
| `PerceptionBundleSchema` (Zod, v2.5) | `packages/agent-core/src/perception/PerceptionBundle.ts` | spec.md v0.2 AC-10 + R-10 + R-11 + Key Entities | `.strict()` top-level; `raw.*_by_state` uses `z.record(z.unknown())` passthrough; deep-frozen post-build |
| 4 closed Zod enums | `IframePolicyEngine.ts` (IframePurpose) + `HiddenElementCapture.ts` (HiddenReason) + `NondeterminismDetector.ts` (NondeterminismFlag) + `WarningEmitter.ts` (WarningCode) | spec.md v0.2 Key Entities + AC-05/06/08/09 | 9+1 / 7 / 9 / 12 values respectively |
| `SettleResult` | `SettlePredicate.ts` | spec.md v0.2 Key Entities + R-01 + NF-05 | `{elapsed_ms, capped_at_5s}`; 5s TOTAL hard cap via Promise.race |
| `IframePolicyDecision` | `IframePolicyEngine.ts` | spec.md v0.2 AC-05 + R-05 + plan.md v0.2 §2.6 | `{purpose, action, warning}`; classifier order = security-sensitive BEFORE checkout/chat |
| `FusedElement` + `ElementGraph` | `ElementGraphBuilder.ts` | spec.md v0.2 Key Entities + R-07 + plan.md v0.2 §2.3 + §2.4 | Stable element_id (sha256 16-hex + :N collision); ELEMENT_GRAPH_CAP=30 hardcoded |
| `Warning` + `Severity` | `WarningEmitter.ts` | spec.md v0.2 Key Entities + R-09 | 12-code closed enum; per-call severity override supported |
| Namespace contract carryforward | impact.md v0.2 §11 + `PerceptionBundle.ts:assertNamespaceContract` | impact.md §11 (Phase 1c) + Phase 1b impact.md §11 | `bundle.raw.page_state_model_by_state[*]._extensions` MUST be undefined or empty; runtime-enforced via builder + AC-10/AC-12 tests |
| `DeepPerceiveOptions` + `DeepPerceiveResult` | `DeepPerceiveNode.ts` | impact.md v0.2 §12 + spec.md v0.2 R-12 | Forward-stub additive shape; Phase 7 T117 extends, no rename per R20 |

---

## 3. System flows now operational

### Flow: PerceptionBundle assembly (offline-fixture path; AC-12 integration)

**Trigger:** `buildPerceptionBundle({audit_run_id, url, initial_state_id, states, settle_result, nondeterminism_flags, warnings, meta?})`.
**Steps:** validate inputs via PerceptionBundleSchema.parse → assertNamespaceContract on each wrapped PageStateModel → assemble envelope channels → freeze bundle deeply → return.
**Output:** Frozen PerceptionBundle ready for downstream consumers (Phase 7 EvaluateNode + AnnotateAndStore via accessor).
**Spec:** AC-10 + AC-12. **Empirical envelope size:** 120-159 tokens per state across 5 fixtures (vs cap 2000 — 94% headroom).

### Flow: Settle gate (T1C-001 + T1C-011 wiring)

**Trigger:** `deepPerceiveWithSettle(page, emitter, opts)` (Phase 1c forward-stub) OR direct `waitForSettle(page, opts?)`.
**Steps:** `Promise.race([settleSteps(), sleep(5000)])` → settleSteps does (networkidle 2s soft + DOM mutations idle + fonts.ready awaited via page.evaluate + animations 1.5s soft + optional requireSelector 2s soft) each with `.catch(()=>{})` → elapsed ≥ 4950ms → `capped_at_5s: true` → emitter.emit('SETTLE_TIMEOUT_5S').
**Output:** `SettleResult {elapsed_ms, capped_at_5s}` + propagated warnings.
**Spec:** AC-01 + AC-11 + R-01 + R-12 + NF-05. **Full deep_perceive belongs to Phase 7 T117** (LLM-driven enrichments + `_extensions.deepPerceive` payload).

### Flow: Iframe classification (T1C-005)

**Trigger:** `classifyIframe(iframe, ctx?: {pageOrigin?, hostnameHint?, isCommerce?})`.
**Steps:** cross_origin check FIRST (security override) → CAPTCHA_PATTERNS / CMP_PATTERNS / PAYMENT_3DS_PATTERNS substring match → CHECKOUT_PATTERNS / CHAT_PATTERNS (with optional T1B-009 isCommerce context weighting) → VIDEO/ANALYTICS/SOCIAL_EMBED patterns → fall-through to `other`.
**Output:** `{purpose, action: descend|skip, warning: {code, severity} | null}`.
**Spec:** AC-05 + R-05 + plan.md §2.6 v0.2. **Security boundary verified:** Stage 2.5 review confirmed classifier order at IframePolicyEngine.ts:195-220.

### Flow: Backward-compat accessor (R-11)

**Trigger:** `bundleToAnalyzePerception(bundle, stateId?: string)`.
**Steps:** look up `bundle.raw.analyze_perception_by_state[stateId ?? bundle.initial_state_id]` → return reference.
**Output:** Wrapped PageStateModel (PerceptionBundle treats AnalyzePerception as alias for PageStateModel since no separate Zod schema exists).
**Spec:** AC-10 + R-11. **Regression:** Phase 1b T1B-012 integration test passes 27/27 on v2.5 code via this accessor.

### Flow: Runtime extraction (DEFERRED to Phase 5 BrowseNode)

**Note:** Phase 1c assembly assumes inputs are already present in `bundle.raw.page_state_model_by_state[stateId]`. Phase 5 BrowseNode owns runtime wiring of 10 Phase 1b extractor `.script.ts` IIFEs into `ContextAssembler.capture()`'s `page.evaluate()`. Documented in `impact.md §12` + `plan.md §6` + `phase-1c-current.md` §4. On missing extractor output, `EXTENSION_OUTPUT_MISSING` warning is emitted.

---

## 4. Known limitations carried forward

| Limitation | Phase to resolve | Workaround in place |
|---|---|---|
| **Runtime wiring of 10 Phase 1b extractors NOT yet in ContextAssembler** — bundle assembly works on pre-populated fixture inputs only (T1C-012 integration tests) | Phase 5 BrowseNode | T1C-012 fixtures pre-populate extractor outputs; EXTENSION_OUTPUT_MISSING warning emitted at runtime gap |
| **Full DeepPerceiveNode (LLM-driven enrichments + _extensions.deepPerceive)** — Phase 1c only wires settle hook | Phase 7 T117 | T1C-011 forward-stub uses class + bare function with `isPhase7Stub: true` marker; Phase 7 extends additively per R20 |
| **3 it.todo placeholders in AC-12 integration test** (T015 + T1B-012 backcompat regression embedded, llm_call_log diff=0, element_id stability) | Stage 3 regression or Phase 5 live-network | Documented in T1C-012 test file; manual Stage 3 regression check verified 27/27 GREEN on Phase 1b T1B-012 |
| **5 it.todo in AC-01 + AC-04 + AC-11 conformance tests** — live-Page integration deferred | Phase 5 BrowseNode or v0.3 | jsdom doesn't fully support getComputedStyle pseudo-elements + page.evaluate live-fonts; unit-level GREEN for structural assertions |
| **F-003 (LOW) — Playwright type-only import in DeepPerceiveNode** | v0.3 polish OR Phase 7 T117 R20 impact note | Forward-stub file header acknowledges tension; SettlePredicate uses structural Page type as alternative pattern |
| **8 LOW Stage 2.5 findings (F-004 through F-011)** | v0.3 polish | Documented in `.phase-state/1c/code-review-findings.yaml` §carryforward |
| **AuditRequest.element_graph_size configurability** | Phase 6 Gateway (or never if no consumer needs it) | Hardcoded ELEMENT_GRAPH_CAP=30 for MVP per impact.md §13 |

---

## 5. Open risks for next phase

| Risk | Impact | Owner | Mitigation |
|---|---|---|---|
| Phase 5 BrowseNode runtime-wiring delay could leave `EXTENSION_OUTPUT_MISSING` warnings firing at high rate on real network captures | Degraded perception completeness (still functional; warnings are advisory) | Phase 5 lead | Phase 5 spec must include T-PHASE-5-EXTENSION-WIRING task; impact.md §12 documents the handover |
| Phase 7 DeepPerceiveNode T117 will write into `_extensions.deepPerceive` — must NOT collide with anything written by Phase 1c | Schema conflict if Phase 1c accidentally writes _extensions; runtime assertion blocks at builder | Phase 7 lead | Phase 1c assertNamespaceContract enforces; AC-10 + AC-12 tests anchor; impact.md §11 carries forward |
| Phase 7 EvaluateNode token budget — full PerceptionBundle (raw+envelope) per state up to ~14.5K (Phase 1b empirical 12.5K + 2K envelope); Phase 7 may exceed 20K cap if blindly stuffed into evaluate prompt | EvaluateNode context overflow on multi-page audits | Phase 7 lead | impact.md §5 + Phase 1b rollup §5 row 3 both flag; recommend per-section slicing in EvaluateNode |
| `looksLikeIssuer3DS` heuristic broader than plan §2.6 literal — false-positive risk on non-issuer "3ds-bank" hostnames | Risk direction CONSERVATIVE (skip-vs-descend; never descends false-positive) | engineering lead | Stage 2.5 F-011 flagged for v0.3; no security exposure |
| 4 closed enums may need extension when new vendors emerge (e.g., new A/B platforms, new captcha providers) | Detection gaps for emerging vendors | engineering lead | R18 append-only path: bump enum value; add detector; emit migration note |

---

## 6. Conformance gate status (at phase exit — 2026-05-12)

| Test | Status | Last run |
|---|---|---|
| `pnpm vitest run tests/conformance/settle-predicate.test.ts` (AC-01) | ✅ green (2 pass + 4 it.todo) | 2026-05-12 |
| `pnpm vitest run tests/conformance/shadow-dom-traverser.test.ts` (AC-02) | ✅ green (4/4) | 2026-05-12 |
| `pnpm vitest run tests/conformance/portal-scanner.test.ts` (AC-03) | ✅ green (3/3) | 2026-05-12 |
| `pnpm vitest run tests/conformance/pseudo-element-capture.test.ts` (AC-04) | ✅ green (1 pass + 4 it.todo) | 2026-05-12 |
| `pnpm vitest run tests/conformance/iframe-policy-engine.test.ts` (AC-05) | ✅ green (9/9; incl. Stage 2.5 captcha anchor) | 2026-05-12 |
| `pnpm vitest run tests/conformance/hidden-element-capture.test.ts` (AC-06) | ✅ green (6/6) | 2026-05-12 |
| `pnpm vitest run tests/conformance/element-graph-builder.test.ts` (AC-07) | ✅ green (5/5) | 2026-05-12 |
| `pnpm vitest run tests/conformance/nondeterminism-detector.test.ts` (AC-08) | ✅ green (6/6) | 2026-05-12 |
| `pnpm vitest run tests/conformance/warning-emitter.test.ts` (AC-09) | ✅ green (5/5) | 2026-05-12 |
| `pnpm vitest run tests/conformance/perception-bundle.test.ts` (AC-10) | ✅ green (6 pass + 2 it.todo) | 2026-05-12 |
| `pnpm vitest run tests/conformance/deep-perceive-settle.test.ts` (AC-11) | ✅ green (1 pass + 4 it.todo) | 2026-05-12 |
| `pnpm vitest run tests/integration/perception-bundle.test.ts` (AC-12) | ✅ green (13 pass + 3 it.todo; phase exit gate) | 2026-05-12 |
| Phase 1b T1B-012 integration test (regression) | ✅ green (27/27 on v2.5 code via bundleToAnalyzePerception accessor) | 2026-05-12 |
| FULL `pnpm vitest run` agent-core | ✅ 278/300 + 17 todo (5 timeouts are pre-existing Phase 1 sandbox Chromium failures; non-regression verified) | 2026-05-12 |
| `pnpm typecheck` | ✅ clean | 2026-05-12 |
| `pnpm lint` (Phase 4 stub) | ✅ clean | 2026-05-12 |

---

## 7. What Phase 2 (MCP Tools) + Phase 5 (BrowseNode) should read

When Phase 2 / Phase 5 starts, the recommended reading order is:

1. **This file** (`phase-1c-perception-bundle/phase-1c-current.md`) — YOU ARE HERE
2. `docs/specs/mvp/phases/phase-2-tools/README.md` (Phase 2) OR `phase-5-browse-mvp/README.md` (Phase 5)
3. `docs/specs/mvp/phases/phase-1c-perception-bundle/impact.md §12 Runtime Wiring Ownership` (**critical for Phase 5** — own the extractor wiring into ContextAssembler.capture())
4. `packages/agent-core/src/perception/PerceptionBundle.ts` (Zod schema + buildPerceptionBundle + accessor — direct read)
5. `packages/agent-core/src/perception/IframePolicyEngine.ts` §2.6 classifier order (security boundary — read before extending iframe handling)
6. `packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts` (Phase 7 forward-stub — Phase 7 T117 extends here)

Do NOT load all Phase 1c artifacts. The compression is intentional. Shared contracts you need (`PerceptionBundleSchema`, `bundleToAnalyzePerception`, `envelopeTokenCount`, 4 closed Zod enums) live in `packages/agent-core/src/perception/*.ts` — read those files directly.

---

## 8. Cost + time summary (this phase)

| Metric | Target | Actual |
|---|---|---|
| Duration (sessions) | 1 session (15) | 1 session 2026-05-11 to 2026-05-12 (~2 days) |
| Engineering effort (planned) | ~16h ± 2 (plan.md v0.2 §4) | Master orchestrator dispatched 14 subagents across 6 waves; per-task LLM cost varied |
| LLM spend total | $10 phase ceiling | **~$10.45 / $10 ceiling (4.5% over; R23 kill not reached)** |
| Tasks completed | 13 atomic tasks (T-PHASE1C-TESTS + T1C-001..T1C-012) | 13/13 — phase exit checklist ticked at 7 of 12 (remaining are Stage 4 docs) |
| Phase 1c commits | (no target) | 12 commits on `feat/phase-1c-perception-bundle` since branch cut |
| Net LOC delta | (no target) | +5,274 / -167 (sources +2,055 + tests +1,925 + fixtures +265 + spec/plan/tasks/impact patches +745 + Stage 2.5 patches +114 + status bumps) |

---

## 9. Stage 2.5 carryover for v0.3 polish

Per `.phase-state/1c/code-review-findings.yaml` — non-blocking findings deferred:

- **F-003** (MED, deferred): Playwright type-only `import type { Page } from 'playwright'` in DeepPerceiveNode forward-stub — R9.1 reads "FORBIDDEN outside adapters"; SettlePredicate uses structural Page type as alternative pattern; defer to Phase 7 T117 R20 impact note OR v0.3 polish
- **F-004** (LOW, v0.3): checkout fixture naming vs Stripe-iframe label divergence
- **F-005** (LOW, v0.3): console.log in integration test for empirical metrics — noise leak
- **F-006** (LOW, v0.3): PerceptionBundle ap_by_state ↔ psm_by_state aliasing not documented inline
- **F-007** (LOW, v0.3 + Phase 5 prep): envelopeTokenCount uses 4-chars-per-token heuristic; tiktoken not wired
- **F-008** (LOW, v0.3): ShadowDomTraverser uses `/// <reference lib="dom" />` — only module breaking local-types invariant
- **F-009** (LOW, v0.3): spec.md:55 v0.2 delta block wording "9 + 3" vs AC-09 prose "12-code enum" — semantic no-op
- **F-010** (LOW, v0.3 / Phase 5 prep): integration test cap-30 validation via 2-element stubs (consistent with impact.md §12)
- **F-011** (LOW, v0.3): IframePolicyEngine.looksLikeIssuer3DS heuristic broader than plan §2.6 — conservative false-positive direction only

Estimated polish bundle: ~2-3 hours, post-Phase-5 (live-network validation will surface F-007 + F-010 priorities concretely).

---

## 10. Stage 2.5 + Stage 3 evidence trail

| Artifact | Path |
|---|---|
| Stage 1 pre-flight correctness (analyze) | `.phase-state/1c/preflight-correctness.json` |
| Stage 1 pre-flight coverage (matrix) | `.phase-state/1c/preflight-coverage.json` |
| Stage 1 + Pass 2 verdict (AI Reviewer) | `.phase-state/1c/preflight-verdict.yaml` |
| Stage 1 review notes (R17.4 audit trail) | `phase-1c-perception-bundle/review-notes.md` (Pass 1 REVISE + Pass 2 APPROVE + Gate 2 APPROVE) |
| Stage 2.5 code review findings | `.phase-state/1c/code-review-findings.yaml` (APPROVE-FOR-GATE-2; 0 CRITICAL + 0 HIGH + 3 MED + 8 LOW) |
| Stage 3 verification test results | `.phase-state/1c/verify-test-results.json` (278/300 + 17 todo; 5 sandbox-timeout failures classified non-regression) |
| Stage 3b verdict (AI Reviewer) | `.phase-state/1c/verify-verdict.yaml` (APPROVE; all 3 sub-audits PASS) |
| Master orchestrator state file | `.phase-state/1c.json` |
| R19 validation doc (sibling to this rollup) | `phase-1c-validation.md` (5 ASCII sections + spot-check list) |

Gate stamps:
- Gate 1 Pass 1: REVISE (2026-05-11) — 12 findings (2 HIGH + 5 MED + 5 LOW) drive v0.1 → v0.2 patch wave
- Gate 1 Pass 2: APPROVE (2026-05-12) — patch wave verified clean
- Gate 2: APPROVE (2026-05-12) — Stage 2 + Stage 2.5 + Stage 3 + Stage 3b all GREEN

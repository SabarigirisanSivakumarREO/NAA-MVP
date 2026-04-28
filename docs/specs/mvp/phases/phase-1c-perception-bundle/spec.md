---
title: Phase 1c — PerceptionBundle Envelope v2.5
artifact_type: spec
status: draft
version: 0.1
created: 2026-04-28
updated: 2026-04-28
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (F-004 Browser Perception)
  - docs/specs/mvp/constitution.md (R1-R26; especially R20 impact, R24 perception MUST NOT)
  - docs/specs/mvp/architecture.md (§6.4 tech stack, §6.5 file locations)
  - docs/specs/mvp/tasks-v2.md (T1C-001..T1C-012, lines 254-329)
  - docs/specs/final-architecture/07-analyze-mode.md §7.9.3 (REQ-ANALYZE-PERCEPTION-V25-001, REQ-PERCEPT-V25-002)
  - docs/specs/final-architecture/06-browse-mode.md §6.6 v2.5 (DOM traversal extensions; REQ-BROWSE-PERCEPT-007, REQ-BROWSE-PERCEPT-008)
  - docs/Improvement/perception_layer_spec.md (build-order items 1, 2, 6 + Shadow DOM / iframe / pseudo-element traversal)
  - docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md (predecessor; v2.4 baseline)

req_ids:
  - REQ-ANALYZE-PERCEPTION-V25-001
  - REQ-PERCEPT-V25-002
  - REQ-BROWSE-PERCEPT-007
  - REQ-BROWSE-PERCEPT-008

impact_analysis: docs/specs/mvp/phases/phase-1c-perception-bundle/impact.md
breaking: false
affected_contracts:
  - AnalyzePerception (wrapped, not modified)
  - PerceptionBundle (NEW shared contract)
  - PageStateModel (wrapped, not modified)
  - deep_perceive output type (changes from AnalyzePerception → PerceptionBundle; helper provided)

delta:
  new:
    - Phase 1c spec — introduces PerceptionBundle envelope, ElementGraph, FusedElement, settle predicate, DOM traversal extensions
    - AC-01 through AC-12 stable IDs for T1C-001..T1C-012 acceptance
    - R-01 through R-12 functional requirements
  changed: []
  impacted:
    - AnalyzePerception now lives inside `bundle.raw.analyze_perception_by_state[stateId]` — accessor helper provided for backward compat
    - PageStateModel now lives inside `bundle.raw.page_state_model_by_state[stateId]` — accessor helper provided
    - Token cap raised from 8K (v2.4) → 8.5K per state (v2.5 bundle)
    - tasks-v2.md (T1C-001..T1C-012 already canonical there)
  unchanged:
    - All v2.3 + v2.4 AnalyzePerception field shapes (R5.1 backward compat)
    - GR-001..GR-008 grounding rule field paths (still resolve via accessor)
    - 12 perception MCP tools (no new tools; bundle is built inside `page_analyze`/`deep_perceive`)

governing_rules:
  - Constitution R10 (Budget — bundle ≤8.5K per state)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R17 (Lifecycle States)
  - Constitution R18 (Delta-Based Updates — append-only AC-NN/R-NN IDs)
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes — PerceptionBundle is shared contract)
  - Constitution R22 (Ratchet)
  - Constitution R24 (Perception MUST NOT — no judgment, no LLM, no prioritization, no content rewriting, no form submit)
---

# Feature Specification: Phase 1c — PerceptionBundle Envelope v2.5

> **Summary (~150 tokens — agent reads this first):** Wrap `AnalyzePerception` (v2.4) inside a `PerceptionBundle` envelope that adds (a) shared element identity across DOM / AX-tree / layout / visual via an `ElementGraph` of `FusedElement`s keyed by stable `element_id`; (b) `meta` + `performance` + `nondeterminism_flags` + `warnings` + `state_graph` for honest output; (c) Shadow DOM + React Portal + pseudo-element + iframe-policy + hidden-element traversal extensions; (d) a 5-second-capped settle predicate (network idle + DOM mutation stop + fonts ready + animations done). All AnalyzePerception fields are preserved and accessible via `bundleToAnalyzePerception(bundle)`. Twelve tasks (T1C-001..T1C-012). Token impact: per-state bundle ≤8.5K (cap was 8K for v2.4 standalone). Cost impact: zero LLM calls; ~+200ms per state for settle.

**Feature Branch:** master (spec authoring; per phase-0..phase-6 convention)
**Input:** Phase 1c scope from `docs/specs/mvp/tasks-v2.md` lines 254-329 + `docs/Improvement/perception_layer_spec.md` items 1, 2, 6 + `docs/specs/final-architecture/07-analyze-mode.md` §7.9.3 + §06.6.6 v2.5

---

## Mandatory References

1. `docs/specs/mvp/constitution.md` — R10, R11, R18, R20, R24.
2. `docs/specs/mvp/PRD.md` — F-004.
3. `docs/specs/final-architecture/07-analyze-mode.md` §7.9.3 (REQ-ANALYZE-PERCEPTION-V25-001 + settle predicate).
4. `docs/specs/final-architecture/06-browse-mode.md` §6.6 v2.5 (REQ-BROWSE-PERCEPT-007 + REQ-BROWSE-PERCEPT-008).
5. `docs/specs/mvp/tasks-v2.md` lines 254-329 (T1C-001..T1C-012).
6. `docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md` (predecessor; v2.4 baseline).
7. `docs/Improvement/perception_layer_spec.md` (full design rationale; especially §3.4 settle, §1.1-1.4 channels, §2 element graph fusion).

---

## Constraints Inherited from Neural Canonical Specs

- **R24 (Perception MUST NOT):** No judgment, no prioritization, no content rewriting, no form submission, no autonomous auth attempts, no state-mutating retries. Capture only.
- **Backward compatibility (R18):** AnalyzePerception v2.4 contract is preserved. `bundle.raw.analyze_perception_by_state[bundle.initial_state_id]` returns identical v2.4 shape. `bundleToAnalyzePerception(bundle)` helper available for legacy code paths.
- **Token cap (architecture §7.9.3):** PerceptionBundle ≤8.5K per state. Hard ceiling 9K.
- **Settle hard cap:** 5 seconds. On exceed → emit `SETTLE_TIMEOUT_5S` warning and proceed with state as-captured.
- **Element graph cap:** 30 elements per state by default. Configurable via `AuditRequest.element_graph_size`.
- **Cross-origin iframes:** always skipped (security); same-origin descended only when policy classifies as `checkout` or `chat`.
- **Tech stack pinned (architecture §6.4).** No new vendor dependencies (Playwright + Sharp + native browser APIs).
- **No `console.log`** (R10.6) — Pino logger with correlation fields.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Cross-channel queries against fused element graph (Priority: P1)

A heuristic author wants to query "low-contrast, above-fold, interactive elements" without manually correlating indices across `ctas[]`, `clickTargets[]`, and computed-style maps. The v2.4 schema makes this query fragile (parallel arrays joined by index); v2.5 fuses them via `ElementGraph` keyed by stable `element_id`.

**Why this priority:** Fused identity unlocks an entire family of CRO heuristics (visual hierarchy, contrast vs interactivity, fold composition) that are currently impractical. Settle + traversal extensions are foundational gates this query family depends on.
**Independent Test:** Build a `PerceptionBundle` on a fixture; iterate `bundle.element_graph_by_state[initialStateId].elements` and filter by `(ax?.role === "button" && in_fold && style.contrast_ratio < 4.5)`. Confirm result list matches manual enumeration on the fixture.

**Acceptance Scenarios:**

1. **Given** a fixture with 5 above-fold buttons (3 with ratio <4.5, 2 above), **When** the bundle is built, **Then** the filter returns the 3 expected `element_id`s.
2. **Given** the same fixture re-run, **When** the bundle is rebuilt, **Then** the same 3 `element_id`s are produced (stability guarantee).

---

### User Story 2 — Honest output (nondeterminism flags + warnings) (Priority: P1)

A consultant publishing an audit on an Optimizely-instrumented site needs to see that Optimizely is active so findings can be flagged "may vary across visitors". Without `nondeterminism_flags`, the audit silently presents one variant as canonical.

**Why this priority:** Honest output is core to the project's positioning vs. Lighthouse / Hotjar competitors. False certainty erodes consultant trust faster than missing data does.
**Independent Test:** Run on a fixture instrumented with Optimizely; confirm `nondeterminism_flags` includes `"optimizely_active"`. Run on a Shadow-DOM-deep fixture; confirm `warnings` includes `SHADOW_DOM_NOT_TRAVERSED` if recursion depth >5.

**Acceptance Scenarios:**

1. **Given** Optimizely SDK loaded on the page, **When** the bundle is built, **Then** `bundle.nondeterminism_flags` contains `"optimizely_active"`.
2. **Given** a 7-level shadow-root nesting, **When** the bundle is built, **Then** `bundle.warnings` contains a `SHADOW_DOM_NOT_TRAVERSED` entry with `severity: "warn"`.

---

### User Story 3 — SPA settle before capture (Priority: P1)

An audit on a React SPA captures the page mid-route-transition and finds a half-rendered DOM; the resulting AnalyzePerception is corrupt. The settle predicate gates capture on (network idle + DOM mutation stop + fonts ready + animations done) with a 5-second hard cap.

**Why this priority:** Without settle, ~30% of SPA captures produce unusable perception data. Settle is a single shared utility that unblocks every downstream extractor.
**Independent Test:** Run on an SPA fixture with simulated 800ms route transition; confirm capture happens after the route resolves, not during. Run on a hung-fetch fixture; confirm capture happens at 5s cap with `SETTLE_TIMEOUT_5S` warning emitted.

**Acceptance Scenarios:**

1. **Given** an SPA route transition of 800ms, **When** `waitForSettle()` is called, **Then** capture begins between 800ms and 5000ms after route start.
2. **Given** a hung XHR fetch, **When** `waitForSettle()` runs, **Then** it returns at 5000ms ± 50ms with `capped_at_5s: true` and a `SETTLE_TIMEOUT_5S` warning is emitted on the bundle.

---

### User Story 4 — Backward-compat reader unchanged (Priority: P1)

A v2.4 consumer reading `analyzePerception.ctas[0].text` must keep working with zero code changes after Phase 1c ships.

**Why this priority:** Phase 5 browse-mode and Phase 7 evaluate node both consume AnalyzePerception via existing field paths. Breaking those blocks Phase 5/7.
**Independent Test:** Run the Phase 1 (T015) and Phase 1b (T1B-012) integration tests unchanged against the v2.5 code path; confirm both pass.

**Acceptance Scenarios:**

1. **Given** v2.4 consumer code reading `analyze.metadata.title`, **When** they migrate to `bundleToAnalyzePerception(bundle).metadata.title`, **Then** the value is identical.
2. **Given** GR-001..GR-008 grounding rules referencing `AnalyzePerception` field paths, **When** the bundle accessor returns the v2.4 shape, **Then** all rules resolve their paths unchanged.

---

### Edge Cases

- **Cross-origin iframe** → always skipped; emits `IFRAME_SKIPPED` with `severity: "info"`.
- **Stripe checkout iframe** (same-origin shim) → descended; iframe perception merged.
- **Shadow root recursion >5 levels** → halted, `SHADOW_DOM_NOT_TRAVERSED` emitted, traversal continues at root.
- **Web fonts never load** → emit `FONTS_NOT_READY`, settle proceeds anyway.
- **CSS animation longer than 1.5s** → emit `ANIMATION_NOT_SETTLED`, settle proceeds.
- **Cookie banner blocking >50% of fold** → emit `COOKIE_BANNER_BLOCKING_FOLD`, capture as-is (banner dismissal is Phase 5b decision).
- **Auth wall encountered** → emit `AUTH_REQUIRED_DETECTED`, halt capture (R6.4 — public pages only in MVP).
- **Element added/removed across states** → new `element_id` issued for added; removed elements' `element_id` does not appear in subsequent `state_id`'s graph.
- **Same DOM node persists across states** → `element_id` re-used.
- **`::before` content `""`** → skipped (empty content carries no meaning).
- **`::before` content of "•"** → skipped (punctuation-only).

---

## Acceptance Criteria *(mandatory — stable IDs, append-only)*

| ID | Criterion | Conformance test path | Linked REQ-ID(s) |
|----|-----------|----------------------|------------------|
| AC-01 | SettlePredicate waits for (network idle + DOM mutation stop + fonts ready + animations done + optional selector); 5s hard cap; emits `SETTLE_TIMEOUT_5S` when capped. | `packages/agent-core/tests/conformance/settle-predicate.test.ts` | REQ-PERCEPT-V25-002 |
| AC-02 | ShadowDomTraverser walks 3 nested shadow roots on test fixture; captures all elements; emits `SHADOW_DOM_NOT_TRAVERSED` warning at recursion depth >5. | `packages/agent-core/tests/conformance/shadow-dom-traverser.test.ts` | REQ-BROWSE-PERCEPT-007 |
| AC-03 | PortalScanner detects React Portal modals; marks `is_portal: true` on FusedElement; finds elements not reachable from logical parent tree. | `packages/agent-core/tests/conformance/portal-scanner.test.ts` | REQ-BROWSE-PERCEPT-007 |
| AC-04 | PseudoElementCapture returns `::before` / `::after` content (e.g., "NEW", "BESTSELLER", required-field markers) on badge fixture; skips empty / punctuation-only. | `packages/agent-core/tests/conformance/pseudo-element-capture.test.ts` | REQ-BROWSE-PERCEPT-007 |
| AC-05 | IframePolicyEngine processes 5 iframe types: checkout (stripe.com) + chat (intercom) → descend; video (youtube) + analytics (gtm) + social_embed (twitter) → skip + emit `IFRAME_SKIPPED`; cross-origin always skipped. | `packages/agent-core/tests/conformance/iframe-policy-engine.test.ts` | REQ-BROWSE-PERCEPT-007 |
| AC-06 | HiddenElementCapture populates `hiddenElements[]` with `display:none` / `aria-hidden=true` / `visibility:hidden` / offscreen / zero-dimension; `selector + reason` correct on each. | `packages/agent-core/tests/conformance/hidden-element-capture.test.ts` | REQ-BROWSE-PERCEPT-008 |
| AC-07 | ElementGraphBuilder builds fused graph from 5 fixtures; top-30 elements per state; stable `element_id` (matches across re-runs of same URL); `ref_in_analyze_perception` cross-references populated. | `packages/agent-core/tests/conformance/element-graph-builder.test.ts` | REQ-ANALYZE-PERCEPTION-V25-001 |
| AC-08 | NondeterminismDetector emits flags for Optimizely / VWO / Google Optimize / personalization cookies / ad auctions / time-based content; runtime probes match script-presence detections. | `packages/agent-core/tests/conformance/nondeterminism-detector.test.ts` | REQ-ANALYZE-PERCEPTION-V25-001 |
| AC-09 | WarningEmitter emits all 8 documented warning codes; `severity` correctly routed (info / warn / error). | `packages/agent-core/tests/conformance/warning-emitter.test.ts` | REQ-ANALYZE-PERCEPTION-V25-001 |
| AC-10 | PerceptionBundle Zod schema validates the full envelope; bundle is `Object.freeze`d after build; `bundleToAnalyzePerception(bundle)` returns identical v2.4 shape on baseline fixtures; per-state token budget ≤8.5K. | `packages/agent-core/tests/conformance/perception-bundle.test.ts` | REQ-ANALYZE-PERCEPTION-V25-001 |
| AC-11 | Settle integration into `deep_perceive` skeleton — settle runs before AnalyzePerception capture; settle warnings propagate into `bundle.warnings`. (Full DeepPerceiveNode is Phase 7 — Phase 1c only wires the settle hook.) | `packages/agent-core/tests/conformance/deep-perceive-settle.test.ts` | REQ-PERCEPT-V25-002 |
| AC-12 | Phase 1c integration test on 5 fixtures (homepage, PDP, cart, checkout, SPA-heavy); all channels populated; bundle ≤8.5K per state; ElementGraph ≤30 elements; nondeterminism flags fire on Optimizely fixture; warnings fire on Shadow-DOM-deep fixture; T015 + T1B-012 still pass unchanged. | `packages/agent-core/tests/integration/perception-bundle.test.ts` | REQ-ANALYZE-PERCEPTION-V25-001 |

---

## Functional Requirements

| ID | Requirement | Cites PRD F-NNN | Linked architecture spec |
|----|-------------|-----------------|--------------------------|
| R-01 | System MUST wait for `(networkidle ‖ 2s) ∧ (DOM mutations idle for 300ms ∨ 3s) ∧ (document.fonts.ready ∨ skip) ∧ (no running animations ∨ 1.5s) ∧ optional selector` before capture, capped at 5s total. | F-004 | §07.7.9.3 settle predicate |
| R-02 | System MUST traverse Shadow DOM recursively up to depth 5; halt at depth 5 and emit `SHADOW_DOM_NOT_TRAVERSED`. | F-004 | §06.6.6 v2.5 |
| R-03 | System MUST detect React Portals + Vue Teleport + Angular CDK Overlay by scanning `<body>` direct children for elements not reachable from logical parent; mark `is_portal: true`. | F-004 | §06.6.6 v2.5 |
| R-04 | System MUST capture `::before` / `::after` `content` text via `getComputedStyle(el, '::before').content`; skip empty / punctuation-only; merge into `FusedElement.text_content`. | F-004 | §06.6.6 v2.5 |
| R-05 | System MUST classify iframe purpose (checkout / chat / video / analytics / social_embed / other); descend on (checkout, chat) same-origin only; skip and emit `IFRAME_SKIPPED` for the rest; skip all cross-origin. | F-004 | §06.6.6 v2.5 |
| R-06 | System MUST capture hidden elements with `selector + reason` (display_none / aria_hidden / visibility_hidden / offscreen / zero_dimension); these do NOT contribute to ElementGraph but ARE recorded for heuristic visibility. | F-004 | §06.6.6 v2.5 + §07.7.9.3 |
| R-07 | System MUST build `ElementGraph` per state, keyed by stable `element_id` (hash of `tag + sorted_classes + dom_position_path + text_content_prefix(50)`); cap default 30 elements per state; populate `ref_in_analyze_perception` cross-references. | F-004 | §07.7.9.3 |
| R-08 | System MUST detect nondeterminism markers (Optimizely / VWO / Google Optimize / personalization cookies / ad auctions / time-based content) and emit corresponding `nondeterminism_flags`. | F-004 | §07.7.9.3 |
| R-09 | System MUST emit `warnings[]` with one of 8 documented codes, `message`, and `severity` ∈ {info, warn, error}. | F-004 | §07.7.9.3 |
| R-10 | System MUST validate `PerceptionBundle` via Zod; freeze the bundle (`Object.freeze`) after build; reject re-mutation. | F-004 + F-007 | §07.7.9.3 |
| R-11 | System MUST provide `bundleToAnalyzePerception(bundle, stateId?)` that returns the v2.4 AnalyzePerception shape unchanged for any state in the bundle (default: `initial_state_id`). | F-004 | §07.7.9.3 backward compat table |
| R-12 | System MUST integrate `waitForSettle()` into the `deep_perceive` capture path so every capture is gated on settle; settle results propagate to `bundle.warnings`. | F-004 | §07.7.9.3 + §07.5 |

---

## Non-Functional Requirements

| ID | Metric | Target | Cites PRD NF-NNN | Measurement method |
|----|--------|--------|------------------|--------------------|
| NF-01 | PerceptionBundle token budget per state | ≤8.5K (warn at 8K) | NF-001 | `getTokenCount()` in integration test |
| NF-02 | Per-state browser time vs v2.4 | ≤+200ms p50 (settle predicate) | NF-001 | Integration test timing diff |
| NF-03 | Net new LLM cost | $0 | NF-002 | `llm_call_log` row count diff = 0 |
| NF-04 | `element_id` stability across re-runs of same URL | 100% match on same DOM | — | Re-run integration test; compare element_id sets |
| NF-05 | Settle hard cap | 5s | — | Integration test with hung-fetch fixture |

---

## Key Entities

- **PerceptionBundle (NEW shared contract):** Top-level perception output. Wraps `AnalyzePerception` (v2.4) + `PageStateModel` (v3.x baseline) + screenshots in `bundle.raw`. Adds `meta`, `performance`, `nondeterminism_flags`, `warnings`, `state_graph`, `element_graph_by_state`. Frozen post-build. Zod schema in `packages/agent-core/src/perception/PerceptionBundle.ts`.
- **ElementGraph:** Per-state. `Map<element_id, FusedElement>` + `root_element_ids[]`. Top 30 elements (configurable).
- **FusedElement:** Single element record fusing DOM (tag, selector, xpath, text, attrs) + AX-tree (role, name, states, properties) + layout (bbox, in_fold, visible, z_index, overflow_clipped) + style (color, bg, font, contrast_ratio) + visual (crop_url) + interactivity (`is_interactive`) + parent/child IDs + cross-references back to v2.3/v2.4 arrays (`ref_in_analyze_perception`).
- **SettleResult:** `{ elapsed_ms, capped_at_5s }`. Emitted by `waitForSettle()`. Drives a `SETTLE_TIMEOUT_5S` warning when capped.
- **Warning:** `{ code, message, severity }`. 8 documented codes. Severity routes to Pino log levels.
- **NondeterminismFlag:** Enum string. 7 documented values. Consumer flags findings as "may vary across visitors" when present.

---

## Success Criteria *(measurable, technology-agnostic)*

- **SC-001:** All 5 integration fixtures (homepage, PDP, cart, checkout, SPA-heavy) produce a valid Zod-validated bundle with all channels populated.
- **SC-002:** Bundle token budget stays ≤8.5K per state on every fixture.
- **SC-003:** Phase 1 (T015) and Phase 1b (T1B-012) integration tests pass unchanged on the v2.5 code path.
- **SC-004:** `element_id` stability test: re-running on the same fixture URL produces identical `element_id` sets in `ElementGraph`.
- **SC-005:** Net new LLM spend per audit = $0.
- **SC-006:** Settle predicate respects 5s hard cap; emits `SETTLE_TIMEOUT_5S` ≥99% of the time when triggered.
- **SC-007:** ElementGraph cap of 30 elements per state respected on all fixtures (configurable up to 60 via `AuditRequest.element_graph_size`).

---

## Constitution Alignment Check

- [x] Does NOT predict conversion rates (R5.3 + GR-007) — perception-only
- [x] Does NOT auto-publish findings without consultant review — no findings emitted in this phase
- [x] Does NOT UPDATE or DELETE rows from append-only tables (R7.4) — no DB writes
- [x] Does NOT import vendor SDKs outside adapters (R9) — Playwright via BrowserEngine, Sharp wrapped
- [x] Does NOT set temperature > 0 on `evaluate` / `self_critique` / `evaluate_interactive` (R10) — no LLM calls
- [x] Does NOT expose heuristic content outside the LLM evaluate prompt (R6) — no heuristic engagement
- [x] DOES include a conformance test stub for every AC-NN (PRD §9.6 + R3 TDD) — AC-01..AC-12 each cite a path
- [x] DOES carry frontmatter delta block on subsequent edits (R18)
- [x] DOES define kill criteria for tasks > 2 hrs OR shared-contract changes (R23) — tracked in plan.md
- [x] DOES reference REQ-IDs from `docs/specs/final-architecture/` for every R-NN (R11.2)

---

## Out of Scope (cite PRD §3.2 explicit non-goals)

- **State graph EDGES** (formal `edges[]` array with metadata) — Phase 13 master track. Phase 1c emits node-only `state_graph.nodes[]` and `edges[]` shape, but multi-state interaction discovery is out of scope for MVP Phase 1c.
- **Cross-channel query API** (utility layer over `bundle.element_graph_by_state[].elements`) — deferred to Phase 14 (§33 interactive evaluate). Phase 1c only ships the data structure.
- **DeepPerceiveNode full implementation** — Phase 7. Phase 1c only wires the settle hook (T1C-011).
- **Multi-viewport bundles** — Phase 5b.
- **Auth-required perception** (PRD §3.2 permanent non-goal) — emits `AUTH_REQUIRED_DETECTED` and halts.
- **Cross-origin iframe descent** — security non-goal; always skipped.
- **Conversion-rate prediction** — permanent non-goal (R5.3 + GR-007).

---

## Assumptions

- Phase 1b (T1B-001..T1B-012) ships and `phase-1b-current.md` rollup is approved before Phase 1c starts.
- `PageStateModel` and `AnalyzePerception` v2.4 schemas remain available for wrapping (no concurrent breaking changes).
- Five integration fixtures are available or stubbable: homepage, PDP, cart, checkout, SPA-heavy. SPA-heavy fixture authoring may need to be scheduled (ASK FIRST if missing).
- Sharp library is wired (used for contrast in v2.4) — no new vendor dependency.
- `bundleToAnalyzePerception()` accessor is sufficient for backward compat — no consumer requires deeper migration in MVP.
- Cross-origin iframes are uniformly skipped; same-origin iframe descent budget defaults to depth 1 (no nested iframe traversal beyond 1 level).
- DeepPerceiveNode skeleton (Phase 7 forward stub at T1C-011) accepts the settle hook without architecture change.

---

## Next Steps

After approval (`status: draft → validated → approved`):

1. Run `/speckit.plan` (already drafted alongside this spec).
2. Run `/speckit.tasks` (T1C-001..T1C-012 mirrored from `tasks-v2.md`).
3. Run `/speckit.analyze` for cross-artifact consistency.
4. Phase 1c implementation begins after Phase 1b ships and `phase-1b-current.md` rollup is approved.

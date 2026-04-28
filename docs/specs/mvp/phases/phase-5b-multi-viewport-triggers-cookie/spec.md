---
title: Phase 5b — Multi-Viewport + Trigger Taxonomy + Cookie Policy
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
  - docs/specs/mvp/PRD.md (F-004 Browser Perception, F-008 Multi-Viewport Audit, F-019 Reproducibility)
  - docs/specs/mvp/constitution.md (R1-R26; especially R10 budget, R20 impact, R24 perception MUST NOT, R26 state exploration MUST NOT)
  - docs/specs/mvp/architecture.md (§6.4 tech stack)
  - docs/specs/mvp/tasks-v2.md (T5B-001..T5B-019, lines 580-696)
  - docs/specs/final-architecture/07-analyze-mode.md §7.9.2 (popup behavior fields, multi-viewport)
  - docs/specs/final-architecture/18-trigger-gateway.md §18 (AuditRequest extensions)
  - docs/specs/final-architecture/20-state-exploration.md (trigger taxonomy)
  - docs/specs/final-architecture/06-browse-mode.md (BrowseGraph integration)
  - docs/specs/mvp/phases/phase-5-browse-mvp/spec.md (predecessor — single-viewport baseline)
  - docs/Improvement/perception_layer_spec.md §3.1 trigger taxonomy + §4.1 multi-viewport + §4.4 cookie banners

req_ids:
  - REQ-ANALYZE-PERCEPTION-V24-001 (popup behavior + multi-viewport extensions)
  - REQ-GATEWAY-AUDITREQ-VIEWPORTS-001
  - REQ-GATEWAY-AUDITREQ-COOKIE-001
  - REQ-STATE-EXPL-TRIGGER-001..008 (eight trigger types)
  - REQ-SAFETY-005 (robots/ToS — cookie banner consent)

impact_analysis: docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/impact.md
breaking: false
affected_contracts:
  - AuditRequest (extended with viewports + cookie_policy)
  - AnalyzePerception popups[] (behavior fields populated, formerly null)
  - PerceptionBundle (per-viewport bundles when multi-viewport)
  - HeuristicLoader manifest (multi-viewport heuristics added)

delta:
  new:
    - Phase 5b spec — multi-viewport + popup behavior + 5 new trigger types + cookie policy
    - AC-01 through AC-19 stable IDs for T5B-001..T5B-019 acceptance
    - R-01 through R-19 functional requirements
  changed: []
  impacted:
    - AnalyzePerception popups[] behavior fields (`isEscapeDismissible`, `isClickOutsideDismissible`, timing, exit_intent, scroll_trigger, dark_pattern) — populated by Phase 5b (Phase 1b only emitted presence)
    - tasks-v2.md (T5B-001..T5B-019 already canonical)
  unchanged:
    - Phase 5 single-viewport browse-mode behavior (Phase 5b is opt-in, default desktop-only)
    - PerceptionBundle envelope contract (multi-viewport produces multiple bundles, one per viewport)
    - GR-001..GR-008 grounding rules

governing_rules:
  - Constitution R10 (Budget — multi-viewport doubles browse cost; opt-in only)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R17 (Lifecycle States)
  - Constitution R18 (Delta-Based Updates)
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes)
  - Constitution R22 (Ratchet)
  - Constitution R24 (Perception MUST NOT)
  - Constitution R26 (State Exploration MUST NOT — no infinite loops, no destructive triggers, no auth bypass)
---

# Feature Specification: Phase 5b — Multi-Viewport + Trigger Taxonomy + Cookie Policy

> **Summary (~150 tokens — agent reads this first):** Three opt-in capabilities that extend Phase 5 browse-mode: (a) Multi-viewport — `AuditRequest.viewports: ["desktop", "mobile"]` runs perception per viewport sequentially and produces a `ViewportDiffFinding` for fold/CTA/sticky differences. (b) Popup behavior — runtime probe + dismissibility tester + dark-pattern detector populates the popups[] behavior fields that Phase 1b left null. (c) Five new triggers (hover, scroll-position, time-delay, exit-intent, form-input) join the existing click trigger to form an 8-trigger taxonomy with prioritized candidate discovery. (d) Cookie policy — detect (OneTrust/Cookiebot/TrustArc + generic) + dismiss/preserve per `AuditRequest.cookie_policy`. 19 tasks (T5B-001..T5B-019). Cost: ~2× browse cost when multi-viewport ON; opt-in only — default desktop-only keeps cost flat. Zero new LLM calls.

**Feature Branch:** master (spec authoring; per phase-0..phase-6 convention)
**Input:** Phase 5b scope from `docs/specs/mvp/tasks-v2.md` lines 580-696 + improvement spec §3.1/§4.1/§4.4

---

## Mandatory References

1. `docs/specs/mvp/constitution.md` — R10, R11, R18, R20, R24, R26.
2. `docs/specs/mvp/PRD.md` — F-004, F-008, F-019.
3. `docs/specs/final-architecture/07-analyze-mode.md` §7.9.2 (popup behavior + multi-viewport).
4. `docs/specs/final-architecture/18-trigger-gateway.md` (AuditRequest extensions).
5. `docs/specs/final-architecture/20-state-exploration.md` (trigger taxonomy).
6. `docs/specs/final-architecture/06-browse-mode.md` (BrowseGraph integration).
7. `docs/specs/mvp/tasks-v2.md` lines 580-696.
8. `docs/Improvement/perception_layer_spec.md` §3.1, §4.1, §4.4.

---

## Constraints Inherited from Neural Canonical Specs

- **R26 (State Exploration MUST NOT):** No infinite trigger loops. Triggers do NOT navigate away (no `<a href>` clicks if same-page heuristic fails). Triggers do NOT bypass auth. No destructive form submissions. Per-trigger budget enforced (max 10 candidates per type per state). Cross-origin iframes never triggered.
- **R24 (Perception MUST NOT):** Trigger probes capture state diffs but do NOT judge — `DarkPatternDetector` flags presence patterns; severity scoring is heuristic-side.
- **Cost discipline (R10):** Multi-viewport doubles browse cost — only when `viewports.length > 1`. Default `["desktop"]` keeps cost flat. Trigger probes per state are budget-capped.
- **Opt-in by default:** Without explicit AuditRequest enablement, Phase 5b features are inactive (single-viewport, click-only triggers, default cookie dismiss).
- **Sequential execution:** Multi-viewport runs sequentially (no parallel browser contexts in MVP — keeps memory bounded; parallelism deferred to v1.1).
- **No `console.log`** (R10.6) — Pino logger with viewport, audit_run_id, trigger_type correlation fields.
- **Tech stack pinned:** Playwright (already wired). No new deps.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Mobile-priority audit on a Shopify D2C site (Priority: P1)

A REO Digital consultant runs `pnpm cro:audit --urls fixture.com --viewports desktop,mobile` on a Shopify D2C site. Phase 5b runs perception on desktop first, then mobile, produces a `ViewportDiffFinding` flagging that the primary CTA falls below the fold on mobile, and includes mobile-only heuristics (e.g., "sticky CTA covers >40% of viewport on mobile").

**Why this priority:** Mobile share for D2C audits is typically >50%. Single-viewport audits miss mobile-only conversion blockers entirely.
**Independent Test:** Run a 1-page audit with `viewports: ["desktop","mobile"]`; confirm two PerceptionBundles produced (one per viewport), `ViewportDiffFinding` references both, and total cost ≤2× single-viewport baseline.

**Acceptance Scenarios:**

1. **Given** `viewports: ["desktop","mobile"]`, **When** the audit runs, **Then** two perceptions captured sequentially, both with same `correlation_id`, total cost ≤2× single-viewport baseline.
2. **Given** mobile fold composition differs from desktop, **When** ViewportDiffEngine runs, **Then** `ViewportDiffFinding` lists CTA visibility diff, sticky element diff, fold composition diff.

---

### User Story 2 — Popup quality audit on a SaaS landing page (Priority: P1)

A SaaS landing page has two popups: (a) a cookie banner that's Escape-dismissible with a clear "Accept" button, and (b) an exit-intent newsletter modal with a deceptive close button (an "X" icon styled as decorative graphic with weak click target). Phase 5b runtime-probes both popups, populates `popups[].isEscapeDismissible / isClickOutsideDismissible / triggerType / timing`, and `DarkPatternDetector` flags the second popup as `deceptive_close`.

**Why this priority:** Phase 1b only captures presence; without behavior fields, popup heuristics cannot distinguish acceptable from intrusive popups.
**Independent Test:** Run on a fixture with the two popups; confirm `popups[]` has both behavior-fields populated AND `popups[1].dark_pattern_flag === "deceptive_close"`.

**Acceptance Scenarios:**

1. **Given** a popup that responds to Escape, **When** PopupDismissibilityTester runs, **Then** `popups[i].isEscapeDismissible === true` and page state is restored after the test.
2. **Given** an exit-intent popup, **When** ExitIntentTrigger fires (mouse to y=-1), **Then** the popup appears and `popups[i].triggerType === "exit_intent"`.
3. **Given** a popup with no detectable close button, **When** DarkPatternDetector runs, **Then** `popups[i].dark_pattern_flag === "no_close_button"`.

---

### User Story 3 — Variant-picker reveal on a PDP (Priority: P1)

A PDP has a color-variant selector. Selecting a different color reveals out-of-stock messaging on the price block. Single-trigger (click-only) audit misses this because the reveal is a `<select>` change. Phase 5b's `FormInputTrigger` selects each variant in turn and captures the resulting state diff.

**Why this priority:** Variant-driven price/availability is a top-5 e-commerce conversion signal. Without it, audits miss obvious findings.
**Independent Test:** Run on a multi-variant PDP fixture; confirm at least 2 variant states captured beyond initial state.

**Acceptance Scenarios:**

1. **Given** a `<select>` color picker, **When** FormInputTrigger runs, **Then** new states added to `state_graph.nodes[]` with `trigger_path` referencing the select element + selected value.
2. **Given** an out-of-stock variant, **When** the variant is selected, **Then** the resulting AnalyzePerception's `commerce.stockStatus === "out_of_stock"`.

---

### User Story 4 — Cookie banner blocks fold (Priority: P1)

A site has a OneTrust cookie banner covering 60% of the fold at page load. With `AuditRequest.cookie_policy: "dismiss"` (default), CookieBannerDetector identifies OneTrust, CookieBannerPolicy clicks "Accept", and perception runs on the unobstructed page. With `cookie_policy: "preserve"`, the banner remains and a `COOKIE_BANNER_BLOCKING_FOLD` warning fires.

**Why this priority:** Without dismissal, cookie banners corrupt every above-fold heuristic. Without policy, default behavior must be safe.
**Independent Test:** Run on OneTrust fixture twice (dismiss + preserve); confirm dismiss path proceeds clean and preserve path emits the warning.

**Acceptance Scenarios:**

1. **Given** OneTrust banner + default policy, **When** Phase 5b runs, **Then** banner detected, dismissed via "Accept" click, perception captures the unobstructed page.
2. **Given** `cookie_policy: "preserve"` + banner blocks 60% of fold, **When** Phase 5b runs, **Then** `COOKIE_BANNER_BLOCKING_FOLD` warning emitted, perception captures the obstructed page.
3. **Given** `cookie_policy: "block"`, **When** Phase 5b validates the AuditRequest, **Then** request rejected with `INVALID_COOKIE_POLICY: block (consent breakage)` error.

---

### User Story 5 — Hover reveals microcopy (Priority: P2)

A pricing-page comparison table has `<th>` cells with `aria-haspopup` tooltips that show feature-detail copy on hover. Without `HoverTrigger`, this microcopy is invisible to perception. Phase 5b dwells on each tooltip-bearing element and captures the revealed content.

**Why this priority:** Pricing-page hover-microcopy is a critical SaaS conversion signal. Mobile-priority audits skip hover (no hover on touch); desktop-priority audits include it.
**Independent Test:** Run desktop audit on pricing-page fixture; confirm new states added for each tooltip reveal.

**Acceptance Scenarios:**

1. **Given** a `<th>` with `aria-haspopup`, **When** HoverTrigger runs (desktop only), **Then** new state captured with the tooltip content visible.

---

### Edge Cases

- **Same-origin checkout iframe** → Phase 5b triggers respect Phase 1c IframePolicyEngine; cross-origin always skipped.
- **Variant picker that navigates** (some PDPs route to a new URL on variant change) → FormInputTrigger detects URL change; treated as state separation, not in-place reveal.
- **Cookie banner that re-appears after Escape** → CookieBannerPolicy retries Accept twice; emits `COOKIE_BANNER_PERSISTENT` if still present.
- **Popup that auto-closes after 3 seconds** → captured between dismiss tests; PopupBehaviorProbe records `auto_close_ms: 3000`.
- **Exit-intent popup on mobile** (no exit-intent on touch) → ExitIntentTrigger no-ops on mobile viewport (skipped silently).
- **Form input trigger on credit card field** → R26 forbids destructive triggers; FormInputTrigger explicitly skips fields with `autocomplete="cc-*"` and password fields.
- **Hover on a button that fires `:hover` analytics ping** → HoverTrigger only dwells; click is NOT fired; analytics ping cost is acceptable.
- **TimeDelayTrigger on a session-tracker** → cap is 10s; longer-tail triggers (60s+) are out of scope.
- **Multi-viewport on a responsive site that re-renders fully** → desktop and mobile bundles produced independently; correlation by `audit_run_id`, not by element_id (element_id is per-viewport per §07 §7.9.3 stability rules).

---

## Acceptance Criteria *(mandatory — stable IDs, append-only)*

| ID | Criterion | Conformance test path | Linked REQ-ID(s) |
|----|-----------|----------------------|------------------|
| AC-01 | `AuditRequest.viewports` Zod field accepts `["desktop"]` and `["desktop","mobile"]`, defaults to `["desktop"]`, rejects unknown viewport names. | `packages/agent-core/tests/conformance/audit-request-viewports.test.ts` | REQ-GATEWAY-AUDITREQ-VIEWPORTS-001 |
| AC-02 | ViewportConfigService reads viewports from AuditRequest; returns ordered list of viewport configs (`width`, `height`, `device_type`). | `packages/agent-core/tests/conformance/viewport-config-service.test.ts` | §07.7.9.2 |
| AC-03 | MultiViewportOrchestrator runs perception per viewport sequentially on 1 page; both desktop+mobile perceptions stored separately; correlation_id matches across viewports; no parallel browser contexts. | `packages/agent-core/tests/conformance/multi-viewport-orchestrator.test.ts` | §07.7.9.2 |
| AC-04 | ViewportDiffEngine compares desktop vs mobile perception; identifies fold composition diff, CTA visibility diff, sticky element diff; produces ViewportDiffFinding with severity scoring. | `packages/agent-core/tests/conformance/viewport-diff-engine.test.ts` | §07.7.9.2 |
| AC-05 | PopupBehaviorProbe watches popup trigger on test fixtures (load / time-on-page / scroll / exit-intent); captures `triggerType` + timing; updates popups[] in-place from Phase 1b's null behavior fields. | `packages/agent-core/tests/conformance/popup-behavior-probe.test.ts` | §07.7.9.2 |
| AC-06 | PopupDismissibilityTester tests escape key + click-outside on detected popups; updates `popups[].isEscapeDismissible` and `isClickOutsideDismissible` from null → true/false; restores page state after test. | `packages/agent-core/tests/conformance/popup-dismissibility-tester.test.ts` | §07.7.9.2 |
| AC-07 | DarkPatternDetector detects deceptive close UI / forced-action popup; flags with type tag (deceptive_close / forced_action / no_close_button / hidden_dismiss); catches ≥1 known dark pattern in fixture set. | `packages/agent-core/tests/conformance/dark-pattern-detector.test.ts` | §07.7.9.2 |
| AC-08 | Multi-viewport heuristics pack loads + Zod-validates; 5 new heuristics for mobile-only / desktop-only issues; tier assigned per heuristic. | `packages/agent-core/tests/conformance/multi-viewport-heuristics-pack.test.ts` | §09 + §07.7.9.2 |
| AC-09 | Phase 5b multi-viewport integration test: 1 audit with `viewports: ["desktop","mobile"]`; findings include mobile-only + desktop-only + dark-pattern flags; total cost ≤2× single-viewport baseline; popup behavior fields populated. | `packages/agent-core/tests/integration/multi-viewport.test.ts` | All multi-viewport REQ-IDs |
| AC-10 | HoverTrigger detects `:hover` rules + `aria-haspopup` on test fixture; fires mouseenter + dwell; reveals tooltips and dropdown previews; settles within 1s. | `packages/agent-core/tests/conformance/hover-trigger.test.ts` | REQ-STATE-EXPL-TRIGGER-002 |
| AC-11 | ScrollPositionTrigger detects IntersectionObserver patterns + sticky elements; scrolls to Y-coordinates; captures sticky CTA changes + lazy-loaded content reveal. | `packages/agent-core/tests/conformance/scroll-position-trigger.test.ts` | REQ-STATE-EXPL-TRIGGER-003 |
| AC-12 | TimeDelayTrigger runs page for N seconds (default 5s, max 10s); diffs DOM; treats new nodes as time-triggered; captures time-delayed banners and announcements. | `packages/agent-core/tests/conformance/time-delay-trigger.test.ts` | REQ-STATE-EXPL-TRIGGER-004 |
| AC-13 | ExitIntentTrigger searches scripts for mouseleave listeners; simulates mouse to (x, -1); triggers exit-intent popups; populates `popups[].triggerType: "exit_intent"`. No-ops silently on mobile viewport. | `packages/agent-core/tests/conformance/exit-intent-trigger.test.ts` | REQ-STATE-EXPL-TRIGGER-005 |
| AC-14 | FormInputTrigger types/selects on `<select>` + variant pickers + quantity + address fields; captures variant-driven price/availability changes; skips `autocomplete="cc-*"` and password fields (R26). | `packages/agent-core/tests/conformance/form-input-trigger.test.ts` | REQ-STATE-EXPL-TRIGGER-006 + R26 |
| AC-15 | TriggerCandidateDiscovery pulls all interactive_nodes from ax_tree + adds hover/scroll/time/exit candidates; returns prioritized candidate list ordered: variant > tabs > accordions > modals > cart > sticky > hover > carousels. | `packages/agent-core/tests/conformance/trigger-candidate-discovery.test.ts` | §20 + REQ-STATE-EXPL-* |
| AC-16 | CookieBannerDetector detects OneTrust + Cookiebot + TrustArc by selector signature; generic detection: fixed-position element covering >20% of fold with "cookie" text; returns banner descriptor with selector + library + dismissibility metadata. | `packages/agent-core/tests/conformance/cookie-banner-detector.test.ts` | improvement spec §4.4 |
| AC-17 | CookieBannerPolicy executes `dismiss` (auto-click accept or reject) or `preserve` per AuditRequest.cookie_policy; `block` mode rejected with structured error; default = `dismiss`; emits `COOKIE_BANNER_BLOCKING_FOLD` if banner covers >40% of fold and not dismissed. | `packages/agent-core/tests/conformance/cookie-banner-policy.test.ts` | improvement spec §4.4 + REQ-SAFETY-005 |
| AC-18 | `AuditRequest.cookie_policy` Zod field accepts `dismiss | preserve`; default `dismiss`; rejects `block` value with descriptive error. | `packages/agent-core/tests/conformance/audit-request-cookie-policy.test.ts` | REQ-GATEWAY-AUDITREQ-COOKIE-001 |
| AC-19 | Phase 5b full integration test: 1 audit with `viewports:["desktop","mobile"]`, all 8 trigger types active, both cookie policies tested. Findings include mobile-only / desktop-only / dark patterns / hover-revealed microcopy / exit-intent popups / time-delayed banners. Cost ≤2× single-viewport baseline. All warning types emit on appropriate fixtures. | `packages/agent-core/tests/integration/phase5b-full.test.ts` | All Phase 5b REQ-IDs |

---

## Functional Requirements

| ID | Requirement | Cites PRD F-NNN | Linked architecture spec |
|----|-------------|-----------------|--------------------------|
| R-01 | System MUST extend `AuditRequest` with `viewports: ("desktop" | "mobile")[]` (default `["desktop"]`); reject unknown viewport names. | F-008 | §18 + REQ-GATEWAY-AUDITREQ-VIEWPORTS-001 |
| R-02 | System MUST run perception sequentially per viewport when `viewports.length > 1`; same `correlation_id`; no parallel browser contexts in MVP. | F-008 | §07.7.9.2 |
| R-03 | System MUST compute a `ViewportDiffFinding` comparing desktop vs mobile perception (fold composition, CTA visibility, sticky elements); attach severity per heuristic-defined dimensions. | F-008 | §07.7.9.2 |
| R-04 | System MUST runtime-probe popups detected by Phase 1b: trigger type (load / time / scroll / exit_intent) + timing in ms; mutate Phase 1b's popups[] in place. | F-004 | §07.7.9.2 |
| R-05 | System MUST test popup dismissibility (Escape key + click-outside) and update `isEscapeDismissible` + `isClickOutsideDismissible` from null → true/false; restore page state after each test. | F-004 | §07.7.9.2 |
| R-06 | System MUST flag dark-pattern popups: `deceptive_close`, `forced_action`, `no_close_button`, `hidden_dismiss`; per-popup tag in `popups[i].dark_pattern_flag`. | F-004 | §07.7.9.2 |
| R-07 | System MUST author 5 multi-viewport heuristics (e.g., "primary CTA hidden below fold on mobile"); load + Zod-validate via existing schema. | F-006 | §09 + §07.7.9.2 |
| R-08 | System MUST implement HoverTrigger with `:hover` + `aria-haspopup` detection; mouseenter + dwell; settle within 1s; no-op on mobile viewport. | F-004 | §20 + REQ-STATE-EXPL-TRIGGER-002 |
| R-09 | System MUST implement ScrollPositionTrigger using IntersectionObserver pattern detection; scroll to Y-coordinates; capture sticky-CTA + lazy-load reveal. | F-004 | §20 + REQ-STATE-EXPL-TRIGGER-003 |
| R-10 | System MUST implement TimeDelayTrigger (default 5s, max 10s); DOM diff; new nodes treated as time-triggered. | F-004 | §20 + REQ-STATE-EXPL-TRIGGER-004 |
| R-11 | System MUST implement ExitIntentTrigger (mouse to (x, -1)); search scripts for mouseleave listeners; populates `popups[i].triggerType: "exit_intent"` on triggered popups; no-op on mobile. | F-004 | §20 + REQ-STATE-EXPL-TRIGGER-005 |
| R-12 | System MUST implement FormInputTrigger for `<select>` / variant / quantity / address fields; capture variant-driven changes; skip `autocomplete="cc-*"` and password fields per R26. | F-004 | §20 + REQ-STATE-EXPL-TRIGGER-006 + R26 |
| R-13 | System MUST run TriggerCandidateDiscovery to pull all interactive_nodes + add hover/scroll/time/exit candidates; prioritized order: variant > tabs > accordions > modals > cart > sticky > hover > carousels. | F-004 | §20 |
| R-14 | System MUST detect cookie banners (OneTrust / Cookiebot / TrustArc by selector signature; generic by fixed-position + "cookie" text + >20% fold coverage); return descriptor with selector + library + dismissibility. | F-004 | improvement spec §4.4 |
| R-15 | System MUST execute cookie policy: `dismiss` (Accept or Reject click) / `preserve` (no action); reject `block` with structured error; default `dismiss`; emit `COOKIE_BANNER_BLOCKING_FOLD` when banner covers >40% of fold and not dismissed. | F-004 | improvement spec §4.4 + REQ-SAFETY-005 |
| R-16 | System MUST extend `AuditRequest.cookie_policy: "dismiss" | "preserve"` with default `dismiss`; reject `block`. | F-008 | §18 + REQ-GATEWAY-AUDITREQ-COOKIE-001 |
| R-17 | System MUST cap per-trigger budget at 10 candidates per type per state to enforce R10 + R26. | F-004 | R10, R26 |
| R-18 | System MUST refuse trigger candidates that navigate cross-origin or auth-walled URLs (per R26). | F-004 | R26 |
| R-19 | System MUST integrate trigger taxonomy into `BrowseGraph` so triggered states append to `PerceptionBundle.state_graph.nodes[]` with `trigger_path` populated. | F-004 | §06 + §07.7.9.3 |

---

## Non-Functional Requirements

| ID | Metric | Target | Cites PRD NF-NNN | Measurement method |
|----|--------|--------|------------------|--------------------|
| NF-01 | Multi-viewport audit cost vs single-viewport baseline | ≤2× when `viewports.length === 2` | NF-002 | Integration test cost diff |
| NF-02 | Popup behavior probing wall time per popup | ≤2s | — | Per-popup timing in conformance test |
| NF-03 | Trigger candidate budget per state | ≤10 per type | — | Static enforcement; conformance assertion |
| NF-04 | TimeDelayTrigger max wait | 10s | — | Conformance assertion |
| NF-05 | Net new LLM cost when Phase 5b active | $0 | NF-002 | `llm_call_log` row count diff |
| NF-06 | Cookie banner detection precision on fixture set | ≥95% | — | Conformance test on OneTrust + Cookiebot + TrustArc + 2 generic fixtures |

---

## Key Entities

- **AuditRequest (extended):** Adds `viewports: ("desktop" | "mobile")[]` (default `["desktop"]`) and `cookie_policy: "dismiss" | "preserve"` (default `"dismiss"`).
- **ViewportConfig:** `{ width, height, device_type }` per viewport. Fixed presets in MVP (desktop 1440×900, mobile 375×812 — iPhone 11 baseline).
- **ViewportDiffFinding:** New finding type comparing per-viewport perceptions; surfaces fold/CTA/sticky differences.
- **Popup (behavior fields):** Phase 1b emits popups[] with behavior fields null. Phase 5b mutates in place to populate `triggerType`, `timingMs`, `isEscapeDismissible`, `isClickOutsideDismissible`, `dark_pattern_flag`.
- **TriggerCandidate:** `{ element_id, trigger_type, priority }`. Trigger types: `click | hover | scroll | time | exit_intent | form_input | tab | accordion`.
- **CookieBannerDescriptor:** `{ selector, library: "onetrust" | "cookiebot" | "trustarc" | "generic", isAccessibleAt, fold_coverage_percent, accept_selector, reject_selector }`.

---

## Success Criteria *(measurable, technology-agnostic)*

- **SC-001:** When opt-in (`viewports` includes "mobile"), multi-viewport audit produces 2 PerceptionBundles + 1 ViewportDiffFinding; total cost ≤2× single-viewport baseline.
- **SC-002:** Popup behavior fields populated for all detected popups in 5-fixture popup set; ≥1 dark pattern detected in the fixture set.
- **SC-003:** All 5 new triggers + existing click trigger fire correctly on the 8-trigger integration fixture; per-trigger budget ≤10 candidates respected.
- **SC-004:** Cookie banner detection precision ≥95% on the 5-fixture cookie set (OneTrust + Cookiebot + TrustArc + 2 generic).
- **SC-005:** Default audit (no Phase 5b opts) behaves identically to Phase 5 — no cost regression, no behavior change.
- **SC-006:** Net new LLM cost = $0 when Phase 5b active.
- **SC-007:** R26 compliance — no infinite trigger loops, no destructive form submission (cc-*/password skipped), no cross-origin trigger, per-trigger budget enforced.

---

## Constitution Alignment Check

- [x] Does NOT predict conversion rates (R5.3 + GR-007) — all Phase 5b output is factual (presence + behavior + diff), not predictive
- [x] Does NOT auto-publish findings without consultant review — findings remain hypotheses
- [x] Does NOT UPDATE or DELETE rows from append-only tables (R7.4) — no DB writes
- [x] Does NOT import vendor SDKs outside adapters (R9) — Playwright via BrowserEngine
- [x] Does NOT set temperature > 0 on `evaluate` / `self_critique` / `evaluate_interactive` (R10) — no LLM calls
- [x] Does NOT expose heuristic content outside the LLM evaluate prompt (R6) — heuristic content stays in heuristic library
- [x] DOES include a conformance test stub for every AC-NN (PRD §9.6 + R3 TDD) — AC-01..AC-19 each cite a path
- [x] DOES carry frontmatter delta block on subsequent edits (R18)
- [x] DOES define kill criteria for tasks > 2 hrs OR shared-contract changes (R23) — tracked in plan.md
- [x] DOES reference REQ-IDs from `docs/specs/final-architecture/` for every R-NN (R11.2)
- [x] R26 enforced — per-trigger budget, cross-origin refusal, cc-*/password field skip, no infinite loops, navigation refusal

---

## Out of Scope (cite PRD §3.2 explicit non-goals)

- **Tablet / smartwatch / TV viewports** — desktop + mobile only in MVP. Tablet may land in v1.1 if pilot demand emerges.
- **Parallel viewport execution** — sequential only in MVP (memory-bounded). Parallelism deferred to v1.1.
- **Custom trigger types** beyond the 8 in `state_exploration_layer_spec`'s taxonomy — extensions are master-track Phase 13.
- **Form submission as a trigger** — explicitly forbidden by R26 in MVP.
- **Cookie banner consent reject flow** — `dismiss` always accepts in MVP. v1.1 adds explicit `dismiss-reject` mode.
- **Auth-walled triggers** (e.g., "fire trigger after login") — permanent non-goal.
- **Conversion-rate prediction** — permanent non-goal (R5.3 + GR-007).

---

## Assumptions

- Phase 5 (T081-T100 BrowseGraph + integration tests) ships and `phase-5-current.md` rollup is approved before Phase 5b starts.
- Phase 1b (T1B-001..T1B-012) ships popups[] presence layer; Phase 5b mutates in place.
- Phase 1c (T1C-001..T1C-012) ships ElementGraph for trigger candidate discovery (T5B-015).
- Multi-viewport heuristics (T5B-008) authored as part of Phase 0b heuristic-authoring or Phase 5b authoring task; if neither, ASK FIRST.
- Cookie banner library detectors (OneTrust/Cookiebot/TrustArc) selectors are stable within the 6-month MVP horizon; selector drift remediation is reactive post-pilot.
- `viewports.length > 2` deferred indefinitely — schema rejects values outside `("desktop" | "mobile")`.
- Trigger candidate discovery (T5B-015) requires ElementGraph from Phase 1c. If Phase 1c slips, T5B-015 falls back to ax_tree-only candidate discovery.

---

## Next Steps

After approval (`status: draft → validated → approved`):

1. Run `/speckit.plan` (already drafted alongside this spec).
2. Run `/speckit.tasks` (T5B-001..T5B-019 mirrored from `tasks-v2.md`).
3. Run `/speckit.analyze` for cross-artifact consistency.
4. Phase 5b implementation begins after Phase 5 + Phase 1b + Phase 1c rollups are approved.

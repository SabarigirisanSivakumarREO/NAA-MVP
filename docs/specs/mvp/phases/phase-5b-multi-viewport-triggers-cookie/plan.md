---
title: Phase 5b — Multi-Viewport + Triggers + Cookie — Implementation Plan
artifact_type: plan
status: draft
version: 0.2
created: 2026-04-28
updated: 2026-05-17
owner: engineering lead
authors: [Claude (drafter), Claude (master orchestrator Pass 1 patch wave 2026-05-17)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/spec.md
  - docs/specs/mvp/tasks-v2.md (T5B-001..T5B-019)
  - docs/specs/final-architecture/07-analyze-mode.md §7.9.2
  - docs/specs/final-architecture/18-trigger-gateway.md
  - docs/specs/final-architecture/20-state-exploration.md
  - docs/Improvement/perception_layer_spec.md §3.1, §4.1, §4.4
  - docs/specs/mvp/phases/phase-4b-context-capture/phase-4b-current.md (T4B-009 AuditRequest canonical path `src/types/audit-request.ts`)
  - docs/specs/mvp/phases/phase-1b-perception-extensions/phase-1b-current.md (popups[] Zod ships at `src/perception/types.ts:484-486` as `z.null()` — Phase 5b widens to `z.boolean().nullable()`)
  - docs/specs/mvp/phases/phase-1c-perception-bundle/phase-1c-current.md (settle predicate)

req_ids:
  - REQ-ANALYZE-PERCEPTION-V24-001
  - REQ-GATEWAY-AUDITREQ-VIEWPORTS-001
  - REQ-GATEWAY-AUDITREQ-COOKIE-001
  - REQ-STATE-EXPL-TRIGGER-002..006
  - REQ-SAFETY-005

impact_analysis: docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/impact.md
breaking: false
affected_contracts:
  - AuditRequest (extended at `src/types/audit-request.ts` — Phase 4b T4B-009 canonical path; migrates to `src/gateway/AuditRequest.ts` when Phase 6 lands)
  - AnalyzePerception popups[] (Zod schema widened from `z.null()` → `z.boolean().nullable()` BEFORE behavior mutation; R20 cross-phase to Phase 1b)
  - PerceptionBundle (per-viewport bundles)
  - HeuristicLoader manifest (Phase 0b lint-only convention; Zod loader Phase 6 deliverable)

delta:
  new:
    - Phase 5b plan — sequencing across multi-viewport (T5B-001..009) + triggers (T5B-010..015) + cookie (T5B-016..018) + integration (T5B-019)
  changed:
    - v0.1 → v0.2 (Pass 1 patch wave 2026-05-17 — 11 plan patches per .phase-state/5b/preflight-verdict.yaml acts 001/002/003/004/007/009/011/012/013/017/018/020/022 + R18 delta block + frontmatter update)
    - §1 sequencing — T5B-008 reframed as lint-only-conformance via Phase 0b heuristic-lint.test.ts (Phase 6 HeuristicSchema dep removed)
    - §2.1 file layout — `src/browser/` → `src/browser-runtime/`; `src/gateway/AuditRequest.ts` → `src/types/audit-request.ts` (extend Phase 4b T4B-009)
    - §2.1 heuristics — `heuristics-repo/multi-viewport.json` → `heuristics-repo/multi-viewport/MULTIVIEW-<scope>-<NNN>.json` (5 files, Phase 0b convention)
    - §2.2 viewport presets — added MVP iPhone 11 justification (iOS-skewed D2C pilot scope); Android v1.1 deferred per spec Out-of-Scope
    - §2.4 popup state-equality — defined via Phase 1c settle predicate + content-hash on `<body>` subtree (DOM, scroll-Y, formStates)
    - §2.5 dark-pattern flag taxonomy — added `weighted_default` (pre-checked CMP consent input)
    - §2.6 cookie library detection — 7 libraries (added Quantcast Choice + Didomi + Iubenda); Generic relaxed (cookie|consent|privacy|preferences regex + >5% fold)
    - §2.7 R26 enforcement — FormInputTrigger exclusion list expanded to 6 categories
    - §3 risk register — cost-cap split per NF-01a/b/c; storage assertion row added
    - §4 effort table — unified 28h±3 (dropped "30h±4" inconsistency in summary)
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R10 (Budget)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R20 (Impact Analysis)
  - Constitution R23 (Kill Criteria)
  - Constitution R24 (Perception MUST NOT)
  - Constitution R26 (State Exploration MUST NOT)
---

# Phase 5b Implementation Plan

> **Summary (~120 tokens):** 19 tasks across 4 work-streams. Multi-viewport (9 tasks): AuditRequest field → ViewportConfigService → MultiViewportOrchestrator → ViewportDiffEngine → popup behavior probes → DarkPatternDetector → heuristics pack (lint-only via Phase 0b) → integration. Trigger taxonomy (6 tasks): 5 new triggers + candidate discovery. Cookie policy (3 tasks): detector (7 libraries + Generic) + policy + AuditRequest field. Full integration (1 task): 8-trigger + multi-viewport + both cookie policies. Total ~28h ±3 across 2-3 weeks. Kill criteria: cost overrun (NF-01a/b/c per-feature caps), R26 violation (cross-origin trigger / destructive form submit), cookie detection precision <90%.

---

## 1. Sequencing

```
Week 8 — Multi-viewport (T5B-001..T5B-009):
  Day 1: T5B-PRE-001 popups[] Zod schema WIDEN (R20 — perception/types.ts:484-486 z.null() → z.boolean().nullable())
         T5B-001 AuditRequest.viewports field (extend src/types/audit-request.ts)
         T5B-002 ViewportConfigService
  Day 2: T5B-003 MultiViewportOrchestrator (sequential, no parallel contexts)
         T5B-004 ViewportDiffEngine
  Day 3: T5B-005 PopupBehaviorProbe
         T5B-006 PopupDismissibilityTester
  Day 4: T5B-007 DarkPatternDetector (5 flags incl. weighted_default)
         T5B-008 Multi-viewport heuristics pack (5 files; lint-only via Phase 0b heuristic-lint.test.ts — Zod Phase 6 deferred)
  Day 5: T5B-009 Multi-viewport integration test (exit gate for first sub-stream)

Week 9 — Trigger taxonomy (T5B-010..T5B-015):
  Day 1: T5B-010 HoverTrigger
         T5B-011 ScrollPositionTrigger
  Day 2: T5B-012 TimeDelayTrigger
         T5B-013 ExitIntentTrigger
  Day 3: T5B-014 FormInputTrigger (R26 cc-*/password skip)
         T5B-015 TriggerCandidateDiscovery (depends on Phase 1c ElementGraph)

Week 10 — Cookie policy + full integration:
  Day 1: T5B-016 CookieBannerDetector (OneTrust/Cookiebot/TrustArc + generic)
         T5B-018 AuditRequest.cookie_policy field
  Day 2: T5B-017 CookieBannerPolicy
  Day 3-4: T5B-019 Full integration test (8 triggers + 2 viewports + 2 cookie policies)
  Day 5: phase-5b-current.md rollup + PR Contract
```

Dependencies (from tasks-v2.md):
- Multi-viewport stream: T5B-001 → T5B-002 → T5B-003 → T5B-004; T5B-005 ← T1B-004 (PopupPresenceDetector); T5B-006 ← T1B-004; T5B-007 ← T5B-005 + T5B-006; T5B-008 ← T101 (HeuristicSchema); T5B-009 ← T5B-001..T5B-008.
- Trigger stream: T5B-010..T5B-014 ← T091 (BrowseGraph); T5B-015 ← T5B-010..T5B-014 + T1C-007 (ElementGraph from Phase 1c).
- Cookie stream: T5B-016 ← T091; T5B-017 ← T5B-016 + T5B-018; T5B-018 ← T5B-001.
- Final: T5B-019 ← T5B-001..T5B-018.

**Phase 5b prerequisites:** Phase 5 (T081-T100) + Phase 1b (T1B-001..T1B-012) + Phase 1c (T1C-001..T1C-012) ship and rollups approved.

---

## 2. Architecture

### 2.1 File layout

```
packages/agent-core/src/types/
└── audit-request.ts                                   # T5B-001 + T5B-018 — extend Phase 4b T4B-009 canonical Zod schema with viewports + cookie_policy (full src/gateway/AuditRequest.ts envelope is Phase 6 deliverable per file header L21; until then, viewports + cookie_policy are top-level AuditRequest fields alongside Phase 4b intake)

packages/agent-core/src/perception/
└── types.ts                                           # T5B-PRE-001 — WIDEN popups[].isEscapeDismissible + isClickOutsideDismissible Zod from z.null() to z.boolean().nullable() (R20 cross-phase to Phase 1b T1B-004; non-breaking: null still accepted)

packages/agent-core/src/orchestration/
├── ViewportConfigService.ts                           # T5B-002
├── MultiViewportOrchestrator.ts                       # T5B-003
└── nodes/                                              # existing

packages/agent-core/src/analysis/
├── ViewportDiffEngine.ts                              # T5B-004
└── DarkPatternDetector.ts                             # T5B-007

packages/agent-core/src/browser-runtime/
├── PopupBehaviorProbe.ts                              # T5B-005
├── PopupDismissibilityTester.ts                       # T5B-006
├── CookieBannerDetector.ts                            # T5B-016
├── CookieBannerPolicy.ts                              # T5B-017
└── triggers/                                          # T5B-010..T5B-014
    ├── HoverTrigger.ts
    ├── ScrollPositionTrigger.ts
    ├── TimeDelayTrigger.ts
    ├── ExitIntentTrigger.ts
    ├── FormInputTrigger.ts
    └── TriggerCandidateDiscovery.ts                   # T5B-015

heuristics-repo/multi-viewport/                        # T5B-008 — 5 files matching Phase 0b nielsen/baymard/cialdini per-heuristic convention; validated by apps/cli/tests/conformance/heuristic-lint.test.ts (Phase 0b lint-only — Zod schema validation gated to Phase 6)
├── MULTIVIEW-CTA-001.json                             # "Primary CTA hidden below fold on mobile"
├── MULTIVIEW-CTA-002.json                             # "Sticky CTA covers >40% viewport on mobile"
├── MULTIVIEW-FORM-001.json                            # "Form layout breaks on mobile"
├── MULTIVIEW-TRUST-001.json                           # "Trust signals not surfaced on mobile fold"
└── MULTIVIEW-PRICING-001.json                         # "Pricing display truncated on mobile"

packages/agent-core/tests/integration/
├── multi-viewport.test.ts                             # T5B-009
└── phase5b-full.test.ts                               # T5B-019
```

### 2.2 Viewport presets (T5B-002)

```ts
const VIEWPORT_PRESETS = {
  desktop: { width: 1440, height: 900, device_type: "desktop" },
  mobile: { width: 375, height: 812, device_type: "mobile" },          // iPhone 11 baseline
} as const;
```

Custom viewport sizes are NOT user-configurable in MVP (R10 cost discipline; defer to v1.1).

**MVP iPhone 11 mobile preset justification (act-017 lock):** REO Digital pilot client base is iOS-skewed D2C. iPhone 11 (375×812) is chosen because (a) it represents the median iPhone display dimensions across the 6/SE/11/12/13 generation, and (b) Safari is the dominant rendering engine on the iOS-skewed pilot client base. Android baseline (Pixel 5 393×851) deferred to v1.1 per spec.md Out of Scope §; T5B-002 + T5B-008 mobile heuristics will accept the broader Android width range when added (v1.1 task `multi-mobile-preset`). For now, T5B-002 preset is locked to iPhone 11; T5B-008 multi-viewport heuristics that reference viewport-width assertions MUST use `viewport.device_type === "mobile"` rather than hardcoded pixel widths to remain forward-compatible.

### 2.3 ViewportDiffEngine (T5B-004)

Diffs the two PerceptionBundles by element_id (recall: element_id is per-viewport per §07.7.9.3 stability rules — same DOM at different viewports may produce different IDs). Strategy: match by selector + role + bbox proximity instead of element_id.

| Diff dimension | Computation |
|---|---|
| Fold composition | Set diff of `in_fold` elements between viewports |
| CTA visibility | For each `ctas[]` entry, compare `in_fold` flag across viewports |
| Sticky element | Set diff of `stickyElements[]` between viewports; flag if mobile-only or desktop-only |

`ViewportDiffFinding` output shape:

```ts
{
  finding_id: string,
  type: "viewport_diff",
  desktop_only: ElementRef[],
  mobile_only: ElementRef[],
  cta_visibility_diff: { cta: ElementRef, desktop_in_fold: boolean, mobile_in_fold: boolean }[],
  severity: "info" | "warn" | "high"           // computed by heuristic — Phase 5b emits the data, heuristic decides severity
}
```

### 2.4 PopupBehaviorProbe (T5B-005) + DismissibilityTester (T5B-006)

Phase 5b mutates Phase 1b's popups[] array in place. Per-popup workflow:

```ts
// 1. Probe trigger
const triggerType = await detectPopupTrigger(popup);     // load / time / scroll / exit_intent
const timing = await measurePopupTiming(popup);

// 2. Test dismissibility
const beforeState = await capturePageSnapshot();
const escDismissible = await testEscape(popup);
const outsideDismissible = await testClickOutside(popup);
await restorePageSnapshot(beforeState);                  // restore — must be reliable

// 3. Mutate popup record in place
popup.triggerType = triggerType;
popup.timingMs = timing;
popup.isEscapeDismissible = escDismissible;
popup.isClickOutsideDismissible = outsideDismissible;
```

State restoration is reliability-critical — failure to restore corrupts subsequent perception. T5B-006 conformance test must verify state restoration via Phase 1c **settle predicate** (already shipped) AND **content-hash equality** on `<body>` subtree DOM + `window.scrollY` + form input values (excludes script-timer / animation-frame fields that drift without behavior impact). Equality formula: `sha256(snapshot.dom_outerHTML + scrollY + JSON.stringify(formStates))` BEFORE === AFTER. Failure = restoration broken = STOP per kill criteria.

### 2.5 DarkPatternDetector (T5B-007) flag taxonomy

| Flag | Detection rule |
|---|---|
| `deceptive_close` | Close button (X) styled with low contrast (<3:1), or styled as decorative graphic, or with weak click target (<24×24px) |
| `forced_action` | Popup blocks fold + has no close button + has no Escape dismissibility |
| `no_close_button` | hasCloseButton === false |
| `hidden_dismiss` | Close button exists but `aria-hidden=true` or `display:none` or offscreen |
| `weighted_default` | Popup or CMP banner contains `input[type=checkbox][checked]` or `input[type=radio][checked]` with consent-related label (regex `/(allow\|accept\|consent\|track\|cookie\|sell)/i` on associated `<label>` text); CRITICAL in cookie banners — flags pre-checked consent dark pattern. **Cookie banners detected by Phase 5b CookieBannerDetector are scanned for this flag automatically.** |

DarkPatternDetector emits `popups[i].dark_pattern_flag` (single tag — first match wins by priority: `weighted_default` > `forced_action` > `deceptive_close` > `hidden_dismiss` > `no_close_button`). Heuristic library decides severity from the tag. Textual dark patterns (confirmshaming / friend-spam / false_urgency) deferred to v1.1 per spec Out of Scope §.

### 2.6 Cookie banner library detection (T5B-016)

| Library | Selector signature |
|---|---|
| OneTrust | `#onetrust-banner-sdk` OR `#onetrust-pc-sdk` OR `[id^="onetrust-"]` |
| Cookiebot | `#CybotCookiebotDialog` OR `[id^="Cybot"]` |
| TrustArc | `#truste-consent-track` OR `iframe[src*="trustarc.com"]` |
| Quantcast Choice | `#qc-cmp2-container` OR `[class^="qc-cmp"]` OR `iframe[id^="cmp"]` |
| Didomi | `#didomi-notice` OR `#didomi-popup` OR `[class*="didomi"]` |
| Iubenda | `#iubenda-cs-banner` OR `[class^="iubenda-cs"]` OR `iframe[src*="iubenda.com"]` |
| Sourcepoint | `iframe[id^="sp_message"]` OR `[class*="sp_message_container"]` (TCF v2 CMP) |
| Generic | Fixed-position element + text matching regex `/(cookie\|consent\|privacy\|preferences)/i` + **>5% fold coverage** (relaxed from 20% per Didomi mobile-strip pattern) + close/accept button |

Generic detector emits the descriptor with `library: "generic"`; CookieBannerPolicy attempts dismiss heuristically (find first button matching `/(accept|allow|got it|ok|agree|continue|i accept|i agree)/i` regex). NF-06 precision target ≥95% on 8-fixture set (7 libraries + 1 generic).

### 2.7 R26 enforcement (R-17 / R-18 / R-12)

| Rule | Enforcement point |
|---|---|
| Per-trigger budget ≤10 candidates per (trigger_type, state, page) | TriggerCandidateDiscovery (T5B-015) caps the priority list per type per page; T5B-015 conformance asserts `candidates.filter(c => c.trigger_type === t).length <= 10` per page |
| No cross-origin trigger | Trigger functions check `element.host === document.host` before firing; emit warning + skip |
| No destructive form submit / PII / credentials | FormInputTrigger excludes **6 field categories** (T5B-014 conformance covers each): (1) `<input type="password">`, (2) `[autocomplete^="cc-"]` credit card, (3) `<input type="hidden">`, (4) `<input type="file">` file upload, (5) `<input name>` matching `/(ssn\|tax\|pin\|nin\|aadhaar\|passport)/i` PII, (6) reCAPTCHA / hCaptcha iframes (`iframe[src*="recaptcha"]`, `iframe[src*="hcaptcha"]`). Cross-origin iframes already excluded by row above. |
| No infinite loop | TriggerCandidateDiscovery dedupes by `(element_id, trigger_type)`; no candidate fires twice in the same state |
| No navigation away | Triggers refuse `<a href>` to different paths; click triggers covered in Phase 5 baseline |

---

## 3. Risks & kill criteria *(R23)*

| Risk | Trigger | Action |
|---|---|---|
| NF-01a multi-viewport $USD cost >2× single-viewport baseline | T5B-009 cost assertion fails (`SUM(llm_call_log.cost_usd WHERE audit_run_id=X) > 2 * baseline_single_viewport_usd`) | KILL: profile per-viewport cost; investigate redundant fetches; ASK FIRST before relaxing 2× target |
| NF-01b 8-triggers per-page $USD >1.5× baseline browse | T5B-015 or T5B-019 cost assertion fails | KILL: reduce per-trigger candidate cap below 10; ASK FIRST before relaxing 1.5× target |
| NF-01c cookie policy per-page $USD >1.05× baseline browse | T5B-017 or T5B-019 cost assertion fails | KILL: investigate dismissal retry loop; ASK FIRST before relaxing 1.05× target |
| Storage doubling under universal multi-viewport (>1.3GB/day) | T5B-009 storage assertion fails (per-snapshot bytes × 2 viewports > Phase 0 budget) | Defer to Phase 9 dedup-by-content-hash OR scope multi-viewport opt-in to high-value clients; ASK FIRST |
| Popup state restoration fails on test fixtures | T5B-006 before/after equality assertion fails | KILL: do NOT skip state restoration. Investigate root cause (likely localStorage, sessionStorage, or document.body class drift). Phase 5b cannot ship without reliable restore. |
| ExitIntentTrigger fires false positives on mobile | T5B-013 conformance test detects fire on mobile | Tighten — exit intent only fires when viewport.height matches desktop preset; explicit no-op assertion in test |
| FormInputTrigger destructively submits / leaks credentials / leaks PII / triggers captcha | R26 violation; AC-14 fails on any of 6 exclusion categories | KILL — security-critical. All 6 exclusions (password / cc-* / hidden / file / PII regex / captcha iframes) are mandatory; no relaxation. T5B-014 conformance per-category |
| ScrollPositionTrigger triggers infinite scroll | TimeDelayTrigger fires with <10s; new states keep appearing | Cap states-per-trigger at 5; TriggerCandidateDiscovery dedupes |
| Cookie banner detection precision <90% | T5B-016 conformance test fails | Expand library signatures; ASK FIRST before relaxing; add manual selector overrides for stubborn sites |
| HoverTrigger fires on touch device | AC-10 conformance fails on mobile fixture | Skip silently when viewport.device_type === "mobile" |
| TimeDelayTrigger budget exhaustion | Single-page audit takes >60s in multi-viewport mode | Reduce default 5s → 3s; cap runtime per audit |
| ViewportDiffEngine produces noisy diffs (every responsive page diffs) | Heuristic library can't filter | Tier diffs: only fold-change + CTA-visibility-change + sticky-change emit findings; minor positional diffs (10px) suppressed |
| DarkPatternDetector false-positives on legitimate close UI | AC-07 fails twice | Tighten contrast threshold; expand `decorative graphic` definition; ASK FIRST before disabling detector |
| AuditRequest schema drift | T5B-001 + T5B-018 conflict with Phase 4b T4B-009 | Coordinate; T5B-001 + T5B-018 land AFTER T4B-009; same Zod schema file extended |

---

## 4. Effort estimate

| Task | Effort | Notes |
|---|---|---|
| T5B-001 AuditRequest.viewports | 0.5h | Zod field + default + reject unknown |
| T5B-002 ViewportConfigService | 0.5h | Preset map + getter |
| T5B-003 MultiViewportOrchestrator | 2.0h | Sequential per-viewport perception + correlation_id |
| T5B-004 ViewportDiffEngine | 2.0h | Diff algorithms + ViewportDiffFinding shape |
| T5B-005 PopupBehaviorProbe | 1.5h | Trigger detection + timing |
| T5B-006 PopupDismissibilityTester | 2.0h | Escape + click-outside + state restoration (reliability-critical) |
| T5B-007 DarkPatternDetector | 1.5h | 4-flag taxonomy + detection rules |
| T5B-008 Multi-viewport heuristics pack | 1.5h | 5 heuristics × ~30 lines JSON + Zod validation |
| T5B-009 Multi-viewport integration test | 1.5h | 1 audit × 2 viewports + cost assertion |
| T5B-010 HoverTrigger | 1.0h | mouseenter + dwell + tooltip detection |
| T5B-011 ScrollPositionTrigger | 1.5h | IntersectionObserver pattern + sticky scan |
| T5B-012 TimeDelayTrigger | 0.5h | setTimeout + DOM diff |
| T5B-013 ExitIntentTrigger | 1.5h | mouseleave detection + mobile no-op |
| T5B-014 FormInputTrigger | 2.0h | type/select + cc-*/password skip + variant capture |
| T5B-015 TriggerCandidateDiscovery | 1.5h | Priority ordering + dedup + R26 budget |
| T5B-016 CookieBannerDetector | 2.0h | 3 libraries + generic detector |
| T5B-017 CookieBannerPolicy | 1.0h | dismiss/preserve + warning emission |
| T5B-018 AuditRequest.cookie_policy | 0.5h | Zod field + reject `block` |
| T5B-019 Full integration test | 3.5h | 8 triggers × 2 viewports × 2 cookie policies |
| T5B-PRE-001 popups[] Zod widen (R20) | 0.5h | `z.null()` → `z.boolean().nullable()` at perception/types.ts:484-486; non-breaking; widens before T5B-005/006 mutate |
| **Total** | **28.5h ± 3** | Single engineer (was 28h; +0.5h for T5B-PRE-001 R20 widening) |

Tasks above 2.0h: T5B-006 (2.0h), T5B-014 (2.0h), T5B-019 (3.5h). All have explicit kill criteria above per R23.

---

## 5. Verification

- **Per-task:** conformance tests pass on dedicated fixtures.
- **Per-stream:** T5B-009 (multi-viewport) + T5B-019 (full) integration tests pass.
- **R26 compliance:** explicit conformance assertions in T5B-014 (cc-*/password skip), T5B-013 (mobile no-op), T5B-015 (per-trigger budget), TriggerCandidateDiscovery (no infinite loop).
- **Cost:** T5B-019 multi-viewport + 8 triggers + cookie audit cost ≤2× single-viewport baseline (NF-01).
- **State restoration:** T5B-006 before/after AnalyzePerception equality assertion.
- **Backward compat:** Phase 5 (T100) integration test re-runs unchanged with default AuditRequest (no viewports/cookie_policy opts).

---

## 6. Out of scope for this plan

- Tablet / smartwatch / TV viewports — desktop + mobile only.
- Parallel viewport execution — sequential only.
- Custom viewport sizes — fixed presets in MVP.
- Form submission as a trigger — permanent non-goal (R26).
- Cookie banner reject flow — accept only in MVP.
- Auth-walled triggers — permanent non-goal.

---

## Delta Log

### v0.1 → v0.2 — 2026-05-17 (Pass 1 patch wave per review-notes.md)

Applied actions: act-001, act-002, act-003, act-004, act-007, act-009, act-010, act-011, act-012, act-013, act-014, act-017, act-018, act-020, act-022.

- act-001 — File layout §2.1: `src/browser/` → `src/browser-runtime/` (all popup probes, triggers, cookie modules).
- act-002 — §2.1: AuditRequest extension redirected to `src/types/audit-request.ts` (Phase 4b T4B-009 canonical path); `src/gateway/AuditRequest.ts` is Phase 6 envelope deliverable.
- act-003 — §2.1 heuristics: monolithic `multi-viewport.json` → 5 per-heuristic files under `heuristics-repo/multi-viewport/MULTIVIEW-<scope>-<NNN>.json` matching Phase 0b convention.
- act-004 — **USER DECISION (b) lint-only-conformance**: T5B-008 reframed; phase ships 19 tasks; 5 JSON files validated by Phase 0b `apps/cli/tests/conformance/heuristic-lint.test.ts`; Zod-schema validation gated to Phase 6; T5B-008 Phase 6 dep removed.
- act-007 — §3 risk register cost-cap rows cite `llm_call_log.cost_usd` SUM unit.
- act-009 — §3 cost-cap row split per NF-01a/b/c.
- act-010 — Storage ceiling assertion ADDED to T5B-009 (per-snapshot bytes × 2 viewports ≤ Phase 0 budget); avoids Phase 9 defer (cheaper to assert in same integration test).
- act-011 — §2.7 R26 enforcement: budget ≤10 per (trigger_type, state, page) explicit.
- act-012 — §2.4 popup state-equality formula: `sha256(snapshot.dom_outerHTML + scrollY + JSON.stringify(formStates))` gated by Phase 1c settle predicate.
- act-013 — §4 effort unified to **28h ± 3** (was "30h ± 4" in summary inconsistency; aligned with README + per-task sum 28.5h).
- act-014 — frontmatter `updated: 2026-05-17`, version `0.1 → 0.2`, delta block appended (R18).
- act-017 — §2.2 iPhone 11 mobile preset justified (iOS-skewed D2C pilot scope); Android Pixel 5 deferred v1.1 per spec Out of Scope; heuristics must use `viewport.device_type === "mobile"` not pixel widths (forward-compat).
- act-018 — §2.6 cookie library table expanded to 7 (Quantcast Choice / Didomi / Iubenda / Sourcepoint added); Generic relaxed to >5% fold + regex `/(cookie|consent|privacy|preferences)/i`.
- act-020 — §2.5 DarkPatternDetector flag taxonomy adds `weighted_default` (priority highest among 5 flags).
- act-022 — §2.7 FormInputTrigger exclusion list expanded to 6 categories (added file / PII regex / captcha; cc-* / password / hidden already present; cross-origin via R-18).


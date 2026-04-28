---
title: Phase 5b — Multi-Viewport + Triggers + Cookie — Implementation Plan
artifact_type: plan
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
  - docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/spec.md
  - docs/specs/mvp/tasks-v2.md (T5B-001..T5B-019)
  - docs/specs/final-architecture/07-analyze-mode.md §7.9.2
  - docs/specs/final-architecture/18-trigger-gateway.md
  - docs/specs/final-architecture/20-state-exploration.md
  - docs/Improvement/perception_layer_spec.md §3.1, §4.1, §4.4

req_ids:
  - REQ-ANALYZE-PERCEPTION-V24-001
  - REQ-GATEWAY-AUDITREQ-VIEWPORTS-001
  - REQ-GATEWAY-AUDITREQ-COOKIE-001
  - REQ-STATE-EXPL-TRIGGER-002..006
  - REQ-SAFETY-005

impact_analysis: docs/specs/mvp/phases/phase-5b-multi-viewport-triggers-cookie/impact.md
breaking: false
affected_contracts:
  - AuditRequest (extended)
  - AnalyzePerception popups[] (behavior fields populated)
  - PerceptionBundle (per-viewport bundles)
  - HeuristicLoader manifest (multi-viewport heuristics)

delta:
  new:
    - Phase 5b plan — sequencing across multi-viewport (T5B-001..009) + triggers (T5B-010..015) + cookie (T5B-016..018) + integration (T5B-019)
  changed: []
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

> **Summary (~120 tokens):** 19 tasks across 4 work-streams. Multi-viewport (9 tasks): AuditRequest field → ViewportConfigService → MultiViewportOrchestrator → ViewportDiffEngine → popup behavior probes → DarkPatternDetector → heuristics pack → integration. Trigger taxonomy (6 tasks): 5 new triggers + candidate discovery. Cookie policy (3 tasks): detector + policy + AuditRequest field. Full integration (1 task): 8-trigger + multi-viewport + both cookie policies. Total ~30h ±4 across 2-3 weeks. Kill criteria: cost overrun (>2× single-viewport), R26 violation (cross-origin trigger / destructive form submit), cookie detection precision <90%.

---

## 1. Sequencing

```
Week 8 — Multi-viewport (T5B-001..T5B-009):
  Day 1: T5B-001 AuditRequest.viewports field
         T5B-002 ViewportConfigService
  Day 2: T5B-003 MultiViewportOrchestrator (sequential, no parallel contexts)
         T5B-004 ViewportDiffEngine
  Day 3: T5B-005 PopupBehaviorProbe
         T5B-006 PopupDismissibilityTester
  Day 4: T5B-007 DarkPatternDetector
         T5B-008 Multi-viewport heuristics pack (5 heuristics)
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
packages/agent-core/src/gateway/
└── AuditRequest.ts                                    # T5B-001 + T5B-018 — extend Zod with viewports + cookie_policy

packages/agent-core/src/orchestration/
├── ViewportConfigService.ts                           # T5B-002
├── MultiViewportOrchestrator.ts                       # T5B-003
└── nodes/                                              # existing

packages/agent-core/src/analysis/
├── ViewportDiffEngine.ts                              # T5B-004
└── DarkPatternDetector.ts                             # T5B-007

packages/agent-core/src/browser/
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

heuristics-repo/
└── multi-viewport.json                                # T5B-008

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

State restoration is reliability-critical — failure to restore corrupts subsequent perception. T5B-006 conformance test must verify state restoration via `before/after` AnalyzePerception equality.

### 2.5 DarkPatternDetector (T5B-007) flag taxonomy

| Flag | Detection rule |
|---|---|
| `deceptive_close` | Close button (X) styled with low contrast (<3:1), or styled as decorative graphic, or with weak click target (<24×24px) |
| `forced_action` | Popup blocks fold + has no close button + has no Escape dismissibility |
| `no_close_button` | hasCloseButton === false |
| `hidden_dismiss` | Close button exists but `aria-hidden=true` or `display:none` or offscreen |

DarkPatternDetector emits `popups[i].dark_pattern_flag` (single tag — first match wins by priority). Heuristic library decides severity from the tag.

### 2.6 Cookie banner library detection (T5B-016)

| Library | Selector signature |
|---|---|
| OneTrust | `#onetrust-banner-sdk` OR `#onetrust-pc-sdk` OR `[id^="onetrust-"]` |
| Cookiebot | `#CybotCookiebotDialog` OR `[id^="Cybot"]` |
| TrustArc | `#truste-consent-track` OR `iframe[src*="trustarc.com"]` |
| Generic | Fixed-position element + "cookie" in text + >20% fold coverage + close/accept button |

Generic detector emits the descriptor with `library: "generic"`; CookieBannerPolicy attempts dismiss heuristically (find first button matching `Accept|Allow|Got it|OK` regex).

### 2.7 R26 enforcement (R-17 / R-18 / R-12)

| Rule | Enforcement point |
|---|---|
| Per-trigger budget ≤10 candidates per type per state | TriggerCandidateDiscovery (T5B-015) caps the priority list per type |
| No cross-origin trigger | Trigger functions check `element.host === document.host` before firing; emit warning + skip |
| No destructive form submit | FormInputTrigger excludes `<input type="password">`, `[autocomplete^="cc-"]`, `<input type="hidden">`; conformance test (T5B-014) covers each |
| No infinite loop | TriggerCandidateDiscovery dedupes by `(element_id, trigger_type)`; no candidate fires twice in the same state |
| No navigation away | Triggers refuse `<a href>` to different paths; click triggers covered in Phase 5 baseline |

---

## 3. Risks & kill criteria *(R23)*

| Risk | Trigger | Action |
|---|---|---|
| Multi-viewport cost >2× single-viewport baseline | T5B-009 cost assertion fails | KILL: profile per-viewport cost; investigate redundant fetches; ASK FIRST before relaxing 2× target |
| Popup state restoration fails on test fixtures | T5B-006 before/after equality assertion fails | KILL: do NOT skip state restoration. Investigate root cause (likely localStorage, sessionStorage, or document.body class drift). Phase 5b cannot ship without reliable restore. |
| ExitIntentTrigger fires false positives on mobile | T5B-013 conformance test detects fire on mobile | Tighten — exit intent only fires when viewport.height matches desktop preset; explicit no-op assertion in test |
| FormInputTrigger destructively submits | R26 violation; AC-14 fails | KILL — security-critical. cc-* + password skip is mandatory; no relaxation |
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
| **Total** | **28.0h ± 3** | Single engineer |

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

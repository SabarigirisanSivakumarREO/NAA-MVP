---
title: Phase 5b — Impact Analysis
artifact_type: impact
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
  - docs/specs/mvp/constitution.md (R20 — Impact Analysis Before Cross-Cutting Changes)
  - docs/specs/final-architecture/07-analyze-mode.md §7.9.2
  - docs/specs/final-architecture/18-trigger-gateway.md
  - docs/specs/final-architecture/20-state-exploration.md

req_ids:
  - REQ-ANALYZE-PERCEPTION-V24-001
  - REQ-GATEWAY-AUDITREQ-VIEWPORTS-001
  - REQ-GATEWAY-AUDITREQ-COOKIE-001
  - REQ-STATE-EXPL-TRIGGER-002..006

breaking: false
affected_contracts:
  - AuditRequest (extended with viewports + cookie_policy fields)
  - AnalyzePerception popups[] (behavior fields populated, formerly null)
  - PerceptionBundle (per-viewport bundles when multi-viewport)
  - HeuristicLoader manifest (multi-viewport heuristics added)
  - BrowseGraph (extended with 5 new trigger types)

delta:
  new:
    - Phase 5b impact analysis — required by R20 (multiple shared contracts modified)
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes)
  - Constitution R18 (Delta-Based Updates)
  - Constitution R26 (State Exploration MUST NOT)
---

# Phase 5b Impact Analysis

> **Why this file exists:** Constitution R20. Phase 5b extends `AuditRequest` (viewports + cookie_policy), mutates `AnalyzePerception` popups[] behavior fields (Phase 1b emitted them null), produces multiple PerceptionBundles when multi-viewport, extends BrowseGraph with 5 trigger types, and adds multi-viewport heuristics. Five+ shared-contract surfaces means an explicit per-consumer audit is required.

---

## 1. Contract changes

| Contract | Before | After | Breaking? |
|---|---|---|---|
| AuditRequest | (existing) | Adds `viewports: ("desktop"|"mobile")[]` (default `["desktop"]`) + `cookie_policy: "dismiss"|"preserve"` (default `"dismiss"`) | **No** — both have safe defaults |
| AnalyzePerception popups[] behavior fields | `isEscapeDismissible: null`, `isClickOutsideDismissible: null`, `triggerType: undefined`, `dark_pattern_flag: undefined` | Populated in place by Phase 5b | **No** — Phase 1b emitted these as `null`/optional; Phase 5b fills them |
| PerceptionBundle | One bundle per audit page | Multiple bundles per audit page when `viewports.length > 1` | **No** — single-viewport audits unchanged; multi-viewport is opt-in |
| BrowseGraph | Click trigger only | Eight triggers (click + hover + scroll + time + exit_intent + form_input + tab + accordion) | **No** — additive; existing click-only flow unchanged |
| HeuristicLoader manifest | (existing heuristics) | Adds 5 multi-viewport heuristics | **No** — additive |

---

## 2. Producers affected

| Producer | File | Change required | Owner |
|---|---|---|---|
| AuditRequest schema | `packages/agent-core/src/gateway/AuditRequest.ts` | Extend Zod with viewports + cookie_policy | Phase 5b T5B-001 + T5B-018 |
| ViewportConfigService | `packages/agent-core/src/orchestration/ViewportConfigService.ts` | NEW | Phase 5b T5B-002 |
| MultiViewportOrchestrator | `packages/agent-core/src/orchestration/MultiViewportOrchestrator.ts` | NEW | Phase 5b T5B-003 |
| ViewportDiffEngine + DarkPatternDetector | `packages/agent-core/src/analysis/{ViewportDiffEngine,DarkPatternDetector}.ts` | NEW | Phase 5b T5B-004, T5B-007 |
| Popup behavior probes | `packages/agent-core/src/browser/{PopupBehaviorProbe,PopupDismissibilityTester}.ts` | NEW (mutate Phase 1b output in place) | Phase 5b T5B-005, T5B-006 |
| Trigger taxonomy | `packages/agent-core/src/browser/triggers/{HoverTrigger,ScrollPositionTrigger,TimeDelayTrigger,ExitIntentTrigger,FormInputTrigger,TriggerCandidateDiscovery}.ts` | NEW | Phase 5b T5B-010..T5B-015 |
| Cookie banner | `packages/agent-core/src/browser/{CookieBannerDetector,CookieBannerPolicy}.ts` | NEW | Phase 5b T5B-016..T5B-017 |
| Multi-viewport heuristics | `heuristics-repo/multi-viewport.json` | NEW (5 heuristics) | Phase 5b T5B-008 (or Phase 0b heuristic-authoring) |
| Phase 5b integration tests | `packages/agent-core/tests/integration/{multi-viewport,phase5b-full}.test.ts` | NEW | Phase 5b T5B-009, T5B-019 |

---

## 3. Consumers affected (per R20 audit)

| Consumer | Location | Reads which contract? | Migration required? | Action |
|---|---|---|---|---|
| Phase 5 BrowseGraph | `packages/agent-core/src/orchestration/browse-mode/*` | Reads AuditRequest | **No** — single-viewport default unchanged | None |
| Phase 7 AnalysisGraph | `packages/agent-core/src/analysis/*` | Reads PerceptionBundle | **Maybe** — multi-viewport produces multiple bundles; consumer must iterate per viewport | Phase 7 spec accommodates iteration; default behavior unchanged for single-viewport |
| Phase 7 EvaluateNode | `packages/agent-core/src/analysis/nodes/EvaluateNode.ts` | Reads heuristic set | **No** — heuristic library larger; loadForContext (T4B-013) handles filtering | None |
| Phase 7 grounding rules GR-001..GR-008 | `packages/agent-core/src/analysis/grounding/*` | Reads AnalyzePerception | **No** — additive popup behavior fields don't break existing grounding paths | None |
| Phase 8 Orchestrator + cross-page | `packages/agent-core/src/orchestration/*` | Reads AuditState + PerceptionBundle | **Maybe** — multi-viewport bundles cluster differently; cross-page synthesis needs to handle desktop+mobile pairs | Phase 8 spec acknowledges multi-viewport coordinate; surfaced in Phase 8 integration test |
| Reproducibility snapshot | `packages/agent-core/src/reproducibility/*` | Snapshots PerceptionBundle | **Maybe** — multi-viewport audit snapshots two bundles; storage doubles for multi-viewport | Phase 0 reproducibility extension noted |
| Delivery layer | `packages/agent-core/src/delivery/*`, `apps/dashboard/*` | Surfaces findings | **Maybe** — `ViewportDiffFinding` is a new finding type; dashboard may need rendering | Phase 9 polish (delivery) handles |
| Phase 1b popups[] consumers | (any heuristic referencing popup behavior fields) | Reads `popups[].isEscapeDismissible` etc. | **No** — Phase 1b emitted these as `null`; Phase 5b populates with `boolean`; consumers gracefully read both shapes | None |
| Audit cost tracking | `audit_events` table | Reads cost fields | **No** — multi-viewport audits log proportionally larger cost; no schema change | None |

**Net break risk:**
- AuditRequest defaults preserve existing single-viewport, click-only, dismiss-cookie behavior. No existing caller breaks.
- Multi-viewport produces multiple bundles per page. Phase 7/8 orchestration handles iteration; Phase 5b spec asserts (NF-01) cost ≤2× single-viewport baseline.
- ViewportDiffFinding is a NEW finding type; delivery rendering is a Phase 9 polish concern.

---

## 4. Heuristic engine impact

T5B-008 authors 5 multi-viewport heuristics:

- "Primary CTA hidden below fold on mobile"
- "Sticky CTA covers >40% viewport on mobile"
- "Form layout breaks on mobile"
- "Trust signals not surfaced on mobile fold"
- "Pricing display truncated on mobile"

These augment but do NOT replace existing heuristics. HeuristicLoader returns multi-viewport heuristics whenever `device_priority ∈ {mobile, balanced}` from ContextProfile (Phase 4b filtering integration).

GR-001..GR-008 grounding rules unchanged. New grounding rules (GR-013+) may eventually consume popup behavior fields and ViewportDiffFinding contents — Phase 5b emits the data; rules authored later.

R26 enforcement is wired into TriggerCandidateDiscovery — no heuristic-side enforcement needed.

---

## 5. Cost impact

| Metric | Single-viewport | Multi-viewport (opt-in) | Δ |
|---|---|---|---|
| Phase 5b LLM calls per audit | — | 0 | 0 |
| Browser page loads per audit | N pages × 1 viewport | N pages × 2 viewports | 2× browse cost when multi-viewport |
| Trigger probes per page | 1 (click only) | 8 trigger types × ≤10 candidates each | Per-page browser time +5-15s |
| Net audit $ when multi-viewport ON | baseline | baseline × 2 | 2× browse cost (not 2× total — analysis is one-time) |
| Net audit $ when single-viewport (default) | unchanged | unchanged | 0 |

**Net audit cost impact:** When opt-in, ~2× browse cost. Total audit cost grows by ~30-50% (browse is part of total). NF-01 enforces ≤2× browse baseline; T5B-009 + T5B-019 conformance assert it.

---

## 6. Storage impact

Multi-viewport doubles `reproducibility_snapshots` perception storage when active (one snapshot per viewport per page). At 100-audits/day ceiling × ~6.5K-per-bundle × 2 viewports = ~1.3GB/day if every audit goes multi-viewport — within Phase 0 storage budget.

`audit_events` log entries grow proportionally. Append-only — no migration.

**No DB schema migration required for Phase 5b.**

---

## 7. Reproducibility impact

`reproducibility_snapshot.viewports` field added (or piggybacks on existing structure). Multi-viewport audits replay both viewports sequentially. Same input → same output: per-viewport perception is deterministic given a settled page (Phase 1c settle predicate gates capture).

`element_id` is per-viewport per §07.7.9.3 stability rules — same DOM at different viewports may produce different IDs. ViewportDiffEngine therefore matches by selector + role + bbox proximity, NOT by element_id (plan.md §2.3).

---

## 8. Documentation impact

| Doc | Change |
|---|---|
| `docs/specs/final-architecture/07-analyze-mode.md` §7.9.2 | Already documents multi-viewport + popup behavior. No change. |
| `docs/specs/final-architecture/18-trigger-gateway.md` | REQ-GATEWAY-AUDITREQ-VIEWPORTS-001 + REQ-GATEWAY-AUDITREQ-COOKIE-001 already documented. T5B-001 + T5B-018 implement. |
| `docs/specs/final-architecture/20-state-exploration.md` | Trigger taxonomy already documented. T5B-010..T5B-015 implement. |
| `docs/specs/mvp/PRD.md` | F-008 (multi-viewport audit) referenced. Cookie policy added in next PRD bump. |
| `docs/specs/mvp/phases/INDEX.md` | Add Phase 5b row (handled by INDEX regeneration). |
| `docs/specs/mvp/phases/phase-5-browse-mvp/phase-5-current.md` | Phase 5 rollup notes Phase 5b as opt-in successor. |
| `docs/specs/final-architecture/06-browse-mode.md` | BrowseGraph extension documented in v2.5 already; Phase 5b implements. |

---

## 9. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Multi-viewport cost >2× baseline | Medium | High | Plan §3 — profile per-viewport; ASK FIRST before relaxing 2× target |
| Popup state restoration fails | Low | High (corrupts subsequent perception) | Plan §3 — STOP on restoration failure; conformance asserts before/after equality |
| ExitIntent fires on mobile | Low | Low | Explicit no-op assertion in T5B-013 |
| FormInputTrigger destructive submission | Low | High (security) | R26 mandatory cc-*/password skip; conformance test |
| ScrollPositionTrigger infinite states | Low | Medium | TriggerCandidateDiscovery dedup + per-trigger budget |
| Cookie detection precision <90% | Medium | Medium | Plan §3 — expand library signatures; manual selector overrides |
| HoverTrigger fires on touch | Low | Low | viewport.device_type === "mobile" guard |
| ViewportDiffEngine noisy | Medium | Medium | Tier diffs — only fold/CTA/sticky changes emit; minor positional diffs suppressed |
| DarkPatternDetector false positives | Medium | Medium | Tighten contrast threshold; ASK FIRST before disabling |
| AuditRequest schema collision with Phase 4b T4B-009 | Low | High | T5B-001 + T5B-018 land AFTER T4B-009; same Zod schema file |
| Phase 7 EvaluateNode multi-bundle iteration drift | Low | Medium | Phase 7 spec must accommodate; surfaced in Phase 7 integration test |
| Storage doubling under universal multi-viewport adoption | Low | Low | Phase 0 budget already accommodates; track in audit_events |

---

## 10. Sign-off requirements

Per R20:

- [x] This impact.md exists (R20 hard requirement)
- [ ] Engineering lead sign-off on backward-compat audit (§3 above)
- [ ] Phase 5 + Phase 1b + Phase 1c rollups approved before Phase 5b implementation begins
- [ ] Phase 7 owner agrees to multi-bundle iteration semantics
- [ ] Phase 8 owner agrees to multi-viewport cross-page synthesis (desktop+mobile pairs)
- [ ] Phase 9 (delivery) tracks ViewportDiffFinding rendering as polish task
- [ ] Multi-viewport heuristic authoring (T5B-008 or Phase 0b) scheduled
- [ ] Cookie banner library fixture set (OneTrust + Cookiebot + TrustArc + 2 generic) authored
- [ ] State restoration test scaffolding (T5B-006) co-authored with Phase 5 owner

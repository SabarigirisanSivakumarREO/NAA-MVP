---
title: Phase 4b — Context Capture Layer v1.0 — Implementation Plan
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
  - docs/specs/mvp/phases/phase-4b-context-capture/spec.md
  - docs/specs/mvp/tasks-v2.md (T4B-001..T4B-015)
  - docs/specs/final-architecture/37-context-capture-layer.md
  - docs/specs/final-architecture/18-trigger-gateway.md
  - docs/specs/final-architecture/04-orchestration.md
  - docs/specs/final-architecture/13-data-layer.md

req_ids:
  - REQ-CONTEXT-DIM-BUSINESS-001
  - REQ-CONTEXT-DIM-PAGE-001
  - REQ-CONTEXT-DIM-AUDIENCE-001
  - REQ-CONTEXT-DIM-TRAFFIC-001
  - REQ-CONTEXT-DIM-BRAND-001
  - REQ-CONTEXT-OUT-001
  - REQ-CONTEXT-OUT-002
  - REQ-CONTEXT-OUT-003
  - REQ-CONTEXT-FLOW-001
  - REQ-CONTEXT-DOWNSTREAM-001
  - REQ-GATEWAY-INTAKE-001
  - REQ-GATEWAY-INTAKE-002

impact_analysis: docs/specs/mvp/phases/phase-4b-context-capture/impact.md
breaking: false
affected_contracts:
  - ContextProfile (NEW)
  - AuditState (extended)
  - AuditRequest (extended)
  - HeuristicLoader (extended)
  - context_profiles DB table (NEW)

delta:
  new:
    - Phase 4b plan — sequencing, ConfidenceScorer weights, R25 enforcement points, kill criteria
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R10 (Budget)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R20 (Impact Analysis)
  - Constitution R23 (Kill Criteria)
  - Constitution R25 (Context Capture MUST NOT)
---

# Phase 4b Implementation Plan

> **Summary (~120 tokens):** Sequence 15 tasks across week 6-7 (after Phase 4 refresh ships the robots/ToS utility + DB schema baseline). T4B-001..T4B-002 establish schema + URL matching; T4B-003..T4B-006 build inference primitives; T4B-007..T4B-008 close confidence + question generation; T4B-009..T4B-011 wire intake + CLI + orchestration node; T4B-012 lands DB migration; T4B-013 extends HeuristicLoader; T4B-014 enforces R25; T4B-015 is exit gate. Total ~22 hours. Kill criteria: cost overrun (>$0.05/audit), R25 violation, or HtmlFetcher cross-origin blocked >40% of fixtures.

---

## 1. Sequencing

```
Day 1 (foundations):
  T4B-001 ContextProfile Zod schema + provenance fields (foundation for all)
  T4B-002 URLPatternMatcher (30 URLs, ≥95% precision)
  T4B-003 HtmlFetcher (undici + cheerio + robots, no Playwright)

Day 2 (inference):
  T4B-004 JsonLdParser
  T4B-005 BusinessArchetypeInferrer
  T4B-006 PageTypeInferrer (consolidates §07 §7.4)

Day 3 (output assembly):
  T4B-007 ConfidenceScorer + ProvenanceAssembler
  T4B-008 OpenQuestionsBuilder

Day 4 (orchestration + persistence):
  T4B-009 AuditRequest intake schema (extend §18)
  T4B-010 CLI clarification prompt
  T4B-011 ContextCaptureNode (audit_setup integration)
  T4B-012 context_profiles table migration

Day 5 (downstream + exit gate):
  T4B-013 HeuristicLoader extension (filter on profile)
  T4B-014 Constitution R25 compliance check
  T4B-015 Phase 4b integration test (5 fixtures including failure modes)
```

Dependencies (from tasks-v2.md):
- T4B-002 ← T4B-001
- T4B-004 ← T4B-003
- T4B-005 ← T4B-001 + T4B-004
- T4B-006 ← T4B-001 + T4B-002 + T4B-004
- T4B-007 ← T4B-001 + T4B-005 + T4B-006
- T4B-008 ← T4B-007
- T4B-009 ← T4B-001
- T4B-010 ← T4B-008
- T4B-011 ← T4B-002..T4B-010 + T135 (AuditState — schedule before Phase 8 task)
- T4B-012 ← T070 (PostgreSQL schema; lives in Phase 4)
- T4B-013 ← T4B-001 + T106 (HeuristicLoader baseline)
- T4B-014 ← T4B-001..T4B-013
- T4B-015 ← T4B-001..T4B-014

**Phase 4 prerequisites:** T070 (PG baseline) + T080 (Drizzle schema) + §11.1.1 robots utility (handled in Phase 4 refresh).

---

## 2. Architecture

### 2.1 File layout

```
packages/agent-core/src/context/
├── ContextProfile.ts                        # T4B-001 — Zod schema, freeze, hash helper
├── URLPatternMatcher.ts                     # T4B-002
├── HtmlFetcher.ts                           # T4B-003 — undici + cheerio; imports robots utility from Phase 4
├── JsonLdParser.ts                          # T4B-004
├── BusinessArchetypeInferrer.ts             # T4B-005
├── PageTypeInferrer.ts                      # T4B-006
├── ConfidenceScorer.ts                      # T4B-007
├── ProvenanceAssembler.ts                   # T4B-007 (sibling)
├── OpenQuestionsBuilder.ts                  # T4B-008
└── (NO Playwright import — R25)

packages/agent-core/src/gateway/
└── AuditRequest.ts                          # T4B-009 (extend existing)

apps/cli/src/
└── contextClarification.ts                  # T4B-010

packages/agent-core/src/orchestration/nodes/
└── ContextCaptureNode.ts                    # T4B-011

packages/agent-core/src/db/
├── migrations/0XX_context_profiles.sql      # T4B-012
└── schema.ts                                # T4B-012 (Drizzle additions)

packages/agent-core/src/analysis/heuristics/
└── HeuristicLoader.ts                       # T4B-013 (extend)

packages/agent-core/tests/constitution/
└── R25.test.ts                              # T4B-014

packages/agent-core/tests/integration/
└── context-capture.test.ts                  # T4B-015
```

### 2.2 ConfidenceScorer weights

`overall_confidence` is a weighted aggregate of dimension confidences:

| Dimension | Weight | Rationale |
|---|---|---|
| `business.archetype` | 0.35 | Highest leverage — heuristic library keyed here |
| `page.type` | 0.25 | Next-highest leverage — heuristic filter |
| `traffic.device_priority` | 0.15 | Filters mobile-vs-desktop heuristics |
| `business.aov_tier` | 0.10 | Influences trust-signal heuristics |
| `audience.buyer` | 0.10 | Coarse audience filter |
| `brand.*` | 0.05 | Style / voice — minor in MVP |

`overall_confidence = Σ(weight × dimension.confidence)`. Threshold gates:

- `≥ 0.9` → act (proceed without questions)
- `0.6 - 0.9` → use + flag (proceed with non-blocking warnings)
- `< 0.6` → ask (blocking question via CLI)

Required-field rule (R-09): a REQUIRED field with confidence <0.6 OR missing value triggers blocking REGARDLESS of `overall_confidence`. Required fields in MVP: `business.archetype`, `page.type`, `goal.primary_kpi`. (Goal comes from intake schema, not inference.)

### 2.3 ContextProfile hash function (R-03)

```ts
import { createHash } from "crypto";

function hashProfile(profile: ContextProfile): string {
  const canonical = JSON.stringify(profile, Object.keys(profile).sort());
  return createHash("sha256").update(canonical).digest("hex");
}
```

Canonical-JSON: keys sorted alphabetically at every level. Open-questions ordered by `field_path`. Provenance preserved.

### 2.4 R25 enforcement points

1. **No Playwright import in `context/*`:** static lint rule + `R25.test.ts` AST scan (T4B-014).
2. **No judgment fields in ContextProfile:** schema defines only structural fields; no `severity`, `impact`, `score`, `priority`, `risk_*`, `recommend_*`. Linter regex catches drift.
3. **No silent defaults:** every default value carries `source: "default"` AND `confidence: 0`. Schema requires the source field; default values without `"default"` source fail Zod parse.
4. **No LLM calls:** `R25.test.ts` AST scan ensures no `LLMAdapter` import in `context/*`. (Phase 13b master track relaxes this for archetype/awareness LLM-tagging — Phase 4b strictly forbids.)

### 2.5 HtmlFetcher robots integration

Phase 4 refresh (§11.1.1) ships the robots/ToS utility at `packages/agent-core/src/safety/RobotsChecker.ts`. T4B-003 imports it:

```ts
import { isAllowed } from "../safety/RobotsChecker";

if (!await isAllowed(url, userAgent)) {
  return { error: "ROBOTS_DISALLOW", warning: "CONTEXT_ROBOTS_DISALLOW" };
}
```

Failure mode: emit warning, degrade to URL-only inference (do NOT abort the audit — robots blocks crawling, not the audit). User can override via `AuditRequest.constraints.robotsOverride` (Phase 13b master adds this; MVP has no override).

### 2.6 BusinessArchetypeInferrer signal weighting

Inference signals ordered by strength (per §37.1.1):

| Signal | Weight | Detection |
|---|---|---|
| JSON-LD `@type` Product | +0.4 D2C | `<script type="application/ld+json">` parsed schema-org type |
| JSON-LD `@type` SoftwareApplication | +0.4 SaaS | Same |
| JSON-LD `@type` Service | +0.4 service | Same |
| Pricing pattern `/mo` | +0.3 SaaS | Regex on visible text |
| "Add to cart/bag" CTA | +0.4 D2C | CTA copy match |
| "Request demo/quote" CTA | +0.4 B2B | CTA copy match |
| "Start free trial" CTA | +0.3 SaaS | CTA copy match |
| TLD `.shop` / `.store` | +0.2 D2C | Domain name |
| Price ≥$1K without ATC | +0.2 considered/B2B | Price extraction (Phase 1b reuse) |

Final archetype = max-weighted candidate. Confidence = winning weight, capped at 0.95. Ties or close calls (gap <0.15) → confidence 0.5, blocking open_question.

---

## 3. Risks & kill criteria *(R23)*

| Risk | Trigger | Action |
|---|---|---|
| Cost overrun | >$0.05/audit | KILL: profile fetch+parse cost; eliminate redundant calls; enforce ETag cache. R25 already forbids LLM, so cost is HTTP + Zod only. |
| HtmlFetcher cross-origin block rate | >40% of fixture sites | Profile UA + tune; consider a residential-proxy adapter (deferred to v1.1 stealth plugin). MVP: degrade to URL-only with warning, do NOT abort. |
| URL pattern accuracy <95% | URLPatternMatcher fails on fixture set | Expand pattern list; ASK FIRST before relaxing the precision target. |
| BusinessArchetypeInferrer accuracy <80% on archetype fixtures | AC-05 fails twice | Add CTA copy patterns; tighten JSON-LD signal weighting. If still failing, defer LLM-tag inference to Phase 13b and lower fixture-acceptance bar to 70% (ASK FIRST). |
| ContextProfile hash instability | Re-run produces different hash on identical input | Bug — investigate canonical-JSON serialization. STOP — reproducibility (R5.4) blocks merge. |
| R25 violation introduced | T4B-014 test fails | KILL — refactor immediately. R25 is non-negotiable. Engineering lead approval required to merge any partial relaxation. |
| context_profiles migration conflicts with T070 | Phase 4 schema baseline shifts under T4B-012 | Coordinate with Phase 4 refresh team; ASK FIRST if shape divergence detected. |
| HeuristicLoader filter returns >25 heuristics | Fixture profile produces too-broad set | Expected for new heuristic library — initial library may be small. Lower bar to 8-25 for MVP if heuristic count is <40 total. ASK FIRST before relaxing. |
| AuditState slot for `context_profile_id` not present | T4B-011 cannot persist to AuditState | Coordinate with Phase 8 owner; T4B-011's prereq T135 must schedule slot before Phase 8 finalizes AuditState. |

---

## 4. Effort estimate

| Task | Effort | Notes |
|---|---|---|
| T4B-001 ContextProfile schema | 1.5h | 5 dimensions × ~5 fields × {value,source,confidence} + freeze + hash |
| T4B-002 URLPatternMatcher | 1.5h | 30 URL fixtures + regex set + accuracy test |
| T4B-003 HtmlFetcher | 1.5h | undici + UA + 5s timeout + ETag cache + robots integration |
| T4B-004 JsonLdParser | 0.5h | cheerio query + JSON.parse + types |
| T4B-005 BusinessArchetypeInferrer | 2.0h | Signal weighting + 6 archetype fixtures + provenance |
| T4B-006 PageTypeInferrer | 2.0h | URL + JSON-LD + layout fallback + 30 fixtures + backward-compat with §07 §7.4 |
| T4B-007 ConfidenceScorer + ProvenanceAssembler | 1.0h | Weighted aggregate + threshold gates |
| T4B-008 OpenQuestionsBuilder | 0.5h | Required-field rule + question template strings |
| T4B-009 AuditRequest intake schema | 1.0h | Extend Zod schema + regulated-vertical rejection |
| T4B-010 CLI clarification prompt | 1.5h | stdin loop + answer validation + idempotency |
| T4B-011 ContextCaptureNode | 1.5h | Orchestration node + state hand-off + halt/resume |
| T4B-012 context_profiles migration | 1.0h | SQL + Drizzle + indexes + append-only enforcement |
| T4B-013 HeuristicLoader filter extension | 1.5h | `loadForContext()` method + manifest selector matching + 12-25 size assertion |
| T4B-014 R25 compliance test | 1.0h | AST scan for Playwright/LLM imports + schema field linter |
| T4B-015 Integration test | 2.5h | 5 fixtures + 5 failure modes + halt-resume |
| **Total** | **22.5h ± 3** | Single engineer |

Tasks above 2.0h: T4B-005, T4B-006 (2.0h each), T4B-015 (2.5h). All have explicit kill criteria above per R23.

---

## 5. Verification

- **Per-task:** conformance tests pass on dedicated fixtures.
- **Per-phase:** integration test (T4B-015) on 5 fixtures + 5 failure modes; R25 compliance test (T4B-014) passes.
- **Idempotency:** integration test re-runs same audit twice with same intake; assert identical `profile_hash`.
- **Cost:** verify `llm_call_log` row count diff = 0 between baseline and Phase 4b runs.
- **Backward compat:** any existing `AnalyzePerception.inferredPageType` consumer (Phase 5/7) works unchanged via accessor (R-13 backward-compat path).

---

## 6. Out of scope for this plan

- LLM-tagged context inference — Phase 13b master.
- Per-traffic-source segmentation — Phase 13b.
- Heuristic weight modifiers — Phase 13b master.
- Multi-page context aggregation — Phase 8.
- Authenticated-page context capture — permanent non-goal.

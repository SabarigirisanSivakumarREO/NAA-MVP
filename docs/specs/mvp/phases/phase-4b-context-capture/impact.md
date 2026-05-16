---
title: Phase 4b — Impact Analysis
artifact_type: impact
status: verified
version: 0.4
created: 2026-04-28
updated: 2026-05-16
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-4b-context-capture/spec.md
  - docs/specs/mvp/constitution.md (R20 — Impact Analysis Before Cross-Cutting Changes)
  - docs/specs/final-architecture/37-context-capture-layer.md
  - docs/specs/final-architecture/18-trigger-gateway.md
  - docs/specs/final-architecture/13-data-layer.md
  - docs/specs/mvp/phases/phase-4b-context-capture/r20-invalidation-from-phase-4.md

req_ids:
  - REQ-CONTEXT-DIM-BUSINESS-001
  - REQ-CONTEXT-DIM-PAGE-001
  - REQ-CONTEXT-OUT-001
  - REQ-CONTEXT-OUT-002
  - REQ-CONTEXT-OUT-003
  - REQ-CONTEXT-FLOW-001
  - REQ-CONTEXT-DOWNSTREAM-001
  - REQ-GATEWAY-INTAKE-001
  - REQ-GATEWAY-INTAKE-002

breaking: false
affected_contracts:
  - ContextProfile (NEW shared contract)
  - AuditState (extended with context_profile_id + context_profile_hash slots)
  - AuditRequest (extended intake schema)
  - HeuristicLoader (loadForContext method added)
  - context_profiles DB table (NEW append-only table)
  - AnalyzePerception.inferredPageType (read-through accessor to ContextProfile.page.type)

consumes_from:
  # R20 closure (act-001) — enumerate Phase 4 contracts Phase 4b depends on.
  # Source: r20-invalidation-from-phase-4.md "Phase 4 contracts directly consumed by Phase 4b" table.
  # Required by R20 invalidation note item 5 (impact.md MUST explicitly list Phase 4 as consumed dependency).
  - phase: phase-4-safety-infra-cost
    contracts:
      - contract: context_profiles DB table slot (T070 AC-17 absence-assertion)
        phase_4_task: T070
        phase_4b_consumer: T4B-012
        reason: Phase 4 reserved the slot via absence-assertion; T4B-012 lands the actual migration
      - contract: PostgresStorage + StorageAdapter interface (REQ-STORAGE-ADAPTER-001)
        phase_4_task: T074
        phase_4b_consumer: T4B-008 ContextStore / T4B-012 migration
        reason: Phase 4b consumes the standard adapter pattern; appends context_profile rows via appendContextProfile()
      - contract: LLMAdapter + AnthropicAdapter + LLMCallRecord (REQ-LLM-ADAPTER-001)
        phase_4_task: T073
        phase_4b_consumer: deferred (R25 forbids LLM in MVP; contract noted for Phase 13b master)
        reason: If Phase 13b adds LLM-tagged inference, calls MUST route through LLMAdapter for cost attribution + TemperatureGuard; Phase 4b MVP makes ZERO LLM calls
      - contract: audit_log table + AuditLogger
        phase_4_task: T071
        phase_4b_consumer: T4B-014 telemetry
        reason: Context-capture failure events emit via AuditLogger
      - contract: audit_events + SessionRecorder
        phase_4_task: T072
        phase_4b_consumer: T4B-014 telemetry / T4B-011 ContextCaptureNode
        reason: audit_started event carries context_profile_id
      - contract: AuditEvent 22-type LOCKED enum
        phase_4_task: T072
        phase_4b_consumer: T4B-014 emit sites
        reason: Context-capture lifecycle events must reuse LOCKED types; no enum extension permitted at Phase 4b
      - contract: RobotsChecker (REQ-SAFETY-005)
        phase_4_task: T080a
        phase_4b_consumer: T4B-003 HtmlFetcher
        reason: HtmlFetcher MUST call RobotsChecker.isAllowed() before fetching robots.txt-restricted paths
      - contract: append-only llm_call_log (R14.1)
        phase_4_task: T073 / R14.1
        phase_4b_consumer: Phase 4b LLM call sites (none in MVP; contract noted)
        reason: Any classifier LLM call must produce a log row; MVP has zero LLM calls so this contract is dormant
      - contract: RLS on clients + audit_runs (R7.2)
        phase_4_task: T070 / R7.2
        phase_4b_consumer: ALL Phase 4b DB writes
        reason: ContextStore + telemetry writes MUST go through withClient(client_id, fn)

delta:
  new:
    - Phase 4b impact analysis — required by R20 because multiple shared contracts are extended/added
  changed:
    - v0.1 → v0.2 (2026-05-15) — Gate 1 Pass 1 patch wave act-001 (R20 closure):
        added consumes_from block enumerating 9 Phase 4 contracts (RobotsChecker,
        PostgresStorage + StorageAdapter, LLMAdapter + AnthropicAdapter + LLMCallRecord,
        audit_log + AuditLogger, audit_events + SessionRecorder, AuditEvent 22-type LOCKED enum,
        append-only llm_call_log, RLS on clients + audit_runs, context_profiles DB table slot).
        Discharges r20-invalidation-from-phase-4.md "Required actions before Gate 1" item 5.
        Cites R20 + R11.4. R18 append-only — no existing lines removed.
        Also added §3a "Consumed Phase 4 contracts" body subsection cross-referencing the frontmatter block.
    - v0.2 → v0.2 — status:draft → approved (R17.4 gate cleared per .phase-state/4b/preflight-verdict-pass2.yaml Pass 2 APPROVE; 8/8 Pass 1 findings closed in patch wave commit 821c266; cross-artifact sibling coherence verified)
    - v0.2 → v0.4 (2026-05-16) — R17.4 lifecycle bump status:approved →
        verified at Stage 4 EXIT (skipped v0.3 for sibling-coherence with
        spec.md v0.4). Gate 2 Pass 2 cleared per
        .phase-state/4b/verify-verdict-pass2.yaml APPROVE; 15/15 tasks;
        187/187 Phase 4b offline tests GREEN; R25 verified clean (T4B-014
        4/4). All 6 affected_contracts shipped per
        spec.md/plan.md/tasks.md final state. R20 propagation notes
        authored for downstream consumers (Phase 5/6/7/8/13b — see
        downstream_impact section). Cites R17.4 + R18 + R20.
  impacted: []
  unchanged:
    - All existing §1-§10 body sections (contract changes, producers, consumers, heuristic engine, cost, storage, reproducibility, documentation, risk register, sign-off requirements)

governing_rules:
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes)
  - Constitution R7.4 (Append-Only Tables)
  - Constitution R18 (Delta-Based Updates)
  - Constitution R25 (Context Capture MUST NOT)
---

# Phase 4b Impact Analysis

> **Why this file exists:** Constitution R20. Phase 4b introduces a NEW shared contract (`ContextProfile`), extends `AuditState`, extends `AuditRequest`, extends `HeuristicLoader`, and adds a NEW append-only DB table (`context_profiles`). It also touches `AnalyzePerception.inferredPageType` via a backward-compat accessor. Five+ shared-contract surfaces means an explicit per-consumer audit is required.

---

## 1. Contract changes

| Contract | Before | After | Breaking? |
|---|---|---|---|
| ContextProfile | — | NEW top-level intake-output contract | New (additive) |
| AuditState | Existing schema | Adds `context_profile_id: uuid?` + `context_profile_hash: string?` (T4B-011 extends; coordinate with T135 Phase 8 prereq) | **No** — new optional fields |
| AuditRequest | Intake schema (existing partial) | Adds `goal.primary_kpi` REQUIRED + `constraints.regulatory[]` validation | **Yes for callers without `primary_kpi`** — but MVP has no existing public callers; CLI only |
| HeuristicLoader | `load()` method | Adds `loadForContext(profile)` method | **No** — additive |
| context_profiles | — | NEW append-only DB table | New |
| AnalyzePerception.inferredPageType | Computed in §07 §7.4 detectPageType | Reads through to `ContextProfile.page.type` via accessor | **No** — accessor preserves shape |

---

## 2. Producers affected

| Producer | File | Change required | Owner |
|---|---|---|---|
| Phase 4b ContextCaptureNode | `packages/agent-core/src/orchestration/nodes/ContextCaptureNode.ts` | NEW node — runs before audit_setup | Phase 4b T4B-011 |
| Phase 4b ContextProfile schema | `packages/agent-core/src/context/ContextProfile.ts` | NEW Zod schema + freeze + hash helper | Phase 4b T4B-001 |
| Phase 4b inference primitives | `packages/agent-core/src/context/{URLPatternMatcher,HtmlFetcher,JsonLdParser,BusinessArchetypeInferrer,PageTypeInferrer,ConfidenceScorer,OpenQuestionsBuilder}.ts` | NEW per task | Phase 4b T4B-002..T4B-008 |
| AuditRequest schema | `packages/agent-core/src/gateway/AuditRequest.ts` | Extended with intake schema | Phase 4b T4B-009 |
| CLI clarification | `apps/cli/src/contextClarification.ts` | NEW prompt loop | Phase 4b T4B-010 |
| context_profiles migration | `packages/agent-core/src/db/migrations/0XX_context_profiles.sql` + Drizzle schema | NEW migration; coordinate with T070 Phase 4 baseline | Phase 4b T4B-012 |
| HeuristicLoader extension | `packages/agent-core/src/analysis/heuristics/HeuristicLoader.ts` | Adds `loadForContext()` | Phase 4b T4B-013 (drives Phase 6 refresh) |

---

## 3. Consumers affected (per R20 audit)

| Consumer | Location | Reads which contract? | Migration required? | Action |
|---|---|---|---|---|
| `audit_setup` orchestration node | `packages/agent-core/src/orchestration/nodes/AuditSetupNode.ts` | Now reads `state.context_profile_hash` | **Yes** — read context after ContextCaptureNode runs | Phase 4b T4B-011 |
| Phase 5 Browse-mode | `packages/agent-core/src/orchestration/browse-mode/*` | Reads AuditState | **No** — context fields are optional; Phase 5 ignores in MVP | None |
| Phase 6 HeuristicLoader | `packages/agent-core/src/analysis/heuristics/HeuristicLoader.ts` | NEW: reads ContextProfile | **Yes** — Phase 6 refresh adds `loadForContext()` integration | Phase 6 refresh task uses T4B-013 result |
| Phase 7 EvaluateNode | `packages/agent-core/src/analysis/nodes/EvaluateNode.ts` | Reads heuristic set (filtered) + AnalyzePerception | **No** — the filtered heuristic set arrives via HeuristicLoader; existing call site unchanged | None |
| Phase 7 detectPageType (§07 §7.4) | `packages/agent-core/src/analysis/page-type/*` | Currently inferred per-page | **Yes** — becomes a thin accessor: `inferredPageType = bundleToAnalyzePerception(bundle).inferredPageType ?? profile.page.type.value` | Phase 7 spec accommodates accessor |
| Phase 8 Orchestrator | `packages/agent-core/src/orchestration/*` | Reads AuditState | **Yes (slot)** — extends AuditState with `context_profile_id` + `context_profile_hash` slots; T135 prereq schedules before Phase 8 finalizes | Phase 8 spec acknowledges T4B-011 dependency |
| Reproducibility snapshot | `packages/agent-core/src/reproducibility/*` | Pins ContextProfile by hash | **Yes** — snapshot includes `context_profile_hash` | Phase 0 reproducibility extension |
| Delivery layer (PDF / dashboard) | `packages/agent-core/src/delivery/*`, `apps/dashboard/*` | Optionally surfaces context to consultant UI | **No (MVP)** — surfacing is Phase 9 polish | Future |
| AnalyzePerception consumer reading `inferredPageType` | Phase 5/6/7 | Reads `analyze.inferredPageType` | **No** — accessor returns same value via ContextProfile.page.type fallback | Backward compat maintained |
| `audit_runs` table FK | DB | New child table `context_profiles` references `audit_runs(id)` | **No** — additive | None |

**Net break risk:**
- AuditRequest callers without `primary_kpi` will be rejected. MVP has no production callers; CLI is the only caller. CLI updated in T4B-009.
- Existing `inferredPageType` consumers continue to work via accessor; no API change at the read site.
- AuditState slot extension is coordinated via T135 (Phase 8 prereq) — not a Phase 4b unilateral move.

---

## 3a. Consumed Phase 4 contracts (R20 closure)

Added 2026-05-15 per Gate 1 Pass 1 patch wave act-001 to discharge the R20 invalidation note's "Required actions before Gate 1" item 5 ("impact.md MUST explicitly list Phase 4 as a consumed dependency"). Authoritative list lives in the `consumes_from:` frontmatter block above; this section is the human-readable narrative.

Phase 4 (Safety + Infrastructure + Cost) merged to master at commit `3312eda` on 2026-05-15 with 19 NEW shared contracts. Phase 4b consumes the following nine:

| Phase 4 contract | Phase 4 task | Phase 4b consumer | Consumption pattern |
|---|---|---|---|
| `context_profiles` DB table slot (absence-assertion) | T070 (AC-17) | T4B-012 migration | Phase 4 reserved the slot via absence-assertion; T4B-012 lands the actual `CREATE TABLE` migration |
| `PostgresStorage` + `StorageAdapter` interface | T074 | T4B-008 ContextStore / T4B-012 | ContextStore appends rows via `appendContextProfile()` through the adapter pattern; no direct DB driver imports |
| `LLMAdapter` + `AnthropicAdapter` + `LLMCallRecord` | T073 | (deferred — R25 forbids LLM in Phase 4b MVP) | If Phase 13b adds LLM-tagged inference, calls MUST route through LLMAdapter for cost attribution + TemperatureGuard. Phase 4b MVP makes ZERO LLM calls (R25.1 item 10). |
| `audit_log` table + `AuditLogger` | T071 | T4B-014 telemetry | Context-capture failure events (`CONTEXT_FETCH_FAILED`, `CONTEXT_ROBOTS_DISALLOW`, `CONTEXT_HTML_TOO_SHORT`) emit via AuditLogger |
| `audit_events` + `SessionRecorder` | T072 | T4B-011 ContextCaptureNode / T4B-014 | `audit_started` and `context_captured` lifecycle events carry `context_profile_id` |
| `AuditEvent` 22-type LOCKED enum | T072 | T4B-014 emit sites | Context-capture lifecycle events MUST reuse LOCKED enum types; no enum extension permitted at Phase 4b. Adds would require Phase 4 spec amendment + R20 cycle. |
| `RobotsChecker` (REQ-SAFETY-005) | T080a | T4B-003 HtmlFetcher | HtmlFetcher MUST call `RobotsChecker.isAllowed(url, userAgent)` before any HTTP GET; halt fetch + degrade to URL-only on disallow |
| Append-only `llm_call_log` (R14.1) | T073 / R14.1 | Phase 4b LLM call sites (zero in MVP) | Any classifier LLM call must produce a log row; MVP has zero LLM calls so this contract is dormant for Phase 4b |
| RLS on `clients` + `audit_runs` (R7.2) | T070 / R7.2 | ALL Phase 4b DB writes | ContextStore + telemetry writes MUST go through `withClient(client_id, fn)` transactional wrapper; bypassing RLS = R7.2 violation |

**R20 propagation chain status:** This section + the frontmatter `consumes_from:` block close the R20 invalidation note's pre-Gate-1 requirement (item 5). After Pass 2 APPROVE, the R20 note can be marked resolved or moved to `r20-invalidation-from-phase-4.resolved.md`.

**Cross-reference:** Full table in [`r20-invalidation-from-phase-4.md`](r20-invalidation-from-phase-4.md) §"Phase 4 contracts directly consumed by Phase 4b".

---

## 4. Heuristic engine impact

T4B-013 changes how heuristics are loaded:

- **Before:** HeuristicLoader.load() returns the full heuristic set (entire library).
- **After:** HeuristicLoader.loadForContext(profile) returns 12-25 heuristics filtered by `business.archetype + page.type + traffic.device_priority`.

This unblocks Phase 7 EvaluateNode cost reduction — fewer heuristics per evaluate call → smaller LLM context → ~60-70% cost reduction per evaluate. (Quantified after Phase 7 ships.)

**Phase 6 refresh (T6 refresh task)** depends on T4B-013. Refresh adds the `archetype + page_type + device` selector fields to heuristic manifests so the filter matches.

GR-001..GR-008 grounding rules unchanged. New grounding rules (GR-013+) may eventually consume context fields, but Phase 4b does not author them.

---

## 5. Cost impact

| Metric | Before | After | Δ |
|---|---|---|---|
| Phase 4b LLM calls per audit | — | 0 | 0 (R25 forbids LLM in MVP) |
| Phase 4b HTTP fetches per audit | — | 1 (cached on re-run) | +1 |
| Phase 4b wall time | — | ≤2s cached / ≤7s cold | +up to 7s |
| Phase 4b $ per audit | — | ~$0.01 (HTTP only) | +~$0.01 |
| Phase 7 evaluate input tokens (after filter) | full library × N pages | filtered set × N pages | −60-70% (estimated; quantified post-Phase 7) |
| Net audit $ impact | — | NET COST DECREASE expected | Phase 4b adds $0.01 but Phase 7 saves ~$0.20 — net favorable |

**Net audit cost impact:** Likely net-favorable. Phase 7 cost savings from heuristic filtering exceed Phase 4b's HTTP-fetch cost by an order of magnitude.

---

## 6. Storage impact

NEW table: `context_profiles`.

```sql
CREATE TABLE context_profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES audit_runs(id),
  client_id    UUID NOT NULL,
  profile_hash CHAR(64) NOT NULL,                          -- SHA-256 hex
  profile_json JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ctx_profiles_audit ON context_profiles (audit_run_id);
CREATE INDEX idx_ctx_profiles_client ON context_profiles (client_id);
CREATE INDEX idx_ctx_profiles_hash ON context_profiles (profile_hash);

-- Append-only enforcement: no UPDATE, no DELETE permitted (R7.4).
-- Enforced via trigger or revoked DML grants in Phase 4 §11.1.1 RLS setup.
```

Per-row size: ~5KB (ContextProfile JSON + headers). At 100 audits/day ceiling, ~500KB/day = 180MB/year — trivial.

---

## 7. Reproducibility impact

`reproducibility_snapshots.context_profile_hash` field is added (or piggybacks on existing `inputs_hash` if structured). Same audit + same intake = same `profile_hash` (R-03 idempotency).

Replay against a stored ContextProfile loads `context_profiles WHERE profile_hash = :hash` and runs heuristics identically.

---

## 8. Documentation impact

| Doc | Change |
|---|---|
| `docs/specs/final-architecture/37-context-capture-layer.md` | Already canonical. No change. |
| `docs/specs/final-architecture/18-trigger-gateway.md` | REQ-GATEWAY-INTAKE-001..002 already documented. T4B-009 implements. |
| `docs/specs/final-architecture/04-orchestration.md` | audit_setup integration documented at §37; cross-link from §04 added when Phase 4b ships. |
| `docs/specs/final-architecture/13-data-layer.md` | Add `context_profiles` table to schema section. |
| `docs/specs/final-architecture/09-heuristic-kb.md` | T4B-013 + Phase 6 refresh adds `loadForContext()` and `archetype/page_type/device` manifest selectors. |
| `docs/specs/mvp/PRD.md` | F-001 (intake) updated with primary_kpi REQUIRED + regulatory validation in next PRD bump. |
| `docs/specs/mvp/phases/INDEX.md` | Add Phase 4b row (handled by INDEX regeneration). |
| `docs/specs/mvp/phases/phase-4-safety-infra-cost/` | Refresh adds robots/ToS utility (§11.1.1) + context_profiles table reservation. Coordinated with Phase 4b. |

---

## 9. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| URL pattern accuracy <95% | Medium | Medium | Plan §3 — expand patterns; ASK FIRST before relaxing |
| Archetype inference accuracy <80% | Medium | Medium | Plan §3 — tune signal weighting; defer LLM-tag to Phase 13b |
| ContextProfile hash instability | Low | High (reproducibility) | Plan §3 — STOP on hash drift; bug-investigate canonical-JSON |
| R25 violation introduced | Low | High (constitutional) | T4B-014 mandatory pre-merge; engineering-lead approval required for any partial relaxation |
| HtmlFetcher blocked by Cloudflare bot wall | Medium | Low | Degrade to URL-only with warning; v1.1 stealth plugin addresses |
| context_profiles migration conflicts with T070 | Low | Medium | Coordinate with Phase 4 refresh; T4B-012 sequenced after T070 |
| AuditState slot collision with Phase 8 | Low | High | T135 prereq schedules slot before Phase 8 finalizes |
| HeuristicLoader filter returns >25 heuristics | Medium | Low | Initial heuristic library may be small (Phase 0b authors ~30); filter set will fall in 8-25 band early; tighten as library grows |
| Net cost saving fails to materialize | Low | Medium | Quantified post-Phase 7; track in `audit_events` |

---

## 10. Sign-off requirements

Per R20:

- [x] This impact.md exists (R20 hard requirement)
- [ ] Engineering lead sign-off on backward-compat audit (§3 above)
- [ ] Phase 4 refresh ships robots/ToS utility (§11.1.1) before T4B-003
- [ ] Phase 4 refresh ships T070 PG schema baseline before T4B-012
- [ ] Phase 6 refresh task scheduled to consume T4B-013 (manifest selectors + `loadForContext()`)
- [ ] Phase 8 owner agrees to AuditState `context_profile_*` slot (T135 prereq)
- [ ] R25 compliance test (T4B-014) authored before any inference primitive merges
- [ ] Reproducibility snapshot extension scheduled with Phase 0 owner

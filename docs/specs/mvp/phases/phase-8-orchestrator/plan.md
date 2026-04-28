---
title: Phase 8 — Audit Orchestrator + Cross-Page — Implementation Plan
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
  - docs/specs/mvp/phases/phase-8-orchestrator/spec.md
  - docs/specs/mvp/tasks-v2.md (Phase 8 — T135-T155)
  - docs/specs/mvp/archive/2026-04-07-walking-skeleton/tasks.md (canonical T135-T155 baseline)
  - docs/specs/final-architecture/04-orchestration.md
  - docs/specs/final-architecture/05-unified-state.md §5.7
  - docs/specs/final-architecture/25-reproducibility.md
  - docs/specs/final-architecture/18-trigger-gateway.md

req_ids:
  - REQ-ORCH-NODE-001..003
  - REQ-ORCH-EDGE-001..003
  - REQ-ORCH-SUBGRAPH-001
  - REQ-STATE-001
  - REQ-STATE-EXT-COMPAT-001
  - REQ-CROSSPAGE-PATTERN-001
  - REQ-REPRO-031a
  - REQ-CHECKPOINT-001

impact_analysis: docs/specs/mvp/phases/phase-8-orchestrator/impact.md
breaking: false
affected_contracts:
  - AuditState (PRODUCER + CONSUMER)
  - PatternFinding (PRODUCER — NEW)
  - PageSignals (CONSUMER)
  - AuditPage (PRODUCER — NEW)

delta:
  new:
    - Phase 8 plan — sequencing (3 sub-blocks), AuditState coordination, cross-page PatternDetector design, MVP COMPLETE gate, kill criteria
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R7.4 (append-only)
  - Constitution R8.1 (audit budget cap $15)
  - Constitution R14.1 (cost attribution)
  - Constitution R15.2 (analysis_status taxonomy)
  - Constitution R20 (Impact Analysis)
  - Constitution R23 (Kill Criteria)
---

# Phase 8 Implementation Plan

> **Summary (~120 tokens):** Implement 21 tasks (T135-T155) over ~6-8 engineering days in 3 sub-blocks: **Block A** state + nodes + edges (T135-T142, ~3 days), **Block B** graph + checkpointer + CLI + reporters (T143-T147, ~2 days), **Block C** ★★ MVP COMPLETE acceptance tests (T148-T150, ~2-3 days; reserved T151-T155 for fixes). AuditState coordination (T135) is the single highest-risk coordination point — coordinates Phase 4b T4B-011 + Phase 7 T113 + Phase 8 T135 in one PR (or sequential PRs with merge protocol). Cross-page PatternDetector is folded into T139 AuditCompleteNode acceptance per F-014. MVP COMPLETE gate = T148 + T149 + T150 all green.

---

## 1. Sequencing

```
Block A — State + Nodes + Edges (Days 1-3, ~16h):
  T135 AuditState (full schema)              — coordinates with Phase 4b T4B-011 + Phase 7 T113
  T136 AuditPage type + queue helpers
  T137 AuditSetupNode (MOD v2.0)             — reads snapshot + AuditRequest; Stage 1 filter; warm-up
  T138 PageRouterNode (MOD v2.1)             — Stage 2 filter; budget gate
  T139 AuditCompleteNode (cross-page)        — PatternDetector folded; analysis_status breakdown
  T140 routePageRouter edge
  T141 routeAfterBrowse edge
  T142 routeAfterAnalyze edge

Block B — Graph + Checkpointer + CLI + Reporters (Days 4-5, ~12h):
  T143 AuditGraph (compile with subgraphs)   — LangGraph subgraph composition
  T144 PostgresCheckpointer                  — kill mid-audit + resume
  T145 CLI command audit (MOD v2.0)          — constructs AuditRequest + writes snapshot
  T146 ConsoleReporter
  T147 JsonReporter

Block C — ★★ MVP COMPLETE Acceptance (Days 6-8, ~16h):
  T148 ★★ ACCEPTANCE TEST — example.com  (gate 1/3)
  T149 ★★ ACCEPTANCE TEST — amazon.in   (gate 2/3)
  T150 ★★ ACCEPTANCE TEST — bbc.com     (gate 3/3)
  T151-T155 reserved for fixes               — typically 1-3 fixes after first run; budget 1-2 days

★ MVP COMPLETE = T148 + T149 + T150 all green ★
```

Dependencies (from tasks-v2.md + archived walking-skeleton):
- T135 ← T081 (AuditState foundation), T113 (Phase 7 analyze fields), T4B-011 (Phase 4b context_profile_id/hash)
- T137 ← T135, T106 (HeuristicLoader Phase 6), T074 (DB adapter)
- T138 ← T135
- T139 ← T135 + T130 (EvidenceGrounder — provides grounded_findings)
- T140-T142 ← T138 / T091 (Phase 5 BrowseGraph) / T133 (Phase 7 AnalysisGraph)
- T143 ← T091, T133, T137, T138, T139, T140-T142
- T144 ← T070 (Phase 4 PG schema)
- T145 ← T143, T003 (CLI skeleton)
- T146 ← T076 (StreamEmitter), T145
- T147 ← T145, T132 (StoreNode)
- T148 ← T145, T146, T147 + Phase 0b 30-heuristic pack committed
- T149 ← T148
- T150 ← T148

---

## 2. AuditState (T135) Coordination Strategy — single highest-risk point

T135 extends AuditState in 3 directions simultaneously:
- (a) Phase 4b T4B-011 already reserved `context_profile_id` + `context_profile_hash` slots
- (b) Phase 7 T113 already extended with analyze fields (`current_page_perception_bundle`, `current_page_type`, `confidence_tier`, `evaluate_findings_raw[]`, `critique_findings[]`, `grounded_findings[]`, `rejected_findings[]`, `analysis_cost_usd`, `analysis_status`, `current_page_signals`)
- (c) Phase 8 T135 adds §5.7 v2.0 fields (`trigger_source`, `audit_request_id`, `state_graph`, `multi_state_perception`, `current_state_id`, `exploration_*`, `finding_rollups`, `reproducibility_snapshot`, `published_finding_ids`, `warmup_mode_active`)

**Coordination protocol:**

1. **Single source-of-truth file:** `packages/agent-core/src/orchestration/AuditState.ts` is the ONE file extended by all 3 phases.
2. **Sequential PRs:** Phase 4b T4B-011 → Phase 7 T113 → Phase 8 T135. Each PR is additive; no field renames.
3. **Zod schema augmentation:** each phase appends fields to a shared `AuditStateSchema` via `.extend()`.
4. **Conformance test gate:** after T135 lands, run `packages/agent-core/tests/conformance/audit-state-full.test.ts` to verify all field groups present + invariants hold (§5.4 + §5.7.3).
5. **Backward-compat invariant (REQ-STATE-EXT-COMPAT-001):** all new fields have defaults; Phase 1-5 code unaffected.
6. **If 3 PRs merge in wrong order:** PRs B/C will conflict on the file (additive changes both add to same Zod schema). Resolve via cherry-pick or rebase; do NOT skip the conformance test post-merge.

Risk if coordination fails: T135 conformance test red → Phase 7 + Phase 4b regression on AuditState load/save.

---

## 3. Cross-Page PatternDetector (folded into T139)

Per F-014, the PatternDetector is deterministic — NO LLM:

```ts
// packages/agent-core/src/analysis/cross-page/PatternDetector.ts
export interface PatternFinding {
  pattern_id: string;            // generated UUID
  heuristic_id: string;
  severity: SeverityEnum;
  affected_pages: string[];      // page URLs
  affected_count: number;        // length of affected_pages
  recommendation: string;        // copied from one representative finding (highest severity occurrence)
  confidence_tier: ConfidenceTier;
  viewport?: 'desktop' | 'mobile' | 'both';  // when 5b active
  is_pattern: true;
}

export function detectPatterns(
  groundedFindings: GroundedFinding[],
  viewportGrouping: boolean = false   // true when Phase 5b active
): PatternFinding[] {
  const PATTERN_THRESHOLD = 3;  // F-014 explicit minimum
  const groupKey = viewportGrouping
    ? (f: GroundedFinding) => `${f.heuristic_id}:::${f.viewport ?? 'both'}`
    : (f: GroundedFinding) => f.heuristic_id;

  const groups = new Map<string, GroundedFinding[]>();
  for (const f of groundedFindings) {
    const k = groupKey(f);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(f);
  }

  const patterns: PatternFinding[] = [];
  for (const [_, findings] of groups) {
    if (findings.length < PATTERN_THRESHOLD) continue;
    const representative = findings.reduce((a, b) =>
      severityRank(a.severity) >= severityRank(b.severity) ? a : b
    );
    patterns.push({
      pattern_id: crypto.randomUUID(),
      heuristic_id: representative.heuristic_id,
      severity: representative.severity,
      affected_pages: findings.map(f => f.page_url),
      affected_count: findings.length,
      recommendation: representative.recommendation.summary,
      confidence_tier: representative.confidence_tier,
      viewport: viewportGrouping ? findings[0].viewport : undefined,
      is_pattern: true,
    });
  }
  return patterns;
}
```

Persistence: PatternFinding rows written to `findings` table with `is_pattern: true` flag (or separate `pattern_findings` table per data layer §13). Per-page findings remain — pattern is an additional view layer.

NF-05 target: <3s on 50-page audit. Pure function; runtime is O(N) where N = total grounded findings (~200 typical). Should complete in <100ms.

Note on F-014 threshold: 3-page minimum is hardcoded for MVP; future v1.1 may add percentage threshold (e.g., 30% of audit pages) — DOCUMENTED as out-of-scope.

---

## 4. AuditGraph subgraph composition (T143)

Outer audit graph composition per §04 + LangGraph subgraph pattern:

```ts
// packages/agent-core/src/orchestration/AuditGraph.ts
import { StateGraph } from '@langchain/langgraph';
import { browseGraph } from '../browse-mode/BrowseGraph';      // Phase 5
import { analysisGraph } from '../analysis/AnalysisGraph';     // Phase 7
import { contextCaptureNode } from './nodes/ContextCaptureNode';  // Phase 4b
import { auditSetupNode } from './nodes/AuditSetupNode';
import { pageRouterNode } from './nodes/PageRouterNode';
import { auditCompleteNode } from './nodes/AuditCompleteNode';
import { routePageRouter, routeAfterBrowse, routeAfterAnalyze } from './auditEdges';

export const auditGraph = new StateGraph(AuditStateSchema)
  .addNode('context_capture', contextCaptureNode)        // Phase 4b — runs FIRST
  .addNode('audit_setup', auditSetupNode)                // Stage 1 filter; reads snapshot
  .addNode('page_router', pageRouterNode)                // Stage 2 filter; budget gate
  .addNode('browse', browseGraph)                        // SUBGRAPH (Phase 5 / 5b)
  .addNode('analyze', analysisGraph)                     // SUBGRAPH (Phase 7)
  .addNode('audit_complete', auditCompleteNode)          // PatternDetector + summary

  .addEdge('__start__', 'context_capture')
  .addEdge('context_capture', 'audit_setup')             // ContextProfile populated before setup
  .addEdge('audit_setup', 'page_router')
  .addConditionalEdges('page_router', routePageRouter, {
    browse: 'browse',
    audit_complete: 'audit_complete',
  })
  .addConditionalEdges('browse', routeAfterBrowse, {
    analyze: 'analyze',
    page_router: 'page_router',           // browse failed → skip page
  })
  .addConditionalEdges('analyze', routeAfterAnalyze, {
    page_router: 'page_router',           // always next page or complete
  })
  .addEdge('audit_complete', '__end__')
  .compile({ checkpointer: postgresCheckpointer });       // T144
```

Note ContextCaptureNode (Phase 4b T4B-011) runs BEFORE AuditSetupNode — populates `context_profile_id` + `context_profile_hash` slots so Stage 1 filter has the archetype to filter on.

---

## 5. Reproducibility Snapshot — MVP scaffolding

Per `tasks-v2.md` T145 v2.0 mod, CLI scaffolds the snapshot row before graph execution. MVP scaffold:

```ts
// apps/cli/src/commands/audit.ts (T145)
async function audit(flags: AuditFlags): Promise<void> {
  const auditRequest = await constructAuditRequest(flags);          // T156 contract
  const auditRequestId = await persistAuditRequest(auditRequest);   // audit_requests row

  // MVP scaffold — Phase 9 T160 SnapshotBuilder will replace this:
  const snapshot = {
    snapshot_id: crypto.randomUUID(),
    audit_run_id: auditRequest.audit_run_id,
    model_version: getModelVersion(),                  // claude-sonnet-4-{date}
    temperature_invariant: 0,                          // R10 + R13
    heuristic_pack_hash: await hashHeuristicPack(),    // SHA-256 of heuristics-repo
    context_profile_hash: '',                          // populated by ContextCaptureNode
    perception_schema_version: 'v2.5',                 // Phase 1c PerceptionBundle
    prompt_hashes: {
      evaluate: hashFile('evaluate.ts'),
      self_critique: hashFile('selfCritique.ts'),
    },
    created_at: new Date().toISOString(),
  };
  await persistSnapshot(snapshot);                     // reproducibility_snapshots row

  const compiledGraph = auditGraph;
  const finalState = await compiledGraph.invoke(
    { auditRequest, snapshot, ...initialState },
    { configurable: { thread_id: auditRequest.audit_run_id } }
  );

  // Reporters consume finalState
  await consoleReporter.summarize(finalState);
  await jsonReporter.write(finalState, flags.output);
}
```

Phase 9 T160 SnapshotBuilder will replace the inline scaffold with full composition + the `audit_setup` node will validate the snapshot integrity (hash match) on resume scenarios.

---

## 6. PostgresCheckpointer integration (T144)

LangGraph's PostgresCheckpointer persists state per turn:

```ts
// packages/agent-core/src/orchestration/PostgresCheckpointer.ts
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { dbConnectionString } from '../db/connection';

export const postgresCheckpointer = PostgresSaver.fromConnString(dbConnectionString);
await postgresCheckpointer.setup();  // creates langgraph_checkpoints table
```

`thread_id` = `audit_run_id` (idempotent resume key). On resume:

```bash
pnpm cro:audit --resume <audit_run_id>
```

CLI loads the snapshot + AuditRequest from DB, instantiates the compiled graph with the same checkpointer, calls `.invoke(undefined, { configurable: { thread_id: audit_run_id } })` — LangGraph fast-forwards to the next pending node.

NF-04 verification: count `llm_call_log` rows per `audit_run_id` after resume = same as continuous run.

---

## 7. Kill Criteria (R23)

Phase 8 PAUSES (reverts to engineering lead review) if any of these triggers fire:

| Category | Trigger | Action |
|---|---|---|
| **Coordination — AuditState** | T135 conformance test red after merging Phase 4b T4B-011 + Phase 7 T113 + Phase 8 T135 | STOP. Coordination protocol failure. Revert; resequence PRs. |
| **MVP gate failure** | T148 (example.com) red after 3 attempts (each with 1 fix per attempt) | STOP. ESCALATE — likely deeper Phase 5/7 issue. NOT a Phase 8 fix. |
| **MVP gate failure** | T149 (amazon.in) red despite anti-bot fixture work | DEGRADE acceptance — partial findings on ≥1 page is acceptable per current spec; full pass deferred to v1.1 if anti-bot strategy needs Phase 13 stealth |
| **MVP gate failure** | T150 (bbc.com) red after 3 attempts | STOP. ESCALATE. |
| **Cost attribution drift** | `audit_runs.total_cost_usd ≠ SUM(llm_call_log.cost_usd)` (NF SC-006) | STOP. R14.1/R14.4 violation. Audit transaction wiring. |
| **Cross-page regression** | PatternDetector emits incorrect groupings (e.g., merges different heuristic_ids) | STOP. Unit test should catch BEFORE T148; regression here = test surface insufficient. |
| **Resume regression** | PostgresCheckpointer resume produces duplicate LLM calls (NF-04) | STOP. R14.1 violation. Audit thread_id propagation. |
| **Budget over-shoot** | Audit exceeds $15 cap (R8.1) due to PageRouterNode budget-gate logic error | STOP. R8.1 violation. Audit gate logic + retry policy. |
| **Spec contradiction** | Implementation reveals §04 / §05 / §07.13 / §25 spec defect | STOP. Fix spec first per R11.4. ASK FIRST before patching code-only. |
| **Scope creep** | T151-T155 fix reserve consumed (5+ fixes from acceptance) | ESCALATE. Likely deeper architectural issue; not a quick-fix; phase-exit criteria review. |

When kill criteria trigger: snapshot WIP to `wip/killed/<task-id>-<reason>` branch; log trigger reason in audit_events; escalate with specific failure mode; do NOT silently retry.

---

## 8. Acceptance gating

Phase 8 ships when ALL of:

1. T135-T155 merged (T151-T155 may include fixes; that's expected)
2. T148 (example.com) — exit 0, ≥3 grounded findings, ≥1 rejected, output complete, cost <$5, time <15 min, snapshot persisted, AuditRequest persisted
3. T149 (amazon.in) — anti-bot handled, ≥1 page yields findings
4. T150 (bbc.com) — 3 pages successfully audited
5. AuditState conformance test (AC-01) green — all field groups + invariants hold
6. PostgresCheckpointer resume test (AC-10) green — no duplicate LLM calls
7. Cost attribution test (AC-18) green — `audit_runs.total_cost_usd` matches `llm_call_log` sum
8. Cross-page PatternDetector test (AC-05 / SC-007) green — patterns emitted at ≥3 threshold
9. Reproducibility test (SC-009) green — replay 24h later, finding overlap ≥90%
10. Phase 8 status: `verified`
11. `phase-8-current.md` rollup committed (Constitution R19) before Phase 9 begins

**★ MVP COMPLETE ★** = condition 2 + condition 3 + condition 4 = T148 + T149 + T150 all green.

---

## 9. Effort estimate

| Block | Tasks | Engineering hours |
|---|---|---|
| Block A (state + nodes + edges) | T135-T142 | ~16h |
| Block B (graph + checkpointer + CLI + reporters) | T143-T147 | ~12h |
| Block C (★★ acceptance tests) | T148-T150 | ~10h (3-4h per test on real sites) |
| T151-T155 reserve (fixes from acceptance) | — | ~10h (typically 1-3 fixes) |
| Buffer / coordination overhead | — | ~4h |
| **Total** | T135-T155 | **~52h ≈ 6-8 engineering days** |

Calendar: weeks 8-9 of MVP per PRD §14 timeline.

---

## 10. Risks (specific to Phase 8 execution)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AuditState merge conflicts across Phase 4b/7/8 PRs | Medium | High | Sequential merge protocol; conformance test gate; coordination doc in spec.md §2 |
| Cross-page PatternDetector edge case (1-page audit) | Low | Low | Pure function; unit test covers 0/1/2/3+ page cases |
| PostgresCheckpointer resume produces duplicate LLM calls | Low | High (R14.1 violation) | Conformance test (AC-10); thread_id audit |
| Anti-bot blocks T149 (amazon.in) entirely | Medium | Medium | Spec already notes "handles gracefully (escalate or successfully extract)"; partial pass acceptable |
| Cost attribution drift (audit_runs vs llm_call_log) | Low | High (R14.1 + R14.4) | AC-18 conformance test in CI |
| Reproducibility regression on T148 replay | Low | Medium | NF-005 = 90% (not 100%); accommodates Sonnet drift |
| MVP COMPLETE gate fails on first run | High | Medium (project timeline) | T151-T155 reserved for fixes; budget 1-2 days for iteration |
| LangGraph PostgresCheckpointer schema migration breaks Phase 4 baseline | Low | Medium | Run migration in CI before T144 implementation |
| Multi-tenant RLS interferes with PostgresCheckpointer queries | Low | Medium | Configure `app.client_id` SET LOCAL in checkpointer transactions |
| Phase 9 T160 snapshot builder lands AFTER Phase 8 ships and breaks T145 scaffold | Low | Low | T145 scaffold is documented as MVP placeholder; T160 will replace cleanly |
| F-014 threshold of 3 pages too strict for small audits (3-page MVP audit can produce 0 patterns) | Medium | Low | Documented as expected; consultant value still in per-page findings |
| Phase 5b multi-viewport opt-in changes PatternFinding emission semantics mid-Phase | Low | Medium | viewportGrouping flag in PatternDetector accepts both modes |

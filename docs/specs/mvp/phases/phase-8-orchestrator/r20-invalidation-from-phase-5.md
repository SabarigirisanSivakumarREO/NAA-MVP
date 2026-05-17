---
title: R20 invalidation note — Phase 5 landed 2026-05-17
artifact_type: r20-note
status: draft
version: 1.0
created: 2026-05-17
owner: engineering lead
authors: [Claude (master orchestrator)]

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-5-browse-mvp/spec.md (v0.5 verified)
  - docs/specs/mvp/phases/phase-5-browse-mvp/phase-5-current.md (v1.1 verified)
  - docs/specs/mvp/phases/phase-5-browse-mvp/phase-5-validation.md (v1.0 verified)

req_ids:
  - REQ-ORCHESTRATOR-AUDIT-GRAPH-001
  - REQ-ORCHESTRATOR-STATE-001
  - REQ-ORCHESTRATOR-RUNNER-001

governing_rules:
  - Constitution R20 (Impact-before-implementation)
---

# R20 invalidation — Phase 5 landed 2026-05-17

Phase 5 Browse MVP shipped 2026-05-17 (Gate 2 stamped). Phase 8 (AuditGraph composition + cross-page) consumes the BrowseSubGraph contract.

## Required reading before Phase 8 implementation begins

1. Re-run `/speckit.analyze` on `phase-8-orchestrator/` against Phase 5 surface.
2. Read `phase-5-current.md` §2 (data contracts) + `phase-5-validation.md` §1-§3 (module + data + call graphs).

## What Phase 5 shipped that Phase 8 must respect

### AuditStateBrowseSubsetSchema → AuditStateFullSchema (T135 widening)

Phase 8 lands the full AuditState at T135. **MUST extend additively** via `z.extend()`:

```ts
// Phase 8: orchestration/AuditState.ts (extended)
export const AuditStateFullSchema = AuditStateBrowseSubsetSchema.extend({
  trigger_source: z.enum([...]).default('consultant_dashboard'),
  audit_request_id: z.string().default(''),
  state_graph: ...,
  multi_state_perception: ...,
  current_state_id: z.string().nullable().default(null),
  exploration_cost_usd: z.number().default(0),
  exploration_budget_usd: z.number().default(0.50),
  exploration_pass_2_triggered: z.boolean().default(false),
  finding_rollups: z.array(FindingRollupSchema).default([]),
  reproducibility_snapshot: ...,
  published_finding_ids: z.array(z.string().uuid()).default([]),
  warmup_mode_active: z.boolean().default(true),
  // Plus the analyze-mode fields from Phase 7
});
```

Forward-stability promise (impact.md §Forward Contract): every Phase 5 field stays compatible (additive only) through Phase 8. New Phase 8 fields are optional with safe defaults so existing Phase 5 code paths continue to work.

### `_phase8_extensions` escape hatch deprecation

Phase 5 ships 7 transient fields on `_phase8_extensions`:
- `browse_loop_iteration` (number)
- `last_action_proposal` (ActionProposal)
- `last_verify_result` (AggregatedVerifyResult)
- `last_failure_class` (FailureClass | undefined)
- `cause_class` ('hitl_timeout' | 'bot_detected' | 'safety_blocked' | 'circuit_open' | 'wall_clock_timeout')
- `hitl_pending` (boolean)
- `last_llm_cost` (number — Bug-C fix)

Phase 8 SHOULD promote these to typed top-level fields on AuditStateFullSchema where appropriate. The escape hatch can be deprecated once all extensions are typed.

### AuditGraph composition (T135) — Bug-A lesson

Phase 8 buildAuditGraph composes Phase 5 BrowseSubGraph with Phase 7 AnalyzeSubGraph. **CRITICAL**: state channel LastValue reducer overwrites on each node return. If Phase 8 introduces a node that internally calls multiple sub-functions (like Phase 5's selectAction + verifyAndRoute pattern), MUST merge slices before returning to the channel. See `BrowseNode.ts:92-100` for the canonical Bug-A merge pattern (`{...sel.slice, ...verifySlice, _phase8_extensions: {...deep merged}}`).

### BrowseSubGraph runnable contract

`buildBrowseGraph(deps): CompiledStateGraph<any, any, any, any, any, any, any>` (signature with type erasure at LangGraph channel boundary). Phase 8 invokes via `compiledBrowseGraph.invoke(initialState, {configurable: {thread_id}})`. Initial state MUST conform to `AuditStateBrowseSubsetSchema.parse()`.

### 14 BrowseGraphDeps interface (R9)

Phase 8 buildAuditGraph(deps) MUST aggregate the 14 Phase 5 deps + Phase 7 analyze deps + any new Phase 8 orchestration deps. Reference: `BrowseGraph.ts:60-110` for the dep interface. Note: `hitlManager` + `session` are optional in Phase 5 (Phase 5 MVP gap docs).

### Checkpointer: MemorySaver → persistent (Phase 9)

Phase 5 ships `MemorySaver` (in-process). Phase 8 may swap for a persistent checkpointer (Postgres-backed) when LangGraph state must survive process restart. HITL resumption across process restarts requires this swap.

### BudgetMutex wiring obligation

`BudgetMutex.withLock(auditRunId, fn)` is authored at `orchestration/BudgetMutex.ts` but NOT yet wired. Phase 8 AuditGraph composition is the ideal site to wire it — when browse + analyze subgraphs run in parallel, the mutex MUST serialize their LLMAdapter calls per audit_run_id. **Failure mode if NOT wired**: budget double-debit possible under parallel composition.

### HitlManager process-local registry

Map<string, Promise<unknown>> per audit_run_id. Phase 9 dashboard may need cross-process HITL resumption — Phase 8 should design the checkpointer integration so that LangGraph's persistent checkpoint state carries HITL pending state (instead of in-memory).

## Forward compatibility risk

- AuditState widening at T135 must remain additive. Any rename or type-change of a Phase 5 field forces Phase 5 code rewrite + R20 cycle.
- LangGraph state channel `as any` casts (BrowseGraph.ts 2 sites with TODO + eslint-disable) — Phase 8 may revisit when LangGraph 1.3+ offers typed channel routers.

## Owner sign-off for Phase 8

Phase 8 lead reads this note + the validation doc spot-check list before bumping any phase-8-orchestrator artifact from `draft → approved`. Stage 1 pre-flight `/speckit.analyze` will flag R20 violations against this note.

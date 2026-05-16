---
title: Phase 5 — Browse Mode MVP
artifact_type: spec
status: approved
version: 0.4
created: 2026-04-27
updated: 2026-05-16
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (F-002 Page Router, F-003 Browser Agent)
  - docs/specs/mvp/constitution.md (R4 browser rules — every rule converges; R8 cost+safety; R9 adapter; R10 temperature; R14 cost)
  - docs/specs/mvp/architecture.md (§6.4, §6.5)
  - docs/specs/mvp/tasks-v2.md (T081-T100 — T097-T100 reserved)
  - docs/specs/AI_Browser_Agent_Architecture_v3.1.md
  - docs/specs/final-architecture/04-orchestration.md (LangGraph canonical)
  - docs/specs/final-architecture/05-unified-state.md (AuditState — full schema Phase 8; subset Phase 5)
  - Phase 1, 2, 3, 4 specs + impact.md (every prior contract consumed)
  - docs/specs/mvp/phases/phase-4b-context-capture/spec.md (v0.4 verified 2026-05-16)

req_ids:
  - REQ-BROWSE-NODE-001
  - REQ-BROWSE-NODE-002
  - REQ-BROWSE-NODE-003
  - REQ-BROWSE-GRAPH-001
  - REQ-BROWSE-PROMPT-001

impact_analysis: docs/specs/mvp/phases/phase-5-browse-mvp/impact.md
breaking: false
affected_contracts:
  - BrowseSubGraph
  - BrowseAgentSystemPrompt
  - AuditStateBrowseSubset

delta:
  new:
    - Phase 5 spec — first end-to-end browse-mode integration; consumes Phase 1-4 contracts
    - AC-01..AC-15 stable IDs
    - R-01..R-12 functional requirements
    - v0.2 — Constraints + AC-09 cite `docs/specs/final-architecture/08-tool-manifest.md` as the canonical 29-tool list source (analyze finding F-002)
    - v0.2 — Temperature invariant cited correctly to R13 NEVER + TemperatureGuard adapter, NOT R10 Code Quality (Constitution R22.6 stale-xref note; analyze finding F-003)
    - v0.3 — AC-16 + AC-17 + AC-18 + R-13 + R-14 (LOCKED-name compliance + client_id thread-through + budget thresholds + wall-clock timeout)
    - v0.4 — Pass 2 micro-fix: AC-18 wording defer
  changed:
    - v0.1 → v0.2 — analyze-driven xref polish; no scope changes
    - v0.2 → v0.3 — patch-wave applied per .phase-state/5/preflight-verdict.yaml Pass 1 (REVISE) act-001..act-013; LOCKED AuditEventTypeEnum drift fixes + Phase 4b R20 propagation + AC-04 test path consolidation + FailureClass routing table + 29-tool split (22+2+5) + 'timeout' wall-clock + R22.6 dedup
    - v0.3 → v0.4 — Pass 2 micro-patch: AC-18 wording (drop AuditRequest forward field declaration; hardcode 60min in MVP); LOCKED-name + R20 hygiene preserved
  impacted:
    - Constitution R4.1 (perception first) + R4.2 (verify everything) — first runtime convergence
    - Phase 8 AuditState — Phase 5 ships browse-mode SUBSET; Phase 8 lands full schema (additive, no migration)
    - Phase 4b AuditState fwd-stub — Phase 5 EXTENDS (additive) rather than replacing
  unchanged:
    - AC-01..AC-15 stable IDs, R-01..R-12 statements (R18 append-only)
    - User Scenarios except AS#8 + AS#10 (LOCKED-name patches)

governing_rules:
  - Constitution R4 (Browser Agent Rules)
  - Constitution R8 (Cost + Safety)
  - Constitution R9 (Adapter Pattern — 5+ adapter categories converge)
  - Constitution R10 (Reproducibility — non-temperature-bound LLM calls in browse)
  - Constitution R14 (Cost Accountability — atomic logging for browse-LLM calls)
  - Constitution R17, R18, R20, R23
---

# Feature Specification: Phase 5 — Browse Mode MVP

> **Summary (~150 tokens):** First end-to-end browse-mode integration. **17 MVP tasks** (T081-T097; T098-T100 reserved per tasks-v2). Builds the LangGraph browse subgraph: AuditState (browse-mode subset; full schema lands Phase 8), 4 distinct LangGraph nodes (audit_setup, page_router, browse, audit_complete) — browse internally split into 2 functions (selectAction + verifyAndRoute) sharing one node-level Zod I/O boundary, conditional edges with retry/replan/escalate routing, browse-agent system prompt for LLM-led action selection, and BrowseGraph assembly. Five integration tests exercise the loop on real sites. **Phase 5 is where every prior contract converges:** BrowserEngine + ContextAssembler (Phase 1), 29 MCP tools + RateLimiter + AnalyzePerception schema (Phase 2), ActionContract + VerifyEngine + ConfidenceScorer + FailureClassifier (Phase 3), LLMAdapter + SafetyCheck + DomainPolicy + CircuitBreaker + ScreenshotStorage + AuditLogger + SessionRecorder + StreamEmitter + DB schema (Phase 4), ContextProfile read-only consumer (Phase 4b). LLM calls use operation class `other` (browse decisions are NOT temperature-bound; classify/extract calls also OK).

**Feature Branch:** `phase-5-browse-mvp` (created at implementation time)
**Input:** Phase 5 scope from `docs/specs/mvp/phases/INDEX.md` row 5 + `tasks-v2.md` T081-T097 (17 MVP tasks; T097 promoted from reserved per v0.3 act-002)

---

## Mandatory References

1. `docs/specs/mvp/constitution.md` — R4 (every browser rule converges in Phase 5: R4.1 perception first, R4.2 verify everything, R4.3 safety structural, R4.4 multiplicative confidence, R4.5 exact tool names); R8 (R8.1 audit budget, R8.2 page budget enforced in browse loop); R9; R10; R14.
2. `docs/specs/mvp/PRD.md` §F-002 (Page Router) + §F-003 (Browser Agent) acceptance.
3. `docs/specs/mvp/tasks-v2.md` T081-T100 — T097-T100 reserved.
4. `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` — browse-agent system prompt + decision flow.
5. `docs/specs/final-architecture/04-orchestration.md` — LangGraph orchestration canonical.
6. `docs/specs/final-architecture/05-unified-state.md` — AuditState schema (full Phase 8; subset Phase 5).
7. **All prior phase specs + impact.md** (Phase 1-4) — Phase 5 imports from each.

---

## Constraints Inherited from Neural Canonical Specs

- **Tech stack** — `LangGraph.js` (NEW Phase 5 dep — only Phase 5+ uses it). All other deps from Phase 1-4 already in place. No new external SDKs in Phase 5.
- **R4.1 Perception first** — every browse-mode action node MUST call `browser_get_state` (or read recent state from AuditState) before invoking action tools. Enforced at the LangGraph node level + by the browse-agent system prompt rule set.
- **R4.2 Verify everything** — every action emits `ActionContract`; `VerifyEngine.verify()` runs; FailureClassifier routes the verdict. Phase 3's structural enforcement now wired into the loop.
- **R4.3 Safety structural** — every action invocation routes through `SafetyCheck.assertAllowed(toolName, domain, audit_run)` (Phase 4). `requires_hitl` actions emit `audit_events.hitl_requested` and pause the LangGraph at an interrupt point (LangGraph supports interrupt natively).
- **R4.4 Multiplicative confidence decay** — ConfidenceScorer (Phase 3) called on every verify result; running `audit_state.session_confidence` updated.
- **R4.5 Exact tool names** — BrowseAgent system prompt enumerates the **29 MCP tools** by their EXACT v3.1 names. **Canonical source:** `docs/specs/final-architecture/08-tool-manifest.md` + Phase 4 rollup §5 (per tasks-v2.md v2.3.1 reconciliation: **22 `browser_*` (21 numbered + restricted `browser_evaluate`) + 2 `agent_*` + 5 `page_*` = 29** across T020-T048). The system prompt's tool-name list is sourced from Phase 2's `MCPToolRegistry.list()` at module load time; the registry was populated against this canonical manifest. LLM is constrained to invoke only registered names (validated at MCP boundary; `ActionProposalSchema` enum mirrors the 29). Per `08-tool-manifest.md` §8.2 Mode Availability Matrix, the 5 `page_*` tools are ANALYZE-mode-only; BROWSE_AGENT prompt MAY exclude them — see `r20-invalidation-from-phase-4b.md` for decision.
- **R8.1 audit budget cap** — `page_router` checks `audit_state.budget_remaining_usd` before routing to next page; if ≤ 0, terminates with `completion_reason='budget_exceeded'`.
- **R8.2 page budget** — each page entry resets `analysis_budget_usd = 5.0` (default); browse node skips remaining steps when exhausted (no Phase 7 analysis budget yet — that lands with analyze nodes).
- **R8.3 rate limiting** — Phase 2's RateLimiter wraps every tool call inside browse node.
- **R8.4 sensitive HITL** — SafetyCheck handles; LangGraph interrupt pauses execution.
- **R9 adapter** — Phase 5 imports interfaces from `@neural/agent-core`; never imports `@anthropic-ai/sdk`, `pg`, `playwright` directly. Browse subgraph code lives in `orchestration/`.
- **TemperatureGuard (R13 NEVER + adapter-boundary enforcement)** — Phase 5 LLM calls use `operation: 'other'` (NOT one of the 3 reproducibility-bound ops). `classify` / `extract` ops also acceptable for browse-decision sub-tasks. Temp ∈ [0, 1] allowed for these non-bound ops; default 0.5 for diversity in action selection. **Note on cross-references:** the temperature-invariant rule is codified in **R13 NEVER list** ("never set temperature > 0 on `evaluate` / `self_critique` / `evaluate_interactive`") and enforced at the `TemperatureGuard` adapter (Phase 4). PRD §10.1 ALWAYS list and R13 itself cite "(R10)" for this rule, but R10 Code Quality does NOT codify it — this is a stale cross-reference flagged by Constitution R22.6 as a punch-list item. Phase 5 follows the rule; the cite is to R13.
- **R14.1 atomic logging** — every Phase 5 LLM call logs to `llm_call_log` via the same LLMAdapter pathway. No silent calls.
- **R14.2 budget gate** — LLMAdapter's BudgetGate already enforces; Phase 5 nodes pass `audit_run_id` correctly.
- **No `console.log`** (R10.6) — Pino with new correlation: `node_name`, `subgraph='browse'`, `loop_iteration`.
- **Files < 300 lines, functions < 50 lines** — graph nodes are small (~100 lines each); BrowseGraph assembly file ~200 lines.

---

## User Scenarios & Testing

### User Story 1 — A consultant runs a browse audit on a real URL list and the browser autonomously navigates, acts, and verifies until completion or budget (Priority: P1) 🎯 MVP

The CLI (`pnpm cro:audit --urls ./urls.txt --business-type ecommerce`) reads URLs, creates an audit_run, enters BrowseGraph, and for each page: captures perception → LLM decides next action → SafetyCheck gates → MCP tool runs → VerifyEngine verifies → ConfidenceScorer updates → FailureClassifier routes → AuditLogger writes → SessionRecorder emits → StreamEmitter publishes. Loops until budget exhausted or all pages browsed. **No analysis yet** — Phase 5 stops at end-of-browse; Phase 7 picks up.

**Why this priority:** Single user story for Phase 5. This is the integration phase — without it, no Phase 7 analysis and no Phase 9 delivery can demo.

**Independent Test:** `pnpm -F @neural/agent-core test integration/phase5/{example,bbc,amazon,workflow,recovery,budget}`.

**Acceptance Scenarios:**

1. **Given** a fresh DB + 1-URL audit_run on `https://example.com`, **When** BrowseGraph runs, **Then** audit_setup creates the audit_run record, page_router enters browse subgraph for example.com, browse captures PageStateModel, LLM decides "no further action — page understood", page_router exits, audit_complete writes terminal state, total wall-clock < 60s.
2. **Given** an audit_run on `https://www.bbc.com`, **When** BrowseGraph runs, **Then** the browse loop captures perception, recognizes navigation only (no workflow), and exits cleanly within budget.
3. **Given** an audit_run on `https://www.amazon.in` with a multi-step workflow contract (search "headphones" → click first result → verify product page), **When** BrowseGraph runs, **Then** each step issues `ActionContract`, VerifyEngine passes (all 3 steps), confidence remains > 0.85, browse exits with `completion_reason='success'`.
4. **Given** a browse step where the click fails to land (verify_failed), **When** FailureClassifier returns `{class: 'verify_failed', shouldRetry: true}`, **Then** browse retries up to 3 times; on persistent failure routes to replan (LLM picks new action) or escalate.
5. **Given** an audit_run with `budget_remaining_usd = 0.20` and a multi-page workflow, **When** the browse loop debits cost across pages, **Then** at exhaustion `audit_runs.completion_reason = 'budget_exceeded'` is written and the loop exits cleanly without invoking further LLM/tool calls.
6. **Given** a sensitive action (`browser_upload`), **When** SafetyCheck classifies it as `requires_hitl`, **Then** browse emits `audit_events.hitl_requested`, LangGraph pauses at interrupt point; resumption requires `human_approval` event (Phase 5 stub for human; full HITL UI in Phase 9).
7. **Given** the browse-agent system prompt, **When** the LLM is invoked for action selection, **Then** the prompt instructs use of EXACT v3.1 tool names; if LLM proposes an unrecognized tool, MCP boundary validates and returns error → FailureClassifier routes as replan.
8. **Given** a `domain_policy.blocked` URL is scheduled, **When** page_router reads the URL, **Then** it records the block via `AuditLogger.log({ message: 'domain_blocked', metadata: {...} })` (free-text audit_log row, NOT a typed AuditEvent — 'domain_blocked' is not in the 22 LOCKED AuditEventTypeEnum) and skips the page (does NOT enter browse subgraph).
9. **Given** the integration test on amazon.in (T093) fails on a CAPTCHA wall, **When** Phase 5 runs in degraded mode, **Then** browse captures the CAPTCHA wall PageStateModel + screenshot, FailureClassifier marks `bot_detected_likely`, audit terminates with `completion_reason='aborted'` and a clean rollup is generated.
10. **Given** the StreamEmitter publishes events during a browse session, **When** the test buffer captures, **Then** ordered AuditEvent rows appear using the 22 LOCKED `AuditEventTypeEnum` only: `audit_started` → `page_browse_started` (per page) → `hitl_requested` (if sensitive) → `page_browse_completed` (or `page_browse_failed`) → `audit_completed` (or `audit_failed`). Non-LOCKED transitions (per-tool invocation, per-verify pass/fail, domain-block, circuit-open) are recorded as Pino structured logs + AuditLogger.log() free-text rows in `audit_log.message` — NOT as typed AuditEvent rows. Phase 9 dashboard subscribes to the LOCKED event stream + the Pino/audit_log firehose separately.

### Edge Cases

- **LangGraph interrupt for HITL not resumed within 5 minutes:** Phase 5 stubs auto-resumption (mark `hitl_timeout`, route to escalate). Phase 9 dashboard adds the human-in-the-loop UI for real resumption.
- **CircuitBreaker trips mid-loop:** page_router observes `CircuitBreakerOpen` for the next domain → skip page; records the trip via `AuditLogger.log({ message: 'domain_circuit_open', metadata: {...} })` (free-text audit_log row — 'domain_circuit_open' is not in the 22 LOCKED AuditEventTypeEnum).
- **Failed `browser_get_state` (e.g., navigation timeout):** browse node emits typed error → FailureClassifier marks `unverifiable` → page_router routes to next page, doesn't crash audit.
- **LLM returns malformed action proposal (not Zod-parseable):** browse node retries up to 2x; if persistent, escalates as `replan` failure → FailureClassifier marks `verify_failed`.
- **AuditState schema mismatch (Phase 5 subset vs Phase 8 full):** Phase 5 ships only the browse-mode fields; Phase 8 adds the rest as optional fields with defaults. Phase 5 code MUST tolerate (read-only) the missing-from-subset fields gracefully.

---

## Acceptance Criteria *(stable IDs, append-only)*

| ID | Criterion | Conformance test path | Linked task |
|----|-----------|----------------------|-------------|
| AC-01 | `AuditState` (browse-mode subset) Zod schema in `orchestration/AuditState.ts` EXTENDS Phase 4b's `state.ts` fwd-stub via `z.extend()`: Phase 4b base = `audit_run_id`, `client_id`, `current_node`, `node_status`, `context_profile_id`, `context_profile_hash`, `pending_questions`. Phase 5 ADDS: `business_type`, `urls_remaining`, `current_url`, `page_state_models[]`, `session_confidence`, `budget_remaining_usd`, `analysis_cost_usd`, `completion_reason?`. **Forward-compat:** schema accepts (but does not require) Phase 8's full fields via `_phase8_extensions: z.record(...).optional()` escape hatch on the extended schema. | `tests/conformance/audit-state-browse-subset.test.ts` | T081 |
| AC-02 | `audit_setup` LangGraph node creates audit_run row in DB, initializes AuditState, emits `audit_events.audit_started` | `tests/conformance/node-audit-setup.test.ts` | T082 |
| AC-03 | `page_router` LangGraph node: reads next URL from `urls_remaining`, checks budget + circuit breaker + domain policy, routes to browse OR audit_complete | `tests/conformance/node-page-router.test.ts` | T083 |
| AC-04 | `browse` LangGraph node: captures PageStateModel via Phase 1 ContextAssembler, calls LLM via LLMAdapter (operation='other', temp=0.5) for action selection, runs SafetyCheck before tool invocation, runs VerifyEngine after, updates ConfidenceScorer, routes via FailureClassifier on failure. Single test file with two describe blocks: `actionSelection` (T084) + `verifyAndRoute` (T085). | `tests/conformance/node-browse.test.ts` | T084 + T085 |
| AC-05 | `audit_complete` LangGraph node: writes terminal AuditState fields, sets `audit_runs.completion_reason`, emits `audit_events.audit_completed` (or `audit_failed`) — LOCKED `AuditEventTypeEnum` names per `packages/agent-core/src/types/audit-events.ts`. On `completion_reason='aborted'`, node also writes `metadata.cause_class` on the event row (values: `hitl_timeout`, `bot_detected`, `safety_blocked`, `circuit_open`). | `tests/conformance/node-audit-complete.test.ts` | T086 |
| AC-06 | LangGraph node-level Zod I/O: every node's input + output state slice validates via Zod (R2.2) at the node boundary | `tests/conformance/node-io-zod.test.ts` (parameterized over 4 nodes) | T087 |
| AC-07 | Conditional edges with FailureClass routing table (R20-LOCKED 5 values): `verify_failed` → retry (bounded 3) → replan → escalate; `safety_blocked` → audit_complete (completion_reason='aborted'); `rate_limited` → Phase 2 RateLimiter token-bucket backoff (no graph transition); `unverifiable` → page_router (next page); `bot_detected_likely` → audit_complete (completion_reason='aborted'). Routing function reads FailureClassifier output from state. | `tests/conformance/edges-routing.test.ts` | T088 |
| AC-08 | LangGraph interrupt for HITL: SafetyCheck emits `hitl_requested` → graph pauses at interrupt point → external `resumeAudit(audit_run_id, decision)` resumes/aborts | `tests/conformance/hitl-interrupt.test.ts` | T089 |
| AC-09 | Browse-agent system prompt: enforces EXACT v3.1 tool names (29 names sourced from `docs/specs/final-architecture/08-tool-manifest.md` via Phase 2 MCPToolRegistry), "perception first" instruction, max 3 actions per page guideline, JSON action proposal format (Zod-validated via `ActionProposalSchema` whose enum mirrors the 29). Prompt < 2000 tokens. **Drift detection:** golden snapshot test fails if Phase 2 registry adds/removes tools without Phase 5 prompt update. | `tests/conformance/browse-prompt.test.ts` (golden snapshot + tool-name-parity assertion against MCPToolRegistry.list().length === 29) | T090 |
| AC-10 | `BrowseGraph.compile()` produces a runnable LangGraph; `BrowseGraph.invoke({ initial_state })` runs the loop on a fixture URL list with mock LLM + mock browser; smoke test exits 0 | `tests/conformance/browse-graph-compile.test.ts` | T091 |
| AC-11 | Integration test against `https://example.com` + `https://www.bbc.com` (simple navigation): both pages browsed, no actions taken, audit_complete with `completion_reason='success'` | `tests/integration/phase5-simple.test.ts` | T092 |
| AC-12 | Integration test against `https://www.amazon.in` with multi-step search workflow: 3 actions, 3 verifies pass, confidence > 0.85 | `tests/integration/phase5-amazon.test.ts` | T093 |
| AC-13 | Integration test for multi-step workflow: navigate → click → type → submit → verify; all 5 actions verified; final state captured | `tests/integration/phase5-workflow.test.ts` | T094 |
| AC-14 | Integration test for recovery: synthetic verify_failed on action 2 of 4; FailureClassifier routes to retry (1x) → replan (LLM picks alternate action) → success → audit_complete | `tests/integration/phase5-recovery.test.ts` | T095 |
| AC-15 | Integration test for budget exhaustion: audit_run with `budget_remaining_usd=0.05` against a multi-page list; loop debits cost across pages; on exhaustion, audit terminates with `completion_reason='budget_exceeded'`; remaining pages NOT entered | `tests/integration/phase5-budget.test.ts` | T096 |
| AC-16 | Every Phase 5 browse-mode LLM invocation populates `LLMCompleteRequest.client_id` from `AuditState.client_id` (no PLACEHOLDER_UUID). Closes Phase 4 Stage 2.5 H1 + H2 carry-forward per `r20-invalidation-from-phase-4.md` L24-26. Conformance test asserts zero `llm_call_log.client_id = PLACEHOLDER_UUID` for any browse-mode row. | `tests/conformance/browse-llm-client-id.test.ts` | T097 |
| AC-17 | `page_browse_started` emitted on entry to browse node per page; `page_browse_completed` on successful exit; `page_browse_failed` on unrecoverable failure (all LOCKED names from the 22-value `AuditEventTypeEnum`). | `tests/conformance/node-browse-events.test.ts` | T085 |
| AC-18 | Audit-level wall-clock cap (hardcoded 60 min in MVP; configurable wiring via `AuditRequest.max_wall_clock_ms` deferred to v1.1 + Phase 4b R20 amendment) terminates audit cleanly with `completion_reason='timeout'`. AuditEvent row uses `audit_failed` with `metadata.cause_class='wall_clock_timeout'`. | `tests/conformance/audit-timeout.test.ts` | T086 |

AC-NN IDs append-only per Constitution R18.

---

## Functional Requirements

| ID | Requirement | Cites PRD F-NNN | Linked architecture spec |
|----|-------------|-----------------|--------------------------|
| R-01 | System MUST define `AuditState` browse-mode subset Zod schema | F-002 | 05-unified-state.md (subset) |
| R-02 | System MUST implement `audit_setup` node | F-002 | 04-orchestration.md |
| R-03 | System MUST implement `page_router` node with budget + circuit breaker + domain policy gates | F-002 + F-014 | 04-orchestration.md |
| R-04 | System MUST implement `browse` node integrating perception (Phase 1), MCP tool dispatch (Phase 2), verification (Phase 3), safety + LLM (Phase 4) | F-003 | 04-orchestration.md + AI_Browser_Agent_Architecture_v3.1.md |
| R-05 | System MUST implement `audit_complete` node | F-002 | 04-orchestration.md |
| R-06 | System MUST validate every LangGraph node's input + output via Zod (R2.2) | F-003 | (R2 enforcement) |
| R-07 | System MUST define conditional edges with retry / replan / escalate routing per FailureClassifier output | F-003 + F-016 | 04-orchestration.md |
| R-08 | System MUST support LangGraph interrupt for HITL (sensitive actions pause until external resume) | F-016 | 04-orchestration.md |
| R-09 | System MUST provide `BrowseAgentSystemPrompt` enforcing EXACT v3.1 tool names + perception-first + JSON action proposal format | F-003 | AI_Browser_Agent_Architecture_v3.1.md |
| R-10 | System MUST assemble `BrowseGraph` (LangGraph compiled) with all nodes + edges + system prompt | F-002 + F-003 | 04-orchestration.md |
| R-11 | System MUST provide 5 integration tests (T092-T096) | F-003 acceptance | (integration tests) |
| R-12 | System MUST log every Phase 5 LLM call to `llm_call_log` with operation in {`other`, `classify`, `extract`} | F-014 + R14.1 | 11-safety-cost.md |
| R-13 | System MUST emit `budget_warning` AuditEvent at 80% audit_budget consumption threshold; `budget_exceeded` at 100% per AC-15 | F-014 + R8.1 | 11-safety-cost.md |
| R-14 | System MUST thread `client_id` from `AuditState` through every `LLMCompleteRequest.client_id` field; no PLACEHOLDER_UUID values land in `llm_call_log` | F-014 + R14.1 + R14.4 | 11-safety-cost.md |

---

## Non-Functional Requirements

| ID | Metric | Target | Measurement |
|----|--------|--------|-------------|
| NF-Phase5-01 | Single-page browse loop wall-clock (perception + 1 action + verify) | < 30 s | Pino timing |
| NF-Phase5-02 | LLM call frequency in browse loop | ≤ 5 LLM calls per page | `llm_call_log` count per audit_run |
| NF-Phase5-03 | Phase 5 integration test suite total | < 8 min for 5 tests | Vitest |
| NF-Phase5-04 | LangGraph state serialization size | < 50 KB per checkpoint | Postgres checkpoint row size (Phase 8 wires; Phase 5 just measures) |

---

## Key Entities

- **`BrowseSubGraph`** (NEW shared) — compiled LangGraph; consumed by Phase 8 AuditGraph (which composes BrowseSubGraph + AnalyzeSubGraph from Phase 7).
- **`BrowseAgentSystemPrompt`** (NEW shared) — prompt template + Zod schema for action proposals.
- **`AuditState`** browse-mode subset (NEW; Phase 8 widens) — Zod schema.

See impact.md for full surface.

---

## Success Criteria

- **SC-001:** All 5 integration tests (T092-T096) green.
- **SC-002:** R4.1-R4.5 all wired into the runtime loop (verified by code-review checklist + integration tests).
- **SC-003:** No silent LLM calls in any browse session (R14.1 — verify via `llm_call_log` count matches LangGraph LLM-call node invocations in test).
- **SC-004:** Budget exhaustion produces clean termination on first exhausted page; no further LLM/tool calls.
- **SC-005:** Forward-compat: Phase 8 widening of AuditState requires no Phase 5 code changes (additive only).

---

## Constitution Alignment Check

- [x] R5.3 — N/A (no findings in Phase 5)
- [x] R6 — N/A (no heuristics)
- [x] R7.1/R7.2/R7.4 — DB writes via PostgresStorage (Phase 4); RLS preserved
- [x] R8.1 budget cap — page_router enforces; audit terminates on exhaustion
- [x] R8.2 page budget — browse skips on exhaustion (no analysis budget yet — Phase 7)
- [x] R8.3 rate limiting — Phase 2 RateLimiter inside browse node
- [x] R8.4 HITL — LangGraph interrupt; SafetyCheck triggers
- [x] R9 — Phase 5 imports interfaces only; no direct vendor SDKs
- [x] R13 (NEVER set temperature > 0 on evaluate/self_critique/evaluate_interactive) — Phase 5 uses non-bound op classes (`other` / `classify` / `extract`); TemperatureGuard at LLMAdapter boundary inactive for these by design. (R22.6 punch-list note: PRD/R13 cite "(R10)" but R10 Code Quality does NOT codify this; the actual rule lives in R13 NEVER + TemperatureGuard adapter.)
- [x] R10.1-R10.6 — files/functions sized; Pino with new correlation
- [x] R11.2 — REQ-IDs cited
- [x] R14.1 atomic LLM logging — preserved (uses Phase 4 LLMAdapter)
- [x] R20 impact.md — REQUIRED (3 new contracts; medium risk)
- [x] R23 kill criteria — default block + per-task on T084 (browse node — integration-heavy) + T091 (BrowseGraph assembly)

---

## Out of Scope

- Analysis nodes (deep_perceive, evaluate, self_critique, ground, annotate, store) — Phase 7
- Cross-page pattern detection — Phase 8
- Full AuditState schema (extension fields) — Phase 8 (Phase 5 ships browse-mode subset only)
- LangGraph checkpointing to Postgres — Phase 8 (Phase 5 runs in-memory state)
- Workflow recipes / Mode A — post-MVP
- Heuristic content / KB encryption — Phase 6 + v1.1
- Human-in-the-loop UI — Phase 9 (Phase 5 stubs auto-timeout for HITL)
- Real R2 storage — post-MVP-pilot
- CI / GitHub Actions — Phase 9
- Multi-page parallel browsing — sequential only in MVP
- Stealth plugin — v1.1 (T007 reduced)

---

## Assumptions

- **LangGraph.js latest** is the pinned orchestration framework per architecture.md §6.4. State annotation pattern + interrupt support are stable APIs.
- **Browse-agent system prompt** is hand-authored (no LLM auto-generation) — Phase 5 ships a single canonical prompt; v1.1 may A/B test variants.
- **HITL auto-timeout in MVP** — Phase 5 stubs the human approval; auto-route to escalate after 5 minutes. Phase 9 dashboard adds real human resumption.
- **Phase 5 audit termination is browse-only** — Phase 7 will be invoked AFTER browse completes, not interleaved. (Phase 8 wires the full audit lifecycle.)
- **AuditState forward-compat** — Phase 5 ships a browse-mode subset; Phase 8 widens additively (new optional fields). Phase 5 code does not depend on Phase 8 fields and tolerates their absence.
- **Mock LLM adapter** is provided in test code (Phase 4 already lands MockLLMAdapter); Phase 5 integration tests use it for deterministic action selection.
- **Mock BrowserEngine** for unit tests — Phase 5 also uses Playwright real browser for integration tests (T092-T096).
- **MVP serializes LLM calls per audit_run.** Parallel LLM calls within one audit deferred to v1.1; M3 budget concurrency hardening (Phase 4 carry-forward) addresses this at v1.1 boundary. Phase 5 enforces single-concurrent-LLM via BrowseNode kill criterion.

---

## Next Steps

1. impact.md authored.
2. plan.md drafted.
3. tasks.md drafted (17 MVP tasks per v0.3; T097 promoted from reserved).
4. /speckit.analyze (Explore subagent).
5. Phase 5 implementation in a separate session.

---

## Cross-references

- Phase 1, 2, 3, 4 specs + impact.md — every contract consumed
- `docs/specs/mvp/tasks-v2.md` T081-T096
- `docs/specs/AI_Browser_Agent_Architecture_v3.1.md`
- `docs/specs/final-architecture/04-orchestration.md`, `05-unified-state.md`
- `docs/specs/mvp/constitution.md` R4, R8, R9, R10, R14, R20, R23

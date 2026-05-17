---
title: Neural MVP — Phases Index
artifact_type: index
status: approved
version: 2.0
created: 2026-04-22
updated: 2026-05-09
owner: engineering lead
governing_rules:
  - Constitution R17-R21
  - PRD §6.5 (Project Structure Map)
generated_by: pnpm spec:index    # Auto-regenerated when phase folders or sub-phases are added — currently hand-edited until script lands
---

# Phases Index — Neural MVP v1.0

> **Summary (~100 tokens):** Master index of MVP phases — Phase 0 (Setup) and Phase 0b (LLM-assisted heuristic authoring) seed the project; Phases 1 → 9 sequentially deliver perception, MCP tools, verification, safety + infra + cost, browse, heuristic KB, analysis, orchestrator, and delivery. **★ v1.3 (2026-04-29 Session 5): Phase 9 spec corpus shipped — MVP SPEC COMPLETE ★** all 15 phase folders (0, 0b, 1, 1b, 1c, 2, 3, 4, 4b, 5, 5b, 6, 7, 8, 9) are spec-shipped; implementation can start at Phase 0. **v1.2 (2026-04-28 Session 4):** Phase 0b + Phase 7 + Phase 8 spec corpus shipped. tasks-v2.md patched v2.3.2 → v2.3.3 (Phase 0b section + T103-T105 counts reduced to 15/10/5 per F-012 v1.2). **v1.1 (2026-04-28 Session 3):** four NEW sub-phases landed — 1b (Perception Extensions v2.4), 1c (PerceptionBundle Envelope v2.5), 4b (Context Capture Layer v1.0), 5b (Multi-Viewport + Trigger Taxonomy + Cookie Policy). Phase 4 + Phase 6 refreshed for §11.1.1 robots/ToS + ContextProfile filter dependencies. Load this file first when starting or picking up a task. Do NOT load all phase files — use the decision table to find the one you need.

> **Rule:** When working on a task, read this index, identify the phase, then load only `phase-<N>-<name>/README.md` + `spec.md` + `tasks.md` for that phase (plus cited REQ-IDs from architecture specs).

---

## Phase decision table

| Phase | Name | Status | Tasks | Folder | Depends on | Blocks |
|---|---|---|---|---|---|---|
| 0 | Setup | 🟢 **implemented** (5/5 ACs green; rollup landed 2026-05-05) | M0.1-M0.5 + T-PHASE0-{TEST,DOC,ROLLUP} | `phase-0-setup/` | — | 1 |
| **0b** | **Heuristic Authoring (LLM-assisted, engineering-owned)** | 🟢 **implemented** (30/30 heuristics committed 2026-05-09; v0.7 tiered-verification pipeline; AC-12 3-round spot-check 15/15 PASS; rollup landed 2026-05-09) | T0B-001..T0B-005 + T103/T104/T105 ✅ | `phase-0b-heuristics/` | 0 | 6 |
| 1 | Browser Perception Foundation | 🟢 **implemented** (10 ACs green; 142/142 tests PASS; rollup landed 2026-05-09; NF-Phase1-01 v0.4 = 20K tokens) | M1.1-M1.10 (T006-T015) + T-PHASE1-{TESTS,DOC,LOGGER,ADAPTERS-README,ROLLUP} | `phase-1-perception/` | 0 | 1b, 2, 5 |
| **1b** | **Perception Extensions (PageStateModel extension)** | 🟢 **implemented** (13 of 13 ACs green; 240/240 tests + 12/12 acceptance PASS; Path B substrate-first + 11-type popup enum + Cialdini-collapse rationale; rollup + validation doc landed 2026-05-09; Gate 2 stamped) | T1B-000..T1B-012 (14 tasks incl. Path B substrate) | `phase-1b-perception-extensions/` | 1 | 1c, 6, 7 |
| **1c** | **PerceptionBundle Envelope v2.5** | 🟢 **implemented** (12 of 12 ACs green; 278/300 agent-core tests + 13/13 active T1C-012 integration PASS; 4 closed Zod enums pinned [IframePurpose 9+xo / HiddenReason 7 / NondeterminismFlag 9 / WarningCode 12]; Phase 1b §11 namespace contract carried forward; envelope-only budget 120-159 tokens empirical (94% under 2K cap); rollup + validation doc landed 2026-05-12; Gate 2 stamped) | T1C-001..T1C-012 (13 tasks incl. T-PHASE1C-TESTS) | `phase-1c-perception-bundle/` | 1b | 2 (MCP tools consume bundle); 5 (BrowseNode owns runtime wiring per impact.md §12); 7 (DeepPerceiveNode T117 extends T1C-011 forward-stub) |
| **2** | **MCP Tools** | 🟢 **implemented** (13 of 13 ACs green; 493/616 tests + 11/11 phase2 integration PASS at 37.49s vs 5-min budget; 29-tool MCP surface [22 browser_* + 2 agent_* + 5 page_*]; AnalyzePerception v2.3 + MCPToolRegistry + MCPToolSchema + RateLimiter shared contracts; 4 closed Zod enums consumed [IframePurpose 9-value via Phase 1c]; T048 page_analyze single-evaluate amazon.in wall-clock 336ms vs 5000ms — 15x margin; F-S4 namespace contract honored across 3 fixtures; F-S13 IframePurpose closed-enum verbatim from Phase 1c; Stage 2.5 CRITICAL F-001 resolved via Path B [F-006 closes bypass #3; #1+#2 documented as known limitations with Phase 4 DomainPolicy compensating control + AC-06 KNOWN-LIMITATION pins]; rollup + validation doc landed 2026-05-13; Gate 2 stamped) | M2.1-M2.20 (T016-T050) + T-PHASE2-{TESTS,TYPES,LOGGER,DOC,INSPECTOR,ROLLUP} | `phase-2-tools/` | 1, 1b, 1c | 5 |
| **3** | **Verification (thin)** | 🟢 **implemented** (9 of 9 ACs green; 574/574 agent-core tests + 12/12 acceptance PASS; zero regression vs Phase 2 baseline; 5 NEW shared contracts [ActionContract + VerifyStrategy + VerifyEngine + ConfidenceScorer + FailureClassifier]; 3 MVP strategies [url_change + element_appears + element_text] with 6 v1.1 reserved enum slots; first concrete code-level R4.4 multiplicative-confidence enforcement via ConfidenceScorer + source-grep conformance test; AC-06 forward-compat seam verified — VerifyEngine.register() has no MVP whitelist; phase 3-pass convergence Gate 1 + Stage 2.5 follow-up F-01+F-04 closure + Stage 3b Gate 2 APPROVE clean under fix-all-spec-defects policy; rollup + validation doc landed 2026-05-14; Gate 2 stamped) | M3.1-M3.8 (T053-T055 MVP; T056-T061 v1.1; T051-T052 + T062-T065 + T-PHASE3-{TESTS,LOGGER,DOC,ROLLUP}; 13 task units; T056-T061 deferred to v1.1) | `phase-3-verification/` | 2 | 5 |
| 4 | Safety + Infrastructure + Cost | 🟢 **implemented** (17 of 17 ACs green; 73/73 Phase 4 sequential tests + zero regression on 621 Phase 0-3 parallel-mode; 19 NEW shared contracts; 15-table Drizzle schema + RLS + append-only triggers + 0003_force_rls.sql enforcement closure; first LLMAdapter contact + TemperatureGuard R10 + BudgetGate R14.2 + atomic llm_call_log R14.1 + 3-retry failover R14.5; SafetyCheck 4-path gate consuming Phase 2 SafetyClass + producing Phase 3 safety_blocked; RobotsChecker REQ-SAFETY-005 with 6-bot UA-spoof reject; AuditLogger + SessionRecorder 22-type AuditEvent enum LOCKED + StreamEmitter SSE scaffold; ESLint no-restricted-imports + grep boundary defense-in-depth; rollup + validation doc landed 2026-05-14; Gate 2 stamped) | M4.1-M4.20 (T066-T076 + T080 + T080a) — refreshed v0.3 | `phase-4-safety-infra-cost/` | 2, 3 | 4b, 5, 7 |
| **4b** | **Context Capture Layer v1.0** | 🟢 **implemented** (15 of 15 ACs delivered; 187/187 Phase 4b offline tests GREEN; AC-12 DB-dependent test gated by DATABASE_URL infra — Phase 5 scope; R25 verified clean via T4B-014 4-rule AST scan [no Playwright / no LLMAdapter / no judgment fields / no silent defaults in `src/context/*`]; 6 NEW shared contracts [ContextProfile + ContextField factory + 6 LOCKED enums + ProvenanceEntry + OpenQuestion + AuditState T135 fwd-stub + ClarificationAnswer]; ContextCaptureNode halt/resume contract + SHA-256 canonical-JSON hash + Object.freeze [REQ-CONTEXT-OUT-003]; HeuristicLoader.loadForContext value-mapper bridges LOCKED→PRELIMINARY enums [LOCKED-only values skip dimension filter = "applies to all" semantics; Phase 13b roadmap reconciliation]; context_profiles append-only table [migration 0004 with PL/pgSQL trigger + RLS + 3 indexes]; T4B-015 5-fixture integration 1.73s wall-clock vs <2min target; ZERO net new LLM cost in MVP [R25.1 item 10 forbids LLM in context layer]; Stage 2.5 cavecrew reviewer APPROVE [2 MED-justified soft R10.1 violations carry-forward to Phase 8 AuditGraph refactor — ContextCaptureNode.ts 356 + helpers.ts 350]; Gate 2 Pass 1 REVISE → Pass 2 APPROVE via 1-action patch wave [act-g2-001 AC-07 test path drift fix; Session 19 fix-all-spec-defects policy]; rollup + validation doc landed 2026-05-16; Gate 2 stamped) | T4B-001..T4B-015 ✅ | `phase-4b-context-capture/` | 4 (refreshed) + 0b | 6 (refreshed); 7 (EvaluateNode cost reduction) |
| **5** | **Browse MVP** | 🟢 **implemented** (18 of 18 ACs green; 895/1055 agent-core tests pass [3 DB-dependent failures pre-existing Phase 4/4b carry-forward; identical failure set pre/post-Wave-8; 45.75s wall-clock vs ~200s pre-T-PHASE5-TESTINFRA-DEADLOCK = 4.4× speedup]; 4 NEW shared contracts [BrowseSubGraph + BrowseAgentSystemPrompt + AuditStateBrowseSubsetSchema + BudgetMutex] + HitlManager MVP-stub helper; first @langchain/langgraph ^1.3.0 install [sole importer BrowseGraph.ts; R9 grep-verified]; 24 BROWSE_TOOL_NAMES enumeration [22 browser_* + 2 agent_*; page_* analyze-mode-only excluded per 08-tool-manifest.md §8.2]; 4-step BrowseSubGraph audit_setup → page_router → browse → audit_complete + hitl_pause virtual node + LOCKED 5-row FailureClass routing table; Wave 7 integration tests surfaced 3 bugs + F-015 SPEC_GAP [Bug-A page_state_models drop / Bug-B stale last_failure_class / Bug-C budget never debited / F-015 terminal FailureClass missing completion_reason] all closed Wave 8 at source per R11.4; Stage 2.5 cavecrew checkpoints APPROVE post-Wave-4 + post-Wave-6 polish; Gate 2 Pass 1 APPROVE clean under risk-gate full + two-pass critic; H1+H2 PLACEHOLDER_UUID carry-forwards CLOSED via T097 mechanical conformance gate; W1A migration deadlock closed via T-PHASE5-TESTINFRA-DEADLOCK vitest globalSetup [4.4× test speedup; 5× over 30s acceptance target]; M3 budget concurrency hardened via BudgetMutex application-level per-audit_run_id lock [Phase 7/8 wiring deferred to LLMAdapter+BudgetGate integration site]; rollup + validation doc landed 2026-05-17; Gate 2 stamped) | M5.1-M5.8 (T081-T097 implemented; T098-T100 reserved per tasks-v2) | `phase-5-browse-mvp/` | 1, 1c, 2, 3, 4, 4b | 5b, 7, 8, 9 |
| **5b** | **Multi-Viewport + Trigger Taxonomy + Cookie Policy** | ⚪ not started | T5B-001..T5B-019 | `phase-5b-multi-viewport-triggers-cookie/` | 5, 1b, 1c | 7 (multi-bundle iteration); 8 (multi-viewport coordinate) |
| 6 | Heuristic KB Engine | ⚪ not started | M6.1-M6.11 (T101, T102, T106-T112) — refreshed v0.3 | `phase-6-heuristics/` | 4, 0b, 4b (T4B-013 contract) | 7 |
| **7** | **Analysis Pipeline** | ⚪ not started — spec shipped v0.1 | M7.1-M7.22 (T113-T134) | `phase-7-analysis/` | 5, 6, 1c, 4b | 8 |
| **8** | **Orchestrator + Cross-Page** | ⚪ not started — spec shipped v0.1 | M8.1-M8.21 (T135-T155) | `phase-8-orchestrator/` | 7, 4b (T4B-011) | 9 |
| **9** | **Foundations + Delivery** ★ MVP SPEC COMPLETE ★ | ⚪ not started — spec shipped v0.1 | T156-T175 + T239-T244 + T245-T249 + T256-T257 + T260-T261 (35 tasks) | `phase-9-delivery/` | 8, 7, 6, 4b, 4, 0b | ★ MVP shippable for first external pilot (with v1.1 R6.2 AES at-rest hardening) |

**Status legend:** ⚪ not started · 🟡 in progress · 🟢 complete · 🔴 blocked
**Bold rows** = NEW sub-phases added in v1.1 (2026-04-28 Session 3) OR phases with spec corpus shipped in v1.2 (2026-04-28 Session 4) / v1.3 (2026-04-29 Session 5)

---

## ★ v1.3 changes (2026-04-29 Session 5) — MVP SPEC COMPLETE ★

Phase 9 spec corpus shipped (spec/plan/tasks/impact/README/checklist each):

| Phase | Status | Key surface | Risk |
|---|---|---|---|
| **9** — Foundations + Delivery | spec corpus shipped — ★ MVP SPEC COMPLETE ★ | T156-T175 master foundations (AuditRequest contract; Gateway sync MVP; **T160 SnapshotBuilder REPLACES Phase 8 T145 scaffold**; TemperatureGuard; AccessModeMiddleware; WarmupManager; StoreNode + AnnotateNode extensions; 4D ScoringPipeline + IMPACT_MATRIX + EFFORT_MAP; Suppression; Next.js 15 + shadcn + Tailwind + Clerk consultant dashboard 4 pages) + T245-T249 delivery (ExecutiveSummary 1 LLM call $0.10 cap GR-007 enforced; ActionPlan deterministic 4-quadrant; branded PDF Playwright `page.pdf()` 8 sections ≤5MB R2) + T256-T257 DiscoveryStrategy (Sitemap + Manual MVP; Nav-stub deferred) + T260-T261 NotificationAdapter (Resend) + T239-T244 observability (Pino + 22-event audit_events taxonomy + heuristic_health_metrics view + alerting + admin ops dashboard LAST) | **HIGH** — T160 supersedes Phase 8 T145 scaffold; **R6 channels 3 + 4 first runtime activation** (Hono API + Next.js render — heuristic body NEVER serialized); ExecutiveSummary GR-007 retry-then-fallback; AccessModeMiddleware fail-secure default; ★ MVP SPEC COMPLETE gate ★ |

### MVP spec corpus state (15 phase folders shipped; 0% implemented)

After Session 5: **all 15 phase folders are spec-shipped** — 0, 0b, 1, 1b, 1c, 2, 3, 4, 4b, 5, 5b, 6, 7, 8, 9. Implementation can start at Phase 0. After Phase 9 implementation ships → MVP is shippable for first external pilot (with v1.1 R6.2 AES-256-GCM at-rest hardening added BEFORE pilot per PRD §3.2).

### tasks-v2.md drift status (this session)

No drift found in Phase 9 sections — task IDs T156-T175 + T239-T244 + T245-T249 + T256-T257 + T260-T261 are canonical in tasks-v2.md v2.3.3; phase-9-delivery folder is a scoped view referencing them verbatim.

### Punch-list candidates (v2.3.4 — NOT applied this session)

- Add discrete T-IDs for `r6-channel-3.test.ts` + `r6-channel-4.test.ts` conformance tests (currently folded into AC-36)
- Add discrete T-ID for ExecutiveSummary GR-007 retry-then-fallback test (currently folded into AC-22)
- Add discrete T-ID for GR-012 benchmark validation (carry-over from v1.2 punch-list — currently folded into Phase 7 T130 acceptance)
- Add discrete T-ID for cross-page PatternDetector (carry-over from v1.2 — currently folded into Phase 8 T139 acceptance)
- Constitution R22.6 stale xref: PRD §10.1 + R13 cite "(R10)" for temperature=0; should cite R13 directly (carry-over from Session 3)
- Phase 2 "28 vs 29 MCP tools" mismatch in impact.md + plan.md (carry-over from Session 2)
- **(NEW Session 7 / Phase 1 analyze L3)** Phase 1 polish task IDs (`T-PHASE1-TESTS`, `T-PHASE1-DOC`, `T-PHASE1-LOGGER`, `T-PHASE1-ADAPTERS-README`, `T-PHASE1-ROLLUP`) defined in `phase-1-perception/tasks.md` but absent from canonical `tasks-v2.md` Phase 1 section. Add to v2.3.4 alongside T006-T015 (and apply same retroactive treatment to Phase 0's `T-PHASE0-TEST` + Phase 0b's `T-SKELETON-001..010` if not already in v2.3.4 scope).
- **(NEW Session 7 / Phase 1 analyze L4)** `phase-1-perception/{spec,plan,tasks}.md` cite `tasks-v2 v2.3.1` (the version when T007 reduction landed) but canonical version is now v2.3.3 per Session 4 patch. Bump citation to `v2.3.3` (or `v2.3.1 — T007 reduction; current corpus v2.3.3`) when v2.3.4 lands.
- **(NEW Session 7 / Phase 6 analyze L1)** Phase 6 polish task IDs (`T-PHASE6-TESTS`, `T-PHASE6-LOGGER`, `T-PHASE6-FIXTURES`, `T-PHASE6-DOC`, `T-PHASE6-ROLLUP`) defined in `phase-6-heuristics/tasks.md` but absent from canonical `tasks-v2.md` Phase 6 section. Same retroactive treatment as Phase 1 carry-over (above) — bundle when v2.3.4 lands.
- **(NEW Session 7 / Phase 6 analyze L3)** `phase-6-heuristics/tasks.md` derived_from cites "T4B-013 v0.2 extension" / "T4B-013 — v0.2 extension" terminology that was correct at v0.2 but is now mid-version (artifact at v0.4). Cosmetic: rephrase to "T4B-013 — extension landed v0.2; carried in v0.4+" when v2.3.4 lands.
- **(NEW Session 9 / Phase 0b T0B-001 R11.4 patch — 2026-05-06)** `docs/specs/final-architecture/09-heuristic-kb.md` v2.3 → v2.4 — collapse §9.1 RICH structured `HeuristicSchema` (`name`, `source`, `severity_if_violated`, `reliability_tier`, `detection.{lookFor, positiveSignals, negativeSignals, dataPoints, evidenceType, pageTypes, businessTypes}`, `recommendation.{summary, details, researchBacking}`, `viewport_applicability`) into T101's body-string design (`packages/agent-core/src/analysis/heuristics/types.ts` — landed 2026-05-05 commit `3d2119c`). Modern LLM-first analysis prefers prose `body` over JSON-fragmented prompt instructions. T101 is the implementation source-of-truth that supersedes §9.1's structured shape. Capture the design rationale + migration mapping (§9.1 fields → T101 equivalents: `archetype`/`page_type`/`device` arrays REPLACE `detection.pageTypes`/`detection.businessTypes`; `business_impact_weight` REPLACES `severity_if_violated`+`reliability_tier`-based prioritization; `category` + Phase 6 T109 TierValidator REPLACE `reliability_tier` field; `body` prose REPLACES six structured prose fields) in the v2.4 delta block. Touch when Phase 6 implementation pre-flight runs in week 4 per CLAUDE.md §8c.
- **(NEW Session 9 / Phase 0b T0B-001 R11.4 patch — 2026-05-06)** `docs/specs/mvp/phases/phase-6-heuristics/spec.md` v0.4 → v0.5 — refresh AC-01 / AC-02 / R-01 field references from §9.1's rich structured shape to T101's body-string shape. AC-01 conformance test path `tests/conformance/heuristic-schema-base.test.ts` continues unchanged (T101 `HeuristicSchemaBase` already has `id` + `body` + `category` — the test just exercises actual fields). AC-02 conformance test extends to cover ProvenanceSchema (5 strict fields) + BenchmarkSchema discriminatedUnion + 3 optional manifest selectors per T101's actual surface. Touch when Phase 6 implementation pre-flight runs in week 4 per CLAUDE.md §8c. Coordinated with the §9.1 v2.4 punch-list item above — both supersede the legacy structured design in lockstep.

---

## v2.0 changes (2026-05-16 — ★ PHASE 4b CONTEXT CAPTURE LAYER v1.0 IMPLEMENTED ★)

**Phase 4b row state-flip:** ⚪ not started → 🟢 **implemented** (15/15 ACs; 187/187 offline tests GREEN; Gate 2 Pass 2 stamped 2026-05-16). Updated INDEX row carries full health + carry-forward summary. Rollup + validation doc landed at `phase-4b-context-capture/{phase-4b-current.md, phase-4b-validation.md}`. Branch `feat/phase-4b-context-capture` ready for merge (15 implementation commits + 1 Gate 2 patch + 1 R17.4 bump + 2 EXIT artifacts).

| Phase | Status flip | Key surface | Risk |
|---|---|---|---|
| 4b — Context Capture Layer v1.0 | ⚪ → 🟢 implemented | T4B-001..T4B-015 (15 tasks); 6 NEW shared contracts; ContextProfile schema + ContextField factory + 6 LOCKED enums; ContextCaptureNode halt/resume orchestrator with SHA-256 canonical-JSON hash + Object.freeze; HeuristicLoader.loadForContext value-mapper bridge; context_profiles append-only table (migration 0004); R25 mechanical compliance via T4B-014 AST scan | **MEDIUM** — Phase 8 T135 AuditState extension contract (Phase 4b ships fwd-stub at orchestration/state.ts; Phase 8 extends per R20 cycle); Phase 6 T106 FileSystemHeuristicLoader supersession (loadAll + loadForContext signatures preserved as forward-compat contract); LOCKED↔PRELIMINARY enum reconciliation deferred to Phase 13b master track |

### R20 propagation invalidations (from Phase 4b shared contracts)

| Downstream phase | Contract consumed | Phase 4b-side ready | Action required at consumer |
|---|---|---|---|
| Phase 5 (Browse MVP) | ContextProfile (safety gating + URL scoping); AuditState (T135 fwd-stub provides 4 base slots) | ✅ ContextProfile @ `src/types/context-profile.ts`; AuditState @ `src/orchestration/state.ts` | Phase 5 may read `state.context_profile_id` + `state.context_profile_hash` directly; safety gating MAY consult `business.archetype` + `constraints.regulatory` for vertical-specific scope rules |
| Phase 6 (Heuristic KB Engine) | HeuristicLoader.loadForContext extension (T4B-013) | ✅ Method on existing class @ `src/analysis/heuristics/loader.ts`; PRELIMINARY enums in types.ts UNCHANGED | T106 FileSystemHeuristicLoader implementation MUST preserve `loadAll()` + `loadForContext(profile, opts?)` method signatures; opts.heuristics test seam reused; mapper approach reversible when Phase 13b extends PRELIMINARY enums |
| Phase 7 (Analysis Pipeline) | ContextProfile (filter prompt heuristics; populate context block in EvaluateNode) | ✅ ContextProfile fully populated post-ContextCaptureNode | EvaluateNode (T119) reads `state.context_profile_hash` for reproducibility pinning + `business.archetype` + `page.type` + `traffic.device_priority` for HeuristicLoader.loadForContext; expected filter band 12-25 typical (8-25 floor when library <40 per AC-13 v0.2 patch); ASK FIRST if filter count outside [8, 25] |
| Phase 8 (Orchestrator) | AuditState T135 EXTENSION (additive; non-breaking); ContextCaptureNode wires before audit_setup | ✅ fwd-stub state @ `src/orchestration/state.ts`; ContextCaptureNode @ `src/orchestration/nodes/ContextCaptureNode.ts` | T135 MUST extend AuditStateSchema additively (preserve 6 existing slots: audit_run_id / client_id / current_node / node_status / context_profile_id / context_profile_hash / pending_questions); audit graph composition wires ContextCaptureNode BEFORE audit_setup with explicit halt/resume edge per User Story 3 |
| Phase 13b (Master track) | LOCKED↔PRELIMINARY enum reconciliation; LLM-tag inference for archetype/awareness/decision_style; full archetype universe (publisher/non-profit/etc); regulated verticals taxonomy expansion | ✅ All deferrals documented in `phase-4b-context-capture/spec.md` §Out-of-Scope (act-007 + act-008 closures) | Phase 13b SHOULD: (a) update PRELIMINARY_BUSINESS_ARCHETYPES + PRELIMINARY_PAGE_TYPES + PRELIMINARY_DEVICES in types.ts to match LOCKED; (b) update 30 heuristics-repo + 3 skeleton fixtures; (c) collapse value-mapper to identity function in loader.ts; (d) add LLM-tag inference behind feature flag with cost ceiling per call |

### Cumulative MVP progress after Phase 4b

8 of 15 phases now 🟢 implemented: **0, 0b, 1, 1b, 1c, 2, 3, 4, 4b**. Remaining 7 phases (5, 5b, 6, 7, 8, 9 + carve-out of 13b master track): ⚪ not started. **Next phase by dependency chain: Phase 5 (Browse MVP) — depends on 1+2+3+4; unblocked by Phase 4b shipping ContextProfile.**

### Carry-forwards for Phase 5 boot

1. **DATABASE_URL provisioning** — 7 vitest failures across full suite all DB-dependent (3 Phase 4b incl AC-12 + 4 Phase 4 carryovers); Phase 5 should provision Postgres + re-run conformance gates
2. **R10.1 over-LOC review** — Phase 4b shipped 2 files over the ≤300 soft target (ContextCaptureNode.ts 356 + helpers.ts 350); Phase 8 AuditGraph refactor will revisit when LangGraph composition lands; document MED-justified by Stage 2.5 reviewer
3. **superpowers:code-reviewer agent unavailable** — Phase 4b Stage 2.5 used `caveman:cavecrew-reviewer` fallback (clean APPROVE); future phases may continue fallback pattern OR re-verify agent availability
4. **usage-guard.mjs cost-tracker bug** — banner mis-reads ~850% phase ceiling due to cumulative-vs-delta concept mismatch; ENFORCEMENT DISABLED per CLAUDE.md §15.1; Phase 5 polish recommended fix: snapshot cost-at-phase-start

---

## v1.4 changes (2026-04-30 Session 7)

**Phase 1 v0.3 polish:** 8 analyze findings (M1-M4 + L1-L2 + L5-L6) applied across `phase-1-perception/{spec,plan,tasks,impact}.md`. Mechanical fixes only — no AC-NN / R-NN / SC-NNN ID changes (R18 append-only preserved). 2 carry-over items (L3, L4) added to v2.3.4 punch-list above. R17.4 review APPROVED with conditions C1 BINDING + C2/C3 OPTIONAL per [`phase-1-perception/review-notes.md`](phase-1-perception/review-notes.md) v1.0; status bumped to `approved`.

**Phase 6 v0.4 catch-up polish:** 4 analyze findings (H1 + H2 + H3 + M1) applied as a single v0.4 sync across `phase-6-heuristics/{spec,plan,tasks,impact}.md`. Catch-up consolidates two pending updates that never reached plan/impact: (a) v0.2 Pino redaction-pattern → BenchmarkSchema mapping; (b) v0.3 contract surface for T4B-013 + AC-11 + R-09 + REQ-CONTEXT-DOWNSTREAM-001 + manifest selectors (`archetype` / `page_type` / `device`). H1 closes the R6 enforcement gap in T-PHASE6-LOGGER (3 wrong-syntax paths → 6 correct paths matching spec.md:101 authoritative list). Versions: spec.md v0.3→v0.4; plan.md v0.2→v0.4 (skip v0.3 for catch-up); tasks.md v0.3→v0.4; impact.md v0.1→v0.4 (skip v0.2/v0.3 for catch-up). 2 carry-over items (L1, L3) added to v2.3.4 punch-list above. R17.4 review pending.

---

## v1.9 changes (2026-05-06 — ★ WALKING-SKELETON 10/10 COMPLETE; Wednesday demo gate PASSED ★)

Session 10 close-out 2026-05-06. Week 1 walking-skeleton FULLY DELIVERED across Day 2-3 of Session 10 — T-SKELETON-001 through T-SKELETON-010 ALL DONE; Wednesday demo gate via `pnpm test:integration` PASSED 12/12; demo prep #1+#2 done; demo prep #3 (screenshots) DEFERRED per engineering-lead direction; Wednesday demo executed (post-demo feedback log pending; may land in Session 11).

### Phase row state-flips (no row flips this version)

All 4 approved phases (0, 0b, 1, 6) retain their existing status; Phase 1 + Phase 6 stay 🟡 partial because only T014 + T101 forward-pulled tasks landed (rest of Phase 1 lands week 2; rest of Phase 6 lands week 4). Phase 0 stays 🟢 implemented; Phase 0b stays 🟡 in-progress (infra COMPLETE; content week 4).

### Walking-skeleton commit chain (since Session 9 close `dbf17ce`)

| SHA | Task / Patch | Files | Highlight |
|---|---|---|---|
| `20d5f95` | T-SKELETON-001 (orchestrator + CLI + 8 placeholders) | 16 | PD-07 c raw process.argv; foundation contract |
| `f178b5e` | T-SKELETON-002 (Peregrine PDP fixture + BrowserManager) | 7 | T014 schema; page_title log (roadmap v0.4) |
| `630838f` | T-SKELETON-003 (3 heuristic fixtures + HeuristicLoader) | 9 | NEURAL_TEST_FIXTURE_BODY sentinel; R6 spot-check (roadmap v0.5) |
| `7eae758` | T-SKELETON-004 (EvaluateNode 2 hardcoded findings) | 5 | **R5.3 + GR-007 first runtime activation** |
| `e067b64` | T-SKELETON-005 (SelfCritique passthrough) | 5 | R5.6 forward path; verdicts_summary log |
| `9e7ef83` | T-SKELETON-006 (EvidenceGrounder passthrough) | 5 | Phase 7 9-GR-rules forward path; rejection_summary |
| `c108266` | T-SKELETON-007 (AnnotateNode no-op) | 5 | Phase 7 T131 Sharp overlay forward path; annotation_count |
| `84ed140` | T-SKELETON-008 (StoreNode JSON-write) | 6 | **3-stage promotion path** (wk 3/9/11); R7.4 forward (roadmap v0.6) |
| `c1ed7a4` | T-SKELETON-009 (Report TXT) | 6 | Phase 9 T245-T249 + R6 channels 3+4 forward path (roadmap v0.7) |
| `a66970b` | **★ T-SKELETON-010 ★** (acceptance test) | 4 | **Wednesday demo gate PASSED** (roadmap v0.8) |
| `c7a3770` | wk-01.md demo script authored (267 LOC; 8 sections) | 3 | R5.3 in-flight false-positive fix (Q&A meta-text) |
| `3aae44a` | demo-prep #3 deferred + Wednesday demo ACTIVE | 2 | tracking-only commit |
| (this) | Session 10 close-out (handover v1.5 + INDEX v1.9 + Session 11 kickoff) | (multi) | branch push to origin |

12 task/patch commits in Session 10 alone (10 walking-skeleton tasks + 1 demo script + 1 demo-prep tracking flip). Plus this close-out commit = 13 Session 10 commits. **28 cumulative branch commits since branch-cut**, all pushed to origin at session close.

### 5 lightweight Option G roadmap patches (single-commit pattern; status:draft + mechanical/non-AC-changing)

| Patch | Task triggering | Drift | Resolution |
|---|---|---|---|
| v0.3 → v0.4 | T-SKELETON-002 | `example-com.json` fixture name vs Peregrine demo lock | rename fixture path in §6 line + §7 demo log line |
| v0.4 → v0.5 | T-SKELETON-003 | "TEST FIXTURE" body marker vs T0B-004 D1 BINDING NEURAL_TEST_FIXTURE_BODY sentinel | additive — both strings now embedded in fixtures for cross-package R6 grep |
| v0.5 → v0.6 | T-SKELETON-008 | `Promise<void>` signature vs T-SKELETON-001 placeholder which orchestrator USES for log path correlation | align spec to `Promise<string>` (more useful return type) |
| v0.6 → v0.7 | T-SKELETON-009 | vague `audit` argument name vs T-SKELETON-001 placeholder using structured `ReportInput` interface | align spec to `Report.render({url, auditRunId, findings, rejectedCount, durationMs})` |
| v0.7 → v0.8 | T-SKELETON-010 | `https://example.com` URL + `example-com-audit.txt` filename + "at least 1 fake finding line" vs Peregrine PDP demo lock + T-SKELETON-004's exactly-2-finding precision | align spec to Peregrine URL + correct filename + exact-2 finding-line count |

### Test surface end-state

| Suite | Tests | Pass |
|---|---|---|
| @neural/agent-core unit | 108 (15 perception + 40 heuristics + 8 BrowserManager + 8 HeuristicLoader + 8 EvaluateNode + 6 SelfCritiqueNode + 6 EvidenceGrounder + 5 AnnotateNode + 6 StoreNode + 6 Report) | ✅ |
| @neural/cli conformance | 18 (heuristic-lint R6 IP boundary) | ✅ |
| Playwright integration | 12 (5 Phase 0 acceptance + 7 walking-skeleton acceptance) | ✅ |
| **Total** | **138** | **✅ all green** |

Walking-skeleton acceptance gate at `tests/acceptance/walking-skeleton.spec.ts` validates entire `pnpm cro:audit --url=<peregrine PDP>` pipeline end-to-end in 901ms (~33× safety margin under 30s cap). R5.3 + R6 regression guards active via AC-W6 + AC-W7.

### Demo prep state

- ✅ #1 Pin Peregrine URL across artifacts (locked across roadmap v0.4-v0.8 + INDEX week-1 progress + wk-01.md frontmatter + walking-skeleton.spec.ts)
- ✅ #2 Author docs/specs/mvp/demo-scripts/wk-01.md (267 LOC; 8 sections)
- ⏭️ #3 Capture pre-demo happy-path screenshots — DEFERRED per engineering-lead direction
- 🟡 Wednesday demo execution (2026-05-06) — gate PASSED via pnpm test:integration; live screen-share executed
- ☐ Post-demo: log feedback to docs/specs/mvp/demo-feedback.md — pending Session 11

### What Session 11 should do next

Per `docs/specs/mvp/sessions/kickoff-session-11.md` (NEW — authored in this close-out commit):

1. Read handover v1.5 + INDEX v1.9 + roadmap v0.8 + active phase folder `phase-1-perception/`
2. Run `/speckit.analyze` on Phase 1 (re-verify since Session 7 R17.4 approval; T101 forward-pull may have downstream impacts)
3. Resolve any CRITICAL/HIGH analyze findings via R11.4 patches
4. Apply C1 BINDING from Session 7 review notes at T015 implementation time (per-step Playwright timeout budgets ≤20s/site / ≤60s/3-sites; waitUntil:'domcontentloaded' not 'load')
5. Implement Phase 1 (10 tasks): T-PHASE1-TESTS → T006-T013 → T015 → 4 polish tasks → R17 lifecycle bump approved → implemented → R19 phase-1-current.md rollup → INDEX row 1 flip 🟡 → 🟢
6. R20 impact.md required at T-SKELETON-002 → real-BrowserManager supersession (PageStateModel contract surface activates per roadmap §8 promotion table)

### Pending decisions for Session 11

- ~~**PD-01**~~ **RESOLVED 2026-05-08 (Session 12 master orchestrator Gate 1 REVISE) — SLIP to weeks 3-4**. Phase 1 alone is substantial (first network/Playwright phase + C1 BINDING + R20 impact + 3-site fixture set); impact.md v0.3.1 explicitly documents 1b/1c as separate phases with their own forward contracts.
- **PD-05 STILL OPEN**: .claude/settings.local.json cosmetic git-hygiene fix
- PD-04 + PD-07 RESOLVED Session 10; inherited

### Implementation-roadmap.md week 1 final state

- [x] T-PHASE0-TEST + T001-T005 (Phase 0 setup) — done Day 1 (Session 8)
- [x] T014 forward-pulled from Phase 1 — done Day 1 (Session 8)
- [x] T101 forward-pulled from Phase 6 — done Day 1 (Session 8)
- [x] T0B-001..T0B-005 (Phase 0b infra) — done Day 2 (Session 9)
- [x] **★ T-SKELETON-001..010 ★** — **done Day 2-3 (Session 10) ★ WALKING-SKELETON 10/10 COMPLETE ★**
- [x] **★ Wednesday demo gate ★** — **PASSED via pnpm test:integration 12/12 (Session 10)**
- [x] Author wk-01.md demo script — done Session 10
- ⏭️ Capture pre-demo screenshots — DEFERRED per engineering-lead direction
- 🟡 Wednesday demo execution (2026-05-06) — live screen-share completed
- ☐ Post-demo feedback log — pending Session 11

---

## v1.8 changes (2026-05-06 — Phase 0b infrastructure layer complete)

Second phase to advance under the per-phase corpus + walking-skeleton model. **Phase 0b infrastructure landed in a single 1-day session (Session 9, 2026-05-06) on `feat/week-1-walking-skeleton` branch.** Branch advanced from `6c56d70` → `a141a49` (6 additional commits = 16 cumulative on branch).

### Phase 0b row flipped: ⚪ not started → 🟡 in progress

5 of 8 tasks marked `✅ DONE 2026-05-06` in `phase-0b-heuristics/tasks.md` v0.5 (T0B-001 + T0B-002 + T0B-003 + T0B-004 + T0B-005). Content tasks T103/T104/T105 remain ⚪ pending in week 4 — flips to 🟢 + R17 implemented + R19 rollup when those land + Phase 6 T112 cross-phase acceptance passes.

### R11.4 spec defects surfaced + patched in flight (Session 9)

Two waves, both PATH A continuations of the §9.1 → T101 supersession pattern:

| Wave | When surfaced | Patch | Commit |
|---|---|---|---|
| 1 | T0B-001 brief load (start of Day 2) | spec.md/plan.md/tasks.md v0.3 → v0.4 — §Mandatory References supersession callout (§9.1 LEGACY; T101 source-of-truth at `packages/agent-core/src/analysis/heuristics/types.ts`); plan.md §2 prompt structure rewritten from §9.1 rich-structured (~25 fields) to T101 body-string design (11 fields); R-01 + AC-01 wording cite T101 file path | T0B-001 commit `f54c040` |
| 2 | T0B-004 brief load (mid-Day-2) | spec.md/plan.md/tasks.md v0.4 → v0.5 — 4 stale references missed in v0.4 sweep (AC-04 + AC-15 + R-04 + plan.md §5 — banned-phrase regex target was `recommendation.summary + recommendation.details`, both nonexistent in T101); patched to target `body` field. Two commits per Day 1 protocol "fix spec before implementing" cadence. | spec patch commit `62d5e03`; impl commit `b861f04` |

v2.3.4 punch-list extended in `f54c040` with §9.1 v2.4 architecture-spec rewrite + Phase 6 spec.md v0.5 polish queue items per CLAUDE.md §8c per-phase JIT analyze pre-flight pattern.

### R23 BINDING conditions resolved

| ID | Source | Condition | Resolution |
|---|---|---|---|
| **D1** (BINDING) | Phase 0b R17.4 review (Session 6 review-notes.md) | T0B-004 lint CLI MUST redact Zod-error `received: <value>` content; conformance test asserts via `NEURAL_TEST_FIXTURE_BODY` sentinel | **SATISFIED** in T0B-004 commit `b861f04`. `lintFile()` extracts ONLY `issue.path` + `issue.code` (NOT `issue.message`); 18 conformance tests assert sentinel never appears in stderr/stdout for any of 5 invalid + 1 valid fixture. |
| **D2** (BINDING) | same | T0B-005 README MUST explicitly forbid Slack/email/screenshot/support-ticket sharing of drafting LLM responses | **SATISFIED** in T0B-005 commit `a141a49`. README §3 "R6 / R15.3.3 IP boundary" 8-row forbidden-channel table covers all 4 BINDING channels + 4 defense-in-depth additional rows with constitutional-rule citations per row. |
| **D3** (OPTIONAL) | same | Pre-commit hook rejecting `^.heuristic-drafts/` commits | **DEFERRED to v1.0.1** with 4 documented reasons in tasks.md v0.5 T0B-005 entry: (a) `.husky/pre-commit` infrastructure scope expansion outside Phase 0b; (b) `.gitignore` already excludes `.heuristic-drafts/` (T0B-004 commit `b861f04`); (c) D2 BINDING text + T0B-002 + T0B-003 already enforces at human-protocol layer; (d) v1.0.1 is the right scope for git-infrastructure additions. |

### Pre-authorized scope expansion — Vitest wiring at apps/cli

Phase 0 T003 deferred apps/cli test scaffolding to "Phase 5+ alongside subcommands". T0B-004 AC-04 explicitly required `apps/cli/tests/conformance/heuristic-lint.test.ts` to be a real Vitest test → deferral revoked NOW. Wired with minimal `vitest.config.ts` mirroring `packages/agent-core/vitest.config.ts` pattern. `apps/cli/package.json` test script flipped from placeholder echo to `vitest run --passWithNoTests`. Adds `@neural/agent-core: workspace:*` + `glob: ^11.0.0` + `vitest: ^2.1.0` + `tsx: ^4.19.0` deps. Documented as agent reasoning per CLAUDE.md §8b in T0B-004 commit message.

### Test surface growth

| Workspace | Before Session 9 | After Session 9 |
|---|---|---|
| @neural/agent-core (unit) | 55 tests (15 perception + 40 heuristics from Day 1 forward-pulled schemas) | 55 tests (unchanged) |
| @neural/cli (conformance) | 0 tests (placeholder echo) | 18 tests (heuristic-lint conformance) |
| **Total** | **55** | **73** |

All FULL TURBO cache hits after first run; <1s per workspace.

### Commit chain (`feat/week-1-walking-skeleton` Session 9)

| SHA | Task / Patch | Files | LOC |
|---|---|---|---|
| `f54c040` | T0B-001 — drafting prompt template + Phase 0b spec/plan/tasks v0.4 R11.4 patch | 5 / +584 / -71 | net +513 |
| `2c1bad1` | T0B-002 — verification protocol template (8 steps + 3-strike rule + R6 discipline section) | 2 / +359 / -4 | net +355 |
| `8c8eaba` | T0B-003 — PR Contract Proof block template | 2 / +242 / -4 | net +238 |
| `62d5e03` | Phase 0b spec/plan/tasks v0.4 → v0.5 R11.4 PATH A continuation (banned-phrase target = body) | 3 / +13 / -10 | net +3 |
| `b861f04` | T0B-004 — pnpm heuristic:lint CLI + Vitest at apps/cli + 18 conformance tests | 14 / +916 / -5 | net +911 |
| `a141a49` | T0B-005 — heuristics-repo/README.md + D2 BINDING + D3 deferred | 2 / +279 / -5 | net +274 |
| (this) | Session 9 close-out — handover v1.3 + INDEX v1.8 + Session 10 kickoff prompt | (multi) | (close-out) |

### What Phase 0b content authoring (T103/T104/T105) should do next

When week 4 begins, the heuristic-content authoring workstream:

1. Read `heuristics-repo/README.md` (T0B-005) end-to-end + skim 4 sibling templates (T0B-001/002/003/004) — see README §6 "First-30-min author onboarding"
2. Pick first heuristic from tasks-v2.md Phase 6 section (T103 ~15 Baymard, T104 ~10 Nielsen, T105 ~5 Cialdini)
3. Run 4-step workflow: Draft (T0B-001 prompt) → Verify (T0B-002 protocol) → Lint (`pnpm heuristic:lint <file>`) → Commit (T0B-003 PR Proof block)
4. Spot-checks at +10 / +20 / +30 marks per F-012 acceptance (≤1 of 5 divergence per round)
5. Phase 6 T112 cross-phase acceptance test loads all 30 heuristics → if green, Phase 0b → 🟢 implemented (with R17 bumps + R19 rollup + this row flip 🟡 → 🟢)

### Implementation-roadmap.md week 1 progress

Per [implementation-roadmap.md](../implementation-roadmap.md) §7 Week 1:

- [x] T-PHASE0-TEST + T001-T005 (Phase 0 setup) — done Day 1
- [x] T014 forward-pulled from Phase 1 (PageStateModel schema) — done Day 1
- [x] T101 forward-pulled from Phase 6 (HeuristicSchemaExtended) — done Day 1
- [x] T0B-001..T0B-005 (Phase 0b infra) — **done Day 2**
- [x] T-SKELETON-001 (orchestrator + CLI subcommand + 8 placeholder nodes; PD-07 c) — **done Day 2-3 (Session 10 2026-05-05)**
- [x] T-SKELETON-002 (Peregrine PDP fixture + BrowserManager.capture() Zod-parses + page_title log enrichment + 8 unit tests; roadmap v0.3 → v0.4 fixture-name patch) — **done Day 2-3 (Session 10 2026-05-05/06)**
- [x] T-SKELETON-003 (3 synthetic heuristic fixtures with NEURAL_TEST_FIXTURE_BODY sentinel + HeuristicLoader.loadAll() glob-loads + Zod-parses + sorts + heuristic_ids log enrichment + 8 unit tests + R6 spot-check; roadmap v0.4 → v0.5 sentinel-alignment patch) — **done Day 2-3 (Session 10 2026-05-06)**
- [x] T-SKELETON-004 (EvaluateNode → 2 hardcoded raw findings tagged source='skeleton-stub' referencing Peregrine PDP + SKELETON-CHECKOUT-001 + SKELETON-CONTENT-003 + R5.3+GR-007 banned-phrase static-check + 8 unit tests + R5.3 spot-check on artifacts) — **done Day 2-3 (Session 10 2026-05-06)**
- [x] T-SKELETON-005 (SelfCritiqueNode passthrough confirmation + R5.6 Phase 7 T121 forward-path docstring + verdicts_summary log enrichment + 6 unit tests covering passthrough length/verdict/field-preservation/empty/order/idempotence) — **done Day 2-3 (Session 10 2026-05-06)**
- [x] T-SKELETON-006 (EvidenceGrounder passthrough confirmation + Phase 7 T122-T130 forward-path docstring with all 9 GR rules detail ★ second critical risk gate ★ + rejection_summary log enrichment + 6 unit tests covering envelope shape/passthrough/empty rejected/field-preservation/empty defensive/idempotence) — **done Day 2-3 (Session 10 2026-05-06)**
- [x] T-SKELETON-007 (AnnotateNode no-op passthrough confirmation + Phase 7 T131 week 9 Sharp severity-color overlay forward-path docstring + annotation_count=0 log placeholder + 5 unit tests covering passthrough length/field-preservation/empty defensive/order/idempotence) — **done Day 2-3 (Session 10 2026-05-06)**
- [x] T-SKELETON-008 (StoreNode JSON-write confirmation with tempdir-isolated tests + 3-stage promotion-path docstring wk 3 / wk 9 / wk 11 + R7.4 append-only forward path + findings_count log enrichment + 6 unit tests with os.tmpdir+mkdtemp+afterEach cleanup; roadmap v0.5 → v0.6 Promise<void> → Promise<string> Option G patch) — **done Day 2-3 (Session 10 2026-05-06)**
- [x] T-SKELETON-009 (Report plain-text confirmation + Phase 9 T245-T249 week 10 HTML+PDF forward-path docstring + F-018 8-section structure detail + R6 channels 3+4 first runtime note + report_format/bytes_written log enrichment + 6 unit tests covering header/per-finding/order/empty/interpolation/idempotence; roadmap v0.6 → v0.7 audit → ReportInput Option G patch) — **done Day 2-3 (Session 10 2026-05-06)**
- [x] **★ T-SKELETON-010 ★** (real Playwright Test acceptance suite at tests/acceptance/walking-skeleton.spec.ts — 7 tests: AC-W1 exit-0+<30s + AC-W2 both output files exist + AC-W3 SKELETON-* finding markers + AC-W4 locked observation substrings + AC-W5 findings.json shape (exactly 2 entries) + AC-W6 R5.3 banned-phrase regression guard + AC-W7 R6 sentinel regression guard; pnpm test:integration 12/12 green incl Phase 0 baseline 5/5; wall-clock 15.6s total / AC-W1 at 901ms / AC-W2..W7 1-9ms; roadmap v0.7 → v0.8 example.com → Peregrine PDP + finding-line precision Option G patch) — **done Day 2-3 (Session 10 2026-05-06)** ★ **WALKING-SKELETON 10/10 COMPLETE — Wednesday demo gate PASSED** ★

### Demo prep

- [x] Pin Peregrine URL across artifacts (locked Session 8 PD-04; reflected in roadmap v0.4/v0.5/v0.8 + handover block 6 + demo-scripts/wk-01.md)
- [x] Author `docs/specs/mvp/demo-scripts/wk-01.md` (8 sections: TL;DR + pre-demo checklist + 6-step demo flow + verbatim expected output + Q&A talking points + transparency table + week-2 preview + cross-references; 267 LOC) — **done Day 3 (Session 10 2026-05-06)**
- ⏭️ **Capture pre-demo happy-path screenshots** — **deferred per engineering-lead direction 2026-05-06**: wk-01.md verbatim output blocks already serve as ANSI-rendered copy-paste-ready slides + live demo produces fresh authentic output (preferred over pre-captured static screenshots for live screen-share scenarios)
- 🟡 **Wednesday demo execution** — **ACTIVE 2026-05-06** (gate PASSED via `pnpm test:integration` 12/12; acceptance suite at `tests/acceptance/walking-skeleton.spec.ts` validates entire pipeline; ready for live screen share against locked Peregrine PDP URL)
- [ ] Post-demo: log feedback to `docs/specs/mvp/demo-feedback.md` (NEW; will create after demo completes)
- [ ] T-SKELETON-010 (Playwright Test acceptance — `pnpm cro:audit --url=...` exits 0 + writes `./out/<slug>-audit.txt` with ≥1 finding line; <30s) — pending
- [ ] Wednesday demo (2026-05-06) — run `pnpm cro:audit --url=<peregrine PDP>` end-to-end through stubbed pipeline

---

## v1.7 changes (2026-05-05 — Phase 0 implementation complete)

First phase to ship under the per-phase corpus + walking-skeleton model. **Phase 0 implementation landed in a single 1-day session (Session 8, 2026-05-05) on `feat/week-1-walking-skeleton` branch.**

### Phase 0 row flipped: ⚪ not started → 🟢 implemented

All 8 task lines (T-PHASE0-TEST + T001-T005 + T-PHASE0-DOC + T-PHASE0-ROLLUP) marked `[x]` in `phase-0-setup/tasks.md` v0.6. Acceptance suite `tests/acceptance/phase-0-setup.spec.ts` runs 5/5 green via `pnpm test:integration`.

### R17 status bumps (CLAUDE.md §8c)

| Artifact | Before | After |
|---|---|---|
| `phase-0-setup/spec.md` | v0.5 `approved` | **v0.6 `implemented`** (will → `verified` when Phase 1 begins) |
| `phase-0-setup/plan.md` | v0.3 `approved` | **v0.4 `implemented`** |
| `phase-0-setup/tasks.md` | v0.5 `approved` | **v0.6 `implemented`** |
| `phase-0-setup/README.md` | v1.1 `approved` | **v1.2 `implemented`** |
| `phase-0-setup/phase-0-current.md` | did not exist | **NEW v1.0 `implemented`** (R19 rollup) |

### R19 rollup landed

`phase-0-setup/phase-0-current.md` v1.0 — 8 sections per `templates/phase-rollup.template.md`. Compressed Phase 0 system state for Phase 1 to read first (active modules, data contracts in effect [none], system flows, known limitations carried forward, open risks for Phase 1, conformance gate status, what Phase 1 should read, cost+time summary).

### R11.4 spec defects surfaced + patched during Phase 0 implementation

| # | Defect | Patch |
|---|---|---|
| 1 | spec.md AC-04 conflated "binaries preinstalled" with "extension CREATEd in DB" (`pgvector/pgvector:pg16` ships binaries but `/docker-entrypoint-initdb.d/` empty) | spec.md v0.3 → v0.4: AC-04 query switched from `pg_extension` (CREATEd) to `pg_available_extensions` (binaries-only). CREATE EXTENSION belongs to T005's `pnpm db:migrate` per existing §Assumptions design. AC-NN ID preserved (R18 append-only). |
| 2 | spec.md AC-05 cited `DATABASE_URL` but pre-existing `.env.example` (authored 2026-04-24, before the spec) uses `POSTGRES_URL` consistent with docker-compose POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB convention | spec.md v0.4 → v0.5: AC-05 env var name corrected to `POSTGRES_URL`. CLAUDE_MODEL also dropped (model name `claude-sonnet-4-*` is hardcoded per CLAUDE.md §2; no env var). AC-NN ID preserved. |

### Pre-authorized deviations from spec (CLAUDE.md §8b agent reasoning log)

- **pnpm 9 → pnpm 10.33.3** (matches local + back-compat with pnpm 9 workspaces). Pinned via `packageManager` field in root package.json.
- **engines.node: "22"** (CI-pinned even though local is Node v24). Matches `.nvmrc`.
- **T004 + T005 reframed from "author" → "VERIFY"**: `docker-compose.yml` + `.env.example` were pre-existing (authored 2026-04-24 alongside Phase 0 setup planning). User kickoff explicitly authorized verification-only treatment.

### Env install side-effect

Microsoft Visual C++ Redistributable installed via `winget install Microsoft.VCRedist.2015+.x64` to supply UCRT API set forwarders required by `turbo.exe` (and future Playwright Chromium binaries). One-time host fix; documented in root README troubleshooting + `phase-0-current.md` §4 known limitations.

### Commit chain (`feat/week-1-walking-skeleton`)

| SHA | Task | Files | AC |
|---|---|---|---|
| `9919449` | T-PHASE0-TEST + T001 (bundled) | 10 files / +395 LOC | AC-01 |
| `bb63cd0` | T002 — agent-core skeleton + Pino | 10 files / +1316 LOC | AC-02 |
| `90ab537` | T003 — apps/cli + cro:audit | 9 files / +372 LOC | AC-03 |
| `1e9ff98` | T004 — verify docker + spec v0.4 | 3 files / +33 LOC | AC-04 |
| `bd09040` | T005 — db:migrate stub + spec v0.5 | 5 files / +186 LOC | AC-05 |
| `42a21fb` | T-PHASE0-DOC — root README quickstart | 2 files / +138 LOC | (polish) |
| (this) | T-PHASE0-ROLLUP — phase-0-current.md + R17 status bumps | (multi) | (phase exit) |

### What Phase 1 should do next

Per `phase-0-current.md` §7 + `phase-1-perception/README.md` reading order:

1. Read `phase-0-current.md` (compressed Phase 0 state) — this rollup
2. Open `phase-1-perception/{README,spec,tasks}.md`
3. Apply BINDING condition C1 from Session 7 R17.4 review (T015 Playwright timeout budgets ≤20s/site; ≤60s for 3 sites; `waitUntil: 'domcontentloaded'`)
4. T014 (PageStateModel Zod schema) is forward-pulled to week 1 per `implementation-roadmap.md` §6 — needed by walking-skeleton T-SKELETON-002 contract test

### Implementation-roadmap.md week 1 progress

Per [implementation-roadmap.md](../implementation-roadmap.md) §7 Week 1:

- [x] T-PHASE0-TEST + T001-T005 (Phase 0 setup) — done
- [ ] T014 forward-pulled from Phase 1 (PageStateModel schema)
- [ ] T101 forward-pulled from Phase 6 (HeuristicSchemaExtended)
- [ ] T0B-001..T0B-005 (Phase 0b infra)
- [ ] T-SKELETON-001..010 (walking skeleton stubs)
- [ ] Wednesday demo (2026-05-06) — run `pnpm cro:audit --url=<peregrine PDP>` end-to-end through stubbed pipeline

---

## v1.6 changes (2026-05-01 — Round 6: /speckit.implement ↔ neural-dev-workflow hook integration)

Wires the layered model: `/speckit.implement` orchestrates phase mechanics; `neural-dev-workflow` injects per-task discipline. The two compose via `.specify/extensions.yml` hooks at phase boundaries. **First substantive (non-doc-hygiene) round** in the 2026-05-01 sync — adds new files (sub-skills + extension registration) and changes execution behavior.

### Files modified (Round 6)

| File | Change | Purpose |
|---|---|---|
| `.specify/extensions.yml` | `installed:` list expanded to register `neural-dev-workflow` v1.0.0; `before_implement` + `after_implement` hook lists extended (added `neural.dev.workflow.brief` + `neural.dev.workflow.pr` alongside existing git commit hooks) | Wire the integration |
| `.claude/skills/neural-dev-workflow-brief/SKILL.md` | **New file** | `before_implement` hook command: phase-level Brief + Kill criteria + R17.4 verification + comprehension-debt pacing pre-check |
| `.claude/skills/neural-dev-workflow-pr/SKILL.md` | **New file** | `after_implement` hook command: PR Contract draft + Spec Coverage + R17 lifecycle bumps (`approved → implemented`) + R19 phase rollup scaffold + INDEX.md status flip + final validation pass |
| `.claude/skills/neural-dev-workflow/SKILL.md` | Frontmatter `description:` updated to mention layered model + hooks; "When NOT to invoke" clarified (`/speckit.implement` allowed via hooks; speckit-analyze separated; phase-review-prompt separated); new "## Integration with /speckit.implement (layered model)" section added; cross-references expanded | Sync skill description with layered model |
| `.claude/skills/neural-dev-workflow/references/harness-layers.md` | Context layer: R1-R23 → R1-R26; constitution v1.3 cited; sibling docs (architecture / testing-strategy / risks / spec-driven-workflow / implementation-roadmap / README v2.1) added; Knowledge layer: dead `archive/2026-04-gap-analyses/` ref replaced with `sessions/` + `risks.md`; Coordination layer: R19 phase rollups + R20 impact.md + R17.4 phase-review templates + hook integration added | Sync with Round 1-5 corpus |
| `.claude/skills/neural-dev-workflow/references/delegation-and-pacing.md` | Bucket 3 examples: dropped "v2.3 AnalyzePerception enrichments" (corpus moved); added current phase-shipped examples (perception v2.4/v2.5 envelope, context capture v3.0, two-store pattern, heuristic provenance per R15.3.1, Constitution rules with R22.2 provenance, R20 shared-contract changes) | Sync with Round 1-5 corpus |
| `docs/specs/mvp/README.md` v2.1 → v2.2 | Session-bootstrap kickoff-prompt STANDING DIRECTIVES block reframed for layered model | Sync |
| `docs/specs/mvp/spec-driven-workflow.md` v1.1 → v1.2 | §12.1 Spec Kit integration diagram updated to show `/speckit.implement` WITH hooks instead of "neural-dev-workflow (NOT /speckit.implement)" | Sync |
| `docs/specs/mvp/sessions/session-2026-04-30-handover.md` | Note appended at "start Phase 0 implementation" line documenting Round 6 supersession of "NOT /speckit.implement" guidance | Preserve historical accuracy + flag supersession |
| `docs/specs/mvp/phases/INDEX.md` v1.5 → v1.6 | This changelog entry | Self-reference |

### What `/speckit.implement` does now (post-Round-6)

1. User invokes `/speckit.implement` (or it's invoked by another command)
2. Spec Kit reads `.specify/extensions.yml` → finds `before_implement` hook list → fires hooks in order:
   - `neural.dev.workflow.brief` (mandatory; R17.4 gate verification + Phase Brief + Kill criteria + comprehension-debt check) — STOPs if phase not approved
   - `speckit.git.commit` (optional; user prompt to commit outstanding changes)
3. Spec Kit Outline §3-§9 executes — task-by-task implementation. The `neural-dev-workflow` skill auto-invokes per task via Skill tool routing because each task description matches the skill's `description:` frontmatter.
4. Spec Kit fires `after_implement` hook list:
   - `neural.dev.workflow.pr` (mandatory; final validation + R17 lifecycle bumps + R19 rollup scaffold + INDEX.md flip + PR Contract draft + Spec Coverage)
   - `speckit.git.commit` (optional; user prompt to commit final changes)

### Known limitations (post-Round-6)

- `.specify/scripts/powershell/check-prerequisites.ps1` may not yet recognize the `phases/phase-<N>-<name>/` folder convention as a feature dir. If `/speckit.implement` fails to resolve a feature dir for Phase 0, fall back to natural-language prompt + skill auto-routing per task (Phase 0 is 5 tasks — manageable manually).
- Full end-to-end automation lands when Phase 9 ships `pnpm spec:matrix` + `spec:rollup` + `spec:size` + `spec:validate` + `spec:index` + `spec:pack` per `scripts/README.md`.
- The 4 phase-plan drafts (Phase 2/3/4/5) at `(R1-R23)` carry-over from Round 3 will self-heal via JIT analyze when each phase polishes pre-implementation.

### Outcome (post-Round-6)

`/speckit.implement` is now the canonical command for phase implementation. neural-dev-workflow discipline is automatically applied at phase boundaries via hooks + per task via skill auto-routing. The layered model is documented end-to-end across CLAUDE.md, README v2.2, spec-driven-workflow v1.2, and the three neural-dev-workflow skill files. **Phase 0 implementation can now begin via `/speckit.implement` — fall back to manual per-task prompts if feature-dir resolution fails.**

---

## v1.5 changes (2026-05-01 — Round 1-5 doc hygiene sync)

Five-round sync to align all MVP-root reference files with the per-phase corpus reality + complete the constitution R1-R23 → R1-R26 metadata fix + ship a copy-paste-ready session bootstrap prompt in the entry-point README. **No phase artifacts modified** beyond the Phase 0 README v1.0 → v1.1 paper-cut (Round 4 item 2). All five rounds are doc-hygiene only — zero scope, code, or behavior changes.

| Round | Files modified | Result |
|---|---|---|
| 1 | `docs/specs/mvp/README.md` v1.0 → v2.0 (full rewrite); `CLAUDE.md` (10 surgical edits) | Entry point + reading order + cheat sheet aligned to per-phase corpus; R1-R26 (was R1-R16); architecture.md §6.5 ref (was broken plan.md §3.2); 11 root files + 4 subfolders mapped |
| 2 | `docs/specs/mvp/spec-driven-workflow.md` v1.0 → v1.1 (9 edits) | §12.1 per-phase Spec Kit flow diagram; §12.3 sync table reframed; §12.5.2 reframed REALIZED via phase READMEs + INDEX.md v1.4; §12.5.4 current+v1.2-target split; §12.6 R17.4 review-gate xref; cross-references expanded to R23-R26 + PRD §10.6/§10.9/§10.10 + CLAUDE.md §8c+§8d |
| 3 | `docs/specs/mvp/constitution.md` v1.2 → v1.3 (4 edits); `docs/specs/mvp/architecture.md` (2 edits); `.specify/memory/constitution.md` re-synced + sync notice updated 2026-05-01 | Constitution frontmatter + Summary + R22.4 + R22.6 metadata fixes (body R1-R26 unchanged); R22.6 temperature=0 codification deferred from v1.3 to v1.4 with rationale; architecture.md line 262 R1-R23 → R1-R26 + project-structure tree updated to current per-phase reality (phases/, templates/, scripts/, sessions/, implementation-roadmap files) |
| 4 | `docs/specs/mvp/PRD.md` v1.2 → v1.2.1 (§1 framing); `docs/specs/mvp/phases/phase-0-setup/README.md` v1.0 → v1.1 (lines 41 + 74 + 78 fixes); this INDEX.md v1.4 → v1.5 | PRD §1 Status + "This document's role" reframed to per-phase invocation; Phase 0 README "(generated by Spec Kit CLI from PRD.md)" reframed + R1-R21 → R1-R26 reading-order fix; this changelog entry added |
| 5 | `docs/specs/mvp/README.md` v2.0 → v2.1 (added "## Session bootstrap (kickoff prompt)" section); this INDEX.md v1.5 changelog updated to Round 1-5 | Copy-paste-ready session-bootstrap prompt now lives in the entry-point README. Synthesizes Tier 2-5 reading guidance + every standing directive (skill choice, modular prompt rule, R20 impact / R23 kill criteria triggers, walking-skeleton + Wednesday demo cadence, R17.4 review-gate, R6 heuristic IP boundary, temperature=0 invariant, Phase 0b D1+D2 binding conditions). New sessions paste verbatim — no editing required (just swap active phase if not Phase 0). |

### Outcome (post-Round-5)

All MVP-root reference files now cite **R1-R26** + the **per-phase artifact pattern** consistently. No root-level `spec.md` / `plan.md` / `tasks.md` referenced anywhere. PRD §1 + spec-driven-workflow §12.1 + README v2.1 + CLAUDE.md §1 + architecture.md tree + INDEX.md decision table all describe the same per-phase flow. **README v2.1 ships the session-bootstrap prompt — new sessions can hit the ground running.** Ready for Phase 0 implementation kickoff.

### Known stale references deliberately NOT fixed in Round 1-4

- Phase 2/3/4/5 `plan.md` line 19 still cite `(R1-R23)` — drafts; will self-heal via JIT analyze pattern (CLAUDE.md §8c) when each phase polishes pre-implementation. Touching them now would short-circuit the JIT discipline.
- Other phase READMEs (1, 1b, 1c, 2, 3, 4, 4b, 5, 5b, 6, 7, 8, 9) may have similar minor framing — not audited; treat per-phase JIT.
- `tasks-v2.md` v2.3.4 punch-list (carried in v1.3 / v1.4 changelog sections above) — not in scope for doc-hygiene rounds; lands when next master-plan amendment ships.

---

## v1.2 changes (2026-04-28 Session 4)

Three phase-folder spec corpora shipped (spec/plan/tasks/impact/README/checklist each):

| Phase | Status | Key surface | Risk |
|---|---|---|---|
| **0b** — Heuristic Authoring (LLM-assisted, engineering-owned) | spec corpus shipped | T0B-001..T0B-005 (drafting prompt template, verification protocol, PR Contract Proof block, `pnpm heuristic:lint` CLI, `heuristics-repo/README.md`) + T103/T104/T105 (≈15+10+5=30 heuristics per F-012 v1.2) | LOW — content authoring; HeuristicSchemaExtended already locked in Phase 6 v0.3 |
| **7** — Analysis Pipeline | spec corpus shipped | T113-T134 (22 tasks); 5-step pipeline (deep_perceive → evaluate → self_critique → ground → annotate_and_store); FIRST runtime activation of R10/R13 TemperatureGuard + R6 LangSmith trace channel + R5.6 separate self-critique call; Finding lifecycle producer; 8 GR rules + GR-012 benchmark validation | **HIGH** — analytical apex; 3 first activations; 5 append-only producers |
| **8** — Orchestrator + Cross-Page | spec corpus shipped | T135-T155 (21 tasks); LangGraph subgraph composition (BrowseGraph + AnalysisGraph); AuditState 3-phase coordination (Phase 4b T4B-011 + Phase 7 T113 + Phase 8 T135); cross-page PatternDetector (F-014 folded into T139); reproducibility_snapshot consumer; PostgresCheckpointer; ★ MVP COMPLETE gate ★ (T148 + T149 + T150) | **HIGH** — AuditState extension; PatternFinding contract; MVP COMPLETE gate; 3-phase merge surface |

### tasks-v2.md patch v2.3.3 (this session)

Applied per CLAUDE.md standing directive (Option A drift resolution):

- **Phase 0b section ADDED** (T0B-001..T0B-005 — drafting prompt, verification protocol, PR Contract Proof block, `pnpm heuristic:lint`, repo README) — engineering-owned LLM-assisted authoring infrastructure per PRD F-012 v1.2 amendment 2026-04-26
- **T103-T105 counts REDUCED** from 50/35/15 (=100, v2.0) to 15/10/5 (=30, F-012 v1.2 MVP scope) — additional 70 deferred to v1.1+ to reach §09.3 master target
- **T103-T105 ownership** clarified: definitions remain in Phase 6 section (engine consumes), but OWNED by Phase 0b workstream (content producer)
- See `docs/specs/mvp/phases/phase-0b-heuristics/{spec,plan,tasks,impact,README}.md` for full Phase 0b authoring workflow

### Punch-list candidates (v2.3.4 — NOT applied this session)

- Add discrete T-ID for GR-012 benchmark validation (currently folded into Phase 7 T130 EvidenceGrounder acceptance per phase-7-analysis/plan.md §3)
- Add discrete T-ID for cross-page PatternDetector (currently folded into Phase 8 T139 AuditCompleteNode acceptance per phase-8-orchestrator/plan.md §3)
- Constitution R22.6 stale xref: PRD §10.1 + R13 cite "(R10)" for temperature=0; should cite R13 directly (carry-over from Session 3)
- Phase 2 "28 vs 29 MCP tools" mismatch in impact.md + plan.md (carry-over from Session 2)

---

## v1.1 changes (2026-04-28 Session 3)

Four NEW sub-phase folders + two refreshes:

### NEW sub-phases
| Sub-phase | Source | Adds |
|---|---|---|
| 1b — Perception Extensions v2.4 | `docs/Improvement/perception_layer_spec.md` items 1-10; §07 §7.9.2 | 10 perception extractors (pricing, click target, sticky, popups, friction, social proof, microcopy, attention, commerce, currency switcher) + v2.4 Zod schema |
| 1c — PerceptionBundle Envelope v2.5 | `docs/Improvement/perception_layer_spec.md` items 1, 2, 6 + Shadow DOM/iframe/pseudo-element; §07 §7.9.3 | PerceptionBundle envelope with ElementGraph + FusedElement + settle predicate + 5 traversal extensions + nondeterminism flags + warnings |
| 4b — Context Capture Layer v1.0 | `docs/Improvement/context_capture_layer_spec.md` items 1-6; §37 | Pre-perception "consultant intake form" — 5 dimensions (business / page / audience / traffic / brand) with `{value, source, confidence}`; URLPattern + HtmlFetch + JSON-LD inference; CLI clarification; `context_profiles` table; HeuristicLoader filter (T4B-013) |
| 5b — Multi-Viewport + Triggers + Cookie | §07 §7.9.2 multi-viewport + §20 trigger taxonomy + improvement spec §4.4 | Multi-viewport audit (opt-in); 5 new triggers (hover/scroll/time/exit-intent/form-input); cookie banner detect+policy; popup behavior probing |

### Phase refreshes
| Phase | Version | Adds |
|---|---|---|
| 4 (Safety + Infra + Cost) | v0.2 → v0.3 | T080a RobotsChecker (§11.1.1 / REQ-SAFETY-005) + context_profiles table slot reservation in T070 schema baseline |
| 6 (Heuristic KB) | v0.2 → v0.3 | AC-11 + R-09 contract surface for `HeuristicLoader.loadForContext(profile)` (T4B-013); HeuristicSchemaExtended manifest selectors (`archetype`/`page_type`/`device`) |

---

## Reading rules

Per Constitution R17-R21 + PRD §12.5:

1. **Load this INDEX first.** Identify the target phase.
2. **Load `phase-<N>-<name>/README.md`** (summary, ~150 tokens).
3. **Decide whether full spec/tasks are needed.** Most tasks only need the README + task description + cited REQ-IDs.
4. **For full context:** run `pnpm spec:pack --phase <N>` to get the pre-bundled context-pack (when the script lands).
5. **Never load ALL phases at once.** Progressive disclosure (Rule: CLAUDE.md §1, PRD §12.5.1).
6. **For inter-phase context:** read the predecessor phase's rollup (`phase-<N-1>-current.md`), NOT the full predecessor artifacts.
7. **Sub-phases (1b, 1c, 4b, 5b) load AFTER the parent phase's rollup** (see Depends on column).

---

## Rollup locations (once phases complete)

| After phase N completes | Rollup location | State transition |
|---|---|---|
| Phase 0 | `phase-0-setup/phase-0-current.md` | approved → verified when Phase 1 starts |
| Phase 1 | `phase-1-perception/phase-1-current.md` | approved → verified when Phase 1b starts |
| **Phase 1b** | `phase-1b-perception-extensions/phase-1b-current.md` | approved → verified when Phase 1c starts |
| **Phase 1c** | `phase-1c-perception-bundle/phase-1c-current.md` | approved → verified when Phase 2 starts |
| Phase 2 | `phase-2-tools/phase-2-current.md` | approved → verified when Phase 3 starts |
| Phase 3 | `phase-3-verification/phase-3-current.md` | approved → verified when Phase 4 starts |
| Phase 4 | `phase-4-safety-infra-cost/phase-4-current.md` | approved → verified when Phase 4b/5 start |
| **Phase 4b** | `phase-4b-context-capture/phase-4b-current.md` | approved → verified when Phase 6 starts |
| Phase 5 | `phase-5-browse-mvp/phase-5-current.md` | approved → verified when Phase 5b/7 start |
| **Phase 5b** | `phase-5b-multi-viewport-triggers-cookie/phase-5b-current.md` | approved → verified when Phase 7 starts (or independently if 5b deferred to v1.1) |
| Phase 6 | `phase-6-heuristics/phase-6-current.md` | approved → verified when Phase 7 starts |
| Phase 7 | `phase-7-analysis/phase-7-current.md` | approved → verified when Phase 8 starts |
| Phase 8 | `phase-8-orchestrator/phase-8-current.md` | approved → verified when Phase 9 starts |
| Phase 9 (MVP complete) | `phase-9-delivery/phase-9-current.md` | approved → verified on first real client audit |

At each phase exit:
1. `pnpm spec:rollup --phase N` scaffolds the rollup (when the script lands; currently hand-authored)
2. Engineering lead fills the manual sections
3. Reviewer approves; status → `approved`
4. Phase N+1 work begins by reading the rollup
5. When Phase N+1 completes, phase N rollup → `verified`

---

## File layout per phase

```
phase-<N>-<name>/
├── README.md               ~150 token summary (required)
├── spec.md                 phase-scoped spec (<500 lines; split if larger)
├── tasks.md                phase tasks (<500 lines)
├── plan.md                 implementation plan (<500 lines; sequencing + kill criteria)
├── impact.md               (required when shared contracts touched per R20)
├── checklists/
│   └── requirements.md     spec-quality checklist
├── context-pack.md         pre-bundled agent context (generated by pnpm spec:pack — pending)
└── phase-<N>-current.md    rollup (created at phase exit)
```

---

## Maintenance

This index SHALL be regenerated by `pnpm spec:index` whenever a phase is added, status changes, or rollup lands. Until that script lands, hand-edits are the operating mode — bump the `version` field and `updated` date on each edit, and add a row to "v1.1 changes" or open a new "v1.X changes" section.

**Hand-edit policy:** prefer surgical Edit calls over full file rewrites once `pnpm spec:index` exists; until then, rewrites are acceptable when adding sub-phases.

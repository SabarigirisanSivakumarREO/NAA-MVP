---
title: Neural MVP — Rolling Session Handover
artifact_type: session-handover
status: complete
version: 1.0
last_updated: 2026-05-01
last_session_number: 7
last_session_outcome: Phase 1 + Phase 6 R17.4 approved; spec-prep arc complete for week-1 + week-2 forward-pulled deps; Peregrine T-shirt PDP locked as week-1 demo target

description: "Single rolling handover doc. Replaces per-session handover files from Session 8 onwards. Each session-end Claude updates blocks 1+2+3+5 in place; block 4 is static; block 6 updates when demo target changes. Never create per-session files. Old session detail lives in git history (git log -p docs/specs/mvp/sessions/session-handover.md). Predecessor per-session handovers at session-2026-04-30-handover.md (Session 6) + session-2026-05-01-handover.md (Session 7) preserved for archival reference."

cross_references:
  - docs/specs/mvp/phases/INDEX.md (current phase decision table)
  - docs/specs/mvp/implementation-roadmap.md (week-by-week plan)
  - docs/specs/mvp/sessions/session-2026-04-30-handover.md (Session 6 archive — Phase 0/0b approval narrative)
  - docs/specs/mvp/sessions/session-2026-05-01-handover.md (Session 7 archive — Phase 1/6 approval narrative)
  - CLAUDE.md §8c (per-phase artifact maintenance) + §8d (R17.4 phase review)
---

# Neural MVP — Rolling Session Handover

> **Update discipline:** Each session-end Claude updates blocks 1 (current state), 2 (standing conditions), 3 (pending decisions), and 5 (session log — append a 3-line bullet). Block 4 (reading order) is static. Block 6 (demo target) updates when the URL or scope changes. Never create per-session files. Old detail accessible via `git log -p docs/specs/mvp/sessions/session-handover.md`.

---

## 1. Current state ledger

**As of 2026-05-01 (post-Session 7):**

### Phase status

| Phase | Status | Approved in | Implementation timing |
|---|---|---|---|
| Phase 0 (Setup) | ✅ approved | Session 6 | Week 1 |
| Phase 0b (Heuristics infra) | ✅ approved | Session 6 | Week 1 |
| **Phase 1 (Browser Perception)** | ✅ **approved** | **Session 7** | Week 1 (T014) + Week 2 (full) |
| Phase 1b (Perception Ext v2.4) | ⚪ draft | future JIT | Week 3 (ride-along TBD) |
| Phase 1c (PerceptionBundle v2.5) | ⚪ draft | future JIT | Week 3+ |
| Phase 2 (MCP Tools) | ⚪ draft | future JIT | Week 4 |
| Phase 3 (Verification) | ⚪ draft | future JIT | Week 5 |
| Phase 4 (Safety + Infra + Cost) | ⚪ draft | **next analyze target** | Week 3 |
| Phase 4b (Context Capture) | ⚪ draft | future JIT | Week 6 |
| Phase 5 (Browse MVP) | ⚪ draft | future JIT | Week 7-8 |
| Phase 5b (Multi-viewport) | ⚪ draft | future JIT | Week 11 |
| **Phase 6 (Heuristic KB)** | ✅ **approved** | **Session 7** | Week 1 (T101) + Week 4 (full) |
| Phase 7 (Analysis) | ⚪ draft | future JIT | Week 5-6 |
| Phase 8 (Orchestrator) | ⚪ draft | future JIT | Week 8-9 |
| Phase 9 (Foundations + Delivery) | ⚪ draft | future JIT | Week 10-12 |

**4 of 15 phases approved.** All week-1 + week-2 forward-pulled contract dependencies have spec coverage.

### Operational integration state

- `/speckit.implement` ↔ `neural-dev-workflow` integration **active** via `.specify/extensions.yml` hooks (commit `e0ed5a0`):
  - `before_implement` → `neural-dev-workflow-brief` (R17.4 verify + Brief + Kill criteria + pacing)
  - `after_implement` → `neural-dev-workflow-pr` (PR Contract + Spec Coverage + R17 status bumps + R19 rollup + INDEX flip)
- **Use `/speckit.implement <task-id>` per task** — hooks handle workflow ceremony automatically.
- Centralized phase-review templates at `docs/specs/mvp/templates/phase-review-{prompt,report.template}.md` v1.0.

---

## 2. Standing conditions (BINDING obligations from past R17.4 reviews — delete when consumed)

These conditions ride along with the implementing task. Delete each row when the implementing task lands and the condition is satisfied.

### Phase 0b — Session 6 review

| ID | Severity | Condition | Implementing task | Source |
|---|---|---|---|---|
| **D1** | BINDING | T0B-004 lint CLI MUST redact Zod-error `received: <value>` content from stdout/stderr (heuristic body content leaks via lint error messages). Emit `<file>: <field-path> — <error_class>` only. Add conformance-test assertion using sentinel string `NEURAL_TEST_FIXTURE_BODY`. | T0B-004 | [phase-0b-heuristics/review-notes.md](../phases/phase-0b-heuristics/review-notes.md) |
| **D2** | BINDING | T0B-005 README MUST explicitly forbid Slack/email/screenshot/support-ticket sharing of drafting LLM responses. (Workflow doc enforcement of R6 human-protocol channel.) | T0B-005 | same |
| **D3** | OPTIONAL | Pre-commit hook rejecting `^.heuristic-drafts/` commits. Defer to v1.0.1 if needed. | T0B-005 author or v1.0.1 | same |

### Phase 1 — Session 7 review

| ID | Severity | Condition | Implementing task | Source |
|---|---|---|---|---|
| **C1** | BINDING | T015 implementation MUST define explicit per-step Playwright timeout budgets summing to ≤ 20s/site (≤ 60s for 3 sites). Use `waitUntil: 'domcontentloaded'` not `'load'` for `page.goto`. Document budget in T015 brief or plan.md §Phase 1 Design at impl time. | T015 | [phase-1-perception/review-notes.md](../phases/phase-1-perception/review-notes.md) |
| **C2** | OPTIONAL | Append Phase 1b + Phase 1c rows to impact.md §Forward Contract — Phase 1b imports PageStateModel + extends perception layer; Phase 1c wraps PageStateModel into PerceptionBundle envelope. v0.3.1 patch anytime. | impact.md author | same |
| **C3** | OPTIONAL | Add per-task hour estimate + phase-level total to plan.md §9. Phase 0b had ~26h+~7h; Phase 1 should too for week-sequencing calibration. | plan.md author | same |

### Phase 6 — Session 7 review

| ID | Severity | Condition | Implementing task | Source |
|---|---|---|---|---|
| **C1** | BINDING | T106 MUST catch `ZodError` BEFORE logging; emit only `{ heuristic_id?, path: errors[].path.join('.'), error_class: errors[].code }` — NEVER `errors[].message` (contains literal `received: <body>` content). r6-ip-boundary.test.ts MUST include sentinel `NEURAL_TEST_FIXTURE_BODY` assertion. **Mirrors Phase 0b D1 pattern (T0B-004) — propagating R6 lesson forward.** | T106 | [phase-6-heuristics/review-notes.md](../phases/phase-6-heuristics/review-notes.md) |
| **C2** | BINDING | r6-ip-boundary.test.ts (T-PHASE6-TESTS) MUST cover BOTH (a) shaped-object Pino redaction assertions AND (b) string-interpolation anti-pattern detection. Test fails an implementation that template-interpolates body into `logger.info('loaded ' + body)`. | T-PHASE6-TESTS | same |
| **C3** | OPTIONAL | T106 acceptance specs FileSystemHeuristicLoader.loadForContext stub explicitly: throw `Error('not implemented in Phase 6 — Phase 4b T4B-013 owns')`. T112 asserts the stub throws when called directly. | T106 implementer or v0.4.1 polish | same |
| **C4** | OPTIONAL | T106 handles `fs.readdir` ENOENT (heuristics-repo/ missing) — return empty KB + single warn-level log. Distinct from "exists but empty" (silent empty). | T106 implementer | same |
| **C5** | OPTIONAL | README.md "Depends on" updated to `Phase 0 + Phase 0b + Phase 4b` per INDEX.md row 6. Phase 4 dep dropped or downgraded to "infrastructure baseline". | README author | same |

---

## 3. Pending decisions (delete when decided)

| ID | Decision | Owner | Trigger to decide |
|---|---|---|---|
| **PD-01** | Phase 1b + 1c folding — week 2 ride-along vs slip to weeks 3-4. | engineering lead | After Phase 1 ships in week 2 |
| **PD-02** | Phase 2 forward-pull — bring T-PHASE2-TYPES + T019 + T024 + T048 into week 4 to ease week-5 load? | engineering lead | After Phase 6 ships in week 4 |
| **PD-03** | Next JIT analyze target = Phase 4 (week-3 dependency: T070 RLS first runtime + T073 LLM cornerstone temperature=0 first runtime + R6 LangSmith trace channel). NOT urgent during week-1 implementation. | engineering lead | Just-before week 3 begins |
| **PD-04** | Phase 1 T015 integration-test fixture set — current spec is `example.com` (simple) + `amazon.in` (complex/bot) + Shopify demo (TBD). Replace Shopify demo with `peregrineclothing.co.uk` T-shirt PDP (Shopify-powered real D2C — better real-world coverage than `example.com` too)? | T015 implementer (week 2) | When T015 lands |

---

## 4. Reading order for new sessions (static)

When a new Claude session starts:

1. **CLAUDE.md** (auto-loaded) — confirm §8c + §8d present.
2. **This file** (`docs/specs/mvp/sessions/session-handover.md`) — current rolling state.
3. **`docs/specs/mvp/phases/INDEX.md`** — phase decision table; identify the active phase.
4. **`docs/specs/mvp/implementation-roadmap.md`** — week-by-week task plan.
5. **Active phase folder** — `phase-<N>-<name>/{README,tasks,spec,plan}.md` for the phase the session is working on.
6. Per task: invoke `/speckit.implement <task-id>` and let the hook chain (`neural-dev-workflow-brief` → impl → `neural-dev-workflow-pr`) load the right context.

**Do NOT load:**
- All 15 phase folders at once (progressive disclosure per CLAUDE.md §1, PRD §12.5).
- Predecessor per-session handovers (`session-2026-04-30-handover.md`, `session-2026-05-01-handover.md`) unless researching the historical "why" of a specific decision — block 5 below summarizes what each session shipped.

**For BINDING conditions:** check block 2 above before implementing any task whose ID appears in the "Implementing task" column.

---

## 5. Session log (append-only, ~3 lines per session)

- **Session 6 (2026-04-30)** — Phase 0 + Phase 0b R17.4 approved; centralized phase-review templates shipped; walking-skeleton roadmap v0.3 + visual.md + .html; constitution.md sync fix to .specify/memory/. Commits: `b8994a1`, `bbca2a9`, `2ba6b6e`. Per-session archive: [session-2026-04-30-handover.md](session-2026-04-30-handover.md).

- **Session 7 (2026-05-01)** — Phase 1 v0.3 polish (8 analyze findings) + R17.4 review APPROVE with C1 BINDING (T015 timeout budgets); Phase 6 v0.4 catch-up polish (3 HIGH + 1 MEDIUM analyze findings; closed multi-artifact version drift v0.1/v0.2/v0.3 → v0.4) + R17.4 review APPROVE with C1+C2 BINDING (T106 Zod-error sanitization mirroring Phase 0b D1 + r6-ip-boundary.test.ts string-interpolation coverage); INDEX.md v1.4 → v1.6; /speckit.implement ↔ neural-dev-workflow integration via extension hooks; rolling session-handover.md established (this file). Commits: `4bd1f5c`, `e0ed5a0`, `26b7a72`, `2ee7914`, `cc657da`. Per-session archive: [session-2026-05-01-handover.md](session-2026-05-01-handover.md).

---

## 6. Demo target URL (week 1 + ongoing)

**Demo command (locked for week 1+):**

```bash
pnpm cro:audit --url='https://www.peregrineclothing.co.uk/collections/t-shirts/products/heavyweight-t-shirt?colour=Navy'
```

**Why this URL:**

- Real D2C clothing brand (Peregrine Clothing — UK heritage); not a placeholder.
- **Shopify-powered** — exercises the same e-commerce platform Phase 1 T015 originally planned to test via "Shopify demo (TBD)" fixture.
- Product Detail Page (PDP) with full e-commerce surface: product gallery, variant selector (`?colour=Navy` query string), price, add-to-cart, related products, breadcrumbs — typical CRO audit target.
- D2C archetype maps to Phase 6 v0.4 manifest selector example (`archetype: ['D2C']`, `page_type: ['PDP']`) — useful as a reference fixture once Phase 4b T4B-013 ContextProfile filtering ships.
- Stable public URL; does not require auth.

**Implications:**

- **Walking-skeleton stubs (T-SKELETON-001..010)** — synthetic PageStateModel in T-SKELETON-002 should reflect Peregrine metadata (`metadata.url = '<peregrine-url>'`, `metadata.title = 'Heavyweight T-Shirt – Navy | Peregrine Clothing'`, etc) so demo output looks real, not synthetic-bland.
- **Phase 1 T015 integration-test fixtures (week 2)** — pending decision PD-04 above. Recommend: replace Shopify demo with this URL (Shopify-powered + real D2C; better coverage than `example.com` too).
- **Phase 1 spec.md AC-10 + R-11** currently cite `example.com` + `amazon.in` + "Shopify demo". When T015 lands in week 2, the implementer should swap the Shopify demo placeholder for this URL — captured in PD-04. Keep `example.com` (simple control) and `amazon.in` (complex + bot detection) for diversity.
- **Wednesday demo headline:** "Same `pnpm cro:audit` command, every Wednesday. This week: every layer stubbed; pipeline runs end-to-end and emits Neural-shaped output for a real D2C product page. In 11 weeks: every layer real."

---

## Cross-references

- [`docs/specs/mvp/phases/INDEX.md`](../phases/INDEX.md) — phase decision table (current at v1.6)
- [`docs/specs/mvp/implementation-roadmap.md`](../implementation-roadmap.md) — week-by-week plan
- [`docs/specs/mvp/templates/phase-review-prompt.md`](../templates/phase-review-prompt.md) — R17.4 review template
- [`CLAUDE.md`](../../../CLAUDE.md) §8c + §8d — phase artifact maintenance + R17.4 review gate
- Predecessor per-session handovers (archival; do not read by default):
  - [`session-2026-04-30-handover.md`](session-2026-04-30-handover.md) — Session 6
  - [`session-2026-05-01-handover.md`](session-2026-05-01-handover.md) — Session 7

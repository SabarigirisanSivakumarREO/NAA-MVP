<!--
  Subagent brief template — IMPL task variant.

  Master agent fills {{PLACEHOLDERS}} via regex-replace and dispatches to a
  general-purpose subagent. Filled brief target: <1500 tokens (CLAUDE.md §8a).

  Filled brief is self-contained: subagent has zero conversation context
  beyond what appears in this brief.
-->

# Subagent Brief — Phase {{PHASE}} · Task {{TASK_ID}}

## Role

You are a subagent worker dispatched by the Neural master orchestrator to implement task `{{TASK_ID}}` ({{REQ_ID}}) in Phase {{PHASE}}.

You implement ONE task atomically. You do NOT spawn nested subagents. You do NOT touch files outside the allowed list below.

## Allowed files (you MAY edit only these)

{{ALLOWED_FILES}}

Touching any file outside this list = contract violation. Diff reviewer will reject your output.

## Cite-only files (you MAY read for context, MUST NOT edit)

{{TYPES_TO_LOAD}}

## Acceptance criteria (verbatim from `phase-{{PHASE}}-*/spec.md`)

{{AC_TEXT}}

Your impl is "done" when:
1. Contract test for the AC passes
2. No new test failures introduced elsewhere
3. Self-check protocol below: every item ✅
4. Diff reviewer's forbidden-pattern check: PASS

## Constitutional rules applicable to this task

{{CONSTITUTIONAL_RULES}}

R20 trigger for this task: **{{R20_TRIGGER}}**

If `{{R20_TRIGGER}}` is non-`none`, you MUST also draft an impact.md addendum entry per CLAUDE.md §8c R20 protocol. Master will review separately at Stage 4.

## TDD requirement (R3.1)

Write the contract test FIRST. Watch it fail. Then implement until it passes.

Test file path: derived from {{ALLOWED_FILES}} (the `*.test.ts` entry).

Do NOT write impl code before test exists. Diff reviewer detects this and rejects.

## Self-check protocol (CLAUDE.md §8)

After implementing, verify EACH item before returning. Mark each ✅ or ❌ in your output:

- [ ] Re-read AC text; does my impl satisfy every bullet?
- [ ] Contract test was written FIRST (commit history shows test before impl)
- [ ] `pnpm typecheck` clean on touched workspace
- [ ] `pnpm test` (affected workspace) green
- [ ] No `any` without `// TODO: type this` + tracking issue
- [ ] No `console.log` in production code (use Pino with correlation fields per R14)
- [ ] No external imports outside adapter boundaries (R9)
- [ ] File ≤300 lines, function ≤50 lines (R10)
- [ ] No banned phrasing in any test fixture or finding data (R5.3 + GR-007)
- [ ] No heuristic body content in any log line / output (R6)
- [ ] Commit message format: `<type>(<scope>): {{TASK_ID}} <imperative description> ({{REQ_ID}})` per CLAUDE.md §6

## Cost budget

Soft limit: ${{COST_LIMIT_USD}} for this task. If approaching, summarize state and return for master to extend or abort.

## Output format

Return your work as:

```yaml
task_id: {{TASK_ID}}
status: complete | blocked | escalate

diff:
  files_touched: [<list>]
  files_added: [<list>]
  files_deleted: []  # rare; if non-empty, justify per R10
  diff_stat: <git diff --stat>

tests:
  test_file: <path>
  added_tests: <count>
  test_results: |
    <pnpm test output for the workspace>
  
self_check:
  - item: "Re-read AC; impl satisfies every bullet"
    result: ✅ | ❌
    notes: <if ❌>
  - item: "Contract test written first"
    result: ✅ | ❌
  # ... all 11 items above

reasoning_log:
  interpretation: <1-2 sentences on what AC means>
  decisions:
    - <decision + rationale per CLAUDE.md §8b>
  alternatives_rejected:
    - <option + why rejected>
  assumptions:
    - <flagged for human review if any>

r20_impact_authored: <"none" | path-to-impact-md-update>

cost_used_usd: <number>
```

## Forbidden actions (contract violations)

| ❌ Forbidden | Why |
|---|---|
| Spawn nested subagent via Agent tool | No recursive dispatch; single-task atomic |
| Edit files not in {{ALLOWED_FILES}} | Scope creep; diff reviewer rejects |
| Use `any` type without TODO comment | R10 strict TypeScript |
| Add `console.log` in production code | R14 Pino-only observability |
| Skip TDD because "task is simple" | R3.1 — no exceptions |
| Modify shared schemas (AnalyzePerception / AuditState / Finding) without R20 impact.md | R20 — escalate to master if needed |
| Bump spec status `draft → approved` | Status bumps happen at Stage 4 only |
| Quote heuristic body content in commit messages / logs / output | R6 IP boundary — `id` only |
| Include conversion-prediction phrasing in test fixtures | R5.3 + GR-007 — banned even in synthetic data |
| Disable / skip existing tests to make own work pass | Cheating; rejected |

## Cross-references

- Phase folder: `docs/specs/mvp/phases/phase-{{PHASE}}-*/`
- Constitution: `docs/specs/mvp/constitution.md` for cited R-rules
- CLAUDE.md §6 (commit format) + §8 (self-check) + §9 (subagent dispatch policy)

## When to escalate (return `status: escalate`)

- AC text is ambiguous and a reasonable impl would diverge between interpretations
- Required type / module is not where {{TYPES_TO_LOAD}} says
- TDD test reveals the AC contradicts an earlier-implemented contract
- Cost budget exceeded mid-impl
- Any forbidden action would be required to satisfy the AC

In those cases, return early with `status: escalate` and a clear `reasoning_log.assumptions` entry explaining what you need from the master / human.

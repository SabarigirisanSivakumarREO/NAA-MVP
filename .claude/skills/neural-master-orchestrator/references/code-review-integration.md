# Code Review Integration (Stage 2.5)

## Purpose

Master invokes `superpowers:code-reviewer` agent on the FULL phase impl diff after Stage 2 completes, before Stage 3 verification. Catches semantic quality issues that mechanical diff reviewer (per-subagent grep) cannot — structure, consistency, completeness, base-principle adherence.

## When master invokes this

Once per phase, between Stage 2 (impl complete; all subagents returned PASS at diff-reviewer level) and Stage 3 (verification). Output feeds Gate 2 review packet — NOT a new human gate.

Skipped only if:
- Phase has zero impl diff (doc-only phase; rare)
- Cost ceiling hit during Stage 2 and master is in pause-protect mode

## How this differs from `diff-reviewer.md` (#5)

| | Diff Reviewer (per subagent) | Stage 2.5 Code Review (per phase) |
|---|---|---|
| Frequency | Every subagent return | Once per phase after all subagents |
| Scope | One subagent's diff | Cumulative phase diff |
| Mode | Mechanical pattern-grep | Semantic judgment |
| What it catches | `any`, `console.log`, scope creep, banned phrasing, R6 sentinel, file-size limits | Structure, abstraction quality, cross-file consistency, completeness, base-principle adherence |
| Tool | Master's grep + checklist | `superpowers:code-reviewer` agent |
| Failure → | 3-strike retry on subagent | Findings feed Gate 2 packet |

Both layers are necessary. Diff reviewer catches bright-line violations fast; code review catches the senior-engineer judgment items that no regex catches.

## Inputs to `superpowers:code-reviewer`

Master passes:

- **Full phase impl diff** (`git diff <phase-base>..HEAD`)
- **Affected ACs** from `phase-<N>-*/spec.md` (test paths from spec table → mapped back to ACs)
- **Phase plan** (`plan.md`) — for module structure expectations
- **Constitution rules in scope** (R3.1, R5.6, R6, R9, R10, R14 — phase-specific cite list)
- **Original task list** — to verify all tasks landed
- **Spec patches applied** during this phase (if any) — context for what changed mid-phase

## Seven review dimensions

| Dimension | What reviewer checks | Source rule |
|---|---|---|
| **Best practices** | TypeScript: no `any` (verified beyond regex — semantic anti-patterns); proper Zod usage; exhaustive switches; null-safety | R10.4, code-style.md |
| **Structure** | R9 adapter pattern preserved; external imports quarantined to `adapters/`; appropriate decomposition; cohesion | R9, R10.1 |
| **Consistency** | Matches conventions of sibling files in the same module (naming, exports, error handling, log shape) | CLAUDE.md §5 |
| **Completeness** | Edge cases handled; error paths return typed errors; no silent failures; AC bullets fully covered (semantic, not just test-passes) | per-AC scoping |
| **Correctness** | Logic matches AC INTENT, not just AC literal; off-by-one; null handling; async ordering; race conditions | judgment |
| **Base principles** | Constitution rules cited per finding (R3.1 TDD, R5.3 banned phrasing, R6 IP, R10 file size, R14 Pino correlation, R20 impact) | constitution.md |
| **Test quality** | Tests test BEHAVIOR not implementation; property-based where applicable; no `.skip()` on AC-anchored tests; assertions meaningful | R3.1 |

## Output format (consumed by Gate 2 packet)

```yaml
phase: <N>
stage: 2.5_code_review
generated_at: <ISO 8601>

dimensions_reviewed:
  - best_practices
  - structure
  - consistency
  - completeness
  - correctness
  - base_principles
  - test_quality

findings:
  - id: CR-<NNN>
    severity: CRITICAL | HIGH | MED | LOW
    dimension: <one of seven>
    location: <file:line or file:range>
    issue: <description>
    rule_citation: <R-NN if applicable>
    remediation: <suggested fix>
    auto_fixable: true | false   # eligible for fix subagent dispatch?

summary:
  critical_count: <N>
  high_count: <N>
  med_count: <N>
  low_count: <N>

verdict: PASS | RETURN-TO-IMPL
recommended_actions:
  - id: act-<NNN>
    type: dispatch_fix_subagent | flag_for_gate_2
    target: <file path>
    description: <one-line>
    severity: <CRITICAL | HIGH | MED | LOW>
```

## Severity routing

| Severity | Effect on Stage 2.5 verdict | Effect at Gate 2 |
|---|---|---|
| CRITICAL | Block — verdict = RETURN-TO-IMPL | n/a (already blocked here) |
| HIGH | Block — verdict = RETURN-TO-IMPL | n/a |
| MED | Pass — log; surfaced in Gate 2 packet | User awareness; user decides if blocking |
| LOW | Pass — log; minimal Gate 2 surfacing | Logged for trends |

Risk-gate mode raises threshold: MED also blocks (matches diff-reviewer risk-gate strictness).

## Recovery loop on RETURN-TO-IMPL

```
For each CRITICAL or HIGH finding with auto_fixable: true:
  Master dispatches fix subagent with brief that includes:
    - Original finding text
    - Suggested remediation
    - File:line reference
    - Constitution rule citation

For findings with auto_fixable: false:
  Master pauses; flags for human at Gate 2 — fix path requires judgment
```

3-strike rule applies same as Stage 2 dispatch (per CLAUDE.md §9).

## Cost budget

| Phase complexity | Code review tokens | Estimated cost |
|---|---|---|
| Small (≤5 tasks, <500 LOC diff) | ~10K | ~$0.50 |
| Medium (5-15 tasks, 500-2000 LOC diff) | ~25K | ~$1.50 |
| Large (>15 tasks, >2000 LOC diff) | ~50K | ~$3.00 |

Per-phase budget under default $10 ceiling: comfortably fits.

## Risk-gate mode adjustments

When master state has `risk_gate_mode.active: true`:
- MED-severity findings BLOCK (normally pass-through)
- Code reviewer instructed to flag potentially-missing test cases (not just test-quality)
- Verbose output mode (full diff annotations vs summary)
- 2-strike instead of 3-strike on auto-fix retry

## Failure modes

| Scenario | Handling |
|---|---|
| Code reviewer agent times out | Retry once; if still failing, log warning + skip Stage 2.5 (not blocking); flag at Gate 2 |
| Cumulative diff too large for context window | Split by module; review each module separately; aggregate findings |
| Reviewer flags issue that diff-reviewer should have caught | Bug in diff-reviewer's regex; log to false-positive log for prompt tuning |
| Reviewer recommends fix that conflicts with another reviewer recommendation | Master flags conflict for human; do NOT auto-pick |
| All findings classified `auto_fixable: false` | Master flags Gate 2 with full list; user stamps fix-by-fix |

## Anti-patterns

| ❌ Don't | ✅ Do |
|---|---|
| Run code review per-subagent during Stage 2 | Stage 2.5 = ONCE per phase; subagent-level is diff reviewer's job |
| Use code reviewer to enforce mechanical patterns | Mechanical = diff reviewer; semantic = code reviewer; don't conflate |
| Auto-merge `auto_fixable: false` findings without user stamp | Judgment-required findings ALWAYS go through Gate 2 |
| Skip Stage 2.5 to save cost on small phases | Cost is <$1 even on small phases; skipping is false economy |
| Use code reviewer's findings to override AI Reviewer's verdict | They're different surfaces; AI Reviewer at Gate 2 INCLUDES code review findings as input |

## Cross-references

- [`SKILL.md`](../SKILL.md) — Stage 2.5 in pipeline sequence
- [`diff-reviewer.md`](diff-reviewer.md) — companion mechanical reviewer (per subagent)
- [`risk-gate-mode.md`](risk-gate-mode.md) — strictness adjustments under high-attention
- [`test-failure-classifier.md`](test-failure-classifier.md) — Stage 3 verification consumes Stage 2.5 output
- [`../neural-ai-reviewer/SKILL.md`](../../neural-ai-reviewer/SKILL.md) — Gate 2 verdict synthesizes Stage 2.5 + Stage 3 outputs
- `superpowers:code-reviewer` agent — invoked at this stage
- `CLAUDE.md` §5 (code style) + §9 (subagent dispatch on auto-fixable findings)
- `docs/specs/mvp/constitution.md` — all R-rules cited per finding

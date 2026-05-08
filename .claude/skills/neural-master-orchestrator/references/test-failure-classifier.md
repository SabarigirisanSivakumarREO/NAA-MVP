# Test-Failure Classifier

## Purpose

When verification (Stage 3) reports failing tests, classify each failure as `impl-bug`, `spec-bug`, or `ambiguity` with a confidence score. Master routes per classification. Goal: minimize human triage on routine impl bugs while never silently bypassing spec defects or genuine ambiguity.

## When master invokes this

Stage 3 verification produces test output. For each failing test, master invokes this classifier with:

- The failing test name + assertion message + stack frame
- The relevant impl diff (files touched in Stage 2)
- The cited spec section (AC text + plan text + tasks.md row)

Runs once per failing test. Multiple failures classified independently.

## Classification rubric

### `impl-bug` — code is wrong; spec is correct

Signals:
- Spec text is unambiguous; impl violates it (e.g., spec says retry on 429+5xx+timeouts; impl only retries 429)
- Test asserts behavior derivable from spec; impl produces different behavior
- Stack trace points at logic error in impl code, not at type/contract mismatch
- Diff shows clear deviation from cited types or AC

Recommended action: dispatch fix subagent with brief that includes the failing test + spec quote + diff

### `spec-bug` — spec is wrong / under-specified; impl matches the (broken) spec

Signals:
- Spec text is ambiguous (e.g., "handle errors gracefully" without enumeration)
- Test asserts behavior NOT derivable from spec; spec doesn't address this case
- Multiple impl interpretations would all satisfy the spec equally
- Categorical-surface scope gap (cookie providers, error classes, etc. — see [`completeness-audit.md`](../../neural-ai-reviewer/references/completeness-audit.md))
- AC text contradicts plan.md or tasks.md

Recommended action: flag for human at Gate 2; surface as R11.4 spec-patch candidate

### `ambiguity` — cannot determine; needs human

Signals:
- Genuinely could be either impl or spec wrong; classifier can't decide
- Test depends on external system / network / timing (flaky test class)
- Failure references a constitutional rule but interpretation is non-obvious
- More than one of the above signals fire weakly

Recommended action: escalate to user; do NOT auto-act

## Confidence scoring

Classifier outputs confidence ∈ [0.0, 1.0]:

| Confidence | Threshold action |
|---|---|
| ≥ 0.90 | High confidence — eligible for auto-action (Tier 2) |
| 0.70 – 0.89 | Medium — log + recommend; user decides at Gate 2 |
| < 0.70 | Low — classify as `ambiguity` regardless of best guess; escalate |

## Logging-first mode (default for first 3 phases of MVP)

Per [`SKILL.md`](../SKILL.md) cost + risk discipline + the broader rule "log everything; auto-act only when classifier accuracy proven":

```
For first 3 phases of MVP run:
  - Log every classification + confidence to .phase-state/<N>/test-failure-classifications.log
  - Master takes NO auto-action regardless of confidence
  - Master surfaces all failures + classifications at Gate 2 for human decision
  - User stamps include feedback: was the classification right?
  
After 3 phases of operational data:
  - If classifier accuracy on `impl-bug` class ≥ 90% → graduate to auto-PR (Tier 2)
  - Other classes (spec-bug, ambiguity) continue requiring human stamp
  - Per-class accuracy tracked separately
```

This is the same Goodhart-prevention discipline applied to AI Reviewer (different prompt + log-then-graduate pattern).

## Output format

```yaml
test_failure_classification:
  failing_test:
    name: <full test name>
    file: <test file path>
    assertion: <failed expectation>
    stack: <relevant stack frame>
  
  cited_spec:
    file: <spec.md path>
    section: <AC-NN or section heading>
    quote: <relevant excerpt>
  
  diff_excerpt: <impl diff snippet most relevant to failure>
  
  classification: impl-bug | spec-bug | ambiguity
  confidence: <0.0 - 1.0>
  
  reasoning: |
    <1-2 sentence rationale citing specific signals from the rubric above>
  
  signals_fired:
    - <signal name from rubric>
    - <signal name>
  
  recommended_action:
    type: dispatch_fix_subagent | flag_for_gate_2 | escalate_to_user
    target: <impl file or spec file>
    description: <one-line action description>
  
  logging_only: true | false   # true during first 3 phases of MVP
```

## Routing per classification

Master uses this table once classifier returns:

| Classification | Confidence | Logging mode | Action |
|---|---|---|---|
| impl-bug | ≥0.90 | off | Auto-dispatch fix subagent (Tier 2) |
| impl-bug | ≥0.90 | **on** (default first 3 phases) | Log + flag for Gate 2; user stamps fix-dispatch decision |
| impl-bug | 0.70-0.89 | any | Log + flag for Gate 2 |
| spec-bug | any | any | Flag for Gate 2 as R11.4 spec-patch candidate |
| ambiguity | any | any | Escalate to user immediately; pause Stage 3 |
| any | <0.70 | any | Treat as `ambiguity`; escalate |

## Anti-patterns

| ❌ Don't | ✅ Do |
|---|---|
| Skip classification on "obvious" failures | Every failure classified; trust comes from data, not gut |
| Auto-PR on first phase of MVP run | Always logging-first for ≥3 phases before graduation |
| Classify based on stack trace alone | Read spec + diff + test together; partial inputs = ambiguity |
| Default to `impl-bug` when uncertain | Default to `ambiguity`; that's the safety class |
| Hide low-confidence classifications | All classifications logged and surfaced at Gate 2 |
| Use single classifier signal in isolation | Multiple signals from rubric must align for high confidence |

## Failure modes

| Scenario | Handling |
|---|---|
| Spec section can't be located for failing test | classification = `ambiguity`, signal: `spec_unlocateable` |
| Diff doesn't include impl file referenced in stack | classification = `ambiguity`, signal: `diff_excerpt_missing` |
| Test is flaky (passes on retry) | classification = `ambiguity`, signal: `flaky_test`, recommend disabling for investigation |
| Test asserts behavior covered by no AC | classification = `spec-bug` (orphan test) — flag as `R11.4` candidate |
| All failures classified as `ambiguity` | Master flags `LOW_CLASSIFIER_CONFIDENCE` to user; review classifier prompt |
| Classifier accuracy drops below 90% on `impl-bug` graduated class | Auto-revert to logging-only mode; flag for prompt review |

## Accuracy tracking

After Gate 2 stamp, master records ground truth:

```
.phase-state/<N>/test-failure-classifications.log entry:
  classification: <as predicted>
  confidence: <as scored>
  user_verdict: confirmed | corrected_to_<other_class>
  user_action_taken: <fix dispatched / spec patch / disabled / other>
```

Aggregated across phases — feeds the graduation decision.

## Cross-references

- [`SKILL.md`](../SKILL.md) — Stage 3 verification; classifier invocation
- [`diff-reviewer.md`](diff-reviewer.md) — different review surface; pre-test, mechanical
- [`risk-gate-mode.md`](risk-gate-mode.md) — risk-gate disables auto-PR even on graduated `impl-bug`
- [`../../neural-ai-reviewer/references/completeness-audit.md`](../../neural-ai-reviewer/references/completeness-audit.md) — categorical-surface signals overlap with `spec-bug` indicators
- `CLAUDE.md` §11 (R11.4 fix-spec-before-implementing) + §13 (R23 kill criteria)

# Coverage Audit — `pnpm spec:matrix` Synthesis

## What this file defines

Single-pass mechanical synthesis of `pnpm spec:matrix` output (AC ↔ test ↔ commit traceability). No critic — matrix output is deterministic. Reviewer's job: apply gate-specific thresholds, route missing-coverage and orphan-test findings to actions.

## When this audit fires

Per phase pre-flight (Stage 1) and verification (Stage 2/3). Always runs — every phase has AC↔test coverage to check.

## Inputs

`pnpm spec:matrix --phase <N>` output schema (consumed):

```yaml
phase: <N>
generated_at: <ISO 8601>
acs:
  - id: AC-NN
    spec_section: <file:line>
    test_refs: [<test file paths if any>]
    status: covered | missing | partial
tests:
  - path: <test file path>
    ac_refs: [<AC-NN list if any>]
    status: anchored | orphan
summary:
  total_acs: <N>
  covered_acs: <N>
  missing_acs: <N>
  partial_acs: <N>
  total_tests: <N>
  anchored_tests: <N>
  orphan_tests: <N>
  coverage_pct: <N>
```

Phase artifacts (spec.md / tasks.md) read for context only.

## Coverage thresholds per gate

| Gate | Threshold | Rationale |
|---|---|---|
| **Pre-flight (Stage 1)** | Tests for ALL ACs not required yet — only the AC↔test plan. Threshold: 0% missing test PLANS. Test scaffolds expected to land in Stage 2 impl. | Tests don't exist before impl — checking AC-test plan presence (not test execution) |
| **Verification (Stage 2/3)** | 100% AC coverage REQUIRED. Any missing AC test → block. Orphan tests logged but don't block. | Phase exit cannot complete with uncovered ACs |

## Synthesis tasks (in order)

1. **Validate matrix freshness.** Check `generated_at` < 5 min ago. If stale, instruct master to re-run `pnpm spec:matrix` before proceeding.

2. **Apply gate-specific threshold:**

| Finding | At Pre-flight | At Verification |
|---|---|---|
| AC missing test plan (no `test_refs` in tasks.md / no test stub planned) | HIGH — block | N/A (different check) |
| AC missing actual passing test | LOW — log only | CRITICAL — block |
| AC partial coverage (some test_refs but failing) | MED | HIGH — block |
| Orphan test (test references no AC) | LOW — log | LOW — log |
| Coverage pct < 100% (verification only) | N/A | CRITICAL — block |

3. **Route findings to actions:**

| Finding type | Action |
|---|---|
| AC missing test plan (pre-flight) | spec_patch — add test reference to tasks.md (R18 delta) OR add AC if missing |
| AC missing test (verification) | impl_task — dispatch subagent to write test for AC-NN |
| AC partial coverage (verification) | impl_task — fix failing test or extend coverage |
| Orphan test | spec_patch — add AC anchor to existing test OR remove test if obsolete |
| Stale matrix | Re-run `pnpm spec:matrix`; do not proceed without fresh data |

4. **Cross-reference with correctness audit findings.** If `/speckit.analyze` flagged REQ_COVERAGE for the same AC, consolidate — single action covers both.

## Output (Coverage section of verdict YAML)

```yaml
coverage:
  matrix_freshness: <minutes since generation>
  
  summary:
    total_acs: <N>
    covered_acs: <N>
    missing_acs: <N>
    partial_acs: <N>
    coverage_pct: <N>
    orphan_tests: <N>
  
  findings:
    - id: COV-<NNN>
      severity: CRITICAL | HIGH | MED | LOW
      type: missing_test_plan | missing_test | partial_coverage | orphan_test
      ac_id: <AC-NN if applicable>
      test_path: <test file if applicable>
      action_type: spec_patch | impl_task | log_only
      action_target: <file path>
      block_gate: true | false
      consolidates_with: <correctness finding id if applicable>

  verdict: PASS | REVISE
  
  rationale: |
    <one-paragraph: coverage pct, missing AC list (if short),
     blocking findings count>
```

## Verdict synthesis rule

```
coverage_verdict =
  Pre-flight gate:
    if any AC missing test plan:           REVISE
    elif coverage_pct < 80%:               REVISE   (warn-level threshold; spec needs more test planning)
    else:                                  PASS

  Verification gate:
    if coverage_pct < 100%:                REVISE
    elif any test failing:                 REVISE
    else:                                  PASS

Orphan tests never block verdict; logged for human awareness.
```

## Failure modes

| Scenario | Handling |
|---|---|
| `pnpm spec:matrix` not yet built (artifact #2 dependency) | Reviewer returns `PARTIAL_AUDIT` — coverage section blank; correctness + completeness still run; flag for human |
| Matrix output stale (>5 min since generation) | Master re-runs; reviewer waits for fresh output |
| Matrix output empty (no ACs in spec) | Skip coverage sub-audit; flag spec as `LIKELY_INCOMPLETE_SPEC`; correctness audit will catch |
| Matrix references AC not in spec | Data corruption; escalate to human |
| Coverage pct = 100% but tests failing | Verification gate FAILS — coverage AND test execution both required |
| Same AC has 5+ tests | Log as `OVER_COVERAGE` (informational only); not a defect |

## Anti-patterns

| ❌ Don't | ✅ Do |
|---|---|
| Block pre-flight on missing actual test execution | Tests don't exist pre-impl; check test PLAN at pre-flight, test EXECUTION at verification |
| Treat orphan tests as critical | Orphan = test exists but no spec anchor; usually means spec needs updating, not test deletion |
| Re-implement matrix logic in this skill | Consume `pnpm spec:matrix` output; don't duplicate the matrix tool |
| Ignore stale matrix | 5-min freshness check is non-negotiable; stale data = wrong audit |
| Block on `OVER_COVERAGE` | Multiple tests per AC is fine; only `UNDER_COVERAGE` is a defect |

## Cross-references

- [`SKILL.md`](../SKILL.md) — entry point and skill-level verdict synthesis
- [`correctness-audit.md`](correctness-audit.md) — companion mechanical sub-audit (consolidate REQ_COVERAGE findings)
- [`completeness-audit.md`](completeness-audit.md) — judgment sub-audit (different model)
- `pnpm spec:matrix` — upstream tool (artifact #2; produces this audit's input)
- `docs/specs/mvp/constitution.md` R3.1 (TDD) + R21 (traceability matrix mandate) — drive coverage requirements

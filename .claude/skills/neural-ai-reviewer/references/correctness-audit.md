# Correctness Audit — `/speckit.analyze` Synthesis

## What this file defines

Single-pass mechanical synthesis of `/speckit.analyze` output. No critic — analyze is already deterministic and rule-based. Reviewer's job: group findings, map severity to action, route per severity.

## When this audit fires

Per phase pre-flight (Stage 1) and verification (Stage 2/3) gates. Always runs — every phase has cross-artifact consistency to check.

## Inputs

- `.phase-state/<N>/preflight-correctness.json` (Stage 1) OR equivalent at verification
- Phase artifacts (spec.md / plan.md / tasks.md / impact.md) for context only

`/speckit.analyze` output schema (consumed):

```yaml
findings:
  - id: <C|H|M|L><number>          # e.g. C1, H2, M3, L4 — CRITICAL/HIGH/MED/LOW
    severity: CRITICAL | HIGH | MED | LOW
    category: REQ_COVERAGE | TERMINOLOGY_DRIFT | DEPENDENCY_CONFLICT | TASK_ORPHAN | AMBIGUITY | OTHER
    location: <file:section or REQ-ID>
    description: <one-line issue>
    suggested_remediation: <optional>
```

## Synthesis tasks (in order)

1. **Group findings by category.** Cross-artifact consistency issues cluster — same root cause often produces multiple findings.

2. **Severity sanity check.** If `/speckit.analyze` marked something CRITICAL but description is cosmetic, downgrade with note. If marked LOW but blocks impl, escalate. Document any reclassification.

3. **Map severity → action.**

| Severity | Verdict signal | Action type | Block gate? |
|---|---|---|---|
| CRITICAL | REVISE or RE-SPEC | Spec patch (must) before impl | YES |
| HIGH | REVISE | Spec patch (must) before impl | YES |
| MED | PASS | Log; surfaced for human awareness | NO |
| LOW | PASS | Log; surfaced for human awareness | NO |

4. **Determine action type per finding:**

| Finding category | Action type |
|---|---|
| REQ_COVERAGE (REQ-ID has no spec section / no test / no task) | spec_patch (append AC-NN with REQ-ID anchor) |
| TERMINOLOGY_DRIFT (same concept, different names across artifacts) | spec_patch (canonicalize term + R18 delta) |
| DEPENDENCY_CONFLICT (Phase N declares depends-on Phase M, but M ships later) | spec_patch (impact.md update) + escalate cross-phase |
| TASK_ORPHAN (T-ID in tasks.md with no spec AC / no plan section) | spec_patch (add AC) OR remove task |
| AMBIGUITY (spec text underspecifies; clarify-needed) | spec_patch + invoke `/speckit.clarify` if many |
| OTHER | Case-by-case; describe in suggested_action |

5. **Detect cross-phase R20 triggers.** If any finding mentions a shared contract (AnalyzePerception / AuditState / Finding / adapter interface), flag for impact.md update + downstream phase pre-flight invalidation.

## Output (Correctness section of verdict YAML)

```yaml
correctness:
  total_findings:
    critical: <count>
    high: <count>
    med: <count>
    low: <count>
  
  findings:
    - id: <C1|H2|M3|L4>
      severity: <as classified>
      category: <as classified>
      location: <file:section or REQ-ID>
      description: <as from analyze>
      action_type: spec_patch | impl_task | impact_md_author | clarify_invoke | log_only
      action_target: <file path>
      block_gate: true | false
      reclassified: <empty or "downgraded from HIGH because cosmetic" etc.>
      r20_trigger: true | false      # shared-contract surface touched?

  groups:
    - root_cause: <if multiple findings share cause>
      finding_ids: [<id list>]
      consolidated_action: <single action covering group>

  verdict: PASS | REVISE | RE-SPEC
  
  rationale: |
    <one-paragraph summary: how many findings, which categories,
     whether any block, whether any cross-phase>
```

## Verdict synthesis rule

```
correctness_verdict =
  if any finding severity = CRITICAL:    REVISE  (or RE-SPEC if structural)
  elif any finding severity = HIGH:      REVISE
  elif total findings = 0:               PASS
  else:                                  PASS (with MED/LOW logged)
```

RE-SPEC reserved for structural issues — e.g., multiple CRITICAL findings indicating phase scope wrong; dependency cycles; spec wholly inconsistent with predecessor phase rollup.

## Failure modes

| Scenario | Handling |
|---|---|
| `/speckit.analyze` returns empty findings | `verdict: PASS`; explicit note "analyze ran clean" |
| `/speckit.analyze` failed to run | Retry once via master; if still fails, escalate to human (cannot proceed past gate without correctness signal) |
| Findings reference REQ-IDs not in current spec | Re-run analyze (likely stale state); if persists, escalate as data-corruption issue |
| Severity reclassification disputed | Reviewer's reclassification logged; human at gate can override |
| Cross-phase R20 trigger detected at verification gate (not pre-flight) | Late-stage shared-contract change; auto-invalidate downstream phase pre-flights; logged with HIGH urgency |

## Anti-patterns

| ❌ Don't | ✅ Do |
|---|---|
| Re-run analyze logic in this skill | Consume `/speckit.analyze` output; don't duplicate the analyzer |
| Add a "critic" pass to correctness | Analyze is deterministic; no judgment; no critic needed |
| Blanket-downgrade HIGH findings | Each downgrade requires per-finding rationale; logged for pattern detection |
| Ignore MED/LOW findings | Always surfaced in summary; human awareness even if not blocking |
| Treat REQ_COVERAGE the same as TASK_ORPHAN | Different remediation: REQ_COVERAGE adds AC; TASK_ORPHAN removes task or adds AC |

## Cross-references

- [`SKILL.md`](../SKILL.md) — entry point and skill-level verdict synthesis
- [`coverage-audit.md`](coverage-audit.md) — companion mechanical sub-audit
- [`completeness-audit.md`](completeness-audit.md) — judgment sub-audit (different model)
- `/speckit.analyze` command — upstream tool producing this audit's input
- `docs/specs/mvp/constitution.md` R11.4 — fix spec before implementing (drives action type mapping)

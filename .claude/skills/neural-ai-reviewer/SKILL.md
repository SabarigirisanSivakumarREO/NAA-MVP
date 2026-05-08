---
name: neural-ai-reviewer
description: Use this skill when the master agent reaches a phase pre-flight gate (Stage 1) or verification gate (Stage 2/3) and needs a senior-engineer-grade review verdict. Combines correctness analysis (from /speckit.analyze output), coverage analysis (from pnpm spec:matrix output), and completeness analysis with adversarial self-critic for categorical surfaces. Outputs APPROVE / REVISE / RE-SPEC verdict with constitutional rule citations per finding. AI enumerates categorical-surface universes dynamically — no hardcoded reference lists.
---

# Neural AI Reviewer

## Purpose

Replace the 10-minute human read at Gates 1 + 2 with a 1-minute stamp. Performs senior-engineer-grade review across three dimensions per phase. Uses adversarial self-critic on completeness (the only judgment-prone dimension; same R5.6 pattern as Neural's evaluate→self_critique).

## When master invokes

Two gate types. Inputs differ per gate.

| Trigger | Gate | Inputs read |
|---|---|---|
| Pre-flight complete (Stage 1 done) | Gate 1 | `.phase-state/<N>/preflight-correctness.json` (analyze output)<br>`.phase-state/<N>/preflight-coverage.json` (matrix output)<br>`docs/specs/mvp/phases/phase-<N>-*/spec.md`<br>`docs/specs/mvp/phases/phase-<N>-*/plan.md`<br>`docs/specs/mvp/phases/phase-<N>-*/tasks.md`<br>`docs/specs/mvp/phases/phase-<N>-*/impact.md` (if exists) |
| Verification complete (Stage 3 done) | Gate 2 | `.phase-state/<N>/verify-test-results.json`<br>`.phase-state/<N>/verify-code-review.json` (Stage 2.5 output)<br>`.phase-state/<N>/impl-diff.patch`<br>Same phase artifacts as Gate 1 |

Master invokes via Skill tool with arguments: `--phase <N> --gate <pre-flight|verification>`.

## Sub-audit execution order

Run sub-audits in parallel where independent; synthesize at end.

1. **Correctness** — see [`references/correctness-audit.md`](references/correctness-audit.md)
   - Synthesize `/speckit.analyze` findings into severity-ranked list
   - Single-pass (mechanical)
2. **Coverage** — see [`references/coverage-audit.md`](references/coverage-audit.md)
   - Synthesize `pnpm spec:matrix` output (covered / missing / orphan)
   - Single-pass (mechanical)
3. **Completeness** — see [`references/completeness-audit.md`](references/completeness-audit.md)
   - Two-pass: collaborative auditor + adversarial critic (R5.6 pattern)
   - Identify categorical surfaces dynamically from spec text per [`references/categorical-surfaces.md`](references/categorical-surfaces.md)
   - **Enumerate universes dynamically using domain knowledge + reasoning. No hardcoded reference lists.**

## Verdict synthesis

Strictest sub-audit verdict wins. Never relax coverage; only tighten.

```
overall_verdict =
  if any sub-audit = RE-SPEC:                     RE-SPEC
  elif any sub-audit = REVISE / RETURN-TO-IMPL:   REVISE / RETURN-TO-IMPL
  elif all sub-audits = PASS:                     APPROVE
```

For completeness sub-audit specifically:
```
completeness_verdict =
  if auditor = SPEC_GAP and critic = AGREE:        SPEC_GAP (use auditor's enumeration)
  if auditor = SPEC_GAP and critic = EXTEND:       SPEC_GAP (use critic's broader enumeration)
  if auditor = PASS and critic = DISPUTE:          SPEC_GAP (use critic's enumeration)
  if auditor = IMPL_GAP and critic = AGREE:        IMPL_GAP
  ...always favor stricter coverage
```

## Output

Write structured verdict to `.phase-state/<N>/<gate>-verdict.yaml`. Render readable summary for human stamp.

Verdict YAML schema:

```yaml
phase: <N>
gate: pre-flight | verification
timestamp: <ISO 8601>

correctness:
  findings:
    - severity: CRITICAL | HIGH | MED | LOW
      ref: <file>:<line> or <REQ-ID>
      issue: <description>
      action: <recommended action>
      constitutional_rule: <R-NN if applicable>
  verdict: PASS | REVISE

coverage:
  missing_acs: [<AC-NN list>]
  orphan_tests: [<test path list>]
  verdict: PASS | REVISE

completeness:
  surfaces_audited:
    - name: <surface name>
      identified_from: <spec text excerpt that triggered identification>
      auditor_universe: [<dynamically enumerated cases with citations>]
      auditor_required: [<MVP scope per spec>]
      auditor_deferred: [<deferred to v1.1+>]
      auditor_covered: [<impl plan covers>]
      auditor_verdict: PASS | SPEC_GAP | IMPL_GAP
      critic_challenge: <adversarial review summary>
      critic_verdict: AGREE | DISPUTE | EXTEND
      final_verdict: PASS | SPEC_GAP | IMPL_GAP
      suggested_action: <spec patch or impl task>
  verdict: PASS | REVISE | RE-SPEC

overall_verdict: APPROVE | REVISE | RETURN-TO-IMPL | RE-SPEC
recommended_actions:
  - id: act-<NNN>
    type: spec_patch | impl_task | impact_md_author | none
    target: <file path>
    description: <one-line>
    severity: CRITICAL | HIGH | MED | LOW
    constitutional_rule: <R-NN if applicable>

human_stamp_required: true
```

## Severity routing

| Severity | At Gate 1 (pre-flight) | At Gate 2 (verification) |
|---|---|---|
| CRITICAL | Block; verdict = REVISE or RE-SPEC | Block; verdict = RETURN-TO-IMPL |
| HIGH | Block; verdict = REVISE | Block; verdict = RETURN-TO-IMPL |
| MED | Log; verdict can pass; surfaced in summary for human awareness | Same |
| LOW | Log; verdict can pass; surfaced in summary for human awareness | Same |

CRITICAL and HIGH always block. MED/LOW never block (per Day 0 decision).

## Constitutional anchors

| Rule | How this skill enforces |
|---|---|
| R5.6 | Two-pass auditor + critic for completeness uses different persona (collaborative vs adversarial) |
| R11.4 | Spec defects surface at pre-flight; recommended actions are spec patches BEFORE impl |
| R17 | Verdict gates `status:` transitions (`draft → approved` only on APPROVE) |
| R18 | Recommended spec-patch actions specify "append delta block" — never line removal |
| R20 | If completeness audit finds shared-contract scope gap, action includes "author/update impact.md" |
| R23 | RE-SPEC verdict triggers kill criteria escalation |

## Human override

Human stamp at the gate may override any verdict. Master logs:
- Original verdict
- Override decision
- Human-supplied reasoning (if any)
- Timestamp

Pattern detector tracks override frequency. If overrides exceed threshold (e.g., >2 per 5 phases), master flags potential reviewer-prompt drift; triggers manual review of this skill's prompts.

## Failure modes

| Scenario | Handling |
|---|---|
| Phase has no categorical surfaces | Completeness sub-audit returns "N/A — no surfaces identified"; verdict on correctness + coverage only |
| Auditor + critic disagree on completeness | Strictest wins per synthesis rule above |
| Critic claims "missing case" without citation | Reject the critic flag; require source citation per [`references/completeness-audit.md`](references/completeness-audit.md) |
| Cost ceiling near limit | Master may instruct skill to skip Pass 2 critic on LOW-risk phases; decision logged |
| Skill execution fails (3 retries) | Escalate to human; do not proceed past gate |
| `/speckit.analyze` output missing | Skill retries master's analyze invocation once; if still missing, fails open with WARN — escalate to human |
| `pnpm spec:matrix` output missing | Same — retry then escalate |

## What this skill is NOT

- NOT a replacement for human judgment on RE-SPEC decisions
- NOT a static analyzer (delegates to `/speckit.analyze` and `pnpm spec:matrix`)
- NOT a test runner (consumes test output, doesn't run tests)
- NOT a code reviewer for impl quality (delegates to `superpowers:code-reviewer` at Stage 2.5)

## Cross-references

- Master Agent skill: `.claude/skills/neural-master-orchestrator/SKILL.md` (invoker)
- Constitution: `docs/specs/mvp/constitution.md` (R-NN definitions)
- CLAUDE.md §8c (per-phase JIT analyze discipline) and §8d (R17.4 phase review gate)
- Phase review templates: `docs/specs/mvp/templates/phase-review-{prompt,report.template}.md`

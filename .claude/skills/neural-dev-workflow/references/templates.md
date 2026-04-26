# Templates — PR Contract, Kill Criteria, Brief, Provenance

**Source:** `docs/engineering-practices/ai-orchestration-research-2026-04-24.md` §Part 1 §3 (code-review-ai), §4 (coding-agents-manager).

## PR Contract (PRD §10.9)

Required in every PR body BEFORE the PRD §10.6 Spec coverage section. CI blocks PRs missing the `## PR Contract` heading.

### Template

```markdown
## PR Contract

1. **What / Why** (1-2 sentences):
   <Specific change + motivation. Example: "Implement GR-007 deterministic
    banned-phrase check because self_critique alone produced a 23% false-positive
    rate on conversion predictions in fixture set A.">

2. **Proof** (concrete evidence it works):
   - Conformance: `pnpm test:conformance -- gr007` — 12/12 passing
   - Integration: `packages/agent-core/tests/integration/grounding.test.ts:42-58`
   - Or: screenshot / log excerpt if UI/runtime-only

3. **Risk tier + AI involvement**:
   - Tier: <low | medium | high>
   - AI-generated: <list of files/functions; e.g., "GR007.ts regex list drafted by Claude, reviewed by me">
   - Human-written: <list; e.g., "Conformance test cases authored manually">

4. **Review focus** (3-5 bullets):
   - Regex patterns in GR007.ts — confirm no false positives on legitimate hedging ("may help...")
   - Integration into EvidenceGrounder — verify short-circuit order
   - Banned-phrase list completeness vs §07.7 spec
```

### Risk-tier reference

- **Low** — no shared-contract changes, no auth/payments/secrets/untrusted-input touches, no LLM prompt edits. Examples: typo fix, internal refactor, isolated test additions.
- **Medium** — single shared-contract touch, single-module LLM prompt edit, new grounding rule. Reviewer verifies impact beyond the diff.
- **High** — touches auth, payments, secrets, RLS, untrusted input, GR-007 conversion-prediction logic, reproducibility snapshot fields, any append-only table (R7.4). Requires human threat model walkthrough BEFORE merge, not at-merge.

---

## Kill Criteria (Constitution R23)

Required for tasks > 2 hrs, touching shared contracts, dispatched to subagents, or with LLM budget > $0.50.

### Template (paste into task description or Brief)

```markdown
## Kill Criteria (R23)

*"What would cause me to stop, revert, and escalate rather than iterate forward?"*

**Resource:**
- Token budget: 85% of <$X> allocated → pause and escalate
- Wall-clock: exceeds <2× estimate = N hours> → stop, re-scope
- Iterations: 3+ tries on same error → stop, reassign

**Quality:**
- Any previously-passing test breaks
- `pnpm test:conformance -- <component>` fails
- Implementation reveals spec defect (R11.4 — fix spec first)

**Scope:**
- Diff introduces forbidden pattern (R13: `any` without TODO, `console.log`, direct SDK import, disabled test)
- Cross-cutting change emerges without `impact.md` (R20)

**On trigger (R23.4):**
1. Commit WIP to `wip/killed/<task-id>-<reason>` branch
2. Log reason — to `audit_events` (PRODUCT) or task thread (META)
3. Escalate with specific failure mode (e.g., "GR-001 conformance fails on fixture X after 3 retries")
4. Do NOT silently retry or bypass with `--no-verify`
```

---

## Brief Format — task scoping & subagent dispatch

Use when authoring a task in `tasks.md`, or writing a prompt to dispatch a subagent. Must be self-contained — subagents have no prior conversation context.

### Template

```markdown
## Brief

**Task ID:** <M7.16 or T117>

**Outcome:** (1 sentence — what will be true when done)
> GR-007 rejects any finding whose observation / assessment / recommendation contains
> a banned conversion-prediction phrase. Pattern list covers "increase conversion",
> "%lift", "ROI of N", "boost revenue", and equivalent variations.

**Context:** (2-4 sentences — why this matters, where it plugs in)
> Neural's grounding pipeline runs 12 deterministic checks AFTER self_critique.
> GR-007 is the absolute ban on conversion predictions — our strongest trust
> differentiator vs competitors. PRD §F-009, spec §07.7, conformance test scaffold
> at `tests/conformance/gr007.test.ts`.

**Constraints:**
- Temperature=0 enforced elsewhere; this is pure deterministic code (no LLM)
- Regex-based pattern list (not ML classifier)
- Must Zod-validate input `Pick<ReviewedFinding, "observation"|"assessment"|"recommendation">`
- Named exports only (R10.3)
- File < 300 lines (R10.1)

**Non-goals:**
- Detecting subtle hedged predictions ("could maybe somewhat improve") — out of scope; handled by self_critique
- Internationalization — English phrase detection only in MVP
- Dynamic pattern loading — pattern list is compile-time constant

**Acceptance criteria:**
- [ ] `groundGR007(finding)` pure function exported from `packages/agent-core/src/analysis/grounding/rules/GR007.ts`
- [ ] Returns `{ pass: boolean, reason?: string }`
- [ ] 5+ positive test cases (banned phrases) → pass=false
- [ ] 4+ negative test cases (safe phrases) → pass=true
- [ ] Conformance test passes: `pnpm test:conformance -- gr007`
- [ ] Constitutional reference `// REQ-GROUND-007` present per R21.4

**Integration notes:**
- Called by `EvidenceGrounder.ground(finding)` — separate PR (M7.22)
- Rejections flow to `rejected_findings` table via `StoreNode` — separate PR (M7.26)

**Verification plan:**
- `pnpm test packages/agent-core/tests/unit/grounding/GR007.test.ts`
- `pnpm test:conformance -- gr007`
- `pnpm lint && pnpm typecheck`

**Kill criteria (R23):** see template above.

**PR Contract (PRD §10.9):** include in PR body.
```

---

## Provenance Block (Constitution R22.2)

Required when adding any rule to `constitution.md`, `CLAUDE.md`, or a skill file.

### Template

```yaml
why:
  source: <doc path + section | commit sha | research URL + date>
  evidence: >
    <one-line summary of the failure or finding that justifies the rule>
  linked_failure: <optional: specific commit/PR/issue where this failed>
```

### Examples

```yaml
# Based on research synthesis
why:
  source: docs/engineering-practices/ai-orchestration-research-2026-04-24.md §Part 2 theme 4
  evidence: "human-curated AGENTS.md ~4% improvement; auto-generated ~3% regression"
```

```yaml
# Based on observed project failure
why:
  source: commit a1b2c3d — GR-007 false-positive on "improve" phrase during spec authoring
  evidence: "Self_critique passed the finding; grounding caught it; added to banned list"
  linked_failure: PR #87 (rejected during warm-up review)
```

```yaml
# Based on external research
why:
  source: https://example.com/research 2026-03-15
  evidence: "Empirical study: temperature > 0 on structured output drops JSON adherence 12%"
```

### Where the provenance goes

- **Constitution rules:** at the bottom of the rule, inside the same section
- **CLAUDE.md entries:** inline `> why:` block under the rule
- **Skill entries:** in the reference doc that introduces the pattern (not in the skill's summary table)

### Quarterly review (R22.3)

- Re-read each `why:` entry
- Confirm the failure still reproduces OR the research still applies
- If stale: remove the rule (not weaken it; dead rules train Claude Code to tune out the set)
- Commit removal with `docs(constitution): remove R<N> — provenance stale, last failure 2025-Q3`

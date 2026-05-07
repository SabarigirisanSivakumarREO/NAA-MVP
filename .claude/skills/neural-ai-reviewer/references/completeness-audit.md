# Completeness Audit — Auditor + Critic Protocol

## What this file defines

The two-pass adversarial review for categorical surfaces (R5.6 pattern applied to review). Pass 1 auditor enumerates and judges. Pass 2 critic challenges. Strictest verdict wins.

AI enumerates dynamically per [`categorical-surfaces.md`](categorical-surfaces.md). No hardcoded lists.

## When this audit fires

Per phase pre-flight (Stage 1) and verification (Stage 2/3). For each categorical surface identified by signal-fire rules in [`categorical-surfaces.md`](categorical-surfaces.md), run BOTH passes.

If zero categorical surfaces identified in phase artifacts → completeness sub-audit returns `verdict: PASS` with `surfaces_audited: []`.

## Pass 1 — Auditor (collaborative persona)

### Persona instructions

You are a senior engineer reviewing a phase artifact for scope clarity. You collaborate with the team to identify scope. Be thorough, cite sources, stay constructive.

### Inputs

- Identified surface name + identification trigger (excerpt from spec/code that fired the signal)
- Phase artifact text (spec.md / plan.md / tasks.md / impact.md as applicable)
- Implementation diff (verification gate only) or implementation plan (pre-flight gate)

### Tasks (in order)

1. **Enumerate the universe.** List known cases for this category using your domain knowledge. Cite source per entry per [`categorical-surfaces.md`](categorical-surfaces.md) "Universe enumeration discipline." Mark confidence (HIGH / MED / LOW).

2. **Map spec scope.** Extract from spec text:
   - `required` — in-MVP-scope cases
   - `deferred` — out-of-scope (v1.1+) cases
   - `ambiguous` — spec doesn't enumerate

3. **Map impl coverage.** Extract from impl plan / diff:
   - `covered` — cases the impl handles
   - `deferred_explicitly` — cases the impl skips with code comment / TODO
   - `silently_missing` — cases the impl misses without acknowledgment

4. **Compute gaps:**
   - **IMPL_GAP** — `spec.required ⊃ impl.covered` (impl misses required cases)
   - **SPEC_GAP** — `universe ⊃ (spec.required ∪ spec.deferred)` (spec doesn't enumerate scope at all)
   - **PASS** — all required covered; deferred documented; universe accounted for

5. **Suggest action** per gap:
   - IMPL_GAP → dispatch fix subagent for specific cases
   - SPEC_GAP → patch spec.md (R11.4 + R18 append-only) to enumerate scope
   - Shared-contract surface → flag R20 impact.md update

### Output (Auditor's section of verdict YAML)

```yaml
surface_name: <name>
identification_trigger:
  source: <file:line or section>
  excerpt: <spec/code snippet that fired signal>
  signals_fired: [<signal list per categorical-surfaces.md>]

auditor_universe:
  confidence: HIGH | MED | LOW
  source_class: <market_share_recall | RFC | publisher_list | constitutional | other>
  source_year_recall: <year if applicable>
  cases:
    - id: <kebab-name>
      source: <citation per case>
      confidence: HIGH | MED | LOW

auditor_spec_scope:
  required: [<id list>]
  deferred: [<id list>]
  ambiguous: <empty | "spec does not enumerate scope">

auditor_impl_coverage:
  covered: [<id list>]
  deferred_explicitly: [<id list>]
  silently_missing: [<id list>]

auditor_verdict: PASS | IMPL_GAP | SPEC_GAP

suggested_actions:
  - type: spec_patch | impl_task | impact_md_author
    target: <file path>
    cases: [<id list>]
    severity: CRITICAL | HIGH | MED | LOW
```

## Pass 2 — Critic (adversarial persona)

### Persona instructions

You are an adversarial code reviewer. Your job is to FIND FAULT, not to validate. Assume the auditor missed something. Demand citations. Probe for hallucinations.

If you cannot find a fault, you must explicitly say `AGREE — no fault found after probing X, Y, Z` with the probes listed.

**You DO NOT see the original spec text or impl plan.** You see ONLY the auditor's output. This prevents shared blind spots — your challenge must be grounded in domain knowledge or in inconsistencies within the auditor's output itself.

### Inputs

- Pass 1 output ONLY (NOT original spec/impl)
- Categorical surface name (for domain-knowledge probing)

### Tasks (in order)

1. **Universe completeness probe.** Name 2-3 cases the auditor MIGHT have missed. Cite source per probe. If you cannot name any → state `no missing cases identified after probing [domain area 1, 2, 3]`.

2. **Hallucination probe.** For each case in `auditor_universe.cases`, ask: "is this real? Does the cited source exist?" Mark suspicious entries.

3. **Citation rigor probe.** For any case marked `confidence: HIGH` without a verifiable source class, downgrade to MED and demand stronger citation.

4. **Justification probe.** For the in-MVP/deferred split, ask: "is this defensible? Quote market-share or risk reasoning. If hand-wavy, flag."

5. **Output a verdict:**
   - `AGREE` — auditor's output stands; probes returned no fault
   - `DISPUTE` — auditor missed cases or hallucinated; provide corrected enumeration
   - `EXTEND` — auditor's enumeration is partial; add missing cases with citations

### Output (Critic's section of verdict YAML)

```yaml
critic_universe_probe:
  potentially_missing:
    - id: <kebab-name>
      source: <citation>
      reasoning: <why auditor likely missed this>
  hallucination_suspects:
    - id: <id from auditor list>
      reasoning: <why this seems hallucinated>
  citation_downgrades:
    - id: <id from auditor list>
      from: HIGH
      to: MED
      reasoning: <why citation insufficient>

critic_justification_probe:
  split_defensible: true | false
  hand_wavy_rationales: [<excerpt list from auditor's reasoning>]

critic_verdict: AGREE | DISPUTE | EXTEND

critic_corrections:
  # Required if DISPUTE or EXTEND:
  add_cases: [<id list with citations>]
  remove_cases: [<id list with reasoning>]
  reclassify_confidence:
    - id: <id>
      from: <old>
      to: <new>
```

## Synthesis rule — strictest wins; never relax coverage

```
final_verdict =
  if auditor = SPEC_GAP and critic = AGREE:
      → SPEC_GAP (use auditor's enumeration)
  if auditor = SPEC_GAP and critic = EXTEND:
      → SPEC_GAP (use union: auditor.cases ∪ critic.add_cases)
  if auditor = PASS and critic = DISPUTE:
      → SPEC_GAP (use critic's corrected enumeration)
  if auditor = IMPL_GAP and critic = AGREE:
      → IMPL_GAP
  if auditor = IMPL_GAP and critic = EXTEND:
      → IMPL_GAP (use critic's broader case list)
  if auditor = PASS and critic = AGREE:
      → PASS
  rule: always favor stricter coverage; never relax
```

**If critic claims `DISPUTE` without per-case citation → reject critic's claim; keep auditor's verdict.** Adversarial does not mean unsourced.

## Failure modes

| Scenario | Handling |
|---|---|
| Auditor misses signal that surface is categorical | [`categorical-surfaces.md`](categorical-surfaces.md) signal table should fire; re-prompt auditor with explicit signal callout |
| Auditor enumerates with `confidence: HIGH` and no citation | Critic auto-downgrades; re-prompt for citation |
| Critic hallucinates a "missing case" without source | Reject critic's claim; keep auditor's verdict |
| Critic agrees but later impl reveals gap | Log for pattern detection; if frequency exceeds threshold → reviewer-prompt review |
| Auditor and critic enumerations are completely disjoint | Flag as `LOW_CONFIDENCE_AUDIT`; escalate to human at gate |
| Cost budget near limit | Master may instruct skill to skip Pass 2 critic on LOW-risk surfaces; decision logged in verdict |
| Both passes time out | Retry once; if still failing, return `verdict: ESCALATE_TO_HUMAN` |

## Cost budget

| Surface complexity | Auditor tokens | Critic tokens | Total per surface |
|---|---|---|---|
| Small (≤5 cases) | ~2K | ~1K | ~3K (~$0.15) |
| Medium (5-20 cases) | ~4K | ~3K | ~7K (~$0.40) |
| Large (>20 cases) | ~7K | ~5K | ~12K (~$0.60) |

Per phase typical: 1-3 surfaces × medium complexity = ~$0.50-1.50.

## Anti-patterns

| ❌ Don't | ✅ Do |
|---|---|
| Auditor reads `categorical-surfaces.md` for "the answer" | Auditor enumerates from training-data domain knowledge with citations |
| Critic agrees without listing probes performed | Critic must state `AGREE — no fault found after probing X, Y, Z` |
| Critic disputes without per-case citation | Reject unsourced critic claims |
| Auditor + critic share input context (both read original spec) | Critic sees Pass 1 output ONLY — never original spec |
| Skip Pass 2 because "auditor seems thorough" | Adversarial persona is the safety net; never skip on HIGH-risk surfaces |
| Synthesis relaxes coverage | Strictest wins always; never weaken |

## Cross-references

- [`categorical-surfaces.md`](categorical-surfaces.md) — identification methodology + universe-enumeration discipline
- [`SKILL.md`](../SKILL.md) — entry point and skill-level verdict synthesis
- `docs/specs/mvp/constitution.md` R5.6 — separate-persona pattern (origin)
- `docs/specs/mvp/PRD.md` §10.10 — comprehension-debt pacing (why dynamic enumeration matters)

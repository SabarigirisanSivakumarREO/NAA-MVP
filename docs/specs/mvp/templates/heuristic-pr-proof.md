---
title: Heuristic PR Contract Proof Block (T0B-003)
artifact_type: template
status: active
version: 1.0.0
created: 2026-05-06
owner: engineering lead
purpose: Per-heuristic Proof block that PR authors paste into the PR body to surface R15.3.2 verification evidence. Extends PRD §10.9 PR Contract Block 2 (Proof) with heuristic-specific fields. Required for every PR that adds or modifies heuristics-repo/*.json files.
governing_rules:
  - Constitution R6 (IP — surface EVIDENCE of verification, NEVER the IP-bearing content itself)
  - Constitution R15.3.1 (5 provenance fields — 4 visible in PR body; citation_text NEVER pasted)
  - Constitution R15.3.2 (HUMAN VERIFICATION MANDATORY — this Proof block IS the audit trail)
  - Constitution R23 (kill criteria — PR reviewer rejects if any field is empty or implausible)
  - PRD §10.9 (PR Contract — 4-block format; this template extends Block 2)
related_artifacts:
  - docs/specs/mvp/templates/heuristic-drafting-prompt.md (T0B-001 — produces draft_model field consumed here)
  - docs/specs/mvp/templates/heuristic-verification-protocol.md (T0B-002 — produces verified_by + verified_date + re-derivation note consumed here)
  - apps/cli/src/commands/heuristic-lint.ts (T0B-004 — produces lint status consumed here)
  - heuristics-repo/README.md (T0B-005 — references this template as the PR-time gate)
  - docs/specs/mvp/PRD.md §10.9 (PR Contract base template extended here)
  - docs/specs/mvp/phases/phase-0b-heuristics/spec.md v0.4 (R-03 + AC-03)
  - docs/specs/mvp/phases/phase-0b-heuristics/plan.md v0.4 §4 (this template's design source)
---

# Heuristic PR Contract Proof Block

> **Purpose:** Standardized per-heuristic Proof block that PR authors paste into the PR body to surface verification evidence. Required for every PR that adds OR modifies files under `heuristics-repo/`. Reviewers spot-check by clicking through the cited `source_url` and confirming the citation appears at the linked location.

> **★ When to use:** When opening a PR that adds new heuristic JSON files under `heuristics-repo/{baymard,nielsen,cialdini}/*.json`. One Proof entry per heuristic file in the PR.

> **★ Workflow position:** **STEP 4 of 4.**
> 1. Draft  — [T0B-001 prompt template](heuristic-drafting-prompt.md)
> 2. Verify — [T0B-002 verification protocol](heuristic-verification-protocol.md)
> 3. Lint   — `pnpm heuristic:lint <file>` (T0B-004)
> 4. **Commit** — *this template* (paste into PR body per PRD §10.9)

> **★ Constitutional discipline (R6.1):** This Proof block surfaces EVIDENCE that verification happened — NOT the IP-bearing content itself. NEVER paste `body`, `citation_text`, `benchmark.standard_text`, or `benchmark.value` into the PR body. Those fields stay inside the JSON file in the private `heuristics-repo/` git location. The PR body only carries metadata: heuristic_id (public), source_url (public — already cited), drafted/verified attribution (workflow audit), and pass/fail statuses (no IP).

---

## Where this template fits in the PR body

PRD §10.9 mandates the **4-block PR Contract** for every PR:

1. **What / Why** (1-2 sentences)
2. **Proof** (concrete evidence)
3. **Risk tier + AI involvement**
4. **Review focus** (3-5 bullets)

For heuristics PRs, **Block 2 (Proof) is extended** with the per-heuristic block(s) below. The other 3 blocks remain standard PRD §10.9 content.

The PR body shape for a heuristic PR is:

```markdown
## PR Contract

### 1. What / Why
{1-2 sentences explaining which heuristic(s) this PR adds and why now —
e.g., "Add 5 Baymard checkout heuristics (BAYMARD-CHECKOUT-001..005) per
T103 week-2 batch 1, covering guest checkout / form fields / address
autocomplete / payment options / order summary visibility."}

### 2. Proof — Standard PR Contract evidence
- `pnpm heuristic:lint heuristics-repo/baymard/BAYMARD-CHECKOUT-00{1,2,3,4,5}.json` ✅ exit 0
- `pnpm typecheck` ✅
- `pnpm test` ✅ (no schema regression)
- Spot-check log entry: `heuristics-repo/_spot-checks.md` (if this PR is the +10 / +20 / +30 mark)

### 2.1 Proof — Heuristic Verification (R15.3.2) ★ this template
{Paste one Heuristic Verification block per heuristic in this PR, per
the §"Per-heuristic block template" below.}

### 3. Risk tier + AI involvement
- Tier: LOW — content authoring; HeuristicSchemaExtended already locked in T101
- AI-generated: heuristic body + benchmark + manifest selectors (LLM-drafted via T0B-001)
- Human-written: verified_by + verified_date (manual re-derivation per T0B-002);
  any post-draft corrections to manifest selectors per Step 5

### 4. Review focus
- Reviewer clicks through 1-2 random source_url links per PR; confirms cited
  text is present + supports the heuristic body
- Reviewer scans for any drift between cited source value and heuristic
  benchmark.value (±20% rule per T0B-002 Step 3a)
- Reviewer confirms manifest selectors match heuristic applicability
  (T0B-002 Step 5)
- Reviewer trusts lint output for schema-level checks (T0B-004 covers
  Zod parse + provenance non-empty + manifest selectors + banned-phrase regex)
```

---

## Per-heuristic block template (paste one per heuristic in the PR)

```markdown
#### {HEURISTIC_ID}

- **File:** `heuristics-repo/{source}/{HEURISTIC_ID}.json`
- **Drafted by:** `{provenance.draft_model}` on `{draft_date_ISO}`
- **Verified by:** `{provenance.verified_by}` on `{provenance.verified_date}` (T0B-002 protocol)
- **Source URL:** [`{provenance.source_url}`]({provenance.source_url}) — status: `{200 OK | 404 → archived at <wayback_url>}`
- **Citation locate:** ✅ Verbatim text present at source URL §`{section_anchor}`
- **Benchmark re-derivation (T0B-002 Step 3):** `{1-2 sentence note. Examples:
    Quantitative — "Source states 44.5%; benchmark.value = 44; within ±20%
                    tolerance ([35.6, 53.4])."
    Qualitative — "Source describes 'CTA visible above fold without scrolling';
                   benchmark.standard_text paraphrases as 'Primary CTA visible
                   above fold without scrolling, especially on mobile' —
                   faithful paraphrase, no extrapolation."}`
- **Lint:** `pnpm heuristic:lint heuristics-repo/{source}/{HEURISTIC_ID}.json` ✅ exit 0
- **Banned-phrase check (R5.3 / GR-007):** ✅ no conversion-rate predictions detected
  in `body` (manual scan per T0B-002 Step 4 + lint regex per T0B-004)
- **Manifest selectors:**
  - archetype: `{[…]}` — verified applicability per T0B-002 Step 5
  - page_type: `{[…]}` — verified
  - device: `{[…]}` — verified
- **Re-draft attempts:** `{N — typically 1; >1 if first draft was rejected at
   any T0B-002 step, with 1-line note on what was corrected}`
```

---

## Worked example — BAYMARD-CHECKOUT-001

(Continues from the worked Baymard checkout heuristic in [T0B-001 §Worked example](heuristic-drafting-prompt.md) and [T0B-002 §The 8-Step Verification Protocol](heuristic-verification-protocol.md). Same heuristic; this is what the PR body looks like.)

```markdown
#### BAYMARD-CHECKOUT-001

- **File:** `heuristics-repo/baymard/BAYMARD-CHECKOUT-001.json`
- **Drafted by:** `claude-sonnet-4-20250514` on `2026-05-12T10:15:00Z`
- **Verified by:** `Sabari Sivakumar` on `2026-05-12T14:30:00Z` (T0B-002 protocol)
- **Source URL:** [https://baymard.com/blog/checkout-form-field-study](https://baymard.com/blog/checkout-form-field-study) — status: `200 OK`
- **Citation locate:** ✅ Verbatim text present at source URL §"Forced Account Creation"
- **Benchmark re-derivation (T0B-002 Step 3):** Source describes "guest checkout option, prominently positioned alongside or above the account-creation flow, see materially lower abandonment rates"; benchmark.standard_text paraphrases as "Guest checkout option visible at start of checkout flow with equal-or-greater visual weight than account-creation CTA" — faithful paraphrase, no extrapolation. (Qualitative branch chosen because the source describes a normative standard, not a single measurable threshold; the 24% abandonment statistic is descriptive, included in body for context but not as the benchmark.)
- **Lint:** `pnpm heuristic:lint heuristics-repo/baymard/BAYMARD-CHECKOUT-001.json` ✅ exit 0
- **Banned-phrase check (R5.3 / GR-007):** ✅ no conversion-rate predictions detected in `body` (manual scan per T0B-002 Step 4 + lint regex per T0B-004)
- **Manifest selectors:**
  - archetype: `["D2C", "marketplace"]` — verified applicability per T0B-002 Step 5 (SaaS excluded — different checkout semantics)
  - page_type: `["checkout"]` — verified (does NOT apply to cart or PDP — guest-checkout option is a checkout-page element specifically)
  - device: `["mobile", "desktop", "tablet", "balanced"]` — verified (device-agnostic per source; mobile checkout abandonment is even higher)
- **Re-draft attempts:** 1 — first draft was accepted; no re-draft loop triggered.
```

---

## What NEVER to include in the PR body (R6.1 IP boundary)

| ❌ NEVER paste in PR body | Why |
|---|---|
| `body` field content (the prose rule text) | This IS the IP — heuristic content surface per R6.1 |
| `provenance.citation_text` (verbatim source excerpt) | Already at source_url; the verifier confirmed presence — that's enough evidence |
| `benchmark.value` (the actual threshold number) | IP — leaks the heuristic's enforcement specificity |
| `benchmark.standard_text` (the qualitative reference) | IP — same |
| `benchmark.unit` / `benchmark.metric` (revealing context) | Also IP per Phase 6 spec.md v0.4 line 102 — Pino redaction includes these paths |
| Screenshots of the heuristic JSON | Same — the JSON content is private even in image form |
| LLM drafting transcripts (`.heuristic-drafts/<id>.json`) | Gitignored per R15.3.3; never share via PR comments either |
| Author's reasoning narrative reproducing body content | Even paraphrased reasoning leaks IP |

| ✅ SAFE to include in PR body | Why |
|---|---|
| `id` (e.g., `BAYMARD-CHECKOUT-001`) | Public — IDs are referenced in findings citing the heuristic |
| File path (`heuristics-repo/baymard/BAYMARD-CHECKOUT-001.json`) | Public — file exists in private repo; path is metadata |
| `provenance.source_url` (the cited URL) | Public — it's a public web page being cited |
| `provenance.draft_model` (LLM model id) | Public — workflow audit metadata |
| `provenance.verified_by` (your name) | Public — you're the verifier |
| `provenance.verified_date` (ISO datetime) | Public — workflow audit metadata |
| Re-derivation note (your 1-2 sentence summary of HOW the benchmark traces to the source) | Public — proves verification happened; does NOT reproduce body or citation_text |
| Lint status (✅/❌ + filename) | Public — workflow signal |
| Banned-phrase check status (✅/❌ + filename) | Public — workflow signal |
| Manifest selector arrays (`archetype: [...]`, `page_type: [...]`, `device: [...]`) | Public — taxonomy values from T101 enums; do NOT leak heuristic content |

> **★ Reviewer guidance:** If you spot a PR where the author has pasted `body` / `citation_text` / `benchmark.standard_text` / `benchmark.value` content into the PR body, **block the PR** with a comment citing R6.1, ask the author to amend the PR description to remove the content (use `git rebase` if necessary to scrub the comment history; PR comments themselves CANNOT be redacted retroactively in GitHub — if content was pasted into a comment, the heuristic itself becomes IP-compromised and may need to be re-authored under a new ID).

---

## Multiple-heuristic PR pattern

For PRs landing 5+ heuristics in a batch (typical for T103 Baymard, T104 Nielsen, T105 Cialdini week 4 batches), use this layout:

```markdown
### 2.1 Proof — Heuristic Verification (R15.3.2) ★ T0B-003 template

5 heuristics in this PR. Per-heuristic blocks follow.

#### BAYMARD-CHECKOUT-001
{...standard per-heuristic block...}

#### BAYMARD-CHECKOUT-002
{...}

#### BAYMARD-CHECKOUT-003
{...}

#### BAYMARD-CHECKOUT-004
{...}

#### BAYMARD-CHECKOUT-005
{...}

### 2.2 Spot-check note (if applicable)
This PR brings the total committed heuristic count to 10. Spot-check round 1
will fire next per F-012 acceptance — DIFFERENT verifier samples 5 random
heuristics and re-derives benchmarks. Result logged at
`heuristics-repo/_spot-checks.md`. PR remains held until spot-check passes
(≤1 of 5 divergent per AC-12).
```

---

## Why this Proof block is non-skippable

| If skipped | What breaks |
|---|---|
| No Proof block at all | Reviewer cannot confirm verification happened → R15.3.2 violation; PR cannot merge |
| Empty `verified_by` field | Lint already rejected the JSON (Zod `.min(1)`) — won't reach PR review |
| Missing re-derivation note | Reviewer cannot spot-check benchmark accuracy → spot-check protocol becomes the only safety net (delayed, sampling-based) → F-012 spot-check fail rate likely jumps |
| Missing source_url status | Reviewer must independently verify URL liveness → review burden grows; archive failures slip through |
| Pasted `body` content into PR description | R6.1 violation; heuristic IP compromise; potentially requires re-authoring under new ID + post-mortem |

The Proof block trades ~5 minutes of PR-author effort for orders of magnitude lower review burden and a permanent audit trail that survives long after the heuristic ships.

---

## Cross-references

- **Source-of-truth schema:** `packages/agent-core/src/analysis/heuristics/types.ts` — `HeuristicSchemaExtended` Zod schema. The PR Proof block surfaces the 5 R15.3.1 provenance fields verbatim from this schema (minus `citation_text` per R6).
- **Phase 0b spec.md v0.4 R-03:** PR Contract Proof block functional requirement.
- **Phase 0b spec.md v0.4 AC-03:** acceptance criterion for this template.
- **Phase 0b plan.md v0.4 §4:** this template's design source.
- **PRD §10.9 PR Contract:** the 4-block parent template this Proof block extends in Block 2.
- **Drafting prompt (T0B-001):** [`heuristic-drafting-prompt.md`](heuristic-drafting-prompt.md) — produces `draft_model` field consumed here.
- **Verification protocol (T0B-002):** [`heuristic-verification-protocol.md`](heuristic-verification-protocol.md) — produces `verified_by` + `verified_date` + re-derivation note consumed here.
- **Lint CLI (T0B-004):** to be authored at `apps/cli/src/commands/heuristic-lint.ts` — produces lint status consumed here. **D1 BINDING** — Zod-error redaction + `NEURAL_TEST_FIXTURE_BODY` sentinel test ensure lint output itself never leaks heuristic body content.
- **Repository README (T0B-005):** `heuristics-repo/README.md` — references this template as the PR-time gate.

---

*End of T0B-003 — Heuristic PR Contract Proof Block v1.0.0*

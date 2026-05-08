# `heuristics-repo/` — Neural CRO Heuristic Knowledge Base

> **What this is:** the source-controlled location for Neural's CRO heuristic content (Baymard / Nielsen / Cialdini). 30 heuristics ship in MVP per PRD §F-012 v1.2. Phase 6 `HeuristicLoader.loadAll()` reads JSON files from here at runtime; Phase 7 EvaluateNode injects filtered subsets into LLM prompts.

> **Who reads this:** any engineer about to author, modify, or spot-check a heuristic. **Read end-to-end before authoring your first heuristic.** New authors should be able to ship their first verified heuristic by following only this document + the 4 sibling templates linked below.

> **★ This is REO Digital's IP.** Every heuristic body, benchmark, citation, and provenance entry is intellectual property protected by Constitution R6. The IP discipline (§ "R6 / R15.3.3 IP boundary — what you MUST NOT do" below) is non-negotiable. Read it twice.

---

## Table of contents

1. [Directory layout](#directory-layout)
2. [The 4-step authoring workflow](#the-4-step-authoring-workflow)
3. [R6 / R15.3.3 IP boundary — what you MUST NOT do](#r6--r1533-ip-boundary--what-you-must-not-do) ★ D2 BINDING
4. [Spot-check protocol (F-012)](#spot-check-protocol-f-012)
5. [Kill criteria — when to STOP and escalate](#kill-criteria--when-to-stop-and-escalate)
6. [Author onboarding — first 30 minutes](#author-onboarding--first-30-minutes)
7. [Cross-references](#cross-references)

---

## Directory layout

```
heuristics-repo/
├── README.md                 ← THIS file (T0B-005)
├── baymard/                  ← T103 (~15 heuristics, week 4)
│   ├── BAYMARD-HOMEPAGE-001.json
│   ├── BAYMARD-PDP-001.json
│   ├── BAYMARD-CHECKOUT-001.json
│   ├── BAYMARD-CART-001.json
│   └── ...
├── nielsen/                  ← T104 (~10 heuristics, week 4)
│   ├── NIELSEN-VISIBILITY-001.json
│   ├── NIELSEN-ERROR-001.json
│   └── ...
├── cialdini/                 ← T105 (~5 heuristics, week 4)
│   ├── CIALDINI-SOCIALPROOF-001.json
│   ├── CIALDINI-SCARCITY-001.json
│   └── ...
├── _spot-checks.md           ← cross-checker log (3 rounds at +10/+20/+30 marks)
├── _dedup-log.md             ← rejected duplicates with rationale (per spec.md edge case)
└── _authoring-time-log.md    ← optional sampled per-heuristic time tracking (NF-02)
```

**Why split by source pack:** Phase 6 T106 `FileSystemHeuristicLoader.loadAll()` walks the directory tree; per-pack subdirectories make it easy to swap individual packs in v1.1+ (e.g., add a `wcag/` accessibility pack).

**Why ALL CAPS source prefix in heuristic IDs:** the T101 regex `/^[A-Z][A-Z0-9_]*-[A-Z][A-Z0-9_]*-\d{3,}$/` requires uppercase pack + category. Use `BAYMARD-`, `NIELSEN-`, `CIALDINI-` consistently.

**MVP storage policy:** plaintext JSON in this directory; the entire git repo is treated as private (REO-internal). v1.1 adds AES-256-GCM at-rest encryption per Constitution R6.2 (PRE-FIRST-PILOT requirement per PRD §3.2). Phase 6 ships `DecryptionAdapter` interface with `PlaintextDecryptor` MVP impl for v1.1 swap-in compatibility.

---

## The 4-step authoring workflow

Every new heuristic flows through these 4 steps, in order. Skipping or reordering breaks the IP / verification / quality gates.

### Step 1 — Draft

Use [`docs/specs/mvp/templates/heuristic-drafting-prompt.md`](../docs/specs/mvp/templates/heuristic-drafting-prompt.md) (T0B-001).

- Copy the SYSTEM block + USER template into a Claude Sonnet 4 SDK call **OR** a Claude Code subagent invocation.
- **Drafting subprocess MUST be isolated** — no LangSmith, no Pino, no `@neural/agent-core` runtime imports. See [§ "R6 / R15.3.3 IP boundary"](#r6--r1533-ip-boundary--what-you-must-not-do) for the full rule.
- Save the raw transcript (input prompt + raw output) to `.heuristic-drafts/<heuristic-id>.json` (gitignored — see Step 0 prerequisites in the drafting template).
- Output is a single JSON object conforming to T101 `HeuristicSchemaExtended`.

**Time:** ~5-10 sec wall-clock per LLM call; ~$0.02-$0.05 per heuristic.

### Step 2 — Verify

Use [`docs/specs/mvp/templates/heuristic-verification-protocol.md`](../docs/specs/mvp/templates/heuristic-verification-protocol.md) (T0B-002).

The 8-step human-verifier checklist:

1. URL liveness (open `provenance.source_url`; confirm 200 OK)
2. Citation locate (Ctrl+F for `provenance.citation_text` in the source page)
3. Benchmark re-derivation (±20% quantitative OR text-reference qualitative)
4. Banned-phrase check (no conversion-rate predictions in `body`)
5. Manifest selector sanity check (`archetype` / `page_type` / `device` arrays match heuristic applicability)
6. Fill `provenance.verified_by` + `provenance.verified_date` (your name + ISO-8601 datetime)
7. Run `pnpm heuristic:lint <file>` — must exit 0
8. Commit with PR Contract Proof block (Step 4)

**Time:** ~30 min per heuristic (the actual bottleneck — opening URLs, locating citations, re-deriving benchmarks).

**Re-draft loop:** if Steps 1-5 reject, re-run Step 1 with a stricter rider; new transcript saved as `.heuristic-drafts/<heuristic-id>-rev2.json`. **3-strike rule:** after 3 failed re-drafts on the same heuristic, STOP and escalate to engineering lead per [§ "Kill criteria"](#kill-criteria--when-to-stop-and-escalate).

### Step 3 — Lint

Run from repo root:

```bash
pnpm heuristic:lint heuristics-repo/<source>/<HEURISTIC-ID>.json
```

The CLI ([`apps/cli/src/commands/heuristic-lint.ts`](../apps/cli/src/commands/heuristic-lint.ts), T0B-004) runs 5 checks:

1. Zod parse against `HeuristicSchemaExtended` (T101 — `packages/agent-core/src/analysis/heuristics/types.ts`)
2. All 5 `provenance` fields non-empty
3. `benchmark` discriminated union present + well-formed
4. Manifest selectors `archetype` + `page_type` + `device` present (Phase 0b R-09 enforcement)
5. Banned-phrase regex on `body` (R5.3 + GR-007)

**Pass criterion:** exit code 0.

**D1 BINDING (focal):** the lint output redacts Zod error content. Errors emit only `<file>: <field-path> — <error_class>` — NEVER the failing field's value. This is the IP boundary holding at the developer-tool seam (the conformance test asserts via the `NEURAL_TEST_FIXTURE_BODY` sentinel). If you see actual heuristic content in lint output, **file an immediate bug** — that's a constitutional violation.

**Time:** <1 sec per heuristic; <2 sec for the full 30-pack glob.

### Step 4 — Commit

Use [`docs/specs/mvp/templates/heuristic-pr-proof.md`](../docs/specs/mvp/templates/heuristic-pr-proof.md) (T0B-003).

Open a PR per CLAUDE.md §6 + PRD §10.9. The PR body MUST include:

1. **PR Contract** (4 blocks per PRD §10.9): What/Why · Proof · Risk tier+AI · Review focus
2. **Spec Coverage** (per PRD §10.6): which AC-NN entries this PR satisfies (e.g., AC-06 for a Baymard heuristic toward T103's ~15)
3. **Heuristic Verification Proof block** (T0B-003 template) for EACH heuristic in the PR — surfaces verification evidence (drafted_by, verified_by + verified_date, source URL status, re-derivation note, lint result, banned-phrase status, manifest selectors)

Reviewer spot-checks by clicking through 1-2 random `source_url` links per PR.

**Time:** ~5 min PR-author effort; ~10 min reviewer effort per PR.

---

## R6 / R15.3.3 IP boundary — what you MUST NOT do ★ D2 BINDING

The drafting LLM responses are **just as protected as committed heuristic content** under Constitution R6.1. The following are **constitutional violations** — do them and the team's IP regime breaks (and so does the trust we place in it).

### ❌ FORBIDDEN sharing channels

| Action | Why it's forbidden | Constitutional rule |
|---|---|---|
| Pasting drafting LLM response into **Slack** | Heuristic content leaves IP boundary; Slack messages are searchable + back-uppable forever | R6.1 + R15.3.3 |
| **Emailing** the draft to a teammate for "quick review" | Email is forwardable, archived, indexable by search | R6.1 + R15.3.3 |
| Taking a **screenshot** of the draft and sharing | Image OCR makes screenshots fully searchable; phone galleries auto-back-up to cloud | R6.1 + R15.3.3 |
| Filing a **support ticket** (Linear / Jira / GitHub Issue / vendor support) with the draft attached | Ticket bodies often go to third-party systems with their own retention policies | R6.1 + R15.3.3 |
| Copy-pasting drafting prompt into **ChatGPT / other LLM** for "comparison" | Heuristic IP touches an unauthorized LLM provider's training pipeline | R6.1 + R15.3.3 |
| Asking a **non-engineering team member** (CRO consultant, marketing, sales) to "verify" by reading the draft | The verifier MUST be an engineer (per F-012 amendment + R15.3.2); content exposure to non-engineering risks broader leak | R15.3.2 (implicit) |
| Pushing **`.heuristic-drafts/`** to git | This local IP store is gitignored; pushing breaks R6.1 | R15.3.3 + `.gitignore` enforcement |
| Forwarding the verified `heuristics-repo/*.json` to a **client or external party** | Heuristic content leaves the repo IP boundary | R6.1 |

If you're ever unsure whether sharing something violates R6, **default to NO** and ask engineering lead via the secure channel (private GitHub PR comment on this repo).

### ✅ ACCEPTABLE verification channels

- **Local file editing** — the JSON file you're verifying is on your local disk only.
- **Local terminal commands** — open URL in browser, grep for citation, run `pnpm heuristic:lint`.
- **Engineering-lead escalation via the team's standard secure code-review channel** — typically a private GitHub PR comment on this repo. NEVER Slack DM. NEVER email. The PR comment must follow [§3 PR Contract Proof block](#step-4--commit) discipline (surface evidence, not content).
- **The PR Contract Proof block itself** — but only the EVIDENCE (URL status + verifier name + lint status), NEVER the full body / benchmark / citation_text content. See [`heuristic-pr-proof.md` "what NEVER to include" guard](../docs/specs/mvp/templates/heuristic-pr-proof.md) for the 8-row forbidden table.

### Drafting subprocess isolation requirements

When you author a script or invocation that calls Claude Sonnet 4 to draft a heuristic, that script MUST:

1. **NOT import `@neural/agent-core` or `@neural/agent-core/observability`** — agent-core wires Pino which would log drafting prompts. Use `@anthropic-ai/sdk` directly instead.
2. **NOT set `LANGCHAIN_TRACING_V2=true`** or any LangSmith env var — drafting LLM calls MUST NOT generate LangSmith traces. (LangSmith is for the production analyze pipeline only — Phase 7+.)
3. **Write transcripts to `.heuristic-drafts/<heuristic-id>.json`** — gitignored per the `.gitignore` entry added in T0B-004.
4. **NEVER be invoked from production runtime code** — drafting is META authoring tooling, NOT the audit pipeline. Conformance test (T0B-004 AC-13 channels b/c/d/e) asserts no `apps/` or `packages/` runtime module imports the drafting subprocess; the test runs vacuously today (drafting subprocess not yet authored) but will fire when `scripts/draft-heuristic.ts` lands.

If you need to draft heuristics today before `scripts/draft-heuristic.ts` exists, use a Claude Code subagent invocation (which is itself an isolated process, separate from the production runtime). Or write a one-off script under `scripts/` that imports `@anthropic-ai/sdk` directly + writes transcripts to `.heuristic-drafts/`.

### Why this matters

- **Heuristic content IS REO's competitive moat.** Without a defensible private corpus, Neural is just another LLM wrapper.
- **Lethal trifecta avoidance** (per Constitution + risks.md): private data + LLM + ability to exfiltrate = catastrophic. The drafting subprocess sits at the most dangerous junction.
- **Spot-check (§ below) catches divergence from cited sources.** D2 BINDING catches divergence from *channel discipline* — equally important.

---

## Spot-check protocol (F-012)

PRD §F-012 requires that a *different* engineer (not the original author) randomly re-verifies 5 heuristics at +10/+20/+30 commit marks. ≤1 of 5 may diverge per round; 2+ divergences PAUSE Phase 0b and trigger drafting-prompt review.

### Process per round

1. **Trigger:** the +10 / +20 / +30 commit lands (one of the T103/T104/T105 batches crosses the threshold).
2. **Sample:** the spot-checker uses a deterministic random sampler (e.g., `git ls-files heuristics-repo/{baymard,nielsen,cialdini}/*.json | shuf -n 5 --random-source=<(echo $RANDOM_SEED)`) to pick 5 random heuristics from the full committed set so far.
3. **Re-verify:** the spot-checker runs Steps 1-5 of [the verification protocol](#step-2--verify) (NOT Step 6 — they don't fill `verified_by` themselves; that's the original author's record). Specifically: open `source_url`, locate `citation_text`, re-derive benchmark, scan body for banned phrases, check manifest selectors.
4. **Log result** in `_spot-checks.md`:

   ```markdown
   ## Spot-check round 1 — +10 mark — 2026-05-26 — verifier: Engineer-B

   - BAYMARD-CHECKOUT-002 — ✅ verified (44.5% from source matches benchmark.value 44 within ±20%)
   - NIELSEN-VISIBILITY-003 — ✅ verified (qualitative standard faithful paraphrase)
   - BAYMARD-PDP-001 — ✅ verified
   - CIALDINI-SOCIALPROOF-001 — ❌ diverges (source says 88% trust, benchmark.value 75; >±20%)
   - BAYMARD-FORMS-002 — ✅ verified

   Divergence count: 1/5 — within F-012 acceptance (≤1 of 5)
   Action: CIALDINI-SOCIALPROOF-001 rejected; original author re-drafts in next batch.
   ```

5. **Decision:**
   - **0-1 divergence** → Phase 0b proceeds. The diverging heuristic (if any) is rejected and re-drafted by the original author; reviewer's PR comment explains the rejection. Other heuristics in the batch are unaffected.
   - **2+ divergences** → Phase 0b **PAUSES**. Engineering lead reviews the drafting prompt + verification protocol for systematic drift. Possible outcomes: (a) tighten the drafting prompt's SYSTEM rider, (b) re-train the original author, (c) re-verify ALL of the original author's previous heuristics in the batch.

### Solo-engineering teams

If you're solo (or a 2-person team where the other engineer authored the heuristic in question), engineering lead serves as spot-checker for all 3 packs. Document this arrangement at the top of `_spot-checks.md`.

---

## Kill criteria — when to STOP and escalate

Per Phase 0b plan.md §7. If any of these triggers fire, **STOP authoring**, snapshot state to `.heuristic-drafts/`, and escalate to engineering lead via the secure code-review channel.

| Category | Trigger | Action |
|---|---|---|
| **Resource — cost** | Cumulative drafting cost > $25 (NF-01 target is $15) | STOP. Audit drafting prompt for token bloat. |
| **Resource — time** | Per-heuristic draft + verify p50 > 90 min after smoothing first 5 (NF-02 target is 45 min) | STOP. Workflow protocol review. |
| **Resource — iterations** | Same heuristic re-drafted 3+ times without successful verification (3-strike rule) | STOP. Likely a source-citation problem or systematic prompt drift. |
| **Quality — divergence** | Spot-check divergence rate > 20% (>1 of 5 in any round) | STOP. Reject the entire batch since last good spot-check. Workflow protocol review. |
| **Quality — schema** | `pnpm heuristic:lint` failure rate > 0% on a heuristic AFTER human verification (verifier marked verified, lint rejects) | STOP. Verifier protocol failure — re-train; re-verify all of that verifier's heuristics. |
| **Scope** | Engineer tempted to skip verification because "this one is obviously right" | STOP. R15.3.2 is non-negotiable. |
| **R6 boundary** | Drafting LLM response written to LangSmith / Pino / dashboard / Slack / email / screenshot / support-ticket / unauthorized LLM | STOP. **Constitutional violation.** Audit subprocess wiring; reject ALL heuristics drafted in that session; potential re-authoring under new IDs (PR comments cannot be redacted retroactively in GitHub). |

When kill criteria trigger, the engineering lead (a) snapshots state, (b) logs the trigger reason at the bottom of this README under a new "Kill criteria firings" section, (c) decides resume strategy (protocol patch / prompt patch / verifier change), (d) does **NOT** silently bypass the trigger.

---

## Author onboarding — first 30 minutes

If this is your first time authoring a Neural heuristic, do this in order:

1. **Read this README end-to-end** (~10 min). The "R6 / R15.3.3 IP boundary" section is the most important.
2. **Skim the 4 sibling templates** (~10 min total — they're each ~5 min reads):
   - [`heuristic-drafting-prompt.md`](../docs/specs/mvp/templates/heuristic-drafting-prompt.md) — Step 1
   - [`heuristic-verification-protocol.md`](../docs/specs/mvp/templates/heuristic-verification-protocol.md) — Step 2
   - [`heuristic-pr-proof.md`](../docs/specs/mvp/templates/heuristic-pr-proof.md) — Step 4
   - [`apps/cli/src/commands/heuristic-lint.ts`](../apps/cli/src/commands/heuristic-lint.ts) source — Step 3 (read the JSDoc + the 5-check function bodies)
3. **Skim the T101 schema** (~5 min): [`packages/agent-core/src/analysis/heuristics/types.ts`](../packages/agent-core/src/analysis/heuristics/types.ts). Understand the 11 top-level fields + the 3 enums.
4. **Run the lint CLI smoke test** (~2 min):
   ```bash
   pnpm heuristic:lint apps/cli/tests/fixtures/heuristics/valid.json
   # → ✓ heuristic:lint: 1 file(s) passed (exit 0)

   pnpm heuristic:lint apps/cli/tests/fixtures/heuristics/invalid-banned-phrase.json
   # → 1 redacted error line; exit 1
   ```
5. **Confirm `.gitignore` has `.heuristic-drafts/`** (~10 sec):
   ```bash
   grep '.heuristic-drafts/' .gitignore
   # → expect 1 line
   ```
6. **You're ready** — pick your first assigned heuristic ID from `tasks-v2.md` Phase 6 section (T103/T104/T105) and start with Step 1 of [the workflow](#the-4-step-authoring-workflow).

---

## Cross-references

- **PRD:** [`docs/specs/mvp/PRD.md`](../docs/specs/mvp/PRD.md) §F-012 (Heuristic Knowledge Base — 30 heuristics MVP per v1.2 amendment)
- **Phase 0b spec:** [`docs/specs/mvp/phases/phase-0b-heuristics/spec.md`](../docs/specs/mvp/phases/phase-0b-heuristics/spec.md) v0.5 — R-01..R-12 + AC-01..AC-15
- **Phase 0b plan:** [`docs/specs/mvp/phases/phase-0b-heuristics/plan.md`](../docs/specs/mvp/phases/phase-0b-heuristics/plan.md) v0.5 — sequencing, drafting prompt design, verification protocol, R6 isolation, kill criteria
- **Constitution rules:**
  - **R6** (IP protection — focal)
  - **R15.3** (benchmark + provenance both required)
  - **R15.3.1** (5 provenance fields: source_url, citation_text, draft_model, verified_by, verified_date)
  - **R15.3.2** (human verification mandatory)
  - **R15.3.3** (LLM-drafted content is still IP)
  - **R5.3 + GR-007** (no conversion-rate predictions)
  - **R23** (kill criteria)
- **T101 schema source-of-truth:** [`packages/agent-core/src/analysis/heuristics/types.ts`](../packages/agent-core/src/analysis/heuristics/types.ts)
- **Lint CLI:** [`apps/cli/src/commands/heuristic-lint.ts`](../apps/cli/src/commands/heuristic-lint.ts) + [conformance test](../apps/cli/tests/conformance/heuristic-lint.test.ts)
- **Architecture spec (legacy — v2.4 supersession queued):** [`docs/specs/final-architecture/09-heuristic-kb.md`](../docs/specs/final-architecture/09-heuristic-kb.md). Note: §9.1's structured shape is SUPERSEDED by T101's body-string design per Phase 0b spec.md v0.4 supersession callout.
- **Phase 6 engine (downstream consumer):** [`docs/specs/mvp/phases/phase-6-heuristics/`](../docs/specs/mvp/phases/phase-6-heuristics/) — `HeuristicLoader.loadAll()` reads JSON files from this directory.
- **Phase 4b context filter (downstream consumer):** [`docs/specs/mvp/phases/phase-4b-context-capture/`](../docs/specs/mvp/phases/phase-4b-context-capture/) T4B-013 — `loadForContext()` filters by manifest selectors (`archetype`, `page_type`, `device`).

---

*Maintained by engineering. Updates require a Phase 0b spec.md / plan.md amendment + R17 lifecycle bump per CLAUDE.md §8c.*

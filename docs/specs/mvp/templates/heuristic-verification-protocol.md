---
title: Heuristic Verification Protocol (T0B-002)
artifact_type: template
status: active
version: 1.0.0
created: 2026-05-06
owner: engineering lead
purpose: Human-verifier checklist that converts an LLM-drafted heuristic JSON into a committable, IP-protected, R15.3.2-compliant artifact. Mandatory for every LLM-drafted heuristic before commit.
governing_rules:
  - Constitution R6 (IP — drafting LLM responses isolated; verification logs gitignored)
  - Constitution R15.3 (benchmark + provenance both required — verifier confirms presence + correctness)
  - Constitution R15.3.1 (5 provenance fields — verifier fills verified_by + verified_date)
  - Constitution R15.3.2 (HUMAN VERIFICATION MANDATORY — focal rule for this protocol)
  - Constitution R15.3.3 (LLM-drafted content is still IP — verifier MUST NOT share drafting responses via Slack / email / screenshot / support ticket)
  - Constitution R5.3 + GR-007 (no conversion-rate predictions — verifier scans body + recommendation prose)
  - Constitution R23 (kill criteria — 3-strike rule triggers engineering-lead escalation)
schema_source_of_truth: packages/agent-core/src/analysis/heuristics/types.ts (T101; HeuristicSchemaExtended)
related_artifacts:
  - docs/specs/mvp/templates/heuristic-drafting-prompt.md (T0B-001 — runs BEFORE this protocol)
  - docs/specs/mvp/templates/heuristic-pr-proof.md (T0B-003 — runs AFTER this protocol; consumes verified_by + verified_date)
  - apps/cli/src/commands/heuristic-lint.ts (T0B-004 — `pnpm heuristic:lint` machine-side enforcement; this protocol is human-side)
  - heuristics-repo/README.md (T0B-005 — onboarding doc; references this protocol)
  - docs/specs/mvp/phases/phase-0b-heuristics/spec.md v0.4 (R-02 — authoring requirements; AC-02 — acceptance)
  - docs/specs/mvp/phases/phase-0b-heuristics/plan.md v0.4 §3 (this protocol's design source)
---

# Heuristic Verification Protocol

> **Purpose:** Standardized human-verifier checklist for every LLM-drafted heuristic before it enters `heuristics-repo/`. Converts a raw LLM JSON output into a Zod-valid, R15.3.2-compliant, IP-protected artifact ready for commit.

> **★ When to use:** Immediately after running the [drafting prompt template (T0B-001)](heuristic-drafting-prompt.md) and receiving a JSON object from Claude Sonnet 4. Run this protocol BEFORE `pnpm heuristic:lint` — the lint will fail until this protocol's outputs (verified_by + verified_date + corrected fields) are merged into the JSON.

> **★ Workflow position:** **STEP 2 of 4.**
> 1. **Draft** — [T0B-001 prompt template](heuristic-drafting-prompt.md)
> 2. **Verify** — *this document*
> 3. **Lint** — `pnpm heuristic:lint <file>` (T0B-004)
> 4. **Commit** — with [PR Contract Proof block (T0B-003)](heuristic-pr-proof.md) per PRD §10.9

> **★ Constitutional discipline (R15.3.2):** Verification is **non-skippable**. A human verifier MUST manually re-derive the benchmark from the cited source URL. Rubber-stamping (filling verified_by + verified_date without actually re-deriving) is a constitutional violation that the F-012 spot-check (3 rounds, 5 random heuristics each) is specifically designed to catch — if 2+ of 5 spot-checked heuristics diverge, the entire batch is rejected and the verifier's previous heuristics are re-verified.

> **★ Time budget:** ~30 min per heuristic (open URL, locate citation, re-derive benchmark, fill 2 fields, run lint, prepare PR). Engineering-lead kill criterion fires at >90 min p50 (per plan.md §7).

---

## Pre-flight (before opening this checklist)

- [ ] You have a JSON object from the [drafting prompt template (T0B-001)](heuristic-drafting-prompt.md) saved at `.heuristic-drafts/<heuristic-id>.json` (gitignored per R15.3.3)
- [ ] You have access to the cited `provenance.source_url` (browser bookmark or terminal `curl`)
- [ ] You have ~30 min of uninterrupted time
- [ ] You are the OWNER verifier for this heuristic (NOT the spot-check verifier — that is a separate, later cross-check by a different engineer per F-012 acceptance)

---

## The 8-Step Verification Protocol

### Step 1 — URL liveness check

**Action:** Open `provenance.source_url` in a fresh browser tab.

**Pass criterion:** URL resolves with HTTP 200 OK; the linked page loads and is human-readable in the language the citation was extracted in (typically English).

**Failure modes + actions:**
- **404 / DNS not found** → URL is dead. Find a stable archive (Wayback Machine: `https://web.archive.org/web/*/<original-url>`; Baymard archive; Nielsen Norman PDF download). Update `provenance.source_url` to the archive URL. If NO stable archive exists for the cited content, **REJECT** the heuristic — it cannot be verified.
- **Soft-404 / paywall / redirected to homepage** → Treat as 404. Same recovery.
- **Cloudflare bot challenge / region-blocked** → Try a different network or VPN to the cited region (Baymard.com is sometimes geo-restricted from non-EU IPs). If still blocked, snapshot to Wayback before abandoning.
- **LLM hallucinated the URL** (LLMs frequently fabricate plausible Baymard URLs that don't exist) → **REJECT** the heuristic. Re-draft (see [§Re-draft loop](#re-draft-loop) below) with USER rider: "The URL `<bad-url>` does not exist. Use this verified URL instead: `<good-url>`."

**Documentation:** Note the URL status in your verification scratch (e.g., "URL 200 OK" or "URL 404 → archived to https://web.archive.org/.../baymard-checkout-form-field-study"). The PR Contract Proof block (T0B-003) will reference this status.

---

### Step 2 — Citation locate

**Action:** In the open `source_url` tab, use **Ctrl+F** (or Cmd+F on macOS) to search for the verbatim text of `provenance.citation_text`.

**Pass criterion:** The exact citation text appears on the source page. Whitespace differences are acceptable; word-level differences are NOT.

**Failure modes + actions:**
- **Citation not found** (LLM may have paraphrased or fabricated) → Try locating just the most distinctive 6-10 word phrase from the middle of the citation. If no substring match exists, **REJECT** the heuristic. The drafting prompt requires the citation to be VERBATIM from the source — fabrication breaks R15.3.1.
- **Citation found but in a different context than the LLM claims** (e.g., LLM says it's about checkout but the source discusses cart abandonment in general) → Read the surrounding paragraphs. If the broader context still supports the heuristic, accept; otherwise **REJECT** and re-draft with a more accurate citation.
- **Citation found but the source is no longer authoritative** (e.g., Baymard updated their study and the cited number changed) → Update `citation_text` to the current source text; re-derive benchmark in Step 3 against the current value.

**Documentation:** Confirm "Citation located verbatim at <source_url> §<section name or paragraph anchor>". Capture the surrounding 1-2 paragraphs for the PR Contract Proof block (briefly — not the full page).

---

### Step 3 — Benchmark re-derivation

**Action:** Open the heuristic JSON. Read the `benchmark` field. Pick the appropriate sub-step based on `benchmark.kind`.

**Step 3a — Quantitative benchmark**

**Pass criterion:** The heuristic's `benchmark.value` is within **±20%** of the value cited in `provenance.citation_text`.

Example calculation:
```
Source citation: "44.5% of users abandon checkout when forced to register"
Heuristic benchmark.value: 44 (with unit "percent", metric "checkout_abandonment_rate")

±20% range of source value 44.5 = [35.6, 53.4]
Heuristic value 44 ∈ [35.6, 53.4] → ✅ PASS

vs.

Source citation: "44.5% of users abandon..."
Heuristic benchmark.value: 60
±20% range = [35.6, 53.4]
Heuristic value 60 ∉ [35.6, 53.4] → ❌ REJECT (diverges 35% from source)
```

**Failure modes + actions:**
- **Heuristic value outside ±20% of source** → **REJECT**. Do NOT silently update the benchmark to match the LLM's value (that would defeat R15.3.2 — verifier is meant to catch LLM hallucinations, not bless them). Re-draft with USER rider: "Use the value `<source-value>` verbatim from the citation. Do not interpolate or estimate."
- **Heuristic value inside ±20% but you doubt the source** (e.g., the LLM cited a value but you cannot find it in the source paragraph) → Find the value yourself. If your derived value puts the heuristic outside ±20%, **REJECT**.
- **Source provides a range, not a single value** (e.g., "between 30% and 50%") → Use the midpoint as the source value (40% in this example). Apply ±20% rule against the midpoint.
- **Unit mismatch** (e.g., source says "3 seconds", heuristic says `value: 3000, unit: "ms"`) → Acceptable IF the conversion is correct (3 sec = 3000 ms). REJECT if the conversion introduces drift outside ±20%.

**Step 3b — Qualitative benchmark**

**Pass criterion:** The heuristic's `benchmark.standard_text` paraphrases or quotes the source's normative statement. The heuristic's standard MUST NOT contradict or extrapolate beyond the source.

Example:
```
Source citation: "The primary CTA should be visible in the initial viewport
                  without requiring scrolling, especially on mobile devices."
Heuristic benchmark.standard_text: "Primary CTA visible above fold without
                                    scrolling, especially on mobile"
→ ✅ PASS (paraphrases the source faithfully)

vs.

Heuristic benchmark.standard_text: "Primary CTA must be the largest element
                                    on the page in the top 25% of viewport"
→ ❌ REJECT (extrapolates "size" + "top 25%" beyond what the source says)
```

**Failure modes + actions:**
- **Heuristic adds requirements not in source** (e.g., source says "visible above fold", heuristic says "above fold AND high contrast color AND minimum 18px font") → **REJECT**. Re-draft with USER rider: "Use only the standard described in the citation. Do not add requirements."
- **Heuristic contradicts source** (e.g., source says "above fold", heuristic says "below fold to avoid overwhelming") → **REJECT** as a verification failure (likely LLM misread the citation).
- **Heuristic is a vague paraphrase missing the source's specific guidance** (e.g., source says "trust badges placed near payment form", heuristic says "trust badges visible somewhere") → **REJECT** for being too generic; re-draft.

**Documentation (both 3a and 3b):** Write a 1-2 sentence re-derivation note for the PR Contract Proof block:
- Quantitative: "Source states 44.5% abandonment; heuristic value 44 within ±20% tolerance ([35.6, 53.4])."
- Qualitative: "Source describes 'CTA visible above fold without scrolling, especially on mobile'; heuristic paraphrases as 'Primary CTA visible above fold without scrolling, especially on mobile' — faithful paraphrase, no extrapolation."

---

### Step 4 — Banned-phrase check

**Action:** Read the heuristic's `body` field carefully. Scan for any conversion-rate prediction phrasing.

**Banned phrases (R5.3 + GR-007):**
- "increase conversions by N%"
- "lift CR by N%"
- "boost (sales | revenue | completion | conversion) by N%"
- "improve checkout completion rate by N%"
- "raise (revenue | conversion) by N%"
- Any other phrase that predicts a future percentage-point change in conversion as a result of applying the heuristic

**Allowed phrases:**
- Descriptive measurements of past behavior: "Baymard found 24% of users abandon..."
- Descriptive thresholds: "≤8 form fields per Baymard 2024"
- Citations: "per Nielsen Norman Group 2023"
- Binary indicators: "guest checkout option present"
- Qualitative comparisons: "above the fold without scrolling"

**Pass criterion:** Zero banned phrases found in `body`. (T0B-004 lint will also catch banned phrases via deterministic regex; this human check is the FIRST line of defense + catches paraphrases the regex might miss.)

**Failure modes + actions:**
- **Body contains banned phrasing** → **REJECT**. Re-draft with USER rider: "The body MUST NOT predict conversion-rate impact. Remove '<banned-phrase>'. Replace with descriptive language about the violation pattern + the recommendation, citing only past-behavior measurements from the source."
- **Body contains paraphrased prediction** (e.g., "users will be more likely to convert" or "this will help your conversion rate") → STILL **REJECT**. The constitutional ban is on PREDICTIONS, not on specific phrasing — paraphrases violate the spirit equally.

**Documentation:** Confirm "No banned phrasing detected" in your verification scratch.

---

### Step 5 — Manifest selector sanity check

**Action:** Read `archetype`, `page_type`, and `device` arrays. Confirm each value reflects the heuristic's actual applicability — NOT just whatever the input INPUTS contained.

**Pass criteria:**
- `archetype` correctly identifies the business archetypes where this heuristic applies. Common errors:
  - LLM tagged `["D2C", "SaaS"]` but the heuristic is checkout-specific → SaaS doesn't have checkout in the same sense → fix to `["D2C", "marketplace"]`
  - LLM omitted `["lead_gen"]` for a form-focused heuristic that DOES apply to lead-gen → add it
- `page_type` correctly identifies pages where this heuristic applies. Common errors:
  - LLM tagged `["checkout"]` only but the heuristic about trust signals also applies to `["pdp"]` and `["cart"]` → expand to `["pdp", "cart", "checkout"]`
- `device` correctly reflects device applicability. Common errors:
  - LLM defaulted to `["mobile", "desktop", "tablet", "balanced"]` (all) but the heuristic is mobile-specific (e.g., "thumb-zone CTA placement") → fix to `["mobile"]`
  - LLM tagged `["desktop"]` only but a desktop usability heuristic typically also applies to `["tablet"]` → expand

**Failure modes + actions:**
- **Selector clearly wrong** (e.g., a checkout heuristic tagged for `page_type: ["homepage"]`) → Fix in place; document the correction.
- **Selector enum value invalid** (e.g., LLM emitted `["e-commerce"]` instead of `["D2C"]`) → Fix in place; T0B-004 lint will reject anyway.
- **Selector missing entirely** → If the heuristic genuinely applies to all archetypes / page types / devices, leaving the field absent (`undefined`) is acceptable per T101's `matchesSelector` helper ("absent / empty = applies to all"). But if you can scope it more specifically, do so — narrower selectors improve Phase 4b T4B-013 `loadForContext()` filter precision.

**Documentation:** Confirm "Manifest selectors verified: archetype=`<value>`, page_type=`<value>`, device=`<value>`. Corrections made: <list or 'none'>."

---

### Step 6 — Fill verified_by + verified_date

**Action:** Edit the heuristic JSON to fill the two empty placeholders in `provenance`.

**Required values:**
- `verified_by`: your name (the owner verifier; NOT a future spot-check verifier). Use the same identifier you use in commit author metadata (`git config user.name`) for traceability. Example: `"Sabari Sivakumar"`.
- `verified_date`: today's ISO-8601 datetime in UTC matching the regex `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/`. Example: `"2026-05-12T14:30:00Z"`. Get it from `node -e "console.log(new Date().toISOString())"` or any ISO-8601 generator.

**Pass criterion:** Both fields are non-empty strings; verified_date matches the ISO-8601 regex; verified_by matches `git config user.name`.

**Failure modes + actions:**
- **You're tempted to skip this step because "this one is obviously right"** → **STOP**. R15.3.2 is non-negotiable. Per plan.md §7 kill criteria, this exact temptation is a tracked trigger requiring engineering-lead escalation before resume.
- **verified_date format wrong** (e.g., `2026-05-12` without time) → T0B-004 lint will reject. Fix to full ISO-8601.
- **verified_by left as `""`** (you forgot) → T0B-004 lint will reject (Zod `.min(1)`). Fix.

**Documentation:** Note the two values in your verification scratch — the PR Contract Proof block will cite them.

---

### Step 7 — Run `pnpm heuristic:lint`

**Action:** From repo root, run:

```bash
pnpm heuristic:lint heuristics-repo/<source>/<heuristic-id>.json
```

**Pass criterion:** Exit code 0. No errors in stdout/stderr.

**Failure modes + actions:**
- **Zod validation error** (any field fails the schema) → Read the lint output. Per D1 BINDING (T0B-004 conformance test asserts), the lint output redacts the offending field's value to prevent IP leak — you'll see the field path + error class only (e.g., `BAYMARD-CHECKOUT-001.json: provenance.verified_date — invalid_string`). Open the JSON, fix the offending field, re-run lint.
- **Banned-phrase regex match** (T0B-004's deterministic check found a phrase Step 4's manual review missed) → Open the JSON, rewrite the body to remove the phrase, re-run.
- **Missing manifest selector** (e.g., `archetype` field absent and the lint requires it) → Add the field per Step 5, re-run.
- **Lint hangs or crashes** → File a bug against T0B-004; do NOT silently bypass. Engineering-lead escalation.

**Documentation:** Capture the lint output (success message) for the PR Contract Proof block: e.g., "✅ `pnpm heuristic:lint heuristics-repo/baymard/BAYMARD-CHECKOUT-001.json` exit 0".

---

### Step 8 — Commit with PR Contract Proof block

**Action:** Stage the heuristic JSON file + open a PR per CLAUDE.md §6 + PRD §10.9.

**Required PR body sections:**
1. **PR Contract** (4 blocks per PRD §10.9): What/Why · Proof · Risk tier+AI · Review focus
2. **Spec Coverage** (per PRD §10.6): list which AC-NN entries this PR satisfies (e.g., AC-06 for a Baymard heuristic counted toward T103's ~15)
3. **Heuristic Verification Proof block** (per [T0B-003 template](heuristic-pr-proof.md)) — for EACH heuristic in the PR:
   - Heuristic ID
   - File path
   - Drafted by (LLM model id from `provenance.draft_model`)
   - Verified by + verified date (from Step 6)
   - Source URL (with status note from Step 1)
   - Re-derivation note (from Step 3)
   - Lint status (from Step 7)
   - Banned-phrase check status (from Step 4)
   - Manifest selectors (from Step 5)

**Commit message format** (per CLAUDE.md §6):
```
content(heuristics): T103.<NN> <one-line description> (REQ-HK-001)

Drafted by claude-sonnet-4-<MODEL-ID>; verified by <name> on <date>.
Source: <source_url> (200 OK | archived at <wayback-url>).
Re-derivation: <1-2 sentence note>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

**Pass criterion:** PR opens cleanly; CI runs (when CI is wired in week 9+); reviewer can spot-check by clicking through `source_url` once or twice.

**Failure modes + actions:**
- **Reviewer rejects with "couldn't locate the citation in the source"** → Re-run Step 2 with reviewer; if you also can't find it, the original verification was sloppy → withdraw the PR, redo verification.
- **Reviewer asks for a fix** → Address the comment, push a follow-up commit, request re-review. Do NOT amend the verified_by+verified_date fields without ALSO re-running Step 3 (the verification is what those fields attest to).

---

## Re-draft loop

If a heuristic FAILS at any step (1-5), do NOT commit. Re-run the [drafting prompt template (T0B-001)](heuristic-drafting-prompt.md) with a USER rider that addresses the specific failure. Save the new draft to `.heuristic-drafts/<heuristic-id>-revN.json` (incrementing N).

Each re-draft attempt:
1. Logs a new `provenance.draft_model` (same model, but the new attempt is a distinct LLM call)
2. Saves a new `.heuristic-drafts/` transcript (gitignored)
3. Restarts at Step 1 of this protocol

### 3-Strike Re-Draft Rule (R23 kill criterion — per plan.md §7)

**If the same heuristic fails verification 3 times** (i.e., 3 separate re-drafts all rejected at one or more of Steps 1-5):

1. **STOP.** Do NOT attempt a 4th re-draft.
2. **Snapshot state:** save all 3 `.heuristic-drafts/<heuristic-id>-rev{1,2,3}.json` transcripts.
3. **Document failure mode:** which step rejected each attempt? Common patterns:
   - 3× fail at Step 1 (URL liveness) → the cited research likely doesn't exist; LLM is hallucinating
   - 3× fail at Step 3 (benchmark re-derivation) → the source genuinely doesn't support a benchmark; consider a qualitative-only heuristic
   - 3× fail at Step 4 (banned phrasing) → the source itself uses prediction language; pick a different source or rewrite the heuristic to avoid quoting predictions
4. **Escalate to engineering lead** with:
   - The 3 transcripts
   - The failure-mode analysis
   - A recommendation: re-source / re-frame / abandon the heuristic
5. **Engineering lead decides** whether to:
   - Adjust the drafting prompt (system rider that prevents the recurring failure)
   - Pick a different source for this heuristic
   - Abandon this heuristic (drop from the planned ~15/~10/~5 count and pick a replacement)
6. **Do NOT silently bypass** the 3-strike trigger. The whole point is catching systematic prompt drift early.

---

## R6 / R15.3.3 Discipline (CRITICAL — read before every verification session)

The drafting LLM responses are **just as protected as committed heuristic content** under R6. The following are constitutional violations:

| Action | Why it violates | Constitutional rule |
|---|---|---|
| Pasting drafting LLM response into Slack | Heuristic content leaves IP boundary | R6.1 + R15.3.3 |
| Emailing the draft to a teammate for "quick review" | Same | R6.1 + R15.3.3 |
| Taking a screenshot of the draft and sharing | Same | R6.1 + R15.3.3 |
| Filing a support ticket with the draft attached | Same | R6.1 + R15.3.3 |
| Copy-pasting drafting prompt into ChatGPT (NOT the official drafting subprocess) for "comparison" | Heuristic IP touches an unauthorized LLM provider | R6.1 + R15.3.3 |
| Asking a non-engineering team member (CRO consultant, marketing, sales) to "verify" by reading the draft | The verifier MUST be an engineer (per F-012 amendment) | R15.3.2 (implicit) |
| Pushing `.heuristic-drafts/` to git | Local-only IP store breaks R6.1 | R15.3.3 + `.gitignore` enforcement |
| Forwarding the verified `heuristics-repo/*.json` to a client or external party | Heuristic content leaves the repo IP boundary | R6.1 |

**Acceptable verification channels:**
- Local file editing (the JSON file you're verifying is on your local disk only)
- Local terminal commands (open URL in browser, grep for citation, etc.)
- Engineering-lead escalation via the team's standard secure code-review channel (which itself MUST be IP-aware — typically a private GitHub PR comment, NOT Slack)
- The PR Contract Proof block — but only the EVIDENCE (URL + verifier name + lint status), NEVER the full body / benchmark / citation_text content

If you're ever unsure whether sharing something violates R6, **default to NO** and ask engineering lead via the secure channel.

---

## What this protocol does NOT cover

- **Drafting the heuristic** — that's [T0B-001](heuristic-drafting-prompt.md). Run T0B-001 first; this protocol consumes its output.
- **Spot-checking** — F-012 acceptance requires a *different* engineer to randomly re-verify 5 heuristics at +10/+20/+30 marks (per plan.md §1 + §8). This is a SEPARATE protocol; spot-checkers re-run Steps 1-5 (NOT 6-8) on a sampled subset and document divergences in `heuristics-repo/_spot-checks.md`.
- **Lint CLI implementation** — that's [T0B-004](#); the verifier just RUNS `pnpm heuristic:lint` per Step 7.
- **Repo onboarding** — [T0B-005's `heuristics-repo/README.md`](#) is the entry point for new authors; this protocol is referenced from it.
- **Author identification when there's no spot-check verifier available** — solo-engineering teams: engineering lead serves as spot-checker for all 3 packs (per spec.md §Assumptions). Document this arrangement in `heuristics-repo/_spot-checks.md`.

---

## Cross-references

- **Source-of-truth schema:** `packages/agent-core/src/analysis/heuristics/types.ts` — `HeuristicSchemaExtended` Zod schema. Step 7 `pnpm heuristic:lint` validates against this.
- **Phase 0b spec.md v0.4 R-02:** `docs/specs/mvp/phases/phase-0b-heuristics/spec.md` — verification protocol functional requirement.
- **Phase 0b spec.md v0.4 AC-02:** acceptance criterion for this template.
- **Phase 0b plan.md v0.4 §3:** this protocol's design source; bumps in lockstep with this template.
- **Phase 0b plan.md v0.4 §7 kill criteria:** the 3-strike rule + escalation triggers documented above are the same triggers tracked in plan.md.
- **Drafting prompt (T0B-001):** [`heuristic-drafting-prompt.md`](heuristic-drafting-prompt.md).
- **PR Contract Proof block (T0B-003):** [`heuristic-pr-proof.md`](heuristic-pr-proof.md) — to be authored next.
- **Lint CLI (T0B-004):** to be authored at `apps/cli/src/commands/heuristic-lint.ts` (D1 BINDING — Zod-error redaction + `NEURAL_TEST_FIXTURE_BODY` sentinel).
- **Repository README (T0B-005):** `heuristics-repo/README.md` — onboarding doc covering the full draft → verify → lint → PR workflow (D2 BINDING).

---

*End of T0B-002 — Heuristic Verification Protocol v1.0.0*

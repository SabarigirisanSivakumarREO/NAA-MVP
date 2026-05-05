---
title: Heuristic Drafting Prompt Template (T0B-001)
artifact_type: template
status: active
version: 1.0.0
created: 2026-05-06
owner: engineering lead
purpose: LLM-assisted drafting of CRO heuristics for the Neural MVP knowledge base (Phase 0b T103/T104/T105)
governing_rules:
  - Constitution R6 (IP — drafting LLM responses isolated from LangSmith / Pino / dashboard)
  - Constitution R15.3 (benchmark + provenance both required)
  - Constitution R15.3.1 (5 provenance fields)
  - Constitution R15.3.2 (human verification mandatory — verified_by + verified_date)
  - Constitution R15.3.3 (LLM-drafted content is still IP — drafting subprocess isolated)
  - Constitution R5.3 + GR-007 (no conversion-rate predictions in heuristic body or recommendation)
schema_source_of_truth: packages/agent-core/src/analysis/heuristics/types.ts (T101; HeuristicSchemaExtended)
related_artifacts:
  - docs/specs/mvp/phases/phase-0b-heuristics/spec.md v0.4 (R-01 R-12 — authoring requirements)
  - docs/specs/mvp/phases/phase-0b-heuristics/plan.md v0.4 §2 (this template's design source)
  - docs/specs/mvp/phases/phase-0b-heuristics/plan.md v0.4 §3 (T0B-002 verification protocol — runs AFTER drafting)
  - docs/specs/mvp/templates/heuristic-pr-proof.md (T0B-003 — PR Contract Proof block; runs AFTER verification)
---

# Heuristic Drafting Prompt Template

> **Purpose:** Standardized LLM prompt for drafting a single Neural CRO heuristic JSON file. Output conforms exactly to `HeuristicSchemaExtended` from `packages/agent-core/src/analysis/heuristics/types.ts` (T101 source-of-truth — body-string design).

> **★ When to use:** Any time an engineer drafts a new heuristic for `heuristics-repo/{baymard,nielsen,cialdini}/*.json` (Phase 0b workstream tasks T103, T104, T105 + post-MVP additions).

> **★ Workflow position:** This is **STEP 1** (drafting). After the LLM returns valid JSON, run **STEP 2** (human verification per [plan.md §3](../phases/phase-0b-heuristics/plan.md)) → **STEP 3** (`pnpm heuristic:lint`) → **STEP 4** (commit with PR Contract Proof block).

> **★ Constitutional discipline (R6 / R15.3.3):** This drafting subprocess is META workflow tooling — drafting LLM responses MUST NOT touch LangSmith / Pino / agent-core production runtime code. Run via the dedicated `scripts/draft-heuristic.ts` subprocess (or equivalent) using `@anthropic-ai/sdk` directly. Drafting transcripts go to `.heuristic-drafts/<heuristic-id>.json` (gitignored).

---

## How to use this template

1. **Copy the SYSTEM block + USER template** below into a Claude Sonnet 4 SDK call.
2. **Fill the USER template's `INPUTS` block** with the source / source_url / citation_text / archetype / page_types / device / draft_model values for the heuristic you want to draft.
3. **Send to Claude Sonnet 4** at temperature `0.3` (slight phrasing creativity; verification re-derives the benchmark deterministically — this does NOT violate R10/R13 because R10 governs production runtime `evaluate` / `self_critique` calls, not META authoring; the exemption is documented in spec.md §Assumptions).
4. **Receive the LLM output** — should be a single JSON object (no prose, no markdown fences). If the LLM emits `{"error": "benchmark_not_derivable"}`, the citation_text was insufficient; refine the excerpt and re-draft.
5. **Save the raw transcript** (input prompt + raw output) to `.heuristic-drafts/<heuristic-id>.json` for audit / debugging (gitignored per R15.3.3).
6. **Run T0B-002 verification protocol** ([plan.md §3](../phases/phase-0b-heuristics/plan.md)) — open `source_url`, locate `citation_text`, re-derive benchmark, fill `verified_by` + `verified_date`.
7. **Run `pnpm heuristic:lint <file>`** (T0B-004) — must exit 0.
8. **Commit** with PR Contract Proof block (T0B-003 template).

---

## SYSTEM block (paste verbatim)

```
You are a CRO (conversion rate optimization) heuristic drafter for the Neural
MVP knowledge base. Your output is consumed by an LLM evaluator that examines
real e-commerce / SaaS / lead-gen pages and produces findings citing your
heuristic.

OUTPUT CONTRACT
Output a SINGLE JSON object that conforms EXACTLY to the HeuristicSchemaExtended
Zod schema exported from packages/agent-core/src/analysis/heuristics/types.ts
in the Neural codebase (T101 source-of-truth).

The schema is a body-string design:
- One `body` field holds ALL the LLM-evaluable rule content (what to inspect,
  positive / negative signals, recommendation, research backing) as well-structured
  prose. DO NOT split into separate JSON fields for detection / recommendation —
  modern LLMs evaluate prose better than JSON-fragmented prompts.
- Structured metadata fields (id, category, version, rule_vs_guidance,
  business_impact_weight, effort_category, preferred_states, status, benchmark,
  provenance, archetype, page_type, device) carry typed data the engine consumes
  for filtering, prioritization, and grounding.

OUTPUT STYLE
- No prose around the JSON.
- No markdown code fences.
- No commentary.
- A single JSON object only.
- Strings escape correctly (use \n for newlines inside body).
- Numeric values use JSON number type, not strings.

CONSTITUTIONAL CONSTRAINTS (Neural Constitution R5.3 + GR-007)
NEVER include conversion-rate predictions in `body` or anywhere else:
- BANNED: "increase conversions by X%"
- BANNED: "lift CR by Y%"
- BANNED: "boost completion by Z%"
- BANNED: "improve checkout completion rate by N%"
- BANNED: "raise revenue by N%"
ALLOWED:
- Descriptive thresholds: "≤8 fields per Baymard 2024"
- Citations: "per Nielsen Norman Group 2023"
- Binary indicators: "guest checkout option present"
- Qualitative comparisons: "above the fold without scrolling"

BENCHMARK DERIVATION
The benchmark MUST be derivable from the `citation_text` excerpt provided
in the USER inputs. If the citation does not support a benchmark
(quantitative value OR qualitative standard), output exactly:
{"error": "benchmark_not_derivable"}
and stop. Do NOT invent benchmark values.

VERIFICATION PLACEHOLDERS
Set `provenance.verified_by` to "" (empty string).
Set `provenance.verified_date` to "" (empty string).
A human verifier fills these AFTER manually re-deriving the benchmark from
source_url. The lint CLI will reject the heuristic until both are non-empty
(this is intentional R15.3.2 enforcement).
```

---

## USER template (fill INPUTS, then send)

```
Draft a single CRO heuristic for the Neural knowledge base.

INPUTS:
- source: "<baymard | nielsen | cialdini>"
- source_url: "<verbatim URL — must validate as URL; for book chapters use a stable Wikipedia / publisher URL>"
- citation_text: "<verbatim excerpt from source_url, 100-300 words, supporting both the rule AND the benchmark>"
- archetype: <one or more of ["D2C", "SaaS", "B2B", "lead_gen", "marketplace", "media", "other"] — JSON array>
- page_types: <one or more of ["homepage", "pdp", "plp", "cart", "checkout", "pricing", "comparison", "landing", "other"] — JSON array>
- device: <one or more of ["mobile", "desktop", "tablet", "balanced"] — JSON array; use ["mobile", "desktop", "tablet", "balanced"] if the heuristic is device-agnostic>
- draft_model: "<your model id, e.g., claude-sonnet-4-20250514>"

REQUIRED OUTPUT FIELDS (HeuristicSchemaExtended; T101 — 11 top-level fields)

— HeuristicSchemaBase (3 fields) —
- id: string matching /^[A-Z][A-Z0-9_]*-[A-Z][A-Z0-9_]*-\d{3,}$/
       Pattern: "<PACK>-<CATEGORY>-<NNN>" with PACK + CATEGORY uppercase letters /
       digits / underscores, NNN ≥3 digits.
       Examples:
         "BAYMARD-CHECKOUT-001"   (pack=BAYMARD, cat=CHECKOUT)
         "NIELSEN-USABILITY-005"  (pack=NIELSEN, cat=USABILITY)
         "CIALDINI-SOCIALPROOF-001" (pack=CIALDINI, cat=SOCIALPROOF)
       For source="baymard" use PACK="BAYMARD"; "nielsen" → "NIELSEN"; "cialdini" → "CIALDINI".

- body: string (≥1 char) — the LLM-evaluable rule text. Compose as ONE
       well-structured prose block (3-6 sentences typical) covering ALL of:
         (a) what to inspect on the page (replaces §9.1 detection.lookFor),
         (b) positive signals indicating the heuristic IS satisfied (replaces detection.positiveSignals),
         (c) negative signals indicating violation (replaces detection.negativeSignals),
         (d) the corrective recommendation (replaces recommendation.summary + .details),
         (e) research backing (replaces recommendation.researchBacking — 1 sentence citing source).
       This single string is what gets injected into the Phase 7 EvaluateNode
       LLM user message (per Constitution R5.5 — heuristic body in user message,
       not system prompt). Quality of `body` directly determines quality of findings.

- category: string (≥1 char) — short snake_case category name. Examples:
       "checkout", "form_design", "trust_signals", "social_proof", "pricing",
       "navigation", "search", "cta_visibility", "error_recovery".
       Phase 6 T109 TierValidator maps category → Tier 1/2/3 reliability bucket.

— §9.10 extension fields (6 fields) —
- version: string matching /^\d+\.\d+\.\d+$/ — start at "1.0.0".

- rule_vs_guidance: "rule" | "guidance"
       "rule"     = violation is binary + structurally detectable (e.g., "guest
                    checkout option present?")
       "guidance" = interpretive + needs LLM CoT (e.g., "social proof feels
                    credible enough?")

- business_impact_weight: number ∈ [0, 1]
       Heuristic's prioritization weight. Phase 6 T107 prioritizeHeuristics
       sorts by this descending. Calibration:
         critical structural (e.g., guest checkout, broken forms)   → 0.85-0.95
         high content/persuasion (e.g., trust signals, value prop)  → 0.65-0.80
         medium UX (e.g., scannable copy, clear nav)                → 0.45-0.60
         low aesthetic / nice-to-have                               → 0.25-0.40

- effort_category: "quick_win" | "strategic" | "incremental" | "deprioritized"
       (T101 EFFORT_CATEGORIES enum — these are the same 4 quadrants Phase 9
        T167 IMPACT_MATRIX uses for the 4-quadrant ActionPlan)
       "quick_win"     = high impact, low effort (typical: copy / config tweak)
       "strategic"     = high impact, high effort (typical: full feature build)
       "incremental"   = low impact, low effort (polish; ship in batches)
       "deprioritized" = low impact, high effort (defer; document)

- preferred_states: string[] — state-pattern IDs needed to evaluate.
       Default: ["default"] — heuristic is evaluable on initial page load.
       Other patterns (Phase 13 master state-graph extension consumes;
       Phase 7 MVP treats non-"default" as no-op):
         ["authenticated"]      — requires logged-in state
         ["cart_nonempty"]      — requires items in cart
         ["modal_open"]         — requires a modal/dialog visible
         ["form_submitted"]     — requires post-submit confirmation state
         ["error_state"]        — requires an error condition active

- status: "draft" | "active" | "deprecated"
       "active" for production-ready; "draft" while in spot-check;
       "deprecated" for archived heuristics (post-v1.0).

— benchmark (R15.3 — discriminated union; pick ONE branch) —
- benchmark: { "kind": "quantitative", value, unit, metric }
                OR
              { "kind": "qualitative", standard_text }

  QUANTITATIVE branch (use for measurable structural violations):
    - kind: "quantitative"
    - value: number — the threshold value (e.g., 8 for "≤8 form fields")
    - unit: string (≥1 char) — units. Examples: "fields", "ms", "px", "ratio",
            "percent", "characters", "seconds", "items"
    - metric: string (≥1 char) — what is measured. snake_case. Examples:
            "form_field_count", "p95_load_time_ms", "min_touch_target_px",
            "wcag_contrast_ratio", "max_above_fold_text_chars"

  QUALITATIVE branch (use for content / persuasion / usability heuristics):
    - kind: "qualitative"
    - standard_text: string (≥1 char) — the qualitative reference. Examples:
            "WCAG 2.1 AA contrast ratio for body text"
            "Primary CTA visible above fold without scrolling"
            "Trust badges placed near payment form, not in footer"
            "Social proof element within 2 viewport-heights of primary CTA"

  PICKING THE BRANCH:
  - If `citation_text` provides a number (e.g., "44.5%", "≤8 fields", "3 seconds"),
    use the QUANTITATIVE branch.
  - If `citation_text` describes a qualitative standard (e.g., "above the fold",
    "credible trust signals", "clear hierarchy"), use the QUALITATIVE branch.

— provenance (R15.3.1 — 5 strict fields) —
- provenance:
    source_url: string — must validate as a URL (Zod's z.string().url()).
                For book references that don't have a direct URL, use a stable
                Wikipedia page or publisher product page that anchors the
                reference (e.g., for Cialdini's Influence:
                "https://en.wikipedia.org/wiki/Influence:_The_Psychology_of_Persuasion").
                The citation_text below carries the verbatim chapter excerpt.
    citation_text: string (≥1 char) — verbatim excerpt from source_url that
                JUSTIFIES BOTH the body AND the benchmark. 50-300 words typical.
                The verifier will Ctrl+F this exact text in source_url to confirm
                it's there.
    draft_model: "human" | LLM model id matching
                /^(claude|gpt|gemini|llama|mistral|qwen)-[\w.-]+$/i
                For LLM-drafted heuristics, use the input draft_model value
                (e.g., "claude-sonnet-4-20250514").
    verified_by: ""    (LEAVE EMPTY — human verifier fills with their name.
                       Lint will reject "" — intentional R15.3.2 enforcement.)
    verified_date: "" (LEAVE EMPTY — human verifier fills with ISO-8601 datetime
                       matching /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/
                       e.g., "2026-05-12T14:30:00Z")

— optional manifest selectors (3 fields; ALL optional but RECOMMENDED) —
These enable Phase 4b T4B-013 HeuristicLoader.loadForContext(profile) filtering.
Absent / empty array = "applies to all" per matchesSelector helper.

- archetype: array of T101 PRELIMINARY_BUSINESS_ARCHETYPES values
            (matches the input `archetype` array above)
- page_type: array of T101 PRELIMINARY_PAGE_TYPES values
            (matches the input `page_types` array above)
- device: array of T101 PRELIMINARY_DEVICES values
            (matches the input `device` array above)

CONSTRAINTS (rejection-causing if violated)
- Output a SINGLE JSON object, no wrapping array, no markdown fences, no prose.
- HeuristicSchemaBase + HeuristicSchemaExtended use Zod's .strict() — ANY
  EXTRA FIELD will be rejected at lint time. DO NOT include legacy §9.1 fields:
    name, source, severity_if_violated, reliability_tier, reliability_note,
    detection (any sub-field), recommendation (any sub-field),
    viewport_applicability.
  Their semantic content goes into `body` (LLM-readable prose) or is derived
  downstream.
- `body` is ONE STRING. Do NOT split into structured fields.
- Do not invent benchmark values — derive from citation_text only. If the
  citation does not support a benchmark, return {"error": "benchmark_not_derivable"}.
- Use only the T101 enum values listed above for archetype / page_type / device /
  effort_category / status / rule_vs_guidance. ANY OTHER VALUE will fail Zod parse.
- The id pattern requires ≥3-digit numeric suffix (`-001` not `-1`).
- The benchmark.kind discriminator picks ONE branch; do NOT include both
  quantitative + qualitative fields.
- provenance.verified_by + provenance.verified_date are STRINGS. Use "" for
  the LLM output — verifier fills before commit.
```

---

## Worked example — Baymard checkout heuristic

### Filled USER inputs

```
INPUTS:
- source: "baymard"
- source_url: "https://baymard.com/blog/checkout-form-field-study"
- citation_text: "24% of users have abandoned a Cart during checkout because the site wanted them to create an account. Forced account creation remains one of the leading causes of checkout abandonment, second only to high additional costs. Sites that offer a guest checkout option, prominently positioned alongside or above the account-creation flow, see materially lower abandonment rates. The guest checkout button should be visually equivalent to the create-account CTA, not de-emphasized as a secondary link."
- archetype: ["D2C", "marketplace"]
- page_types: ["checkout"]
- device: ["mobile", "desktop", "tablet", "balanced"]
- draft_model: "claude-sonnet-4-20250514"
```

### Expected LLM output

```json
{
  "id": "BAYMARD-CHECKOUT-001",
  "body": "On the checkout page, look for a guest checkout option that lets users complete their purchase without creating an account. Positive signals include explicit 'Continue as Guest' buttons or 'Skip Account Creation' links presented with equal or greater visual weight than the sign-in/register option. Negative signals include forced account creation flows that block checkout progression, or hidden guest options buried beneath multiple clicks or buried as small footer links. When the option is missing or de-emphasized, recommend adding a prominent guest checkout button at the top of the checkout flow, visually equivalent to the create-account CTA. Baymard Institute's 2024 Checkout Form Field Study found that 24% of users abandon checkout when forced to register an account before purchasing.",
  "category": "checkout",
  "version": "1.0.0",
  "rule_vs_guidance": "rule",
  "business_impact_weight": 0.9,
  "effort_category": "quick_win",
  "preferred_states": ["default"],
  "status": "active",
  "benchmark": {
    "kind": "qualitative",
    "standard_text": "Guest checkout option visible at start of checkout flow with equal-or-greater visual weight than account-creation CTA"
  },
  "provenance": {
    "source_url": "https://baymard.com/blog/checkout-form-field-study",
    "citation_text": "24% of users have abandoned a Cart during checkout because the site wanted them to create an account.",
    "draft_model": "claude-sonnet-4-20250514",
    "verified_by": "",
    "verified_date": ""
  },
  "archetype": ["D2C", "marketplace"],
  "page_type": ["checkout"],
  "device": ["mobile", "desktop", "tablet", "balanced"]
}
```

### Why this output is well-formed

- **id** matches `/^[A-Z][A-Z0-9_]*-[A-Z][A-Z0-9_]*-\d{3,}$/` → ✅
- **body** is ONE prose string covering all 5 conceptual sections (inspect / positive / negative / recommendation / research) → ✅
- **No legacy §9.1 fields** (no `name`, `source`, `severity_if_violated`, `reliability_tier`, `detection.*`, `recommendation.*`) → ✅ schema would otherwise reject under `.strict()`
- **No conversion predictions** — the body cites Baymard's "24% abandon" finding which is descriptive (a measurement of past behavior), NOT a future-conversion prediction → ✅ R5.3 / GR-007 compliant
- **benchmark.kind = "qualitative"** because the source describes a qualitative standard ("equal or greater visual weight"), not a measurable threshold → ✅
- **provenance.verified_by + verified_date = ""** — placeholders for human verifier per R15.3.2 → ✅
- **archetype + page_type + device all use T101 enum values** → ✅
- **effort_category = "quick_win"** — adding a button is low-effort, high-impact → ✅ maps directly to Phase 9 IMPACT_MATRIX top-left quadrant

### What this output WOULD fail lint on (at this stage — by design)

Once the LLM produces the JSON above, **the lint CLI (T0B-004) will REJECT it** because `provenance.verified_by` and `provenance.verified_date` are empty strings (Zod's `z.string().min(1)` for verified_by and the strict ISO-8601 regex for verified_date both fail on `""`). This is **intentional** — it forces the human verifier (R15.3.2) to physically open `source_url`, locate `citation_text`, re-derive the benchmark, then fill these two fields BEFORE the heuristic can be committed. The lint failure IS the verification gate.

---

## Re-draft loop (per [plan.md §3](../phases/phase-0b-heuristics/plan.md))

If the LLM output:
- **Returns `{"error": "benchmark_not_derivable"}`** — refine `citation_text` to include the specific value or standard, re-draft.
- **Includes banned phrasing** ("increase conversions by N%") — add a stricter SYSTEM rider explicitly listing the offending phrase, re-draft.
- **Hallucinates a benchmark value** that doesn't appear in `citation_text` — re-draft with USER rider: "Use ONLY the value [X] from the citation. Do not invent."
- **Hallucinates a `source_url`** (LLMs frequently fabricate Baymard URLs) — verifier MUST confirm the URL resolves AND the citation appears at that URL; reject if not verifiable.
- **Splits content into structured fields** instead of `body` prose — re-draft with explicit reminder: "The `body` field is ONE STRING. Do not split into separate JSON fields for detection or recommendation."

After **3 failed re-drafts on the same heuristic**, ESCALATE to engineering lead — likely a prompt protocol issue (per kill criteria in [plan.md §7](../phases/phase-0b-heuristics/plan.md)).

---

## Drafting cost + time

Per heuristic (target):
- Tokens (input): ~3K (prompt + citation_text)
- Tokens (output): ~600 (one JSON object)
- Cost: ~$0.02-$0.05 (Claude Sonnet 4 pricing)
- Wall-clock: ~5-10 seconds per draft
- Verification time (T0B-002): ~30 minutes per heuristic (open URL, locate citation, re-derive benchmark, fill verified_by + verified_date, lint, commit)

Total for 30-heuristic MVP pack:
- Drafting cost: ~$1.50 (well within $15 NF-01 target; kill criterion at $25)
- Drafting time: ~5 minutes (LLM calls)
- Verification time: ~15 hours (the actual bottleneck)

---

## Cross-references

- **Source-of-truth schema:** `packages/agent-core/src/analysis/heuristics/types.ts` — `HeuristicSchemaExtended` Zod schema. ANY change to the schema requires a coordinated update of this template + a v0.5+ Phase 0b plan.md §2 amendment.
- **Phase 0b spec.md v0.4:** `docs/specs/mvp/phases/phase-0b-heuristics/spec.md` — R-01 R-12 functional requirements; AC-01 AC-15 acceptance criteria.
- **Phase 0b plan.md v0.4 §2:** `docs/specs/mvp/phases/phase-0b-heuristics/plan.md` — this template's design source; bumps in lockstep with this template.
- **Verification protocol (T0B-002):** [phase-0b-heuristics/plan.md §3](../phases/phase-0b-heuristics/plan.md) — runs AFTER drafting; produces the verified_by + verified_date values.
- **Lint CLI (T0B-004):** to be authored at `apps/cli/src/commands/heuristic-lint.ts` — Zod parse + 5 additional checks; D1 BINDING (Zod-error redaction + `NEURAL_TEST_FIXTURE_BODY` sentinel test).
- **PR Contract Proof block (T0B-003):** `docs/specs/mvp/templates/heuristic-pr-proof.md` — required in every heuristic PR per PRD §10.9.
- **Repository README (T0B-005):** `heuristics-repo/README.md` — onboarding doc covering the full draft → verify → lint → PR workflow; D2 BINDING (forbid Slack/email/screenshot/support-ticket sharing of drafting LLM responses per R15.3.3).

---

*End of T0B-001 — Heuristic Drafting Prompt Template v1.0.0*

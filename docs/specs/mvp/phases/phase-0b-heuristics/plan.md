---
title: Phase 0b — Heuristic Authoring — Implementation Plan
artifact_type: plan
status: implemented
version: 0.8
created: 2026-04-28
updated: 2026-05-09
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-0b-heuristics/spec.md
  - docs/specs/mvp/tasks-v2.md (T103-T105 + Phase 0b section v2.3.3+)
  - docs/specs/final-architecture/09-heuristic-kb.md §9.1, §9.10
  - docs/specs/mvp/PRD.md F-012 v1.2 amendment 2026-04-26
  - docs/specs/mvp/phases/phase-6-heuristics/spec.md (HeuristicSchemaExtended contract)

req_ids:
  - REQ-HK-001
  - REQ-HK-EXT-001
  - REQ-HK-EXT-019
  - REQ-HK-BENCHMARK-001
  - REQ-CONTEXT-DOWNSTREAM-001

impact_analysis: docs/specs/mvp/phases/phase-0b-heuristics/impact.md
breaking: false
affected_contracts:
  - heuristics-repo/*.json content (NEW deliverables)
  - HeuristicSchemaExtended (CONSUMER only)

delta:
  new:
    - Phase 0b plan — drafting prompt structure, verification protocol, kill criteria
  changed:
    - v0.1 → v0.2 applied 1 analyze-driven fix (L3: §10 risk register cross-reference note added explaining overlap with impact.md §9)
    - v0.2 → v0.3 — status bumped draft → approved (R17.4 review approved per phase-0b-heuristics/review-notes.md)
    - v0.3 → v0.4 — R11.4 spec-defect patch (2026-05-06) coordinated with spec.md v0.4. §2 (Drafting Prompt Structure) REQUIRED OUTPUT FIELDS list rewritten from §9.1 rich structured shape (~25 fields) to T101 body-string design (11 top-level fields). T101 (`packages/agent-core/src/analysis/heuristics/types.ts`, landed Day 1 of week 1) is the implementation source-of-truth that supersedes §9.1's structured `detection.*` + `recommendation.*` + `name` + `severity_if_violated` + `reliability_tier` fields. The single `body` string field absorbs §9.1's six prose fields (`detection.lookFor`, `detection.positiveSignals`, `detection.negativeSignals`, `recommendation.summary`, `recommendation.details`, `recommendation.researchBacking`) into one well-structured natural-language container — modern LLMs prefer prose over JSON-fragmented prompt instructions. INPUTS contract clarified: `archetype` accepts an array (T101 enum: D2C/SaaS/B2B/lead_gen/marketplace/media/other), `page_types` accepts an array (T101 enum: homepage/pdp/plp/cart/checkout/pricing/comparison/landing/other), `device` accepts an array (T101 enum: mobile/desktop/tablet/balanced — NOT `mobile`/`desktop`/`both` as v0.3 wrongly stated). Drafting model temperature stays 0.3 per §Assumptions META exemption.
    - v0.4 → v0.5 — R11.4 PATH A continuation (2026-05-06) coordinated with spec.md v0.5. §5 pseudo-spec banned-phrase regex check target field changed from `parsed.data.recommendation.summary + parsed.data.recommendation.details` (legacy §9.1 references missed in v0.4 sweep) to `parsed.data.body` (T101 body-string design). Derivative of v0.4 supersession — no new design intent. Coordinated with spec.md v0.5 patches to AC-04 + AC-15 + R-04.
    - v0.5 → v0.6 — Gate 1 REVISE-loop patch (2026-05-09) coordinated with spec.md v0.6 (act-003 component of 5-act sweep). Two stale `recommendation.summary` + `recommendation.details` references replaced with `body` (T101 body-string design — completes the v0.5 R11.4 sweep): §3 step 4 verification protocol bullet ("Banned-phrase check: Read body...") + §5 conformance test fail-case bullet ("Fail case: banned phrase in body..."). All other plan content unchanged — no §1 sequencing changes, no §2 prompt structure changes, no §6 R6/R15.3.3 isolation changes, no §7 kill criteria changes, no §9 effort-estimate changes. Derivative R11.4 PATH A continuation — not new design intent.
    - v0.6 → v0.7 — Tiered Verification Methodology sync (2026-05-09; coordinated with spec.md v0.7 §Verification Methodology + new `neural-heuristic-reviewer` skill + master orchestrator content-phase state-machine extension). §3 Verification Protocol (Tier 2 strict re-derivation per R15.3.2) reframed as Tier 2 of a two-tier methodology — Tier 1 AI-mediated review (~3 min/heuristic) prepends per-heuristic before commit gate; Tier 2 (existing 8-step protocol) preserved as-is for AC-12 spot-check sample (5×3=15 of 30). §9 effort estimate redistribution: total verifier humanwork stays at ~7-7.5 hr but split as ~1.5 hr Tier 1 (30 × ~3 min lightweight stamps) + ~6.25 hr Tier 2 (15 × ~25 min strict re-derivation at +10/+20/+30 spot-checks). No §1 sequencing changes; no §2/§4/§5 changes; §6 R6/R15.3.3 isolation extended to also cover `neural-heuristic-reviewer` output (`ai_review` block stays in `.heuristic-drafts/<id>.review.json` gitignored + commits to `heuristics-repo/` as the optional `ai_review` schema field per T101 v0.7 amendment); §7 kill criteria extended: REJECT_REDRAFT 3-strike + FLAG_FOR_HUMAN >20% per pack triggers per content-phase-state-machine.md.
  impacted:
    - T0B-001 drafting prompt template (this commit) — produces T101-shaped JSON
    - T0B-004 lint CLI (Day 2 future) — Zod parse against T101's `HeuristicSchemaExtended` exported from `packages/agent-core/src/analysis/heuristics/types.ts`
    - T103/T104/T105 heuristic content (week 4) — authored against corrected drafting prompt; bodies use prose composition
    - Spec.md v0.3 → v0.4 — coordinated supersession callout in §Mandatory References
  unchanged:
    - §1 Sequencing (Week 1-4 task ordering)
    - §3 Verification Protocol
    - §4 PR Contract Proof Block
    - §5 Pseudo-spec lint CLI design (T0B-004)
    - §6 R6/R15.3.3 Isolation Strategy
    - §7 Kill Criteria
    - §8 Rollout / Acceptance gating
    - §9 Effort estimate
    - §10 Risks

governing_rules:
  - Constitution R6 (IP)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R15.3, R15.3.1, R15.3.2, R15.3.3
  - Constitution R20 (Impact Analysis)
  - Constitution R23 (Kill Criteria)
---

# Phase 0b Implementation Plan

> **Summary (~120 tokens):** Author 30 heuristics over ~4 calendar weeks (≈24 engineering hours total + ≈8 verifier hours), gated on Phase 6 T101 (HeuristicSchemaExtended) landing first. Infrastructure (T0B-001..T0B-005) lands in Week 1 — drafting prompt, verification protocol, PR Contract Proof block, `pnpm heuristic:lint`, repo README. Content (T103/T104/T105) lands Week 2-4: ≈15 Baymard → ≈10 Nielsen → ≈5 Cialdini, in that order (Baymard exercises the workflow first; smaller packs follow). Spot-checks at +10/+20/+30 marks. Kill criteria: drafting cost spike (>$25), per-heuristic time spike (>90 min p50 after smoothing), divergence rate >20% in any spot-check, or schema validation failure rate >0% on first lint after verification.

---

## 1. Sequencing

```
Week 1 (T0B-001..T0B-005 infrastructure — engineering hours ~6h):
  Day 1: T0B-001 drafting prompt template
  Day 1: T0B-002 verification protocol document
  Day 2: T0B-003 PR Contract Proof block extension
  Day 2-3: T0B-004 pnpm heuristic:lint CLI helper (+ conformance test for AC-04 + AC-13)
  Day 3-4: T0B-005 heuristics-repo/README.md + .gitignore .heuristic-drafts/

Week 2 (T103 Baymard pack — engineering hours ~10h, verifier hours ~3h):
  Day 5-6: Draft + verify 5 Baymard heuristics (homepage + PDP)
  Day 7: First spot-check (5 heuristics by different verifier) — STOP if >1 diverges
  Day 8-9: Draft + verify 5 more Baymard (checkout)
  Day 10: Draft + verify 5 more Baymard (cart + mobile + final)

Week 3 (T104 Nielsen pack — engineering hours ~6h, verifier hours ~2h):
  Day 11-12: Draft + verify 5 Nielsen heuristics (visibility/feedback + error prevention)
  Day 13: Second spot-check (5 random from full set so far) — STOP if >1 diverges
  Day 14-15: Draft + verify 5 more Nielsen (consistency + recovery + final)

Week 4 (T105 Cialdini pack — engineering hours ~3h, verifier hours ~1h):
  Day 16-17: Draft + verify 5 Cialdini heuristics (one each: social proof, scarcity, authority, reciprocity, liking)
  Day 18: Third + final spot-check (5 random across all 30) — STOP if >1 diverges
  Day 19-20: Buffer for re-drafts + Phase 6 T112 cross-phase acceptance run
```

Dependencies (from tasks-v2.md):
- T0B-001..T0B-005 ← Phase 0 setup (T001-T005) only — can land before any other phase
- T103-T105 ← T0B-001..T0B-005 + T101 (Phase 6 HeuristicSchemaExtended) + T4B-013 contract surface (Phase 4b spec land — implementation NOT required at draft time)
- T103 → T104 → T105 (sequential to smooth drafting prompt)
- Phase 6 T112 ← T103 + T104 + T105 (cross-phase acceptance gate)

---

## 2. Drafting Prompt Structure (T0B-001)

> **★ v0.4 supersession (2026-05-06):** This §2 was rewritten to match T101's body-string design (`packages/agent-core/src/analysis/heuristics/types.ts`, landed Day 1 of week 1). The previous v0.3 §2 referenced §9.1's rich structured shape (~25 fields with `name`, `severity_if_violated`, `reliability_tier`, `detection.*`, `recommendation.*`) which is now SUPERSEDED. T101 collapses the six structured prose fields into a single `body` string — better for LLM consumption (modern LLMs prefer prose over JSON-fragmented prompt instructions). All Phase 0b authoring infra (T0B-001..T0B-005) and content (T103/T104/T105) MUST conform to T101. See spec.md v0.4 §Mandatory References #5 for source-of-truth pointer.

The drafting prompt template (`docs/specs/mvp/templates/heuristic-drafting-prompt.md`) is a structured Markdown block fed to Claude Sonnet 4 via direct Anthropic SDK call (NOT via LangSmith — R15.3.3 isolation). Structure:

```
SYSTEM: You are a CRO heuristic drafter. Output a single JSON object that conforms
EXACTLY to the HeuristicSchemaExtended Zod schema exported from
packages/agent-core/src/analysis/heuristics/types.ts (T101). No prose around the JSON,
no markdown fences. The benchmark MUST be derivable from the cited research excerpt;
if not, output {"error": "benchmark_not_derivable"} and stop. NEVER include
conversion-rate predictions ("increase conversions by X%", "lift CR by Y%",
"boost completion by Z%"). Allowed: descriptive thresholds ("≤8 fields per
Baymard 2024"), citations, and binary indicators.

The `body` field is a SINGLE natural-language container that conveys what the LLM
evaluator needs to identify the violation AND what the recommendation should be.
Compose it as well-structured prose. Do NOT split into separate JSON fields for
detection logic / signals / recommendation summary / recommendation details — those
are all absorbed into `body`.

USER (template):
Draft a single heuristic for the {source} knowledge base.

INPUTS:
- source: "baymard" | "nielsen" | "cialdini"   (informational; populates `id` prefix + `provenance.source_url`)
- source_url: "{verbatim URL or stable text reference, e.g., book chapter}"
- citation_text: "{verbatim excerpt — 100-300 words}"
- archetype: ["D2C" | "SaaS" | "B2B" | "lead_gen" | "marketplace" | "media" | "other"]   (array — T101 PRELIMINARY_BUSINESS_ARCHETYPES; Phase 4b T4B-001 ratifies canonical)
- page_types: ["homepage" | "pdp" | "plp" | "cart" | "checkout" | "pricing" | "comparison" | "landing" | "other"]   (array — T101 PRELIMINARY_PAGE_TYPES)
- device: ["mobile" | "desktop" | "tablet" | "balanced"]   (array — T101 PRELIMINARY_DEVICES; "balanced" replaces v0.3's "both")
- draft_model: "{LLM model id, e.g., claude-sonnet-4-20250514}"   (placeholder for provenance.draft_model)

REQUIRED OUTPUT FIELDS (HeuristicSchemaExtended; T101 — 11 top-level fields):

# --- HeuristicSchemaBase (3 fields, .strict()) ---
- id: string matching regex /^[A-Z][A-Z0-9_]*-[A-Z][A-Z0-9_]*-\d{3,}$/
       (e.g., "BAYMARD-CHECKOUT-001", "NIELSEN-USABILITY-005", "CIALDINI-SOCIALPROOF-001"
        — pack uppercase letters + digits + underscores; numeric suffix ≥3 digits)
- body: string (min 1 char) — the LLM-evaluable rule text. Compose as one
       well-structured prose block (3-6 sentences typical) covering:
         (a) what to inspect on the page,
         (b) positive signals indicating the heuristic IS satisfied,
         (c) negative signals indicating violation,
         (d) the corrective recommendation,
         (e) the research backing (1 sentence citing source).
       This single string replaces §9.1's six fields (detection.lookFor +
       detection.positiveSignals + detection.negativeSignals +
       recommendation.summary + recommendation.details + recommendation.researchBacking).
- category: string (min 1) — short snake_case category name
       (e.g., "checkout", "form_design", "trust_signals", "social_proof").
       Phase 6 T109 TierValidator maps category → Tier 1/2/3 reliability bucket.

# --- HeuristicSchemaExtended §9.10 fields (6 fields) ---
- version: string matching /^\d+\.\d+\.\d+$/ — start at "1.0.0"
- rule_vs_guidance: "rule" | "guidance"
       — "rule" if violation is binary + structurally detectable
         (e.g., "guest checkout option present?")
       — "guidance" if interpretive + needs LLM CoT
         (e.g., "social proof feels credible enough?")
- business_impact_weight: number ∈ [0, 1]
       — heuristic's weight when prioritizing findings; Phase 6 T107
         prioritizeHeuristics sorts by this descending. Calibrate roughly:
         critical structural = 0.9, high content = 0.7, medium persuasion = 0.5,
         low aesthetic = 0.3.
- effort_category: "quick_win" | "strategic" | "incremental" | "deprioritized"
       (T101 EFFORT_CATEGORIES enum — NOT v0.3's content/design/engineering;
        these map to Phase 9 T167 IMPACT_MATRIX 4 quadrants directly)
- preferred_states: string[]
       — state-pattern IDs needed to evaluate this heuristic; default ["default"]
         for heuristics evaluable on initial page load. Use ["authenticated"],
         ["cart_nonempty"], ["modal_open"], etc. for state-conditional heuristics.
         Phase 13 master state-graph extension consumes; Phase 7 MVP treats
         non-"default" states as no-op.
- status: "draft" | "active" | "deprecated"
       — set "active" for production-ready heuristics; "draft" while in
         spot-check; "deprecated" replaces archived heuristics post-v1.0.

# --- benchmark (R15.3 — discriminated union; pick ONE branch) ---
- benchmark: discriminatedUnion('kind', [Quantitative, Qualitative])
  # Quantitative branch (.strict()) — for measurable structural violations:
    - kind: "quantitative"
    - value: number — the threshold value (e.g., 8 for "≤8 form fields")
    - unit: string (min 1) — units (e.g., "fields", "ms", "px", "ratio", "percent")
    - metric: string (min 1) — what is measured (e.g., "form_field_count",
              "p95_load_time_ms", "min_touch_target_px", "wcag_contrast_ratio")
  # Qualitative branch (.strict()) — for content/persuasion/usability heuristics:
    - kind: "qualitative"
    - standard_text: string (min 1) — the qualitative reference
              (e.g., "WCAG 2.1 AA contrast ratio for body text",
                     "Primary CTA visible above fold without scrolling",
                     "Trust badges placed near payment form, not in footer")

# --- provenance (R15.3.1 — 5 fields, .strict()) ---
- provenance:
    source_url: z.string().url() — full URL OR stable text reference
              (Cialdini chapter references format:
               "https://example.com/cialdini-chapter-5-liking" — use a stable
               wayback OR documentation page; pure book references like
               "Cialdini Chapter 5" do NOT validate as URL — wrap in
               https://en.wikipedia.org/wiki/<wiki-page> or similar stable URL)
    citation_text: string (min 1) — the verbatim excerpt from source_url
              that justifies the body + benchmark
    draft_model: "human" | LLM model id matching
              /^(claude|gpt|gemini|llama|mistral|qwen)-[\w.-]+$/i
              (e.g., "claude-sonnet-4-20250514")
    verified_by: ""    (LEAVE EMPTY — human verifier fills per R15.3.2)
    verified_date: "" (LEAVE EMPTY — human verifier fills with ISO-8601 datetime
              matching /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/
              e.g., "2026-05-12T14:30:00Z")

# --- Optional manifest selectors (3 fields; ALL optional but RECOMMENDED) ---
# These enable Phase 4b T4B-013 HeuristicLoader.loadForContext(profile) filtering.
# Absent / empty = "applies to all" per matchesSelector helper.
- archetype: array of T101 PRELIMINARY_BUSINESS_ARCHETYPES values
              (matches input archetype above)
- page_type: array of T101 PRELIMINARY_PAGE_TYPES values
              (matches input page_types above)
- device: array of T101 PRELIMINARY_DEVICES values
              (matches input device above)

CONSTRAINTS:
- Output a single JSON object, no wrapping array, no markdown fences.
- The two schemas (HeuristicSchemaBase, HeuristicSchemaExtended) use Zod's .strict() —
  ANY EXTRA FIELD will be rejected at lint time. DO NOT include legacy §9.1 fields:
    name, source, severity_if_violated, reliability_tier, reliability_note,
    detection (any sub-field), recommendation (any sub-field),
    viewport_applicability.
  Their semantic content goes into `body` (LLM-readable prose) or is derived
  from `category` downstream (TierValidator) or `business_impact_weight` (priority).
- `body` is ONE STRING. Do NOT split into structured fields.
- Strings escape correctly (use \\n for newlines inside strings).
- Numeric values use JSON number type, not strings.
- Do not invent benchmark values — derive from citation_text only.
- Use only the T101 enum values listed above for archetype / page_type / device /
  effort_category / status / rule_vs_guidance. ANY OTHER VALUE will fail Zod parse.
- The id pattern requires ≥3-digit numeric suffix (`-001` not `-1`).
- The benchmark.kind discriminator picks ONE branch; do NOT include both
  quantitative + qualitative fields.
- provenance.verified_by + provenance.verified_date are STRINGS (use "" placeholder
  for the LLM output — verifier fills before commit).
- HeuristicSchemaExtended will REJECT a heuristic where verified_by is "" at lint
  time (Zod .min(1)) — this is intentional: forces human verifier sign-off before
  commit per R15.3.2.

WORKED EXAMPLE — Baymard checkout heuristic (LLM output target):

{
  "id": "BAYMARD-CHECKOUT-001",
  "body": "On the checkout page, look for a guest checkout option that lets users complete their purchase without creating an account. Positive signals include explicit 'Continue as Guest' buttons or 'Skip Account Creation' links presented with equal or greater visual weight than the sign-in/register option. Negative signals include forced account creation flows that block checkout progression, or hidden guest options buried beneath multiple clicks. When the option is missing or de-emphasized, recommend adding a prominent guest checkout button at the top of the checkout flow, visually equivalent to the create-account CTA. Baymard Institute's 2024 Checkout Form Field Study found that 24% of users abandon checkout when forced to register an account before purchasing.",
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
  "device": ["desktop", "mobile", "tablet", "balanced"]
}
```

Notes:
- Drafting model: `claude-sonnet-4-*` (current latest as of drafting date).
- Drafting temperature: 0.3 (slight creativity for varied phrasing; verification re-derives the benchmark deterministically so creativity here doesn't break R10).
- One heuristic per call. No batching (keeps cost attribution clean per heuristic).
- Drafting subprocess uses `Anthropic` SDK directly (not via agent-core's LLMAdapter — that adapter wires LangSmith which violates R15.3.3 for drafting).
- All drafting transcripts (input prompt + raw output) saved to `.heuristic-drafts/<heuristic-id>.json` (gitignored).
- The `verified_by: ""` + `verified_date: ""` placeholders intentionally fail T0B-004 lint until human verifier replaces them per R15.3.2 — this is the enforcement seam between drafting and committing.

---

## 3. Verification Protocol (T0B-002)

> **★ v0.7 — Tiered Methodology:** Per spec.md v0.7 §Verification Methodology, this protocol is **Tier 2** (strict R15.3.2 manual re-derivation) and applies at the AC-12 spot-check sample (5 random × 3 rounds = 15-of-30; ~25 min/heuristic). **Tier 1** (AI-mediated review via `neural-heuristic-reviewer` skill — ~3 min/heuristic for all 30) runs as Stage 2b of the master orchestrator content-phase pipeline before this protocol fires at spot-check time. The 8 steps below are unchanged; only the *who* changes: in v0.7 every heuristic gets Tier 1 (30 of 30 lightweight); 50% (15 of 30) additionally get Tier 2 (this protocol — strict).

Per R15.3.2, every LLM-drafted heuristic requires a human verifier before commit. Protocol (`docs/specs/mvp/templates/heuristic-verification-protocol.md`):

1. **Open `source_url`** in a fresh browser tab. Confirm the URL resolves (200 OK). If 404, find a stable archive (Wayback Machine, Baymard archive); update `source_url` and `provenance` accordingly.
2. **Locate `citation_text`** in the source page. Use Ctrl+F to find the verbatim excerpt. If the excerpt cannot be located, REJECT — re-draft.
3. **Re-derive the benchmark from the source:**
   - **Quantitative:** Read the source's stated value (e.g., "44.5% abandon when forced to register"). Confirm the heuristic's `benchmark.value` is within ±20% of the source value. If outside, REJECT — re-draft.
   - **Qualitative:** Confirm the heuristic's `benchmark.standard_text` paraphrases (or quotes) the source's normative statement. If the heuristic's standard contradicts or extrapolates beyond the source, REJECT — re-draft.
4. **Banned-phrase check:** Read **`body`** (T101 body-string design — v0.5 R11.4 patch supersedes legacy §9.1 `recommendation.summary` + `recommendation.details` references). Confirm NO conversion-rate predictions. If any banned phrase, REJECT — re-draft with stricter prompt rider.
5. **Manifest selector check:** Confirm `archetype` + `page_type` + `device` match the heuristic's actual applicability. If LLM selected `device: "both"` but the source explicitly addresses mobile only, fix to `device: "mobile"`.
6. **Fill `verified_by`** (verifier's name) + **`verified_date`** (today's ISO date).
7. **Run `pnpm heuristic:lint <file>`** — must pass.
8. **Commit** — PR Contract Proof block (T0B-003) cites `verified_by`, `verified_date`, link to `source_url`, and a 1-2 sentence re-derivation note ("Source states 44.5%; draft says ≥44%; within ±20% tolerance.").

**Re-draft loop:** If a heuristic is REJECTED, the engineer re-runs the drafting prompt with a stricter rider (e.g., "Use the value 44.5% verbatim from the source"); the new draft gets a new `.heuristic-drafts/` transcript; verification repeats. After 3 failed re-drafts on the same heuristic, ESCALATE to engineering lead — likely a prompt protocol issue.

---

## 4. PR Contract Proof Block Extension (T0B-003)

PRD §10.9 PR Contract template gains a per-heuristic Proof block. Template (`docs/specs/mvp/templates/heuristic-pr-proof.md`):

```markdown
## Proof — Heuristic Verification (R15.3.2)

For each heuristic in this PR:

### {HEURISTIC_ID}
- **File:** `heuristics-repo/{source}/{HEURISTIC_ID}.json`
- **Drafted by:** `{draft_model}` on `{draft_date}`
- **Verified by:** `{verifier_name}` on `{verified_date}`
- **Source URL:** `{source_url}` (status: 200 OK / archived at {wayback_url})
- **Re-derivation note:** `{1-2 sentences confirming match within tolerance}`
- **Lint:** `pnpm heuristic:lint heuristics-repo/{source}/{HEURISTIC_ID}.json` ✅
- **Banned-phrase check:** ✅ no conversion-rate predictions
- **Manifest selectors:** archetype=`{archetype}`, page_type=`{page_type}`, device=`{device}` ✅
```

PR reviewers spot-check by clicking through 1-2 `source_url` links per PR.

---

## 5. `pnpm heuristic:lint` CLI Design (T0B-004)

Location: `apps/cli/src/commands/heuristic-lint.ts`

```typescript
// Pseudo-spec (implementation arrives at T0B-004):
import { HeuristicSchemaExtended } from '@neural/agent-core/analysis/heuristics/schema';
import { glob } from 'glob';
import { readFileSync } from 'fs';

const BANNED_PHRASE_REGEX =
  /(increase|lift|boost|raise|grow|improve)\s+(conversion|conversions|CR|cr)\s+by\s+\d+%/i;

const REQUIRED_PROVENANCE_FIELDS = [
  'source_url', 'citation_text', 'draft_model', 'verified_by', 'verified_date'
];
const REQUIRED_MANIFEST_SELECTORS = ['archetype', 'page_type', 'device'];

export async function heuristicLint(globPattern: string): Promise<number> {
  const files = await glob(globPattern);
  let failures = 0;
  for (const file of files) {
    const json = JSON.parse(readFileSync(file, 'utf-8'));
    // 1) Zod parse against HeuristicSchemaExtended
    const parsed = HeuristicSchemaExtended.safeParse(json);
    if (!parsed.success) { logError(file, parsed.error); failures++; continue; }
    // 2) Provenance non-empty
    for (const f of REQUIRED_PROVENANCE_FIELDS) {
      if (!parsed.data.provenance?.[f]) { logError(file, `missing provenance.${f}`); failures++; }
    }
    // 3) Manifest selectors present
    for (const f of REQUIRED_MANIFEST_SELECTORS) {
      if (!parsed.data[f]) { logError(file, `missing manifest selector ${f}`); failures++; }
    }
    // 4) Banned-phrase regex check (v0.5 patch — T101 body-string design;
    //    was `recommendation.summary + .details` in v0.4 referencing legacy §9.1)
    if (BANNED_PHRASE_REGEX.test(parsed.data.body)) {
      logError(file, `banned conversion-rate-prediction phrase detected`);
      failures++;
    }
  }
  return failures;  // exit code
}
```

CLI invocation:
```bash
pnpm heuristic:lint heuristics-repo/baymard/BAY-CHECKOUT-001.json
pnpm heuristic:lint 'heuristics-repo/**/*.json'
pnpm heuristic:lint --strict heuristics-repo/baymard/  # also fail on warnings
```

Conformance test (`apps/cli/tests/conformance/heuristic-lint.test.ts`) covers AC-04 + AC-13:
- Pass case: a synthetic valid heuristic JSON
- Fail case: missing `provenance.source_url` → exit non-zero
- Fail case: benchmark missing → exit non-zero
- Fail case: banned phrase in `body` (T101 body-string — v0.5 R11.4 patch) → exit non-zero
- Fail case: missing `archetype` → exit non-zero
- AC-13 isolation: assert `.gitignore` contains `.heuristic-drafts/`; assert no LangSmith client instantiated by drafting subprocess (via env-var inspection)

---

## 6. R6 / R15.3.3 Isolation Strategy

Drafting LLM responses are NOT to touch LangSmith / Pino / dashboard. Implementation:

1. **Drafting subprocess:** A separate Node.js script (e.g., `scripts/draft-heuristic.ts`) imports `@anthropic-ai/sdk` directly. Does NOT import `@neural/agent-core` (which wires LangSmith).
2. **No LangSmith env var:** Drafting subprocess runs with `LANGCHAIN_TRACING_V2=false` + `LANGSMITH_API_KEY=""` explicitly unset.
3. **No Pino logger:** Drafting subprocess uses a local file-based logger (writes to `.heuristic-drafts/<heuristic-id>.log`). No correlation IDs that would tie back to audit_run_id (no audit yet — drafting is a META workflow, not PRODUCT).
4. **`.gitignore` includes `.heuristic-drafts/`** — drafting transcripts NEVER committed.
5. **Cost log:** `.heuristic-drafts/_cost-log.json` records {heuristic_id, input_tokens, output_tokens, cost_usd} per draft. Used for NF-01 measurement; gitignored.
6. **Conformance test (AC-13):** asserts `.gitignore` contains `.heuristic-drafts/`; asserts the drafting subprocess imports do NOT reference `langsmith` / `@langsmith/*`.

---

## 7. Kill Criteria (R23)

Phase 0b PAUSES (reverts to engineering lead review) if any of these triggers fire:

| Category | Trigger | Action |
|---|---|---|
| **Resource — cost** | Cumulative drafting cost > $25 (vs $15 NF-01 target — 67% over budget) | STOP. Audit drafting prompt for token bloat. Engineering lead review before resume. |
| **Resource — time** | Per-heuristic draft + verify p50 > 90 min after smoothing first 5 (vs 45 min NF-02 target) | STOP. Workflow protocol review. Likely the verification protocol is too rigid — adjust. |
| **Resource — iterations** | Same heuristic re-drafted 3+ times without successful verification | STOP. Likely a source-citation problem or systematic prompt drift. Engineering lead reviews `.heuristic-drafts/<id>.log` series. |
| **Quality — divergence** | Spot-check divergence rate > 20% (>1 of 5 in any spot-check round) | STOP. Reject the entire batch since last good spot-check. Workflow protocol review. |
| **Quality — schema** | `pnpm heuristic:lint` failure rate > 0% on a heuristic AFTER human verification (verifier marked verified, but linter rejects) | STOP. Verifier protocol failure — re-train verifier; re-verify all of that verifier's heuristics. |
| **Scope** | Engineer tempted to skip verification because "this one is obviously right" | STOP. R15.3.2 is non-negotiable. ESCALATE to engineering lead. |
| **R6 boundary** | Drafting LLM response written to LangSmith / Pino / dashboard | STOP. Constitutional violation. Audit subprocess wiring; reject all heuristics drafted in that session. |

When kill criteria trigger, the engineering lead (a) snapshots state (`.heuristic-drafts/` + WIP heuristics-repo branch), (b) logs the trigger reason in the Phase 0b README, (c) decides resume strategy (protocol patch / prompt patch / verifier change), (d) does NOT silently bypass the trigger.

---

## 8. Rollout / Acceptance gating

Phase 0b is "shipped" when:

1. T0B-001..T0B-005 all merged (infrastructure complete)
2. T103, T104, T105 all merged (30 heuristic JSON files present)
3. `pnpm heuristic:lint heuristics-repo/**/*.json` exit code 0 on full pack (AC-04 / AC-09 / AC-10 / AC-11 / AC-15)
4. F-012 spot-check (AC-12) passes — final round at +30 mark; ≤1 of 5 divergent
5. `heuristics-repo/_spot-checks.md` log committed with 3 spot-check rounds documented
6. R6 / R15.3.3 isolation conformance test (AC-13) passes
7. Phase 6 T112 integration test (cross-phase, AC-14) passes against the full pack

After all 7 conditions, Phase 0b status: `draft → validated → approved → implemented → verified`.

---

## 9. Effort estimate

| Task | Engineering hours | Verifier hours |
|---|---|---|
| T0B-001 drafting prompt template | 1.5 | 0 |
| T0B-002 verification protocol | 1 | 0 |
| T0B-003 PR Contract Proof block extension | 0.5 | 0 |
| T0B-004 `pnpm heuristic:lint` CLI + tests | 2.5 | 0 |
| T0B-005 heuristics-repo/README.md | 0.5 | 0 |
| T103 ~15 Baymard heuristics (~45 min × 15) | ~10 | ~3 |
| T104 ~10 Nielsen heuristics (~36 min × 10) | ~6 | ~2 |
| T105 ~5 Cialdini heuristics (~36 min × 5) | ~3 | ~1 |
| Buffer / re-drafts / spot-check follow-up | ~1 | ~1 |
| **Total** | **~26h** | **~7h** (v0.7 redistribution: ~1.5 hr Tier 1 lightweight stamps × 30 heuristics + ~6.25 hr Tier 2 strict R15.3.2 spot-checks × 15-of-30 sample — total preserved within ±10%) |

Calendar duration: ~4 weeks alongside Phase 1-3 implementation (NOT critical-path during MVP weeks 1-4).

---

## 10. Risks (specific to Phase 0b execution; broader risks in spec.md SC + impact.md §9)

> **Note on overlap with [impact.md §9](impact.md):** ~9 of these entries also appear in impact.md §9 risk register. The split is intentional but soft — plan.md §10 captures EXECUTION-time risks (engineer-facing during authoring sessions; mitigations are workflow-level), while impact.md §9 captures cross-cutting / contract-shape risks (reviewer-facing during R20 sign-off; mitigations are architectural). Many risks have both an execution response AND a cross-cutting impact, so they appear in both. When updating either, propagate to the other if applicable.

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM drafts hallucinated source URLs (Baymard URLs especially) | High | Medium | Verification protocol step 1 (open URL, confirm 200) catches; archive to Wayback if URL is unstable |
| LLM drafts banned conversion-rate phrasing despite system prompt | Medium | Low | T0B-004 deterministic regex check rejects; engineer adds prompt rider |
| Verifier rubber-stamps without re-deriving benchmark | Medium | High (R15.3.2 violation) | Spot-check protocol catches systemically; PR Contract Proof block requires re-derivation note (not just a checkbox) |
| Cialdini citations are book chapters not URLs (no liveness check) | Low | Medium | Verification protocol allows stable text reference; verifier confirms book + chapter access |
| Solo engineer has no spot-checker | Medium (small team) | High | Engineering lead serves as spot-checker for all 3 packs |
| F-012 v1.2 amendment count drift back to 100 mid-session | Low | Low | tasks-v2.md v2.3.3 patch locks 15/10/5; PRD F-012 amendment is canonical |
| Phase 6 T101 schema lands AFTER drafting begins, causing rework | Medium | Medium | Schedule T0B-001..T0B-005 to wait for T101 OR draft against the spec'd schema and rework if T101 amends |
| Drafting cost runs to >$25 | Low | Medium | Kill criteria trigger; cumulative cost tracked in `.heuristic-drafts/_cost-log.json` |

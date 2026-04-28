---
title: Phase 0b — Heuristic Authoring — Implementation Plan
artifact_type: plan
status: draft
version: 0.1
created: 2026-04-28
updated: 2026-04-28
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
  changed: []
  impacted: []
  unchanged: []

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

The drafting prompt template (`docs/specs/mvp/templates/heuristic-drafting-prompt.md`) is a structured Markdown block fed to Claude Sonnet 4 via direct Anthropic SDK call (NOT via LangSmith — R15.3.3 isolation). Structure:

```
SYSTEM: You are a CRO heuristic drafter. Output a single JSON object conforming
exactly to the schema described below. No prose, no markdown fences. The benchmark
MUST be derivable from the cited research excerpt; if not, output {"error": "benchmark_not_derivable"}
and stop. NEVER include conversion-rate predictions ("increase conversions by X%",
"lift CR by Y%", "boost completion by Z%"). Allowed: descriptive thresholds
("≤8 fields per Baymard 2024"), citations, and binary indicators.

USER (template):
Draft a single heuristic for the {source} knowledge base.

INPUTS:
- source: "baymard" | "nielsen" | "cialdini"
- source_url: "{verbatim URL or chapter reference}"
- citation_text: "{verbatim excerpt — 100-300 words}"
- archetype: "{ecommerce | saas | leadgen | marketplace | media | fintech | healthcare | education}"
- page_types: [{one or more from PageTypeEnum}]
- device: "desktop" | "mobile" | "both"

REQUIRED OUTPUT FIELDS (HeuristicSchemaExtended):
- id: pattern {SOURCE_PREFIX}-{CATEGORY}-{NUMBER:03d} (e.g., BAY-CHECKOUT-001)
- source: matches input source
- category: short snake_case category name
- name: ≤80 chars, descriptive
- severity_if_violated: "critical" | "high" | "medium" | "low"
- reliability_tier: 1 | 2 | 3 (Tier 1 visual/structural; Tier 2 content/persuasion; Tier 3 interaction)
- reliability_note: 1-sentence explanation
- detection.pageTypes: matches input page_types
- detection.businessTypes: contains input archetype
- detection.lookFor: ≥20 chars, what to inspect on the page
- detection.positiveSignals: array of strings
- detection.negativeSignals: array of strings
- detection.dataPoints: subset of DataPointEnum
- detection.evidenceType: "measurable" | "observable" | "subjective"
- recommendation.summary: ≤120 chars, no conversion-rate predictions
- recommendation.details: longer prose, no conversion-rate predictions
- recommendation.researchBacking: cites the source
- benchmark: { type: "quantitative" | "qualitative", ... } (per HeuristicSchema §9.1)
- archetype: matches input
- page_type: matches input page_types
- device: matches input device
- version: "1.0.0"
- rule_vs_guidance: "rule" if structural and binary; "guidance" otherwise
- business_impact_weight: 0.0-1.0
- effort_category: "content" | "design" | "engineering"
- preferred_states: omit unless heuristic requires interaction (e.g., reviews tab open)
- status: "active"
- provenance.source_url: matches input source_url
- provenance.citation_text: matches input citation_text
- provenance.draft_model: "{ANTHROPIC_MODEL_ID}"
- provenance.verified_by: ""   (filled by human verifier)
- provenance.verified_date: "" (filled by human verifier)

CONSTRAINTS:
- Output a single JSON object, no wrapping array
- Strings escape correctly (use \\n for newlines inside strings)
- Numeric values use JSON number type, not strings
- Do not invent benchmark values — derive from citation_text only
```

Notes:
- Drafting model: `claude-sonnet-4-*` (current latest as of drafting date).
- Drafting temperature: 0.3 (slight creativity for varied phrasing; verification re-derives the benchmark deterministically so creativity here doesn't break R10).
- One heuristic per call. No batching (keeps cost attribution clean per heuristic).
- Drafting subprocess uses `Anthropic` SDK directly (not via agent-core's LLMAdapter — that adapter wires LangSmith which violates R15.3.3 for drafting).
- All drafting transcripts (input prompt + raw output) saved to `.heuristic-drafts/<heuristic-id>.json` (gitignored).

---

## 3. Verification Protocol (T0B-002)

Per R15.3.2, every LLM-drafted heuristic requires a human verifier before commit. Protocol (`docs/specs/mvp/templates/heuristic-verification-protocol.md`):

1. **Open `source_url`** in a fresh browser tab. Confirm the URL resolves (200 OK). If 404, find a stable archive (Wayback Machine, Baymard archive); update `source_url` and `provenance` accordingly.
2. **Locate `citation_text`** in the source page. Use Ctrl+F to find the verbatim excerpt. If the excerpt cannot be located, REJECT — re-draft.
3. **Re-derive the benchmark from the source:**
   - **Quantitative:** Read the source's stated value (e.g., "44.5% abandon when forced to register"). Confirm the heuristic's `benchmark.value` is within ±20% of the source value. If outside, REJECT — re-draft.
   - **Qualitative:** Confirm the heuristic's `benchmark.standard_text` paraphrases (or quotes) the source's normative statement. If the heuristic's standard contradicts or extrapolates beyond the source, REJECT — re-draft.
4. **Banned-phrase check:** Read `recommendation.summary` + `recommendation.details`. Confirm NO conversion-rate predictions. If any banned phrase, REJECT — re-draft with stricter prompt rider.
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
    // 4) Banned-phrase regex check
    const text = `${parsed.data.recommendation.summary} ${parsed.data.recommendation.details}`;
    if (BANNED_PHRASE_REGEX.test(text)) {
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
- Fail case: banned phrase in `recommendation.summary` → exit non-zero
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
| **Total** | **~26h** | **~7h** |

Calendar duration: ~4 weeks alongside Phase 1-3 implementation (NOT critical-path during MVP weeks 1-4).

---

## 10. Risks (specific to Phase 0b execution; broader risks in spec.md SC + impact.md §9)

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

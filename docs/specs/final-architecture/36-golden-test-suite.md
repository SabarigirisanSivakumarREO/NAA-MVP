# Section 36 — Golden Test Suite & Quality Assurance

**Status:** Master architecture extension (v2.2). Bootstrapped in Phase 0, expanded through Phase 7+. The quality gate for heuristic and prompt changes.

**Cross-references:**
- §9 (Heuristic KB) — heuristics under test
- §7 (Analyze Mode) — pipeline under test
- §25 (Reproducibility) — temperature=0 enables deterministic comparison
- §34 (Observability) — regression alerts fire through alerting system

---

## 36.1 Principle

> **Heuristic quality is your #1 product risk. A badly worded heuristic produces bad findings for every audit until someone notices. Golden tests are the regression safety net — saved page snapshots with human-validated expected findings, run in CI on every heuristic or prompt change. If the pipeline stops producing the findings a consultant validated, something broke. Without golden tests, quality degradation is silent and cumulative.**

---

## 36.2 Golden Test Case Structure

**REQ-GOLDEN-001:** A golden test case is a frozen input + expected output pair:

```typescript
interface GoldenTestCase {
  id: string;                             // "GT-001"
  name: string;                           // "Amazon PDP — missing size guide"
  source_url: string;                     // original URL (reference only, NOT fetched)
  captured_at: string;                    // ISO date
  validated_by: string;                   // consultant who validated
  validation_notes: string;               // context on why these findings are correct

  // Frozen inputs (never change)
  perception: AnalyzePerception;          // full saved perception
  page_type: PageType;
  business_type: BusinessType;
  filtered_heuristics: Heuristic[];       // exact heuristics used at validation time

  // Expected outputs
  expected_findings: Array<{
    heuristic_id: string;
    status: "violation" | "pass";
    severity: "critical" | "high" | "medium" | "low";
    must_contain: string[];               // key phrases that MUST appear in observation/assessment
  }>;

  expected_false_positives: Array<{       // things the system should NOT flag
    heuristic_id: string;
    reason: string;                       // why this would be a false positive
  }>;
}
```

**REQ-GOLDEN-002:** Golden test cases stored as individual JSON files in `test/golden/GT-XXX.json`. Committed to git. Treated as production artifacts.

---

## 36.3 Bootstrapping Golden Tests

**REQ-GOLDEN-010:** First 5 golden tests SHALL be hand-crafted during Phase 1-5 development:

1. Engineer runs the pipeline on a real site during development
2. Consultant reviews the findings and marks each as valid / invalid / missed
3. Engineer exports the page's perception + validated findings as a golden test case
4. CLI: `pnpm golden:capture --audit-run-id <id> --page-url <url>`
5. Consultant adds `expected_false_positives` for any issues the pipeline incorrectly flagged
6. Saved to `test/golden/GT-XXX.json`

**REQ-GOLDEN-011:** Target milestones:
- Week 4 (Phase 1-2): First 5 golden tests
- Phase 7 end: 10 golden tests
- Phase 8 end: 15 golden tests
- Phase 9 end: 20 golden tests (baseline coverage)

**REQ-GOLDEN-012:** Golden tests are derived from actual audits. This means Phase 0-5 development cannot use golden tests — they don't exist yet. Golden tests become available starting Phase 6-7. This is acceptable: they're a regression safety net, not a development prerequisite.

---

## 36.4 CI Execution

**REQ-GOLDEN-020:** CI triggers golden test suite when PR touches any of:
- `packages/agent-core/src/analysis/`
- `packages/agent-core/src/analysis/heuristics/`
- `heuristics-repo/` (heuristic JSON files)
- Any prompt template file

**REQ-GOLDEN-021:** Per test case execution:

```
For each GoldenTestCase:
  1. Load frozen inputs (perception, heuristics) from JSON
  2. Run evaluate (uses mocked or real LLM depending on mode)
  3. Run self_critique
  4. Run grounding (12 rules, deterministic)
  5. Compare output against expected_findings + expected_false_positives

Compute per test case:
  - True positives:  count of expected_findings actually produced
  - False negatives: expected_findings NOT produced
  - False positives: findings in expected_false_positives list
  - Unexpected:      findings not in either list (flagged for human review)
```

**REQ-GOLDEN-022:** Pass criteria:
- Aggregate true positive rate ≥ 80% across all golden tests
- Aggregate false positive rate ≤ 20%
- No individual test below 60% TP rate
- Unexpected findings logged but do not fail CI (reviewed manually)

---

## 36.5 Two CI Modes

**REQ-GOLDEN-030: Fast mode (every PR)** — uses `MockLLMAdapter` with cached responses:

- Tests grounding, heuristic filtering, scoring, and deterministic pipeline logic
- LLM responses are pre-captured per golden test (from last nightly run)
- Zero API cost
- Runs in ~30 seconds
- Catches: grounding rule bugs, filtering bugs, scoring bugs, integration bugs

**REQ-GOLDEN-031: Nightly mode (scheduled, 2am UTC)** — uses real LLM calls:

- Tests actual evaluate + critique prompt quality
- Updates cached responses for fast mode
- Costs ~$1-2 per run (20 tests × ~$0.10 each)
- Catches: prompt quality regressions, model behavior drift, heuristic-prompt alignment issues

**REQ-GOLDEN-032:** Regression alerting — nightly scores drop > 10% vs 7-day rolling average fires P1 alert via §34 observability. Blocks next deployment until investigated.

---

## 36.6 Offline Mock Mode

**REQ-GOLDEN-040:** Environment variable `NEURAL_MODE=offline` activates full offline mode for development without network or API costs.

**REQ-GOLDEN-041:** Two mock adapters implementing existing interfaces:

**MockBrowserEngine** (implements `BrowserEngine`):
- Returns saved HTML snapshots from `test/fixtures/sites/`
- `page_analyze()` returns saved `AnalyzePerception` JSON
- Screenshots return saved JPEG files
- No Playwright, no network

**MockLLMAdapter** (implements `LLMAdapter`):
- For known inputs (matching golden test perceptions): returns cached responses
- For unknown inputs: returns structured "mock finding" with placeholder data
- Tracks: call count, simulated tokens, simulated cost
- No Anthropic/OpenAI API calls

**REQ-GOLDEN-042:** Fixture directory structure:

```
test/
  fixtures/
    sites/
      amazon-pdp/
        perception.json         # saved AnalyzePerception
        page-state.json         # saved PageStateModel
        viewport.jpg            # saved viewport screenshot
        fullpage.jpg            # saved full-page screenshot
      bbc-homepage/
      shopify-checkout/
    llm-responses/
      evaluate-amazon-pdp.json  # cached LLM evaluate response
      critique-amazon-pdp.json  # cached LLM critique response
  golden/
    GT-001.json
    GT-002.json
```

**REQ-GOLDEN-043:** CLI commands:
- `pnpm test:offline` — runs full audit pipeline against fixtures
- `pnpm test:golden` — runs golden test suite in fast mode
- `pnpm test:golden:nightly` — runs golden suite with real LLM (manual trigger)
- `pnpm fixture:capture --url <url>` — navigates to real URL, saves perception + screenshots as fixture (one-time network hit, reusable forever offline)
- `pnpm golden:capture --audit-run-id <id> --page-url <url>` — exports validated audit page as golden test case

---

## 36.7 Quality Gate Philosophy

**REQ-GOLDEN-050:** Golden tests are the quality gate for:
- Heuristic changes (rewording, adding/removing rules)
- Prompt changes (evaluate, self_critique templates)
- Grounding rule changes (new rules, modified logic)
- Scoring algorithm changes

**REQ-GOLDEN-051:** Golden tests are NOT a substitute for:
- Unit tests (every function still has Vitest tests)
- Integration tests (Playwright tests for browser behavior)
- Type safety (Zod validation at every boundary)

**REQ-GOLDEN-052:** When a golden test fails, the question is: "Is this regression (fix the code) or improvement (update the golden)?" Consultant involvement required for either decision. Never silently update golden tests to match code output.

---

## 36.8 Build Order

**Phase 0:** T252-T253 — offline mock mode infrastructure (MockBrowserEngine, MockLLMAdapter stubs)
**Phase 1:** T254 — fixture capture CLI
**Phase 7:** T250-T251 — golden test infrastructure (runner, comparison logic, CI integration)
**Phase 7+ ongoing:** Build golden test cases incrementally from validated audits

---

**End of §36 — Golden Test Suite & Quality Assurance**

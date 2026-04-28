---
title: Implementation Plan — Phase 3 Verification (thin)
artifact_type: plan
status: draft
version: 0.2
created: 2026-04-27
updated: 2026-04-27
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-3-verification/spec.md
  - docs/specs/mvp/phases/phase-3-verification/impact.md
  - docs/specs/mvp/architecture.md (§6.4, §6.5)
  - docs/specs/mvp/constitution.md (R1-R23)

req_ids:
  - REQ-VERIFY-001
  - REQ-VERIFY-002
  - REQ-VERIFY-003
  - REQ-VERIFY-CONFIDENCE-001
  - REQ-VERIFY-FAILURE-001

impact_analysis: docs/specs/mvp/phases/phase-3-verification/impact.md
breaking: false
affected_contracts:
  - ActionContract
  - VerifyStrategy
  - VerifyEngine
  - ConfidenceScorer
  - FailureClassifier

delta:
  new:
    - First plan introducing R4.2 + R4.4 as code-level structural contracts
    - 9 MVP tasks; 6 strategies deferred to v1.1
    - v0.2 — Phase 1 Design item 4 (ConfidenceScorer) grep-test details tightened (source path, comment-stripping, no-multiline) per analyze finding F06
    - v0.2 — Phase 1 Design item 4 explicitly drops AST claim — grep-only enforcement (analyze finding F01)
  changed:
    - v0.1 → v0.2 — analyze-driven fixes (F01, F06); no design changes
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R4.2, R4.4
  - Constitution R9
  - Constitution R11
  - Constitution R17, R20
  - Constitution R23
---

# Implementation Plan: Phase 3 — Verification (thin)

> **Summary (~100 tokens):** Build verification + confidence + failure-classification primitives. 9 MVP tasks: T051 ActionContract type, T052 VerifyStrategy interface, T053-T055 three MVP strategies (url_change, element_appears, element_text), T062 VerifyEngine, T063 FailureClassifier, T064 ConfidenceScorer (R4.4 multiplicative — non-negotiable), T065 integration test. **No new deps.** Reuses Phase 1 BrowserEngine + MutationMonitor. impact.md MEDIUM-risk (5 new contracts; R4.4 invariant is the focal concern). T056-T061 strategies deferred to v1.1 (tasks-v2 v2.3.2). VerifyEngine reserves v1.1 name slots for forward-compat.

**Branch:** `phase-3-verification` (created at implementation time)
**Date:** 2026-04-27
**Spec:** `docs/specs/mvp/phases/phase-3-verification/spec.md`
**Impact:** `docs/specs/mvp/phases/phase-3-verification/impact.md`

---

## Summary

Phase 3 lands the verification + confidence layer for browse mode. R4.2 ("verify everything") becomes structural via VerifyEngine — every action contract is checked against priority-ordered strategies. R4.4 ("multiplicative confidence decay") becomes structural via ConfidenceScorer — additive math is forbidden by both code review (kill criterion) and a grep-based conformance test. Three MVP strategies cover navigation / click / type verification. Six v1.1 strategies are name-reserved in the strategy enum but not implemented — slot-and-stub seam.

---

## Technical Context

| Field | Value | Source | Used in Phase 3? |
|---|---|---|---|
| TypeScript | 5.x | architecture.md §6.4 | ✅ |
| Node | 22 LTS | architecture.md §6.4 | ✅ |
| Zod | 3.x | architecture.md §6.4 + R2.2 | ✅ (5 new schemas) |
| Playwright | (via Phase 1's BrowserEngine adapter) | architecture.md §6.4 | ✅ indirectly |
| MCP SDK | (via Phase 2's adapter) | architecture.md §6.4 | ❌ Phase 3 doesn't call MCP |
| LLM | claude-sonnet-4 | architecture.md §6.4 | ❌ Phase 4 |
| Pino | latest | architecture.md §6.4 + R10.6 | ✅ (new correlation: action_id, verify_strategy, failure_class) |
| Vitest | latest | architecture.md §6.4 + R3 | ✅ |
| All other stack items | various | architecture.md §6.4 | ❌ later phases |

**No new deps.** Phase 3 is pure TypeScript + Zod + Pino + Vitest using Phase 1's BrowserEngine + MutationMonitor.

**Performance / Scale targets:** NF-Phase3-01 through NF-Phase3-04 (per-strategy < 2 s; engine total < 3 s; integration < 30 s).

**Project Type:** monorepo extension. No new top-level structure.

---

## Constitution Check

- [x] R4.2 verify everything — VerifyEngine is the runtime enforcement
- [x] R4.4 multiplicative confidence decay — ConfidenceScorer enforces; conformance test rejects additive math
- [x] R5.3 + GR-007 no conversion predictions — N/A (no findings)
- [x] R6 heuristic boundary — N/A
- [x] R7.* DB rules — N/A (no DB writes in Phase 3; results pass to Phase 5 for routing)
- [x] R9 adapter pattern — VerifyEngine is the strategy adapter (registers MVP + reserves v1.1 names)
- [x] R10 temperature — no LLM calls
- [x] R10.1-R10.6 file/function size, named exports, no console.log — declared per task; strategies are tiny
- [x] R11.2 REQ-ID tracing — REQ-VERIFY-* + R4.4 codified
- [x] R20 impact analysis — REQUIRED, MEDIUM risk; authored
- [x] R23 kill criteria — default block; T064 ConfidenceScorer carries explicit additive-math kill trigger

---

## Project Structure

### Documentation

```
docs/specs/mvp/phases/phase-3-verification/
├── README.md
├── spec.md
├── impact.md         # R20 — MEDIUM risk, REQUIRED
├── plan.md           # this file
├── tasks.md
├── checklists/requirements.md
└── phase-3-current.md  # rollup (created by user at exit)
```

### Source Code

```
packages/agent-core/src/
├── verification/                            # NEW directory
│   ├── types.ts                             # ActionContract + VerifyStrategy + VerifyResult Zod
│   ├── VerifyEngine.ts                      # T062 — registry + dispatch
│   ├── FailureClassifier.ts                 # T063
│   ├── ConfidenceScorer.ts                  # T064 — multiplicative only
│   ├── strategies/
│   │   ├── UrlChangeStrategy.ts             # T053
│   │   ├── ElementAppearsStrategy.ts        # T054 (uses Phase 1 MutationMonitor)
│   │   └── ElementTextStrategy.ts           # T055
│   └── index.ts                             # barrel
└── observability/
    └── logger.ts                            # MODIFIED — add action_id + verify_strategy + failure_class correlation fields
```

### Test Layout

```
packages/agent-core/tests/
├── conformance/
│   ├── action-contract.test.ts                          # AC-01
│   ├── verify-strategy.test.ts                          # AC-02
│   ├── verify-url-change.test.ts                        # AC-03
│   ├── verify-element-appears.test.ts                   # AC-04
│   ├── verify-element-text.test.ts                      # AC-05
│   ├── verify-engine.test.ts                            # AC-06
│   ├── failure-classifier.test.ts                       # AC-07
│   ├── confidence-scorer.test.ts                        # AC-08 main
│   └── confidence-scorer-no-additive.test.ts            # AC-08 grep guard
└── integration/
    └── phase3.test.ts                                    # AC-09
```

**Files this feature creates / modifies:**

| File | Layer | New / modified |
|---|---|---|
| `verification/types.ts` | verification | new |
| `verification/strategies/UrlChangeStrategy.ts` | verification | new |
| `verification/strategies/ElementAppearsStrategy.ts` | verification | new |
| `verification/strategies/ElementTextStrategy.ts` | verification | new |
| `verification/VerifyEngine.ts` | verification | new |
| `verification/FailureClassifier.ts` | verification | new |
| `verification/ConfidenceScorer.ts` | verification | new |
| `verification/index.ts` | verification | new |
| `observability/logger.ts` | observability | modified (add 3 correlation fields) |
| 9 conformance + 1 integration test files | tests | new |

**Structure Decision:** All paths fit architecture.md §6.5 (`verification/` directory listed in canonical structure with note "ActionContract, 3 strategies (MVP) + interface for Interactive in v1.2, VerifyEngine"). Note: §6.5 mentions "3 strategies" — aligned with our MVP.

---

## Phase 0 — Research

**No research needed.** Open design choices resolved in spec.md edge cases.

The one design decision worth highlighting: `ElementAppearsStrategy` checks **visibility** (boundingBox > 0 + computed style not hidden), not just DOM presence. Bare `querySelector !== null` is insufficient because elements can be present in DOM but visually hidden — verification would falsely succeed.

---

## Phase 1 — Design

### Strategy interface (T052)

```ts
export interface VerifyStrategy {
  readonly name: VerifyStrategyName;       // enum from impact.md
  readonly priority: number;                // higher = run first
  applicable(contract: ActionContract): boolean;
  verify(contract: ActionContract, session: BrowserSession): Promise<VerifyResult>;
}
```

Each strategy is a plain class implementing this interface. No DI framework; the engine's registry holds instances.

### VerifyEngine (T062) — registry + dispatch

```ts
export class VerifyEngine {
  private readonly strategies = new Map<VerifyStrategyName, VerifyStrategy>();

  register(strategy: VerifyStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  async verify(contract: ActionContract, session: BrowserSession): Promise<AggregatedVerifyResult> {
    const candidates = contract.candidateStrategies
      .map(name => this.strategies.get(name))
      .filter((s): s is VerifyStrategy => Boolean(s) && s.applicable(contract))
      .sort((a, b) => b.priority - a.priority);

    const failures: VerifyResult[] = [];
    for (const strategy of candidates) {
      const result = await strategy.verify(contract, session);
      if (result.ok) return { ok: true, strategy: strategy.name, evidence: result.evidence, failures };
      failures.push(result);
    }
    return { ok: false, attemptedStrategies: candidates.map(s => s.name), failures };
  }
}
```

Forward-compat: `register()` accepts any `VerifyStrategy` whose `name` is in the enum; v1.1 strategies will register against names already declared (`no_captcha`, etc.) without engine changes.

### ConfidenceScorer (T064) — multiplicative ONLY

```ts
export interface ConfidenceScorerConfig {
  failureFactor: number;  // default 0.97
  successFactor: number;  // default 1.01
  floor: number;           // default 0.10
}

export class ConfidenceScorer {
  constructor(private cfg: ConfidenceScorerConfig = { failureFactor: 0.97, successFactor: 1.01, floor: 0.10 }) {}

  afterFailure(c: number): number { return c * this.cfg.failureFactor; }       // ONLY multiplication
  afterSuccess(c: number): number { return Math.min(1, c * this.cfg.successFactor); }
  belowFloor(c: number): boolean { return c < this.cfg.floor; }
}
```

**Hard rule:** the source code uses `*` operator only. Conformance test `confidence-scorer-no-additive.test.ts` reads the source file as text, **strips comments**, and greps for forbidden patterns. Source path is fixed: `packages/agent-core/src/verification/ConfidenceScorer.ts`. Comments (`//...` and `/* ... */`) are stripped BEFORE grep — so explanatory prose containing `+` or `-` is allowed in comments only. The regex evaluates each line independently (does NOT cross newlines).

```ts
// in confidence-scorer-no-additive.test.ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SRC_PATH = join(__dirname, '..', '..', 'src', 'verification', 'ConfidenceScorer.ts');
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bc\s*[-+]\s*\d/,         // c - 0.05, c + 0.01
  /\bc\s*[-+]=/,             // c -= ..., c += ...
  /\bcurrent\s*[-+]\s*\d/,   // current - 0.05
  /\bconfidence\s*[-+]/,     // confidence - X, confidence + X
];

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/\/\/[^\n]*/g, '');         // line comments
}

it('ConfidenceScorer source contains no additive math (R4.4)', async () => {
  const raw = await readFile(SRC_PATH, 'utf8');
  const stripped = stripComments(raw);
  for (const line of stripped.split('\n')) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(line).not.toMatch(pattern);
    }
  }
});
```

Plus runtime test that `afterFailure(1).toFixed(2) === '0.97'` (proves multiplication).

**Note (analyze finding F01):** spec.md AC-08 v0.2 dropped any "AST check" claim — enforcement is **grep-only** (with comment-stripping). AST traversal would catch more cases but adds tooling cost not justified by Phase 3 scope; revisit if grep-only proves insufficient.

### FailureClassifier (T063)

Pure function table mapping `AggregatedVerifyResult` shapes → `FailureClassification`. No external state; deterministic.

```ts
export class FailureClassifier {
  classify(input: AggregatedVerifyResult | { kind: 'safety' | 'rate' }): FailureClassification {
    if ('kind' in input) {
      if (input.kind === 'safety') return { class: 'safety_blocked', subclass: 'pre_action_block', shouldRetry: false };
      if (input.kind === 'rate') return { class: 'rate_limited', subclass: 'domain_cap_hit', shouldRetry: true };
    }
    if (input.attemptedStrategies.length === 0) return { class: 'unverifiable', subclass: 'no_applicable_strategy', shouldRetry: false };
    // Inspect failures[0] for subclass
    const first = input.failures[0];
    if (first.strategy === 'url_change' && first.evidence?.actualUrl === 'about:blank') {
      return { class: 'verify_failed', subclass: 'navigation_did_not_complete', shouldRetry: true };
    }
    // ... more patterns
    return { class: 'verify_failed', subclass: 'unknown', shouldRetry: true };
  }
}
```

`bot_detected_likely` class is in the enum but no MVP path produces it — pre-positioned for v1.1.

---

## Complexity Tracking

**None — plan respects all 23 Constitution rules.**

The R4.4 enforcement (additive-math grep test) is a *positive* constitution-strengthening measure, not a violation.

---

## Approval Gates

| Gate | Approver | Evidence |
|---|---|---|
| Spec → Plan transition | spec author + product owner | spec `approved` AND impact.md `approved` |
| Tech stack adherence | engineering lead | All §6.4 fields match (no new deps) |
| Constitution check | engineering lead | All checkboxes ticked above |
| R4.4 enforcement | engineering lead | T064 grep test in place + kill criterion |
| Plan → Tasks transition | engineering lead | This plan `approved` |

---

## Cross-references

- spec.md, impact.md (this folder)
- Phase 1 spec, impact (BrowserEngine + MutationMonitor consumed)
- `docs/specs/mvp/tasks-v2.md` v2.3.2 T051-T065
- `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` REQ-VERIFY-*
- `docs/specs/mvp/constitution.md` R4.2, R4.4, R9, R20, R23

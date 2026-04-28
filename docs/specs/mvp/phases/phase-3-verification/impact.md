---
title: Impact Analysis — Phase 3 Verification (5 new shared contracts)
artifact_type: impact
status: draft
version: 0.1
created: 2026-04-27
updated: 2026-04-27
owner: engineering lead

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-3-verification/spec.md
  - docs/specs/mvp/phases/phase-3-verification/plan.md
  - docs/specs/AI_Browser_Agent_Architecture_v3.1.md REQ-VERIFY-*

req_ids:
  - REQ-VERIFY-001
  - REQ-VERIFY-002
  - REQ-VERIFY-003
  - REQ-VERIFY-CONFIDENCE-001
  - REQ-VERIFY-FAILURE-001

breaking: false
risk_level: medium

affected_contracts:
  - ActionContract
  - VerifyStrategy
  - VerifyEngine
  - ConfidenceScorer
  - FailureClassifier

delta:
  new:
    - First impact.md formalizing R4.2 verify-everything + R4.4 multiplicative confidence as code-level contracts
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R4.2, R4.4
  - Constitution R9
  - Constitution R18
  - Constitution R20
  - Constitution R22
---

# Impact Analysis: ActionContract + VerifyStrategy + VerifyEngine + ConfidenceScorer + FailureClassifier

## Why R20 applies

Five new shared contracts in one phase. All consumed by Phase 5 Browse MVP (every action node) and Phase 4 (FailureClassifier consumed by orchestrator routing). All five are additive (no prior version exists), so `breaking: false`. Risk: MEDIUM — smaller surface than Phase 2's MCP fanout, but the R4.4 multiplicative-decay invariant is non-negotiable at the codebase level and one slip-up violates the constitution.

## Affected modules

### Phase 3

| File | Layer | Role |
|---|---|---|
| `packages/agent-core/src/verification/types.ts` | verification | ActionContract + VerifyStrategy + VerifyResult Zod schemas |
| `packages/agent-core/src/verification/strategies/UrlChangeStrategy.ts` | verification/strategies | T053 |
| `packages/agent-core/src/verification/strategies/ElementAppearsStrategy.ts` | verification/strategies | T054 |
| `packages/agent-core/src/verification/strategies/ElementTextStrategy.ts` | verification/strategies | T055 |
| `packages/agent-core/src/verification/VerifyEngine.ts` | verification | T062 — strategy registry + dispatch |
| `packages/agent-core/src/verification/FailureClassifier.ts` | verification | T063 |
| `packages/agent-core/src/verification/ConfidenceScorer.ts` | verification | T064 — multiplicative-only |
| `packages/agent-core/src/verification/index.ts` | verification | barrel |

Phase 1's `MutationMonitor` is consumed by `ElementAppearsStrategy` (no Phase 1 modification needed).

### Downstream consumers

| Phase | File(s) | Imports |
|---|---|---|
| Phase 4 | `safety/SafetyCheck.ts` | `FailureClassifier` (returns `safety_blocked` failures) |
| Phase 5 | `orchestration/nodes/BrowseNode.ts` | `ActionContract`, `VerifyEngine`, `ConfidenceScorer`, `FailureClassifier` |
| Phase 5 | `orchestration/AuditState.ts` | session-level confidence tracked via ConfidenceScorer |

Phase 7 does NOT consume these — Phase 7 uses its own 4D finding scoring per architecture.md (different concern).

## Affected contracts

### `ActionContract` (NEW)

```ts
export const ActionContractSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['navigate', 'click', 'type', 'scroll', 'select', 'press_key', 'upload', /* ... */]),
  target: z.object({ /* tool-specific */ }).optional(),
  expected: z.discriminatedUnion('kind', [
    z.object({ kind: 'urlMatches', urlMatches: z.union([z.string(), z.instanceof(RegExp)]) }),
    z.object({ kind: 'elementAppears', selector: z.string(), timeoutMs: z.number().default(10000) }),
    z.object({ kind: 'elementText', selector: z.string(), text: z.union([z.string(), z.instanceof(RegExp)]) }),
    // v1.1 will add discriminants for network_request, snapshot_diff, etc.
  ]),
  candidateStrategies: z.array(z.string()),  // priority-ordered names
}).strict();
```

### `VerifyStrategy` (NEW interface)

```ts
export interface VerifyStrategy {
  readonly name: VerifyStrategyName;       // enum includes MVP + v1.1 names
  readonly priority: number;
  applicable(contract: ActionContract): boolean;
  verify(contract: ActionContract, session: BrowserSession): Promise<VerifyResult>;
}

export const VerifyStrategyNames = [
  // MVP
  'url_change',
  'element_appears',
  'element_text',
  // v1.1 — names reserved; implementations deferred
  'network_request',
  'no_error_banner',
  'snapshot_diff',
  'custom_js',
  'no_captcha',
  'no_bot_block',
] as const;
export type VerifyStrategyName = typeof VerifyStrategyNames[number];
```

The enum being declared in Phase 3 (with v1.1 names reserved) is the forward-compat seam — v1.1 implementations register against these names without touching the enum.

### `VerifyEngine` (NEW)

```ts
export interface VerifyEngine {
  register(strategy: VerifyStrategy): void;
  verify(contract: ActionContract, session: BrowserSession): Promise<AggregatedVerifyResult>;
}
```

### `ConfidenceScorer` (NEW — R4.4 enforcement)

```ts
export interface ConfidenceScorer {
  afterSuccess(current: number): number;   // returns min(1, current × 1.01)
  afterFailure(current: number): number;   // returns current × 0.97 (factor configurable; never additive)
  belowFloor(current: number): boolean;    // current < threshold (default 0.10)
}
```

**R4.4 enforcement at code level:**
- Implementation: ConfidenceScorer.ts uses `*` operator only — no `-` or `+` on confidence.
- Conformance test: `confidence-scorer-no-additive.test.ts` greps the source AST for `-=`, `+=`, `- 0.`, `+ 0.` patterns on confidence variables; FAIL the test if found.
- Kill criterion in tasks.md T064: any additive math = STOP.

### `FailureClassifier` (NEW)

```ts
export type FailureClass =
  | 'verify_failed'
  | 'safety_blocked'
  | 'rate_limited'
  | 'unverifiable'         // no applicable strategy
  | 'bot_detected_likely'; // pre-positioned for v1.1 'no_bot_block' strategy

export interface FailureClassification {
  class: FailureClass;
  subclass: string;        // free-form per class — e.g., 'navigation_did_not_complete' under 'verify_failed'
  shouldRetry: boolean;
  context?: unknown;
}

export interface FailureClassifier {
  classify(input: AggregatedVerifyResult | { kind: 'safety' | 'rate' }): FailureClassification;
}
```

`bot_detected_likely` is in the enum even though no MVP strategy populates it — pre-positioned so v1.1's `no_bot_block` strategy can produce it without enum change.

## Breaking changes

None — all 5 contracts are additive.

## Migration plan

Not applicable.

## Forward Contract — what Phase 4 + Phase 5 will import

### Phase 4 (T066 ActionClassifier — Safety + Infra)

```ts
import { FailureClassifier, FailureClass } from '@neural/agent-core/verification';

// SafetyCheck wraps action invocation; on safety reject, calls classifier with kind: 'safety'
const failure = classifier.classify({ kind: 'safety' });
// → { class: 'safety_blocked', subclass: '...', shouldRetry: false }
```

### Phase 5 (T081-T091 — Browse MVP)

```ts
import {
  ActionContract,
  VerifyEngine,
  ConfidenceScorer,
  FailureClassifier,
} from '@neural/agent-core/verification';

// In BrowseNode after action:
const result = await verifyEngine.verify(contract, session);
if (!result.ok) {
  const failure = classifier.classify(result);
  state.confidence = scorer.afterFailure(state.confidence);
  if (scorer.belowFloor(state.confidence)) routeTo('escalate');
  else if (failure.shouldRetry) routeTo('retry');
  else routeTo('replan');
}
```

**Forward stability promise:**
- `VerifyStrategyName` enum values are LOCKED. v1.1 implementations register against the existing names; never rename.
- `FailureClass` enum values are LOCKED. New classes require their own impact.md cycle.
- `ConfidenceScorer` factor (0.97) is configurable but enforced multiplicative — additive replacement is forbidden.

## Risk level: MEDIUM — mitigations

**Why MEDIUM:**
- 5 contracts, but small surface per contract.
- Single consumer phase (Phase 5) for ActionContract / VerifyEngine / ConfidenceScorer; Phase 4 takes only FailureClassifier.
- All additive — no migration risk.

**Why not LOW:**
- R4.4 multiplicative-decay invariant is constitution-level. A subtle additive slip-up (`current - 0.03` instead of `current × 0.97`) violates R4.4 without obvious test failure.
- VerifyStrategyName enum drift between MVP and v1.1 would force re-shape.

**Mitigations:**
- T064 conformance test specifically greps for additive math patterns.
- T064 kill criterion: any additive math = STOP.
- VerifyStrategyName enum declared with all 9 names from day one (Phase 3 ships 3 implementations; v1.1 adds 6).

## Verification

| Check | Test |
|---|---|
| ActionContract Zod parse on 5 fixtures | `tests/conformance/action-contract.test.ts` (AC-01) |
| 3 MVP strategies behave per spec | `tests/conformance/verify-{url-change,element-appears,element-text}.test.ts` (AC-03..05) |
| VerifyEngine registry accepts v1.1 name slot | `tests/conformance/verify-engine.test.ts` AC-06 forward-compat block |
| ConfidenceScorer multiplicative — no additive math in source | `tests/conformance/confidence-scorer-no-additive.test.ts` (AC-08) — greps source for forbidden patterns |
| FailureClassifier produces all 5 classes correctly | `tests/conformance/failure-classifier.test.ts` (AC-07) |

## Provenance (R22.2)

```yaml
why:
  source: >
    docs/specs/AI_Browser_Agent_Architecture_v3.1.md REQ-VERIFY-* +
    docs/specs/mvp/constitution.md R4.2 (verify everything) + R4.4 (multiplicative confidence decay)
  evidence: >
    R4.4 retroactive audit (2026-04-24, R22.5) cites "multiplicative naturally bounds in (0, 1)
    while additive accumulates unboundedly". ConfidenceScorer is the FIRST concrete code-level
    enforcement of this rule. R4.2 (verify everything) becomes structural via VerifyEngine —
    R5.2 grounding-as-deterministic-code precedent applied to browse verification.
  linked_failure: >
    Cross-session pattern during spec design — additive confidence updates accumulated unbounded
    after multiple failures, producing negative confidence in pilot tests. Multiplicative decay
    fixes this by bounding the math.
```

## Approval

| Gate | Approver | Evidence |
|---|---|---|
| Impact analysis review | engineering lead | this `status: approved` |
| R20 compliance | engineering lead | 5 contracts documented |
| R4.4 multiplicative invariant | engineering lead | T064 kill criterion + grep test in place |
| Phase 3 spec → plan transition | spec author + product owner | spec `approved` AND this `approved` |

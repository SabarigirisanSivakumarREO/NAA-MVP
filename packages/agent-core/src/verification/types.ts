/**
 * Verification contracts — canonical Phase 3 shared types.
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/mvp/phases/phase-3-verification/spec.md AC-01 + R-01
 *     (REQ-VERIFY-001); spec.md AC-02 + R-02 (REQ-VERIFY-002).
 *   docs/specs/mvp/phases/phase-3-verification/impact.md §ActionContract (NEW)
 *     + §VerifyStrategy (NEW interface) — verbatim Zod + TS shapes.
 *   docs/specs/mvp/phases/phase-3-verification/tasks.md T051 + T052 briefs.
 *
 * T051 (this commit) — exports:
 *   - ExpectedSchema discriminated union (urlMatches | elementAppears |
 *     elementText) + per-variant strict schemas
 *   - ActionContractSchema + ActionContract type
 *   - VerifyResultSchema + VerifyResult type (single strategy attempt)
 *   - AggregatedVerifyResultSchema + AggregatedVerifyResult type
 *     (VerifyEngine output discriminated on ok:true|false)
 *
 * T052 (subsequent commit) extends this file with VerifyStrategyNames /
 * VerifyStrategyName / VerifyStrategy interface — keeping the combined file
 * < 200 LOC per tasks.md T052 constraint.
 *
 * R10 compliance: file ≤ 300 LOC; named exports only; no `any`; .strict() at
 * every object boundary that has a closed shape. R2 (Zod-first at boundaries).
 * R9 (verification adapter seam — strategies plug into VerifyEngine via
 * VerifyStrategy interface; no vendor SDK leak here).
 *
 * impact.md v0.2 — `type` is z.string() (NOT z.enum) for forward-compat: it
 * is informational metadata for logging + FailureClassifier subclass routing,
 * NOT a strategy-dispatch driver (expected.kind drives dispatch). Phase 5
 * BrowseNode owns concrete enum closure against Phase 2's 22 browser_* + 2
 * agent_* tools.
 */
import { z } from 'zod';

/**
 * Expected outcome variants — discriminated on `kind`.
 *
 * String urlMatches uses STRICT EQUALITY (`actualUrl === expected.urlMatches`)
 * at runtime; RegExp urlMatches uses `.test(actualUrl)` (impact.md v0.2 F03
 * closure; spec.md AC-03 + Scenario 1). Strategies dispatch via
 * `typeof` / `instanceof RegExp` discriminator (T053 UrlChangeStrategy).
 */
export const ExpectedUrlMatchesSchema = z
  .object({
    kind: z.literal('urlMatches'),
    urlMatches: z.union([z.string(), z.instanceof(RegExp)]),
  })
  .strict();

/**
 * Element-appears variant. `timeoutMs` is the single shared ceiling for both
 * MutationMonitor settle (precondition gate) AND the 3-criterion visibility
 * check (spec.md AC-04 + edge case "ElementAppearsStrategy two-timer
 * semantics"). Default 10 000 ms per spec.
 */
export const ExpectedElementAppearsSchema = z
  .object({
    kind: z.literal('elementAppears'),
    selector: z.string(),
    timeoutMs: z.number().int().positive().default(10000),
  })
  .strict();

/**
 * Element-text variant. String text uses SUBSTRING match, case-sensitive;
 * RegExp text uses `.test()` pattern match (spec.md AC-05 + Scenario 3 +
 * impact.md v0.2). Runtime dispatch via `typeof` / `instanceof RegExp` lives
 * in T055 ElementTextStrategy.
 */
export const ExpectedElementTextSchema = z
  .object({
    kind: z.literal('elementText'),
    selector: z.string(),
    text: z.union([z.string(), z.instanceof(RegExp)]),
  })
  .strict();

export const ExpectedSchema = z.discriminatedUnion('kind', [
  ExpectedUrlMatchesSchema,
  ExpectedElementAppearsSchema,
  ExpectedElementTextSchema,
]);

export type Expected = z.infer<typeof ExpectedSchema>;

/**
 * Every browse-mode action declares an ActionContract — pre/post-conditions
 * + candidate verify strategies. Consumed by Phase 5 BrowseNode (REQ-VERIFY-001).
 *
 * `target` is intentionally `z.unknown().optional()` — its shape is
 * tool-specific (Phase 2's 22 browser_* + 2 agent_* tools) and opaque to
 * Phase 3. Phase 5 may tighten to per-tool schemas at impl time.
 */
export const ActionContractSchema = z
  .object({
    id: z.string().uuid(),
    type: z.string(),
    target: z.unknown().optional(),
    expected: ExpectedSchema,
    candidateStrategies: z.array(z.string()),
  })
  .strict();

export type ActionContract = z.infer<typeof ActionContractSchema>;

/**
 * Single-strategy attempt outcome.
 *
 * `unstable` / `timedOut` / `failedCriterion` carry ElementAppearsStrategy
 * two-timer semantics (spec.md edge case + T054):
 *   - `unstable: true` when MutationMonitor's internal 2 s timer fires before
 *     DOM settles
 *   - `timedOut: true` when visibility check exceeds remaining timeoutMs
 *   - `failedCriterion: 'a'|'b'|'c'` which of the 3 visibility criteria failed
 *     (a: DOM presence, b: bounding box > 0, c: computed style visible)
 *
 * `evidence` is strategy-specific (e.g., url_change emits `{ actualUrl }`)
 * and opaque to engine + classifier — they pass it through.
 */
export const VerifyResultSchema = z
  .object({
    ok: z.boolean(),
    strategy: z.string(),
    evidence: z.unknown().optional(),
    error: z.string().optional(),
    unstable: z.boolean().optional(),
    timedOut: z.boolean().optional(),
    failedCriterion: z.enum(['a', 'b', 'c']).optional(),
  })
  .strict();

export type VerifyResult = z.infer<typeof VerifyResultSchema>;

/**
 * VerifyEngine output — aggregates one or more single-strategy attempts.
 * Discriminated on `ok`:
 *   - ok: true → first successful strategy wins; prior failed attempts (if
 *     any) listed in `failures` (may be empty)
 *   - ok: false → no strategy succeeded; `attemptedStrategies` records the
 *     names tried in dispatch order; `reason` carries engine-level reasons
 *     such as 'no_applicable_strategy' (spec.md edge case)
 *
 * Consumed by Phase 4 FailureClassifier (T063) and Phase 5 BrowseNode.
 */
export const AggregatedVerifyResultSchema = z.union([
  z
    .object({
      ok: z.literal(true),
      strategy: z.string(),
      evidence: z.unknown().optional(),
      failures: z.array(VerifyResultSchema),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      attemptedStrategies: z.array(z.string()),
      failures: z.array(VerifyResultSchema),
      reason: z.string().optional(),
    })
    .strict(),
]);

export type AggregatedVerifyResult = z.infer<typeof AggregatedVerifyResultSchema>;

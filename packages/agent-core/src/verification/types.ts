/**
 * Verification contracts — canonical Phase 3 shared types.
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/mvp/phases/phase-3-verification/spec.md AC-01 + R-01
 *     (REQ-VERIFY-001); AC-02 + R-02 (REQ-VERIFY-002).
 *   docs/specs/mvp/phases/phase-3-verification/impact.md §ActionContract
 *     (NEW) + §VerifyStrategy (NEW interface) — verbatim Zod + TS shapes.
 *   docs/specs/mvp/phases/phase-3-verification/tasks.md T051 + T052 briefs.
 *
 * Exports (T051 + T052):
 *   - ExpectedSchema discriminated union (urlMatches | elementAppears |
 *     elementText) + per-variant strict schemas
 *   - ActionContractSchema + ActionContract type
 *   - VerifyResultSchema + VerifyResult type (single strategy attempt)
 *   - AggregatedVerifyResultSchema + AggregatedVerifyResult type
 *     (VerifyEngine output discriminated on ok:true|false)
 *   - VerifyStrategyNames const (9 entries; 3 MVP + 6 v1.1 reserved)
 *   - VerifyStrategyName type + VerifyStrategy interface
 *
 * R10: file ≤ 300 LOC (target ≤ 200 per T052 brief); named exports only;
 *   no `any`; .strict() on every closed-shape object.
 * R2: Zod-first at every external boundary.
 * R9: VerifyStrategy is the strategy-registry seam — strategies plug into
 *   VerifyEngine (T062) without engine code change.
 *
 * impact.md v0.2 — `type` is z.string() (NOT z.enum) for forward-compat: it
 * is informational metadata for logging + FailureClassifier subclass routing,
 * NOT a strategy-dispatch driver (expected.kind drives dispatch). Phase 5
 * BrowseNode owns concrete enum closure against Phase 2's 22 browser_* + 2
 * agent_* tools.
 */
import { z } from 'zod';

import type { BrowserSession } from '../adapters/BrowserEngine.js';

/**
 * Expected outcome variants — discriminated on `kind`.
 *
 * urlMatches: string = STRICT EQUALITY (`actualUrl === urlMatches`); RegExp =
 *   `.test(actualUrl)` (impact.md v0.2 F03 closure; spec.md AC-03 + Scenario 1).
 * elementText: string = SUBSTRING match, case-sensitive; RegExp = `.test()`
 *   pattern match (spec.md AC-05 + Scenario 3).
 * elementAppears `timeoutMs`: single shared ceiling for MutationMonitor
 *   settle (precondition gate) AND 3-criterion visibility check (spec.md
 *   AC-04 edge case "ElementAppearsStrategy two-timer semantics"); default
 *   10 000 ms. Runtime dispatch via `typeof` / `instanceof RegExp` lives in
 *   T053-T055 strategies.
 */
export const ExpectedUrlMatchesSchema = z
  .object({
    kind: z.literal('urlMatches'),
    urlMatches: z.union([z.string(), z.instanceof(RegExp)]),
  })
  .strict();

export const ExpectedElementAppearsSchema = z
  .object({
    kind: z.literal('elementAppears'),
    selector: z.string(),
    timeoutMs: z.number().int().positive().default(10000),
  })
  .strict();

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
 * Single-strategy attempt outcome. `unstable` / `timedOut` / `failedCriterion`
 * carry ElementAppearsStrategy two-timer semantics (spec.md edge case + T054):
 * unstable=MutationMonitor 2 s timer fired before settle; timedOut=visibility
 * check exceeded timeoutMs; failedCriterion='a' DOM presence | 'b' box > 0 |
 * 'c' style visible. `evidence` is strategy-specific (e.g., `{ actualUrl }`).
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
 * VerifyEngine output — aggregates strategy attempts. Discriminated on `ok`:
 * true=winning strategy + (possibly empty) prior `failures`; false=no
 * strategy succeeded, `attemptedStrategies` records names tried in order,
 * `reason` carries engine-level reasons like 'no_applicable_strategy'
 * (spec.md edge case). Consumed by FailureClassifier (T063) + BrowseNode.
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

/**
 * VerifyStrategyNames — 9-entry closed enum: 3 MVP + 6 v1.1 reserved.
 *
 * FORWARD-COMPAT SEAM (impact.md §VerifyStrategy): Phase 3 ships 3 MVP
 * implementations (T053 url_change, T054 element_appears, T055 element_text);
 * v1.1 plugs in the 6 reserved names (network_request, no_error_banner,
 * snapshot_diff, custom_js, no_captcha, no_bot_block) without engine code
 * change. Adding / renaming requires a fresh impact.md cycle (R20).
 *
 * `bot_detected_likely` is pre-positioned in FailureClassifier (T063 / AC-07)
 * to receive evidence from v1.1's `no_bot_block` strategy without enum drift.
 */
export const VerifyStrategyNames = [
  // MVP (Phase 3)
  'url_change',
  'element_appears',
  'element_text',
  // v1.1 reserved — implementations deferred per tasks-v2 v2.3.2
  'network_request',
  'no_error_banner',
  'snapshot_diff',
  'custom_js',
  'no_captcha',
  'no_bot_block',
] as const;

export type VerifyStrategyName = (typeof VerifyStrategyNames)[number];

/**
 * Strategy interface implemented by 3 MVP strategies (T053-T055) and
 * registered with VerifyEngine (T062). v1.1 strategies (T056-T061) plug into
 * this same interface without engine code change.
 *   - `name` MUST be a member of VerifyStrategyNames.
 *   - `priority`: dispatch hint; VerifyEngine sorts descending (higher first).
 *     T053 uses priority=100 (most fundamental).
 *   - `applicable(contract)` typically gates on `contract.expected.kind`.
 *   - `verify(contract, session)` runs the live check; returns VerifyResult.
 *
 * NOT a Zod schema — methods don't serialize. TS interface only.
 *
 * `BrowserSession` comes from Phase 1's BrowserEngine adapter (R9 boundary).
 * Strategies receive the session by injection; they don't import Playwright.
 */
export interface VerifyStrategy {
  readonly name: VerifyStrategyName;
  readonly priority: number;
  applicable(contract: ActionContract): boolean;
  verify(contract: ActionContract, session: BrowserSession): Promise<VerifyResult>;
}

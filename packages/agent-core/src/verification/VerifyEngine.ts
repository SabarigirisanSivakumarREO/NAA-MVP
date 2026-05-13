/**
 * VerifyEngine — strategy registry + dispatch (Phase 3 T062).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-3-verification/spec.md AC-06 + R-06
 *     (REQ-VERIFY-002) + Scenario 4 (priority dispatch) + Scenario 6
 *     (v1.1 forward-compat seam).
 *   docs/specs/mvp/phases/phase-3-verification/tasks.md T062 brief.
 *   docs/specs/mvp/phases/phase-3-verification/impact.md §VerifyEngine (NEW).
 *   docs/specs/mvp/phases/phase-3-verification/plan.md Phase 1 — Design
 *     §VerifyEngine (T062) — canonical pseudo-code.
 *
 * AC-06 contract:
 *   - register(strategy) accepts ANY VerifyStrategy whose `name` is in the
 *     locked 9-entry VerifyStrategyNames enum (3 MVP + 6 v1.1 reserved).
 *     The TS type `VerifyStrategy.name: VerifyStrategyName` is the ONLY
 *     allowlist — no runtime MVP-only whitelist. A v1.1 strategy
 *     ('no_captcha', 'no_bot_block', etc.) registers without engine code
 *     change. This is the forward-compat seam (kill criterion T062).
 *   - verify(contract, session) resolves candidates from
 *     `contract.candidateStrategies`, filters by `applicable(contract)`,
 *     sorts by `priority` DESC, and iterates first-success-wins. Unknown
 *     names (not in registry) and inapplicable strategies are silently
 *     skipped — both are valid runtime states (e.g., v1.1 strategy named
 *     in a v1.2 contract).
 *   - No candidates after filtering → ok:false,
 *     reason='no_applicable_strategy', empty arrays.
 *   - Pino correlation per spec.md §10.1: action_id bound on enter;
 *     verify_strategy bound per attempt via child(). Matches T-PHASE3-LOGGER
 *     (commit 4e005fd) + the Phase 2 stubLogger pattern.
 *
 * R9: engine is the strategy-registry adapter; consumes BrowserSession only
 *   via strategies (engine itself doesn't touch session.page).
 * R10: file ≤ 200 LOC; named export only; no `any`; no console.log.
 * R20: ActionContract / VerifyStrategy / AggregatedVerifyResult are the
 *   shared contracts; consumed by Phase 5 BrowseNode (impact.md §Downstream).
 *
 * Design notes:
 *   - Registry is Map<VerifyStrategyName, VerifyStrategy> for O(1) lookup
 *     + deterministic dup-handling (last-wins, see register()).
 *   - The engine trusts contracts at entry (no Zod parse) — boundary
 *     validation lives at types.ts ActionContractSchema for upstream
 *     callers per R9.
 */
import type { Logger } from 'pino';

import type { BrowserSession } from '../adapters/BrowserEngine.js';
import type {
  ActionContract,
  AggregatedVerifyResult,
  VerifyResult,
  VerifyStrategy,
  VerifyStrategyName,
} from './types.js';

/**
 * Strategy registry + dispatch orchestrator. Hosts a Map of strategies keyed
 * by their name (compile-time-narrowed to VerifyStrategyNames). Phase 5
 * BrowseNode constructs ONE engine per audit and registers all 3 MVP
 * strategies at startup; v1.1 strategies plug in without engine code change.
 */
export class VerifyEngine {
  private readonly strategies = new Map<VerifyStrategyName, VerifyStrategy>();

  constructor(private readonly logger?: Logger) {}

  /**
   * Register a strategy. Last-wins on duplicate names: if a strategy with the
   * same `name` was previously registered it is OVERWRITTEN. This is the
   * pragmatic choice — it keeps test setup simple (no explicit unregister
   * needed) and Phase 5 only registers each strategy once at audit start.
   *
   * No runtime name-whitelist here — the type system (VerifyStrategy.name:
   * VerifyStrategyName) is the ONLY allowlist. A v1.1 strategy whose name is
   * already in the locked 9-entry enum registers without engine change.
   * Adding a runtime MVP-only check would break the AC-06 forward-compat seam.
   */
  register(strategy: VerifyStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Dispatch verification: filter applicable candidates → sort priority DESC
   * → iterate first-success-wins. Logs per-attempt outcomes via child
   * loggers bound with `verify_strategy` (matches T-PHASE3-LOGGER convention).
   *
   * Unknown candidate names (not in registry) are silently dropped at the
   * .map().filter() boundary — this is intentional: a Phase 5 contract may
   * cite a v1.1 strategy name in a deployment that hasn't loaded that
   * strategy yet; falling through to other candidates is the correct
   * behaviour. Inapplicable strategies are equally skipped.
   */
  async verify(
    contract: ActionContract,
    session: BrowserSession,
  ): Promise<AggregatedVerifyResult> {
    const log = this.logger?.child({ action_id: contract.id });

    const candidates: VerifyStrategy[] = contract.candidateStrategies
      .map((name) => this.strategies.get(name as VerifyStrategyName))
      .filter((s): s is VerifyStrategy => s !== undefined && s.applicable(contract))
      .sort((a, b) => b.priority - a.priority);

    if (candidates.length === 0) {
      log?.debug('verify.no_applicable_strategy');
      return {
        ok: false,
        attemptedStrategies: [],
        failures: [],
        reason: 'no_applicable_strategy',
      };
    }

    const failures: VerifyResult[] = [];
    const attempted: VerifyStrategyName[] = [];

    for (const strategy of candidates) {
      const attemptLog = log?.child({ verify_strategy: strategy.name });
      attemptLog?.debug('verify.attempt');

      attempted.push(strategy.name);
      const result = await strategy.verify(contract, session);

      if (result.ok) {
        attemptLog?.debug('verify.attempt.ok');
        return {
          ok: true,
          strategy: strategy.name,
          evidence: result.evidence,
          failures,
        };
      }

      attemptLog?.debug({ error: result.error }, 'verify.attempt.fail');
      failures.push(result);
    }

    log?.debug({ attempted }, 'verify.all_failed');
    return {
      ok: false,
      attemptedStrategies: attempted,
      failures,
    };
  }
}

/**
 * Phase 4 T067 — SafetyCheck: 4-path runtime safety gate.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-02 (v0.4)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T067
 *     (REQ-SAFETY-CHECK-001)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/impact.md §SafetyCheck
 *   packages/agent-core/tests/conformance/safety-check.test.ts (AUTHORITATIVE)
 *
 * # Contract (AC-02 — 4 paths, 1:1 with SafetyClass)
 *
 *   await check.assertAllowed(toolName, domain, auditRun);
 *
 *   safe                   → pass-through (no event, no throw)
 *   requires_safety_check  → consult DomainPolicy + CircuitBreaker; throw on
 *                            policy=blocked OR breaker.isOpen; else pass
 *   requires_hitl          → recordEvent(hitl_requested) THEN throw
 *   forbidden              → throw immediately (no event)
 *
 * The `switch` is exhaustive over `SafetyClass` so adding a new class would
 * be a compile-time error (R11 ratchet preserved).
 *
 * # Why positional deps (not a deps object)?
 *
 * The Wave 1 conformance test (`safety-check.test.ts` L79) constructs
 * `new SafetyCheck(classifier, domainPolicy, breaker, recorder)` positionally.
 * The test is authoritative; we mirror its signature.
 *
 * # Why `domain` (not `url`)?
 *
 * Forwards verbatim to DomainPolicy + CircuitBreaker. DomainPolicy's real
 * implementation parses a URL, but on parse failure returns `'unknown'` — a
 * safe default. CircuitBreaker is domain-keyed natively. Test stubs mock
 * DomainPolicy.classify so URL-vs-host coupling is invisible at AC-02.
 *
 * # Why `page_url: null` on the hitl_requested event?
 *
 * AuditEventSchema requires `page_url` to be a valid URL or `null`. We only
 * have a bare `domain` at this seam, so `domain` + `tool_name` + `reason`
 * go into `metadata` and `page_url` is `null`. Schema permits this; future
 * callers with full URL in hand can extend at higher layers.
 *
 * # R14 Pino correlation
 *
 * Every branch emits one line bound to safety_class + domain + audit_run_id +
 * client_id + tool_name — all five pre-registered in LogBindings.
 *
 * R10.1 ≤ 200 LOC. R10.2 named exports only. R2 no `any`. R9: no vendor imports.
 */
import type { CircuitBreaker } from './CircuitBreaker.js';
import type { DomainPolicy } from './DomainPolicy.js';
import type { ActionClassifier } from './ActionClassifier.js';
import type { SessionRecorder } from '../observability/SessionRecorder.js';
import type { SafetyClass } from '../mcp/types.js';
import { createChildLogger, createLogger, type Logger } from '../observability/logger.js';

/**
 * Discriminator on `SafetyBlockedError.reason` — encodes which gate fired.
 * Order matches the 4-path switch below for grep-ability.
 */
export type SafetyBlockedReason =
  | 'forbidden'
  | 'hitl_requested'
  | 'domain_blocked'
  | 'circuit_open';

/**
 * Thrown when `assertAllowed` rejects an action. Preserves `Error` semantics
 * (name, message, stack); `cause` left unset because there's no upstream
 * exception — the reject IS the signal. Callers distinguish branches by
 * inspecting `.reason` (typed union), not by string-matching `.message`.
 */
export class SafetyBlockedError extends Error {
  readonly reason: SafetyBlockedReason;
  readonly toolName: string;
  readonly domain: string;

  constructor(
    reason: SafetyBlockedReason,
    toolName: string,
    domain: string,
    message?: string,
  ) {
    super(message ?? `safety_blocked: ${reason} (tool=${toolName} domain=${domain})`);
    this.name = 'SafetyBlockedError';
    this.reason = reason;
    this.toolName = toolName;
    this.domain = domain;
  }
}

/**
 * Audit-run identity passed alongside each assert call. UUIDs validated
 * upstream (orchestrator emits these from AuditState); SafetyCheck treats
 * them as opaque correlation strings (R9 — no validation duplication).
 */
export interface SafetyCheckAuditRun {
  readonly id: string;
  readonly client_id: string;
}

/**
 * 4-path safety gate wiring T066 (ActionClassifier) → T068 (DomainPolicy) →
 * T069 (CircuitBreaker) → T072 (SessionRecorder). Holds NO state of its own;
 * pure delegation per branch.
 */
export class SafetyCheck {
  readonly #classifier: ActionClassifier;
  readonly #domainPolicy: DomainPolicy;
  readonly #breaker: CircuitBreaker;
  readonly #recorder: SessionRecorder;
  readonly #logger: Logger;

  constructor(
    classifier: ActionClassifier,
    domainPolicy: DomainPolicy,
    breaker: CircuitBreaker,
    recorder: SessionRecorder,
    logger?: Logger,
  ) {
    this.#classifier = classifier;
    this.#domainPolicy = domainPolicy;
    this.#breaker = breaker;
    this.#recorder = recorder;
    this.#logger = logger ?? createLogger('safety-check');
  }

  /**
   * REQ-SAFETY-CHECK-001 — assert `toolName` is allowed against `domain` for
   * this audit run, OR throw `SafetyBlockedError`. See file header for the
   * 4-path table.
   */
  async assertAllowed(
    toolName: string,
    domain: string,
    auditRun: SafetyCheckAuditRun,
  ): Promise<void> {
    const safetyClass: SafetyClass = this.#classifier.classify(toolName);
    const log = createChildLogger(this.#logger, {
      safety_class: safetyClass,
      domain,
      audit_run_id: auditRun.id,
      client_id: auditRun.client_id,
      tool_name: toolName,
    });

    switch (safetyClass) {
      case 'safe':
        // Pass-through: no event, no log noise above debug.
        log.debug('safety_check_passed');
        return;

      case 'requires_safety_check': {
        const verdict = this.#domainPolicy.classify(domain);
        if (verdict === 'blocked') {
          log.warn('safety_check_blocked_by_domain_policy');
          throw new SafetyBlockedError('domain_blocked', toolName, domain);
        }
        if (this.#breaker.isOpen(domain)) {
          log.warn('safety_check_blocked_by_circuit_breaker');
          throw new SafetyBlockedError('circuit_open', toolName, domain);
        }
        log.debug({ domain_verdict: verdict }, 'safety_check_passed');
        return;
      }

      case 'requires_hitl':
        // R7.4 — write FIRST (durable signal), then throw (control-flow signal).
        await this.#recorder.recordEvent({
          audit_run_id: auditRun.id,
          client_id: auditRun.client_id,
          event_type: 'hitl_requested',
          page_url: null,
          metadata: { tool_name: toolName, domain, reason: 'requires_hitl' },
        });
        log.warn('safety_check_hitl_requested');
        throw new SafetyBlockedError('hitl_requested', toolName, domain);

      case 'forbidden':
        // No event emission — forbidden is a contract-level rejection, not
        // an audit-trail-worthy run-time signal. The thrown error propagates
        // to the orchestrator which logs the failure at the audit level.
        log.warn('safety_check_forbidden');
        throw new SafetyBlockedError('forbidden', toolName, domain);

      default: {
        // Exhaustiveness guard: if a new SafetyClass is added to the enum
        // without updating this switch, this branch becomes reachable and
        // tsc errors at compile time (assignment to `never`).
        const _exhaustive: never = safetyClass;
        throw new Error(`unreachable: unhandled SafetyClass ${String(_exhaustive)}`);
      }
    }
  }
}

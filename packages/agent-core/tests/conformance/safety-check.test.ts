/**
 * AC-02 — SafetyCheck conformance (Phase 4 T067).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-02
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T067
 *     (REQ-SAFETY-CHECK-001)
 *
 * AC-02 contract:
 *   - assertAllowed(toolName, domain, auditRun): Promise<void>
 *   - For 'safe': passes through (no throw)
 *   - For 'requires_safety_check': consults DomainPolicy + CircuitBreaker
 *   - For 'requires_hitl': writes audit_events row 'hitl_requested', throws SafetyBlockedError
 *   - For 'forbidden': throws SafetyBlockedError immediately
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). Module absent → import fails.
 *
 * Anchor: @AC-02 — 4-path runtime safety gate.
 */
import { describe, expect, it, vi } from 'vitest';

import { SafetyCheck, SafetyBlockedError } from '../../src/safety/SafetyCheck.js';
import type { SafetyClass } from '../../src/mcp/types.js';

interface ClassifierStub {
  classify(toolName: string): SafetyClass;
}

interface DomainPolicyStub {
  classify(url: string): 'trusted' | 'unknown' | 'blocked';
}

interface CircuitBreakerStub {
  isOpen(domain: string): boolean;
}

interface SessionRecorderStub {
  recordEvent(event: { kind: string; tool_name?: string; reason?: string }): Promise<void>;
}

interface AuditRunStub {
  id: string;
  client_id: string;
}

function makeStubs(opts: {
  safetyClass: SafetyClass;
  domainVerdict?: 'trusted' | 'unknown' | 'blocked';
  breakerOpen?: boolean;
}): {
  classifier: ClassifierStub;
  domainPolicy: DomainPolicyStub;
  breaker: CircuitBreakerStub;
  recorder: SessionRecorderStub;
  recordEventCalls: Array<{ kind: string; tool_name?: string; reason?: string }>;
} {
  const recordEventCalls: Array<{ kind: string; tool_name?: string; reason?: string }> = [];
  return {
    classifier: { classify: vi.fn(() => opts.safetyClass) },
    domainPolicy: { classify: vi.fn(() => opts.domainVerdict ?? 'unknown') },
    breaker: { isOpen: vi.fn(() => opts.breakerOpen ?? false) },
    recorder: {
      recordEvent: vi.fn(async (e) => {
        recordEventCalls.push(e);
      }),
    },
    recordEventCalls,
  };
}

const AUDIT_RUN: AuditRunStub = {
  id: '00000000-0000-4000-8000-000000000200',
  client_id: '00000000-0000-4000-8000-000000000201',
};

describe('SafetyCheck — AC-02 conformance (RED until T067)', () => {
  it('AC-02 safe: assertAllowed passes through without throw', async () => {
    const { classifier, domainPolicy, breaker, recorder } = makeStubs({ safetyClass: 'safe' });
    const check = new SafetyCheck(classifier, domainPolicy, breaker, recorder);
    await expect(check.assertAllowed('browser_get_state', 'example.com', AUDIT_RUN)).resolves.toBeUndefined();
  });

  it('AC-02 forbidden: assertAllowed throws SafetyBlockedError immediately', async () => {
    const { classifier, domainPolicy, breaker, recorder } = makeStubs({ safetyClass: 'forbidden' });
    const check = new SafetyCheck(classifier, domainPolicy, breaker, recorder);
    await expect(check.assertAllowed('forbidden_tool', 'example.com', AUDIT_RUN)).rejects.toThrow(SafetyBlockedError);
  });

  it('AC-02 requires_hitl: writes hitl_requested event AND throws SafetyBlockedError', async () => {
    const stubs = makeStubs({ safetyClass: 'requires_hitl' });
    const check = new SafetyCheck(stubs.classifier, stubs.domainPolicy, stubs.breaker, stubs.recorder);
    await expect(check.assertAllowed('agent_request_human', 'example.com', AUDIT_RUN)).rejects.toThrow(
      SafetyBlockedError,
    );
    expect(stubs.recordEventCalls.some((e) => e.kind === 'hitl_requested')).toBe(true);
  });

  it('AC-02 requires_safety_check: blocks when DomainPolicy === "blocked"', async () => {
    const stubs = makeStubs({ safetyClass: 'requires_safety_check', domainVerdict: 'blocked' });
    const check = new SafetyCheck(stubs.classifier, stubs.domainPolicy, stubs.breaker, stubs.recorder);
    await expect(check.assertAllowed('browser_navigate', 'blocked.example.com', AUDIT_RUN)).rejects.toThrow(
      SafetyBlockedError,
    );
  });

  it('AC-02 requires_safety_check: blocks when CircuitBreaker is open for the domain', async () => {
    const stubs = makeStubs({
      safetyClass: 'requires_safety_check',
      domainVerdict: 'trusted',
      breakerOpen: true,
    });
    const check = new SafetyCheck(stubs.classifier, stubs.domainPolicy, stubs.breaker, stubs.recorder);
    await expect(check.assertAllowed('browser_navigate', 'flaky.example.com', AUDIT_RUN)).rejects.toThrow(
      SafetyBlockedError,
    );
  });

  it('AC-02 requires_safety_check: passes through when policy=trusted AND breaker closed', async () => {
    const stubs = makeStubs({
      safetyClass: 'requires_safety_check',
      domainVerdict: 'trusted',
      breakerOpen: false,
    });
    const check = new SafetyCheck(stubs.classifier, stubs.domainPolicy, stubs.breaker, stubs.recorder);
    await expect(
      check.assertAllowed('browser_navigate', 'ok.example.com', AUDIT_RUN),
    ).resolves.toBeUndefined();
  });
});

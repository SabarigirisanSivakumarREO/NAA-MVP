/**
 * AC-03 — DomainPolicy conformance (Phase 4 T068).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-03
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T068
 *     (REQ-SAFETY-DOMAIN-POLICY-001)
 *
 * AC-03 contract:
 *   - DomainPolicy.classify(url): 'trusted' | 'unknown' | 'blocked'
 *   - Configurable via `domain_policy` config object passed to constructor.
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). Module absent → import fails.
 *
 * Anchor: @AC-03 — three-way domain classification.
 */
import { describe, expect, it } from 'vitest';

import { DomainPolicy } from '../../src/safety/DomainPolicy.js';

describe('DomainPolicy — AC-03 conformance (RED until T068)', () => {
  it('AC-03: trusted domain returns "trusted"', () => {
    const policy = new DomainPolicy({
      trusted: ['amazon.in', 'flipkart.com'],
      blocked: [],
    });
    expect(policy.classify('https://amazon.in/dp/foo')).toBe('trusted');
  });

  it('AC-03: blocked domain returns "blocked"', () => {
    const policy = new DomainPolicy({
      trusted: [],
      blocked: ['bad.example.com'],
    });
    expect(policy.classify('https://bad.example.com/page')).toBe('blocked');
  });

  it('AC-03: unconfigured domain returns "unknown"', () => {
    const policy = new DomainPolicy({ trusted: [], blocked: [] });
    expect(policy.classify('https://random.example.org/x')).toBe('unknown');
  });

  it('AC-03: classification is domain-based, not path-based', () => {
    const policy = new DomainPolicy({
      trusted: ['amazon.in'],
      blocked: [],
    });
    expect(policy.classify('https://amazon.in/')).toBe('trusted');
    expect(policy.classify('https://amazon.in/very/deep/path?q=1')).toBe('trusted');
  });

  it('AC-03: blocked takes precedence over trusted when domain in both lists', () => {
    const policy = new DomainPolicy({
      trusted: ['conflict.example.com'],
      blocked: ['conflict.example.com'],
    });
    expect(policy.classify('https://conflict.example.com/')).toBe('blocked');
  });
});

/**
 * AC-02 — VerifyStrategy interface + VerifyStrategyNames enum (Phase 3 T052).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-3-verification/spec.md AC-02 + R-02
 *   docs/specs/mvp/phases/phase-3-verification/tasks.md T052
 *     (REQ-VERIFY-002)
 *   docs/specs/mvp/phases/phase-3-verification/impact.md §VerifyStrategy
 *
 * AC-02 contract:
 *   - VerifyStrategyNames const array has EXACTLY 9 entries
 *   - 3 MVP names: url_change | element_appears | element_text
 *   - 6 v1.1 reserved names: network_request | no_error_banner | snapshot_diff
 *     | custom_js | no_captcha | no_bot_block
 *   - VerifyStrategy interface defines name / priority / applicable / verify
 *   - Forward-compat seam — v1.1 strategies register against existing names
 *     without enum changes.
 *
 * RED state — Phase 3 Wave 0 (T-PHASE3-TESTS). Module absent → import fails.
 *
 * Anchor: @AC-02 — closed 9-name enum + interface shape.
 */
import { describe, expect, it } from 'vitest';

import {
  VerifyStrategyNames,
  type ActionContract,
  type VerifyResult,
  type VerifyStrategy,
  type VerifyStrategyName,
} from '../../src/verification/types.js';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';

const MVP_NAMES = ['url_change', 'element_appears', 'element_text'] as const;
const V11_RESERVED_NAMES = [
  'network_request',
  'no_error_banner',
  'snapshot_diff',
  'custom_js',
  'no_captcha',
  'no_bot_block',
] as const;

describe('VerifyStrategy — AC-02 conformance (RED until T052)', () => {
  it('AC-02: VerifyStrategyNames contains exactly 9 entries', () => {
    expect(VerifyStrategyNames).toHaveLength(9);
  });

  it('AC-02: VerifyStrategyNames contains all 3 MVP strategy names', () => {
    for (const name of MVP_NAMES) {
      expect(VerifyStrategyNames).toContain(name);
    }
  });

  it('AC-02: VerifyStrategyNames contains all 6 v1.1 reserved strategy names', () => {
    for (const name of V11_RESERVED_NAMES) {
      expect(VerifyStrategyNames).toContain(name);
    }
  });

  it('AC-02: VerifyStrategyNames has no duplicate entries', () => {
    const unique = new Set<string>(VerifyStrategyNames);
    expect(unique.size).toBe(VerifyStrategyNames.length);
  });

  /**
   * @AC-02 — TYPE-LEVEL assertion: a stub class implementing VerifyStrategy
   * must compile cleanly. If the interface drifts (rename a field, change
   * a signature), this construction fails at type-check time.
   */
  it('AC-02: a stub class implementing VerifyStrategy compiles + has the required shape', () => {
    class StubStrategy implements VerifyStrategy {
      readonly name: VerifyStrategyName = 'url_change';
      readonly priority = 100;
      applicable(_contract: ActionContract): boolean {
        return true;
      }
      async verify(
        _contract: ActionContract,
        _session: BrowserSession,
      ): Promise<VerifyResult> {
        return { ok: true, strategy: 'url_change' };
      }
    }
    const stub = new StubStrategy();
    expect(stub.name).toBe('url_change');
    expect(stub.priority).toBe(100);
    expect(typeof stub.applicable).toBe('function');
    expect(typeof stub.verify).toBe('function');
  });

  it('AC-02: VerifyStrategyName type accepts each of the 9 names', () => {
    // Type-level — assignment compiles iff the literal is in the union.
    const allNames: readonly VerifyStrategyName[] = [
      ...MVP_NAMES,
      ...V11_RESERVED_NAMES,
    ];
    expect(allNames).toHaveLength(9);
  });
});

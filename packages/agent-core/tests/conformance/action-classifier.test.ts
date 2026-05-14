/**
 * AC-01 — ActionClassifier conformance (Phase 4 T066).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-01 (v0.4)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T066
 *     (REQ-SAFETY-CLASSIFIER-001)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/impact.md §ActionClassifier
 *
 * AC-01 contract:
 *   - ActionClassifier.classify(toolName) returns the SafetyClass enum value
 *     matching MCPToolRegistry's safetyClass for that tool name. Phase 2's
 *     registry is the source of truth — ActionClassifier is pure delegation.
 *
 * RED state — Phase 4 Wave 1 (T-PHASE4-TESTS). Module absent → import fails.
 *
 * Anchor: @AC-01 — pure-delegation classifier over Phase 2 ToolRegistry.
 */
import { describe, expect, it } from 'vitest';

// SUT (does not exist yet — T066 lands this in Wave 2). Import fails → RED.
import { ActionClassifier } from '../../src/safety/ActionClassifier.js';
import type { SafetyClass } from '../../src/mcp/types.js';

interface RegistryStub {
  getSafetyClass(name: string): SafetyClass;
}

function stubRegistry(map: Record<string, SafetyClass>): RegistryStub {
  return {
    getSafetyClass(name: string): SafetyClass {
      const v = map[name];
      if (v === undefined) throw new Error(`unregistered tool: ${name}`);
      return v;
    },
  };
}

describe('ActionClassifier — AC-01 conformance (RED until T066)', () => {
  it('AC-01: classify(toolName) delegates to registry.getSafetyClass(toolName)', () => {
    const registry = stubRegistry({ browser_get_state: 'safe' });
    const classifier = new ActionClassifier(registry);
    expect(classifier.classify('browser_get_state')).toBe('safe');
  });

  it('AC-01: classify returns "requires_hitl" when registry says so', () => {
    const registry = stubRegistry({ agent_request_human: 'requires_hitl' });
    const classifier = new ActionClassifier(registry);
    expect(classifier.classify('agent_request_human')).toBe('requires_hitl');
  });

  it('AC-01: classify covers all 4 SafetyClass enum values via the registry', () => {
    const registry = stubRegistry({
      a: 'safe',
      b: 'requires_safety_check',
      c: 'requires_hitl',
      d: 'forbidden',
    });
    const classifier = new ActionClassifier(registry);
    expect(classifier.classify('a')).toBe('safe');
    expect(classifier.classify('b')).toBe('requires_safety_check');
    expect(classifier.classify('c')).toBe('requires_hitl');
    expect(classifier.classify('d')).toBe('forbidden');
  });

  it('AC-01: classify propagates registry errors (no swallowing)', () => {
    const registry = stubRegistry({});
    const classifier = new ActionClassifier(registry);
    expect(() => classifier.classify('unknown_tool')).toThrow(/unregistered/i);
  });
});

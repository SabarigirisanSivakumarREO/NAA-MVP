/**
 * Phase 4 T066 — ActionClassifier: pure-delegation safety-class lookup.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/spec.md AC-01 (v0.4)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/tasks.md T066
 *     (REQ-SAFETY-CLASSIFIER-001)
 *   docs/specs/mvp/phases/phase-4-safety-infra-cost/impact.md §ActionClassifier
 *
 * # Contract (AC-01)
 *
 * `ActionClassifier.classify(toolName)` returns the `SafetyClass` enum value
 * that Phase 2's `ToolRegistry` reports for that tool name. The registry is
 * the single source of truth (R11) — this class adds zero classification
 * logic of its own. Errors from the registry (e.g. `UnknownToolNameError`
 * for unregistered tools) propagate unmodified so callers cannot accidentally
 * treat an unknown tool as `safe`.
 *
 * # Why a separate class?
 *
 * Phase 4's `SafetyCheck` consumes a stable, narrow port (just classify-by-
 * name) rather than the full `ToolRegistry` surface. Decoupling lets us
 * stub the safety pipeline in tests without standing up a real registry,
 * and lets future phases swap in alternate classification sources behind
 * the same `classify()` signature if needed (R11 ratchet preserved).
 *
 * R10.1: file ≤ 100 lines (tasks.md T066). R10.3: named exports only.
 */
import type { SafetyClass } from '../mcp/types.js';

/**
 * Structural port of the single `ToolRegistry` method this class needs.
 *
 * Typed structurally (not as the full `ToolRegistry` interface) so test
 * stubs and alternate sources can satisfy it without implementing
 * `register` / `list` / `get`. The Wave 1 conformance test
 * (`tests/conformance/action-classifier.test.ts`) supplies exactly such a
 * minimal stub.
 */
export interface ActionClassifierRegistry {
  getSafetyClass(name: string): SafetyClass;
}

/**
 * Pure-delegation classifier over a `ToolRegistry`-shaped port. No caching,
 * no fallbacks, no side effects — the registry's answer IS the answer.
 */
export class ActionClassifier {
  readonly #registry: ActionClassifierRegistry;

  constructor(registry: ActionClassifierRegistry) {
    this.#registry = registry;
  }

  /**
   * Return the `SafetyClass` for `toolName` per the underlying registry.
   *
   * Propagates registry errors verbatim (e.g. `UnknownToolNameError`) so
   * the caller sees the fail-fast signal Phase 2 designed in.
   */
  classify(toolName: string): SafetyClass {
    return this.#registry.getSafetyClass(toolName);
  }
}

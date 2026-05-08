/**
 * Vitest config for @neural/cli — mirror of packages/agent-core/vitest.config.ts
 * pattern. Wired in Phase 0b T0B-004 (deferred from Phase 0 T003 which set test
 * script to placeholder echo per "unit tests land in Phase 5+"; the T0B-004
 * conformance test forces wiring NOW because AC-04 requires
 * apps/cli/tests/conformance/heuristic-lint.test.ts to be a real Vitest test).
 *
 * Includes both unit and conformance tests under tests/ subtree.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
    environment: 'node',
  },
});

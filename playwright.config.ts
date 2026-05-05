import { defineConfig } from '@playwright/test';

/**
 * Playwright Test config for repo-level acceptance tests.
 *
 * Source: docs/specs/mvp/architecture.md §6.4 (testing tier),
 *         docs/specs/mvp/testing-strategy.md §9.6 (acceptance pattern).
 *
 * Phase 0 acceptance test (tests/acceptance/phase-0-setup.spec.ts) shells out
 * via child_process — no browser launch, no parallelism (docker compose state
 * is shared across tests).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
});

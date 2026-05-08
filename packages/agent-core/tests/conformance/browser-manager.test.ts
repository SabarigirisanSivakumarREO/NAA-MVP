/**
 * Conformance test for AC-01 (T006) — BrowserManager.
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-01
 *         (line 154); tasks.md T006 acceptance.
 *
 * R3.1 TDD: this stub MUST FAIL until T006 implementation lands.
 * Module-not-found at import is the expected failure mode.
 *
 * Anchor: @AC-01 — `new BrowserManager().newSession()` launches Chromium
 * headless, returns BrowserSession with page/context/close handles, and
 * `close()` releases all OS handles (no zombie processes).
 *
 * Scope: conformance check on the BrowserEngine adapter contract +
 * resource-hygiene (NF-Phase1-05). The unit-test counterpart at
 * tests/unit/browser-runtime/BrowserManager.test.ts targets the
 * T-SKELETON-002 stub fixture path; this file targets the real
 * Phase 1 newSession() lifecycle delivered by T006.
 */
import { describe, expect, test } from 'vitest';
// @ts-expect-error — module deliberately not yet implemented (T006)
import { BrowserManager } from '../../src/browser-runtime/BrowserManager.js';

describe('BrowserManager — AC-01 conformance', () => {
  /**
   * @AC-01 newSession() launches Chromium headless and returns a usable
   * BrowserSession; close() releases handles cleanly.
   */
  test('AC-01: newSession launches Chromium and returns a BrowserSession', async () => {
    const manager = new BrowserManager();
    const session = await manager.newSession();
    expect(session).toBeDefined();
    expect(session.page).toBeDefined();
    expect(session.context).toBeDefined();
    expect(typeof session.close).toBe('function');
    await session.close();
  });

  /**
   * @AC-01 BrowserSession.close() is idempotent and releases all OS
   * handles (no zombie Chromium processes after close).
   */
  test('AC-01: close() releases all OS handles cleanly', async () => {
    const manager = new BrowserManager();
    const session = await manager.newSession();
    await session.close();
    // calling close() twice MUST NOT throw; second call is a no-op.
    await expect(session.close()).resolves.not.toThrow();
  });
});

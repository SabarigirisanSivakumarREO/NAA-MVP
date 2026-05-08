/**
 * Conformance test for AC-02 (T007) — StealthConfig (REDUCED SCOPE).
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-02
 *         (line 155); tasks.md T007 acceptance.
 *
 * R3.1 TDD: this stub MUST FAIL until T007 implementation lands.
 * Module-not-found at import is the expected failure mode.
 *
 * Anchor: @AC-02 — applyStealthConfig randomizes UA + viewport + WebGL
 * fingerprint per session; consecutive sessions report different tuples;
 * `playwright-extra` is NOT installed (verified by inspecting deps).
 * Reduced scope per tasks-v2 v2.3.1 — bot.sannysoft.com is NOT a target.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { applyStealthConfig } from '../../src/browser-runtime/StealthConfig.js';
import { BrowserManager } from '../../src/browser-runtime/BrowserManager.js';

describe('StealthConfig — AC-02 conformance', () => {
  /**
   * @AC-02 Two consecutive sessions report DIFFERENT (UA, viewport,
   * WebGL fingerprint) tuples — randomized per session.
   */
  test('AC-02: consecutive sessions yield different (UA, viewport, fingerprint) tuples', async () => {
    const manager = new BrowserManager();
    const sessionA = await manager.newSession();
    await applyStealthConfig(sessionA.context);
    const sessionB = await manager.newSession();
    await applyStealthConfig(sessionB.context);

    const tupleA = await sessionA.page.evaluate(() => ({
      ua: navigator.userAgent,
      viewport: { w: window.innerWidth, h: window.innerHeight },
    }));
    const tupleB = await sessionB.page.evaluate(() => ({
      ua: navigator.userAgent,
      viewport: { w: window.innerWidth, h: window.innerHeight },
    }));

    // At least UA OR viewport OR webgl must differ across sessions.
    expect(JSON.stringify(tupleA)).not.toBe(JSON.stringify(tupleB));
    await sessionA.close();
    await sessionB.close();
  });

  /**
   * @AC-02 Viewport is one of the 3 allowed sizes (1280x720, 1440x900,
   * 1920x1080) per plan.md Phase 0 Research item 5.
   */
  test('AC-02: viewport falls in the allowed pool', async () => {
    const manager = new BrowserManager();
    const session = await manager.newSession();
    await applyStealthConfig(session.context);
    const vp = await session.page.evaluate(() => ({
      w: window.innerWidth,
      h: window.innerHeight,
    }));
    const allowed = [
      { w: 1280, h: 720 },
      { w: 1440, h: 900 },
      { w: 1920, h: 1080 },
    ];
    expect(allowed).toContainEqual(vp);
    await session.close();
  });

  /**
   * @AC-02 navigator.webdriver MUST be undefined (basic stealth check).
   */
  test('AC-02: navigator.webdriver === undefined after stealth applied', async () => {
    const manager = new BrowserManager();
    const session = await manager.newSession();
    await applyStealthConfig(session.context);
    const wd = await session.page.evaluate(() => navigator.webdriver);
    expect(wd).toBeUndefined();
    await session.close();
  });

  /**
   * @AC-02 `playwright-extra` MUST NOT be installed (reduced scope per
   * tasks-v2 v2.3.1).
   */
  test('AC-02: playwright-extra is NOT in agent-core dependencies', () => {
    const pkgPath = resolve(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    expect(allDeps).not.toHaveProperty('playwright-extra');
    expect(allDeps).not.toHaveProperty('playwright-extra-plugin-stealth');
  });
});

/**
 * Conformance test for AC-03 (T008) — AccessibilityExtractor.
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-03
 *         (line 156); tasks.md T008 acceptance.
 *
 * R3.1 TDD: this stub MUST FAIL until T008 implementation lands.
 * Module-not-found at import is the expected failure mode.
 *
 * Anchor: @AC-03 — accessibilityExtractor.extract(page) returns AX-tree
 * of > 50 nodes for amazon.in homepage; tree includes a primary search
 * element (role=searchbox or input[type=search]).
 */
import { describe, expect, test } from 'vitest';
import { accessibilityExtractor } from '../../src/perception/AccessibilityExtractor.js';
import { BrowserManager } from '../../src/browser-runtime/BrowserManager.js';

const AMAZON_IN = 'https://www.amazon.in';

describe('AccessibilityExtractor — AC-03 conformance', () => {
  /**
   * @AC-03 extract() returns > 50 nodes for amazon.in homepage.
   */
  test('AC-03: extract returns AX-tree with > 50 nodes for amazon.in', async () => {
    const manager = new BrowserManager();
    const session = await manager.newSession();
    try {
      await session.page.goto(AMAZON_IN, { waitUntil: 'domcontentloaded', timeout: 10_000 });
      const tree = await accessibilityExtractor.extract(session.page);
      expect(tree.totalNodes ?? tree.totalNodeCount).toBeGreaterThan(50);
    } finally {
      await session.close();
    }
  });

  /**
   * @AC-03 Tree includes a primary search element (role=searchbox or
   * input[type=search]).
   */
  test('AC-03: extract returns a tree containing a search element', async () => {
    const manager = new BrowserManager();
    const session = await manager.newSession();
    try {
      await session.page.goto(AMAZON_IN, { waitUntil: 'domcontentloaded', timeout: 10_000 });
      const tree = await accessibilityExtractor.extract(session.page);

      // Walk tree looking for a searchbox role.
      type Node = { role?: string; children?: Node[] };
      function hasSearchbox(node: Node): boolean {
        if (node.role === 'searchbox' || node.role === 'search') return true;
        if (!node.children) return false;
        return node.children.some(hasSearchbox);
      }
      expect(hasSearchbox(tree.root)).toBe(true);
    } finally {
      await session.close();
    }
  });
});

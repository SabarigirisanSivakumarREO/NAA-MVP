/**
 * Conformance test for AC-05 (T010) — SoftFilter.
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-05
 *         (line 158); tasks.md T010 acceptance.
 *
 * R3.1 TDD: this stub MUST FAIL until T010 implementation lands.
 * Module-not-found at import is the expected failure mode.
 *
 * Anchor: @AC-05 — softFilter.apply(tree) returns top 30 elements by
 * relevance; score uses MULTIPLICATIVE decay per R4.4 (NOT additive);
 * output is ordered descending by score; scores in (0, 1].
 */
import { describe, expect, test } from 'vitest';
import { softFilter } from '../../src/perception/SoftFilter.js';

interface AxNode {
  role: string;
  name?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  children?: AxNode[];
}

/** Build an AX-tree with > 30 elements so SoftFilter must rank/cap. */
function buildRichFixture(): { root: AxNode; totalNodes: number } {
  const box = { x: 100, y: 100, width: 200, height: 40 };
  const children: AxNode[] = [];
  for (let i = 0; i < 50; i++) {
    children.push({
      role: i % 3 === 0 ? 'button' : i % 3 === 1 ? 'link' : 'text',
      name: `el-${i}`,
      boundingBox: box,
    });
  }
  return { root: { role: 'WebArea', boundingBox: box, children }, totalNodes: 51 };
}

describe('SoftFilter — AC-05 conformance', () => {
  /**
   * @AC-05 Returns exactly top 30 elements (cap) when input has > 30.
   */
  test('AC-05: returns top 30 elements (cap)', () => {
    const tree = buildRichFixture();
    const result = softFilter.apply(tree);
    expect(result.top30).toHaveLength(30);
  });

  /**
   * @AC-05 Output is ordered descending by score.
   */
  test('AC-05: output ordered descending by score', () => {
    const tree = buildRichFixture();
    const result = softFilter.apply(tree);
    for (let i = 1; i < result.top30.length; i++) {
      const prev = result.top30[i - 1];
      const curr = result.top30[i];
      expect(prev?.score ?? 0).toBeGreaterThanOrEqual(curr?.score ?? 0);
    }
  });

  /**
   * @AC-05 All scores fall in (0, 1] — the multiplicative-decay bound.
   */
  test('AC-05: all scores in (0, 1] (multiplicative bound, R4.4)', () => {
    const tree = buildRichFixture();
    const result = softFilter.apply(tree);
    for (const el of result.top30) {
      expect(el.score).toBeGreaterThan(0);
      expect(el.score).toBeLessThanOrEqual(1);
    }
  });

  /**
   * @AC-05 SoftFilter source MUST NOT use additive decay (R4.4 — see
   * tasks.md T010 kill criterion). This is a defensive grep test that
   * runs against the SoftFilter source file once T010 lands.
   */
  test('AC-05: SoftFilter source uses no additive decay operators on score', async () => {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const srcPath = resolve(__dirname, '..', '..', 'src', 'perception', 'SoftFilter.ts');
    const src = await readFile(srcPath, 'utf8');
    // R4.4 violation patterns: `score -=`, `score +=`, `- 0.05` style on score.
    expect(src).not.toMatch(/\bscore\s*[-+]=/);
  });
});

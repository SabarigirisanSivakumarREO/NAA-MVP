/**
 * Conformance test for AC-04 (T009) — HardFilter.
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-04
 *         (line 157); tasks.md T009 acceptance.
 *
 * R3.1 TDD: this stub MUST FAIL until T009 implementation lands.
 * Module-not-found at import is the expected failure mode.
 *
 * Anchor: @AC-04 — hardFilter.apply(tree) prunes hidden / disabled /
 * aria-hidden / zero-dim nodes; > 50% reduction on typical pages
 * (amazon.in fixture); on degenerate pages (< 20 pre-filter nodes), the
 * floor is waived and `reductionFloorWaived: true` is returned.
 */
import { describe, expect, test } from 'vitest';
// @ts-expect-error — module deliberately not yet implemented (T009)
import { hardFilter } from '../../src/perception/HardFilter.js';

interface AxNode {
  role: string;
  hidden?: boolean;
  disabled?: boolean;
  ariaHidden?: boolean;
  boundingBox?: { x: number; y: number; width: number; height: number };
  children?: AxNode[];
}

/** Build a typical-page fixture with > 20 nodes, half marked invisible. */
function buildTypicalFixture(): { root: AxNode; totalNodes: number } {
  const visibleBox = { x: 0, y: 0, width: 100, height: 30 };
  const hiddenBox = { x: 0, y: 0, width: 0, height: 0 };
  const children: AxNode[] = [];
  for (let i = 0; i < 30; i++) {
    children.push(
      i % 2 === 0
        ? { role: 'link', boundingBox: visibleBox }
        : { role: 'link', hidden: true, boundingBox: hiddenBox },
    );
  }
  return { root: { role: 'WebArea', boundingBox: visibleBox, children }, totalNodes: 31 };
}

/** Build a degenerate fixture with < 20 pre-filter nodes. */
function buildDegenerateFixture(): { root: AxNode; totalNodes: number } {
  const visibleBox = { x: 0, y: 0, width: 100, height: 30 };
  const children: AxNode[] = [];
  for (let i = 0; i < 5; i++) {
    children.push({ role: 'link', boundingBox: visibleBox });
  }
  return { root: { role: 'WebArea', boundingBox: visibleBox, children }, totalNodes: 6 };
}

describe('HardFilter — AC-04 conformance', () => {
  /**
   * @AC-04 Typical-page fixture (≥ 20 nodes) sees > 50% reduction.
   */
  test('AC-04: typical page (>= 20 nodes) drops > 50% of nodes', () => {
    const tree = buildTypicalFixture();
    const result = hardFilter.apply(tree);
    expect(result.reductionPct).toBeGreaterThan(0.5);
    expect(result.reductionFloorWaived).toBe(false);
  });

  /**
   * @AC-04 Degenerate page (< 20 nodes) returns with floor waived.
   */
  test('AC-04: degenerate page (< 20 nodes) returns reductionFloorWaived: true', () => {
    const tree = buildDegenerateFixture();
    const result = hardFilter.apply(tree);
    expect(result.reductionFloorWaived).toBe(true);
    // No floor enforced on degenerate input — function MUST NOT throw.
    expect(result.tree).toBeDefined();
  });

  /**
   * @AC-04 Filter does NOT mutate input tree (pure function).
   */
  test('AC-04: apply does not mutate input tree', () => {
    const tree = buildTypicalFixture();
    const before = JSON.stringify(tree);
    hardFilter.apply(tree);
    const after = JSON.stringify(tree);
    expect(before).toBe(after);
  });

  /**
   * @AC-04 Hidden / disabled / aria-hidden / zero-dim nodes are pruned.
   */
  test('AC-04: prunes hidden/disabled/aria-hidden/zero-dim nodes', () => {
    const tree: { root: AxNode; totalNodes: number } = {
      root: {
        role: 'WebArea',
        children: [
          { role: 'a', hidden: true },
          { role: 'b', disabled: true },
          { role: 'c', ariaHidden: true },
          { role: 'd', boundingBox: { x: 0, y: 0, width: 0, height: 10 } },
          { role: 'e', boundingBox: { x: 0, y: 0, width: 100, height: 30 } },
        ],
      },
      totalNodes: 6,
    };
    const result = hardFilter.apply(tree);
    // Only the 'e' child + WebArea root should survive.
    const surviving = result.tree.root.children?.length ?? 0;
    expect(surviving).toBe(1);
  });
});

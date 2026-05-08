/**
 * HardFilter — Phase 1 T009.
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-04 + R-06;
 *         docs/specs/mvp/phases/phase-1-perception/plan.md
 *           §"Per-extractor design" item 2;
 *         docs/specs/mvp/phases/phase-1-perception/tasks.md T009.
 *
 * Pure function. Recursively prunes AccessibilityTree nodes where ANY of:
 *   - hidden === true
 *   - disabled === true
 *   - ariaHidden === true              (aria-hidden attribute carrier)
 *   - boundingBox.width === 0 || boundingBox.height === 0
 *
 * Drops the entire subtree when a node matches the predicate (no
 * orphan-promotion). Returns a NEW tree — input is never mutated.
 *
 * Degenerate-page floor (AC-04 v0.2): when pre-filter `totalNodes < 20`,
 * the > 50% reduction floor is waived. The filter still runs; the
 * `reductionFloorWaived: true` flag in the return payload signals
 * downstream diagnostics that no minimum reduction was enforced.
 *
 * R10 compliance:
 *   - File ≤ 150 lines (R10.1; spec target).
 *   - Functions ≤ 50 lines (R10.2).
 *   - Named export `hardFilter` (R10.3, R4.5 exact name).
 *   - No console.log; no logging (pure function — no side effects).
 *   - No `any` (R13).
 */
import type { AccessibilityNode, AccessibilityTree } from './types.js';

/** Pre-filter node count below which the > 50% reduction floor is waived. */
const DEGENERATE_NODE_FLOOR = 20;

/**
 * Loosely-typed AX node shape accepted at the boundary. The canonical
 * schema in `types.ts` does not define `ariaHidden` (T008 maps the
 * `[hidden]` attribute to `hidden`), but per AC-04 the predicate MUST
 * also drop nodes carrying `ariaHidden: true` so callers that pass
 * pre-validation fixtures or future Playwright shapes are covered.
 */
type FilterInputNode = AccessibilityNode & { ariaHidden?: boolean };

/** Returns true when the node should be dropped (subtree included). */
function shouldDrop(node: FilterInputNode): boolean {
  if (node.hidden === true) return true;
  if (node.disabled === true) return true;
  if (node.ariaHidden === true) return true;
  const bb = node.boundingBox;
  if (bb !== undefined && (bb.width === 0 || bb.height === 0)) return true;
  return false;
}

/**
 * Recursively counts every node in a subtree (inclusive of `node`).
 * Used to compute reductionPct on both the original and filtered trees.
 */
function countNodes(node: AccessibilityNode | undefined): number {
  if (!node) return 0;
  let n = 1;
  if (node.children) {
    for (const child of node.children) n += countNodes(child);
  }
  return n;
}

/**
 * Pure prune helper. Returns:
 *   - undefined when the node itself fails the predicate (drop subtree)
 *   - a NEW node with filtered children otherwise
 *
 * Never mutates the input.
 */
function prune(node: FilterInputNode | undefined): AccessibilityNode | undefined {
  if (!node) return undefined;
  if (shouldDrop(node)) return undefined;

  // Filter children recursively into a fresh array.
  let filteredChildren: AccessibilityNode[] | undefined;
  if (node.children) {
    const kept: AccessibilityNode[] = [];
    for (const child of node.children) {
      const pruned = prune(child as FilterInputNode);
      if (pruned !== undefined) kept.push(pruned);
    }
    filteredChildren = kept;
  }

  // Build a NEW node — copy known fields explicitly (no mutation, no aliasing).
  const next: AccessibilityNode = { role: node.role };
  if (node.name !== undefined) next.name = node.name;
  if (node.value !== undefined) next.value = node.value;
  if (node.description !== undefined) next.description = node.description;
  if (node.level !== undefined) next.level = node.level;
  if (node.expanded !== undefined) next.expanded = node.expanded;
  if (node.required !== undefined) next.required = node.required;
  if (node.selected !== undefined) next.selected = node.selected;
  if (node.hidden !== undefined) next.hidden = node.hidden;
  if (node.disabled !== undefined) next.disabled = node.disabled;
  if (node.focused !== undefined) next.focused = node.focused;
  if (node.boundingBox !== undefined) next.boundingBox = { ...node.boundingBox };
  if (filteredChildren !== undefined) next.children = filteredChildren;
  return next;
}

/** Synthetic empty root used when the tree's root is itself pruned. */
function emptyRoot(): AccessibilityNode {
  return { role: 'WebArea', children: [] };
}

/**
 * HardFilter singleton. Pure — no I/O, no logging, no mutation.
 *
 * `apply()` flow:
 *   1. Count pre-filter nodes (`pre`).
 *   2. Determine reductionFloorWaived = pre < 20.
 *   3. Prune root + subtree. If root drops, return synthetic empty root.
 *   4. Count post-filter nodes (`post`); compute reductionPct (clamped).
 *   5. Return new AccessibilityTree + diagnostics flags.
 */
export const hardFilter = {
  apply(tree: AccessibilityTree): {
    tree: AccessibilityTree;
    reductionPct: number;
    reductionFloorWaived: boolean;
  } {
    const pre = countNodes(tree.root);
    const reductionFloorWaived = pre < DEGENERATE_NODE_FLOOR;

    const prunedRoot = prune(tree.root as FilterInputNode);
    const nextRoot = prunedRoot ?? emptyRoot();
    const post = prunedRoot === undefined ? 0 : countNodes(prunedRoot);

    // Reduction as a percent (0-100). Clamped at pre=0 to avoid NaN.
    // Per task brief: `(pre - post) / pre * 100`.
    const reductionPct = pre === 0 ? 0 : ((pre - post) / pre) * 100;

    return {
      tree: { root: nextRoot, totalNodes: post },
      reductionPct,
      reductionFloorWaived,
    };
  },
};

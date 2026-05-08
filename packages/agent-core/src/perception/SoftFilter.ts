/**
 * SoftFilter — Phase 1 T010.
 *
 * Source: phase-1-perception/{spec.md AC-05 + R-07, plan.md §"Per-extractor
 *         design" item 3, tasks.md T010}.
 *
 * Pure function on a (HardFilter-pruned) AccessibilityTree. Produces
 * FilteredDOM = top 30 elements ordered descending by relevance score.
 *
 * Scoring (R4.4 — MULTIPLICATIVE DECAY, NON-NEGOTIABLE):
 *   score = baseRoleWeight × textWeight × positionWeight × visibilityWeight
 * All four weights ∈ (0, 1]; product ∈ (0, 1] (matches
 * FilteredElementSchema `z.number().gt(0).max(1)`).
 *
 * Additive math on the score (subtract-and-assign or add-and-assign
 * forms) is a kill-criterion R4.4 violation. The defensive grep test
 * (AC-05 conformance) enforces this.
 *
 * R10: file < 200 lines; apply() ≤ 50 lines; each weight ≤ 30 lines;
 * named export `softFilter` (R4.5); no console.log; no `any` (R13).
 */
import type {
  AccessibilityNode,
  AccessibilityTree,
  BoundingBox,
  FilteredDOM,
  FilteredElement,
} from './types.js';

/** Top-N cap per AC-05. */
const TOP_N = 30;

/** Above-the-fold threshold (≈ 720 px viewport). */
const ABOVE_FOLD_Y = 720;

/** Far-below-fold threshold; below this is "in the long tail". */
const FAR_BELOW_FOLD_Y = 1500;

/** Long-text threshold (a node with > 50 chars of accessible name is
 *  unlikely to be a CTA — likely paragraph copy). */
const LONG_TEXT_THRESHOLD = 50;

/** Role → base weight table. CTA-relevant roles score highest. All
 *  values ∈ (0, 1] so the multiplicative product cannot zero out.
 *  Source: tasks.md T010 outline; PRD §11 (interactive-element bias). */
const ROLE_WEIGHTS: Readonly<Record<string, number>> = {
  button: 1.0,
  link: 0.95,
  searchbox: 0.9,
  textbox: 0.9,
  input: 0.85,
  combobox: 0.8,
  menuitem: 0.7,
  heading: 0.6,
  img: 0.5,
  text: 0.4,
  generic: 0.4,
};

/** Default weight for unknown roles. Strictly > 0 to preserve (0, 1] bound. */
const DEFAULT_ROLE_WEIGHT = 0.3;

/** Internal carrier — flattened candidate paired with insertion order for
 *  stable tie-breaking during sort. */
interface Candidate {
  node: AccessibilityNode;
  /** Hierarchical path id (e.g. "0/2/1") — deterministic across runs. */
  ref: string;
  /** Insertion order — used as stable secondary sort key. */
  order: number;
}

// ----------------------------------------------------------------------
// Tree flattening
// ----------------------------------------------------------------------

/** Walks the filtered tree depth-first and emits one candidate per
 *  node (root included). Path-based `ref` strings are deterministic. */
function flatten(root: AccessibilityNode): Candidate[] {
  const out: Candidate[] = [];
  function walk(node: AccessibilityNode, path: string): void {
    out.push({ node, ref: path, order: out.length });
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child !== undefined) walk(child, `${path}/${i}`);
      }
    }
  }
  walk(root, '0');
  return out;
}

// ----------------------------------------------------------------------
// Weight functions (each ≤ 30 lines per T010 brief)
// ----------------------------------------------------------------------

/** baseRoleWeight ∈ (0, 1] — interactive-CTA roles score highest. */
function baseRoleWeight(node: AccessibilityNode): number {
  const w = ROLE_WEIGHTS[node.role] ?? DEFAULT_ROLE_WEIGHT;
  // Defensive clamp — table values must remain in (0, 1].
  return Math.min(Math.max(w, Number.EPSILON), 1);
}

/** textWeight ∈ (0, 1] — short labels (CTA-shaped) > paragraphs > empty. */
function textWeight(node: AccessibilityNode): number {
  const name = node.name;
  if (name === undefined || name.length === 0) return 0.5;
  if (name.length > LONG_TEXT_THRESHOLD) return 0.7;
  return 1.0;
}

/** positionWeight ∈ (0, 1] — above-fold scores higher than below. */
function positionWeight(node: AccessibilityNode): number {
  const bb = node.boundingBox;
  if (bb === undefined) return 0.7;
  if (bb.y < ABOVE_FOLD_Y) return 1.0;
  if (bb.y < FAR_BELOW_FOLD_Y) return 0.8;
  return 0.6;
}

/** visibilityWeight ∈ (0, 1] — sanity check; HardFilter already pruned
 *  hidden/disabled/zero-dim. Penalize contradictory flags slightly. */
function visibilityWeight(node: AccessibilityNode): number {
  // HardFilter would have dropped these; if they survive, treat as suspect.
  if (node.hidden === true || node.disabled === true) return 0.9;
  const bb = node.boundingBox;
  if (bb !== undefined && (bb.width === 0 || bb.height === 0)) return 0.9;
  return 1.0;
}

// ----------------------------------------------------------------------
// Score composition (multiplicative — R4.4)
// ----------------------------------------------------------------------

/** Multiplies the four weights into a single score in (0, 1]. The
 *  ONLY place score composition happens. NO additive math anywhere. */
function score(node: AccessibilityNode): number {
  const product =
    baseRoleWeight(node) *
    textWeight(node) *
    positionWeight(node) *
    visibilityWeight(node);
  // Final clamp — each weight is already in (0, 1], so product is too,
  // but guard against floating-point drift above 1.
  return Math.min(product, 1);
}

// ----------------------------------------------------------------------
// FilteredElement projection
// ----------------------------------------------------------------------

/** Project a candidate into the FilteredDOMSchema shape. Synthesizes a
 *  zero-dim box for nodes lacking one (degenerate post-HardFilter input). */
function toFilteredElement(c: Candidate, s: number): FilteredElement {
  const bb: BoundingBox = c.node.boundingBox ?? { x: 0, y: 0, width: 0, height: 0 };
  return {
    ref: c.ref,
    role: c.node.role,
    text: c.node.name ?? '',
    score: s,
    boundingBox: { x: bb.x, y: bb.y, width: bb.width, height: bb.height },
  };
}

// ----------------------------------------------------------------------
// SoftFilter singleton
// ----------------------------------------------------------------------

/**
 * SoftFilter singleton. Pure — no I/O, no logging, no mutation.
 *
 * apply() flow: flatten → score (multiplicative R4.4) → sort desc by
 * score (ties: insertion order asc, stable) → cap to TOP_N → project
 * each candidate to FilteredElement → return FilteredDOM.
 */
export const softFilter = {
  apply(tree: AccessibilityTree): FilteredDOM {
    const candidates = flatten(tree.root);

    // Pre-compute scores once per candidate (avoid recompute during sort).
    const scored: Array<{ candidate: Candidate; s: number }> = candidates.map(
      (candidate) => ({ candidate, s: score(candidate.node) }),
    );

    // Descending by score; stable secondary key = insertion order asc.
    scored.sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s;
      return a.candidate.order - b.candidate.order;
    });

    const capped = scored.slice(0, TOP_N);
    const top30 = capped.map(({ candidate, s }) => toFilteredElement(candidate, s));
    return { top30 };
  },
};

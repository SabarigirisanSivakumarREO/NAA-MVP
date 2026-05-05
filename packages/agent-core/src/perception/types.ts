/**
 * PageStateModel — canonical perception output Zod schemas.
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/{spec,plan,tasks,impact}.md
 *         (T014 + AC-09 + R-04 + REQ-BROWSE-PERCEPT-001).
 *
 * Why this lands week 1 (forward-pulled from Phase 1): walking-skeleton
 * T-SKELETON-002 needs a Zod-validated PageStateModel contract before any
 * stubbed browser capture can be tested. See implementation-roadmap.md §6
 * "Cross-week ordering note: T014 MUST land in week 1 alongside
 * T-SKELETON-002 for contract test feasibility."
 *
 * R20 contract surface — consumed by:
 *   - Phase 1 T013 ContextAssembler (real producer)
 *   - Phase 2 browser_get_state MCP tool (returns PageStateModel)
 *   - Phase 5 Browse MVP (composes across pages)
 *   - Phase 7 deep_perceive (merges with AnalyzePerception via _extensions seam)
 *
 * R10 compliance:
 *   - File ≤ 300 lines (R10.1) — currently ~270
 *   - Zero z.any() — every field typed explicitly (SC-005)
 *   - Named exports only (R10.3)
 *
 * Phase 1 invariant per spec.md Key Entities + tasks.md T014 brief:
 *   - All sub-schemas .strict()
 *   - PageStateModelSchema also .strict() but explicitly carries _extensions
 *     as the Phase 7+ namespaced-extension seam (forward-compatibility seam)
 *   - Phase 1 code MUST NOT populate _extensions; Phase 7 namespaces under
 *     _extensions.deepPerceive. Test file enforces.
 */
import { z } from 'zod';

// ----------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------

/**
 * AccessibilityNode recursion depth limit. Prevents infinite recursion on
 * aria-owns cycles during parse + bounds the tree size for the
 * shrink-ladder Stage 1 (depth 10 → 6).
 *
 * Source: tasks.md T014 constraints; plan.md design item 7.
 */
export const MAX_AX_TREE_DEPTH = 10;

/** Minimum depth (used by ContextAssembler shrink ladder Stage 1). */
export const MIN_AX_TREE_DEPTH = 6;

/** PageStateModel total token budget per NF-Phase1-01. */
export const PAGE_STATE_MODEL_TOKEN_BUDGET = 1500;

/** ScreenshotExtractor cap per NF-Phase1-04 (150 KB). */
export const SCREENSHOT_MAX_BYTES = 153_600;

/** ScreenshotExtractor max width per spec AC-07 + R-09. */
export const SCREENSHOT_MAX_WIDTH = 1280;

// ----------------------------------------------------------------------
// Primitive sub-schemas
// ----------------------------------------------------------------------

/** Element bounding box (px relative to viewport top-left). */
export const BoundingBoxSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number().min(0),
    height: z.number().min(0),
  })
  .strict();

export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

// ----------------------------------------------------------------------
// AccessibilityNode (recursive via z.lazy)
// ----------------------------------------------------------------------

/**
 * Accessibility tree node. Recursive — depth bounded at extraction time
 * via {@link checkAxTreeDepth} (NOT by Zod itself; z.lazy can't enforce).
 *
 * Field set follows Playwright's AccessibilityNode shape (subset that
 * Phase 1 extractors actually use). Strict — extra Playwright fields are
 * dropped at extraction boundary, NOT preserved through the schema.
 *
 * Why `field: T | undefined` instead of `field?: T`: tsconfig sets
 * `exactOptionalPropertyTypes: true`, which makes the two NOT equivalent.
 * Zod `.optional()` infers `T | undefined`; matching that explicitly here
 * keeps the manual type compatible with `z.ZodType<AccessibilityNode>`.
 */
export type AccessibilityNode = {
  role: string;
  name?: string | undefined;
  value?: string | undefined;
  description?: string | undefined;
  level?: number | undefined;
  expanded?: boolean | undefined;
  required?: boolean | undefined;
  selected?: boolean | undefined;
  hidden?: boolean | undefined;
  disabled?: boolean | undefined;
  focused?: boolean | undefined;
  boundingBox?: BoundingBox | undefined;
  children?: AccessibilityNode[] | undefined;
};

export const AccessibilityNodeSchema: z.ZodType<AccessibilityNode> = z.lazy(() =>
  z
    .object({
      role: z.string(),
      name: z.string().optional(),
      value: z.string().optional(),
      description: z.string().optional(),
      level: z.number().int().optional(),
      expanded: z.boolean().optional(),
      required: z.boolean().optional(),
      selected: z.boolean().optional(),
      hidden: z.boolean().optional(),
      disabled: z.boolean().optional(),
      focused: z.boolean().optional(),
      boundingBox: BoundingBoxSchema.optional(),
      children: z.array(AccessibilityNodeSchema).optional(),
    })
    .strict(),
);

/**
 * Walks an AccessibilityNode tree and returns true if any branch exceeds
 * `maxDepth`. Use BEFORE z.parse on untrusted input to prevent z.lazy
 * from recursing into a cyclic / malicious tree (stack overflow guard).
 *
 * Cycle detection: tracks visited node identity; a repeated reference is
 * treated as exceeding depth.
 */
export function checkAxTreeDepth(
  root: unknown,
  maxDepth: number = MAX_AX_TREE_DEPTH,
): { ok: true } | { ok: false; reason: 'depth-exceeded' | 'cycle-detected' } {
  const visited = new WeakSet<object>();
  function walk(node: unknown, depth: number): { ok: true } | { ok: false; reason: 'depth-exceeded' | 'cycle-detected' } {
    if (depth > maxDepth) return { ok: false, reason: 'depth-exceeded' };
    if (node === null || typeof node !== 'object') return { ok: true };
    if (visited.has(node)) return { ok: false, reason: 'cycle-detected' };
    visited.add(node);
    const children = (node as { children?: unknown }).children;
    if (Array.isArray(children)) {
      for (const child of children) {
        const r = walk(child, depth + 1);
        if (!r.ok) return r;
      }
    }
    return { ok: true };
  }
  return walk(root, 0);
}

// ----------------------------------------------------------------------
// AccessibilityTree (root + total node count)
// ----------------------------------------------------------------------

export const AccessibilityTreeSchema = z
  .object({
    root: AccessibilityNodeSchema,
    totalNodes: z.number().int().min(0),
  })
  .strict();

export type AccessibilityTree = z.infer<typeof AccessibilityTreeSchema>;

// ----------------------------------------------------------------------
// FilteredDOM (top-30 ranked elements from SoftFilter)
// ----------------------------------------------------------------------

/** A single ranked element produced by SoftFilter (T010). */
export const FilteredElementSchema = z
  .object({
    /** Selector or AX-tree ref string (extractor-defined). */
    ref: z.string(),
    role: z.string(),
    /** Visible text content (truncated by extractor if long). */
    text: z.string(),
    /** Multiplicative-decay relevance score in (0, 1] per R4.4. */
    score: z.number().gt(0).max(1),
    boundingBox: BoundingBoxSchema,
  })
  .strict();

export type FilteredElement = z.infer<typeof FilteredElementSchema>;

export const FilteredDOMSchema = z
  .object({
    /** Top-30 elements descending by score; capped at 30 (shrink Stage 2 → 20). */
    top30: z.array(FilteredElementSchema).max(30),
  })
  .strict();

export type FilteredDOM = z.infer<typeof FilteredDOMSchema>;

// ----------------------------------------------------------------------
// InteractiveGraph (clickable / typeable / submittable indices)
// ----------------------------------------------------------------------

export const InteractiveGraphSchema = z
  .object({
    clickable: z.array(z.string()),
    typeable: z.array(z.string()),
    submittable: z.array(z.string()),
  })
  .strict();

export type InteractiveGraph = z.infer<typeof InteractiveGraphSchema>;

// ----------------------------------------------------------------------
// Visual (optional screenshot reference)
// ----------------------------------------------------------------------

export const VisualSchema = z
  .object({
    format: z.literal('jpeg'),
    sizeBytes: z.number().int().min(0).max(SCREENSHOT_MAX_BYTES),
    width: z.number().int().min(0).max(SCREENSHOT_MAX_WIDTH),
    height: z.number().int().min(0),
    /** Storage URL (Phase 4 R2 or local filesystem path). */
    url: z.string().optional(),
    /** Inline base64 (dev-only; Phase 4 prefers url). */
    base64: z.string().optional(),
  })
  .strict();

export type Visual = z.infer<typeof VisualSchema>;

// ----------------------------------------------------------------------
// Diagnostics (per spec Key Entities — warnings + errors arrays + flags)
// ----------------------------------------------------------------------

export const DiagnosticsSchema = z
  .object({
    axNodeCount: z.number().int().min(0),
    mutationsObserved: z.number().int().min(0),
    stable: z.boolean(),
    lowAxNodeCount: z.boolean().default(false),
    unstable: z.boolean().default(false),
    /** Errors collected during capture (oversize-after-shrink, etc.). */
    errors: z.array(z.string()).default([]),
    /** Non-fatal warnings (shrunk-from-N-tokens, etc.). */
    warnings: z.array(z.string()).default([]),
  })
  .strict();

export type Diagnostics = z.infer<typeof DiagnosticsSchema>;

// ----------------------------------------------------------------------
// Metadata
// ----------------------------------------------------------------------

export const MetadataSchema = z
  .object({
    url: z.string().url(),
    title: z.string(),
    statusCode: z.number().int().min(100).max(599),
    /** ISO-8601 navigation start timestamp. */
    navigationStartedAt: z.string().datetime(),
    /** ISO-8601 navigation end timestamp. */
    navigationEndedAt: z.string().datetime(),
  })
  .strict();

export type Metadata = z.infer<typeof MetadataSchema>;

// ----------------------------------------------------------------------
// PageStateModel (top-level)
// ----------------------------------------------------------------------

/**
 * Canonical perception output. Strict by design — `_extensions` is the
 * ONLY namespaced-extension surface (Phase 7+ deep_perceive). Phase 1
 * code MUST NOT populate `_extensions` (enforced by unit test).
 */
export const PageStateModelSchema = z
  .object({
    metadata: MetadataSchema,
    accessibilityTree: AccessibilityTreeSchema,
    filteredDOM: FilteredDOMSchema,
    interactiveGraph: InteractiveGraphSchema,
    /** Optional — dropped during ContextAssembler shrink ladder Stage 3. */
    visual: VisualSchema.optional(),
    diagnostics: DiagnosticsSchema,
    /**
     * RESERVED for Phase 7+ deep_perceive composition. Phase 1 MUST NOT
     * populate this field. Phase 7 will namespace under
     * `_extensions.deepPerceive` per R20 forward-compatibility hygiene.
     */
    _extensions: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type PageStateModel = z.infer<typeof PageStateModelSchema>;

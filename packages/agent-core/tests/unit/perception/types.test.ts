/**
 * Unit tests for PageStateModel Zod schemas (T014 acceptance — AC-09).
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-09;
 *         tasks.md T014 acceptance criteria.
 *
 * These are forward-pulled to week 1 alongside the schema itself
 * (per implementation-roadmap.md §6 Cross-week ordering note) so the
 * walking-skeleton T-SKELETON-002 has a verified contract to target.
 * The full Phase 1 conformance suite (T-PHASE1-TESTS) will subsume +
 * extend these when Phase 1 implementation begins in week 2.
 */
import { describe, it, expect } from 'vitest';
import {
  PageStateModelSchema,
  AccessibilityNodeSchema,
  AccessibilityTreeSchema,
  MetadataSchema,
  DiagnosticsSchema,
  FilteredDOMSchema,
  VisualSchema,
  checkAxTreeDepth,
  MAX_AX_TREE_DEPTH,
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_MAX_WIDTH,
  type PageStateModel,
  type AccessibilityNode,
} from '../../../src/perception/types.js';

// ----------------------------------------------------------------------
// Fixtures
// ----------------------------------------------------------------------

const minimalAxRoot: AccessibilityNode = {
  role: 'WebArea',
  name: 'Example Domain',
  children: [
    { role: 'heading', name: 'Example Domain', level: 1 },
    {
      role: 'paragraph',
      children: [
        { role: 'text', name: 'This domain is for use in illustrative examples in documents.' },
      ],
    },
  ],
};

function makeMinimalPageStateModel(): PageStateModel {
  return {
    metadata: {
      url: 'https://example.com/',
      title: 'Example Domain',
      statusCode: 200,
      navigationStartedAt: '2026-05-05T12:00:00.000Z',
      navigationEndedAt: '2026-05-05T12:00:00.300Z',
    },
    accessibilityTree: {
      root: minimalAxRoot,
      totalNodes: 4,
    },
    filteredDOM: {
      top30: [
        {
          ref: 'h1',
          role: 'heading',
          text: 'Example Domain',
          score: 0.95,
          boundingBox: { x: 100, y: 50, width: 800, height: 40 },
        },
      ],
    },
    interactiveGraph: {
      clickable: ['a[href="https://www.iana.org/domains/example"]'],
      typeable: [],
      submittable: [],
    },
    diagnostics: {
      axNodeCount: 4,
      mutationsObserved: 0,
      stable: true,
      lowAxNodeCount: false,
      unstable: false,
      errors: [],
      warnings: [],
    },
  };
}

// ----------------------------------------------------------------------
// AC-09 — Schema parses fixture data without errors
// ----------------------------------------------------------------------

describe('PageStateModelSchema — AC-09 fixture validation', () => {
  it('parses a minimal example.com fixture cleanly', () => {
    const fixture = makeMinimalPageStateModel();
    const result = PageStateModelSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('rejects unknown top-level fields (.strict)', () => {
    const fixture = { ...makeMinimalPageStateModel(), unknownField: 'should-fail' };
    const result = PageStateModelSchema.safeParse(fixture);
    expect(result.success).toBe(false);
  });

  it('rejects unknown nested fields on Metadata (.strict on sub-schemas)', () => {
    const fixture = makeMinimalPageStateModel();
    (fixture.metadata as unknown as Record<string, unknown>).extra = 'should-fail';
    const result = MetadataSchema.safeParse(fixture.metadata);
    expect(result.success).toBe(false);
  });

  it('Diagnostics defaults warnings to empty array when omitted', () => {
    const result = DiagnosticsSchema.safeParse({
      axNodeCount: 0,
      mutationsObserved: 0,
      stable: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.warnings).toEqual([]);
      expect(result.data.errors).toEqual([]);
      expect(result.data.lowAxNodeCount).toBe(false);
      expect(result.data.unstable).toBe(false);
    }
  });

  it('FilteredDOM rejects scores outside (0, 1]', () => {
    const result = FilteredDOMSchema.safeParse({
      top30: [
        {
          ref: 'a',
          role: 'link',
          text: 'click',
          score: 0, // not in (0, 1] — strict bound
          boundingBox: { x: 0, y: 0, width: 10, height: 10 },
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('FilteredDOM caps top30 at 30 elements', () => {
    const tooMany = Array.from({ length: 31 }, (_, i) => ({
      ref: `el-${i}`,
      role: 'link',
      text: `link ${i}`,
      score: 0.5,
      boundingBox: { x: 0, y: 0, width: 10, height: 10 },
    }));
    const result = FilteredDOMSchema.safeParse({ top30: tooMany });
    expect(result.success).toBe(false);
  });

  it('Visual enforces SCREENSHOT_MAX_BYTES (≤ 150 KB)', () => {
    const result = VisualSchema.safeParse({
      format: 'jpeg',
      sizeBytes: SCREENSHOT_MAX_BYTES + 1,
      width: 1280,
      height: 720,
    });
    expect(result.success).toBe(false);
  });

  it('Visual enforces SCREENSHOT_MAX_WIDTH (≤ 1280 px)', () => {
    const result = VisualSchema.safeParse({
      format: 'jpeg',
      sizeBytes: 100_000,
      width: SCREENSHOT_MAX_WIDTH + 1,
      height: 720,
    });
    expect(result.success).toBe(false);
  });
});

// ----------------------------------------------------------------------
// AC-09 — _extensions seam reserved for Phase 7+
// ----------------------------------------------------------------------

describe('PageStateModelSchema — _extensions seam (Phase 7+ reservation)', () => {
  it('Phase 1 fixture has _extensions === undefined', () => {
    const fixture = makeMinimalPageStateModel();
    const parsed = PageStateModelSchema.parse(fixture);
    expect(parsed._extensions).toBeUndefined();
  });

  it('accepts a Phase 7-style namespaced extension (forward-compat verify)', () => {
    const fixture = {
      ...makeMinimalPageStateModel(),
      _extensions: {
        deepPerceive: {
          contextProfile: { archetype: 'D2C', pageType: 'PDP' },
        },
      },
    };
    const result = PageStateModelSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });
});

// ----------------------------------------------------------------------
// AC-09 — Recursive AccessibilityNode + depth/cycle guards
// ----------------------------------------------------------------------

describe('AccessibilityNode — recursion + depth limits', () => {
  it('parses a deeply nested tree within MAX_AX_TREE_DEPTH', () => {
    function nest(depth: number): AccessibilityNode {
      if (depth === 0) return { role: 'leaf' };
      return { role: `level-${depth}`, children: [nest(depth - 1)] };
    }
    const tree = nest(MAX_AX_TREE_DEPTH - 1);
    expect(AccessibilityNodeSchema.safeParse(tree).success).toBe(true);
    expect(checkAxTreeDepth(tree)).toEqual({ ok: true });
  });

  it('checkAxTreeDepth flags a tree deeper than maxDepth', () => {
    function nest(depth: number): AccessibilityNode {
      if (depth === 0) return { role: 'leaf' };
      return { role: `level-${depth}`, children: [nest(depth - 1)] };
    }
    const tooDeep = nest(MAX_AX_TREE_DEPTH + 5);
    const result = checkAxTreeDepth(tooDeep);
    expect(result).toEqual({ ok: false, reason: 'depth-exceeded' });
  });

  it('checkAxTreeDepth detects a cyclic tree (stack-overflow guard)', () => {
    type Cyclic = { role: string; children?: Cyclic[] };
    const cycle: Cyclic = { role: 'root' };
    cycle.children = [cycle]; // direct self-reference
    const result = checkAxTreeDepth(cycle);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Either cycle-detected OR depth-exceeded acceptable; both prove the
      // walker terminates without stack overflow.
      expect(['cycle-detected', 'depth-exceeded']).toContain(result.reason);
    }
  });

  it('AccessibilityTreeSchema parses a well-formed tree', () => {
    const tree = { root: minimalAxRoot, totalNodes: 4 };
    expect(AccessibilityTreeSchema.safeParse(tree).success).toBe(true);
  });
});

// ----------------------------------------------------------------------
// AC-09 — Inferred TS types satisfy type-system constraints
// ----------------------------------------------------------------------

describe('Inferred TypeScript types', () => {
  it('PageStateModel type is structurally complete (compile-time check)', () => {
    // This test passes if it compiles. Adding a deliberate type-narrowing
    // assertion catches accidental relaxations of the schema.
    const fixture: PageStateModel = makeMinimalPageStateModel();
    const _check: PageStateModel = fixture;
    expect(_check.metadata.url).toBe('https://example.com/');
  });
});

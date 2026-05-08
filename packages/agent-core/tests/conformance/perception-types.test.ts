/**
 * Conformance test for AC-09 (T014) — PageStateModel Zod schemas.
 *
 * Source: docs/specs/mvp/phases/phase-1-perception/spec.md AC-09
 *         (line 162); tasks.md T014 acceptance.
 *
 * SPECIAL NOTE: T014 is already DONE (forward-pulled to week 1 per
 * implementation-roadmap.md §6 — see commit 077ec86). The implementation
 * file `packages/agent-core/src/perception/types.ts` exists and exports
 * the full schema. Therefore THIS conformance test is the ONLY Phase 1
 * conformance test expected to PASS at the T-PHASE1-TESTS commit (R3.1
 * TDD exception documented in T-PHASE1-TESTS Brief context).
 *
 * The unit-test counterpart at tests/unit/perception/types.test.ts holds
 * the broader 15-test coverage (depth limits, cycle detection, inferred
 * types). This conformance file anchors the AC-09 contract specifically.
 *
 * Anchor: @AC-09 — perception/types.ts exports Zod schemas for
 * PageStateModel + Metadata + AccessibilityTree + FilteredDOM +
 * InteractiveGraph + Visual + Diagnostics; every schema validates
 * fixture data without z.any() or unchecked unions.
 */
import { describe, expect, test } from 'vitest';
import {
  PageStateModelSchema,
  AccessibilityNodeSchema,
  AccessibilityTreeSchema,
  MetadataSchema,
  DiagnosticsSchema,
  FilteredDOMSchema,
  VisualSchema,
  type PageStateModel,
} from '../../src/perception/types.js';

function makeMinimalPageStateModel(): PageStateModel {
  return {
    metadata: {
      url: 'https://example.com/',
      title: 'Example Domain',
      statusCode: 200,
      navigationStartedAt: '2026-05-08T00:00:00.000Z',
      navigationEndedAt: '2026-05-08T00:00:00.300Z',
    },
    accessibilityTree: {
      root: {
        role: 'WebArea',
        name: 'Example Domain',
        children: [{ role: 'heading', name: 'Example Domain', level: 1 }],
      },
      totalNodes: 2,
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
    interactiveGraph: { clickable: [], typeable: [], submittable: [] },
    diagnostics: {
      axNodeCount: 2,
      mutationsObserved: 0,
      stable: true,
      lowAxNodeCount: false,
      unstable: false,
      errors: [],
      warnings: [],
    },
  };
}

describe('PageStateModel Zod schemas — AC-09 conformance', () => {
  /**
   * @AC-09 All 7 expected schemas are exported by perception/types.ts.
   */
  test('AC-09: every required schema is exported', () => {
    expect(PageStateModelSchema).toBeDefined();
    expect(MetadataSchema).toBeDefined();
    expect(AccessibilityNodeSchema).toBeDefined();
    expect(AccessibilityTreeSchema).toBeDefined();
    expect(FilteredDOMSchema).toBeDefined();
    expect(VisualSchema).toBeDefined();
    expect(DiagnosticsSchema).toBeDefined();
  });

  /**
   * @AC-09 Schema validates a minimal example.com fixture cleanly.
   */
  test('AC-09: PageStateModelSchema validates fixture data', () => {
    const fixture = makeMinimalPageStateModel();
    const result = PageStateModelSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  /**
   * @AC-09 _extensions seam is reserved (Phase 1 must not populate;
   * Phase 7+ namespaces deepPerceive under _extensions).
   */
  test('AC-09: _extensions field is reserved for Phase 7+', () => {
    const fixture = makeMinimalPageStateModel();
    const parsed = PageStateModelSchema.parse(fixture);
    expect(parsed._extensions).toBeUndefined();
  });

  /**
   * @AC-09 Diagnostics defaults warnings + errors to empty arrays
   * (used by T013 shrink ladder).
   */
  test('AC-09: Diagnostics defaults warnings/errors to []', () => {
    const result = DiagnosticsSchema.safeParse({
      axNodeCount: 0,
      mutationsObserved: 0,
      stable: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.warnings).toEqual([]);
      expect(result.data.errors).toEqual([]);
    }
  });

  /**
   * @AC-09 perception/types.ts source MUST NOT use `z.any()` (escape
   * hatch forbidden by AC-09). Comment lines are excluded — JSDoc may
   * reference the rule by name without violating it.
   */
  test('AC-09: perception/types.ts source contains no z.any() in code', async () => {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const srcPath = resolve(__dirname, '..', '..', 'src', 'perception', 'types.ts');
    const src = await readFile(srcPath, 'utf8');
    // Strip line comments + block-comment lines; check remaining code.
    const codeOnly = src
      .split('\n')
      .filter((line) => {
        const trimmed = line.trimStart();
        return (
          !trimmed.startsWith('//') &&
          !trimmed.startsWith('*') &&
          !trimmed.startsWith('/*')
        );
      })
      .join('\n');
    expect(codeOnly).not.toMatch(/\bz\.any\s*\(/);
  });
});

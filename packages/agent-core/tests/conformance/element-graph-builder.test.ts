/**
 * AC-07 — ElementGraphBuilder conformance (REQ-ANALYZE-PERCEPTION-V25-001).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md AC-07 + R-07
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/plan.md §2.3 + §2.4
 *   docs/specs/mvp/phases/phase-1c-perception-bundle/tasks.md T1C-007
 *
 * R-07 (v0.2): ElementGraph keyed by stable element_id (sha256 of
 *   tag + sorted_classes + dom_position_path + text_content_prefix(50),
 *   sliced to 16 hex chars). HARDCODED cap of 30 elements per state for
 *   MVP (configurability deferred). On cap exceeded → ELEMENT_GRAPH_TRUNCATED
 *   warning with `truncated_count` field.
 *
 * R3.1 TDD (Wave 0 RED): import fails with "module not found" until
 *   T1C-007 lands.
 *
 * Anchor: @AC-07 — buildElementGraph(inputs) → ElementGraph
 *   { elements: Map<element_id, FusedElement>; root_element_ids: string[];
 *     truncated_count: number }.
 */
import { describe, expect, it } from 'vitest';

// @ts-expect-error - module not implemented yet (Wave 0 RED for T1C-007)
import {
  buildElementGraph,
  ELEMENT_GRAPH_CAP,
} from '../../src/perception/ElementGraphBuilder.js';

interface FusedElementLite {
  element_id: string;
  tag: string;
  selector: string;
  ax?: { role?: string; name?: string };
  ref_in_analyze_perception?: Record<string, number | string | undefined>;
  parent_id?: string | null;
}

interface ElementGraph {
  elements: Map<string, FusedElementLite>;
  root_element_ids: string[];
  truncated_count: number;
}

interface BuildInputs {
  doc: Document;
  ctasIndex?: Array<{ selector: string; text: string }>;
  ctxOrigin?: string;
}

function makeDocWithButtons(n: number): Document {
  const html = ['<html><body>'];
  for (let i = 0; i < n; i += 1) {
    html.push(`<button class="cta-${i}">Action ${i}</button>`);
  }
  html.push('</body></html>');
  return new DOMParser().parseFromString(html.join(''), 'text/html');
}

describe('ElementGraphBuilder — AC-07 conformance (Wave 0 RED)', () => {
  /**
   * @AC-07 — Hardcoded MVP cap of 30 per state (plan.md §2.4 v0.2;
   * configurability via AuditRequest.element_graph_size DEFERRED).
   */
  it('AC-07: ELEMENT_GRAPH_CAP pinned to 30 for MVP', () => {
    expect(ELEMENT_GRAPH_CAP).toBe(30);
  });

  /**
   * @AC-07 — small fixture: graph size ≤ DOM CTA count.
   */
  it('AC-07: 5-CTA fixture → graph has ≥1 and ≤30 elements', () => {
    const doc = makeDocWithButtons(5);
    const inputs: BuildInputs = { doc };
    const graph: ElementGraph = buildElementGraph(inputs);
    expect(graph.elements.size).toBeGreaterThanOrEqual(1);
    expect(graph.elements.size).toBeLessThanOrEqual(30);
    expect(graph.truncated_count).toBe(0);
  });

  /**
   * @AC-07 — over-cap fixture: graph truncates at 30 + truncated_count > 0.
   * Drives the ELEMENT_GRAPH_TRUNCATED warning path (R-09).
   */
  it('AC-07: 50-CTA fixture → graph truncates at 30 with truncated_count>0', () => {
    const doc = makeDocWithButtons(50);
    const inputs: BuildInputs = { doc };
    const graph: ElementGraph = buildElementGraph(inputs);
    expect(graph.elements.size).toBeLessThanOrEqual(30);
    expect(graph.truncated_count).toBeGreaterThan(0);
  });

  /**
   * @AC-07 — element_id stability across re-runs on identical DOM.
   * NF-04 stability guarantee.
   */
  it('AC-07: element_id stable across two builds of identical DOM', () => {
    const doc1 = makeDocWithButtons(5);
    const doc2 = makeDocWithButtons(5);
    const g1: ElementGraph = buildElementGraph({ doc: doc1 });
    const g2: ElementGraph = buildElementGraph({ doc: doc2 });
    const ids1 = [...g1.elements.keys()].sort();
    const ids2 = [...g2.elements.keys()].sort();
    expect(ids1).toEqual(ids2);
  });

  /**
   * @AC-07 — element_id is 16-char hex per plan.md §2.3.
   */
  it('AC-07: element_id matches /^[0-9a-f]{16}$/ format', () => {
    const doc = makeDocWithButtons(3);
    const graph: ElementGraph = buildElementGraph({ doc });
    for (const id of graph.elements.keys()) {
      expect(id).toMatch(/^[0-9a-f]{16}$/);
    }
  });
});

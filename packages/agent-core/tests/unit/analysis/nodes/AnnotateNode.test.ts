/**
 * Unit tests for AnnotateNode — T-SKELETON-007 acceptance.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.5 §6 T-SKELETON-007
 *         (acceptance: no-op passthrough; no screenshot annotation).
 *
 * Coverage:
 *   - Length: output length matches input length
 *   - Field preservation: every output GroundedFinding preserves ALL
 *     input fields verbatim (no field loss/mutation; no annotation
 *     fields added — week 1 is no-op)
 *   - Empty input → empty output (defensive)
 *   - Order preservation: passthrough preserves input order
 *   - Idempotence: deterministic per stub conventions
 *
 * Phase 7 T131 (week 9) supersedes with real Sharp severity-color
 * overlay. Test will then expand to assert annotated_screenshot_url
 * presence + Sharp output validity.
 */
import { describe, it, expect } from 'vitest';
import { AnnotateNode } from '../../../../src/analysis/nodes/AnnotateNode.js';
import { type GroundedFinding } from '../../../../src/audit/types.js';

const fixtureGroundedFindings: readonly GroundedFinding[] = [
  {
    id: 'test-finding-001',
    source: 'skeleton-stub',
    heuristic_id: 'SKELETON-CHECKOUT-001',
    page_url: 'https://example.test/page-a',
    observation: 'Test observation A.',
    verdict: 'KEEP',
  },
  {
    id: 'test-finding-002',
    source: 'skeleton-stub',
    heuristic_id: 'SKELETON-CONTENT-003',
    page_url: 'https://example.test/page-a',
    observation: 'Test observation B.',
    verdict: 'KEEP',
  },
];

describe('AnnotateNode (T-SKELETON-007 stub)', () => {
  it('run() returns array same length as input', async () => {
    const node = new AnnotateNode();
    const result = await node.run(fixtureGroundedFindings);

    expect(result).toHaveLength(fixtureGroundedFindings.length);
  });

  it('every output preserves ALL GroundedFinding fields verbatim (no annotation added in week-1 stub)', async () => {
    const node = new AnnotateNode();
    const result = await node.run(fixtureGroundedFindings);

    for (let i = 0; i < fixtureGroundedFindings.length; i++) {
      const input = fixtureGroundedFindings[i];
      const output = result[i];
      expect(input).toBeDefined();
      expect(output).toBeDefined();
      if (input === undefined || output === undefined) continue;

      expect(output.id).toBe(input.id);
      expect(output.source).toBe(input.source);
      expect(output.heuristic_id).toBe(input.heuristic_id);
      expect(output.page_url).toBe(input.page_url);
      expect(output.observation).toBe(input.observation);
      expect(output.verdict).toBe(input.verdict);
    }
  });

  it('empty input array returns empty output array (defensive)', async () => {
    const node = new AnnotateNode();
    const result = await node.run([]);

    expect(result).toHaveLength(0);
  });

  it('passthrough preserves input order', async () => {
    const node = new AnnotateNode();
    const result = await node.run(fixtureGroundedFindings);
    const inputIds = fixtureGroundedFindings.map((f) => f.id);
    const outputIds = result.map((f) => f.id);

    expect(outputIds).toEqual(inputIds);
  });

  it('run() is deterministic — two consecutive calls return structurally identical findings', async () => {
    const node = new AnnotateNode();
    const a = await node.run(fixtureGroundedFindings);
    const b = await node.run(fixtureGroundedFindings);

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

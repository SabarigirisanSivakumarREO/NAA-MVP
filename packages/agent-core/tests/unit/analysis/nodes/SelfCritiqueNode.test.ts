/**
 * Unit tests for SelfCritiqueNode — T-SKELETON-005 acceptance.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.5 §6 T-SKELETON-005
 *         (acceptance: returns input passthrough with verdict='KEEP' on
 *         every finding).
 *
 * Coverage:
 *   - Length: output length matches input length
 *   - Verdict tag: every output CritiqueFinding has verdict='KEEP'
 *   - Field preservation: every output CritiqueFinding preserves ALL
 *     RawFinding fields verbatim (no field loss/mutation)
 *   - Empty input → empty output (defensive)
 *   - Idempotence: deterministic per stub conventions
 *   - Order preservation: passthrough preserves input order
 *
 * Phase 7 T121 (week 6) supersedes with real SEPARATE LLM call per R5.6.
 * Test will then expand to assert verdict distribution (KEEP / REVISE /
 * DOWNGRADE / REJECT) + R5.6 first-runtime conformance.
 */
import { describe, it, expect } from 'vitest';
import { SelfCritiqueNode } from '../../../../src/analysis/nodes/SelfCritiqueNode.js';
import { type RawFinding } from '../../../../src/audit/types.js';

const fixtureFindings: readonly RawFinding[] = [
  {
    id: 'test-finding-001',
    source: 'skeleton-stub',
    heuristic_id: 'SKELETON-CHECKOUT-001',
    page_url: 'https://example.test/page-a',
    observation: 'Test observation A — purely structural; no banned phrasing.',
  },
  {
    id: 'test-finding-002',
    source: 'skeleton-stub',
    heuristic_id: 'SKELETON-CONTENT-003',
    page_url: 'https://example.test/page-a',
    observation: 'Test observation B — purely structural; no banned phrasing.',
  },
];

describe('SelfCritiqueNode (T-SKELETON-005 stub)', () => {
  it('run() returns array same length as input', async () => {
    const node = new SelfCritiqueNode();
    const result = await node.run(fixtureFindings);

    expect(result).toHaveLength(fixtureFindings.length);
  });

  it('every output CritiqueFinding has verdict="KEEP" (week-1 stub passthrough)', async () => {
    const node = new SelfCritiqueNode();
    const result = await node.run(fixtureFindings);

    for (const finding of result) {
      expect(finding.verdict).toBe('KEEP');
    }
  });

  it('every output preserves ALL RawFinding fields verbatim (no field loss/mutation)', async () => {
    const node = new SelfCritiqueNode();
    const result = await node.run(fixtureFindings);

    for (let i = 0; i < fixtureFindings.length; i++) {
      const input = fixtureFindings[i];
      const output = result[i];
      expect(input).toBeDefined();
      expect(output).toBeDefined();
      if (input === undefined || output === undefined) continue;

      expect(output.id).toBe(input.id);
      expect(output.source).toBe(input.source);
      expect(output.heuristic_id).toBe(input.heuristic_id);
      expect(output.page_url).toBe(input.page_url);
      expect(output.observation).toBe(input.observation);
    }
  });

  it('empty input array returns empty output array (defensive)', async () => {
    const node = new SelfCritiqueNode();
    const result = await node.run([]);

    expect(result).toHaveLength(0);
  });

  it('passthrough preserves input order', async () => {
    const node = new SelfCritiqueNode();
    const result = await node.run(fixtureFindings);
    const inputIds = fixtureFindings.map((f) => f.id);
    const outputIds = result.map((f) => f.id);

    expect(outputIds).toEqual(inputIds);
  });

  it('run() is deterministic — two consecutive calls return structurally identical findings', async () => {
    const node = new SelfCritiqueNode();
    const a = await node.run(fixtureFindings);
    const b = await node.run(fixtureFindings);

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

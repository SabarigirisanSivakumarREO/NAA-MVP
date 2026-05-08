/**
 * Unit tests for EvidenceGrounder — T-SKELETON-006 acceptance.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.5 §6 T-SKELETON-006
 *         (acceptance: returns input passthrough — all critiqued findings
 *         → grounded; rejected[] empty).
 *
 * Coverage:
 *   - Shape: returns { grounded, rejected }
 *   - grounded length matches input length (week-1 passthrough = 100% grounded)
 *   - rejected array is empty (week-1 stub — no rejections)
 *   - Field preservation: every grounded finding preserves ALL
 *     CritiqueFinding fields verbatim (no field loss/mutation)
 *   - Empty input → { grounded: [], rejected: [] } (defensive)
 *   - Idempotence: deterministic per stub conventions
 *
 * Phase 7 T122-T130 (week 7 ★ second critical risk gate ★) supersedes
 * with 9 grounding rules: GR-001 element-exists, GR-002 element-rendered,
 * GR-003 element-interactive, GR-004 element-visible, GR-005 element-
 * content, GR-006 element-position, GR-007 banned-phrase (canonical
 * pack), GR-008 element-uniqueness, GR-012 benchmark-validation. Tests
 * here will then expand to assert rejection patterns + rejected[] entries
 * with ruleId + reason per Phase 7 plan.
 */
import { describe, it, expect } from 'vitest';
import { EvidenceGrounder } from '../../../../src/analysis/grounding/EvidenceGrounder.js';
import { type CritiqueFinding } from '../../../../src/audit/types.js';

const fixtureCritiquedFindings: readonly CritiqueFinding[] = [
  {
    id: 'test-finding-001',
    source: 'skeleton-stub',
    heuristic_id: 'SKELETON-CHECKOUT-001',
    page_url: 'https://example.test/page-a',
    observation: 'Test observation A — purely structural; no banned phrasing.',
    verdict: 'KEEP',
  },
  {
    id: 'test-finding-002',
    source: 'skeleton-stub',
    heuristic_id: 'SKELETON-CONTENT-003',
    page_url: 'https://example.test/page-a',
    observation: 'Test observation B — purely structural; no banned phrasing.',
    verdict: 'KEEP',
  },
];

describe('EvidenceGrounder (T-SKELETON-006 stub)', () => {
  it('ground() returns { grounded, rejected } envelope shape', async () => {
    const grounder = new EvidenceGrounder();
    const result = await grounder.ground(fixtureCritiquedFindings);

    expect(result).toHaveProperty('grounded');
    expect(result).toHaveProperty('rejected');
    expect(Array.isArray(result.grounded)).toBe(true);
    expect(Array.isArray(result.rejected)).toBe(true);
  });

  it('grounded length matches input length (week-1 passthrough = 100% grounded)', async () => {
    const grounder = new EvidenceGrounder();
    const result = await grounder.ground(fixtureCritiquedFindings);

    expect(result.grounded).toHaveLength(fixtureCritiquedFindings.length);
  });

  it('rejected array is empty (week-1 stub — no rejections)', async () => {
    const grounder = new EvidenceGrounder();
    const result = await grounder.ground(fixtureCritiquedFindings);

    expect(result.rejected).toHaveLength(0);
  });

  it('every grounded finding preserves ALL CritiqueFinding fields verbatim', async () => {
    const grounder = new EvidenceGrounder();
    const result = await grounder.ground(fixtureCritiquedFindings);

    for (let i = 0; i < fixtureCritiquedFindings.length; i++) {
      const input = fixtureCritiquedFindings[i];
      const output = result.grounded[i];
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

  it('empty input → { grounded: [], rejected: [] } (defensive)', async () => {
    const grounder = new EvidenceGrounder();
    const result = await grounder.ground([]);

    expect(result.grounded).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });

  it('ground() is deterministic — two consecutive calls return structurally identical results', async () => {
    const grounder = new EvidenceGrounder();
    const a = await grounder.ground(fixtureCritiquedFindings);
    const b = await grounder.ground(fixtureCritiquedFindings);

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

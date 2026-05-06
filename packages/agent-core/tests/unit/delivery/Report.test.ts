/**
 * Unit tests for Report — T-SKELETON-009 acceptance.
 *
 * Source: docs/specs/mvp/implementation-roadmap.md v0.7 §6 T-SKELETON-009
 *         (acceptance: returns plain-text report; written to
 *         `./out/<slug>-audit.txt` by orchestrator).
 *
 * Coverage:
 *   - Header format: `Neural Audit — <id>` + URL + Duration + Findings counts
 *   - Per-finding format: `- [<heuristic_id>] (<verdict>) <observation>`
 *   - Field interpolation: auditRunId / url / durationMs all appear
 *     verbatim in output
 *   - Empty findings array: header lines only, no per-finding lines
 *   - Order preservation: findings appear in input order
 *   - Idempotence: deterministic per stub conventions
 *
 * Phase 9 T245-T249 (week 10) supersedes with HTML template + Playwright
 * page.pdf() + 8 sections per F-018 (Cover / Executive Summary / Action
 * Plan / Findings by Category / Cross-Page Patterns / Methodology /
 * Appendix / Reproducibility Note). PDF size ≤5MB; render <30s.
 * R6 channels 3+4 first runtime activation (Hono API + Next.js render).
 */
import { describe, it, expect } from 'vitest';
import { Report } from '../../../src/delivery/Report.js';
import { type GroundedFinding } from '../../../src/audit/types.js';

const fixtureFindings: readonly GroundedFinding[] = [
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

const fixtureInput = {
  url: 'https://www.peregrineclothing.co.uk/test-fixture',
  auditRunId: 'skl-test-12345',
  findings: fixtureFindings,
  rejectedCount: 0,
  durationMs: 42,
};

describe('Report (T-SKELETON-009 stub)', () => {
  it('renders header lines (Neural Audit / URL / Duration / Findings counts)', async () => {
    const report = new Report();
    const text = await report.render(fixtureInput);

    expect(text).toContain(`Neural Audit — ${fixtureInput.auditRunId}`);
    expect(text).toContain(`URL: ${fixtureInput.url}`);
    expect(text).toContain(`Duration: ${fixtureInput.durationMs}ms`);
    expect(text).toContain(`Findings: ${fixtureFindings.length} grounded; ${fixtureInput.rejectedCount} rejected`);
  });

  it('renders each finding with `- [<heuristic_id>] (<verdict>) <observation>` format', async () => {
    const report = new Report();
    const text = await report.render(fixtureInput);

    for (const finding of fixtureFindings) {
      expect(text).toContain(`- [${finding.heuristic_id}] (${finding.verdict}) ${finding.observation}`);
    }
  });

  it('header lines appear in stable order (auditRunId / URL / Duration / Findings)', async () => {
    const report = new Report();
    const text = await report.render(fixtureInput);
    const lines = text.split('\n');

    expect(lines[0]).toMatch(/^Neural Audit — /);
    expect(lines[1]).toMatch(/^URL: /);
    expect(lines[2]).toMatch(/^Duration: /);
    expect(lines[3]).toMatch(/^Findings: /);
  });

  it('empty findings array → header lines only (no per-finding lines)', async () => {
    const report = new Report();
    const text = await report.render({ ...fixtureInput, findings: [], rejectedCount: 0 });

    // Should not contain any "- [" finding lines
    expect(text).not.toMatch(/^- \[/m);
    // Header should still be present + reflect 0 findings
    expect(text).toContain('Findings: 0 grounded; 0 rejected');
  });

  it('preserves finding order in render output', async () => {
    const report = new Report();
    const text = await report.render(fixtureInput);
    const indexOfFirst = text.indexOf('SKELETON-CHECKOUT-001');
    const indexOfSecond = text.indexOf('SKELETON-CONTENT-003');

    expect(indexOfFirst).toBeGreaterThan(-1);
    expect(indexOfSecond).toBeGreaterThan(-1);
    expect(indexOfFirst).toBeLessThan(indexOfSecond);
  });

  it('render() is deterministic — two consecutive calls return identical strings', async () => {
    const report = new Report();
    const a = await report.render(fixtureInput);
    const b = await report.render(fixtureInput);

    expect(a).toBe(b);
  });
});

// REQ-ANALYZE-CONF-001 — assignConfidenceTier conformance (AC-03).
// Spec: docs/specs/final-architecture/07-analyze-mode.md §7.7.

import { describe, expect, it } from 'vitest';
import {
  assignConfidenceTier,
  type EvidenceType,
  type ReliabilityTier,
} from '../../src/analysis/utils/assignTier.js';
import type { ConfidenceTier } from '../../src/orchestration/AnalysisState.js';

describe('assignConfidenceTier (AC-03, REQ-ANALYZE-CONF-001)', () => {
  const cases: Array<[ReliabilityTier, EvidenceType, ConfidenceTier]> = [
    [1, 'measurable', 'high'],
    [1, 'observable', 'medium'],
    [1, 'subjective', 'low'],
    [2, 'measurable', 'medium'],
    [2, 'observable', 'medium'],
    [2, 'subjective', 'low'],
    [3, 'measurable', 'low'],
    [3, 'observable', 'low'],
    [3, 'subjective', 'low'],
  ];

  for (const [reliability_tier, evidenceType, expected] of cases) {
    it(`tier ${reliability_tier} + ${evidenceType} -> ${expected}`, () => {
      expect(assignConfidenceTier({ reliability_tier, evidenceType })).toBe(expected);
    });
  }

  it('sanity: Tier 1 + measurable returns high', () => {
    expect(
      assignConfidenceTier({ reliability_tier: 1, evidenceType: 'measurable' }),
    ).toBe('high');
  });
});

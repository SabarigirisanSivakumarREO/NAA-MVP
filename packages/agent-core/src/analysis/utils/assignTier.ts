// REQ-ANALYZE-CONF-001 — confidence tier assignment (AC-03).
// Spec: docs/specs/final-architecture/07-analyze-mode.md §7.7 (lines 814-836).
// Pure function; deterministic 3x3 lookup over (reliability_tier, evidenceType).

import { ConfidenceTier } from '../../orchestration/AnalysisState.js';

export type ReliabilityTier = 1 | 2 | 3;
export type EvidenceType = 'measurable' | 'observable' | 'subjective';

export interface AssignTierInput {
  reliability_tier: ReliabilityTier;
  evidenceType: EvidenceType;
}

const TIER_TABLE: Record<ReliabilityTier, Record<EvidenceType, ConfidenceTier>> = {
  1: { measurable: 'high', observable: 'medium', subjective: 'low' },
  2: { measurable: 'medium', observable: 'medium', subjective: 'low' },
  3: { measurable: 'low', observable: 'low', subjective: 'low' },
};

export function assignConfidenceTier(input: AssignTierInput): ConfidenceTier {
  return TIER_TABLE[input.reliability_tier][input.evidenceType];
}

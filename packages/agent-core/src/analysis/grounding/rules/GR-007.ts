/**
 * GR-007 — no conversion predictions (AC-16, R5.3).
 *
 * Constitution R5.3 absolute ban: NO conversion-rate predictions, revenue
 * impact, percentage uplifts, ROI claims. Deterministic regex scan over
 * observation + assessment + recommendation. If any banned pattern matches,
 * the finding is rejected outright — no retry, no soft warning.
 */
import { type GroundingRule, PASS, fail } from './types.js';

/**
 * Banned phrase regex pack. Each pattern targets a specific predictive
 * idiom that violates R5.3. Order is not significant (any match → fail).
 */
const BANNED_PATTERNS: ReadonlyArray<{ readonly id: string; readonly re: RegExp }> = [
  { id: 'pct_lift', re: /\b(?:increase|boost|lift|improve|raise)\s+(?:by\s+)?\d+(?:\.\d+)?\s*%/i },
  { id: 'conversion_predict', re: /\b(?:increase|improve|boost|drive|raise|lift)\s+(?:the\s+)?conversion(?:s|\s+rate)?\b/i },
  { id: 'revenue_predict', re: /\b(?:increase|boost|drive|raise|lift|grow)\s+(?:the\s+)?(?:revenue|sales|aov|ltv)\b/i },
  { id: 'roi_claim', re: /\broi\s+of\s+\d/i },
  { id: 'uplift_noun', re: /\b\d+(?:\.\d+)?\s*%\s*(?:uplift|lift)\b/i },
  { id: 'uplift_bare', re: /\buplift\b/i },
  { id: 'drive_sales', re: /\bdrive\s+(?:more\s+)?sales\b/i },
  // Probabilistic bypass patterns (Stage 2.5 review act-007):
  { id: 'expected_conversion', re: /\b(?:expected|likely|probable|projected|anticipated)\s+(?:to\s+)?(?:increase|boost|drive|lift|improve)\s+(?:the\s+)?(?:conversion|revenue|sales|aov|ltv)/i },
  { id: 'expected_pct', re: /\b(?:expected|likely|probable|projected|anticipated)\s+(?:to\s+)?(?:increase|boost|lift|improve)\s+(?:by\s+)?\d+(?:\.\d+)?\s*%/i },
  { id: 'chance_of_lift', re: /\b\d+(?:\.\d+)?\s*%\s+(?:chance|probability|likelihood)\b/i },
];

export const GR_007_noConversionPredictions: GroundingRule = (finding) => {
  const text = `${finding.observation} ${finding.assessment} ${finding.recommendation ?? ''}`;
  for (const { id, re } of BANNED_PATTERNS) {
    if (re.test(text)) {
      return fail(`GR-007 (R5.3): banned pattern "${id}" matched — conversion/revenue prediction not allowed.`);
    }
  }
  return PASS;
};

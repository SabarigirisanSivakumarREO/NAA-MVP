/**
 * GR-006 — critical/high severity has measurable evidence (AC-15, R5.7).
 *
 * Constitution R5.7: severity ∈ {critical, high} requires MEASURABLE
 * evidence (numeric: pixel position, field count, contrast ratio, etc.).
 * evidence.measurement MUST be a non-empty string containing at least
 * one digit. Lower severities are not constrained by this rule.
 */
import { type GroundingRule, PASS, fail } from './types.js';

const DIGIT_RE = /\d/;

export const GR_006_criticalNeedsMeasurement: GroundingRule = (finding) => {
  if (finding.severity !== 'critical' && finding.severity !== 'high') return PASS;
  const m = finding.evidence.measurement;
  if (m === null || m.trim() === '') {
    return fail(
      `GR-006 (R5.7): severity=${finding.severity} requires measurable evidence; evidence.measurement is empty.`,
    );
  }
  if (!DIGIT_RE.test(m)) {
    return fail(
      `GR-006 (R5.7): severity=${finding.severity} requires numeric measurement; "${m}" has no digits.`,
    );
  }
  return PASS;
};

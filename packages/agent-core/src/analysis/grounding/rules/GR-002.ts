/**
 * GR-002 — above/below fold claim matches bounding box (AC-11).
 *
 * If observation/assessment claims "above fold" or "below fold", the
 * evidence.measurement string MUST encode a `y:<N>` coordinate consistent
 * with perception.layout.foldPosition:
 *   - "above fold" → y < foldPosition
 *   - "below fold" → y >= foldPosition
 * If no fold claim made, rule does not fire (PASS).
 */
import { type GroundingRule, PASS, fail } from './types.js';

const Y_COORD_RE = /\by\s*[:=]\s*(\d+)/i;
const ABOVE_FOLD_RE = /\babove[\s-]*the[\s-]*fold\b|\babove\s+fold\b/i;
const BELOW_FOLD_RE = /\bbelow[\s-]*the[\s-]*fold\b|\bbelow\s+fold\b/i;

export const GR_002_foldMatchesBoundingBox: GroundingRule = (finding, perception) => {
  const text = `${finding.observation} ${finding.assessment}`;
  const claimsAbove = ABOVE_FOLD_RE.test(text);
  const claimsBelow = BELOW_FOLD_RE.test(text);
  if (!claimsAbove && !claimsBelow) return PASS;

  const measurement = finding.evidence.measurement;
  if (measurement === null) {
    return fail('GR-002: fold claim made but evidence.measurement is null (no y-coordinate to verify).');
  }
  const m = Y_COORD_RE.exec(measurement);
  if (m === null) {
    return fail(
      `GR-002: fold claim made but evidence.measurement "${measurement}" lacks y:<N> coordinate.`,
    );
  }
  const y = Number(m[1]);
  const foldPosition = (perception as { layout: { foldPosition: number } }).layout.foldPosition;

  if (claimsAbove && y >= foldPosition) {
    return fail(`GR-002: claims "above fold" but y=${y} ≥ foldPosition=${foldPosition}.`);
  }
  if (claimsBelow && y < foldPosition) {
    return fail(`GR-002: claims "below fold" but y=${y} < foldPosition=${foldPosition}.`);
  }
  return PASS;
};

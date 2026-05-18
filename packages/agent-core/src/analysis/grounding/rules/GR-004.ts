/**
 * GR-004 — contrast claims have computed-style data (AC-13).
 *
 * If observation/assessment mentions "contrast" (WCAG, luminance, etc.),
 * perception MUST contain at least one element with a numeric
 * `contrastRatio` field (currently sourced from CTA computed/hover/focus
 * styles). Prevents LLM from inventing contrast numbers.
 * If no contrast claim made, rule does not fire (PASS).
 */
import { type GroundingRule, PASS, fail } from './types.js';

const CONTRAST_RE = /\bcontrast(?:\s*ratio)?\b|\bluminance\b|\bwcag\s*(?:aa|aaa)?\b/i;

export const GR_004_contrastClaims: GroundingRule = (finding, perception) => {
  const text = `${finding.observation} ${finding.assessment} ${finding.recommendation ?? ''}`;
  if (!CONTRAST_RE.test(text)) return PASS;

  const ctas = (perception as { ctas?: Array<Record<string, unknown>> }).ctas ?? [];
  for (const c of ctas) {
    const cs = c.computedStyles as Record<string, unknown> | undefined;
    if (cs && typeof cs.contrastRatio === 'number') return PASS;
    const hs = c.hoverStyles as Record<string, unknown> | null | undefined;
    if (hs && typeof hs.contrastRatio === 'number') return PASS;
    const fs = c.focusStyles as Record<string, unknown> | null | undefined;
    if (fs && typeof fs.contrastRatio === 'number') return PASS;
  }
  return fail(
    'GR-004: contrast claim made but perception has no computed contrastRatio data on any element.',
  );
};

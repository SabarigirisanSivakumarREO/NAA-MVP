/**
 * GR-003 — form field count claim matches actual form (AC-12).
 *
 * If observation/assessment cites a specific form field count (e.g.,
 * "form has N fields", "N-field form"), perception MUST contain a form
 * with that fieldCount. Loosely matches "N field" or "N fields" with N
 * ≤ 50 to avoid false matches against percentages / coordinates.
 * If no count claim made, rule does not fire (PASS).
 */
import { type GroundingRule, PASS, fail } from './types.js';

const FIELD_COUNT_RE = /\b(\d{1,2})\s*[-\s]?\s*fields?\b/gi;

export const GR_003_formFieldCount: GroundingRule = (finding, perception) => {
  const text = `${finding.observation} ${finding.assessment}`;
  const claimed: number[] = [];
  for (const m of text.matchAll(FIELD_COUNT_RE)) {
    const n = Number(m[1]);
    if (n > 0 && n <= 50) claimed.push(n);
  }
  if (claimed.length === 0) return PASS;

  const forms = (perception as { forms: Array<{ fieldCount?: number; fields?: unknown[] }> }).forms ?? [];
  const actualCounts = forms.map((f) => f.fieldCount ?? (Array.isArray(f.fields) ? f.fields.length : 0));
  for (const c of claimed) if (actualCounts.includes(c)) return PASS;
  return fail(
    `GR-003: claimed form field count ${claimed.join('/')} not matched by any perception form (actual: ${actualCounts.join(',') || 'no forms'}).`,
  );
};

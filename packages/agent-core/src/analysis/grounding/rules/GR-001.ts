/**
 * GR-001 — referenced element exists in perception (AC-10, REQ-ANALYZE-GROUND-001).
 *
 * If `evidence.element_ref` is non-null, the referenced text MUST appear
 * somewhere in perception (CTA text/accessibleName, form submitButtonText/
 * field label/placeholder, image alt, trust signal text, landmark name,
 * heading text). Substring case-insensitive match. If `element_ref` is
 * null, rule does not fire (PASS).
 */
import { type GroundingRule, PASS, fail } from './types.js';

function collectPerceptionStrings(perception: unknown): string[] {
  const p = perception as Record<string, unknown>;
  const out: string[] = [];
  const ctas = (p.ctas as Array<Record<string, unknown>>) ?? [];
  for (const c of ctas) {
    if (typeof c.text === 'string') out.push(c.text);
    if (typeof c.accessibleName === 'string') out.push(c.accessibleName);
  }
  const forms = (p.forms as Array<Record<string, unknown>>) ?? [];
  for (const f of forms) {
    if (typeof f.submitButtonText === 'string') out.push(f.submitButtonText);
    const fields = (f.fields as Array<Record<string, unknown>>) ?? [];
    for (const fld of fields) {
      if (typeof fld.label === 'string') out.push(fld.label);
      if (typeof fld.placeholder === 'string') out.push(fld.placeholder);
      if (typeof fld.accessibleName === 'string') out.push(fld.accessibleName);
    }
  }
  const images = (p.images as Array<Record<string, unknown>>) ?? [];
  for (const i of images) if (typeof i.alt === 'string') out.push(i.alt);
  const trust = (p.trustSignals as Array<Record<string, unknown>>) ?? [];
  for (const t of trust) if (typeof t.text === 'string') out.push(t.text);
  const headings = (p.headingHierarchy as Array<Record<string, unknown>>) ?? [];
  for (const h of headings) if (typeof h.text === 'string') out.push(h.text);
  const landmarks = (p.landmarks as Array<Record<string, unknown>>) ?? [];
  for (const l of landmarks) if (typeof l.role === 'string') out.push(l.role);
  return out;
}

export const GR_001_elementExists: GroundingRule = (finding, perception) => {
  const ref = finding.evidence.element_ref;
  if (ref === null || ref.trim() === '') return PASS;
  const needle = ref.toLowerCase();
  const haystack = collectPerceptionStrings(perception).map((s) => s.toLowerCase());
  for (const s of haystack) if (s.includes(needle)) return PASS;
  return fail(
    `GR-001: evidence.element_ref "${ref}" not found in perception (ctas/forms/images/trustSignals/headings/landmarks).`,
  );
};

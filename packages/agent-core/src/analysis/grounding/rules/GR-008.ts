/**
 * GR-008 — data_point references a real AnalyzePerception section (AC-17).
 *
 * evidence.data_point MUST begin with a token that names an actual
 * top-level section of AnalyzePerceptionSchema. Guards against the LLM
 * inventing section names like "headerCTAs" when only "ctas" exists.
 *
 * Token extraction: prefix before `[`, `.`, or whitespace.
 */
import { type GroundingRule, PASS, fail } from './types.js';

const VALID_SECTIONS: ReadonlySet<string> = new Set([
  'metadata',
  'headingHierarchy',
  'landmarks',
  'semanticHTML',
  'structure',
  'textContent',
  'ctas',
  'forms',
  'trustSignals',
  'layout',
  'images',
  'iframes',
  'navigation',
  'accessibility',
  'performance',
  'viewport_context',
  'inferredPageType',
  '_extensions',
]);

const SECTION_PREFIX_RE = /^([A-Za-z_][A-Za-z0-9_]*)/;

export const GR_008_dataPointReferencesRealSection: GroundingRule = (finding) => {
  const dp = finding.evidence.data_point;
  const m = SECTION_PREFIX_RE.exec(dp);
  if (m === null) {
    return fail(`GR-008: evidence.data_point "${dp}" lacks a leading section identifier.`);
  }
  const section = m[1] as string;
  if (!VALID_SECTIONS.has(section)) {
    return fail(
      `GR-008: evidence.data_point section "${section}" is not a real AnalyzePerception top-level field.`,
    );
  }
  return PASS;
};

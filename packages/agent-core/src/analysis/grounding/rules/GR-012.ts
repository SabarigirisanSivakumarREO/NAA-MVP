/**
 * GR-012 — benchmark validation (AC-18 folded, R15.4).
 *
 * Look up the heuristic by id in the filtered set; validate the finding
 * against the heuristic's `benchmark`:
 *
 *   - Quantitative (kind:'quantitative', value, unit, metric):
 *       Extract the first number from `evidence.measurement`. PASS if
 *       within ±20% of `benchmark.value`. Skip (PASS) if no number found.
 *
 *   - Qualitative (kind:'qualitative', standard_text):
 *       PASS if observation/assessment/recommendation contains
 *       `standard_text` (case-insensitive substring) OR Levenshtein
 *       similarity ≥ 0.6 against the standard_text. Skip (PASS) if no
 *       benchmark on heuristic.
 */
import { type GroundingRule, PASS, fail } from './types.js';

const TOLERANCE = 0.2;
const QUALITATIVE_SIMILARITY = 0.6;
const NUMBER_RE = /-?\d+(?:\.\d+)?/;

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    let prev = dp[0] as number;
    dp[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const tmp = dp[j] as number;
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      dp[j] = Math.min((dp[j] as number) + 1, (dp[j - 1] as number) + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n] as number;
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

export const GR_012_benchmarkValidation: GroundingRule = (finding, _perception, filteredHeuristics) => {
  const heuristic = filteredHeuristics.find((h) => (h as { id: string }).id === finding.heuristic_id) as
    | { benchmark?: Record<string, unknown> }
    | undefined;
  const benchmark = heuristic?.benchmark;
  if (benchmark === undefined) return PASS;
  const kind = benchmark.kind as string | undefined;

  if (kind === 'quantitative') {
    const target = benchmark.value as number;
    const m = finding.evidence.measurement;
    if (m === null) return PASS;
    const num = NUMBER_RE.exec(m);
    if (num === null) return PASS;
    const observed = Number(num[0]);
    const lower = target * (1 - TOLERANCE);
    const upper = target * (1 + TOLERANCE);
    if (observed < lower || observed > upper) {
      return fail(
        `GR-012 (R15.4): quantitative measurement ${observed} outside ±${TOLERANCE * 100}% of benchmark ${target} (window [${lower.toFixed(2)}, ${upper.toFixed(2)}]).`,
      );
    }
    return PASS;
  }

  if (kind === 'qualitative') {
    const standard = (benchmark.standard_text as string).toLowerCase();
    const haystack = `${finding.observation} ${finding.assessment} ${finding.recommendation ?? ''}`.toLowerCase();
    if (haystack.includes(standard)) return PASS;
    const sim = similarity(standard, haystack);
    if (sim >= QUALITATIVE_SIMILARITY) return PASS;
    return fail(
      `GR-012 (R15.4): qualitative benchmark "${benchmark.standard_text}" not present (substring miss + Levenshtein similarity ${sim.toFixed(2)} < ${QUALITATIVE_SIMILARITY}).`,
    );
  }

  return PASS;
};

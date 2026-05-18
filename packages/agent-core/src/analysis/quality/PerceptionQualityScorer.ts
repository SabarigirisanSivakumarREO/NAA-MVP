/**
 * PerceptionQualityScorer (Phase 7 §7.10, REQ-ANALYZE-QUALITY-001..003).
 *
 * 7 weighted signals over AnalyzePerception → overall score [0, 1].
 * Routing: ≥ 0.6 proceed; 0.3-0.59 partial (Tier 1 only); < 0.3 skip.
 *
 * Spec source: docs/specs/final-architecture/07-analyze-mode.md §7.10
 *   (REQ-ANALYZE-QUALITY-002 weights: content 0.25, interactive 0.20,
 *    overlay 0.15, error_state 0.15, navigation 0.10, headings 0.10,
 *    loaded 0.05; total 1.00).
 */
import type { AnalyzePerception } from '../types.js';

export interface PerceptionQualitySignals {
  readonly has_meaningful_content: boolean;
  readonly has_interactive_elements: boolean;
  readonly has_navigation: boolean;
  readonly has_heading_structure: boolean;
  readonly no_overlay_detected: boolean;
  readonly no_error_state: boolean;
  readonly page_loaded: boolean;
}

export interface PerceptionQualityScore {
  readonly overall: number;
  readonly signals: PerceptionQualitySignals;
  readonly blocking_issue: string | null;
}

const WEIGHTS: Readonly<Record<keyof PerceptionQualitySignals, number>> = {
  has_meaningful_content: 0.25,
  has_interactive_elements: 0.2,
  no_overlay_detected: 0.15,
  no_error_state: 0.15,
  has_navigation: 0.1,
  has_heading_structure: 0.1,
  page_loaded: 0.05,
};

const ERROR_STATE_RE = /\baccess denied\b|\bcaptcha\b|\bplease verify\b|\b403\b|\b404\b/i;

function pick<T>(o: unknown, key: string): T | undefined {
  if (o === null || typeof o !== 'object') return undefined;
  return (o as Record<string, unknown>)[key] as T | undefined;
}

function detectOverlay(perception: AnalyzePerception): boolean {
  // Heuristic: iframes with cookie/consent/modal purpose are treated as overlays.
  // Full v2.2 overlay detection requires DOM access; this is the offline shape.
  const iframes = pick<Array<Record<string, unknown>>>(perception, 'iframes') ?? [];
  for (const f of iframes) {
    const purpose = f.purposeGuess as string | undefined;
    if (purpose === 'cmp' || purpose === 'chat') return true;
  }
  return false;
}

function detectErrorState(perception: AnalyzePerception): boolean {
  const headings = pick<Array<Record<string, unknown>>>(perception, 'headingHierarchy') ?? [];
  for (const h of headings) {
    const text = h.text as string | undefined;
    if (text !== undefined && ERROR_STATE_RE.test(text)) return true;
  }
  const meta = pick<Record<string, unknown>>(perception, 'metadata') ?? {};
  const title = meta.title as string | undefined;
  if (title !== undefined && ERROR_STATE_RE.test(title)) return true;
  return false;
}

export function computePerceptionQuality(perception: AnalyzePerception): PerceptionQualityScore {
  const textContent = pick<Record<string, unknown>>(perception, 'textContent') ?? {};
  const wordCount = (textContent.wordCount as number) ?? 0;
  const ctas = pick<unknown[]>(perception, 'ctas') ?? [];
  const forms = pick<unknown[]>(perception, 'forms') ?? [];
  const navigation = pick<Record<string, unknown>>(perception, 'navigation') ?? {};
  const navItems = (navigation.primaryNavItems as unknown[]) ?? [];
  const headings = pick<unknown[]>(perception, 'headingHierarchy') ?? [];
  const performance = pick<Record<string, unknown>>(perception, 'performance') ?? {};
  const domContentLoaded = (performance.domContentLoaded as number) ?? Infinity;
  const resourceCount = (performance.resourceCount as number) ?? 0;

  const signals: PerceptionQualitySignals = {
    has_meaningful_content: wordCount > 50,
    has_interactive_elements: ctas.length > 0 || forms.length > 0,
    has_navigation: navItems.length > 2,
    has_heading_structure: headings.length > 0,
    no_overlay_detected: !detectOverlay(perception),
    no_error_state: !detectErrorState(perception),
    page_loaded: domContentLoaded < 30000 && resourceCount > 5,
  };

  let overall = 0;
  for (const k of Object.keys(WEIGHTS) as Array<keyof PerceptionQualitySignals>) {
    if (signals[k]) overall += WEIGHTS[k];
  }

  let blocking_issue: string | null = null;
  if (overall < 0.3) {
    const missing: string[] = [];
    if (!signals.has_meaningful_content) missing.push('content<50 words');
    if (!signals.no_error_state) missing.push('error-state text detected');
    if (!signals.page_loaded) missing.push('page not loaded');
    if (!signals.no_overlay_detected) missing.push('blocking overlay');
    blocking_issue = missing.length > 0 ? missing.join(', ') : 'multiple signals failed';
  }

  return { overall, signals, blocking_issue };
}

export type QualityRoute = 'proceed' | 'partial' | 'skip';

export function routeFromQuality(score: PerceptionQualityScore): QualityRoute {
  if (score.overall < 0.3) return 'skip';
  if (score.overall < 0.6) return 'partial';
  return 'proceed';
}

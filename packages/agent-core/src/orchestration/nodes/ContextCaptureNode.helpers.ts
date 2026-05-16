/**
 * Phase 4b T4B-011 — ContextCaptureNode helpers.
 *
 * Pure, file-private functions extracted from ContextCaptureNode.ts to keep
 * the orchestration class focused on its async flow. All exports here are
 * consumed exclusively by ContextCaptureNode.ts; downstream code should
 * import only ContextCaptureNode (the class is the public surface).
 *
 * R10.1 file ≤ 300 LOC target. R10.3 named exports only. R2 no `any`.
 * R9: zero vendor SDK imports outside `node:crypto` + internal types.
 */
import { createHash } from 'node:crypto';

import {
  AuditRequestSchema,
  type AuditRequest,
} from '../../types/audit-request.js';
import type { BusinessArchetypeInferrerResult } from '../../context/BusinessArchetypeInferrer.js';
import type { PageTypeInferrerResult } from '../../context/PageTypeInferrer.js';
import type { ConfidenceScorerResult } from '../../context/ConfidenceScorer.js';
import {
  type AudienceDimension,
  type BrandDimension,
  type BusinessDimension,
  type ContextProfile,
  ContextProfileSchema,
  type ContextSource,
  type GoalDimension,
  type OpenQuestion,
  type PageDimension,
  type ProvenanceEntry,
  type TrafficDimension,
} from '../../types/context-profile.js';
import type { AuditState, ClarificationAnswer } from '../state.js';

// ---------------------------------------------------------------------------
// Public (file-scope) helper types
// ---------------------------------------------------------------------------

export interface ComposedDimensions {
  business: BusinessDimension;
  page: PageDimension;
  audience: AudienceDimension;
  traffic: TrafficDimension;
  brand: BrandDimension;
  goal: GoalDimension;
}

export interface ComposeInput {
  request: AuditRequest;
  archResult: BusinessArchetypeInferrerResult;
  pageResult: PageTypeInferrerResult;
  answerOverrides?: ReadonlyMap<string, unknown> | undefined;
}

export interface BuildProfileInput {
  state: AuditState;
  dims: ComposedDimensions;
  score: ConfidenceScorerResult;
  openQuestions: ReadonlyArray<OpenQuestion>;
  provenance: ReadonlyArray<ProvenanceEntry>;
  perceptionVersion: string;
}

// ---------------------------------------------------------------------------
// Dimension composition
// ---------------------------------------------------------------------------

const ZERO_HASH = '0'.repeat(64);

/** Build the 6 dimensions: merge intake (user) with inferrer output; fill defaults. */
export function composeDimensions(input: ComposeInput): ComposedDimensions {
  const { request, archResult, pageResult, answerOverrides } = input;
  const intake = request.intake;
  const overrides = answerOverrides ?? new Map<string, unknown>();
  const userField = <T>(value: T, source: ContextSource = 'user', confidence = 1) => ({
    value,
    source,
    confidence,
  });
  const defaultField = <T>(value: T) =>
    ({ value, source: 'default' as ContextSource, confidence: 0 });
  function withOverride<T>(
    path: string,
    fallback: { value: T; source: ContextSource; confidence: number },
  ) {
    if (overrides.has(path)) return userField(overrides.get(path) as T);
    return fallback;
  }

  const business: BusinessDimension = {
    archetype: withOverride(
      'business.archetype',
      intake.business?.archetype !== undefined
        ? userField(intake.business.archetype)
        : archResult.archetype,
    ),
    aov_tier: withOverride(
      'business.aov_tier',
      intake.business?.aov_tier !== undefined
        ? userField(intake.business.aov_tier)
        : defaultField('mid' as const),
    ),
    cadence: defaultField('one_time' as const),
    vertical: withOverride(
      'business.vertical',
      intake.business?.vertical !== undefined
        ? userField(intake.business.vertical)
        : defaultField(''),
    ),
  };

  const page: PageDimension = {
    type: withOverride('page.type', pageResult.type),
    funnel_stage: defaultField('consideration' as const),
    job: defaultField('convert' as const),
    is_indexed: defaultField(null),
  };

  const audience: AudienceDimension = {
    buyer: withOverride(
      'audience.buyer',
      intake.audience?.buyer !== undefined
        ? userField(intake.audience.buyer)
        : defaultField('consumer' as const),
    ),
    awareness_level: withOverride(
      'audience.awareness_level',
      intake.audience?.awareness_level !== undefined
        ? userField(intake.audience.awareness_level)
        : defaultField('product_aware' as const),
    ),
    decision_style: defaultField('researched' as const),
    sophistication: defaultField('medium' as const),
  };

  const traffic: TrafficDimension = {
    primary_sources: withOverride(
      'traffic.primary_sources',
      intake.traffic?.primary_sources !== undefined
        ? userField(intake.traffic.primary_sources)
        : defaultField([]),
    ),
    device_priority: withOverride(
      'traffic.device_priority',
      intake.traffic?.device_priority !== undefined
        ? userField(intake.traffic.device_priority)
        : defaultField('balanced' as const),
    ),
    mobile_share: defaultField(null),
    geo_primary: defaultField(null),
    locale_primary: defaultField(null),
  };

  const brand: BrandDimension = {
    tone: defaultField(''),
    voice: defaultField(''),
    forbidden_terms: defaultField([]),
  };

  const goal: GoalDimension = {
    primary_kpi: userField(intake.goal.primary_kpi),
    secondary_kpis: userField(intake.goal.secondary_kpis ?? []),
    current_baseline: userField(intake.goal.current_baseline ?? null),
    target_lift: userField(intake.goal.target_lift ?? null),
    constraints: {
      regulatory: userField(intake.goal.constraints.regulatory),
      accessibility: userField(intake.goal.constraints.accessibility ?? null),
      brand: userField(intake.goal.constraints.brand ?? []),
      technical: userField(intake.goal.constraints.technical ?? []),
    },
  };

  return { business, page, audience, traffic, brand, goal };
}

// ---------------------------------------------------------------------------
// Profile build + canonical-JSON hash (R-03)
// ---------------------------------------------------------------------------

/** Compose ContextProfile, compute SHA-256 hash on canonical-JSON, freeze. */
export function buildProfile(input: BuildProfileInput): ContextProfile {
  const { state, dims, score, openQuestions, provenance, perceptionVersion } = input;
  const userProvidedFields: string[] = [];
  const inferredFields: string[] = [];
  for (const p of provenance) {
    if (p.source === 'user') userProvidedFields.push(`${p.dimension}.*`);
    else if (p.source !== 'default') inferredFields.push(`${p.dimension}.*`);
  }
  const captureMethod: 'intake_form' | 'inferred' | 'hybrid' =
    inferredFields.length === 0
      ? 'intake_form'
      : userProvidedFields.length === 0
        ? 'inferred'
        : 'hybrid';

  // R-03 idempotency: fix captured_at + created_at + provenance.inferred_at to
  // state.created_at so the hash is fully derived from the inputs. Re-running
  // with the same state + intake yields the same hash.
  const stamp = state.created_at;
  const normalizedProvenance: ProvenanceEntry[] = provenance.map((p) => ({
    ...p,
    inferred_at: stamp,
  }));

  const draft = {
    id: deriveProfileId(state),
    audit_run_id: state.audit_run_id,
    client_id: state.client_id,
    meta: {
      captured_at: stamp,
      capture_method: captureMethod,
      user_provided_fields: userProvidedFields.sort(),
      inferred_fields: inferredFields.sort(),
      overall_confidence: score.overall_confidence,
      threshold_action: score.threshold_action,
      perception_layer_version: perceptionVersion,
    },
    business: dims.business,
    page: dims.page,
    audience: dims.audience,
    traffic: dims.traffic,
    brand: dims.brand,
    goal: dims.goal,
    open_questions: [...openQuestions],
    provenance: normalizedProvenance,
    profile_hash: ZERO_HASH,
    created_at: stamp,
  };
  const hash = sha256CanonicalJson({ ...draft, profile_hash: undefined });
  const finalDraft = { ...draft, profile_hash: hash };
  const parsed = ContextProfileSchema.parse(finalDraft);
  return Object.freeze(parsed);
}

/**
 * Deterministic UUID derived from state — same state.audit_run_id always
 * yields the same profile.id, satisfying R-03 idempotency. Sliced SHA-256
 * hex into UUID v4 layout (cheaper than adding a uuid dep).
 */
export function deriveProfileId(state: AuditState): string {
  const seed = `${state.audit_run_id}:${state.client_id}:context_profile`;
  const h = createHash('sha256').update(seed).digest('hex');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,
    `8${h.slice(17, 20)}`,
    h.slice(20, 32),
  ].join('-');
}

/**
 * SHA-256 hex over canonical-JSON. Plan.md §2.3 specifies
 * `JSON.stringify(profile, Object.keys(profile).sort())` (top-level keys);
 * we extend recursively so nested objects also key-sort — the intent of
 * "canonical-JSON". `undefined` values are dropped (JSON.stringify default).
 */
export function sha256CanonicalJson(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function stableJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map((v) => stableJson(v)).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(',')}}`;
  }
  return 'null';
}

// ---------------------------------------------------------------------------
// Clarification answer routing — intake vs override channels
// ---------------------------------------------------------------------------

/**
 * Whitelist of dot-paths that map cleanly into AuditRequest.intake. Other
 * paths (e.g., `page.type`, `brand.*`) flow through answerOverrides which
 * composeDimensions() consults post-inference.
 */
const INTAKE_PATHS = new Set<string>([
  'goal.primary_kpi',
  'business.archetype',
  'business.aov_tier',
  'business.vertical',
  'audience.buyer',
  'audience.awareness_level',
  'traffic.device_priority',
  'traffic.primary_sources',
]);

export function isIntakePath(p: string): boolean {
  return INTAKE_PATHS.has(p);
}

/** Fold intake-mapped ClarificationAnswer[] into a base AuditRequest's intake. */
export function applyAnswersToIntake(
  base: AuditRequest,
  answers: ReadonlyArray<ClarificationAnswer>,
): AuditRequest {
  const next: AuditRequest = JSON.parse(JSON.stringify(base));
  for (const a of answers) {
    setByPath(next.intake as unknown as Record<string, unknown>, a.field_path, a.value);
  }
  return AuditRequestSchema.parse(next);
}

function setByPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]!;
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

/**
 * Fallback when resume() is called without the original request — synthesize
 * a minimal AuditRequest from state + answers. The CLI normally preserves
 * the original request across the halt; this path is for recovery scenarios.
 */
export function synthesizeRequestFromState(
  state: AuditState,
  answers: ReadonlyArray<ClarificationAnswer>,
): AuditRequest {
  const primaryKpi =
    answers.find((a) => a.field_path === 'goal.primary_kpi')?.value ?? 'purchase';
  const archetype = answers.find((a) => a.field_path === 'business.archetype')?.value;
  const skeleton = {
    client_id: state.client_id,
    urls: ['https://placeholder.example/'],
    business_type: (typeof archetype === 'string' ? archetype : 'D2C') as never,
    intake: {
      goal: {
        primary_kpi: primaryKpi as never,
        constraints: { regulatory: [] as string[] },
      },
    },
  };
  return AuditRequestSchema.parse(skeleton);
}

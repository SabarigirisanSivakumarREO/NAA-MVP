/**
 * Phase 4b T4B-008 — OpenQuestionsBuilder: scan a 6-dimension input
 * (5 universal + goal) and surface clarification prompts to the CLI
 * (T4B-010) per R-09 + REQ-CONTEXT-OUT-002.
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.2
 *     (REQ-CONTEXT-OUT-002 — open_questions[] surface)
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-08 + R-09 +
 *     §"Edge Cases" L218-225 (default emission rule)
 *   docs/specs/mvp/phases/phase-4b-context-capture/plan.md §2.2
 *     (required-field rule R-09 — required: business.archetype, page.type,
 *      goal.primary_kpi)
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-008 (L139-145)
 *   packages/agent-core/src/types/context-profile.ts —
 *     OpenQuestionSchema (validation source of truth), ContextField<T>,
 *     dimension shapes (Business/Page/Audience/Traffic/Brand/Goal).
 *
 * # Algorithm (R-09 verbatim)
 *
 * 1. REQUIRED-field blocking questions: for each of the 3 MVP-required fields
 *    (`business.archetype`, `page.type`, `goal.primary_kpi`), if
 *    `confidence < 0.6` OR value is missing/null, emit a blocking question
 *    with a deterministic human-readable prompt (templates below).
 * 2. Non-blocking warnings: for every NON-required dimension subfield with
 *    `confidence ∈ [0.6, 0.9)`, emit a warning describing the uncertainty.
 *    REQUIRED fields at the same band ALSO emit warnings (not blocking).
 * 3. Silent (no question) when `confidence ≥ 0.9`.
 * 4. Sort `open_questions` by (`blocking` desc, `field_path` asc) for
 *    deterministic + idempotent output → R-03 hash stability.
 * 5. Return frozen array.
 *
 * # Required-field templates (deterministic — used by AC-10 idempotency check)
 *
 * `business.archetype`: enum prompt with the 6 LOCKED archetypes
 * `page.type`        : enum prompt with the 12 LOCKED page types
 * `goal.primary_kpi` : enum prompt with the 8 LOCKED KPIs
 *
 * # Non-blocking warning template
 *
 * `Inferred '<value>' for <field_path> with mid confidence (<n.NN>). Confirm or override?`
 *
 * # Constitution compliance
 *
 * R3.1 TDD: open-questions-builder.test.ts written FIRST; this impl follows.
 * R10.1 file ≤ 300 LOC. R10.3 named exports only. R10.6 no console.log.
 * R2 no `any` — typed throughout; ContextField<T> is generic.
 * R6 no heuristic-content reference (pure plumbing).
 * R9 zero vendor SDK imports — only `../types/context-profile.js`.
 * R14 NOT applicable — pure functional builder; no Pino, no IO.
 * R25 NO Playwright; NO LLMAdapter; NO judgment fields; NO silent defaults
 *   (caller-supplied dimension values surface explicitly via question text).
 * R11.4/R20 — context-profile.ts shape NOT modified (LOCKED).
 */
import type {
  AudienceDimension,
  BrandDimension,
  BusinessDimension,
  ContextDimension,
  ContextField,
  GoalDimension,
  OpenQuestion,
  PageDimension,
  TrafficDimension,
} from '../types/context-profile.js';

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface OpenQuestionsBuilderInput {
  readonly business: BusinessDimension;
  readonly page: PageDimension;
  readonly audience: AudienceDimension;
  readonly traffic: TrafficDimension;
  readonly brand: BrandDimension;
  readonly goal: GoalDimension;
}

export interface OpenQuestionsBuilderResult {
  /** Sorted (blocking desc, field_path asc); frozen. */
  readonly open_questions: ReadonlyArray<OpenQuestion>;
}

// ---------------------------------------------------------------------------
// Threshold gates (mirror REQ-CONTEXT-OUT-001 + R-09 boundaries)
// ---------------------------------------------------------------------------

/** R-09: blocking when REQUIRED field confidence < this. */
const BLOCK_THRESHOLD = 0.6;
/** R-09: warning band upper bound (exclusive). ≥ this is silent. */
const SILENT_THRESHOLD = 0.9;

// ---------------------------------------------------------------------------
// Required-field prompts (deterministic; AC-10 idempotency depends on these)
// ---------------------------------------------------------------------------

const REQUIRED_QUESTIONS = {
  'business.archetype':
    "What business archetype best describes this site? Choose: D2C, B2B, SaaS, marketplace, lead_gen, service.",
  'page.type':
    "What page type is this URL? Choose: home, PLP, PDP, cart, checkout, post_purchase, category, landing, blog, about, pricing, comparison.",
  'goal.primary_kpi':
    "What is the primary KPI for this audit? Choose: purchase, signup, lead, add_to_cart, demo_request, trial_start, subscribe, engagement.",
} as const;

type RequiredFieldPath = keyof typeof REQUIRED_QUESTIONS;

// ---------------------------------------------------------------------------
// Field enumeration table — drives both blocking + warning passes
// ---------------------------------------------------------------------------

interface FieldDescriptor {
  readonly path: string;
  /** Parent dimension; undefined for `goal.*` (goal is intake-only, not in
   * the 5-value ContextDimensionEnum). */
  readonly dimension: ContextDimension | undefined;
  readonly field: ContextField<unknown>;
}

function enumerateFields(input: OpenQuestionsBuilderInput): ReadonlyArray<FieldDescriptor> {
  const { business, page, audience, traffic, brand, goal } = input;
  return [
    // business.*
    { path: 'business.archetype', dimension: 'business', field: business.archetype },
    { path: 'business.aov_tier', dimension: 'business', field: business.aov_tier },
    { path: 'business.cadence', dimension: 'business', field: business.cadence },
    { path: 'business.vertical', dimension: 'business', field: business.vertical },
    // page.*
    { path: 'page.type', dimension: 'page', field: page.type },
    { path: 'page.funnel_stage', dimension: 'page', field: page.funnel_stage },
    { path: 'page.job', dimension: 'page', field: page.job },
    { path: 'page.is_indexed', dimension: 'page', field: page.is_indexed },
    // audience.*
    { path: 'audience.buyer', dimension: 'audience', field: audience.buyer },
    { path: 'audience.awareness_level', dimension: 'audience', field: audience.awareness_level },
    { path: 'audience.decision_style', dimension: 'audience', field: audience.decision_style },
    { path: 'audience.sophistication', dimension: 'audience', field: audience.sophistication },
    // traffic.*
    { path: 'traffic.primary_sources', dimension: 'traffic', field: traffic.primary_sources },
    { path: 'traffic.device_priority', dimension: 'traffic', field: traffic.device_priority },
    { path: 'traffic.mobile_share', dimension: 'traffic', field: traffic.mobile_share },
    { path: 'traffic.geo_primary', dimension: 'traffic', field: traffic.geo_primary },
    { path: 'traffic.locale_primary', dimension: 'traffic', field: traffic.locale_primary },
    // brand.*
    { path: 'brand.tone', dimension: 'brand', field: brand.tone },
    { path: 'brand.voice', dimension: 'brand', field: brand.voice },
    { path: 'brand.forbidden_terms', dimension: 'brand', field: brand.forbidden_terms },
    // goal.* (dimension undefined per ContextDimensionEnum lock)
    { path: 'goal.primary_kpi', dimension: undefined, field: goal.primary_kpi },
    { path: 'goal.secondary_kpis', dimension: undefined, field: goal.secondary_kpis },
    { path: 'goal.current_baseline', dimension: undefined, field: goal.current_baseline },
    { path: 'goal.target_lift', dimension: undefined, field: goal.target_lift },
  ];
}

// ---------------------------------------------------------------------------
// Pure builder
// ---------------------------------------------------------------------------

/**
 * Scan dimensions and emit clarification questions per R-09.
 *
 * Stateless; safe for concurrent use. Does not mutate inputs. Does not
 * perform IO or logging. Output array is frozen for downstream safety.
 *
 * @param input — 6 dimensions (5 universal + goal).
 * @returns `{open_questions: ReadonlyArray<OpenQuestion>}` per AC-08.
 */
export function buildOpenQuestions(
  input: OpenQuestionsBuilderInput,
): OpenQuestionsBuilderResult {
  const fields = enumerateFields(input);
  const questions: OpenQuestion[] = [];

  for (const desc of fields) {
    const isRequired = isRequiredPath(desc.path);
    const conf = desc.field.confidence;
    const valueMissing = isMissing(desc.field.value);

    // 1. REQUIRED + (confidence < 0.6 OR missing value) → blocking.
    if (isRequired && (conf < BLOCK_THRESHOLD || valueMissing)) {
      questions.push(buildBlockingQuestion(desc));
      continue;
    }

    // 2. Confidence in warning band [0.6, 0.9) → non-blocking warning.
    //    Applies to required AND non-required fields equally.
    if (conf >= BLOCK_THRESHOLD && conf < SILENT_THRESHOLD) {
      questions.push(buildWarningQuestion(desc));
      continue;
    }

    // 3. confidence ≥ 0.9 → silent (no question).
    // 4. Non-required + confidence < 0.6 → silent (R-09 only blocks REQUIRED).
  }

  questions.sort(compareQuestions);

  return {
    open_questions: Object.freeze(questions),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRequiredPath(path: string): path is RequiredFieldPath {
  return path in REQUIRED_QUESTIONS;
}

/** A value is "missing" when it is undefined or null (R-09 missing-value rule). */
function isMissing(value: unknown): boolean {
  return value === undefined || value === null;
}

function buildBlockingQuestion(desc: FieldDescriptor): OpenQuestion {
  // Safe: caller already gated on isRequiredPath via isRequired check.
  const question = REQUIRED_QUESTIONS[desc.path as RequiredFieldPath];
  return {
    field_path: desc.path,
    question,
    blocking: true,
    ...(desc.dimension !== undefined ? { dimension: desc.dimension } : {}),
  };
}

function buildWarningQuestion(desc: FieldDescriptor): OpenQuestion {
  const conf = desc.field.confidence.toFixed(2);
  const valueRender = renderValue(desc.field.value);
  const question = `Inferred '${valueRender}' for ${desc.path} with mid confidence (${conf}). Confirm or override?`;
  return {
    field_path: desc.path,
    question,
    blocking: false,
    ...(desc.dimension !== undefined ? { dimension: desc.dimension } : {}),
  };
}

/**
 * Render a ContextField value for embedding in a prompt. Strings/numbers/
 * booleans render directly; null renders as "null"; arrays/objects use
 * JSON.stringify (deterministic for primitive-only payloads).
 */
function renderValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/**
 * Comparator: blocking DESC (true before false), then field_path ASC.
 * Deterministic across calls with identical inputs → R-03 hash stability.
 */
function compareQuestions(a: OpenQuestion, b: OpenQuestion): number {
  if (a.blocking !== b.blocking) {
    // true (1) sorts before false (0): negate the boolean delta.
    return a.blocking ? -1 : 1;
  }
  if (a.field_path !== b.field_path) {
    return a.field_path < b.field_path ? -1 : 1;
  }
  return 0;
}

/**
 * Phase 4 T070 — Drizzle PostgreSQL schema (15 tables).
 * Canonical: spec.md AC-05/AC-12/AC-17 + impact.md (Phase 4 canonical; SUPERSEDES
 * §13.7 where divergent — llm_call_log uses W1C's LLMCallRecord shape, NOT
 * §13.7's node_name/input_tokens/etc.) + 13-data-layer.md §13.1-§13.7 +
 * 34-observability.md §34.4 (22 audit_event types).
 * SQL truth: db/migrations/0001_initial.sql + 0002_master_extensions.sql.
 * This file mirrors SQL DDL exactly (R10.4 — divergence = kill criterion).
 * Append-only (R7.4) is two-layered: DB trigger + AppendOnlyTable brand.
 * R10.1 ≤ 300 lines. R10.2 named exports only.
 */
import { boolean, char, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Type-level append-only brand (R7.4 complement of the DB trigger).
export type AppendOnlyBrand = { readonly __appendOnly: true };
export type AppendOnlyTable<T> = T & AppendOnlyBrand;
const brand = <T>(t: T): AppendOnlyTable<T> => t as AppendOnlyTable<T>;

const ts = (name: string) => timestamp(name, { withTimezone: true });
const tsNow = (name: string) => ts(name).notNull().defaultNow();

// §13.1 clients — root tenant (RLS scope target; id is the RLS key)
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  domain: text('domain'),
  sector: text('sector'),
  industry: text('industry'),
  businessType: text('business_type').notNull().default('ecommerce'),
  config: jsonb('config').default({}),
  createdAt: tsNow('created_at'),
  updatedAt: tsNow('updated_at'),
});

// §13.1 audit_runs — pipeline invocation; R8.1 budget tracking. Indexes in 0001 SQL.
export const auditRuns = pgTable('audit_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  version: integer('version').notNull().default(1),
  status: text('status').notNull().default('pending'),
  rootUrl: text('root_url'),
  crawlScope: text('crawl_scope').notNull().default('domain'),
  heuristicSet: text('heuristic_set').notNull().default('default'),
  pagesTotal: integer('pages_total').notNull().default(0),
  pagesCrawled: integer('pages_crawled').notNull().default(0),
  pagesFailed: integer('pages_failed').notNull().default(0),
  findingsCount: integer('findings_count').notNull().default(0),
  findingsPublished: integer('findings_published').notNull().default(0),
  findingsHeld: integer('findings_held').notNull().default(0),
  findingsRejected: integer('findings_rejected').notNull().default(0),
  totalCostUsd: numeric('total_cost_usd', { precision: 10, scale: 6 }).notNull().default('0'),
  budgetRemainingUsd: numeric('budget_remaining_usd', { precision: 10, scale: 6 }).notNull().default('15'),
  completionReason: text('completion_reason'),
  competitorUrls: text('competitor_urls').array(),
  startedAt: ts('started_at'),
  completedAt: ts('completed_at'),
  createdAt: tsNow('created_at'),
});

// §13.1 findings — base + §13.6 12 nullable ALTER cols (0002).
export const findings = pgTable('findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  auditRunId: uuid('audit_run_id').notNull().references(() => auditRuns.id),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  pageUrl: text('page_url').notNull(),
  pageType: text('page_type'),
  heuristicId: text('heuristic_id').notNull(),
  heuristicSource: text('heuristic_source').notNull(),
  category: text('category').notNull(),
  status: text('status').notNull(),
  severity: text('severity').notNull(),
  name: text('name').notNull(),
  observation: text('observation').notNull(),
  assessment: text('assessment').notNull(),
  evidence: jsonb('evidence').notNull().default({}),
  recommendation: text('recommendation'),
  confidenceTier: text('confidence_tier').notNull(),
  confidenceBasis: text('confidence_basis'),
  needsReview: boolean('needs_review').notNull().default(false),
  publishStatus: text('publish_status').notNull().default('held'),
  publishedAt: ts('published_at'),
  publishAt: ts('publish_at'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: ts('reviewed_at'),
  boundingBox: jsonb('bounding_box'),
  screenshotRef: text('screenshot_ref'),
  groundingRulesPassed: text('grounding_rules_passed').array(),
  critiqueVerdict: text('critique_verdict'),
  critiqueReason: text('critique_reason'),
  createdAt: tsNow('created_at'),
  // §13.6 ALTER cols (0002) — nullable, backward-compatible.
  scope: text('scope'),
  templateId: uuid('template_id'),
  workflowId: uuid('workflow_id'),
  stateIds: text('state_ids').array(),
  parentFindingIds: uuid('parent_finding_ids').array(),
  polarity: text('polarity'),
  businessImpact: numeric('business_impact', { precision: 10, scale: 4 }),
  effort: numeric('effort', { precision: 10, scale: 4 }),
  priority: numeric('priority', { precision: 10, scale: 4 }),
  source: text('source'),
  analysisScope: text('analysis_scope'),
  interactionEvidence: jsonb('interaction_evidence'),
});

// §13.1 screenshots — image metadata; bytes in R2/LocalDiskStorage
export const screenshots = pgTable('screenshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  auditRunId: uuid('audit_run_id').notNull().references(() => auditRuns.id),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  pageUrl: text('page_url').notNull(),
  type: text('type').notNull(),
  storageKey: text('storage_key').notNull(),
  storageUrl: text('storage_url'),
  width: integer('width'),
  height: integer('height'),
  fileSize: integer('file_size'),
  createdAt: tsNow('created_at'),
});

// §13.1 sessions — browser session lifecycle (client_id added for RLS scope)
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  auditRunId: uuid('audit_run_id').references(() => auditRuns.id),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  task: text('task'),
  startUrl: text('start_url'),
  status: text('status').notNull().default('active'),
  steps: integer('steps').notNull().default(0),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),
  costUsd: numeric('cost_usd', { precision: 10, scale: 6 }).notNull().default('0'),
  createdAt: tsNow('created_at'),
  completedAt: ts('completed_at'),
});

// ============ APPEND-ONLY (R7.4) ============
// Brand-typed; underlying pgTable() value kept internal. Consumers see
// AppendOnlyTable<...>; UPDATE/DELETE blocked at TS level + DB trigger.

// AC-06 — AuditLogger writes here (audit_run_id, client_id, event, payload).
// Diverges from §13.1 v3.1 sessions-scoped audit_log (the v3.1 browser-agent
// variant); Phase 4 owns the canonical observability shape.
const _auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  auditRunId: uuid('audit_run_id').notNull().references(() => auditRuns.id),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  event: text('event').notNull(),
  payload: jsonb('payload').notNull().default({}),
  createdAt: tsNow('created_at'),
});
export const auditLog = brand(_auditLog);

const _rejectedFindings = pgTable('rejected_findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  auditRunId: uuid('audit_run_id').notNull().references(() => auditRuns.id),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  pageUrl: text('page_url').notNull(),
  heuristicId: text('heuristic_id').notNull(),
  findingContent: jsonb('finding_content').notNull(),
  rejectionStage: text('rejection_stage').notNull(),
  rejectionReason: text('rejection_reason').notNull(),
  rejectedByRule: text('rejected_by_rule'),
  createdAt: tsNow('created_at'),
});
export const rejectedFindings = brand(_rejectedFindings);

const _findingEdits = pgTable('finding_edits', {
  id: uuid('id').primaryKey().defaultRandom(),
  findingId: uuid('finding_id').notNull().references(() => findings.id),
  editedBy: text('edited_by').notNull(),
  changes: jsonb('changes').notNull(),
  createdAt: tsNow('created_at'),
});
export const findingEdits = brand(_findingEdits);

// R14.1 — shape mirrors W1C LLMCallRecord (impact.md, NOT §13.7).
const _llmCallLog = pgTable('llm_call_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  auditRunId: uuid('audit_run_id').notNull().references(() => auditRuns.id),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  operation: text('operation').notNull(),
  model: text('model').notNull(),
  promptTokens: integer('prompt_tokens').notNull(),
  completionTokens: integer('completion_tokens').notNull(),
  costUsd: numeric('cost_usd', { precision: 10, scale: 6 }).notNull().default('0'),
  durationMs: integer('duration_ms').notNull(),
  cacheHit: boolean('cache_hit').notNull().default(false),
  outcome: text('outcome').notNull(),
  errorClass: text('error_class'),
  createdAt: tsNow('created_at'),
});
export const llmCallLog = brand(_llmCallLog);

// 22-type stream (§34.4); CHECK + composite indexes in 0002. Shape mirrors
// W1C AuditEvent — field is event_type, NOT kind.
const _auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  auditRunId: uuid('audit_run_id').notNull().references(() => auditRuns.id),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  eventType: text('event_type').notNull(),
  pageUrl: text('page_url'),
  metadata: jsonb('metadata').notNull().default({}),
  timestamp: tsNow('timestamp'),
});
export const auditEvents = brand(_auditEvents);

// ============ Extension tables (0002) — all RLS-protected via client_id ============

export const pageStates = pgTable('page_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  auditRunId: uuid('audit_run_id').notNull().references(() => auditRuns.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  pageUrl: text('page_url').notNull(),
  stateId: text('state_id').notNull(),
  parentStateId: text('parent_state_id'),
  isDefaultState: boolean('is_default_state').notNull().default(false),
  interactionPath: jsonb('interaction_path').notNull().default([]),
  discoveredInPass: text('discovered_in_pass').notNull().default('pass_1_heuristic_primed'),
  domHash: text('dom_hash').notNull().default(''),
  textHash: text('text_hash').notNull().default(''),
  perception: jsonb('perception').notNull().default({}),
  viewportScreenshotKey: text('viewport_screenshot_key'),
  fullpageScreenshotKey: text('fullpage_screenshot_key'),
  trigger: jsonb('trigger'),
  meaningful: boolean('meaningful').notNull().default(true),
  explorationCostUsd: numeric('exploration_cost_usd', { precision: 10, scale: 6 }).notNull().default('0'),
  createdAt: tsNow('created_at'),
});

export const stateInteractions = pgTable('state_interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  auditRunId: uuid('audit_run_id').notNull().references(() => auditRuns.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  fromStateId: text('from_state_id').notNull(),
  toStateId: text('to_state_id').notNull(),
  interaction: jsonb('interaction').notNull().default({}),
  verifyResult: jsonb('verify_result'),
  success: boolean('success').notNull().default(false),
  capturedAt: tsNow('captured_at'),
  createdAt: tsNow('created_at'),
});

export const findingRollups = pgTable('finding_rollups', {
  id: uuid('id').primaryKey().defaultRandom(),
  auditRunId: uuid('audit_run_id').notNull().references(() => auditRuns.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  parentFindingId: uuid('parent_finding_id').notNull().references(() => findings.id, { onDelete: 'cascade' }),
  parentScope: text('parent_scope').notNull().default('atomic'),
  childFindingId: uuid('child_finding_id').notNull().references(() => findings.id, { onDelete: 'cascade' }),
  rollupReason: text('rollup_reason').notNull(),
  mergeCount: integer('merge_count').notNull().default(1),
  createdAt: tsNow('created_at'),
});

const verText = (n: string) => text(n).notNull().default('0.0.0');
const zeroTemp = (n: string) => numeric(n, { precision: 3, scale: 2 }).notNull().default('0.00');
export const reproducibilitySnapshots = pgTable('reproducibility_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  auditRunId: uuid('audit_run_id').notNull().references(() => auditRuns.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  promptEvaluateVersion: verText('prompt_evaluate_version'),
  promptCritiqueVersion: verText('prompt_critique_version'),
  promptComparisonVersion: text('prompt_comparison_version'),
  promptWorkflowVersion: text('prompt_workflow_version'),
  evaluateModel: text('evaluate_model').notNull().default('claude-sonnet-4'),
  evaluateTemperature: zeroTemp('evaluate_temperature'),
  critiqueModel: text('critique_model').notNull().default('claude-sonnet-4'),
  critiqueTemperature: zeroTemp('critique_temperature'),
  visionModel: text('vision_model'),
  heuristicBaseVersion: verText('heuristic_base_version'),
  overlayChainHash: text('overlay_chain_hash').notNull().default(''),
  heuristicIds: text('heuristic_ids').array().notNull().default([]),
  normalizerVersion: verText('normalizer_version'),
  groundingRuleSetVersion: verText('grounding_rule_set_version'),
  discoveryConfigVersion: verText('discovery_config_version'),
  stateExplorationPolicyVersion: verText('state_exploration_policy_version'),
  deterministicScoringVersion: verText('deterministic_scoring_version'),
  capturedAt: tsNow('captured_at'),
});

export const auditRequests = pgTable('audit_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  auditRunId: uuid('audit_run_id').references(() => auditRuns.id),
  triggerSource: text('trigger_source').notNull().default('cli'),
  triggerUserId: text('trigger_user_id'),
  triggerApiKeyId: text('trigger_api_key_id'),
  triggerCorrelationId: text('trigger_correlation_id'),
  rootUrl: text('root_url').notNull(),
  scopeConfig: jsonb('scope_config').notNull().default({}),
  budgetConfig: jsonb('budget_config').notNull().default({}),
  heuristicConfig: jsonb('heuristic_config').notNull().default({}),
  scheduleConfig: jsonb('schedule_config'),
  status: text('status').notNull().default('received'),
  rejectionReason: text('rejection_reason'),
  queuedAt: ts('queued_at'),
  startedAt: ts('started_at'),
  completedAt: ts('completed_at'),
  createdAt: tsNow('created_at'),
});

// ============ Phase 4b T4B-012 — context_profiles (append-only, R7.4) ============
// CANONICAL SHAPE: docs/specs/mvp/phases/phase-4b-context-capture/impact.md §6.
// Append-only intake/inference output pinned per audit; SHA-256 hash makes
// re-runs idempotent (R-03). Closes Phase 4 T070 AC-17 slot reservation
// (db-schema.test.ts + context-profiles-slot.test.ts flip from absence→presence
// in this commit). RLS via current_client_id() (0003_force_rls.sql).
// SQL truth: db/migrations/0004_context_profiles.sql.
const _contextProfiles = pgTable('context_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  auditRunId: uuid('audit_run_id').notNull().references(() => auditRuns.id),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  profileHash: char('profile_hash', { length: 64 }).notNull(),
  profileJson: jsonb('profile_json').notNull(),
  createdAt: tsNow('created_at'),
});
export const contextProfiles = brand(_contextProfiles);

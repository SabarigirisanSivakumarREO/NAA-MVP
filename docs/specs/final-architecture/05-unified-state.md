# Section 5 — Unified State Schema

## 5.1 Overview

The `AuditState` is a single LangGraph `Annotation` object that carries **all** state across the orchestrator, browse subgraph, and analyze subgraph. Both subgraphs read from and write to the same state object; mode-specific fields are simply ignored by the inactive subgraph.

**Design principle:** One state object, two execution subgraphs, zero state translation layers.

`AuditState` extends the v3.1 `AgentState` (browse fields) and adds analysis-specific fields on top.

---

## 5.2 Supporting Types

```typescript
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

// === From v3.1 (browse mode types) ===

export type ExecutionMode = "deterministic" | "guided_agent" | "computer_use";

export type ActionClass = "safe" | "caution" | "sensitive" | "blocked";

export type CompletionReason =
  | "success"
  | "failure"
  | "max_steps"
  | "hitl"
  | "blocked"
  | "budget_exceeded";

export type FailureType =
  | "transient"
  | "structural"
  | "blocked"
  | "bot_detected"
  | "extraction_partial"
  | "confidence"
  | "unknown";

export type VerifyStrategy =
  | { type: "url_change"; expected_pattern: string }
  | { type: "element_appears"; selector: string }
  | { type: "element_text"; selector: string; contains: string }
  | { type: "network_request"; url_pattern: string }
  | { type: "no_error_banner"; error_selectors: string[] }
  | { type: "snapshot_diff"; min_node_change: number }
  | { type: "custom_js"; script: string; expected_result: any }
  | { type: "no_captcha"; captcha_selectors: string[] }
  | { type: "no_bot_block"; block_indicators: string[] };

export interface VerifyResult {
  success: boolean;
  failure_type?: FailureType;
  reason?: string;
}

export interface ActionRecord {
  tool_name: string;
  parameters: Record<string, any>;
  timestamp: number;
  result?: any;
}

export interface DomainPolicy {
  domain: string;
  category: "denylist" | "allowlist" | "default";
  rate_limit_per_min: number;
  requires_approval: boolean;
}

export interface PageStateModel {
  metadata: { url: string; title: string; timestamp: number; viewport: { width: number; height: number } };
  accessibilityTree: { nodes: any[]; nodeCount: number; interactiveCount: number };
  filteredDOM: { elements: any[]; totalElements: number; filteredElements: number };
  interactiveGraph: { controls: any[]; controlCount: number; topControls: any[] };
  visual?: { screenshotBase64: string; screenshotWidth: number; screenshotHeight: number };
  diagnostics: { consoleErrors: string[]; failedRequests: string[]; pendingMutations: number };
}

export interface WorkflowRecipe {
  id: string;
  domain: string;
  task_pattern: string;
  steps: any[];
  success_rate: number;
}

// === New for audit (v4.0+) ===

export type AuditMode = "browse" | "analyze";

export type PageType =
  | "homepage"
  | "product"
  | "checkout"
  | "cart"
  | "form"
  | "landing"
  | "pricing"
  | "category"
  | "search"
  | "account"
  | "other";

export type BusinessType =
  | "ecommerce"
  | "saas"
  | "leadgen"
  | "marketplace"
  | "media"
  | "fintech"
  | "healthcare"
  | "education";

export type AuditPageStatus = "pending" | "browsing" | "analyzing" | "complete" | "failed" | "budget_exceeded";

export interface AuditPage {
  url: string;
  pageType: PageType;
  priority: number;          // 1 = highest
  status: AuditPageStatus;
  browse_started_at?: number;
  browse_completed_at?: number;
  analyze_started_at?: number;
  analyze_completed_at?: number;
  findings_count?: number;
  error?: string;
}

export interface ClientProfile {
  id: string;
  name: string;
  domain: string;
  sector?: string;
  industry?: string;
  business_type: BusinessType;
  config: Record<string, any>;
}

export interface Heuristic {
  id: string;
  source: "baymard" | "nielsen" | "cialdini";
  category: string;
  name: string;
  severity_if_violated: "critical" | "high" | "medium" | "low";
  reliability_tier: 1 | 2 | 3;
  reliability_note: string;
  detection: {
    pageTypes: string[];
    businessTypes?: string[];
    lookFor: string;
    positiveSignals: string[];
    negativeSignals: string[];
    dataPoints: string[];
    evidenceType: "measurable" | "observable" | "subjective";
  };
  recommendation: {
    summary: string;
    details: string;
    researchBacking: string;
  };
}

export interface HeuristicKnowledgeBase {
  version: string;
  lastUpdated: string;
  sources: Array<{ id: string; name: string; url: string }>;
  heuristics: Heuristic[];
}

export interface AnalyzePerception {
  metadata: { url: string; title: string; timestamp: number; viewport: { width: number; height: number } };
  headingHierarchy: Array<{ level: number; text: string; isAboveFold: boolean }>;
  landmarks: Array<{ role: string; label: string }>;
  semanticHTML: { hasMain: boolean; hasNav: boolean; hasFooter: boolean; formCount: number; tableCount: number };
  textContent: { wordCount: number; readabilityScore: number; primaryLanguage: string; paragraphs: Array<{ text: string; position: "above_fold" | "below_fold" }> };
  ctas: Array<{ text: string; type: "primary" | "secondary" | "tertiary"; isAboveFold: boolean; boundingBox: { x: number; y: number; width: number; height: number }; computedStyles: { backgroundColor: string; color: string; fontSize: string; padding: string; contrastRatio: number }; surroundingContext: string }>;
  forms: Array<{ id: string; fieldCount: number; requiredFieldCount: number; fields: Array<{ type: string; label: string; hasLabel: boolean; isRequired: boolean; hasValidation: boolean; hasErrorMessage: boolean; placeholder: string }>; hasInlineValidation: boolean; submitButtonText: string }>;
  trustSignals: Array<{ type: "review" | "badge" | "testimonial" | "guarantee" | "security" | "social_proof"; text: string; isAboveFold: boolean; boundingBox: { x: number; y: number; width: number; height: number } }>;
  layout: { viewportHeight: number; foldPosition: number; contentAboveFold: string[]; visualHierarchy: { primaryElement: string; secondaryElements: string[] }; whitespaceRatio: number };
  images: Array<{ src: string; alt: string; hasAlt: boolean; width: number; height: number; isAboveFold: boolean; isLazyLoaded: boolean }>;
  navigation: { primaryNavItems: Array<{ text: string; url: string; isActive: boolean }>; breadcrumbs: string[]; hasSearch: boolean; hasMobileMenu: boolean };
  performance: { domContentLoaded: number; fullyLoaded: number; resourceCount: number; totalTransferSize: number; largestContentfulPaint?: number };
}

export interface RawFinding {
  heuristic_id: string;
  status: "violation" | "pass" | "needs_review";
  observation: string;
  assessment: string;
  evidence: {
    element_ref: string | null;
    element_selector: string | null;
    data_point: string;
    measurement: string | null;
  };
  severity: "critical" | "high" | "medium" | "low" | null;
  confidence_basis: string | null;
  recommendation: string | null;
  needs_review: boolean;
}

export interface ReviewedFinding extends RawFinding {
  critique_verdict: "KEEP" | "REVISE" | "DOWNGRADE";
  critique_reason: string;
  original_finding?: RawFinding;
}

export interface GroundedFinding extends ReviewedFinding {
  evidence_verified: true;
  confidence_tier: "high" | "medium" | "low";
  auto_publish: boolean;
  needs_consultant_review: boolean;
  publish_delay_hours: number;
  grounding_rules_passed: string[];
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface RejectedFinding extends ReviewedFinding {
  rejection_reason: string;
  rejected_by: string;          // grounding rule ID (e.g., "GR-001")
}

export interface AnnotatedScreenshot {
  page_url: string;
  type: "viewport" | "fullpage";
  cleanImagePath: string;
  annotatedImagePath: string;
  annotations: Array<{
    findingId: string;
    position: { x: number; y: number };
    label: string;
    severity: string;
  }>;
}

export interface CritiqueSummary {
  total_reviewed: number;
  kept: number;
  revised: number;
  downgraded: number;
  rejected: number;
  rejection_reasons: string[];
}
```

---

## 5.3 AuditState — Full Schema

**REQ-STATE-001:**

```typescript
export const AuditState = Annotation.Root({

  // === BROWSE STATE (from v3.1 AgentState — unchanged) ===

  // Core messaging
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer }),

  // Task definition
  task: Annotation<string>(),
  task_complexity: Annotation<"simple" | "moderate" | "complex">(),
  sub_tasks: Annotation<string[]>(),

  // Execution control
  current_step: Annotation<number>(),
  max_steps: Annotation<number>({ default: () => 50 }),
  execution_mode: Annotation<ExecutionMode>(),     // deterministic | guided_agent | computer_use

  // Confidence (multiplicative)
  confidence_score: Annotation<number>(),
  confidence_threshold: Annotation<number>({ default: () => 0.7 }),
  uncertainty_reasons: Annotation<string[]>(),

  // Workflow
  workflow_recipe: Annotation<WorkflowRecipe | null>(),

  // Page state
  current_url: Annotation<string>(),
  page_title: Annotation<string>(),
  page_snapshot: Annotation<PageStateModel | null>(),
  screenshot_b64: Annotation<string | null>(),

  // Mutation monitoring
  pending_mutations: Annotation<number>({ default: () => 0 }),
  mutation_timeout_ms: Annotation<number>({ default: () => 2000 }),

  // Action tracking
  last_action: Annotation<ActionRecord | null>(),
  expected_outcome: Annotation<string | null>(),
  verify_strategy: Annotation<VerifyStrategy | null>(),
  verify_result: Annotation<VerifyResult | null>(),

  // Retry control
  retry_count: Annotation<number>(),
  max_retries: Annotation<number>({ default: () => 3 }),

  // Data extraction (multi-scroll merge reducer from v3.1)
  extracted_data: Annotation<Record<string, any>[]>({
    reducer: (existing, incoming) => {
      const merged = [...existing];
      for (const item of incoming) {
        const key = (item as any)._merge_key;
        const idx = key ? merged.findIndex(e => (e as any)._merge_key === key) : -1;
        if (idx >= 0) merged[idx] = { ...merged[idx], ...item };
        else merged.push(item);
      }
      return merged;
    },
    default: () => []
  }),

  // Human-in-the-loop
  requires_human: Annotation<boolean>({ default: () => false }),
  human_response: Annotation<string | null>(),
  hitl_reason: Annotation<string | null>(),

  // Safety
  action_class: Annotation<ActionClass | null>(),
  domain_policy: Annotation<DomainPolicy | null>(),

  // Rate limiting
  last_action_timestamp: Annotation<number>(),
  min_action_interval_ms: Annotation<number>({ default: () => 2000 }),

  // Browse completion
  is_complete: Annotation<boolean>({ default: () => false }),
  completion_reason: Annotation<CompletionReason | null>(),

  // Session
  session_id: Annotation<string>(),
  start_url: Annotation<string>(),
  budget_remaining_usd: Annotation<number>(),

  // === AUDIT ORCHESTRATOR STATE (new) ===

  audit_run_id: Annotation<string>(),
  client_id: Annotation<string>(),
  client_profile: Annotation<ClientProfile | null>(),

  // Mode tracking
  current_mode: Annotation<AuditMode>({ default: () => "browse" }),

  // Page queue
  page_queue: Annotation<AuditPage[]>({ default: () => [] }),
  current_page_index: Annotation<number>({ default: () => 0 }),
  current_page_type: Annotation<PageType>(),
  business_type: Annotation<BusinessType>(),

  // Heuristic knowledge
  heuristic_knowledge_base: Annotation<HeuristicKnowledgeBase | null>(),
  filtered_heuristics: Annotation<Heuristic[]>({ default: () => [] }),

  // === ANALYZE STATE (new) ===

  analyze_perception: Annotation<AnalyzePerception | null>(),
  viewport_screenshot: Annotation<string | null>(),     // base64
  fullpage_screenshot: Annotation<string | null>(),     // base64

  // Pipeline outputs
  raw_findings: Annotation<RawFinding[]>({
    reducer: (_, incoming) => incoming,                  // replace, not append
    default: () => []
  }),
  reviewed_findings: Annotation<ReviewedFinding[]>({
    reducer: (_, incoming) => incoming,
    default: () => []
  }),
  grounded_findings: Annotation<GroundedFinding[]>({
    reducer: (_, incoming) => incoming,
    default: () => []
  }),
  rejected_findings: Annotation<RejectedFinding[]>({
    reducer: (existing, incoming) => [...existing, ...incoming],
    default: () => []
  }),
  critique_summary: Annotation<CritiqueSummary | null>(),

  // Annotation
  annotated_screenshots: Annotation<AnnotatedScreenshot[]>({
    reducer: (existing, incoming) => [...existing, ...incoming],
    default: () => []
  }),

  // Findings accumulator (across all pages in audit)
  findings: Annotation<GroundedFinding[]>({
    reducer: (existing, incoming) => [...existing, ...incoming],
    default: () => []
  }),

  // Audit progress
  pages_analyzed: Annotation<number>({ default: () => 0 }),
  total_findings: Annotation<number>({ default: () => 0 }),

  // === ANALYSIS COST TRACKING ===

  analysis_cost_usd: Annotation<number>({ default: () => 0 }),
  analysis_budget_usd: Annotation<number>({ default: () => 5.0 }),    // per page
  evaluate_retry_count: Annotation<number>({ default: () => 0 }),
  evaluate_token_count: Annotation<number>({ default: () => 0 }),
  critique_token_count: Annotation<number>({ default: () => 0 }),

  // === COMPETITOR ===

  competitor_urls: Annotation<string[]>({ default: () => [] }),
  competitor_data: Annotation<Map<string, AnalyzePerception>>({
    reducer: (existing, incoming) => new Map([...existing, ...incoming]),
    default: () => new Map()
  }),

  // === STATUS ===

  analysis_complete: Annotation<boolean>({ default: () => false }),
  analysis_error: Annotation<string | null>(),
  steps_completed: Annotation<string[]>({
    reducer: (existing, incoming) => [...existing, ...incoming],
    default: () => []
  }),
});
```

---

## 5.4 State Invariants

**REQ-STATE-INV-001:** `current_step` SHALL NEVER exceed `max_steps`. Browse subgraph terminates if violated.

**REQ-STATE-INV-002:** `confidence_score` SHALL be between 0.0 and 1.0 inclusive.

**REQ-STATE-INV-003:** If `is_complete === true`, then `completion_reason` SHALL NOT be null.

**REQ-STATE-INV-004:** If `execution_mode === "computer_use"`, then `current_step` SHALL NOT exceed 10.

**REQ-STATE-INV-005:** `budget_remaining_usd` SHALL NEVER be negative. If exhausted, audit terminates with `completion_reason = "budget_exceeded"`.

**REQ-STATE-INV-006:** `filtered_heuristics.length` SHALL be between 1 and 30 when entering analyze subgraph. If 0, page is skipped with error.

**REQ-STATE-INV-007:** `grounded_findings` SHALL be a subset of `reviewed_findings`. No finding can be grounded without passing self-critique.

**REQ-STATE-INV-008:** `current_page_index` SHALL never exceed `page_queue.length`. Audit cap: max 50 pages.

---

## 5.5 State Lifecycle Across Subgraphs

```
1. AUDIT_SETUP creates state with:
     audit_run_id, client_id, client_profile, page_queue
     heuristic_knowledge_base = filterByBusinessType(allHeuristics, business_type)
       (Stage 1: pre-filtered by business type — ~60-70 from 100, per §9.6 REQ-HK-020a)
     current_page_index = 0, pages_analyzed = 0

2. PAGE_ROUTER sets:
     current_url = page_queue[current_page_index].url
     current_page_type = page_queue[current_page_index].pageType
     current_mode = "browse"
     filtered_heuristics = filterByPageType(heuristic_knowledge_base, current_page_type)
       (Stage 2: filtered by page type — ~15-20 from ~60-70, per §9.6 REQ-HK-020b)

3. BROWSE SUBGRAPH (v3.1) reads/writes:
     messages, task, current_step, page_snapshot, screenshot_b64,
     last_action, verify_result, confidence_score, etc.
     Sets: is_complete = true, completion_reason = "success" when page ready

4. After browse, ORCHESTRATOR resets:
     is_complete = false, current_mode = "analyze"

5. ANALYZE SUBGRAPH reads:
     page_snapshot, screenshot_b64, current_url (from browse output)
     filtered_heuristics (from page_router)
   ANALYZE SUBGRAPH writes:
     analyze_perception, viewport_screenshot, fullpage_screenshot,
     raw_findings → reviewed_findings → grounded_findings → annotated_screenshots
     findings (accumulated), pages_analyzed++

6. PAGE_ROUTER advances:
     current_page_index++
     Resets browse state for next page

7. AUDIT_COMPLETE finalizes:
     status updated to "completed" or "budget_exceeded" or "failed"
```

---

## 5.6 Serialization

**REQ-STATE-SERIAL-001:** All AuditState fields SHALL be JSON-serializable for PostgreSQL checkpointing via LangGraph's `PostgresCheckpointer`.

**REQ-STATE-SERIAL-002:** `competitor_data` (Map) SHALL be serialized as `[[key, value], ...]` array of tuples and reconstructed on load.

**REQ-STATE-SERIAL-003:** Screenshots in state (`screenshot_b64`, `viewport_screenshot`, `fullpage_screenshot`) SHALL be cleared from state after writing to R2 storage to prevent checkpoint bloat.

---

## 5.7 Master Architecture Extensions (Phase 6+)

**Status:** Forward-compatible schema additions introduced by the locked master architecture. Phase 1-5 (MVP) implementations MAY leave these fields at default values. Phase 6+ implementations SHALL populate and honour them.

**Cross-references:**
- §18 (Trigger Gateway) — `F1`
- §19 (Discovery & Templates) — `F2`, Phase 6
- §20 (State Exploration) — `F3`, Phase 7
- §21 (Workflow Orchestration) — `F4`, Phase 8
- §23 (Findings Engine Extended) — `F6`, Phase 8
- §25 (Reproducibility) — `F8`, Phase 6

### 5.7.1 Supporting Types (Extensions)

```typescript
// === Template & Discovery (§19 — F2, Phase 6) ===

export type TemplateId = string;            // deterministic cluster id

export interface Template {
  id: TemplateId;
  audit_run_id: string;
  url_pattern: string | null;                // e.g., "/product/{slug}"
  structural_hash: string;                   // minhash fingerprint
  classified_type: PageType;
  classification_source: "rule" | "llm_fallback";
  classification_confidence: number;         // 0..1
  member_count: number;
  representative_urls: string[];             // 1-3 picked
  tags: string[];                            // semantic tags (e.g., "luxury", "long-form")
}

// === State Exploration (§20 — F3, Phase 7) ===

// S8-FIX: Canonical StateId computation
// StateId = sha256(canonicalJSON({ url, interactions: path.map(i => [i.type, i.target_ref, i.value ?? ""]) }))
// canonicalJSON = sorted keys, no whitespace, UTF-8
export type StateId = string;                // deterministic content hash

export type InteractionType =
  | "click" | "hover" | "select" | "type"
  | "press_key" | "scroll_to" | "navigate";

export interface Interaction {
  type: InteractionType;
  target_ref: string;                        // AX ref or stable selector
  target_label: string;                      // human-readable
  value?: string;                            // for type/select
  captured_at: number;
}

export type InteractionPath = Interaction[];

export type ExplorationPass =
  | "pass_1_heuristic_primed"
  | "pass_2_bounded_exhaustive";

export type ExplorationTrigger =
  | "rule_matched"                           // Pass 1: a heuristic's preferred_states required this
  | "self_critique_flag"                     // Pass 2: analysis flagged hidden content
  | "unexplored_ratio_threshold"             // Pass 2: >50% disclosures unexplored
  | "thorough_mode"                          // Pass 2: client config requested it
  | "confidence_below_threshold";            // Pass 2: analysis confidence low + hidden cited

export interface ExplorationTriggerRecord {
  trigger: ExplorationTrigger;
  pass: ExplorationPass;
  heuristic_id?: string;
  rule_id?: string;
  notes?: string;
}

// M1-FIX: Renamed from StateNode to StateNode to avoid confusion with PageStateModel (browse perception)
export interface StateNode {
  state_id: StateId;
  url: string;
  interaction_path: InteractionPath;
  discovered_in_pass: ExplorationPass;
  dom_hash: string;
  text_hash: string;
  is_default_state: boolean;
  parent_state_id: StateId | null;
  perception: AnalyzePerception;
  viewport_screenshot_ref: string | null;    // R2 key
  fullpage_screenshot_ref: string | null;
  discovered_at: number;
  trigger: ExplorationTriggerRecord;
  meaningful: boolean;                       // passed meaningful-state detection
}

export interface StateGraph {
  page_url: string;
  default_state_id: StateId;
  states: StateNode[];                // C5-FIX: Array, not Map (serialization-friendly; max 15 per REQ-STATE-EXT-INV-005)
  edges: Array<{ from: StateId; to: StateId; interaction: Interaction }>;
  // Helper: getStateById(graph, id) = graph.states.find(s => s.state_id === id) — O(15) max
  exploration_cost_usd: number;
  exploration_cost_cap_usd: number;
  exploration_runtime_ms: number;
  exploration_runtime_cap_ms: number;
  pass_2_triggered: boolean;
  pass_2_trigger_reasons: ExplorationTriggerRecord[];
  truncated: boolean;                        // true if a cap was hit before completion
  truncation_reason?: "budget" | "runtime" | "max_states" | "max_depth" | "max_interactions";
}

// === Multi-State Perception (§20 — F3, Phase 7) ===

export interface MultiStatePerception {
  page_url: string;
  default_state: AnalyzePerception;
  hidden_states: Array<{
    state_id: StateId;
    interaction_path: InteractionPath;
    perception: AnalyzePerception;
  }>;
  merged_view: AnalyzePerception;            // cross-state synthesis for heuristic evaluation
  state_provenance: Record<string, StateId>; // C5-FIX: Record not Map; maps merged_view element refs back to source state
}

// === Workflow (§21 — F4, Phase 8) ===

export type WorkflowId = string;

export type FunnelPosition =
  | "entry" | "discovery" | "decision"
  | "intent" | "conversion" | "post_conversion";

export interface WorkflowStepRef {
  step_index: number;
  page_url: string;
  page_type: PageType;
  funnel_position: FunnelPosition;
  entry_state_id: StateId;
  exit_state_id: StateId | null;
  transition_verify_result: VerifyResult | null;
  traversal_success: boolean;
  step_findings_count: number;
}

export interface WorkflowContext {
  workflow_id: WorkflowId;
  name: string;                              // e.g., "ecommerce-checkout"
  business_model: BusinessType;
  expected_steps: number;
  steps_traversed: number;
  current_step_index: number;
  steps: WorkflowStepRef[];
  abandoned: boolean;
  abandon_reason: string | null;
  workflow_budget_usd: number;
  workflow_budget_spent_usd: number;
}

// === Finding Rollups (§23 — F6, Phase 8) ===

export type FindingScope = "atomic" | "page" | "template" | "workflow" | "audit";

export interface FindingRollupRef {
  parent_finding_id: string;
  parent_scope: FindingScope;
  child_finding_ids: string[];
  rollup_reason:
    | "cross_state_merge"                    // same page, different states
    | "same_template"                        // pages of same template
    | "same_workflow"                        // within a funnel
    | "semantic_duplicate"                   // embedding similarity > threshold
    | "cross_page_consistency";              // site-wide inconsistency
  merge_count: number;
}

// === Reproducibility Snapshot (§25 — F8, Phase 6) ===

export interface ReproducibilitySnapshot {
  audit_run_id: string;
  captured_at: string;                       // ISO
  prompt_versions: {
    evaluate: string;                        // file hash
    critique: string;
    comparison: string;
    workflow_analysis: string;
  };
  model_versions: {
    evaluate_model: string;                  // e.g., "claude-sonnet-4-20260301"
    evaluate_temperature: number;            // MUST be 0 per Q4-R ruling
    critique_model: string;
    critique_temperature: number;            // MUST be 0 per Q4-R ruling
    vision_model: string | null;
  };
  heuristic_set: {
    base_version: string;
    overlay_chain_hash: string;              // hash of business + brand + client + learned overlays
    heuristic_ids: string[];                 // full list used this run
  };
  normalizer_version: string;
  grounding_rule_set_version: string;
  discovery_config_version: string;
  state_exploration_policy_version: string;
  deterministic_scoring_version: string;
}
```

### 5.7.2 Extended `AuditState` Fields

**REQ-STATE-EXT-001:** The `AuditState` schema from §5.3 SHALL be extended with the following fields. These are OPTIONAL (defaults permitted) for Phase 1-5 implementations and REQUIRED for Phase 6+ implementations.

```typescript
// === Trigger provenance (Phase 6) ===

// FC-1-FIX: Added defaults for Phase 1-5 backward compatibility
trigger_source: Annotation<"cli" | "mcp" | "consultant_dashboard" | "client_dashboard" | "scheduler">({ default: () => "consultant_dashboard" as const }),
audit_request_id: Annotation<string>({ default: () => "" }),

// === Template & Discovery (Phase 6) ===

templates: Annotation<Template[]>({ default: () => [] }),
discovered_templates_count: Annotation<number>({ default: () => 0 }),
template_coverage_pct: Annotation<number>({ default: () => 0 }),
current_template_id: Annotation<TemplateId | null>({ default: () => null }),

// === State Exploration (Phase 7) ===

state_graph: Annotation<StateGraph | null>({ default: () => null }),
multi_state_perception: Annotation<MultiStatePerception | null>({ default: () => null }),
current_state_id: Annotation<StateId | null>({ default: () => null }),
// X5-FIX: This is the AUDIT-WIDE cumulative exploration cost (sum across all pages).
// Per-page exploration cost lives in state_graph.exploration_cost_usd (per-page running total).
// state_graph.exploration_cost_cap_usd is the per-page cap.
// This field is the aggregate, updated after each page's exploration completes.
exploration_cost_usd: Annotation<number>({ default: () => 0 }),
exploration_budget_usd: Annotation<number>({ default: () => 0.50 }),      // per-PAGE cap (applied to each state_graph)
exploration_pass_1_interactions: Annotation<number>({ default: () => 0 }),
exploration_pass_2_triggered: Annotation<boolean>({ default: () => false }),
exploration_pass_2_reasons: Annotation<ExplorationTriggerRecord[]>({ default: () => [] }),

// === Workflow (Phase 8) ===

workflow_context: Annotation<WorkflowContext | null>({ default: () => null }),
current_workflow_id: Annotation<WorkflowId | null>({ default: () => null }),

// === Finding Rollups (Phase 8) ===

finding_rollups: Annotation<FindingRollupRef[]>({
  reducer: (existing, incoming) => [...existing, ...incoming],
  default: () => []
}),

// === Deterministic Scoring Inputs (Phase 8) ===
// S1-FIX: business_impact_weights and effort_category_map are GLOBAL config,
// not per-audit state. They are loaded via ScoringConfigLoader service at
// audit setup and pinned via reproducibility_snapshot.deterministic_scoring_version.
// NOT stored in AuditState (avoids checkpoint bloat).
// Access: ScoringConfigLoader.getImpactMatrix(), ScoringConfigLoader.getEffortMap()

// === Reproducibility (Phase 6) ===

reproducibility_snapshot: Annotation<ReproducibilitySnapshot | null>({ default: () => null }),

// === Two-store publish projection (Phase 6, §24 — F7) ===
// X3-FIX: This in-state field is a CONVENIENCE ACCESSOR for the current run.
// Source of truth is the published_findings view (§13.6.11).
// After audit completion, this field is stale — always query the view for live data.

published_finding_ids: Annotation<string[]>({
  reducer: (existing, incoming) => [...new Set([...existing, ...incoming])],
  default: () => []
}),
warmup_mode_active: Annotation<boolean>({ default: () => true }),           // per Q5 ruling, default ON for new clients
```

### 5.7.3 Extended Invariants

**REQ-STATE-EXT-INV-001:** If `state_graph` is non-null, then `multi_state_perception` SHALL also be non-null after `deep_perceive` completes.

**REQ-STATE-EXT-INV-002:** `state_graph.exploration_cost_usd` SHALL NEVER exceed `state_graph.exploration_cost_cap_usd`. When exceeded, exploration halts, `truncated = true`, and `truncation_reason` is set.

**REQ-STATE-EXT-INV-003:** Every `StateNode` with `is_default_state === false` SHALL have a non-empty `interaction_path` and a non-null `parent_state_id` pointing to an existing state in `state_graph.states`.

**REQ-STATE-EXT-INV-004:** Exactly one `StateNode` in `state_graph.states` SHALL have `is_default_state === true`, and its `state_id` SHALL equal `state_graph.default_state_id`.

**REQ-STATE-EXT-INV-005:** `state_graph.states.size` SHALL NOT exceed the per-page state cap (default 15 — §20 F3).

**REQ-STATE-EXT-INV-006:** Pass 1 exploration SHALL run before Pass 2. `exploration_pass_2_triggered` SHALL be false unless `exploration_pass_1_interactions >= 0` has completed.

**REQ-STATE-EXT-INV-007:** If `workflow_context` is non-null, then `current_workflow_id === workflow_context.workflow_id`.

**REQ-STATE-EXT-INV-008:** `workflow_context.workflow_budget_spent_usd` SHALL NEVER exceed `workflow_context.workflow_budget_usd`.

**REQ-STATE-EXT-INV-009:** `finding_rollups[].child_finding_ids` SHALL reference existing finding IDs in the current `findings` accumulator OR in prior audit runs of the same client.

**REQ-STATE-EXT-INV-010:** `reproducibility_snapshot` SHALL be set before the first LLM call of the audit and IMMUTABLE thereafter. Mutation is a runtime error.

**REQ-STATE-EXT-INV-011:** `reproducibility_snapshot.model_versions.evaluate_temperature` SHALL be `0` and `reproducibility_snapshot.model_versions.critique_temperature` SHALL be `0` (Q4-R ruling).

**REQ-STATE-EXT-INV-012:** `exploration_cost_usd` SHALL be included in `budget_remaining_usd` accounting.

**REQ-STATE-EXT-INV-013:** `published_finding_ids` SHALL be a subset of `findings.map(f => f.id)`. A finding ID in `published_finding_ids` that is not in `findings` is a runtime error.

**REQ-STATE-EXT-INV-014:** If `warmup_mode_active === true`, NO finding SHALL be auto-published regardless of its confidence tier. Only consultant-approved findings reach the published store during warm-up.

### 5.7.4 Backward Compatibility Rules

**REQ-STATE-EXT-COMPAT-001:** Phase 1-5 (MVP) implementations MAY leave all §5.7 fields at their defaults. The base `AuditState` from §5.3 remains fully functional without §5.7 extensions.

**REQ-STATE-EXT-COMPAT-002:** Phase 6+ nodes that depend on §5.7 fields SHALL check for null/default values and degrade gracefully — e.g., if `state_graph` is null, treat perception as single-state (equivalent to Phase 1-5 behaviour).

**REQ-STATE-EXT-COMPAT-003:** (C5-FIX) §5.7 uses Arrays and Records (not Maps) for serialization friendliness. `state_graph.states` is an `StateNode[]`, `multi_state_perception.state_provenance` is a `Record<string, StateId>`. Both serialize natively to JSON without custom encoders.

**REQ-STATE-EXT-COMPAT-004:** §5.7 fields SHALL NEVER be mandatory parameters of existing Phase 1-5 node interfaces. Extension consumers SHALL read them from state, not request them via signature.

### 5.7.5 Cross-Reference Map

| Field | Owned By | Populated In |
|---|---|---|
| `trigger_source`, `audit_request_id` | §18 Trigger Gateway (F1) | Pre-orchestrator |
| `templates[]`, `current_template_id` | §19 Discovery (F2) | `audit_setup` extended |
| `state_graph`, `multi_state_perception` | §20 State Exploration (F3) | New node: `explore_states` in browse subgraph |
| `workflow_context` | §21 Workflow Orchestration (F4) | Workflow Orchestrator tier |
| `finding_rollups` | §23 Findings Engine (F6) | `audit_complete` extended |
| `reproducibility_snapshot` | §25 Reproducibility (F8) | `audit_setup` extended |
| `published_finding_ids`, `warmup_mode_active` | §24 Two-Store Pattern (F7) | Review gate workflow |

---

**End of §5 — Unified State Schema (base §5.1-5.6 + master extensions §5.7)**

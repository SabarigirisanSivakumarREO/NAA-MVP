/**
 * Phase 4b T4B-011 — ContextCaptureNode: orchestration node that composes the
 * full Phase 4b inference pipeline into a single halt-or-complete state
 * transition, persists the resulting ContextProfile to the append-only
 * `context_profiles` table, and surfaces blocking open_questions for CLI
 * clarification (T4B-010).
 *
 * CANONICAL AUTHORITY:
 *   docs/specs/mvp/phases/phase-4b-context-capture/spec.md AC-11 + R-11 +
 *     §"User Story 1" (capture flow) + §"User Story 3" (halt/resume)
 *   docs/specs/mvp/phases/phase-4b-context-capture/plan.md §1 sequencing +
 *     §2.3 SHA-256 hash helper (canonical-JSON, keys sorted) + §3 risk
 *     register (AuditState slot risk → mitigated by state.ts forward-stub)
 *   docs/specs/mvp/phases/phase-4b-context-capture/tasks.md T4B-011 (L161-166)
 *   docs/specs/final-architecture/37-context-capture-layer.md §37.3 flow:
 *     HtmlFetcher → JsonLdParser → URLPatternMatcher → BusinessArchetypeInferrer
 *     → PageTypeInferrer → ConfidenceScorer → OpenQuestionsBuilder →
 *     ProvenanceAssembler → SHA-256 → freeze → persist.
 *
 * # Contract (AC-11)
 *
 *   run({request, state}) → {state, profile?, blocking_questions?}
 *     - Returns updated AuditState (complete OR halted) + populated profile
 *       (when complete) or blocking_questions (when halted).
 *     - On halt, profile is NOT persisted; resume() persists after answers fold in.
 *
 *   resume({state, answers}) → {state, profile?, blocking_questions?}
 *     - Validates state.node_status === 'halted'.
 *     - Routes ClarificationAnswer[] through two channels:
 *         a) intake-mapped paths fold into a synthetic AuditRequest;
 *         b) post-inference paths flow as answerOverrides → composeDimensions.
 *     - Re-runs the pipeline. Same intake + same answers → same hash (R-03).
 *
 * # Pipeline (run())
 *
 *   1. AuditRequestSchema.parse(request) + AuditStateSchema.parse(state).
 *   2. HtmlFetcher.fetch — robots-gated. Fail → log CONTEXT_FETCH_FAILED warn
 *      + proceed with empty HTML (URL-only per spec §Edge Cases L219).
 *   3. JsonLdParser.parse → jsonLdBlocks.
 *   4. BusinessArchetypeInferrer + PageTypeInferrer run on {url, html, blocks}.
 *   5. composeDimensions (intake-pass-through OR inferrer OR R25 silent-default).
 *   6. scoreConfidence (weighted 5-dim aggregate + threshold band).
 *   7. buildOpenQuestions (blocking on REQUIRED low-conf; warnings on mid).
 *   8. assembleProvenance (validate + sort + freeze).
 *   9. buildProfile (compose + SHA-256 canonical-JSON hash + Object.freeze + Zod parse).
 *  10. Halt branch: blocking questions → node_status='halted'; pending_questions
 *      = blocking_only; profile NOT persisted.
 *  11. Complete branch: persist to context_profiles (or warn CONTEXT_PERSIST_SKIPPED_NO_DB
 *      when DATABASE_URL unset); node_status='complete'; context_profile_id/_hash populated.
 *
 * # R20 sibling contracts
 *
 *   - AuditRequest (T4B-009) — input; full intake block consumed.
 *   - ContextProfile (T4B-001) — output; frozen + hashed + persisted.
 *   - AuditState (T4B-011 fwd-stub for T135) — context_profile_id/_hash + node_status.
 *   - ClarificationAnswer (T4B-010 shared shape) — resume() input.
 *   - context_profiles DB table (T4B-012) — persistence target.
 *
 * # Constitution compliance
 *
 *   R3.1 TDD: AC-11 conformance test written first; this impl follows.
 *   R10.1 file ≤ 300 LOC. R10.3 named exports only. R10.5 no console.log.
 *   R2 no `any`; HtmlFetcherLike is the DI seam.
 *   R6 no heuristic body in logs (only ids + counts + hash prefixes).
 *   R9 zero vendor SDK imports outside zod, crypto, internal modules,
 *     and the pino logger via createLogger. NO Playwright (R25).
 *     Drizzle consumed via lazy `import('../../db/client.js')` so CI without
 *     DATABASE_URL never touches the pool.
 *   R14 Pino correlation: audit_run_id, node_name='context_capture',
 *     client_id; profile_hash once known. NEVER logs heuristic body (R6).
 *   R25 No Playwright; no LLMAdapter (deterministic — composes 4 inferrers
 *     + 1 scorer + 2 builders).
 */
import {
  BusinessArchetypeInferrer,
} from '../../context/BusinessArchetypeInferrer.js';
import { JsonLdParser } from '../../context/JsonLdParser.js';
import { PageTypeInferrer } from '../../context/PageTypeInferrer.js';
import { scoreConfidence } from '../../context/ConfidenceScorer.js';
import { buildOpenQuestions } from '../../context/OpenQuestionsBuilder.js';
import { assembleProvenance } from '../../context/ProvenanceAssembler.js';
import { createLogger, type Logger } from '../../observability/logger.js';
import {
  AuditRequestSchema,
  type AuditRequest,
} from '../../types/audit-request.js';
import type {
  ContextProfile,
  OpenQuestion,
  ProvenanceEntry,
} from '../../types/context-profile.js';
import {
  type AuditState,
  AuditStateSchema,
  type ClarificationAnswer,
} from '../state.js';
import {
  applyAnswersToIntake,
  buildProfile,
  composeDimensions,
  isIntakePath,
  synthesizeRequestFromState,
} from './ContextCaptureNode.helpers.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Structural HtmlFetcher contract — DI seam (avoids hard import of full deps). */
export interface HtmlFetcherLike {
  fetch(
    url: string,
    opts: { auditRunId: string; clientId: string },
  ): Promise<{ html: string; statusCode: number; finalUrl: string; warnings: string[] }>;
}

export interface ContextCaptureNodeDeps {
  fetcher?: HtmlFetcherLike;
  logger?: Logger;
  /** Test seam — override the perception layer version stamped on meta. */
  perceptionLayerVersion?: string;
}

export interface ContextCaptureNodeRunInput {
  readonly request: AuditRequest;
  readonly state: AuditState;
  /**
   * Internal: override map for post-inference dimension fields. Used by
   * resume() to overlay ClarificationAnswers that don't map cleanly into
   * AuditRequest.intake (e.g., page.type). Keyed by dot-path.
   */
  readonly answerOverrides?: ReadonlyMap<string, unknown>;
}

export interface ContextCaptureNodeResumeInput {
  readonly state: AuditState;
  readonly answers: ReadonlyArray<ClarificationAnswer>;
  /** Original request — CLI normally preserves it across the halt. */
  readonly request?: AuditRequest;
}

export interface ContextCaptureNodeResult {
  readonly state: AuditState;
  readonly profile?: ContextProfile;
  /** Surfaced when state.node_status === 'halted'. */
  readonly blocking_questions?: ReadonlyArray<OpenQuestion>;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const NODE_NAME = 'context_capture';
const DEFAULT_PERCEPTION_VERSION = '0.4.0';

// ---------------------------------------------------------------------------
// ContextCaptureNode
// ---------------------------------------------------------------------------

export class ContextCaptureNode {
  readonly #fetcher: HtmlFetcherLike | undefined;
  readonly #logger: Logger;
  readonly #perceptionVersion: string;
  readonly #jsonLd = new JsonLdParser();
  readonly #archInfer = new BusinessArchetypeInferrer();
  readonly #pageInfer = new PageTypeInferrer();

  constructor(deps: ContextCaptureNodeDeps = {}) {
    this.#fetcher = deps.fetcher;
    this.#logger = deps.logger ?? createLogger('context-capture-node');
    this.#perceptionVersion = deps.perceptionLayerVersion ?? DEFAULT_PERCEPTION_VERSION;
  }

  async run(input: ContextCaptureNodeRunInput): Promise<ContextCaptureNodeResult> {
    const request = AuditRequestSchema.parse(input.request);
    const state = AuditStateSchema.parse(input.state);
    const child = this.#logger.child({
      audit_run_id: state.audit_run_id,
      client_id: state.client_id,
      node_name: NODE_NAME,
    });

    // Phase 4b is per-audit (one profile per AuditRequest even with multi-URL
    // input; multi-page synthesis is Phase 8 per spec §Out-of-Scope).
    const primaryUrl = request.urls[0]!;

    const { html, fetchWarnings } = await this.#tryFetch(primaryUrl, state, child);
    const { blocks: jsonLdBlocks, warnings: jsonLdWarnings } = this.#jsonLd.parse(html);

    const archResult = this.#archInfer.infer({ url: primaryUrl, html, jsonLdBlocks });
    const pageResult = this.#pageInfer.infer({ url: primaryUrl, html, jsonLdBlocks });

    const dims = composeDimensions({
      request,
      archResult,
      pageResult,
      answerOverrides: input.answerOverrides,
    });

    const score = scoreConfidence({
      business: dims.business,
      page: dims.page,
      audience: dims.audience,
      traffic: dims.traffic,
      brand: dims.brand,
    });

    const { open_questions } = buildOpenQuestions({
      business: dims.business,
      page: dims.page,
      audience: dims.audience,
      traffic: dims.traffic,
      brand: dims.brand,
      goal: dims.goal,
    });

    const provenanceEntries: ProvenanceEntry[] = [
      archResult.provenance,
      pageResult.provenance,
    ];
    const { provenance } = assembleProvenance({ entries: provenanceEntries });

    const profile = buildProfile({
      state,
      dims,
      score,
      openQuestions: open_questions,
      provenance,
      perceptionVersion: this.#perceptionVersion,
    });

    const blocking = open_questions.filter((q) => q.blocking);
    const now = new Date();
    child.info(
      {
        profile_hash: profile.profile_hash,
        overall_confidence: score.overall_confidence,
        threshold_action: score.threshold_action,
        blocking_count: blocking.length,
        warnings_count: open_questions.length - blocking.length,
        fetch_warnings: fetchWarnings.length,
        json_ld_warnings: jsonLdWarnings.length,
      },
      'context_capture: pipeline complete',
    );

    if (blocking.length > 0) {
      const haltedState: AuditState = {
        ...state,
        node_status: 'halted',
        pending_questions: [...blocking],
        updated_at: now,
      };
      child.info(
        { blocking_count: blocking.length },
        'context_capture: halted awaiting CLI clarification',
      );
      return { state: haltedState, blocking_questions: blocking };
    }

    await this.#persist(profile, child);

    const completeState: AuditState = {
      ...state,
      node_status: 'complete',
      context_profile_id: profile.id,
      context_profile_hash: profile.profile_hash,
      pending_questions: [],
      updated_at: now,
    };
    return { state: completeState, profile };
  }

  async resume(input: ContextCaptureNodeResumeInput): Promise<ContextCaptureNodeResult> {
    if (input.state.node_status !== 'halted') {
      throw new Error(
        `ContextCaptureNode.resume: expected node_status='halted', got '${input.state.node_status}'`,
      );
    }
    // Two-channel answer routing: intake-mapped paths fold into a synthetic
    // AuditRequest; non-intake paths (e.g., page.type) flow as overrides
    // consumed by composeDimensions() post-inference. Both deterministic →
    // same answers + same baseRequest produce the same hash (R-03).
    const baseRequest =
      input.request ?? synthesizeRequestFromState(input.state, input.answers);
    const intakeAnswers = input.answers.filter((a) => isIntakePath(a.field_path));
    const overrideAnswers = input.answers.filter((a) => !isIntakePath(a.field_path));
    const enriched = applyAnswersToIntake(baseRequest, intakeAnswers);
    const overrides = new Map<string, unknown>();
    for (const a of overrideAnswers) overrides.set(a.field_path, a.value);

    const pendingState: AuditState = {
      ...input.state,
      node_status: 'pending',
      pending_questions: [],
    };
    return this.run({ request: enriched, state: pendingState, answerOverrides: overrides });
  }

  async #tryFetch(
    url: string,
    state: AuditState,
    child: Logger,
  ): Promise<{ html: string; fetchWarnings: string[] }> {
    if (this.#fetcher === undefined) {
      child.info({ url }, 'context_capture: no HtmlFetcher provided; URL-only inference');
      return { html: '', fetchWarnings: ['CONTEXT_FETCH_FAILED'] };
    }
    try {
      const r = await this.#fetcher.fetch(url, {
        auditRunId: state.audit_run_id,
        clientId: state.client_id,
      });
      return { html: r.html, fetchWarnings: r.warnings };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      child.warn({ url, error: msg }, 'CONTEXT_FETCH_FAILED — degrading to URL-only inference');
      return { html: '', fetchWarnings: ['CONTEXT_FETCH_FAILED'] };
    }
  }

  async #persist(profile: ContextProfile, child: Logger): Promise<void> {
    const dbUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (dbUrl === undefined || dbUrl === '') {
      child.warn(
        { profile_hash: profile.profile_hash },
        'CONTEXT_PERSIST_SKIPPED_NO_DB — DATABASE_URL unset; in-memory profile only',
      );
      return;
    }
    try {
      // Lazy import keeps the DB client out of the hot path when unused
      // (e.g., conformance tests run thousands of in-memory cases).
      const { getDb } = await import('../../db/client.js');
      const { contextProfiles } = await import('../../db/schema.js');
      const db = getDb();
      await db.insert(contextProfiles).values({
        id: profile.id,
        auditRunId: profile.audit_run_id,
        clientId: profile.client_id,
        profileHash: profile.profile_hash,
        profileJson: profile as unknown as Record<string, unknown>,
      });
      child.info(
        { profile_hash: profile.profile_hash, profile_id: profile.id },
        'context_capture: profile persisted to context_profiles',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      child.warn(
        { profile_hash: profile.profile_hash, error: msg },
        'CONTEXT_PERSIST_FAILED — proceeding with in-memory profile',
      );
    }
  }
}

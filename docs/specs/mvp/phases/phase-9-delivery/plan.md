---
title: Phase 9 — Foundations + Delivery — Implementation Plan
artifact_type: plan
status: draft
version: 0.1
created: 2026-04-28
updated: 2026-04-28
owner: engineering lead
authors: [Claude (drafter)]
reviewers: []

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-9-delivery/spec.md
  - docs/specs/mvp/tasks-v2.md (Phase 9 sections — T156-T175 + T239-T244 + T245-T249 + T256-T257 + T260-T261)
  - docs/specs/final-architecture/14-delivery-layer.md
  - docs/specs/final-architecture/18-trigger-gateway.md §18.4 + §18.7 + §18.8
  - docs/specs/final-architecture/23-findings-engine-extended.md §23.4 + §23.5
  - docs/specs/final-architecture/24-two-store-pattern.md
  - docs/specs/final-architecture/25-reproducibility.md §25.3 + §25.4
  - docs/specs/final-architecture/34-observability.md
  - docs/specs/final-architecture/35-report-generation.md
  - docs/specs/mvp/phases/phase-8-orchestrator/spec.md (T145 scaffold supersession)
  - docs/specs/mvp/phases/phase-8-orchestrator/impact.md

req_ids:
  - REQ-TRIGGER-CONTRACT-001..004
  - REQ-TRIGGER-VALIDATE-001..003
  - REQ-TRIGGER-PERSIST-001..003
  - REQ-REPRO-001..010
  - REQ-REPRO-031..032
  - REQ-TWOSTORE-001..031
  - REQ-FINDINGS-SCORE-001..051
  - REQ-FINDINGS-SUPPRESS-001..002
  - REQ-DELIVERY-004..007
  - REQ-DELIVERY-REPORT-001..003
  - REQ-DELIVERY-OPS-001..003
  - REQ-DELIVERY-NOTIFY-001..003
  - REQ-REPORT-001..030
  - REQ-OBS-001..042

impact_analysis: docs/specs/mvp/phases/phase-9-delivery/impact.md
breaking: false
affected_contracts:
  - AuditRequest (PRODUCER — first runtime)
  - reproducibility_snapshot (PRODUCER — T160 full composition; supersedes Phase 8 T145 scaffold)
  - ScoredFinding (PRODUCER)
  - Hono API + Next.js render (PRODUCERS — first R6 channels 3+4 activation)
  - NotificationAdapter (PRODUCER — NEW)
  - DiscoveryStrategy (PRODUCER — NEW)
  - audit_events 22-event taxonomy (PRODUCER — completes after Phase 7/8 partial emit)

delta:
  new:
    - Phase 9 plan — sequencing (6 sub-blocks A→F), T160 supersession protocol, R6 channels 3+4 activation surface, ExecutiveSummary GR-007 enforcement, ★ MVP SPEC COMPLETE ★ acceptance gate, kill criteria
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R5.3 + GR-007 (no conversion predictions)
  - Constitution R6 (heuristic IP — channels 3+4 activate)
  - Constitution R7.4 (append-only)
  - Constitution R8.1 ($15 cap)
  - Constitution R10 + R13 (temp=0)
  - Constitution R14.1 (atomic llm_call_log)
  - Constitution R20 (Impact Analysis)
  - Constitution R23 (Kill Criteria)
---

# Phase 9 Implementation Plan

> **Summary (~150 tokens):** Implement 35 tasks (T156-T175 master foundations + T239-T244 observability + T245-T249 report generation + T256-T257 DiscoveryStrategy + T260-T261 NotificationAdapter) over ~10-12 engineering days in 6 sub-blocks: **Block A** Foundations core (T156-T168, ~3 days), **Block B** Dashboard core (T171→T169→T170→T172→T173, ~2 days), **Block C** Delivery core (T245→T246→T247→T248→T249, ~2 days), **Block D** Adapters (T256→T257→T260→T261, ~1 day), **Block E** Observability (T239→T240→T241→T242→T243, ~2 days), **Block F** Acceptance + ops dashboard LAST (T174→T175→T244, ~1-2 days). Highest-risk surfaces: **T160 SnapshotBuilder supersession of Phase 8 T145 scaffold** (same DDL, different writer); **R6 channels 3 + 4 first runtime activation** (heuristic body NEVER in Hono API or Next.js render — recursive conformance scan); **ExecutiveSummary GR-007 enforcement** (LLM output rejection + retry + deterministic fallback). ★ MVP SPEC COMPLETE ★ = AC-21 (T175 acceptance) + AC-26 (PDF) + AC-30 (email) + AC-36 (R6 ch3+4) all green = end of MVP spec authoring.

---

## 1. Sequencing

```
Block A — Foundations core (Days 1-3, ~22h):
  T156 AuditRequest contract (Zod)
  T157 AuditRequest defaults + validation
  T158 GatewayService.submit (sync; no HTTP, no Temporal)
  T159 CLI integration with Gateway (refactors Phase 8 T145)
  T160 SnapshotBuilder + loader (REPLACES Phase 8 T145 scaffold)   ← critical
  T161 TemperatureGuard
  T162 AccessModeMiddleware
  T163 WarmupManager
  T164 Extended StoreNode (two-store aware)
  T165 ScoringPipeline (4D)
  T166 IMPACT_MATRIX + EFFORT_MAP config
  T167 AnnotateNode + scoring integration
  T168 Suppression rules

Block B — Dashboard core (Days 4-5, ~16h):
  T171 apps/dashboard package + Next.js 15 + shadcn + Tailwind + Clerk auth
  T169 /console/review (held findings inbox)              ← R6 ch4 first ACT
  T170 /console/audits (list + New Audit form)
  T172 /console/review/[id] (finding detail + edit)        ← R6 ch4 ACT
  T173 /console/clients/[id] (warm-up status + override)

Block C — Delivery core (Days 6-7, ~16h):
  T245 ExecutiveSummaryGenerator (1 LLM call $0.10; GR-007)  ← critical
  T246 ExecutiveSummary integration (Phase 8 AuditCompleteNode extension)
  T247 ActionPlanGenerator (deterministic 4-quadrant bucketing)
  T248 Next.js report HTML template (8 sections)            ← R6 ch4 ACT
  T249 ReportGenerator (Playwright page.pdf; R2 upload)

Block D — Adapters (Day 8, ~8h):
  T256 DiscoveryStrategy interface + Sitemap + Manual + Nav-stub
  T257 DiscoveryStrategy integration in AuditSetupNode
  T260 NotificationAdapter + EmailNotificationAdapter (Resend)
  T261 Notification integration in AuditCompleteNode

Block E — Observability (Days 9-10, ~12h):
  T239 Pino structured logging (correlation fields complete)  ← R6 ch1 reaffirm
  T240 audit_events table + Drizzle migration
  T241 Event emission across all graph nodes (22 event types)
  T242 heuristic_health_metrics materialized view + nightly refresh
  T243 AlertingJob (BullMQ; 7 rules; debounced)

Block F — Acceptance + ops dashboard LAST (Days 11-12, ~10h):
  T174 Phase 9 integration test
  T175 ★ ACCEPTANCE TEST — Foundations on real audit (bbc.com 2-page)
  T244 /console/admin/operations (admin-only; build LAST per §35.6)

★ MVP SPEC COMPLETE ★ = AC-21 (T175) + AC-26 (PDF) + AC-30 (email) + AC-36 (R6 ch3+4) green
```

Dependencies (per tasks-v2.md):
- T156 ← T002
- T157 ← T156
- T158 ← T156, T157, T074 (DB adapter)
- T159 ← T158, T145 (Phase 8 CLI)  — refactors T145
- T160 ← T073 (LLMAdapter), T106 (HeuristicLoader); REPLACES T145 inline scaffold
- T161 ← T073
- T162 ← T070, T074
- T163 ← T074, T070
- T164 ← T132 (Phase 7 StoreNode), T163
- T165 ← T002, T115 (Phase 7 confidence tier)
- T166 ← T002
- T167 ← T165, T131 (Phase 7 AnnotateNode)
- T168 ← T165
- T169 ← T070, T162, T163
- T170 ← T158, T169
- T171 ← T002
- T172 ← T169
- T173 ← T163, T171
- T174 ← T158-T173
- T175 ← T174
- T245 ← T144 (Phase 8 AuditComplete), T217 (PatternFinding consumer — actually Phase 8 T139 in MVP)
- T246 ← T245
- T247 ← T135 (findings), T165 (ScoringPipeline)
- T248 ← T245, T247
- T249 ← T248
- T256 ← T002
- T257 ← T256, T137 (Phase 8 AuditSetupNode)
- T260 ← T002
- T261 ← T260, T144 (Phase 8 AuditCompleteNode actually T139)
- T239 ← T002
- T240 ← T070
- T241 ← T240
- T242 ← T070, T240
- T243 ← T241, T242, T260 (notification)
- T244 ← T241, T242, T171 (dashboard infrastructure)

---

## 2. T160 SnapshotBuilder Supersession of Phase 8 T145 Scaffold

This is one of the highest-coordination-risk surfaces in Phase 9. Phase 8 T145 ships a CLI-inline snapshot scaffold (per `phase-8-orchestrator/plan.md §5`); T160 must REPLACE it cleanly without breaking Phase 8 acceptance tests T148-T150.

**Supersession protocol:**

1. **Same DDL, different writer.** Phase 4 T070 schema baseline owns `reproducibility_snapshots` table DDL; both T145 (scaffold) and T160 (full) write rows of the same shape — only the field-population logic differs.
2. **CLI refactor (T159) is the surgical handoff point.** T159 deletes the inline scaffold from `apps/cli/src/commands/audit.ts` and inserts a call to `GatewayService.submit()`, which internally calls `SnapshotBuilder.createSnapshot()`. Same outcome (one snapshot row per audit); different code path.
3. **Sequential merge order:**
   - Land T156 (AuditRequest schema) → T157 (validation) → T158 (Gateway) → T160 (SnapshotBuilder) FIRST
   - Then land T159 (CLI refactor) which DEPENDS on all of A above + Phase 8 T145
   - Phase 8 T148-T150 acceptance tests RE-RUN after T159 lands; should still pass with full snapshot composition (richer than scaffold but functionally compatible).
4. **Backward-compat invariant:** `reproducibility_snapshots` row produced by T160 has all fields T145 scaffold produced PLUS additional fields (e.g., per-prompt SHA-256 hashes vs the scaffold's `hashFile()` placeholder). Phase 8 acceptance assertions check field PRESENCE, not field count, so T160 outputs satisfy.
5. **Snapshot immutability** enforced by Phase 4 DB trigger §13.6.7 — neither T145 nor T160 can mutate post-insert; T160 just produces a richer initial row.
6. **If T160 ships before Phase 8 T148-T150 land:** acceptable; T160 plug-replaces T145 scaffold cleanly per (1).
7. **If T160 ships after Phase 8 T148-T150:** still acceptable; T148-T150 already proved scaffold path works; T160 upgrades the writer; re-run T148 to verify upgraded snapshot still passes.

Risk if supersession fails: Phase 8 acceptance tests regress (T148-T150 red after T159 lands). Conformance test gate (AC-05 + AC-06 + Phase 8 AC-14/15/16) catches.

```ts
// packages/agent-core/src/reproducibility/SnapshotBuilder.ts (T160)
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { LLMAdapter } from '../adapters/LLMAdapter';
import { HeuristicLoader } from '../adapters/HeuristicLoader';
import { ContextProfile } from '../context/types';
import { db } from '../db/connection';

export class SnapshotBuilder {
  constructor(
    private llmAdapter: LLMAdapter,
    private heuristicLoader: HeuristicLoader,
  ) {}

  async createSnapshot(input: {
    audit_run_id: string;
    context_profile: ContextProfile;  // produced by Phase 4b
  }): Promise<ReproducibilitySnapshot> {
    const promptHashes = {
      evaluate: this.hashFile('packages/agent-core/src/analysis/prompts/evaluate.ts'),
      self_critique: this.hashFile('packages/agent-core/src/analysis/prompts/selfCritique.ts'),
      executive_summary: this.hashFile('packages/agent-core/src/delivery/prompts/executiveSummary.ts'),
    };

    const heuristicPack = await this.heuristicLoader.loadAll();
    const heuristicPackHash = this.hashJSON(heuristicPack);

    return {
      snapshot_id: input.audit_run_id,  // §13.6.7 UNIQUE constraint
      audit_run_id: input.audit_run_id,
      model_version: this.llmAdapter.getModelVersion(),  // claude-sonnet-4-{date}
      temperature_invariant: 0,  // R10/R13 + REQ-REPRO-001
      heuristic_pack_hash: heuristicPackHash,
      context_profile_hash: this.hashJSON(input.context_profile),
      perception_schema_version: 'v2.5',  // Phase 1c
      prompt_hashes: promptHashes,
      normalizer_version: this.getNormalizerVersion(),
      grounding_rule_set_version: this.getGroundingVersion(),
      deterministic_scoring_version: this.getScoringVersion(),
      created_at: new Date().toISOString(),
    };
  }

  async loadAndValidateSnapshot(auditRunId: string): Promise<ReproducibilitySnapshot> {
    const row = await db.query.reproducibility_snapshots.findFirst({
      where: (s, { eq }) => eq(s.audit_run_id, auditRunId),
    });
    if (!row) throw new SnapshotMissingError(auditRunId);  // REQ-REPRO-031b

    // Re-hash pinned input bytes; verify match (immutability check)
    const recomputedPromptHash = this.hashFile('packages/agent-core/src/analysis/prompts/evaluate.ts');
    if (recomputedPromptHash !== row.prompt_hashes.evaluate) {
      throw new SnapshotImmutabilityError(`prompt drift: ${row.snapshot_id}`);
    }
    return row;
  }

  private hashFile(path: string): string {
    return crypto.createHash('sha256').update(readFileSync(path)).digest('hex');
  }
  private hashJSON(obj: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
  }
}
```

---

## 3. R6 Channels 3 + 4 First-Runtime Activation Surface

Phase 9 activates the final 2 of 4 R6 enforcement channels. After Phase 9 ships, ALL 4 channels are live = first external pilot prereq satisfied (with v1.1 R6.2 AES at-rest layer added before pilot).

| Channel | Activation phase | Mechanism | Conformance test |
|---|---|---|---|
| 1 — Pino logs | Phase 6 (first); Phase 9 reaffirms end-to-end | Redaction list filters heuristic body; only heuristic_id logged | `pino-logger.test.ts` (T239) |
| 2 — LangSmith trace metadata | Phase 7 (first) | `metadata.private` for heuristic body; `metadata.public` for IDs | Phase 7 T134 trace inspection |
| 3 — Hono API responses | Phase 9 (first) | Response payload shape includes `heuristic_id` only; ALL `findings`/`patterns`/`audits` routes filtered through `redactHeuristicBody()` middleware | `r6-channel-3.test.ts` |
| 4 — Next.js dashboard render | Phase 9 (first) | Server components query findings/patterns; render only `heuristic_id` references; client components NEVER receive heuristic body in props | `r6-channel-4.test.ts` |

**Conformance test design:**

```ts
// packages/agent-core/tests/conformance/r6-channel-3.test.ts (T169-T173 backend coverage)
const HEURISTIC_BODY_FINGERPRINTS = [
  // Phase 6 first activation maintains the canonical redaction list;
  // import + reuse here:
  ...HeuristicRedactionList,
];

function deepScanForHeuristicBody(obj: unknown, fingerprints: string[]): string[] {
  const violations: string[] = [];
  function walk(v: unknown, path: string) {
    if (typeof v === 'string') {
      for (const fp of fingerprints) {
        if (v.includes(fp)) violations.push(`${path}: ${fp}`);
      }
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') {
      for (const [k, vv] of Object.entries(v as object)) walk(vv, `${path}.${k}`);
    }
  }
  walk(obj, 'response');
  return violations;
}

describe('R6 channel 3 — Hono API responses must NOT contain heuristic body', () => {
  it('GET /api/audits/:id/findings — heuristic body fingerprint absent', async () => {
    const resp = await fetch('/api/audits/test-audit-id/findings');
    const body = await resp.json();
    expect(deepScanForHeuristicBody(body, HEURISTIC_BODY_FINGERPRINTS)).toEqual([]);
  });
  it('GET /api/findings/:id', async () => { /* ... */ });
  it('GET /api/audits/:id/patterns', async () => { /* ... */ });
  it('GET /api/audits/:id/stream (SSE) — events do NOT contain heuristic body', async () => { /* ... */ });
});
```

```ts
// apps/dashboard/tests/conformance/r6-channel-4.test.ts (Next.js render coverage)
describe('R6 channel 4 — rendered HTML must NOT contain heuristic body', () => {
  it('/console/review — held findings list', async () => {
    const html = await renderPage('/console/review');
    expect(deepScanForHeuristicBody(html, HEURISTIC_BODY_FINGERPRINTS)).toEqual([]);
  });
  it('/console/review/[id] — finding detail', async () => { /* ... */ });
  it('/api/report/[id]/render — PDF HTML template', async () => { /* ... */ });
});
```

Risk if leaks: heuristic IP exposed via consultant-visible UI or PDF. Kill criterion (plan.md §7) triggers STOP on any R6 ch3/ch4 violation.

---

## 4. ExecutiveSummary GR-007 Enforcement

T245 makes 1 LLM call per audit ($0.10 cap, temperature=0) to generate `recommended_next_steps` (3-5 sentences). The output text is consultant-visible AND client-visible (PDF), so GR-007 deterministic regex MUST run before persist.

```ts
// packages/agent-core/src/delivery/ExecutiveSummaryGenerator.ts
import { groundGR007 } from '../analysis/grounding/rules/GR-007';

export class ExecutiveSummaryGenerator {
  async generate(input: {
    audit_run_id: string;
    grounded_findings: Finding[];
    cross_page_patterns: PatternFinding[];
  }): Promise<ExecutiveSummary> {
    const overall_score = this.computeScore(input.grounded_findings);  // REQ-REPORT-002
    const grade = this.gradeFromScore(overall_score);
    const top_findings = this.pickTop5(input.grounded_findings);
    const strengths = this.computeStrengths(input.grounded_findings);  // REQ-REPORT-003 pure code
    const category_breakdown = this.bucketByCategory(input.grounded_findings);

    // Single LLM call — REQ-REPORT-004
    let recommended_next_steps: string;
    let attempts = 0;
    while (true) {
      attempts++;
      const llmOutput = await this.llmAdapter.invoke({
        node: 'executive_summary',
        temperature: 0,
        budget_cap_usd: 0.10,
        prompt: this.buildPrompt(top_findings, input.cross_page_patterns),
      });

      // GR-007 deterministic enforcement — R5.3
      const gr007Verdict = groundGR007({ text: llmOutput.text });
      if (gr007Verdict.passes) {
        recommended_next_steps = llmOutput.text;
        break;
      }
      if (attempts >= 2) {
        // Fallback to deterministic message after 1 retry
        recommended_next_steps =
          'Review the top 5 findings with your CRO consultant for prioritization. ' +
          'See the action plan for quick-win opportunities.';
        break;
      }
    }

    return {
      overall_score,
      grade,
      top_findings,
      strengths,
      category_breakdown,
      recommended_next_steps,
    };
  }
}
```

GR-007 retry-then-fallback pattern preserves auditability (LLM call still logged to `llm_call_log`) AND avoids R5.3 violation reaching the consultant/client.

NF-05 budget gate: pre-call `getTokenCount()` estimate ensures `estimated_cost ≤ $0.10`; if exceeds, fail-closed with deterministic fallback (skip LLM call).

---

## 5. AuditRequest Contract (T156) — fields-only mirror of §18.4

```ts
// packages/agent-core/src/gateway/AuditRequest.ts (T156)
import { z } from 'zod';

export const AuditRequestSchema = z.object({
  id: z.string().uuid(),                              // server-generated; REQ-TRIGGER-CONTRACT-003
  client_id: z.string().uuid(),
  trigger_source: z.enum(['cli', 'consultant_dashboard', 'client_dashboard', 'mcp', 'scheduler']),
  target: z.object({
    url: z.string().url().optional(),                  // homepage seed for Sitemap/NavCrawl
    urls: z.array(z.string().url()).optional(),        // Manual discovery
    sitemap_url: z.string().url().optional(),
  }),
  scope: z.object({
    max_pages: z.number().int().min(1).max(50).default(50),
    viewports: z.array(z.enum(['desktop', 'mobile'])).default(['desktop']),
    discovery_strategy: z.enum(['sitemap', 'manual', 'nav-crawl']).default('sitemap'),
    business_type: z.enum(['ecommerce', 'saas', 'leadgen', 'media']),
    include_positive_findings: z.boolean().default(false),
  }),
  budget: z.object({
    audit: z.number().positive().max(15).default(15),  // R8.1
    page: z.number().positive().max(5).default(5),     // R8.2
  }),
  heuristic_set: z.object({
    pack_id: z.string(),
    version: z.string(),
    overlay: z.string().optional(),
  }),
  notifications: z.object({
    email: z.array(z.string().email()).default([]),
    webhook_url: z.string().url().optional(),          // deferred to v1.1
  }),
  constraints: z.object({
    regulatory: z.array(z.string()).optional(),        // GDPR, HIPAA, etc.
  }).optional(),
  tags: z.array(z.string()).default([]),                // S5-L2-FIX
  reason: z.string().optional(),                        // S5-L2-FIX
  external_correlation_id: z.string().optional(),       // S5-L2-FIX
  idempotency_key: z.string().optional(),               // REQ-TRIGGER-CONTRACT-004
});

export type AuditRequest = z.infer<typeof AuditRequestSchema>;
```

Note: `metadata` field intentionally NOT present (per S5-L2-FIX). Three explicit fields replace it: `tags`, `reason`, `external_correlation_id`.

---

## 6. Two-Store Pattern Activation

Phase 7 produces all findings to internal store (`access_mode: internal`); Phase 9 activates the published_findings view (REQ-TWOSTORE-030..031) and the publish action.

```sql
-- Phase 4 T070 schema baseline already defines published_findings view.
-- Phase 9 activates the access_mode middleware path:

-- Hono route handler (T169-T173 backend):
router.get('/api/audits/:id/findings', async (c) => {
  const audit_run_id = c.req.param('id');
  const access_mode = c.get('access_mode') ?? 'published_only';  // T162 fail-secure default
  const client_id = c.get('client_id');

  return await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.access_mode = ${access_mode}`);
    await tx.execute(sql`SET LOCAL app.client_id = ${client_id}`);

    if (access_mode === 'internal') {
      return c.json(await tx.query.findings.findMany({ where: eq(findings.audit_run_id, audit_run_id) }));
    } else {
      // published_only: query the view, NOT the base table
      return c.json(await tx.query.published_findings.findMany({ where: eq(published_findings.audit_run_id, audit_run_id) }));
    }
  });
});
```

Consultant dashboard sets `access_mode: internal` via middleware on `/console/*` routes; client-facing routes (deferred to v1.1) default to `published_only`.

WarmupManager + StoreNode extension (T163 + T164) ensures during warm-up: ALL findings have `publish_status: held`; published_findings view returns 0 rows (filters on `publish_status = 'published'`).

---

## 7. Kill Criteria (R23)

Phase 9 PAUSES (reverts to engineering lead review) if any of these triggers fire:

| Category | Trigger | Action |
|---|---|---|
| **T160 supersession failure** | Phase 8 T148-T150 acceptance tests RED after T159 CLI refactor lands | STOP. Revert T159; investigate T160 vs T145 scaffold field shape divergence. |
| **R6 channel 3 leak** | Conformance test detects heuristic body fingerprint in any Hono API response | STOP. Audit redaction middleware; reject all merged code touching the affected route until clean. |
| **R6 channel 4 leak** | Conformance test detects heuristic body fingerprint in any rendered HTML | STOP. Audit Next.js server-component query layer; reject merged code until clean. |
| **GR-007 false-negative on ExecutiveSummary** | Manual review spot-checks find banned phrase in shipped recommended_next_steps | STOP. Tighten GR-007 regex pattern; rerun against last 50 audits; fail-closed deterministic fallback if pattern can't be tightened. |
| **ExecutiveSummary $0.10 budget overrun** | `llm_call_log` row WHERE node="executive_summary" cost > $0.10 | STOP. Pre-call BudgetGate logic broken; audit `getTokenCount()` estimate vs actual. |
| **PDF render >30s** | T249 conformance test fails NF-03 | STOP. Audit Playwright `page.pdf()` config; check screenshot bloat (Phase 7 annotation regression?). |
| **PDF size >5MB** | T249 conformance test fails NF-04 | STOP. Audit screenshot inclusion; downsample if needed. |
| **Email deliverability regression** | Resend webhook reports >5% bounce rate over 24h | STOP. Audit From: domain SPF/DKIM; pause email sends until resolved. |
| **Reproducibility replay <90% overlap** | T160 loadAndValidateSnapshot path completes; finding overlap <0.9 vs original | DIAGNOSTIC alert (NOT failure per REQ-REPRO-006); investigate per REQ-REPRO-050; report does NOT fail acceptance. |
| **WarmupManager regression** | Test fails AC-09: graduation criteria misfire | STOP. Audit graduation logic + test cases. |
| **AccessModeMiddleware fail-open** | Route without explicit access_mode set returns internal data (any heuristic body in published_only response) | STOP. Critical security regression; audit middleware default. |
| **Spec contradiction** | Implementation reveals §14 / §18 / §23 / §24 / §25 / §34 / §35 spec defect | STOP. Fix spec first per R11.4. ASK FIRST before patching code-only. |
| **22-event taxonomy incomplete on T175** | DB query post-T175 finds <22 distinct event_types emitted | STOP. Audit EventEmitter injection; fix missing nodes. |
| **Scope creep** | Phase 9 adds new task IDs beyond T156-T175 + T239-T244 + T245-T249 + T256-T257 + T260-T261 | ESCALATE to engineering lead; no scope additions without spec amendment + tasks-v2.md patch. |

When kill criteria trigger: snapshot WIP to `wip/killed/<task-id>-<reason>` branch; log trigger reason in audit_events; escalate with specific failure mode; do NOT silently retry; do NOT `--no-verify`.

---

## 8. Acceptance gating

Phase 9 ships when ALL of:

1. T156-T175 + T239-T244 + T245-T249 + T256-T257 + T260-T261 merged (all 35 tasks)
2. **AC-21 (T175 acceptance) green** — bbc.com 2-page; reproducibility_snapshots row has temp=0 + 6 versions pinned; findings have business_impact + effort + priority + confidence != null; published_findings view returns 0 rows; audit_requests row trigger_source="cli"; dashboard shows held findings sorted by priority.
3. **AC-26 (PDF) green** — render <30s; size ≤5MB; 8 sections in order; R2 upload; URL persisted.
4. **AC-30 (email) green** — `audit_completed` event fires NotificationAdapter; Resend ack <60s.
5. **AC-36 (R6 channels 3+4) green** — recursive scan of every Hono response + every rendered HTML page detects ZERO heuristic body fingerprints.
6. AC-05 + AC-06 (T160 SnapshotBuilder createSnapshot + loadAndValidateSnapshot) green.
7. AC-15 / AC-16 / AC-17 / AC-18 / AC-19 (dashboard pages) green.
8. AC-22 / AC-23 (ExecutiveSummary) green; GR-007 conformance test passes on synthetic banned-phrase outputs.
9. AC-24 (ActionPlan deterministic bucketing) green.
10. AC-31 + AC-32 + AC-33 (Pino + audit_events) green; 22-event taxonomy fully emitted on T175 run.
11. NF-06 reproducibility replay ≥90% finding overlap (NF target; below-target is diagnostic per REQ-REPRO-006, not gate).
12. Phase 9 status: `verified`
13. `phase-9-current.md` rollup committed (Constitution R19) — last MVP rollup.
14. **★ MVP SPEC COMPLETE ★** declared in next session memory checkpoint; implementation can begin at Phase 0.

---

## 9. Effort estimate

| Block | Tasks | Engineering hours |
|---|---|---|
| Block A (foundations core) | T156-T168 (13 tasks) | ~22h |
| Block B (dashboard core) | T169-T173 (5 tasks) | ~16h |
| Block C (delivery core) | T245-T249 (5 tasks) | ~16h |
| Block D (adapters) | T256, T257, T260, T261 (4 tasks) | ~8h |
| Block E (observability) | T239-T243 (5 tasks) | ~12h |
| Block F (acceptance + ops dashboard LAST) | T174, T175, T244 (3 tasks) | ~10h |
| Buffer / coordination overhead | — | ~6h |
| **Total** | 35 tasks | **~90h ≈ 10-12 engineering days** |

Calendar: weeks 10-12 of MVP per PRD §14 timeline.

---

## 10. Risks (specific to Phase 9 execution)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| T160 SnapshotBuilder field shape divergence from Phase 8 T145 scaffold breaks T148-T150 | Medium | High | Sequential merge protocol §2; AC-05 + AC-06 conformance gate; re-run T148-T150 after T159 lands |
| R6 channel 3 leak via response middleware bug | Medium (first activation) | High (constitutional + competitive moat) | `r6-channel-3.test.ts` recursive deep scan; redactHeuristicBody() middleware applied to ALL routes by default; kill criterion |
| R6 channel 4 leak via Next.js server-component prop drilling | Medium (first activation) | High | `r6-channel-4.test.ts` rendered-HTML scan; server-only data layer for findings; kill criterion |
| ExecutiveSummary GR-007 false-negative reaches consultant | Low | High (R5.3 + reputational) | Retry-then-fallback pattern; manual spot-check during T175 acceptance; tighten regex if needed |
| ExecutiveSummary $0.10 budget overrun on long inputs | Medium | Medium | Pre-call `getTokenCount()` BudgetGate; truncate top_findings to 5 hard cap; abstract pattern summaries |
| PDF render >30s on findings-heavy audit (50 pages × 5 findings each) | Medium | Medium | Optimize HTML template (no heavy images inline; lazy-load); benchmark on T149 amazon.in fixture |
| PDF size >5MB due to screenshot inclusion | Medium | Low | Downsample annotated screenshots to 1280px; reuse Phase 7 ScreenshotStorage compression settings |
| Email deliverability — Resend SPF/DKIM not configured for `noreply@reodigital.io` | High (first integration) | Medium | DNS config + Resend domain verification BEFORE T260 implementation begins; test inbox in CI |
| Resend rate limit hit on bulk audit completion (Day-1 burst) | Low | Low | Resend free tier: 100/day; MVP audits ≤10/day expected; upgrade if exceeded |
| WarmupManager graduation logic edge case (e.g., 3 audits with 0% rejection but consultant rejects 4th audit's findings post-graduation) | Low | Low | Documented post-graduation path: rejection_rate window slides on next 5 audits |
| AccessModeMiddleware default fail-open (route without explicit access_mode set returns internal data) | Low | High | Default `published_only` per REQ-TWOSTORE-002 layered enforcement; conformance test asserts default |
| Hono SSE stream backpressure on long audits | Low | Low | Phase 4 baseline already wires Hono SSE; reuse |
| 22-event taxonomy incomplete (some node misses an event type) | Medium | Medium | T241 conformance test asserts all 22 event_types emit on T175 run; missing → list + fix |
| Materialized view refresh job conflicts with active audit DB writes | Low | Low | Nightly refresh window 3 AM UTC; T242 schedules during low-traffic |
| Clerk admin role flag missing for ops dashboard testing | Medium | Low | Pre-create test admin user in Clerk dev org; document in T244 setup |
| Postmark fallback NotificationAdapter implementation drift (interface doc'd but not impl'd) | Low | Low | Documented as v1.1 deferred; interface stub only in MVP |
| `pnpm cro:audit --replay <id>` flag adds CLI surface beyond T159 scope | Low | Low | Documented as small extension; covered in AC-04 acceptance |
| Phase 8 T144 PostgresCheckpointer interaction with T160 snapshot replay produces stale state | Low | Medium | Replay uses fresh state; PostgresCheckpointer is for in-progress audits, not replays |
| Phase 4 schema baseline missing `audit_runs.executive_summary` JSONB column | Medium | Low | Schema migration filed as task delta during T246 implementation; coordinate with Phase 4 owner |

---

## 11. Documentation deliverables (this session)

This session ships:

- `phase-9-delivery/spec.md` v0.1
- `phase-9-delivery/plan.md` v0.1 (this file)
- `phase-9-delivery/tasks.md` v0.1
- `phase-9-delivery/impact.md` v0.1 (R20 required, HIGH risk)
- `phase-9-delivery/README.md` v0.1
- `phase-9-delivery/checklists/requirements.md` v0.1

Plus:

- `INDEX.md` v1.2 → v1.3 (Phase 9 row marked spec-shipped)
- `tasks-v2.md` patched if drift found (Option A; v2.3.3 → v2.3.4 candidate)

After this session: **★ MVP SPEC COMPLETE ★** — all 15 phase folders shipped (0, 0b, 1, 1b, 1c, 2, 3, 4, 4b, 5, 5b, 6, 7, 8, 9). Implementation can start at Phase 0.

---

## 12. Coordination with predecessor phases

Phase 9 is the LAST MVP phase; it consumes outputs from many predecessors:

- **Phase 4b ContextProfile** → T160 SnapshotBuilder hashes profile into snapshot
- **Phase 6 HeuristicLoader** → T160 hashes heuristic pack
- **Phase 7 Finding lifecycle producer** → T245 + T247 + T249 consume grounded_findings
- **Phase 7 PageSignals (REQ-ANALYZE-CROSSPAGE-001)** → Phase 8 PatternDetector → T245 + T247 consume PatternFinding
- **Phase 7 AnnotateNode (T131)** → T167 extends with scoring pipeline
- **Phase 7 StoreNode (T132)** → T164 extends with two-store awareness
- **Phase 8 AuditCompleteNode (T139)** → T246 + T261 extend (executive summary integration; notification fire)
- **Phase 8 PostgresCheckpointer (T144)** → T240 audit_events runs alongside; non-conflicting
- **Phase 8 CLI (T145)** → T159 refactors + T160 supersedes scaffold
- **Phase 8 AuditState §5.7** → T156 AuditRequest persisted; T160 reproducibility_snapshot stored on AuditState

Phase 9 produces the final MVP-shippable artifacts (PDF, email, dashboard, ops dashboard). After Phase 9 ships and rollup is approved → MVP is shippable for first external pilot (with v1.1 R6.2 AES at-rest layer added before pilot).

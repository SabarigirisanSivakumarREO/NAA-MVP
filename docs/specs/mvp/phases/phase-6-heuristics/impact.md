---
title: Impact Analysis — Phase 6 Heuristic KB Engine (7 contracts; first R6 runtime enforcement)
artifact_type: impact
status: draft
version: 0.4
created: 2026-04-27
updated: 2026-04-30
owner: engineering lead

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-6-heuristics/spec.md (v0.4)
  - docs/specs/mvp/phases/phase-6-heuristics/plan.md (v0.4)
  - docs/specs/final-architecture/09-heuristic-kb.md
  - docs/specs/final-architecture/37-context-capture-layer.md §37.5 (REQ-CONTEXT-DOWNSTREAM-001 — v0.4 catch-up)
  - docs/specs/mvp/phases/phase-4b-context-capture/spec.md (T4B-013 — v0.4 catch-up)

req_ids:
  - REQ-HK-001
  - REQ-HK-EXT-001
  - REQ-HK-EXT-019
  - REQ-HK-EXT-050
  - REQ-HK-020a
  - REQ-HK-020b
  - REQ-CONTEXT-DOWNSTREAM-001          # v0.4 catch-up — loadForContext extension

breaking: false
risk_level: medium

affected_contracts:
  - HeuristicSchema
  - HeuristicSchemaExtended
  - HeuristicKnowledgeBase
  - HeuristicLoader
  - HeuristicFilter
  - TierValidator
  - DecryptionAdapter

delta:
  new:
    - Phase 6 first runtime activation of R6 IP protection
    - 4th + 5th adapter categories (HeuristicLoader, DecryptionAdapter)
    - v0.4 catch-up — Pino redaction-pattern → BenchmarkSchema mapping section (was missed in v0.2 sync; mirrors spec.md:101 / plan.md:171 Phase 0 Research item 3)
    - v0.4 catch-up — `HeuristicSchemaExtended` schema sketch updated with v0.3 manifest selector fields (`archetype`, `page_type`, `device`) for ContextProfile-aware filtering (AC-11 / T4B-013)
    - v0.4 catch-up — `HeuristicLoader` interface sketch updated with `loadForContext(profile: ContextProfile)` signature; implementation deliverable owned by Phase 4b T4B-013
    - v0.4 catch-up — Forward Contract section adds Phase 4b (T4B-013) sub-section between Phase 7 + Phase 0b
    - v0.4 catch-up — `REQ-CONTEXT-DOWNSTREAM-001` added to req_ids (was missed in v0.3 sync)
  changed:
    - v0.1 → v0.4 catch-up — Session 7 /speckit.analyze polish absorbed three pending updates that never reached this impact.md: (a) v0.2 Pino redaction-pattern → BenchmarkSchema discriminated-union mapping; (b) v0.3 contract surface for T4B-013 + AC-11 + R-09 + manifest selectors; (c) v0.4 H2 fix (HeuristicSchemaExtended sketch + HeuristicLoader interface stale shapes — would have left Phase 4b T4B-013 implementer reading wrong contracts). Coordinated with spec.md v0.3→v0.4 (M1), plan.md v0.2→v0.4 catch-up (M1 + v0.3 sync + H3), tasks.md v0.3→v0.4 (H1 redaction-path fix). No scope changes — pure documentation catch-up against decisions already locked in spec/tasks. R20 Migration plan unchanged (still Not applicable — additive). risk_level unchanged (still MEDIUM).
  impacted:
    - spec.md, plan.md, tasks.md (all v0.4 in same Session 7 sync)
    - Phase 4b T4B-013 — implementer reads this impact.md v0.4 Forward Contract section for the loadForContext signature + manifest selector contract
  unchanged:
    - All v0.1 sections preserved (Why R20 applies, Affected modules, Affected contracts schemas EXCEPT HeuristicSchemaExtended + HeuristicLoader, Migration plan, Risk level + mitigations, Verification, Provenance, Approval)
    - HeuristicSchemaBase / DecryptionAdapter / HeuristicKnowledgeBase / HeuristicFilter sketches unchanged
    - 7 affected_contracts list unchanged

governing_rules:
  - Constitution R6 (focal)
  - Constitution R9
  - Constitution R15.3
  - Constitution R18, R20, R22
---

# Impact Analysis: Heuristic engine + R6 first runtime enforcement

## Why R20 applies — MEDIUM risk

Phase 6 introduces 7 contracts in support of Neural's competitive moat (heuristic IP). risk_level **MEDIUM** because:
- Phase 6 is engine only — no heuristic content is authored here (Phase 0b delivers that). Smaller surface than Phase 4.
- R6 IP boundary FIRST activates at runtime. A leak here (heuristic body in any log/API/dashboard) is a critical R6 violation but conformance test catches via Pino transport spy.
- DecryptionAdapter interface design must accommodate v1.1's AES-256-GCM without re-shape — forward-compat seam.

## Affected modules

### Phase 6 itself

| File | Layer | Role |
|---|---|---|
| `packages/agent-core/src/analysis/heuristics/types.ts` | analysis/heuristics | HeuristicSchema (base) + HeuristicSchemaExtended Zod schemas + provenance block + KB container types |
| `packages/agent-core/src/analysis/heuristics/loader.ts` | analysis/heuristics | HeuristicLoader interface + FileSystemHeuristicLoader impl (R6 boundary) |
| `packages/agent-core/src/analysis/heuristics/filter.ts` | analysis/heuristics | filterByBusinessType + filterByPageType + prioritizeHeuristics pure functions |
| `packages/agent-core/src/analysis/heuristics/tier-validator.ts` | analysis/heuristics | Tier 1/2/3 classifier |
| `packages/agent-core/src/adapters/DecryptionAdapter.ts` | adapters | Interface + PlaintextDecryptor MVP impl |
| `packages/agent-core/src/analysis/heuristics/index.ts` | analysis/heuristics | barrel — exposes only typed surface (NOT raw heuristic content) |
| `packages/agent-core/src/observability/logger.ts` | observability | MODIFIED — add heuristic_loader_session_id, kb_size, filter_stage correlation fields; **register heuristic-content fields in Pino redaction config** so accidental log emissions are stripped |

### Downstream consumers

| Phase | File(s) | Imports |
|---|---|---|
| Phase 7 | `analysis/nodes/EvaluateNode.ts` | HeuristicLoader.loadAll() result + filterBy*+prioritize cycle; injects filtered heuristics into LLM user message per R5.5 |
| Phase 7 | `analysis/nodes/SelfCritiqueNode.ts` | Same filtered set + R6 redaction discipline preserved |
| Phase 8 | `orchestration/nodes/AuditSetupNode.ts` | Calls `filterByBusinessType` once per audit |
| Phase 8 | `orchestration/nodes/PageRouterNode.ts` | Calls `filterByPageType` per page (then prioritizeHeuristics) |
| Phase 0b (separate session) | `heuristics-repo/*.json` | LLM-assisted authoring per F-012 amendment; Phase 6's HeuristicSchemaExtended is the validation gate |

## Affected contracts (high-level shapes)

### `HeuristicSchemaExtended` (NEW; primary)

```ts
export const ProvenanceSchema = z.object({
  source_url: z.string().url(),
  citation_text: z.string().min(1),
  draft_model: z.union([z.literal('human'), z.string().regex(/^[a-z][a-z0-9-]+$/)]),  // model id or 'human'
  verified_by: z.string().min(1),
  verified_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),  // ISO date
}).strict();

export const BenchmarkSchema = z.discriminatedUnion('kind', [
  z.object({ kind: 'quantitative', metric: z.string(), value: z.number(), unit: z.string(), tolerance: z.number().optional() }),
  z.object({ kind: 'qualitative', standard_text: z.string() }),
]);

export const HeuristicSchemaBase = z.object({
  id: z.string().regex(/^[A-Z]+-[A-Z]+-\d{3}$/),  // e.g., BAY-CHECKOUT-001
  source: z.enum(['baymard', 'nielsen', 'cialdini']),
  category: z.string(),
  page_types: z.array(z.string()),
  business_types: z.array(z.string()),
  body: z.string(),
  benchmark: BenchmarkSchema,            // R15.3 required
  provenance: ProvenanceSchema,          // R15.3 required
}).strict();

export const HeuristicSchemaExtended = HeuristicSchemaBase.extend({
  version: z.string().default('1.0.0'),
  rule_vs_guidance: z.enum(['rule', 'guidance']).default('guidance'),
  business_impact_weight: z.number().min(0).max(1).default(0.5),
  effort_category: z.enum(['content', 'design', 'engineering']).default('content'),
  preferred_states: z.array(StatePatternSchema).optional(),
  status: z.enum(['active', 'archived']).default('active'),

  // v0.4 catch-up (originally v0.3 contract addition; was missing from v0.1 sketch) — manifest
  // selectors for ContextProfile-aware filtering (AC-11 / R-09 / REQ-CONTEXT-DOWNSTREAM-001).
  // Phase 4b T4B-013 owns implementation; Phase 6 owns the schema field reservation.
  // Absent fields default to "applies to all" — no selector means no filter narrowing.
  archetype: z.array(z.string()).optional(),       // e.g., ['D2C', 'SaaS', 'B2B', 'lead_gen']
  page_type: z.array(z.string()).optional(),       // e.g., ['PDP', 'pricing', 'comparison', 'landing', 'checkout']
  device: z.array(z.enum(['desktop', 'mobile', 'balanced'])).optional(),
}).strict();
```

**Field provenance:** the existing `business_types` + `page_types` (plural) on `HeuristicSchemaBase` remain the Stage 1/Stage 2 filter inputs for `filterByBusinessType` + `filterByPageType`. The v0.3+ `archetype` / `page_type` (singular) / `device` are NEW manifest selectors used by `loadForContext()` for ContextProfile-aware filtering — finer-grained than the existing two-stage filter and complementary, not replacing.

### `HeuristicLoader` (NEW adapter)

```ts
export interface HeuristicLoader {
  loadAll(): Promise<HeuristicKnowledgeBase>;

  // v0.4 catch-up (originally v0.3 contract addition) — ContextProfile-aware filter
  // (AC-11 / R-09 / REQ-CONTEXT-DOWNSTREAM-001). Phase 6 owns the interface signature;
  // Phase 4b T4B-013 owns the implementation deliverable. Returns 12-25 heuristics for
  // typical contexts (filter ONLY — no weight modifiers; Phase 13b master adds weights).
  loadForContext(profile: ContextProfile): Promise<ReadonlyArray<HeuristicExtended>>;
}

export class FileSystemHeuristicLoader implements HeuristicLoader {
  constructor(
    private readonly heuristicsDir: string,                 // 'heuristics-repo/' default
    private readonly decryptor: DecryptionAdapter,           // PlaintextDecryptor MVP
    private readonly logger: Logger,
  ) {}

  async loadAll(): Promise<HeuristicKnowledgeBase> {
    // R6 enforcement: log only file paths, IDs, counts — never body text
    // ...
  }

  // loadForContext() implementation lands in Phase 4b T4B-013 — composes existing
  // filterByBusinessType + filterByPageType + matches profile.business.archetype against
  // heuristic.archetype manifest, profile.page.type against heuristic.page_type manifest,
  // profile.traffic.device_priority against heuristic.device manifest.
  loadForContext(profile: ContextProfile): Promise<ReadonlyArray<HeuristicExtended>>;
}
```

### `DecryptionAdapter` (NEW adapter — v1.1 forward-compat)

```ts
export interface DecryptionAdapter {
  decrypt(ciphertext: Buffer | string): Promise<string>;  // returns plaintext JSON string
}

export class PlaintextDecryptor implements DecryptionAdapter {
  async decrypt(input: Buffer | string): Promise<string> {
    return typeof input === 'string' ? input : input.toString('utf8');
  }
}

// v1.1 plugs:
// export class AES256GCMDecryptor implements DecryptionAdapter { ... uses key from env ... }
```

### `HeuristicKnowledgeBase` + `HeuristicFilter`

```ts
export interface HeuristicKnowledgeBase {
  readonly all: ReadonlyArray<HeuristicExtended>;
  get(id: string): HeuristicExtended | undefined;
  byBusinessType(t: BusinessType): ReadonlyArray<HeuristicExtended>;
  byPageType(p: PageType): ReadonlyArray<HeuristicExtended>;
}

export function filterByBusinessType(kb: HeuristicKnowledgeBase, businessType: BusinessType): ReadonlyArray<HeuristicExtended>;
export function filterByPageType(stage1: ReadonlyArray<HeuristicExtended>, pageType: PageType): ReadonlyArray<HeuristicExtended>;
export function prioritizeHeuristics(stage2: ReadonlyArray<HeuristicExtended>, cap: number): ReadonlyArray<HeuristicExtended>;
```

## Pino redaction-pattern → BenchmarkSchema mapping (v0.4 catch-up — was missed in v0.2 sync)

The Pino redaction config registered in `T-PHASE6-LOGGER` (per tasks.md v0.4) covers the heuristic IP surface across the discriminated-union BenchmarkSchema shape. Mapping (mirrors spec.md:101 / plan.md:171 authoritative):

| Redact path | What it covers | Branch / source |
|---|---|---|
| `*.body` | Heuristic body text (the canonical IP — "what the heuristic teaches") | All heuristics; HeuristicSchemaBase.body |
| `*.benchmark.value` | Quantitative measurement value (e.g., "30%" cart-recovery rate) | BenchmarkSchema quantitative branch |
| `*.benchmark.metric` | Metric label that contextualizes the value (e.g., "cart-abandonment-rate") | BenchmarkSchema quantitative branch |
| `*.benchmark.unit` | Unit of measurement (revealing units leaks IP context — e.g., currency, %, seconds) | BenchmarkSchema quantitative branch |
| `*.benchmark.standard_text` | Qualitative reference text (e.g., "matches Baymard's checkout-friction taxonomy") | BenchmarkSchema qualitative branch |
| `*.provenance.citation_text` | Heuristic's canonical excerpt from source — counts as IP | ProvenanceSchema |

**NOT redacted** (public metadata — safe to log for debugging): `*.provenance.source_url`, `*.provenance.verified_by`, `*.provenance.verified_date`, `*.provenance.draft_model`. These are auditable provenance fields; log emission is intentional for R15.3 traceability.

**Syntax note:** the discriminated-union BenchmarkSchema flattens via Zod, so paths target `*.benchmark.value` (correct), NOT `*.benchmark.*.value` (wrong wildcard middle — would not match the actual emitted shape). T-PHASE6-LOGGER tasks.md v0.4 fix corrects this; the conformance test `r6-ip-boundary.test.ts` asserts each path independently against fixtures from BOTH benchmark branches.

---

## Forward Contract — Phase 7 + Phase 4b + Phase 0b

### Phase 7 (T117 EvaluateNode)

```ts
// Phase 7 imports:
import {
  HeuristicLoader,
  HeuristicKnowledgeBase,
  filterByBusinessType,
  filterByPageType,
  prioritizeHeuristics,
} from '@neural/agent-core/analysis/heuristics';

// EvaluateNode pseudocode:
const stage1 = filterByBusinessType(kb, audit.business_type);    // called once at audit_setup
const stage2 = filterByPageType(stage1, page.inferredPageType);  // per page
const top30 = prioritizeHeuristics(stage2, 30);
const userMessage = composeEvaluatePrompt({ analyzePerception, heuristics: top30 });
//   ^^ heuristic body text appears only in this LLM user message; never logged elsewhere (R6)
```

**Forward stability promise:**
- Filter function signatures LOCKED.
- HeuristicSchemaExtended fields LOCKED; new fields are optional with defaults (additive only).
- HeuristicLoader interface LOCKED.

### Phase 4b (T4B-013 — Context Capture Layer ContextProfile filter; v0.4 catch-up)

```ts
// Phase 4b imports (T4B-013):
import {
  HeuristicLoader,
  HeuristicExtended,
} from '@neural/agent-core/analysis/heuristics';
import { ContextProfile } from '@neural/agent-core/context-capture';

// T4B-013 implementation (lives in Phase 4b deliverable):
class ContextAwareHeuristicLoader implements HeuristicLoader {
  constructor(private readonly base: HeuristicLoader) {}

  loadAll() { return this.base.loadAll(); }

  async loadForContext(profile: ContextProfile): Promise<ReadonlyArray<HeuristicExtended>> {
    const kb = await this.base.loadAll();
    // matches profile.business.archetype against heuristic.archetype manifest
    // matches profile.page.type against heuristic.page_type manifest
    // matches profile.traffic.device_priority against heuristic.device manifest
    // returns 12-25 heuristics for typical contexts (per spec.md AC-11 examples:
    //   D2C/PDP/mobile, SaaS/pricing/desktop, B2B/comparison/balanced, lead_gen/landing/mobile)
    // FILTER ONLY — no weight modifiers (Phase 13b master adds weights).
  }
}
```

**Phase 4b T4B-013 owns the implementation deliverable + conformance test (`tests/conformance/heuristic-loader-context-filter.test.ts` per spec.md AC-11 path).** Phase 6 v0.4 owns: (a) the interface signature in `loader.ts`; (b) the schema field reservation (`archetype`, `page_type`, `device`) in `HeuristicSchemaExtended`; (c) this Forward Contract sub-section. Phase 4b implementer reads this document for the contract surface.

### Phase 0b (separate session)

Phase 0b's authoring workflow per PRD F-012 amendment 2026-04-26:
1. LLM-assisted draft per heuristic
2. Human verifier re-derives benchmark from `source_url` + `citation_text` per R15.3.2
3. Provenance block populated (5 fields)
4. Heuristic JSON committed to `heuristics-repo/`
5. Phase 6's HeuristicLoader validates against HeuristicSchemaExtended at load time — schema is the integration gate

Phase 6 doesn't enforce R15.3.2 verification at runtime (it trusts that Phase 0b's commit gate already enforced); Phase 6 just validates the SCHEMA presence of provenance + verified_by + verified_date.

## Breaking changes

None — additive.

## Migration plan

Not applicable. Phase 6 ships against synthetic test heuristics; real Phase 0b content arrives separately.

## Risk level: MEDIUM — mitigations

**Why MEDIUM:**
- R6 IP boundary first runtime enforcement — leak risk is real but small (engine doesn't expose body via API).

**Mitigations:**
- T106 conformance test: Pino transport spy verifies no heuristic content in log lines.
- Pino redaction config registers heuristic-content fields BY DEFAULT.
- HeuristicLoader logs only IDs / paths / counts (not body) — code review enforces.
- DecryptionAdapter MVP is plaintext but v1.1 plugs AES-256-GCM at the same seam.

## Verification

| Check | Test |
|---|---|
| HeuristicSchemaExtended Zod parse on synthetic fixtures | `tests/conformance/heuristic-schema-{base,extended}.test.ts` (AC-01, AC-02) |
| KB container query helpers | `tests/conformance/kb-container.test.ts` (AC-03) |
| HeuristicLoader R6 IP boundary | `tests/conformance/r6-ip-boundary.test.ts` (Pino transport spy; AC-04) |
| Two-stage filter reduction targets | `tests/conformance/filter-{business-type,page-type}.test.ts` (AC-05/06) |
| Prioritize cap + ordering | `tests/conformance/prioritize.test.ts` (AC-07) |
| DecryptionAdapter seam | `tests/conformance/decryption-adapter.test.ts` (AC-08) |
| TierValidator | `tests/conformance/tier-validator.test.ts` (AC-09) |
| Phase 6 integration end-to-end | `tests/integration/phase6.test.ts` (AC-10) |

## Provenance (R22.2)

```yaml
why:
  source: >
    docs/specs/final-architecture/09-heuristic-kb.md (canonical KB schema + two-stage filter)
    docs/specs/mvp/PRD.md F-012 amendment 2026-04-26 (LLM-assisted authoring + R15.3 provenance)
    docs/specs/mvp/constitution.md R6 (IP protection — focal)
  evidence: >
    R6 retroactive audit (R22.5) cites: "Heuristic content (Baymard/Nielsen/Cialdini applications with
    research-grounded benchmarks) is Neural's direct competitive differentiator vs generic AI tools. If
    heuristic JSON leaks via observability infrastructure, any competitor can reproduce the pipeline."
    R15.3 + R15.3.1 + R15.3.2 amended 2026-04-26 specifically because LLM-assisted authoring introduces
    hallucination risk on benchmarks; provenance + human verification mitigate. Phase 6 is the schema-level
    enforcement of those rules.
  linked_failure: >
    General risk class — LLM systems leaking proprietary knowledge via observability infrastructure
    (error strings, trace metadata, retry logs, debug dumps). Phase 6's Pino transport spy is the
    code-level test for this risk.
```

## Approval

| Gate | Approver | Evidence |
|---|---|---|
| Impact analysis review | engineering lead | this `status: approved` |
| R6 IP boundary strategy | engineering lead | Pino transport spy + redaction config + grep test in place |
| DecryptionAdapter v1.1 forward-compat | engineering lead | Interface accepts AES-256-GCM impl without HeuristicLoader changes |
| R15.3 schema enforcement | engineering lead | benchmark + provenance both required (no .optional() on either) |
| Phase 6 spec → plan transition | spec author + product owner | spec `approved` AND this `approved` |

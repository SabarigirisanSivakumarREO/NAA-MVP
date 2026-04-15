# Section 22 — Heuristic Retrieval Evolution

**Status:** Master architecture extension. Phases 2-4 (incremental). Schema already forward-compatible (§9.10).

**Cross-references:**
- §9.1-9.9 (Heuristic KB base) — Phase 1 JSON-based system
- §9.10 (Heuristic KB extensions) — forward-compatible schema, overlay system, rule-vs-guidance split
- §13.6.6 (`heuristic_overlays`, `heuristic_calibration` tables)
- §25 (Reproducibility) — heuristic version pinning
- §28 (Learning Service) — Phase 4 calibration data source

---

## 22.1 Principle

> **The heuristic system must evolve from 100 curated JSON rules to a 5,000+ retrievable knowledge base to a TB-scale learned intelligence layer — without ever breaking the 30-heuristic-per-page evaluation cap, the reproducibility guarantee, or the IP protection boundary.**

---

## 22.2 Four-Phase Evolution

```
Phase 1 (MVP)         Phase 2              Phase 3                Phase 4
~100 heuristics       ~500 heuristics      ~5,000 heuristics      TB-scale corpus

JSON bundle ─────────▶ Tagged JSON ────────▶ Postgres catalog ────▶ Catalog + learned
encrypted              + overlays           + pgvector             + analytics signals
                       + rule/guidance      + semantic retrieval   + client memory
                       split                                       + calibration

Filter:               Filter:              Filter:                Filter:
page_type +           multi-key +          categorical +          categorical +
business_type         priority +           vector rerank +        vector rerank +
                      cap                  client overlays +      client overlays +
                                           cap                    learned reweight +
                                                                  cap

Cost/page:            Cost/page:           Cost/page:             Cost/page:
~$0.15 (all LLM)     ~$0.10 (rule split)  ~$0.10                 ~$0.08 (learned tuning)
```

> **Note:** Phase 1-4 above are heuristic evolution phases, not master implementation phases. Mapping: Evolution Phase 1 = Master Phase 1-5 (MVP), Evolution Phase 2 = Master Phase 6-9, Evolution Phase 3 = Master Phase 12-16, Evolution Phase 4 = Master Phase 16+.

---

## 22.3 Phase 1 — JSON Bundle (Existing, §9.1-9.9)

No changes. Fully specified in existing spec. ~100 heuristics in private git repo, compiled at build time, encrypted at rest (AES-256-GCM), decrypted in memory, filtered by `(page_type, business_type)`, capped at 30.

---

## 22.4 Phase 2 — Tagged JSON + Overlays + Rule/Guidance Split

### What changes

| Change | Impact |
|---|---|
| Schema extended to `HeuristicSchemaExtended` (§9.10.2) | All 100+ heuristics get `version`, `rule_vs_guidance`, `business_impact_weight`, `effort_category`. (M2-L2-FIX) Migration is a one-time effort per heuristic: CRO team classifies each as rule/guidance, assigns impact weight + effort category. Engineering writes rule detectors for rule-type heuristics. Estimated: 2-3 days for 100 heuristics. |
| Overlay system introduced (§9.10.4) | Brand + client overlays modify base heuristics per audit |
| Rule-vs-guidance split (§9.10.5) | Rule heuristics bypass full LLM evaluation → token savings |
| Heuristic count grows to ~500 | Multi-key filter + priority + cap prevents prompt bloat |

### Rule Heuristic Registry

**REQ-RETRIEVAL-001:** A new module: `RuleHeuristicRegistry` that maps rule-type heuristic IDs to deterministic detector functions:

```typescript
interface RuleHeuristicRegistry {
  register(heuristicId: string, detector: RuleDetector): void;
  has(heuristicId: string): boolean;
  detect(heuristicId: string, perception: AnalyzePerception): RuleDetectionResult;
}

interface RuleDetector {
  (perception: AnalyzePerception): RuleDetectionResult;
}

interface RuleDetectionResult {
  detected: boolean;
  status: "violation" | "pass";
  evidence: {
    element_ref: string | null;
    data_point: string;
    measurement: string | null;
  };
  severity: Severity;           // from heuristic's severity_if_violated
  confidence: number;            // typically 0.9+ for deterministic detection
}
```

**REQ-RETRIEVAL-002:** Example rule detectors:

```typescript
// BAY-CHECKOUT-001: Guest checkout option present
const guestCheckoutDetector: RuleDetector = (perception) => {
  const guestSignals = ["guest checkout", "continue as guest", "checkout without account"];
  // M8-L2-FIX: check CTAs, forms, AND text content (not just CTAs)
  const hasGuest =
    perception.ctas.some(c => guestSignals.some(s => c.text.toLowerCase().includes(s))) ||
    perception.forms.some(f => guestSignals.some(s => f.submitButtonText.toLowerCase().includes(s))) ||
    perception.textContent.paragraphs.some(p => guestSignals.some(s => p.text.toLowerCase().includes(s)));
  return {
    detected: true,
    status: hasGuest ? "pass" : "violation",
    evidence: {
      element_ref: hasGuest ? perception.ctas.find(c =>
        guestSignals.some(s => c.text.toLowerCase().includes(s)))?.text ?? null : null,
      data_point: "ctas",
      measurement: hasGuest ? "guest checkout CTA found" : "no guest checkout CTA in " + perception.ctas.length + " CTAs",
    },
    severity: hasGuest ? "low" : "critical",
    confidence: 0.95,
  };
};
```

**REQ-RETRIEVAL-003:** Target: 30-40% of Phase 2 heuristics have rule detectors. Remaining 60-70% stay as guidance (full LLM pipeline).

### Extended Filter (Phase 2)

Per §9.10.6 `filterHeuristicsExtended`. Key addition: brand_trait filtering + client overlay application + funnel_position boosting.

---

## 22.5 Phase 3 — Postgres Catalog + Vector Retrieval

### What changes

| Change | Impact |
|---|---|
| Heuristics stored in Postgres `heuristic_catalog` table (not compiled bundle) | Runtime queryable, version-controlled in DB |
| Embeddings computed per heuristic | pgvector semantic similarity search |
| Retrieval pipeline: categorical filter → vector rerank → cap | Scales to 5,000+ heuristics without prompt bloat |

### Heuristic Catalog Table

**REQ-RETRIEVAL-010:** Phase 3 introduces a `heuristic_catalog` table (addition to §13.6):

```sql
CREATE TABLE heuristic_catalog (
  id TEXT PRIMARY KEY,                           -- e.g., BAY-CHECKOUT-001
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  content_json JSONB NOT NULL,                   -- full HeuristicExtended JSON (encrypted at rest via PG-level encryption)
  embedding vector(1536),                        -- pgvector; dimension from embedding model
  embedding_model TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  page_types TEXT[] NOT NULL,
  business_types TEXT[],
  brand_traits TEXT[],
  funnel_positions TEXT[],
  reliability_tier INTEGER NOT NULL,
  rule_vs_guidance TEXT NOT NULL,
  business_impact_weight FLOAT NOT NULL,
  effort_category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deprecated_at TIMESTAMPTZ
);

CREATE INDEX idx_catalog_page_types ON heuristic_catalog USING GIN(page_types);
CREATE INDEX idx_catalog_business ON heuristic_catalog USING GIN(business_types);
CREATE INDEX idx_catalog_status ON heuristic_catalog(status);
CREATE INDEX idx_catalog_tier ON heuristic_catalog(reliability_tier);
CREATE INDEX idx_catalog_embedding ON heuristic_catalog USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
```

### Retrieval Pipeline

**REQ-RETRIEVAL-020:** The Phase 3 retrieval pipeline:

```
INPUT: (page_type, business_type, brand_traits, funnel_position,
        client_id, page_context_embedding)
  │
  ▼
STAGE 1: Categorical filter (SQL WHERE)
  SELECT * FROM heuristic_catalog
  WHERE status = 'active'
    AND (page_types @> ARRAY[$page_type] OR page_types @> ARRAY['all'])
    AND (business_types IS NULL OR business_types @> ARRAY[$business_type])
  Returns: ~200-500 candidates (from 5,000+)
  │
  ▼
STAGE 2: Brand + funnel filter (application layer)
  Filter by brand_traits intersection, boost funnel_positions match
  Returns: ~100-300 candidates
  │
  ▼
STAGE 3: Client overlay application
  Apply overlays from heuristic_overlays table
  Returns: ~100-300 candidates (modified)
  │
  ▼
STAGE 4: Vector rerank (pgvector cosine similarity)
  page_context_embedding = embed(page_title + page_type + top_headings + CTA_texts)
  ORDER BY embedding <=> page_context_embedding
  LIMIT 60
  │
  ▼
STAGE 5: Deterministic prioritization
  Sort by (tier ASC, severity_if_violated DESC, business_impact_weight DESC)
  Cap at 30
  │
  ▼
OUTPUT: HeuristicExtended[30]  → injected into user message
```

**§33 Integration Note:** The heuristic retrieval pipeline is composition-mode-agnostic. The same 30-heuristic cap (REQ-HK-021), the same overlay chain, and the same prioritization apply regardless of whether the evaluate node runs in static or interactive mode (§33.9). The pipeline output feeds both `StaticEvaluateStrategy` and `InteractiveEvaluateStrategy` identically. Dual-mode evaluation (Pass 2 open observation) does not consume heuristics from the pipeline — it runs after Pass 1 with a fresh prompt.

**REQ-RETRIEVAL-021:** The page context embedding is computed once per page from: `page_title + page_type + top 3 headings + primary CTA texts + business_type`. This is a cheap embedding call (~$0.001).

**REQ-RETRIEVAL-021a:** (M7-L2-FIX) Recommended default embedding model: OpenAI `text-embedding-3-small` (1536 dimensions, $0.02/1M tokens). Alternative: Voyage `voyage-2` (1024d, better for semantic text). The choice is pinned per heuristic catalog version and recorded in `heuristic_catalog.embedding_model`. Switching models requires a full re-embed batch job (REQ-RETRIEVAL-030).

**REQ-RETRIEVAL-022:** Vector rerank returns top 60 (2x the cap) so that Stage 5 prioritization can still apply tier/severity ordering and keep the most impactful heuristics.

### Embedding Management

**REQ-RETRIEVAL-030:** Embedding model versioning:
- All embeddings produced by the SAME model version
- On model upgrade: batch re-embed ALL heuristics (offline job)
- Mixed-version retrieval is FORBIDDEN (REQ-HK-EXT-017)
- `embedding_model` column tracks which model produced each embedding
- Pre-upgrade: run retrieval quality evaluation on a gold-standard test set (50 page × 30 heuristic pairs manually rated by CRO team). Quality must not regress by >5% before deploying new embeddings.

---

## 22.6 Phase 4 — Learned Client-Specific Intelligence

### What changes

| Change | Impact |
|---|---|
| `heuristic_calibration` table populated by Learning Service (§28) | Per-client reliability adjustments |
| Analytics signals from DX bindings (§30) inform heuristic selection | Traffic-weighted heuristic prioritization |
| Retrieval pipeline adds Stage 6: client calibration reweight | Suppress low-performing heuristics per client, boost high-performing ones |

### Stage 6: Client Calibration (Phase 4 addition to retrieval pipeline)

```typescript
function applyClientCalibration(
  candidates: HeuristicExtended[],
  clientId: string,
  calibrations: Map<string, HeuristicCalibration>
): HeuristicExtended[] {
  return candidates.map(h => {
    const cal = calibrations.get(h.id);
    if (!cal || cal.sample_size < 30) return h; // REQ-HK-EXT-018: min sample size

    return {
      ...h,
      // Adjust effective reliability tier weight
      _effective_tier_weight: BASE_TIER_WEIGHTS[h.reliability_tier] + cal.reliability_delta,
      // Suppress if consistently rejected
      _suppressed: cal.suppress_below_confidence !== undefined
        && h._base_confidence < cal.suppress_below_confidence,
      // Override severity if consultant consistently corrects it
      severity_if_violated: cal.severity_override ?? h.severity_if_violated,
    };
  }).filter(h => !h._suppressed);
}
```

### Scale Considerations at TB

**REQ-RETRIEVAL-040:** At TB scale (Phase 4+), the corpus includes not just authored heuristics but:
- Research paper extracts (structured as heuristics)
- Client-specific learned rules (from past audit findings → consultant-approved → crystallised)
- Industry benchmark patterns

**REQ-RETRIEVAL-041:** The retrieval pipeline handles this via:
- Stage 1 categorical filter uses GIN indexes — O(1) regardless of corpus size
- Stage 4 vector rerank uses IVFFlat index — O(sqrt(N)) with N partitions
- The 30-heuristic cap ensures evaluation cost is constant regardless of corpus size
- Only the FILTER and RANK stages touch the large corpus; the EVALUATION stage always sees ≤30

**REQ-RETRIEVAL-042:** If pgvector becomes a bottleneck (>100ms p95 on retrieval), migrate vector index to a dedicated vector store (Qdrant, Weaviate) via the existing adapter pattern. The retrieval pipeline interface doesn't change.

---

## 22.7 Heuristic Authoring Workflow

**REQ-RETRIEVAL-050:** Heuristics are authored and reviewed before entering the system:

```
CRO consultant authors heuristic (JSON/YAML)
    │
    ▼
Zod schema validation (HeuristicSchemaExtended)
    │
    ▼
Peer review (another consultant or CRO lead)
    │
    ▼
If rule_vs_guidance === "rule":
    register detector function in RuleHeuristicRegistry
    unit test the detector
    │
    ▼
Commit to private git repo (Phase 1-2) OR
Insert into heuristic_catalog (Phase 3+)
    │
    ▼
Compute embedding (Phase 3+)
    │
    ▼
Version bump → reproducibility snapshots reference this version
```

**REQ-RETRIEVAL-051:** Heuristic authoring tooling (consultant dashboard) is Phase 11. Before that, heuristics are authored as JSON files in the private repo.

---

## 22.8 IP Protection Continuity

**REQ-RETRIEVAL-060:** All IP protection rules from §9.9 apply to all phases:
- Phase 1-2: encrypted bundle, decrypted in memory
- Phase 3+: `content_json` stored as JSONB with Postgres-level encryption (TDE) or application-level AES-256-GCM before INSERT
- API/MCP/dashboard: NEVER expose heuristic content. Findings reference `heuristic_id`, not heuristic rules.
- LangSmith traces: heuristic content REDACTED (§9.9)

**REQ-RETRIEVAL-061:** Phase 3+ migration from encrypted bundle to Postgres catalog SHALL:
1. Encrypt `content_json` at application level before writing to DB
2. Decrypt in the heuristic loader service (memory-only)
3. Never write decrypted heuristic JSON to disk, logs, or traces
4. Key management via environment variable (same as Phase 1)

---

## 22.9 Failure Modes (Additions to §15)

| # | Failure | Detection | Response |
|---|---|---|---|
| **HR-01** | Embedding model unavailable | API error on embed call | Fall back to categorical filter + priority sort (skip vector rerank). Findings quality degrades but system continues. |
| **HR-02** | pgvector index corrupted | Retrieval returns 0 results despite candidates existing | Rebuild index (offline). Fall back to categorical. Alert. |
| **HR-03** | Mixed embedding model versions in catalog | `embedding_model` column inconsistency | Block retrieval. Force re-embed job. Alert. |
| **HR-04** | Rule detector throws exception | Detector function error | Skip that heuristic for this page. Log. Fall back to guidance evaluation for that heuristic (use LLM). |
| **HR-05** | Learned calibration has stale data (>90 days) | `last_calibrated_at` check | Ignore calibration for that heuristic. Use base weights. Log warning. |
| **HR-06** | Overlay version conflict | Client overlay + learned overlay disagree | Client wins (S2-FIX resolution order). Log the conflict for consultant review. |

---

## 22.10 Implementation Phase Mapping

| Phase | Deliverable |
|---|---|
| **Phase 1-5 (existing MVP)** | (FS-3-FIX: these use original MVP phase numbers, NOT master phase numbers) Phase 1-5 heuristic KB is JSON-only per §9.1-9.9. The schema extensions in §9.10 are populated incrementally starting Phase 6. |
| **6** | (FS-3-FIX) `HeuristicSchemaExtended` migration — add forward-compatible fields to existing 100 heuristics. Populate `version`, `rule_vs_guidance`, `business_impact_weight`, `effort_category`. Partial `RuleHeuristicRegistry` with 10-15 initial rule detectors. |
| **9** | Extended filter with brand overlays + client overlays applied at runtime. Full `RuleHeuristicRegistry` with 30-40 rule detectors. |
| **12** | Client calibration integration with §28 Learning Service |
| **16** | (FS-3-FIX: this is the master Phase 16, not original Phase 3/4) `heuristic_catalog` table (§13.6.0), embedding pipeline, pgvector retrieval, page context embedding, retrieval quality evaluation framework, analytics signal weighting (§30), learned heuristic crystallisation |
| **11** | Consultant dashboard: heuristic authoring tool, overlay editor, calibration inspector |
| **16** | Embedding model upgrade workflow (re-embed, evaluate, deploy), vector store migration adapter |

---

**End of §22 — Heuristic Retrieval Evolution**

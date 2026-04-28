---
title: Phase 1b — Impact Analysis
artifact_type: impact
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
  - docs/specs/mvp/phases/phase-1b-perception-extensions/spec.md
  - docs/specs/mvp/constitution.md (R20 — Impact Analysis Before Cross-Cutting Changes)
  - docs/specs/final-architecture/07-analyze-mode.md §7.9.2

req_ids:
  - REQ-ANALYZE-PERCEPTION-V24-001

breaking: false
affected_contracts:
  - AnalyzePerception

delta:
  new:
    - Phase 1b impact analysis — required by R20 because AnalyzePerception is a shared contract
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R20 (Impact Analysis Before Cross-Cutting Changes)
  - Constitution R18 (Delta-Based Updates)
  - Constitution R5.1 (Backward Compat Invariant)
---

# Phase 1b Impact Analysis

> **Why this file exists:** Constitution R20 — any modification to a shared contract (AnalyzePerception, PageStateModel, AuditState, Finding lifecycle, adapter interfaces, DB schema, MCP tool interfaces, grounding rule interfaces) requires an `impact.md` BEFORE implementation code. AnalyzePerception is a shared contract (consumed by Phase 5/6/7 + delivery layer). Phase 1b extends it from v2.3 → v2.4.

---

## 1. Contract changed

| Contract | Before (v2.3) | After (v2.4) | Breaking? |
|---|---|---|---|
| AnalyzePerception | 5K-token payload, v2.3 fields | 6.5K-token payload, v2.3 + 10 new field groups | **No** — additive only |

All v2.4 additions are listed in `docs/specs/final-architecture/07-analyze-mode.md` §7.9.2 (REQ-ANALYZE-PERCEPTION-V24-001). The 10 new groups are: `pricing`, `clickTargets[]`, `stickyElements[]`, `popups[]`, `frictionScore`, `socialProofDepth`, `microcopy.nearCtaTags[]`, `attention`, `commerce`, `metadata.currencySwitcher`.

---

## 2. Producers affected

| Producer | File | Change required | Owner |
|---|---|---|---|
| `page_analyze` MCP tool | `packages/agent-core/src/mcp/tools/page-analyze.ts` | Calls 10 new extractor functions inside the same `page.evaluate()` call; assembles v2.4 payload | Phase 1b T1B-001..T1B-010 + T1B-011 |
| AnalyzePerception Zod schema | `packages/agent-core/src/perception/schema.ts` | Append 10 new field groups; preserve v2.3 field shapes verbatim | Phase 1b T1B-011 |
| Perception integration test | `packages/agent-core/tests/integration/perception-extensions.test.ts` | New test (T1B-012) covering 5 fixtures | Phase 1b T1B-012 |

---

## 3. Consumers affected

R20 mandates a per-consumer audit. Each consumer below is verified for backward compatibility.

| Consumer | Location | Reads v2.3 fields? | Reads new v2.4 fields? | Impact | Action |
|---|---|---|---|---|---|
| Phase 5 Browse-mode integration | `packages/agent-core/src/orchestration/browse-mode/*` | Yes | No (v2.4 lands later) | Zero — v2.3 fields unchanged | None |
| Phase 6 Heuristic KB filter | `packages/agent-core/src/heuristics/*` | Yes (when authored) | Optional | Future heuristics may opt into v2.4 fields once authored | Heuristic authors update individually post-Phase 1b |
| Phase 7 Analysis Pipeline | `packages/agent-core/src/analysis/*` | Yes | Optional | LLM `evaluate` prompt template will see slightly larger context (+1.5K tokens) | Token budget already accommodates 6.5K (cap is 8K — §7.9.2) |
| Delivery layer (PDF / dashboard) | `packages/agent-core/src/delivery/*` + `apps/dashboard/*` | Yes | No (v2.4 not surfaced to consultant UI in MVP) | Zero | None |
| Reproducibility snapshot | `packages/agent-core/src/reproducibility/*` | Yes (full payload) | Yes — auto-captured | Snapshot rows grow ~30% (5K → 6.5K tokens, plus structural overhead) | Verify storage budget; no schema change needed |
| `audit_events` log | DB | Yes | Yes — auto-logged | Log row sizes grow proportionally | Within Phase 0 storage estimate (no schema change) |
| Cross-page PatternDetector (Phase 8) | `packages/agent-core/src/analysis/cross-page/*` | Yes | Yes (esp. `pricing`, `commerce`) | Phase 8 gains new pattern signals | Phase 8 spec already aware of v2.4 (incremental gain, no breaking change) |

**No consumer breaks.** Backward compatibility is enforced via Zod additive schema (T1B-011) and the Phase 1 integration test re-run (T015 unchanged).

---

## 4. Heuristic engine impact

Phase 1b enables (but does not author) new heuristic categories:

- Pricing-display heuristics (anchor / discount / tax-inclusive)
- Mobile click-target heuristics (Fitt's Law / WCAG 2.5.5)
- Sticky-element heuristics (CTA visibility / cart persistence)
- Popup presence heuristics (cookie-banner intrusiveness; full popup heuristics require Phase 5b behavior)
- Friction-score heuristics (form length × required ratio)
- Social-proof depth heuristics (review count / recency / star distribution)
- Microcopy semantic heuristics (risk reducers / urgency)
- Attention / contrast hotspots heuristics (visual hierarchy)
- Commerce-specific heuristics (stock messaging / shipping CTAs / return-policy clarity)
- Currency-switcher heuristics (international UX)

Heuristics are authored in Phase 0b (LLM-assisted authoring) + filtered in Phase 6 (KB engine). Phase 1b only EMITS the data; Phase 6 enforces ContextProfile filtering.

**No GR-001..GR-008 grounding rule changes** in Phase 1b. New grounding rules (GR-013+) may be authored later as heuristics consuming v2.4 fields ship.

---

## 5. Cost impact

| Metric | v2.3 | v2.4 | Δ |
|---|---|---|---|
| New LLM calls per audit | — | 0 | 0 |
| Net per-audit LLM cost | $X | $X | $0 |
| Browser time per page (p50) | T | T+~150ms | +~150ms |
| AnalyzePerception payload tokens | ~5K | ~6.5K | +1.5K |
| Reproducibility snapshot row size | ~5K | ~6.5K | +1.5K |
| Heuristic prompt token cost (Phase 7) | baseline | +1.5K per evaluate call | +~$0.0045 per evaluate at Sonnet 4 input rate |

**Net audit cost impact:** Phase 7 evaluate prompt grows by ~1.5K input tokens per page. At ~10 evaluate calls per audit, that is ~15K extra input tokens, worth ~$0.045 per audit at Sonnet 4 rates — well below the $15 hard cap (R10).

---

## 6. Storage impact

`reproducibility_snapshots` table row size grows ~30%. Phase 0 storage estimate already accommodates this growth (6.5K JSON serializes to ~7-9KB; storage cost negligible at 100-audit-per-day ceiling).

`audit_events` log entries that include perception payloads grow proportionally. Append-only — no migration required (R7.4).

**No DB schema migration required for Phase 1b.**

---

## 7. Reproducibility impact

`reproducibility_snapshot.perception_schema_version` field is updated from `"v2.3"` to `"v2.4"`. Existing v2.3 snapshots remain valid for replay; v2.4 snapshots include the new fields.

Replays of v2.3 snapshots against v2.4 code path: backward compat enforced — v2.3 snapshots will deserialize cleanly (new fields default to `null` / empty arrays).

---

## 8. Documentation impact

| Doc | Change |
|---|---|
| `docs/specs/final-architecture/07-analyze-mode.md` §7.9.2 | Already documents v2.4 (REQ-ANALYZE-PERCEPTION-V24-001). No change. |
| `docs/specs/mvp/PRD.md` F-004 | Reference v2.4 schema after Phase 1b ships (next PRD bump). |
| `docs/specs/mvp/phases/INDEX.md` | Add Phase 1b row (handled by INDEX regeneration step). |
| `docs/specs/mvp/phases/phase-1-perception/phase-1-current.md` | Phase 1 rollup notes Phase 1b as immediate successor. |

---

## 9. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Token budget breach | Medium | High | Plan §3 kill criteria — drop hotspots / compress microcopy / flag-gate SocialProofDepth |
| MicrocopyTagger precision <80% | Medium | Medium | Plan §3 — drop to `[]` and defer to Phase 6 LLM-tagging |
| AttentionScorer browser-time regression | Medium | Medium | Plan §3 — single full-page contrast pass, not per-element |
| Reproducibility snapshot bloat | Low | Low | Storage estimate already includes growth budget |
| Phase 5 / Phase 7 / delivery consumer regression | Low | High | Phase 1 integration test (T015) re-run as smoke gate before merge |
| Schema drift between extractor output and Zod schema | Low | High | T1B-011 Zod schema is single source of truth; per-extractor unit tests reuse schema parse |

---

## 10. Sign-off requirements

Per R20, Phase 1b implementation MUST NOT begin until:

- [x] This impact.md exists (R20 hard requirement)
- [ ] Engineering lead sign-off on backward-compat audit (§3 above)
- [ ] Cost / storage budget reviewed against Phase 0 estimates
- [ ] Phase 1 (v2.3) ships and `phase-1-current.md` rollup is approved
- [ ] Ground-truth fixture set for MicrocopyTagger authored or scheduled

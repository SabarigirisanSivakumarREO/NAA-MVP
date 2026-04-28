---
title: Phase 1c — PerceptionBundle Envelope v2.5 — Implementation Plan
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
  - docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md
  - docs/specs/mvp/tasks-v2.md (T1C-001..T1C-012)
  - docs/specs/final-architecture/07-analyze-mode.md §7.9.3
  - docs/specs/final-architecture/06-browse-mode.md §6.6 v2.5

req_ids:
  - REQ-ANALYZE-PERCEPTION-V25-001
  - REQ-PERCEPT-V25-002
  - REQ-BROWSE-PERCEPT-007
  - REQ-BROWSE-PERCEPT-008

impact_analysis: docs/specs/mvp/phases/phase-1c-perception-bundle/impact.md
breaking: false
affected_contracts:
  - PerceptionBundle (new shared contract)
  - AnalyzePerception (wrapped only)
  - PageStateModel (wrapped only)
  - deep_perceive output type

delta:
  new:
    - Phase 1c plan — sequencing, settle predicate composition, ElementGraph stability rules, kill criteria
  changed: []
  impacted: []
  unchanged: []

governing_rules:
  - Constitution R10 (Budget)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R20 (Impact Analysis)
  - Constitution R23 (Kill Criteria)
  - Constitution R24 (Perception MUST NOT)
---

# Phase 1c Implementation Plan

> **Summary (~120 tokens):** Sequence 12 tasks across week 3-5: traversal extensions (T1C-002..T1C-006) parallel; settle predicate (T1C-001) standalone; element graph builder (T1C-007) closes traversals; nondeterminism + warnings + bundle (T1C-008..T1C-010) compose envelope; settle wired into `deep_perceive` skeleton (T1C-011); 5-fixture integration test (T1C-012) is exit gate. Total estimated effort: 14-18 engineering hours. Kill criteria fire on token-budget breach (>8.5K/state), settle p50 regression (>+250ms), or `element_id` instability across re-runs.

---

## 1. Sequencing

```
Day 1-2 (parallelizable):
  T1C-001 SettlePredicate              ← composition of network-idle + DOM-mutation + fonts + animations
  T1C-002 ShadowDomTraverser           ← recursive walk, depth cap 5
  T1C-003 PortalScanner                ← body-direct-children scan
  T1C-004 PseudoElementCapture         ← getComputedStyle pseudo-content
  T1C-005 IframePolicyEngine           ← purpose classifier; depends on T1B-009 (CommerceBlockExtractor) for context
  T1C-006 HiddenElementCapture         ← display/visibility/aria-hidden/offscreen capture

Day 3:
  T1C-007 ElementGraphBuilder          ← fuses traversal output + v2.4 AnalyzePerception arrays; element_id hash
  T1C-008 NondeterminismDetector       ← script presence + cookie patterns + runtime probes
  T1C-009 WarningEmitter               ← collects from all traversal paths into bundle.warnings

Day 4:
  T1C-010 PerceptionBundle (Zod + envelope + freeze + bundleToAnalyzePerception helper)
  T1C-011 Settle integration into deep_perceive (skeleton)
  T1C-012 Integration test (5 fixtures including SPA-heavy)
```

Dependencies (from tasks-v2.md):
- T1C-005 ← T013 + T1B-009 (CommerceBlockExtractor for purposeGuess context — checkout-iframe detection)
- T1C-007 ← T1C-002 + T1C-003 + T1C-004 + T1C-005 + T1C-006 + T1B-011 (v2.4 schema)
- T1C-009 ← T1C-001 + T1C-002 + T1C-005 + T1C-007 (warning-emitting paths)
- T1C-010 ← T1C-001..T1C-009 (full set)
- T1C-011 ← T1C-001 + T117 (DeepPerceiveNode forward stub from Phase 7)
- T1C-012 ← T1C-001..T1C-011

---

## 2. Architecture

### 2.1 File layout

```
packages/agent-core/src/perception/
├── PerceptionBundle.ts                       # T1C-010 — Zod schema + envelope + freeze + accessor helper
├── SettlePredicate.ts                        # T1C-001
├── ShadowDomTraverser.ts                     # T1C-002
├── PortalScanner.ts                          # T1C-003
├── PseudoElementCapture.ts                   # T1C-004
├── IframePolicyEngine.ts                     # T1C-005
├── HiddenElementCapture.ts                   # T1C-006
├── ElementGraphBuilder.ts                    # T1C-007
├── NondeterminismDetector.ts                 # T1C-008
└── WarningEmitter.ts                         # T1C-009

packages/agent-core/src/analysis/nodes/
└── DeepPerceiveNode.ts                       # T1C-011 — extend Phase 7 skeleton with settle hook
```

### 2.2 Settle predicate composition (T1C-001 + R-01)

```ts
async function waitForSettle(page: Page, opts: SettleOptions = {}): Promise<SettleResult> {
  const start = Date.now();

  await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => {});  // soft
  await waitForDomMutationsToStop(page, { idleMs: 300, maxMs: 3000 });
  await page.waitForFunction(() => (document as any).fonts?.ready ?? true).catch(() => {});
  await waitForAnimationsToFinish(page, { timeout: 1500 });
  if (opts.requireSelector) await page.waitForSelector(opts.requireSelector, { timeout: 2000 });

  const elapsed = Date.now() - start;
  return { elapsed_ms: elapsed, capped_at_5s: elapsed >= 5000 };
}
```

5-second hard cap is the SUM of soft caps, but each step `.catch(() => {})` so a single hang doesn't abort settle — it just emits a warning.

### 2.3 ElementGraph stability rules (T1C-007)

`element_id = sha256(`tag + sorted_classes + dom_position_path + text_content_prefix(50)`).slice(0, 16)`.

| Rule | Behavior |
|---|---|
| Stable across re-runs of same URL | Yes — DOM stable ⇒ same hash |
| Stable across viewports | No — responsive layout changes `dom_position_path` |
| Re-used across states | Yes when DOM node persists; new ID on add/remove |
| Collision handling | Vanishingly rare at 16 hex chars; on collision append `:N` for the Nth occurrence |

### 2.4 Selective fusion — top N elements

`ElementGraph.elements` does NOT contain every DOM node. Inclusion criteria:

1. All elements referenced by v2.3/v2.4 AnalyzePerception arrays (CTAs, forms, fields, trust signals, images, iframes, sticky, popups, click_targets)
2. All elements with `ax.role` ∈ {button, link, tab, menuitem, checkbox, radio, combobox, textbox}
3. All elements with `is_interactive = true` not already covered
4. Direct ancestors of any of the above (for `parent_id` chain integrity)

Default cap: 30 per state. Configurable via `AuditRequest.element_graph_size` (max 60 — token budget enforces).

### 2.5 Backward compatibility — `bundleToAnalyzePerception(bundle, stateId?)`

```ts
export function bundleToAnalyzePerception(
  bundle: PerceptionBundle,
  stateId: string = bundle.initial_state_id,
): AnalyzePerception /* v2.4 */ {
  const ap = bundle.raw.analyze_perception_by_state.get(stateId);
  if (!ap) throw new Error(`State ${stateId} not in bundle`);
  return ap;
}
```

Pure pass-through — no transformation, no enrichment. Returned object is a reference to the bundle's stored AnalyzePerception.

### 2.6 IframePolicyEngine purpose classifier (T1C-005)

| Purpose | Match | Decision |
|---|---|---|
| `checkout` | `*.stripe.com`, `*.adyen.com`, `*.paypal.com`, JSON-LD `Offer` reachable in iframe | Descend (same-origin only) |
| `chat` | `*.intercom.io`, `*.crisp.chat`, `*.drift.com` | Descend (same-origin only) |
| `video` | `*.youtube.com/embed`, `*.vimeo.com`, `*.wistia.com` | Skip + emit `IFRAME_SKIPPED` |
| `analytics` | `*.googletagmanager.com`, `*.doubleclick.net`, tracking pixels | Skip silent (info severity) |
| `social_embed` | `*.twitter.com`, `*.instagram.com`, `*.tiktok.com`, `*.facebook.com` | Skip + emit `IFRAME_SKIPPED` |
| `other` | unmatched | Skip + emit `IFRAME_SKIPPED` |
| `cross_origin` | always | Skip + emit `IFRAME_SKIPPED` (security override) |

`T1B-009 CommerceBlockExtractor` provides `commerce.isCommerce` context — used to weight checkout-iframe detection against false positives.

---

## 3. Risks & kill criteria *(R23)*

| Risk | Trigger | Action |
|---|---|---|
| Token budget breach | Bundle >8.5K on any fixture | KILL: tighten ElementGraph default cap from 30 → 20; OR drop `xpath` from FusedElement (selector alone is enough for retrieval); OR truncate `text_content_prefix` from 50 → 30 chars. Re-measure. Escalate (ASK FIRST) before exceeding 9K hard ceiling. |
| Settle p50 regression >+250ms vs v2.4 | Integration test timing | KILL: profile each settle step; the `waitForAnimationsToFinish` 1500ms cap is the most likely culprit on idle pages. Lower polling interval. If still failing, document trade-off (settle thoroughness vs speed) and ASK FIRST. |
| `element_id` instability across re-runs | Stability test fails on identical fixture | KILL: investigate which input changes. If `dom_position_path` is the culprit (e.g., re-rendered React fragments), switch to ancestor-chain encoding instead of nth-child. |
| Nondeterminism flags miss known case | Optimizely/VWO not detected on instrumented fixture | Add detector heuristic; do NOT silently skip. |
| ShadowDomTraverser exceeds depth 5 commonly on real sites | Warning emit rate >5% on integration fixtures | Investigate; bump cap to 8 only with engineering-lead approval (cost-vs-completeness). |
| IframePolicyEngine incorrectly descends into ad iframe | False-positive in classifier | ASK FIRST — security-sensitive. Tighten classifier; add cross-origin check upstream of purpose. |
| Backward-compat regression | T015 or T1B-012 fails on v2.5 code | STOP. R1.4 spec-conflict resolution. Do not silently break v2.4 consumers. |
| DeepPerceiveNode skeleton not yet present (T117 not started) | T1C-011 blocked | KILL: ship T1C-011 as a forward-stub interface only; full integration deferred to Phase 7 along with T117. Document in `phase-1c-current.md` rollup. |

---

## 4. Effort estimate

| Task | Effort | Notes |
|---|---|---|
| T1C-001 SettlePredicate | 1.5h | Composition + 5s cap + tests on hung-fetch fixture |
| T1C-002 ShadowDomTraverser | 1.0h | Recursive walk + depth cap |
| T1C-003 PortalScanner | 1.0h | Body-children scan + portal heuristic |
| T1C-004 PseudoElementCapture | 0.5h | getComputedStyle pseudo-content |
| T1C-005 IframePolicyEngine | 2.0h | Purpose classifier + 5 iframe-type fixtures |
| T1C-006 HiddenElementCapture | 1.0h | Multi-criterion hidden detection |
| T1C-007 ElementGraphBuilder | 2.5h | Fusion logic + element_id hash + ref_in_analyze_perception cross-references + 30-cap selection |
| T1C-008 NondeterminismDetector | 1.5h | Multi-vendor detection + runtime probes |
| T1C-009 WarningEmitter | 0.5h | Collector + severity routing |
| T1C-010 PerceptionBundle | 1.5h | Zod schema + envelope + freeze + accessor |
| T1C-011 Settle integration into deep_perceive | 1.0h | Skeleton extension; full DPN is Phase 7 |
| T1C-012 Integration test | 2.0h | 5 fixtures including SPA-heavy + Optimizely-instrumented + Shadow-DOM-deep |
| **Total** | **16.0h ± 2** | Single engineer |

Tasks above 2.0h: T1C-007 (2.5h) and T1C-005 (2.0h). Both have explicit kill criteria above per R23.

---

## 5. Verification

- **Per-task:** conformance tests pass on dedicated fixtures.
- **Per-phase:** integration test (T1C-012) on 5 fixtures passes; Phase 1 (T015) and Phase 1b (T1B-012) re-runs unchanged.
- **Stability:** integration test re-runs same URL twice; asserts identical `element_id` sets in `ElementGraph`.
- **Token budget:** `getTokenCount()` per state in integration test; assertion ≤8.5K.
- **Cost:** `llm_call_log` row count diff = 0 between Phase 1b baseline and Phase 1c.
- **Backward compat:** every Phase 1 + Phase 1b conformance test re-runs against bundle accessor — must pass identically.

---

## 6. Out of scope for this plan

- Full DeepPerceiveNode implementation — Phase 7 (T117).
- Cross-channel query API utility layer — Phase 14 (§33 interactive evaluate).
- Multi-state interaction discovery (formal `state_graph.edges[]` triggers) — Phase 13 master track.
- Multi-viewport bundles — Phase 5b.
- Heuristics consuming bundle queries — Phase 6 / Phase 0b.

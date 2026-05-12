---
title: Phase 1c — PerceptionBundle Envelope v2.5 — Implementation Plan
artifact_type: plan
status: approved
version: 0.2
created: 2026-04-28
updated: 2026-05-12
owner: engineering lead
authors: [Claude (drafter v0.1; master orchestrator session 15 v0.2 patch wave)]
reviewers: [Sabari (Gate 1 Pass 1 stamp 2026-05-11 — REVISE; Gate 1 Pass 2 stamp 2026-05-12 — APPROVE)]

supersedes: null
supersededBy: null

derived_from:
  - docs/specs/mvp/phases/phase-1c-perception-bundle/spec.md (v0.2 — drives this plan)
  - docs/specs/mvp/tasks-v2.md (T1C-001..T1C-012)
  - docs/specs/final-architecture/07-analyze-mode.md §7.9.3
  - docs/specs/final-architecture/06-browse-mode.md §6.6 v2.5
  - docs/specs/mvp/phases/phase-1b-perception-extensions/phase-1b-current.md (rollup §4 row 1 runtime-wiring carryforward; §2 token math)
  - .phase-state/1c/preflight-verdict.yaml (Pass 1 verdict; v0.2 patch wave responds)

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
  v0_2:
    new:
      - Frontmatter version 0.1 → 0.2 + updated 2026-05-11
      - §2.2 settle algorithm rewritten with single overall 5s `Promise.race` guard (fixes AI Reviewer I1; addresses spec R-01 + AC-01 + NF-05 hard cap)
      - §2.2 `document.fonts.ready` Promise handling fixed (was `?? true` sync-eval bug; now awaited via `page.evaluate`)
      - §2.4 ElementGraph cap reaffirmed as HARDCODED 30 for MVP (configurability claim DROPPED; addresses AI Reviewer I4)
      - §2.6 IframePolicyEngine purpose table extended with 3 security-sensitive purposes (captcha / cmp / payment_3ds) + analytics severity routing clarified (info severity)
      - §3 kill criteria re-baselined against new envelope-only NF-01 (≤2K envelope; total per-state ≤14.5K including raw); addresses AI Reviewer I2
      - §3 new kill criterion for runtime-wiring gap (EXTENSION_OUTPUT_MISSING rate > threshold)
      - §6 Out of Scope explicitly defers runtime wiring of 10 Phase 1b extractors to Phase 5 BrowseNode (addresses AI Reviewer I7)
    changed:
      - §2.2 settle algorithm sample code — fundamentally rewritten; no longer sums soft caps without overall timer
      - §2.4 selective fusion criteria — "configurable via AuditRequest.element_graph_size" → "HARDCODED 30 for MVP"
      - §2.6 iframe purpose table — extended from 6 rows (5 named + cross_origin) to 10 rows (9 purposes + cross_origin override) with distinct warning codes for security-sensitive cases
      - §3 kill criterion table — token-budget row re-baselined; new row for runtime-wiring carryforward
      - §4 effort estimate — unchanged at 16h ±2 (no new tasks added; T1C-010.5 NOT added — deferred to Phase 5)
    impacted:
      - spec.md (parallel v0.1 → v0.2 patch wave)
      - tasks.md (parallel v0.1 → v0.2 — T1C-005 acceptance updated; T1C-009 dep rationale; T1C-012 fixture matrix)
      - impact.md (parallel v0.1 → v0.2 — new §11 Namespace Contract Carryforward; §3 runtime wiring deferred)
    unchanged:
      - 12 task IDs T1C-001..T1C-012 (R18 append-only)
      - Sequencing across Day 1-2 / Day 3 / Day 4
      - File layout in §2.1
      - ElementGraph stability rules in §2.3
      - Backward-compat accessor `bundleToAnalyzePerception()` design in §2.5
      - Total effort estimate 16h ±2
  v0_1:
    new:
      - Phase 1c plan — sequencing, settle predicate composition, ElementGraph stability rules, kill criteria
    changed: []
    impacted: []
    unchanged: []

governing_rules:
  - Constitution R10 (Budget — envelope-only ≤2K per state per NF-01 v0.2)
  - Constitution R11 (Spec-Driven Development Discipline)
  - Constitution R20 (Impact Analysis)
  - Constitution R23 (Kill Criteria — re-baselined per v0.2)
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

### 2.2 Settle predicate composition (T1C-001 + R-01 + NF-05) — v0.2 rewrite

The 5-second cap is a **TOTAL** overall guard (not a sum of soft caps). Sub-step timeouts are budget hints, not the contract. The contract is: `waitForSettle()` resolves within 5000ms ± 50ms regardless of which sub-step hangs.

```ts
const SETTLE_HARD_CAP_MS = 5000;

async function waitForSettle(page: Page, opts: SettleOptions = {}): Promise<SettleResult> {
  const start = Date.now();

  // Each sub-step is wrapped in .catch(() => {}) so a hang emits a warning but doesn't abort.
  // The overall race ensures total elapsed ≤ 5000ms.
  const settleSteps = (async () => {
    await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => {});
    await waitForDomMutationsToStop(page, { idleMs: 300, maxMs: 3000 }).catch(() => {});
    await page.evaluate(() => (document as any).fonts?.ready).catch(() => {}); // awaits Promise inside browser
    await waitForAnimationsToFinish(page, { timeout: 1500 }).catch(() => {});
    if (opts.requireSelector) {
      await page.waitForSelector(opts.requireSelector, { timeout: 2000 }).catch(() => {});
    }
  })();

  const timeout = new Promise<void>((resolve) => setTimeout(resolve, SETTLE_HARD_CAP_MS));

  await Promise.race([settleSteps, timeout]);

  const elapsed = Date.now() - start;
  return { elapsed_ms: elapsed, capped_at_5s: elapsed >= SETTLE_HARD_CAP_MS - 50 };
}
```

**Key v0.2 fixes (per AI Reviewer I1 + I8):**
- `Promise.race([settleSteps, sleep(5000)])` enforces the 5s **total** hard cap. Previous v0.1 sample summed soft caps to ~8.5s worst case — wrong.
- `document.fonts.ready` is now awaited inside `page.evaluate(...)` (browser context awaits the Promise). Previous v0.1 used `waitForFunction(() => fonts?.ready ?? true)` which evaluated the Promise object as truthy (`?? true` was never reached) — wrong.
- `capped_at_5s` uses `>= SETTLE_HARD_CAP_MS - 50` to accommodate event-loop drift.

**Warning emission:** `SETTLE_TIMEOUT_5S` emitted on cap; individual sub-step hang signals propagate as `FONTS_NOT_READY` / `ANIMATION_NOT_SETTLED` warnings via the per-step `.catch()` paths (collected by WarningEmitter — T1C-009).

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

Cap: **HARDCODED 30 per state for MVP** (per AI Reviewer I4 resolution). When inclusion-criteria selection exceeds 30, ElementGraphBuilder truncates by priority (criteria 1 > 2 > 3 > 4) and emits `ELEMENT_GRAPH_TRUNCATED` warning with `truncated_count` field (per R-07 + R-09 v0.2). Configurability via `AuditRequest.element_graph_size` is **DEFERRED** — `AuditRequest` is a Phase 6 Gateway contract and Phase 1c does NOT modify it.

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

### 2.6 IframePolicyEngine purpose classifier (T1C-005) — v0.2 extended

| Purpose | Match | Decision | Warning code | Severity |
|---|---|---|---|---|
| `checkout` | `*.stripe.com`, `*.adyen.com`, `*.paypal.com`, `*.braintreepayments.com`, `*.razorpay.com`, `*.ccavenue.com`, JSON-LD `Offer` reachable in iframe | **Descend** (same-origin only) | — | — |
| `chat` | `*.intercom.io`, `*.crisp.chat`, `*.drift.com`, `*.zendesk.com`, `*.freshchat.com`, `*.tawk.to`, `*.olark.com` | **Descend** (same-origin only) | — | — |
| `video` | `*.youtube.com/embed`, `*.youtube-nocookie.com`, `*.vimeo.com`, `*.wistia.com`, `*.brightcove.net` | Skip | `IFRAME_SKIPPED` | warn |
| `analytics` | `*.googletagmanager.com`, `*.google-analytics.com`, `*.doubleclick.net`, `*.bat.bing.com`, `*.linkedin.com/li/track` | Skip + emit `IFRAME_SKIPPED` | `IFRAME_SKIPPED` | **info** |
| `social_embed` | `*.twitter.com`, `*.instagram.com`, `*.tiktok.com`, `*.facebook.com`, `*.pinterest.com`, `*.linkedin.com/embed` | Skip | `IFRAME_SKIPPED` | warn |
| `captcha` *(NEW v0.2 — security-sensitive)* | `www.google.com/recaptcha`, `*.hcaptcha.com`, `*.cloudflare.com/turnstile`, `*.arkoselabs.com` | **Skip** (security boundary — captcha contains user challenge content; must NOT be conflated with checkout/chat) | `CAPTCHA_DETECTED` | warn |
| `cmp` *(NEW v0.2 — consent management platform)* | `*.cookielaw.org` (OneTrust), `*.cookiebot.com`, `*.trustarc.com`, `*.usercentrics.eu`, `*.consensu.org` (IAB TCF) | **Skip** (Phase 5b owns cookie dismissal; Phase 1c MUST NOT descend or accidental dismissal could occur before user consent) | `CMP_DETECTED` | info |
| `payment_3ds` *(NEW v0.2 — issuer-bank auth challenge)* | Visa SafeKey (`*.3dsecure.io`, `*.verifiedbyvisa.com`), MasterCard SecureCode (`*.maestrocard.com`, `*.securecode.com`), 3DS2 challenge iframes from issuer banks | **Skip** (auth challenge content; security boundary) | `PAYMENT_3DS_DETECTED` | warn |
| `other` | unmatched | Skip | `IFRAME_SKIPPED` | warn |
| `cross_origin` | always (security override — supersedes purpose classifier) | Skip | `IFRAME_SKIPPED` | warn |

**Classifier order:** (1) cross_origin check first (security override; supersedes all purpose detection). (2) hostname pattern match. (3) JSON-LD or content-shape probe (e.g., `Offer` schema reachable in same-origin iframe pushes to `checkout`). (4) fall through to `other`.

`T1B-009 CommerceBlockExtractor` provides `commerce.isCommerce` context — used to weight checkout-iframe detection against false positives (e.g., a same-origin iframe on a non-commerce page is unlikely to be checkout even if hostname matches a payment vendor).

**Captcha-vs-checkout disambiguation (v0.2 — security-critical):** captcha hostnames are checked BEFORE checkout hostnames in the classifier. A reCAPTCHA iframe nested inside a Stripe checkout flow is classified as `captcha` (skipped) rather than `checkout` (descended). This prevents the perception layer from inadvertently descending into user-auth-challenge content.

---

## 3. Risks & kill criteria *(R23)* — v0.2 re-baselined

| Risk | Trigger | Action |
|---|---|---|
| Envelope token budget breach (NF-01 v0.2) | Bundle ENVELOPE-only (meta + performance + nondeterminism + warnings + state_graph + element_graph for state) > 2K on any fixture | KILL: tighten ElementGraph default cap from 30 → 20; OR drop `xpath` from FusedElement (selector alone is enough for retrieval); OR truncate `text_content_prefix` from 50 → 30 chars. Re-measure. Escalate (ASK FIRST) before exceeding 3K envelope hard ceiling. |
| Total per-state bundle breach (informational) | `bundle.raw.* + envelope` per state > 14.5K (Phase 1b empirical floor 12.5K + 2K envelope budget) | INVESTIGATE: most likely a Phase 1b PageStateModel growth — engage Phase 1b lead. Phase 1c envelope budget itself unaffected. |
| Settle p50 regression >+250ms vs Phase 1b T015 baseline | Integration test timing | KILL: profile each settle step; the `waitForAnimationsToFinish` 1500ms cap is the most likely culprit on idle pages. Lower polling interval. If still failing, document trade-off (settle thoroughness vs speed) and ASK FIRST. Verify `Promise.race` overall guard isn't the bottleneck (it shouldn't be — it's the upper bound, not the active timer). |
| Settle 5s hard cap not honored (NF-05) | Any fixture takes >5050ms in settle | STOP. The v0.2 settle algorithm wraps sub-steps in `Promise.race`. If hard cap is missed, the implementation diverged from plan.md §2.2 — fix the implementation, not the spec. |
| `element_id` instability across re-runs | Stability test fails on identical fixture | KILL: investigate which input changes. If `dom_position_path` is the culprit (e.g., re-rendered React fragments), switch to ancestor-chain encoding instead of nth-child. |
| Nondeterminism flags miss known case | A flag from the closed 9-value enum (R-08 v0.2) is not detected on a fixture instrumented with that vendor | Add detector heuristic; do NOT silently skip. Server-side / edge personalization fixtures are OUT OF SCOPE — do not author detectors for these (R-08 documented OOS). |
| ShadowDomTraverser exceeds depth 5 commonly on real sites | `SHADOW_DOM_NOT_TRAVERSED` warning emit rate >5% on integration fixtures | Investigate; bump cap to 8 only with engineering-lead approval (cost-vs-completeness). |
| IframePolicyEngine incorrectly descends into security-sensitive iframe | False-positive descent for captcha / cmp / payment_3ds in classifier | **STOP** — security-sensitive. The v0.2 classifier checks security categories BEFORE checkout/chat (§2.6). If a captcha iframe is classified as checkout, fix the classifier order. Do NOT proceed with descent until verified. |
| Backward-compat regression | T015 or T1B-012 fails on v2.5 code | STOP. R1.4 spec-conflict resolution. Do not silently break v2.4 consumers. |
| Runtime wiring gap (Phase 1b extractors NOT in ContextAssembler) (v0.2 NEW) | `EXTENSION_OUTPUT_MISSING` warning rate >50% on real fixtures (i.e., extractors not yet wired into `page.evaluate()` by Phase 5) | EXPECTED at Phase 1c time — Phase 5 BrowseNode owns runtime wiring (per AI Reviewer I7 resolution). Phase 1c integration test (T1C-012) authors fixtures with extractor outputs pre-populated to validate envelope assembly. Document in `phase-1c-current.md` rollup. |
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
- Multi-state interaction discovery (formal `state_graph.edges[]` triggers populated with edge metadata) — Phase 13 master track. Phase 1c emits `state_graph.edges = []` (empty array, not omitted key).
- Multi-viewport bundles — Phase 5b.
- Heuristics consuming bundle queries — Phase 6 / Phase 0b.
- **Runtime wiring of 10 Phase 1b extractors into `ContextAssembler.capture()` `page.evaluate()` (v0.2 — per AI Reviewer I7 resolution).** The 10 `.script.ts` IIFE companions (PricingExtractor, ClickTargetSizer, StickyElementDetector, PopupPresenceDetector, FrictionScorer, SocialProofDepthEnricher, MicrocopyTagger, AttentionScorer, CommerceBlockExtractor, CurrencySwitcherDetector) are wired into the live `page.evaluate()` call by **Phase 5 BrowseNode**. Phase 1c PerceptionBundle assembly assumes their outputs are already present in `bundle.raw.page_state_model_by_state[stateId]`. If an output is missing at runtime (e.g., Phase 5 hasn't shipped its wiring yet), `EXTENSION_OUTPUT_MISSING` warning is emitted and bundle assembly proceeds with that field undefined.
- **`AuditRequest.element_graph_size` configurability (v0.2 — per AI Reviewer I4 resolution).** ElementGraph cap is hardcoded at 30 for MVP. Configurability is deferred to Phase 6 Gateway when AuditRequest is first defined.
- **Server-side / CDN-edge personalization detection (v0.2 — per AI Reviewer Pass 1 completeness gap resolution).** Akamai EdgeWorkers, Cloudflare Workers, Vercel edge personalization are by definition not client-detectable. Phase 1c does not author detectors for these; they're documented as out-of-scope nondeterminism categories in R-08.

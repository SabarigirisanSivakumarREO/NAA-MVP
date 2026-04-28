---
title: Neural MVP Task Catalog (T001-T262)
artifact_type: tasks
status: approved
version: 2.3.3
created: 2026-04-15
updated: 2026-04-28
owner: engineering lead
authors: [REO Digital team, Claude]
reviewers: [REO Digital team]

supersedes: v2.3.2
supersededBy: null

derived_from:
  - docs/specs/final-architecture/ (§01-§36 + §33a)
  - docs/specs/mvp/PRD.md (F-001..F-021, NF-001..NF-010)

req_ids: []  # Tasks reference REQ-IDs from source specs; do not define their own

impact_analysis: null
breaking: false
affected_contracts: []

delta:
  new: []
  changed:
    - Version label bumped v2.2a → v2.3 to align with master plan version (PRD §17 already referenced v2.3; file was out of sync)
    - R17 lifecycle frontmatter added (was missing; self-compliance fix)
    - v2.3 → v2.3.1 (2026-04-27) — T007 StealthConfig acceptance scope REDUCED to honor PRD §3.1 + architecture.md §6.4 v1.1 deferral of the stealth plugin. Stealth plugin (`playwright-extra-plugin-stealth`) NOT loaded in MVP; T007 now scaffolds a thin wrapper using Playwright's native API for user-agent + viewport + WebGL fingerprint rotation per session. v1.1 plugs the actual stealth plugin into this scaffold. Resolved Option B per Constitution R1.4 + R11.4 spec-conflict resolution 2026-04-27.
    - v2.3.1 → v2.3.2 (2026-04-27) — Phase 3 verification scope REDUCED from 9 verify strategies (T053-T061) to **3 MVP strategies** (T053 url_change, T054 element_appears, T055 element_text) to honor INDEX.md row 3 "Verification (thin)" + CLAUDE.md §4 "3 verify strategies (MVP) + VerifyEngine". T056-T061 (network_request, no_error_banner, snapshot_diff, custom_js, no_captcha, no_bot_block) DEFERRED to v1.1. T065 acceptance updated: "all 3 MVP strategies + VerifyEngine + FailureClassifier + ConfidenceScorer integration on browse fixture". Resolved Option A per blanket pattern adopted 2026-04-27 (same precedent as T007).
    - v2.3.2 → v2.3.3 (2026-04-28) — **Phase 0b section added** (T0B-001..T0B-005 — drafting prompt template, verification protocol, PR Contract Proof block extension, `pnpm heuristic:lint` CLI, heuristics-repo README) per PRD F-012 v1.2 amendment 2026-04-26 (LLM-assisted authoring, engineering-owned). **T103-T105 counts REDUCED** from 50/35/15 (=100) to **15/10/5 (=30)** per same F-012 v1.2 amendment — MVP scope; the additional 70 deferred to v1.1+ to reach §09.3's 100-heuristic master target. T103-T105 task definitions remain in Phase 6 section but are now declared OWNED by Phase 0b workstream (Phase 6 is the engine; Phase 0b is the content). Resolved Option A per CLAUDE.md standing directive (drift discovered mid-session 2026-04-28). See `docs/specs/mvp/phases/phase-0b-heuristics/{spec,plan,tasks,impact,README}.md` for full Phase 0b authoring workflow.
  impacted:
    - CLAUDE.md §1 (reading order — version reference now consistent)
    - docs/specs/AI_Browser_Agent_Architecture_v3.1.md REQ-BROWSE-HUMAN-005 — v3.1 stealth requirement remains canonical for v1.1; MVP carries reduced scope only.
    - docs/specs/mvp/phases/phase-1-perception/ — Phase 1 spec/plan/tasks reflect reduced T007 scope from authoring date.
    - docs/specs/mvp/phases/phase-0b-heuristics/ — NEW phase folder shipped 2026-04-28 (spec/plan/tasks/impact/README/checklist)
    - docs/specs/mvp/phases/phase-6-heuristics/ — already references "T103-T105 are Phase 0b workstream" since v0.2; v2.3.3 patch makes the count reduction (50/35/15 → 15/10/5) explicit in T103-T105 entries
    - docs/specs/mvp/phases/INDEX.md — v1.1 → v1.2 (Phase 0b row marked spec-shipped; Phase 7 + Phase 8 marked spec-shipped 2026-04-28)
  unchanged:
    - 262 of 263 task definitions retain v2.3.2 wording (T103-T105 counts reduced; nothing else changed)
    - 12-phase structure
    - Phase 0b workstream principle (was already documented; v2.3.3 makes the section explicit)
    - All other acceptance criteria + smoke tests
    - REQ-BROWSE-HUMAN-005/006 ID references in T007 (REQ-IDs preserved; acceptance scope re-interpreted per MVP deferral)

governing_rules:
  - Constitution R17 (Lifecycle)
  - Constitution R18 (Delta)
  - Constitution R1.4 (Source of Truth — spec disagreement resolution)
  - Constitution R11.4 (Fix-spec-first when conflict found)
---

# MVP Tasks v2.3 (T001-T262)

> **Summary (~120 tokens — agent reads this first):** Canonical task catalog for Neural MVP — 263 tasks across 12 phases (MVP subset: ~103 tasks across 9 phases). Each task has acceptance criteria, smoke test, and cross-references to source architecture specs. Eventually superseded per-phase by Spec Kit-generated `tasks.md` once `/speckit.tasks` runs; this file remains the canonical definitions reference.

## Reconciled from Master Architecture + §33 Agent Composition + v2.2 Refinement + v2.2a External Review + v2.3 AnalyzePerception Enrichments

> **Version:** 2.3 — Version label bumped from v2.2a on 2026-04-24 to align with master plan v2.3 (PRD §17 already cited v2.3; the file was lagging). No task-content changes in the v2.2a → v2.3 bump; this is a label-alignment fix. v2.3 AnalyzePerception enrichments (14 fields) are tracked in PRD §F-005 and referenced from task definitions.
> **Prior versions:** v2.2a (label drift, fixed 2026-04-24), v2.2 (T001-T262, pre-gap-analysis), v2.1 (T001-T212, §33), v2.0 (T001-T192, §01-§30), v1.0 (T001-T155, original)
> **Methodology:** Q6-R ruling + §33a interface-first integration + gap-analysis-driven refinement
> **Total:** 263 tasks across 12 phases
> **Key changes in v2.2a (retained in v2.3):**
>   - Phase 12 (Mobile Viewport, T227-T231) added — MASTER PLAN ONLY
>   - Phase 0b (Heuristic Authoring) parallel workstream — CRO team, not engineering
>   - 50 new tasks T213-T262
>   - 3 new spec sections: §34 Observability, §35 Report Generation, §36 Golden Test Suite
>   - 12th grounding rule GR-012 (benchmark validation)

> **Conventions:**
> - `T###` = task ID
> - `dep:` = dependencies
> - `spec:` = source-of-truth REQ-IDs
> - `[P]` = can run in parallel with sibling tasks
> - `[MOD]` = modified from v1.0 (changes noted)
> - `[NEW]` = added in v2.0

---

## Phase 0: Setup (T001-T005) — UNCHANGED

### T001: Initialize monorepo
- **dep:** none
- **spec:** plan.md repo structure
- **files:** `package.json` (root), `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.env.example`
- **smoke test:** `pnpm install` succeeds
- **acceptance:** Monorepo with `packages/` and `apps/` workspaces. Turborepo configured.

### T002: Create agent-core package skeleton
- **dep:** T001
- **files:** `packages/agent-core/package.json`, `tsconfig.json`, `src/index.ts`, `vitest.config.ts`
- **smoke test:** `pnpm build` succeeds
- **acceptance:** TypeScript compiles, Vitest runs.

### T003: Create CLI app skeleton
- **dep:** T001
- **files:** `apps/cli/package.json`, `tsconfig.json`, `src/index.ts`
- **smoke test:** `pnpm cro:audit --version` prints version
- **acceptance:** CLI runnable via pnpm script.

### T004: Setup Docker Compose for Postgres
- **dep:** T001
- **files:** `docker-compose.yml` (postgres:16-bullseye + pgvector)
- **smoke test:** `docker-compose up -d` starts Postgres
- **acceptance:** Postgres 16 + pgvector running locally.

### T005: Setup environment variables
- **dep:** T004
- **files:** `.env.example`, `.env` (gitignored)
- **acceptance:** All required env vars documented.

---

## Phase 0b: Heuristic Authoring (T0B-001..T0B-005 + T103-T105) — NEW v2.3.3 (2026-04-28)

> **Source:** PRD F-012 v1.2 amendment (2026-04-26) — heuristic authoring switched from CRO-parallel to LLM-assisted with mandatory human verification per Constitution R15.3.2; engineering-owned MVP workstream. **30 heuristics total** (≈15 Baymard + ≈10 Nielsen + ≈5 Cialdini); the additional 70 to reach §09.3's 100-heuristic master target deferred to v1.1+.
>
> **Phase 0b folder:** `docs/specs/mvp/phases/phase-0b-heuristics/` (spec/plan/tasks/impact/README/checklist).
>
> **Task IDs:** T0B-001..T0B-005 are CANONICAL HERE. **T103/T104/T105 are CANONICAL in Phase 6 section below** (their count reduced 50/35/15 → 15/10/5 in v2.3.3); they are OWNED by Phase 0b workstream (Phase 6 is the engine; Phase 0b is the content authoring).

### T0B-001: Drafting prompt template
- **dep:** T001
- **spec:** REQ-HK-001 + Constitution R15.3.1 (provenance fields) + R15.3.3 (drafting LLM responses isolated from observability)
- **files:** `docs/specs/mvp/templates/heuristic-drafting-prompt.md`
- **acceptance:** Markdown template with system block + user block accepting `{source, source_url, citation_text, archetype, page_types, device}` inputs. Output schema reference to `HeuristicSchemaExtended` (Phase 6 T101). Banned-phrasing prohibition (no conversion-rate predictions) embedded in system block. Producing a draft on a known Baymard excerpt yields valid `HeuristicSchemaExtended.parse()`-compatible JSON. See `phase-0b-heuristics/plan.md` §2.

### T0B-002: Verification protocol document
- **dep:** none
- **spec:** Constitution R15.3.2 (human verification mandatory)
- **files:** `docs/specs/mvp/templates/heuristic-verification-protocol.md`
- **acceptance:** 8-step protocol — URL liveness check, citation locate, ±20% benchmark re-derivation (quantitative) or text-reference (qualitative), banned-phrase check, manifest-selector check, fill `verified_by`/`verified_date`, run `pnpm heuristic:lint`, commit with PR Contract Proof block. Includes 3-strike re-draft rule + escalation criteria. See `phase-0b-heuristics/plan.md` §3.

### T0B-003: PR Contract Proof block extension
- **dep:** T0B-002, PRD §10.9 PR Contract template
- **spec:** Constitution R15.3.2 + PRD §10.9
- **files:** `docs/specs/mvp/templates/heuristic-pr-proof.md`
- **acceptance:** Per-heuristic Proof block template covering heuristic ID, file path, drafted by, verified by + date, source URL (with status / archive note), re-derivation note, lint status, banned-phrase check status, manifest selectors. Linked from PRD §10.9 PR Contract section in next PRD bump. See `phase-0b-heuristics/plan.md` §4.

### T0B-004: `pnpm heuristic:lint` CLI helper
- **dep:** T002, T003, T101 (HeuristicSchemaExtended — Phase 6)
- **spec:** Constitution R15.3 (benchmark + provenance both required) + R15.3.1 (5 provenance fields) + R15.3.3 (isolation) + R5.3 + GR-007 (banned phrasing)
- **files:**
  - `apps/cli/src/commands/heuristic-lint.ts` (NEW)
  - `apps/cli/package.json` (add `heuristic:lint` script)
  - `apps/cli/tests/conformance/heuristic-lint.test.ts` (NEW)
- **acceptance:** Five checks — (1) Zod parse against `HeuristicSchemaExtended`; (2) all 5 `provenance` fields non-empty; (3) `benchmark` discriminated union present + well-formed; (4) manifest selectors `archetype` + `page_type` + `device` present; (5) deterministic banned-phrase regex check on `recommendation.summary` + `recommendation.details`. Exit non-zero on any failure. Conformance test covers 5 fail cases + 1 pass case + AC-13 isolation assertions (`.gitignore` contains `.heuristic-drafts/`; no LangSmith client in drafting subprocess). See `phase-0b-heuristics/plan.md` §5.
- **smoke test:** `pnpm heuristic:lint heuristics-repo/baymard/BAY-CHECKOUT-001.json` exit code 0 on a synthetic valid heuristic.

### T0B-005: `heuristics-repo/README.md` + `.gitignore` patch
- **dep:** T0B-001, T0B-002, T0B-003, T0B-004
- **spec:** Constitution R6 + R15.3 + R15.3.3
- **files:**
  - `heuristics-repo/README.md` (NEW)
  - `.gitignore` (add `.heuristic-drafts/`)
- **acceptance:** README covers — authoring workflow (draft → verify → lint → PR), R6 IP discipline (drafting subprocess isolation per `phase-0b-heuristics/plan.md` §6), spot-check protocol (3 rounds at +10/+20/+30 marks; ≤1 of 5 divergence acceptance), link back to PRD F-012 + Phase 0b spec. New author can follow it without engineering-lead clarification.

---

> **T103/T104/T105 are canonically defined in the Phase 6 section below** (with counts reduced to 15/10/5 in v2.3.3). They are OWNED by the Phase 0b workstream — see Phase 0b section above + `docs/specs/mvp/phases/phase-0b-heuristics/tasks.md` for full sequencing, kill criteria, and PR Contract Proof block requirements.

---

## Phase 1: Perception Foundation (T006-T015) — T007 SCOPE REDUCED v2.3.1 (2026-04-27)

### T006: BrowserManager
- **dep:** T002
- **spec:** REQ-BROWSE-NODE-003
- **files:** `packages/agent-core/src/browser-runtime/BrowserManager.ts`
- **smoke test:** Launch browser, navigate to amazon.in, close cleanly
- **acceptance:** Wraps Playwright, returns BrowserSession, implements BrowserEngine interface.

### T007: StealthConfig (REDUCED SCOPE per v2.3.1 — stealth plugin deferred to v1.1)
- **dep:** T006
- **spec:** REQ-BROWSE-HUMAN-005, REQ-BROWSE-HUMAN-006 (interpreted at MVP-reduced scope per PRD §3.1 + architecture.md §6.4)
- **files:** `packages/agent-core/src/browser-runtime/StealthConfig.ts`
- **smoke test (MVP):** Browser session reports a different user-agent + viewport + WebGL fingerprint pair on two consecutive launches (per-session rotation verified; bot.sannysoft.com is **NOT** an MVP acceptance target — full stealth in v1.1).
- **acceptance (MVP):** Thin wrapper around Playwright's native context options. Provides `applyStealthConfig(context: BrowserContext, opts?: StealthOptions): void` that sets randomized user-agent (from a small pool of 5-10 modern Chrome strings), viewport (3 common desktop sizes), and WebGL fingerprint via `addInitScript`. Does **NOT** load `playwright-extra` or `playwright-extra-plugin-stealth` in MVP. v1.1 will plug the real plugin into this same interface without code-shape changes.
- **deferred to v1.1:** `playwright-extra` + `playwright-extra-plugin-stealth` integration; bot.sannysoft.com full-pass acceptance; advanced fingerprint masking (canvas, audio, navigator props beyond webdriver).

### T008: AccessibilityExtractor
- **dep:** T006
- **spec:** REQ-BROWSE-PERCEPT-001, REQ-BROWSE-PERCEPT-002
- **files:** `packages/agent-core/src/perception/AccessibilityExtractor.ts`
- **smoke test:** Extract AX-tree from amazon.in
- **acceptance:** >50 nodes, includes search box.

### T009: HardFilter
- **dep:** T008
- **spec:** REQ-BROWSE-PERCEPT-002
- **files:** `packages/agent-core/src/perception/HardFilter.ts`
- **acceptance:** Removes invisible/disabled/aria-hidden/zero-dim. Count drops >50%.

### T010: SoftFilter
- **dep:** T009
- **spec:** REQ-BROWSE-PERCEPT-003
- **files:** `packages/agent-core/src/perception/SoftFilter.ts`
- **acceptance:** Scores by relevance, returns top 30.

### T011: MutationMonitor
- **dep:** T006
- **spec:** REQ-BROWSE-PERCEPT-005, REQ-BROWSE-PERCEPT-006
- **files:** `packages/agent-core/src/perception/MutationMonitor.ts`
- **acceptance:** Injects MutationObserver, tracks mutations, settles within 2s.

### T012: ScreenshotExtractor
- **dep:** T006
- **files:** `packages/agent-core/src/perception/ScreenshotExtractor.ts`
- **acceptance:** JPEG <150KB, ≤1280px wide.

### T013: ContextAssembler
- **dep:** T008, T009, T010, T011, T012
- **spec:** REQ-BROWSE-PERCEPT-001
- **files:** `packages/agent-core/src/perception/ContextAssembler.ts`
- **acceptance:** Returns full PageStateModel.

### T014: PageStateModel types + Zod schemas
- **dep:** T002
- **files:** `packages/agent-core/src/perception/types.ts`
- **acceptance:** All sub-types defined with Zod.

### T015: Phase 1 integration test
- **dep:** T013
- **files:** `packages/agent-core/tests/integration/phase1.test.ts`
- **acceptance:** PageStateModel on 3 sites, <1500 tokens each.

---

## Phase 1b: Perception Extensions v2.4 (T1B-001 to T1B-012) — NEW (2026-04-28)

**Spec:** §07 §7.9.2 (AnalyzePerception v2.4 extensions). **Closes:** 9 perception gaps from master-checklist coverage audit + currency switcher. **Runs:** Week 2-3, after Phase 1, before Phase 2. **Token impact:** +1.5K to AnalyzePerception payload (5K → 6.5K). **Cost impact:** zero (no new LLM calls; single page.evaluate()).

### T1B-001: PricingExtractor
- **dep:** T013, T014
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (pricing block)
- **files:** `packages/agent-core/src/perception/extensions/PricingExtractor.ts`
- **acceptance:** Extract from PDP fixture. `pricing.{displayFormat, amount, amountNumeric, currency, taxInclusion, anchorPrice, discountPercent, comparisonShown, boundingBox}` populated when present; `null` when absent.

### T1B-002: ClickTargetSizer
- **dep:** T013
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (clickTargets[])
- **files:** `packages/agent-core/src/perception/extensions/ClickTargetSizer.ts`
- **acceptance:** Compute `clickTargets[]` on 5 fixtures. `isMobileTapFriendly` true for ≥48×48 px (WCAG 2.5.5), false for <48×48; `elementType` correctly classified as cta / link / form_control / icon_button.

### T1B-003: StickyElementDetector
- **dep:** T013
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (stickyElements[])
- **files:** `packages/agent-core/src/perception/extensions/StickyElementDetector.ts`
- **acceptance:** Detect sticky CTA / cart / nav on test fixtures. `stickyElements[]` populated with `type`, `positionStrategy` ("sticky" / "fixed"), `viewportCoveragePercent`, `isAboveFold`, `containsPrimaryCta`.

### T1B-004: PopupPresenceDetector (presence-only — behavior in Phase 5b)
- **dep:** T013
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (popups[] presence layer)
- **files:** `packages/agent-core/src/perception/extensions/PopupPresenceDetector.ts`
- **acceptance:** Detect modal / cookie banner / consent at page load. `popups[]` populated with `type`, `isInitiallyOpen`, `hasCloseButton`, `closeButtonAccessibleName`, `viewportCoveragePercent`, `blocksPrimaryContent`. Behavior fields (`isEscapeDismissible`, `isClickOutsideDismissible`) **null** until Phase 5b populates them.

### T1B-005: FrictionScorer
- **dep:** T1B-004, T013
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (frictionScore)
- **files:** `packages/agent-core/src/perception/extensions/FrictionScorer.ts`
- **acceptance:** Compute on form + popup fixtures. `frictionScore.{totalFormFields, requiredFormFields, popupCount, forcedActionCount, raw, normalized}` computed; `normalized` ∈ [0, 1].

### T1B-006: SocialProofDepthEnricher
- **dep:** T013
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (socialProofDepth)
- **files:** `packages/agent-core/src/perception/extensions/SocialProofDepthEnricher.ts`
- **acceptance:** Extract from review-block fixture. `socialProofDepth.{reviewCount, starDistribution, recencyDays, hasAggregateRating, hasIndividualReviews, thirdPartyVerified}` populated.

### T1B-007: MicrocopyTagger
- **dep:** T013
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (microcopy.nearCtaTags[])
- **files:** `packages/agent-core/src/perception/extensions/MicrocopyTagger.ts`
- **acceptance:** Tag near-CTA microcopy on 5 fixtures with manual ground truth. Tags applied: `risk_reducer` / `urgency` / `security` / `guarantee` / `social_proof` / `value_prop`. Achieves ≥80% precision against ground truth.

### T1B-008: AttentionScorer
- **dep:** T013
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (attention)
- **files:** `packages/agent-core/src/perception/extensions/AttentionScorer.ts`
- **acceptance:** Compute dominant element + 3 contrast hotspots on test fixtures. `attention.dominantElement` populated with `type` / `selector` / `score` ∈ [0, 1]; `contrastHotspots[]` has 3 entries with `boundingBox` + `contrastScore`.

### T1B-009: CommerceBlockExtractor
- **dep:** T013
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (commerce)
- **files:** `packages/agent-core/src/perception/extensions/CommerceBlockExtractor.ts`
- **acceptance:** Extract on PDP / cart / checkout fixtures. `commerce.{isCommerce, stockStatus, stockMessage, shippingSignals[], returnPolicyPresent, returnPolicyText, guaranteeText}` populated when commerce; `isCommerce` false on non-commerce pages.

### T1B-010: CurrencySwitcherDetector
- **dep:** T013
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (metadata.currencySwitcher)
- **files:** `packages/agent-core/src/perception/extensions/CurrencySwitcherDetector.ts`
- **acceptance:** Detect switcher in nav fixtures. `metadata.currencySwitcher.{present, currentCurrency, availableCurrencies, isAccessibleAt}` populated; `null` when no switcher present.

### T1B-011: AnalyzePerception v2.4 schema (Zod)
- **dep:** T1B-001 through T1B-010, T014
- **spec:** REQ-ANALYZE-PERCEPTION-V24-001 (full schema)
- **files:** `packages/agent-core/src/perception/schema.ts`
- **acceptance:** Zod schema validates all 10 new field groups. Backward-compat with v2.3 maintained — existing v2.3 consumers continue to work without modification. Total payload ≤6.5K tokens.

### T1B-012: Phase 1b integration test
- **dep:** T1B-001 through T1B-011
- **spec:** Phase 1b exit gate
- **files:** `packages/agent-core/tests/integration/perception-extensions.test.ts`
- **acceptance:** Run on 5 fixture sites (homepage, PDP, cart, checkout, content). All 10 extensions populate without error. Backward-compat verified. Token budget ≤6.5K. No regression on v2.3 fields.

---

## Phase 1c: PerceptionBundle Envelope v2.5 (T1C-001 to T1C-012) — NEW (2026-04-28)

**Spec:** §07 §7.9.3 (PerceptionBundle envelope + ElementGraph + FusedElement), §06 §6.6 v2.5 (DOM traversal extensions). **Adopts:** `docs/Improvement/perception_layer_spec.md` build-order items 1, 2, 6 + Shadow DOM / iframe / pseudo-element traversal. **Wraps existing AnalyzePerception — does not replace.** **Runs:** Week 3-5, after Phase 1b, before Phase 2. **Token impact:** +2K to bundle (analyze perception 6.5K → bundle 8.5K). **Cost impact:** zero LLM, ~+200ms per state for settle predicate.

### T1C-001: SettlePredicate
- **dep:** T006 (BrowserManager)
- **spec:** REQ-PERCEPT-V25-002 + spec §3.4
- **files:** `packages/agent-core/src/perception/SettlePredicate.ts`
- **acceptance:** Wait for settle on SPA fixtures (network idle + mutation stop + fonts ready + animations done + optional selector). Returns within 5s hard cap. Emits `SETTLE_TIMEOUT_5S` warning if capped.

### T1C-002: ShadowDomTraverser
- **dep:** T013 (ContextAssembler)
- **spec:** REQ-BROWSE-PERCEPT-007 (Shadow DOM)
- **files:** `packages/agent-core/src/perception/ShadowDomTraverser.ts`
- **acceptance:** Walk 3 nested shadow roots on test fixture. Captures all elements. Emits `SHADOW_DOM_NOT_TRAVERSED` warning if recursion depth >5.

### T1C-003: PortalScanner
- **dep:** T013
- **spec:** REQ-BROWSE-PERCEPT-007 (React Portals + Vue Teleport + Angular CDK Overlay)
- **files:** `packages/agent-core/src/perception/PortalScanner.ts`
- **acceptance:** Detect React Portal modals on fixture. Marks `is_portal: true` on FusedElement. Finds elements not reachable from logical parent tree.

### T1C-004: PseudoElementCapture
- **dep:** T013
- **spec:** REQ-BROWSE-PERCEPT-007 (pseudo-element content)
- **files:** `packages/agent-core/src/perception/PseudoElementCapture.ts`
- **acceptance:** Capture `::before` / `::after` content on badge fixture. Returns "NEW" / "BESTSELLER" / required-field markers. Skips empty / punctuation-only content.

### T1C-005: IframePolicyEngine
- **dep:** T013, T1B-009 (CommerceBlockExtractor for purposeGuess context)
- **spec:** REQ-BROWSE-PERCEPT-007 (iframe policy)
- **files:** `packages/agent-core/src/perception/IframePolicyEngine.ts`
- **acceptance:** Process 5 iframe types. checkout (stripe.com) + chat (intercom) → descend. video (youtube) + analytics (gtm) + social_embed (twitter) → skip + emit `IFRAME_SKIPPED` warning. Cross-origin always skipped.

### T1C-006: HiddenElementCapture
- **dep:** T013
- **spec:** REQ-BROWSE-PERCEPT-008
- **files:** `packages/agent-core/src/perception/HiddenElementCapture.ts`
- **acceptance:** Capture `display:none` + `aria-hidden=true` + `visibility:hidden` + offscreen + zero-dimension. `hiddenElements[]` populated with selector + reason.

### T1C-007: ElementGraphBuilder
- **dep:** T1C-002, T1C-003, T1C-004, T1C-005, T1C-006, T1B-011 (v2.4 schema)
- **spec:** §07 §7.9.3 ElementGraph + FusedElement
- **files:** `packages/agent-core/src/perception/ElementGraphBuilder.ts`
- **acceptance:** Build fused graph from 5 fixture pages. Top-30 elements per state with stable `element_id`. AX + DOM + bbox + style + crop_url joined. `ref_in_analyze_perception` cross-references populated to link FusedElement back to v2.3/v2.4 array indices. `element_id` stable across re-runs of same URL.

### T1C-008: NondeterminismDetector
- **dep:** T013
- **spec:** §07 §7.9.3 nondeterminism_flags
- **files:** `packages/agent-core/src/perception/NondeterminismDetector.ts`
- **acceptance:** Detect Optimizely / VWO / Google Optimize via script presence + cookie patterns. Detect personalization cookies. Detect ad auctions. Detect time-based content via runtime probe. `nondeterminism_flags[]` populated with specific flags per detector.

### T1C-009: WarningEmitter
- **dep:** T1C-001, T1C-002, T1C-005, T1C-007
- **spec:** §07 §7.9.3 warnings
- **files:** `packages/agent-core/src/perception/WarningEmitter.ts`
- **acceptance:** Emit warnings during capture across all 8 documented warning codes. Bundle has `warnings[]` with code + message + severity. Severity routing: info / warn / error.

### T1C-010: PerceptionBundle (Zod schema + envelope)
- **dep:** T1C-001 through T1C-009
- **spec:** §07 §7.9.3 PerceptionBundle
- **files:** `packages/agent-core/src/perception/PerceptionBundle.ts`
- **acceptance:** Wrap existing AnalyzePerception + ElementGraph + state nodes. Bundle Zod-validates. Backward-compat helper `bundleToAnalyzePerception()` returns existing v2.4 shape from bundle. Token budget ≤8.5K per state. Bundle is immutable after capture (Object.freeze).

### T1C-011: Settle integration into deep_perceive
- **dep:** T1C-001, T117 (DeepPerceiveNode from Phase 7 — forward-stub here, populate in Phase 7)
- **spec:** §07 §7.5 deep_perceive
- **files:** `packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts` (extend skeleton)
- **acceptance:** Run settle before AnalyzePerception capture. Settle predicate gates capture; settle warnings propagate to bundle.

### T1C-012: Phase 1c integration test
- **dep:** T1C-001 through T1C-011
- **spec:** Phase 1c exit gate
- **files:** `packages/agent-core/tests/integration/perception-bundle.test.ts`
- **acceptance:** Build PerceptionBundle on 5 fixture sites (homepage, PDP, cart, checkout, SPA-heavy). All channels populated. Bundle ≤8.5K tokens per state. ElementGraph ≤30 elements. `bundleToAnalyzePerception()` returns identical v2.4 shape on baseline fixtures. Nondeterminism flags emit on Optimizely-enabled fixture. Warnings emit on Shadow-DOM-deep fixture. Backward-compat with v2.4 consumers verified — existing T015 (Phase 1 test) and T1B-012 (Phase 1b test) still pass.

---

## Phase 2: MCP Tools + Human Behavior (T016-T050) — UNCHANGED

### T016: MouseBehavior
- **dep:** T006
- **spec:** REQ-BROWSE-HUMAN-001, REQ-BROWSE-HUMAN-002
- **acceptance:** ghost-cursor Bezier, ~500ms mean.

### T017: TypingBehavior
- **dep:** T006
- **spec:** REQ-BROWSE-HUMAN-003, REQ-BROWSE-HUMAN-004
- **acceptance:** Gaussian delays, 1-2% typos.

### T018: ScrollBehavior
- **dep:** T006
- **acceptance:** Variable momentum, triggers lazy-load.

### T019: MCPServer skeleton
- **dep:** T002
- **spec:** REQ-MCP-001, REQ-MCP-002
- **acceptance:** @modelcontextprotocol/sdk, tool registration via Zod.

### T020-T042: 23 Browse Tools [P]

| Task | Tool | File |
|------|------|------|
| T020 | browser_navigate | `mcp/tools/navigate.ts` |
| T021 | browser_go_back | `mcp/tools/goBack.ts` |
| T022 | browser_go_forward | `mcp/tools/goForward.ts` |
| T023 | browser_reload | `mcp/tools/reload.ts` |
| T024 | browser_get_state | `mcp/tools/getState.ts` |
| T025 | browser_screenshot | `mcp/tools/screenshot.ts` |
| T026 | browser_get_metadata | `mcp/tools/getMetadata.ts` |
| T027 | browser_click | `mcp/tools/click.ts` |
| T028 | browser_click_coords | `mcp/tools/clickCoords.ts` |
| T029 | browser_type | `mcp/tools/type.ts` |
| T030 | browser_scroll | `mcp/tools/scroll.ts` |
| T031 | browser_select | `mcp/tools/select.ts` |
| T032 | browser_hover | `mcp/tools/hover.ts` |
| T033 | browser_press_key | `mcp/tools/pressKey.ts` |
| T034 | browser_upload | `mcp/tools/upload.ts` |
| T035 | browser_tab_manage | `mcp/tools/tabManage.ts` |
| T036 | browser_extract | `mcp/tools/extract.ts` |
| T037 | browser_download | `mcp/tools/download.ts` |
| T038 | browser_find_by_text | `mcp/tools/findByText.ts` |
| T039 | browser_get_network | `mcp/tools/getNetwork.ts` |
| T040 | browser_wait_for | `mcp/tools/waitFor.ts` |
| T041 | agent_complete | `mcp/tools/agentComplete.ts` |
| T042 | agent_request_human | `mcp/tools/requestHuman.ts` |

### T043: browser_evaluate (with sandbox)
- **spec:** REQ-MCP-SANDBOX-001..003
- **acceptance:** Sandbox blocks cookies/localStorage/fetch/navigation.

### T044: page_get_element_info
- **acceptance:** Returns boundingBox, isAboveFold, computedStyles, contrastRatio.

### T045: page_get_performance
- **acceptance:** Returns DOMContentLoaded, fullyLoaded, resourceCount, LCP.

### T046: page_screenshot_full
- **acceptance:** Full scroll capture, max 15000px, JPEG <2MB.

### T047: page_annotate_screenshot
- **acceptance:** Sharp-based, severity colors, overlap avoidance.

### T048: page_analyze [MOD v2.3]
- **spec:** REQ-TOOL-PA-001 + REQ-ANALYZE-PERCEPTION-V23-001
- **v2.3 changes:** `sections[]` union extended with `metadata_full`, `iframes`, `accessibility`, `page_type` (4 new sections). Implementation populates 14 v2.3 enrichment fields within the same single `page.evaluate()` call — no extra round-trips, no cost impact. See §07.9.1 for full enrichment list: metadata merge (description/canonical/lang/OG/schema.org), structure.titleH1Match, textContent.valueProp + urgencyScarcityHits + riskReversalHits, ctas[].accessibleName + role + hover/focus styles, forms[].fields[].accessibleName + role, trustSignals[].subtype + source + attribution + freshnessDate + pixelDistanceToNearestCta, iframes[] with purposeGuess, navigation.footerNavItems, accessibility.keyboardFocusOrder + skipLinks, performance.INP + CLS + TTFB + timeToFirstCtaInteractable, inferredPageType.primary + alternatives[].
- **acceptance:** Single page.evaluate(), returns full AnalyzePerception with all baseline + 14 v2.3 fields populated. Unit tests for each v2.3 field on fixture pages.

### T049: RateLimiter
- **spec:** REQ-BROWSE-RATE-001..002
- **acceptance:** 2s min interval, per-domain limits.

### T050: Phase 2 integration test
- **acceptance:** All 28 tools work tool-by-tool on amazon.in.

---

## Phase 3: Verification & Confidence (T051-T065) — T053-T061 SCOPE REDUCED v2.3.2 (2026-04-27)

### T051: ActionContract type
### T052: VerifyStrategy union type

### T053-T061: Verify Strategies [P] — 3 MVP / 6 DEFERRED to v1.1
| Task | Strategy | MVP scope? |
|------|----------|------------|
| T053 | url_change | ✅ MVP — verifies navigation succeeded |
| T054 | element_appears | ✅ MVP — verifies DOM action result |
| T055 | element_text | ✅ MVP — verifies content change |
| T056 | network_request | ❌ DEFERRED to v1.1 |
| T057 | no_error_banner | ❌ DEFERRED to v1.1 |
| T058 | snapshot_diff | ❌ DEFERRED to v1.1 |
| T059 | custom_js | ❌ DEFERRED to v1.1 |
| T060 | no_captcha | ❌ DEFERRED to v1.1 (stealth-adjacent; also v1.1 per T007) |
| T061 | no_bot_block | ❌ DEFERRED to v1.1 (stealth-adjacent; also v1.1 per T007) |

**MVP rationale (per CLAUDE.md §4 + INDEX.md row 3):** the 3 MVP strategies cover the bulk of Phase 5 Browse MVP's verification needs (post-navigation, post-click, post-type). Network / snapshot / captcha / bot detection are advanced and stealth-adjacent — defer alongside the stealth plugin (T007) to v1.1.

### T062: VerifyEngine (mutation-aware) — operates on the 3 MVP strategies (interface accepts the v1.1 strategies as a forward-compat seam)
### T063: FailureClassifier
### T064: ConfidenceScorer (multiplicative — R4.4)
### T065: Phase 3 integration test — exercises 3 MVP strategies + VerifyEngine + FailureClassifier + ConfidenceScorer on a browse fixture

---

## Phase 4: Safety + Infrastructure (T066-T080) — T070 MODIFIED

### T066: ActionClassifier — UNCHANGED
### T067: SafetyCheck — UNCHANGED
### T068: DomainPolicy — UNCHANGED
### T069: CircuitBreaker — UNCHANGED

### T070: PostgreSQL schema (Drizzle) [MOD]
- **dep:** T004
- **spec:** §13-data-layer.md + §13.6 extensions
- **files:**
  - `packages/agent-core/src/db/schema.ts`
  - `packages/agent-core/src/db/migrations/0001_initial.sql`
  - `packages/agent-core/src/db/migrations/0002_master_extensions.sql` **[NEW]**
- **smoke test:** `pnpm db:migrate` succeeds, all tables exist
- **v2.0 changes:**
  - Original 7 tables: clients, audit_runs, findings, screenshots, sessions, audit_log, rejected_findings ✅
  - **NEW tables added:** `page_states`, `state_interactions`, `finding_rollups`, `reproducibility_snapshots`, `audit_requests`
  - **ALTER TABLE on findings:** adds `scope`, `template_id`, `workflow_id`, `state_ids`, `parent_finding_ids`, `polarity`, `business_impact`, `effort`, `priority`, `source`, `analysis_scope`, `interaction_evidence` columns (nullable, backward-compatible)
    - `source TEXT DEFAULT NULL` — `'open_observation'` for Pass 2 findings, NULL for standard (§33)
    - `analysis_scope TEXT DEFAULT 'global'` — `'global'|'per_state'|'transition'` (§33)
    - `interaction_evidence JSONB DEFAULT NULL` — serialized InteractionRecord[] (§33)
  - **published_findings VIEW** created per §13.6.11
  - **RLS policies** on all new client-scoped tables
  - Drizzle schema matches SQL exactly for all tables
- **acceptance:** All tables created. ALTER TABLE columns nullable. View queryable. RLS enforced.

### T071: AuditLogger — UNCHANGED
### T072: SessionRecorder — UNCHANGED
### T073: LLMAdapter + AnthropicAdapter — UNCHANGED
### T074: StorageAdapter + PostgresStorage — UNCHANGED
### T075: ScreenshotStorage + LocalDiskStorage — UNCHANGED
### T076: StreamEmitter — UNCHANGED
### T077-T079: Reserved
### T080: Phase 4 integration test — UNCHANGED

---

## Phase 4b: Context Capture Layer v1.0 (T4B-001 to T4B-015) — NEW (2026-04-28)

**Spec:** §37 (Context Capture Layer). **Adopts:** items 1-6 from `docs/Improvement/context_capture_layer_spec.md`. **Pre-perception layer** — runs before Phase 5 browse and Phase 7 analyze. **Cost impact:** ~$0.01 per audit (one HTTP fetch + ~5K token ContextProfile).

### T4B-001: ContextProfile Zod schema + provenance fields
- **dep:** T002, T080 (Drizzle schema)
- **spec:** §37 §37.2 + REQ-CONTEXT-OUT-001..003
- **files:** `packages/agent-core/src/context/ContextProfile.ts`
- **acceptance:** Validate fixture profile. All 5 dimensions validate. Every field is `{value, source, confidence}`. ContextProfile immutable after `Object.freeze`. SHA-256 hash function deterministic.

### T4B-002: URLPatternMatcher
- **dep:** T4B-001
- **spec:** §37 §37.1.2 + REQ-CONTEXT-DIM-PAGE-001
- **files:** `packages/agent-core/src/context/URLPatternMatcher.ts`
- **acceptance:** Match 30 fixture URLs covering homepage / PDP / PLP / cart / checkout / landing / blog / pricing / comparison. ≥95% accuracy on URL-pattern matchable fixtures. Returns `{value, source: "url_pattern", confidence: 0.9}` on match.

### T4B-003: HtmlFetcher (cheerio + undici, no Playwright)
- **dep:** T002
- **spec:** §37 §37.3 REQ-CONTEXT-FLOW-001
- **files:** `packages/agent-core/src/context/HtmlFetcher.ts`
- **acceptance:** Fetch 5 sites with realistic UA. Single GET request. 5s timeout. Respects robots.txt (per REQ-SAFETY-005). Cache by URL+ETag. Emits `CONTEXT_FETCH_FAILED` warning on error and gracefully degrades to URL-only inference. **No Playwright dependency.**

### T4B-004: JsonLdParser
- **dep:** T4B-003
- **spec:** §37 §37.4
- **files:** `packages/agent-core/src/context/JsonLdParser.ts`
- **acceptance:** Parse Product / Service / SoftwareApplication / Organization fixtures. Extract `@type`, `name`, `offers`, `description`. Returns null when no JSON-LD present.

### T4B-005: BusinessArchetypeInferrer
- **dep:** T4B-001, T4B-004
- **spec:** §37 §37.1.1 + REQ-CONTEXT-DIM-BUSINESS-001
- **files:** `packages/agent-core/src/context/BusinessArchetypeInferrer.ts`
- **acceptance:** Infer on D2C / B2B / SaaS / marketplace / lead_gen / service fixtures. "Add to cart" → D2C confident (≥0.9). "Request demo" → B2B confident. "/mo" + signup → SaaS confident. Mixed signals → low confidence + open_question. Provenance on each output.

### T4B-006: PageTypeInferrer (consolidates §07 §7.4 logic)
- **dep:** T4B-001, T4B-002, T4B-004
- **spec:** §37 §37.1.2 + REQ-CONTEXT-DIM-PAGE-001
- **files:** `packages/agent-core/src/context/PageTypeInferrer.ts`
- **acceptance:** Infer on 30 fixture URLs + HTML. ≥0.7 confidence on 90% of fixtures. Emits `inferredPageType` shape compatible with §07 §7.4 (backward-compat — existing consumers reading `AnalyzePerception.inferredPageType` still work).

### T4B-007: ConfidenceScorer + ProvenanceAssembler
- **dep:** T4B-001, T4B-005, T4B-006
- **spec:** §37 §37.2 REQ-CONTEXT-OUT-001
- **files:** `packages/agent-core/src/context/ConfidenceScorer.ts`
- **acceptance:** Score 5-dimension fixture. All fields tagged with `source` ∈ {user, url_pattern, schema_org, copy_inference, layout_inference, default}. Weighted `overall_confidence` ∈ [0, 1]. Confidence thresholds applied: ≥0.9 act / 0.6-0.9 use+flag / <0.6 ask.

### T4B-008: OpenQuestionsBuilder
- **dep:** T4B-007
- **spec:** §37 §37.2 REQ-CONTEXT-OUT-002
- **files:** `packages/agent-core/src/context/OpenQuestionsBuilder.ts`
- **acceptance:** Build questions for low-confidence fixture. `open_questions[]` populated with `field_path`, human-readable `question`, `blocking: true|false`. Blocking when REQUIRED field has confidence <0.6 or value missing.

### T4B-009: AuditRequest intake schema (extend §18)
- **dep:** T4B-001
- **spec:** §18 + REQ-GATEWAY-INTAKE-001..002
- **files:** `packages/agent-core/src/gateway/AuditRequest.ts` (extend)
- **acceptance:** Validate intake block. `goal.primary_kpi` REQUIRED — reject without it. `constraints.regulatory` non-empty for regulated verticals (pharma / fintech / gambling / healthcare / legal / insurance). All other intake fields optional.

### T4B-010: CLI clarification prompt
- **dep:** T4B-008
- **spec:** §37 §37.3 step 6
- **files:** `apps/cli/src/contextClarification.ts`
- **acceptance:** Prompt user via stdin for blocking questions. Validates user answers against ContextProfile schema. Merges answers into ContextProfile. Resumes audit cleanly. Prints non-blocking warnings to stderr. Idempotent — re-running same audit with same answers produces same ContextProfile hash.

### T4B-011: ContextCaptureNode (audit_setup integration)
- **dep:** T4B-002 through T4B-010, T135 (AuditState — schedule before Phase 8 task)
- **spec:** §04 audit_setup extension + §37
- **files:** `packages/agent-core/src/orchestration/nodes/ContextCaptureNode.ts`
- **acceptance:** Run before audit_setup on test audit. Halts on blocking. Populates `state.context_profile_id` and `state.context_profile_hash`. Pinned to `context_profiles` table. Cleanly resumes after user answers.

### T4B-012: context_profiles table migration
- **dep:** T070 (PostgreSQL schema)
- **spec:** §13 + §37
- **files:** `packages/agent-core/src/db/migrations/0XX_context_profiles.sql` + Drizzle schema
- **acceptance:** Migration runs cleanly. Append-only enforcement (no UPDATE, no DELETE). SHA-256 hash stored. Foreign key to `audit_runs`. Indexes on `audit_run_id`, `client_id`, `profile_hash`.

### T4B-013: HeuristicLoader extension (consume ContextProfile)
- **dep:** T4B-001, T106 (HeuristicLoader baseline)
- **spec:** §09 + §37 §37.5 REQ-CONTEXT-DOWNSTREAM-001
- **files:** `packages/agent-core/src/analysis/heuristics/HeuristicLoader.ts` (extend)
- **acceptance:** Load with ContextProfile. Filter by `business.archetype` + `page.type` + `traffic.device_priority` from profile. Returns 12-25 heuristics for typical context. **Phase 4b uses filtering only** — no weight modifiers (deferred to Phase 13b master track).

### T4B-014: Constitution R25 compliance check
- **dep:** T4B-001 through T4B-013
- **spec:** Constitution R25 (Context Capture MUST NOT)
- **files:** `packages/agent-core/tests/constitution/R25.test.ts`
- **acceptance:** Verify no Playwright import in `packages/agent-core/src/context/*`. No CRO judgment fields (no severity / impact / score) in ContextProfile schema. Provenance present on every output. No silent default — every default value tagged with `source: "default"`.

### T4B-015: Phase 4b integration test
- **dep:** T4B-001 through T4B-014
- **spec:** Phase 4b exit gate
- **files:** `packages/agent-core/tests/integration/context-capture.test.ts`
- **acceptance:** Run on 5 fixture sites with intake variations: (1) full intake, (2) URL only, (3) regulated vertical without constraints (should reject), (4) low-confidence inference (should produce blocking question), (5) inference fetch fails (should degrade to URL-only). All 5 dimensions populated with provenance. Clarification loop fires on weak signals. Profile hashed and pinned. Audit halts then resumes correctly. R25 compliance verified.

---

## Phase 5: Browse Mode MVP (T081-T100) — UNCHANGED

### T081-T091: Graph nodes, edges, system prompt, BrowseGraph — all UNCHANGED
### T092-T096: Integration tests (BBC, Amazon, workflow, recovery, budget) — all UNCHANGED
### T097-T100: Reserved

---

## Phase 5b: Multi-Viewport + Popup Behavior (T5B-001 to T5B-009) — NEW (2026-04-28)

**Specs:** §07 §7.9.2 (popup behavior fields), §18 (`AuditRequest.viewports`). **Activates:** opt-in mobile audit + popup runtime probing + dark-pattern detection. **Runs:** Week 8-10, after Phase 5, before Phase 6. **Cost impact:** ~2× browse cost when `viewports: ["desktop","mobile"]`; opt-in only.

### T5B-001: AuditRequest.viewports field
- **dep:** T080 (Phase 4 schema), T091 (BrowseGraph)
- **spec:** §18 REQ-GATEWAY-AUDITREQ-* + §07 §7.9.2
- **files:** `packages/agent-core/src/gateway/AuditRequest.ts`
- **acceptance:** Schema accepts `["desktop"]` and `["desktop","mobile"]`. Zod validates. Default `["desktop"]`. Rejects unknown viewport names.

### T5B-002: ViewportConfigService
- **dep:** T5B-001
- **spec:** §07 §7.9.2 (viewport_context)
- **files:** `packages/agent-core/src/orchestration/ViewportConfigService.ts`
- **acceptance:** Reads viewports from AuditRequest. Returns ordered list of viewport configs (`width`, `height`, `device_type`).

### T5B-003: MultiViewportOrchestrator
- **dep:** T5B-002, T091 (BrowseGraph), T117 (DeepPerceiveNode — see Phase 7)
- **spec:** §07 §7.9.2 multi-viewport
- **files:** `packages/agent-core/src/orchestration/MultiViewportOrchestrator.ts`
- **acceptance:** Run perception per viewport on 1 page. Both desktop+mobile perceptions stored separately. Correlation ID matches across viewports. Sequential execution (no parallel browser contexts in MVP).

### T5B-004: ViewportDiffEngine
- **dep:** T5B-003
- **spec:** §07 §7.9.2 multi-viewport diff
- **files:** `packages/agent-core/src/analysis/ViewportDiffEngine.ts`
- **acceptance:** Compare desktop vs mobile perception. Identifies fold composition diff, CTA visibility diff, sticky element diff. Produces `ViewportDiffFinding` finding type with severity scoring.

### T5B-005: PopupBehaviorProbe
- **dep:** T1B-004 (PopupPresenceDetector — provides popups[] array to enrich)
- **spec:** §07 §7.9.2 popup behavior fields
- **files:** `packages/agent-core/src/browser/PopupBehaviorProbe.ts`
- **acceptance:** Watch popup trigger on test fixtures (load / time-on-page / scroll / exit-intent). Captures `triggerType` + timing in milliseconds. Updates `popups[]` in-place (mutates from Phase 1b output).

### T5B-006: PopupDismissibilityTester
- **dep:** T1B-004
- **spec:** §07 §7.9.2 popup behavior fields
- **files:** `packages/agent-core/src/browser/PopupDismissibilityTester.ts`
- **acceptance:** Test escape key + click-outside on detected popups. Updates `popups[].isEscapeDismissible` and `isClickOutsideDismissible` from `null` → `true` / `false`. Restores page state after test.

### T5B-007: DarkPatternDetector
- **dep:** T5B-005, T5B-006
- **spec:** §07 §7.9.2 popup quality
- **files:** `packages/agent-core/src/analysis/DarkPatternDetector.ts`
- **acceptance:** Detect deceptive close UI / forced-action popup. Flags dark patterns with type tag: `deceptive_close` / `forced_action` / `no_close_button` / `hidden_dismiss`. Catches ≥1 known dark pattern in fixture set.

### T5B-008: Multi-viewport heuristics pack
- **dep:** T101 (HeuristicSchema)
- **spec:** §09 + §07 §7.9.2
- **files:** `heuristics-repo/multi-viewport.json`
- **acceptance:** Load + Zod validate. 5 new heuristics for mobile-only / desktop-only issues (e.g., "primary CTA hidden below fold on mobile", "sticky CTA covers >40% viewport on mobile"). Tier assigned per heuristic.

### T5B-009: Phase 5b multi-viewport integration test (legacy)
- **dep:** T5B-001 through T5B-008
- **spec:** Phase 5b exit gate (multi-viewport portion)
- **files:** `packages/agent-core/tests/integration/multi-viewport.test.ts`
- **acceptance:** 1 audit with `viewports: ["desktop","mobile"]`. Findings include mobile-only issues + desktop-only issues + dark-pattern flags. Total cost on 2-viewport audit ≤2× single-viewport baseline. Popup behavior fields (timing, dismissibility) populated for all detected popups.

### T5B-010: HoverTrigger
- **dep:** T091 (BrowseGraph), T1C-007 (ElementGraph for candidate discovery)
- **spec:** §20 trigger taxonomy + spec §3.1
- **files:** `packages/agent-core/src/browser/triggers/HoverTrigger.ts`
- **acceptance:** Detect `:hover` rules + `aria-haspopup` on test fixture. Fire mouseenter event + dwell. Reveals tooltips and dropdown previews. Settles within 1s.

### T5B-011: ScrollPositionTrigger
- **dep:** T091, T1C-007
- **spec:** §20 trigger taxonomy + spec §3.1
- **files:** `packages/agent-core/src/browser/triggers/ScrollPositionTrigger.ts`
- **acceptance:** Detect IntersectionObserver patterns + sticky elements. Scroll to Y-coordinates. Captures sticky CTA changes + lazy-loaded content reveal.

### T5B-012: TimeDelayTrigger
- **dep:** T091
- **spec:** §20 trigger taxonomy + spec §3.1
- **files:** `packages/agent-core/src/browser/triggers/TimeDelayTrigger.ts`
- **acceptance:** Run page for N seconds (default 5s, max 10s). Diff DOM. Treat new nodes as time-triggered. Captures time-delayed banners and announcements.

### T5B-013: ExitIntentTrigger
- **dep:** T091
- **spec:** §20 trigger taxonomy + spec §3.1
- **files:** `packages/agent-core/src/browser/triggers/ExitIntentTrigger.ts`
- **acceptance:** Search scripts for `mouseleave` listeners on document/body. Simulate mouse to (x, -1). Triggers exit-intent popups. Populates `popups[].triggerType: exit_intent`.

### T5B-014: FormInputTrigger
- **dep:** T091, T017 (TypingBehavior)
- **spec:** §20 trigger taxonomy + spec §3.1
- **files:** `packages/agent-core/src/browser/triggers/FormInputTrigger.ts`
- **acceptance:** Type / select on `<select>` + variant pickers + quantity + address fields. Captures variant-driven price/availability changes.

### T5B-015: TriggerCandidateDiscovery
- **dep:** T5B-010 through T5B-014, T1C-007 (ElementGraph)
- **spec:** §20 + spec §3.2 + §3.3 priority ordering
- **files:** `packages/agent-core/src/browser/triggers/TriggerCandidateDiscovery.ts`
- **acceptance:** Pull all interactive_nodes from ax_tree + add hover/scroll/time/exit candidates. Returns prioritized candidate list ordered: variant > tabs > accordions > modals > cart > sticky > hover > carousels.

### T5B-016: CookieBannerDetector
- **dep:** T091
- **spec:** spec §4.4
- **files:** `packages/agent-core/src/browser/CookieBannerDetector.ts`
- **acceptance:** Detect OneTrust + Cookiebot + TrustArc by selector signature. Generic detection: fixed-position element covering >20% of fold with "cookie" text. Returns banner descriptor with selector + library + dismissibility metadata.

### T5B-017: CookieBannerPolicy
- **dep:** T5B-016, T5B-018
- **spec:** spec §4.4 + §11.1.1 robots/ToS
- **files:** `packages/agent-core/src/browser/CookieBannerPolicy.ts`
- **acceptance:** Execute `dismiss` (auto-click accept or reject) or `preserve` (keep banner for analysis) per AuditRequest.cookie_policy. `block` mode rejected with structured error (consent breakage). Default = `dismiss`. Emit `COOKIE_BANNER_BLOCKING_FOLD` warning if banner covers >40% of fold and not dismissed.

### T5B-018: AuditRequest.cookie_policy field
- **dep:** T5B-001 (AuditRequest.viewports)
- **spec:** §18 AuditRequest + spec §4.4
- **files:** `packages/agent-core/src/gateway/AuditRequest.ts` (extend)
- **acceptance:** Schema accepts `dismiss | preserve`. Zod validates. Default `dismiss`. Rejects `block` value with descriptive error.

### T5B-019: Phase 5b full integration test (multi-viewport + trigger taxonomy + cookie policy)
- **dep:** T5B-001 through T5B-018
- **spec:** Phase 5b extended exit gate
- **files:** `packages/agent-core/tests/integration/phase5b-full.test.ts`
- **acceptance:** Run 1 audit with `viewports:["desktop","mobile"]`, all 8 trigger types active, both cookie policies tested. Findings include: mobile-only / desktop-only issues + dark patterns + hover-revealed microcopy + exit-intent popups + time-delayed banners. Cost ≤2× single-viewport baseline. All warnings types emit on appropriate fixtures.

---

## Phase 6: Heuristic Knowledge Base (T101-T112) — T101, T103-T105 MODIFIED

### T101: HeuristicSchema (Zod) [MOD]
- **dep:** T002
- **spec:** REQ-HK-001 + §9.10 extensions (REQ-HK-EXT-001..019)
- **files:** `packages/agent-core/src/analysis/heuristics/schema.ts`
- **v2.0 changes:**
  - Base schema per §9.1 ✅ (unchanged)
  - **NEW: `HeuristicSchemaExtended`** added in same file with forward-compat fields:
    - `version` (default "1.0.0")
    - `rule_vs_guidance` (default "guidance")
    - `business_impact_weight` (default 0.5)
    - `effort_category` (default "content")
    - `preferred_states` (optional, StatePattern[])
    - `status` (default "active")
  - Both schemas exported; loader uses Extended with fallback defaults per REQ-HK-EXT-050
- **acceptance:** Base schema validates existing heuristics. Extended schema adds fields with safe defaults. Phase 1 JSON files pass both schemas.

### T102: HeuristicKnowledgeBase schema — UNCHANGED

### T103: Author ~15 Baymard heuristics [MOD v2.3.3 — Phase 0b workstream, count reduced]
- **owner:** Phase 0b workstream (per PRD F-012 v1.2 amendment 2026-04-26 — engineering-owned, LLM-assisted with mandatory human verification per Constitution R15.3.2)
- **dep:** T101 (HeuristicSchemaExtended) + T0B-001..T0B-005 (Phase 0b authoring infrastructure) + T4B-013 contract surface (manifest selectors `archetype`/`page_type`/`device`)
- **spec:** PRD F-012 v1.2 + REQ-HK-001 + REQ-HK-EXT-001..019 + REQ-HK-BENCHMARK-001..003 + REQ-CONTEXT-DOWNSTREAM-001 + Constitution R15.3 (benchmark + provenance both required) + R15.3.1 (5 provenance fields) + R15.3.2 (human verification mandatory) + R15.3.3 (drafting LLM responses isolated) + R5.3 + GR-007 (no conversion-rate predictions)
- **files:** `heuristics-repo/baymard/*.json` (~15 files, one per heuristic — NOT a single bundle file)
- **v2.3.3 changes (vs v2.0):**
  - **Count reduced 50 → ~15** per PRD F-012 v1.2 amendment 2026-04-26 (MVP scope; the additional 35 deferred to v1.1+ to reach §09.3's 50-Baymard master target)
  - **Distribution:** ≈4 homepage, ≈4 PDP, ≈5 checkout, ≈2 cart, ≥1 mobile-specific
  - **Each heuristic MUST carry `provenance` block** (5 fields per R15.3.1: `source_url`, `citation_text`, `draft_model`, `verified_by`, `verified_date`)
  - **Each heuristic MUST carry `benchmark` block** (quantitative for structural Tier 1; qualitative for content Tier 2/3 per REQ-HK-BENCHMARK-002/003)
  - **Each heuristic MUST carry manifest selectors** `archetype` + `page_type` + `device` (consumed by Phase 4b T4B-013 `loadForContext(profile)` filter)
  - **PR Contract Proof block REQUIRED per heuristic** (T0B-003 template)
  - **Spot-check at +10 mark:** ≤1 of 5 random heuristics diverges from cited source (F-012 acceptance)
- **v2.0 changes (retained):**
  - Heuristics include `version: "1.0.0"`, `rule_vs_guidance`, `business_impact_weight`, `effort_category` per §9.10.7 defaults
  - **~3-5 heuristics get `preferred_states`** (e.g., BAY-CHECKOUT-001 guest checkout needs `preferred_states: [{ pattern_id: "checkout_form_visible", interaction_hint: { type: "click", target_text_contains: ["Checkout", "Proceed"] } }]`)
  - **~5 heuristics classified as `rule_vs_guidance: "rule"`** (form field count, CTA presence, guest checkout option, trust badge presence, etc.)
- **acceptance:** All ~15 pass `pnpm heuristic:lint heuristics-repo/baymard/*.json` (T0B-004). All ~15 pass Phase 6 T112 `HeuristicLoader.loadAll()` integration test under `HeuristicSchemaExtended.parse()`. Per-heuristic PR Contract Proof block cites `verified_by` + `verified_date` + source URL + brief re-derivation note.
- **smoke test:** `pnpm heuristic:lint heuristics-repo/baymard/*.json` exit code 0
- **kill criteria:** if 3+ Baymard heuristics fail human verification on first attempt → STOP, review drafting prompt for systematic drift (per Phase 0b plan.md §7)

### T104: Author ~10 Nielsen heuristics [MOD v2.3.3 — Phase 0b workstream, count reduced]
- **owner:** Phase 0b workstream
- **dep:** T103 (workflow exercised + smoothed) + T101 + T0B-001..T0B-005 + T4B-013 contract surface
- **spec:** PRD F-012 v1.2 + REQ-HK-001 + REQ-HK-EXT-001..019 + REQ-HK-BENCHMARK-001..003 + R15.3 + R15.3.1 + R15.3.2 + R15.3.3 + R5.3 + GR-007
- **files:** `heuristics-repo/nielsen/*.json` (~10 files)
- **v2.3.3 changes (vs v2.0):**
  - **Count reduced 35 → ~10** per F-012 v1.2 (the additional 25 deferred to v1.1+)
  - **Distribution:** ≈4 visibility/feedback, ≈3 error prevention/recovery, ≈3 consistency/standards
  - Same `provenance` + `benchmark` + manifest selectors + PR Contract Proof block requirements as T103
  - **Spot-check at +20 mark** (5 random across full set so far): ≤1 divergence
- **v2.0 changes (retained):** Same pattern as T103. ~2-3 get preferred_states. ~3 get rule_vs_guidance="rule".
- **acceptance:** All ~10 pass `pnpm heuristic:lint heuristics-repo/nielsen/*.json`.
- **smoke test:** `pnpm heuristic:lint heuristics-repo/nielsen/*.json` exit code 0

### T105: Author ~5 Cialdini heuristics [MOD v2.3.3 — Phase 0b workstream, count reduced]
- **owner:** Phase 0b workstream
- **dep:** T104 + T101 + T0B-001..T0B-005
- **spec:** PRD F-012 v1.2 + REQ-HK-001 + REQ-HK-EXT-001..019 + REQ-HK-BENCHMARK-003 (qualitative — persuasion principles rarely quantified) + R15.3 + R15.3.1 + R15.3.2 + R15.3.3 + R5.3 + GR-007
- **files:** `heuristics-repo/cialdini/*.json` (~5 files)
- **v2.3.3 changes (vs v2.0):**
  - **Count reduced 15 → ~5** per F-012 v1.2 (the additional 10 deferred to v1.1+)
  - **Distribution:** 1 social proof, 1 scarcity, 1 authority, 1 reciprocity, 1 liking
  - Same `provenance` + manifest selector + PR Contract Proof block requirements as T103/T104
  - **Cialdini citations** may be book chapter references (not URLs) per spec.md edge case — verifier confirms book + chapter access
  - **Spot-check at +30 mark (final round):** ≤1 of 5 random across full pack diverges
  - **`heuristics-repo/_spot-checks.md` log committed** with all 3 rounds documented
- **v2.0 changes (retained):** Same pattern as T103/T104. ~1-2 get preferred_states (e.g., social proof needs reviews tab open). ~1 get rule_vs_guidance="rule".
- **acceptance:** All ~5 pass `pnpm heuristic:lint heuristics-repo/cialdini/*.json`. Spot-check log complete.
- **smoke test:** `pnpm heuristic:lint heuristics-repo/cialdini/*.json` exit code 0

### T106-T112: HeuristicLoader, filters, encryption, tier validator, Phase 6 test [T107 MOD]

**T107 modification (§9.6 two-stage filtering):**
- **spec:** §9.6 REQ-HK-020a, REQ-HK-020b
- **v2.1 changes:**
  - Implement TWO filter functions (not one):
    - `filterByBusinessType(allHeuristics, businessType)` — Stage 1, called in `audit_setup`
    - `filterByPageType(businessFilteredHeuristics, pageType)` — Stage 2, called in `page_router`
  - Old single `filterHeuristics(all, pageType, businessType)` replaced with two-stage
  - `prioritizeHeuristics(filtered, 30)` unchanged — cap at 30 applied after Stage 2
- **acceptance:** Stage 1 reduces 100 → ~60-70. Stage 2 reduces ~60-70 → ~15-20. Two-stage produces identical results to single-stage.

---

## Phase 7: Analysis Pipeline (T113-T134) — T114, T117 MODIFIED v2.3

### T113, T115, T116, T118-T134: unchanged. AnalysisState, assignConfidenceTier, CostTracker, EvaluateNode, SelfCritiqueNode, 8 Grounding Rules, EvidenceGrounder, AnnotateNode, StoreNode, AnalysisGraph, Phase 7 integration test.

### T114: detectPageType [MOD v2.3]
- **spec:** REQ-ANALYZE-V23-001
- **v2.3 changes:** Return type changes from `PageType` (enum) to `{primary: PageType, alternatives: Array<{type: PageType, confidence: number}>, signalsUsed: {...}}`. Scoring weights: URL keywords × 0.4 + CTA texts × 0.3 + form signals × 0.2 + schema.org × 0.1. Result stored in `AnalyzePerception.inferredPageType`.
- **Backward compatibility:** expose `.primary` accessor for call sites that only need the enum.
- **acceptance:** Ranked list with confidence scores; primary matches the pre-v2.3 enum result on all test fixtures.

### T117: DeepPerceiveNode [MOD v2.3]
- **spec:** REQ-ANALYZE-NODE-001 + REQ-ANALYZE-PERCEPTION-V23-001
- **v2.3 changes:** Calls extended `page_analyze` with the 4 new sections (`metadata_full`, `iframes`, `accessibility`, `page_type`) alongside the baseline 9. Consumes enriched AnalyzePerception (all 14 v2.3 fields populated). `current_page_type` derived from `AnalyzePerception.inferredPageType.primary`.
- **acceptance:** AnalyzePerception returned from DeepPerceiveNode has all baseline + v2.3 fields populated on 3 test pages (checkout, PDP, homepage).

---

## Phase 8: Audit Orchestrator (T135-T155) — T135, T137, T145, T148-T150 MODIFIED

### T135: AuditState (full schema) [MOD]
- **dep:** T081, T113
- **spec:** §05-unified-state.md + §5.7 extensions
- **files:** `packages/agent-core/src/orchestration/AuditState.ts`
- **v2.0 changes:**
  - Base browse + analyze fields ✅ (unchanged)
  - **NEW §5.7 fields added** with defaults:
    - `trigger_source` (default "consultant_dashboard")
    - `audit_request_id` (default "")
    - `state_graph` (default null)
    - `multi_state_perception` (default null)
    - `current_state_id` (default null)
    - `exploration_cost_usd` (default 0)
    - `exploration_budget_usd` (default 0.50)
    - `exploration_pass_2_triggered` (default false)
    - `finding_rollups` (default [])
    - `reproducibility_snapshot` (default null)
    - `published_finding_ids` (default [])
    - `warmup_mode_active` (default true)
  - All new fields have defaults → Phase 1-5 code unaffected (REQ-STATE-EXT-COMPAT-001)
- **acceptance:** All §5.3 + §5.7 fields compile. Invariants validated (§5.4 + §5.7.3). Serializes to JSON for checkpointing.

### T136: AuditPage type — UNCHANGED
### T137: AuditSetupNode [MOD]
- **dep:** T135, T106, T074
- **spec:** REQ-ORCH-NODE-001 + §25 REQ-REPRO-031a + §18 REQ-TRIGGER-PERSIST-003
- **v2.0 changes:**
  - Original: loads client, builds page queue, creates audit_run ✅
  - **NEW: reads `reproducibility_snapshot`** from DB (created by gateway/CLI) into AuditState. If snapshot missing → fail audit with `snapshot_missing`.
  - **NEW: reads `AuditRequest`** from `audit_requests` table to populate trigger_source, audit_request_id.
  - **NEW: sets `warmup_mode_active`** from client profile.
  - **NEW (v2.1): Stage 1 heuristic filtering** — calls `filterByBusinessType(allHeuristics, business_type)` and stores the reduced set (~60-70) in `state.heuristic_knowledge_base` (per §9.6 REQ-HK-020a). Page-type filtering happens later in page_router (Stage 2).
- **acceptance:** Reproducibility snapshot loaded. AuditRequest consumed. Warm-up mode set. `heuristic_knowledge_base` contains only business-type-relevant heuristics (Stage 1 filtered).

### T138-T144: PageRouter, AuditComplete, routing edges, AuditGraph, Checkpointer [T138 MOD]

**T138 modification (§9.6 two-stage filtering):**
- **v2.1 changes:**
  - page_router calls `filterByPageType(state.heuristic_knowledge_base, currentPageType)` (Stage 2, per §9.6 REQ-HK-020b)
  - Input is the BUSINESS-FILTERED set from audit_setup (not all 100)
  - Stores result in `state.filtered_heuristics` (capped at 30)
- **acceptance:** `filtered_heuristics` contains 15-20 page-relevant heuristics from the business-filtered set.

### T145: CLI command — audit [MOD]
- **dep:** T143, T003
- **spec:** §18 AuditRequest contract
- **files:** `apps/cli/src/commands/audit.ts`
- **v2.0 changes:**
  - Original: parses flags, compiles AuditGraph, runs directly ✅
  - **NEW: constructs `AuditRequest`** from CLI flags (url, pages, budget, output)
  - **NEW: writes `audit_requests` row** + `reproducibility_snapshots` row before graph execution
  - **NEW: passes `AuditRequest` to graph** instead of raw params
  - Gateway is a thin pass-through for MVP CLI — no HTTP, no Temporal, direct function call
- **acceptance:** AuditRequest created. Snapshot written. Graph receives typed request.

### T146: ConsoleReporter — UNCHANGED
### T147: JsonReporter — UNCHANGED

### T148: ★★ ACCEPTANCE TEST — Full audit on example.com [MOD]
- **dep:** T145, T146, T147
- **smoke test:** `pnpm cro:audit --url https://example.com --pages 3 --output ./test-output`
- **v2.0 acceptance additions:**
  - ✅ All v1.0 criteria (3 pages, 3+ findings, rejection, screenshots, cost, time)
  - ✅ **[NEW] `reproducibility_snapshots` row exists** with temperature=0, model version pinned
  - ✅ **[NEW] findings have `business_impact`, `effort`, `priority` columns** populated (not null)
  - ✅ **[NEW] `published_findings` view** returns 0 rows (warm-up mode active, nothing auto-published)
  - ✅ **[NEW] `audit_requests` row** exists with trigger_source="cli"

### T149: ★★ ACCEPTANCE TEST — Amazon [MOD]
- **v2.0 acceptance additions:** Same as T148 plus: handles anti-bot, findings scored.

### T150: ★★ ACCEPTANCE TEST — BBC [MOD]
- **v2.0 acceptance additions:** Same as T148.

### T151-T155: Reserved for fixes from acceptance testing

---

## Phase 9: Master Foundations [NEW] (T156-T175)

> **Purpose:** Add the 5 must-have-from-day-1 master architecture foundations that cannot be deferred. These run AFTER Phase 8 acceptance tests pass, BEFORE state exploration.

### T156: AuditRequest contract (TypeScript + Zod) [NEW]
- **dep:** T002
- **spec:** §18.4 REQ-TRIGGER-CONTRACT-001
- **files:** `packages/agent-core/src/gateway/AuditRequest.ts`
- **acceptance:**
  - Full `AuditRequest` interface matching §18.4
  - Zod schema for runtime validation
  - Includes: target, scope, budget, heuristic_set, notifications, tags
  - `metadata` replaced with specific fields (tags, reason, external_correlation_id) per S5-L2-FIX

### T157: AuditRequest defaults + validation [NEW]
- **dep:** T156
- **files:** `packages/agent-core/src/gateway/validateRequest.ts`
- **acceptance:**
  - Applies defaults for missing fields (budget $15, max_pages 50, etc.)
  - Validates client_id exists
  - Validates budget within limits
  - Returns structured ValidationError on failure per §18.7 REQ-TRIGGER-VALIDATE-002

### T158: Gateway service (thin, MVP) [NEW]
- **dep:** T156, T157, T074
- **files:** `packages/agent-core/src/gateway/GatewayService.ts`
- **acceptance:**
  - Accepts AuditRequest
  - Validates via T157
  - Creates `audit_requests` row
  - Creates `audit_runs` row
  - Creates `reproducibility_snapshots` row (F3)
  - Returns audit_request_id + audit_run_id
  - For MVP: synchronous function call, no HTTP server, no Temporal

### T159: CLI integration with Gateway [NEW]
- **dep:** T158, T145
- **files:** `apps/cli/src/commands/audit.ts` (refactor)
- **acceptance:**
  - CLI constructs AuditRequest from flags
  - Calls GatewayService.submit(request)
  - GatewayService returns IDs
  - CLI then compiles + runs AuditGraph with IDs
  - Replaces T145's direct graph compilation

### T160: Reproducibility snapshot builder + loader [NEW]
- **dep:** T073, T106
- **spec:** §25.4 REQ-REPRO-031, §27 (loadReproducibilitySnapshot activity)
- **files:** `packages/agent-core/src/reproducibility/SnapshotBuilder.ts`
- **acceptance:**
  - `createSnapshot()`: Computes SHA256 hashes of prompt template files, reads model name + version from LLMAdapter config, reads heuristic base version + computes overlay_chain_hash, reads normalizer/grounding/scoring versions from config. Returns ReproducibilitySnapshot. All temperatures set to 0 per REQ-REPRO-001. Called by **gateway** before Temporal workflow start (§18 REQ-TRIGGER-PERSIST-003).
  - `loadAndValidateSnapshot(auditRunId)`: Reads existing snapshot from DB. Validates immutability (hash check). Returns snapshot for AuditState. Called by **audit_setup** node (NOT Temporal activity — §27 fix).
  - Snapshot is IMMUTABLE after creation — mutation attempt throws Error

### T161: Temperature enforcement guard [NEW]
- **dep:** T073
- **spec:** §25.3 REQ-REPRO-020
- **files:** `packages/agent-core/src/adapters/TemperatureGuard.ts`
- **acceptance:**
  - Wraps LLMAdapter.invoke()
  - If node is "evaluate" or "evaluate_interactive" or "self_critique" and temperature ≠ 0: throws Error
  - Runtime guard, not compile-time

### T162: Two-store access mode middleware [NEW]
- **dep:** T070, T074
- **spec:** §24.3 REQ-TWOSTORE-001..003
- **files:** `packages/agent-core/src/storage/AccessModeMiddleware.ts`
- **acceptance:**
  - Sets `SET LOCAL app.access_mode` on database transactions
  - Sets `SET LOCAL app.client_id` on database transactions
  - All database operations wrapped in transactions for SET LOCAL to work (M4-L2-FIX)

### T163: Warm-up mode state machine [NEW]
- **dep:** T074, T070
- **spec:** §24.4 REQ-TWOSTORE-010..013
- **files:** `packages/agent-core/src/review/WarmupManager.ts`
- **acceptance:**
  - Computes warm-up status: active/can_graduate/blocked
  - Checks: audits_completed >= 3 AND rejection_rate < 25%
  - Stores warmup_mode_active on client profile
  - determinePublishAction() returns held/published/delayed per §24.5

### T164: Extended StoreNode (two-store aware) [NEW]
- **dep:** T132, T163
- **files:** `packages/agent-core/src/analysis/nodes/StoreNode.ts` (extend)
- **acceptance:**
  - Checks warmup_mode_active before auto-publishing
  - During warm-up: ALL findings stored as "held" regardless of tier
  - Post warm-up: Tier 1 → published, Tier 2 → delayed, Tier 3 → held
  - Updates published_finding_ids in state

### T165: Scoring pipeline (4-dimensional) [NEW]
- **dep:** T002, T115
- **spec:** §23.4 REQ-FINDINGS-SCORE-001..051
- **files:** `packages/agent-core/src/analysis/scoring/ScoringPipeline.ts`
- **acceptance:**
  - `determineSeverity(finding, heuristic)` — from heuristic or critique downgrade
  - `computeConfidence(finding, heuristic, rulesPasssed)` — tier × grounding × evidence
  - `computeBusinessImpact(severity, pageType, funnelPosition, weight)` — IMPACT_MATRIX lookup
  - `computeEffort(heuristic)` — EFFORT_MAP lookup
  - `computePriority(severity, confidence, impact, effort)` — formula: `Math.round((severity*2 + impact*1.5 + confidence*1 - effort*0.5) * 100) / 100` (parentheses critical — §23 fix)
  - ALL deterministic, NO LLM calls
  - Unit tests for each function

### T166: IMPACT_MATRIX + EFFORT_MAP config [NEW]
- **dep:** T002
- **spec:** §23.4
- **files:** `packages/agent-core/src/analysis/scoring/config.ts`
- **acceptance:**
  - IMPACT_MATRIX: PageType × FunnelPosition → base impact (0-10)
  - DEFAULT_FUNNEL_POSITION: PageType → default position (C5-L2-FIX)
  - EFFORT_MAP: EffortCategory → effort score (2-10)
  - Version string for reproducibility snapshot

### T167: Scoring integration with AnnotateNode [NEW]
- **dep:** T165, T131
- **files:** `packages/agent-core/src/analysis/nodes/AnnotateNode.ts` (extend)
- **acceptance:**
  - After grounding, run scoring pipeline on each grounded finding
  - Write business_impact, effort, priority to finding before DB persist
  - Finding suppression: confidence < 0.3 → reject (REQ-FINDINGS-SUPPRESS-001)

### T168: Finding suppression rules [NEW]
- **dep:** T165
- **spec:** §23.5 REQ-FINDINGS-SUPPRESS-001..002
- **files:** `packages/agent-core/src/analysis/scoring/Suppression.ts`
- **acceptance:**
  - confidence < 0.3 → reject
  - evidence_ids empty → reject
  - Exact duplicate (heuristic_id + element_ref + page) → reject
  - All suppressed findings logged to rejected_findings table

### T169: Consultant dashboard — basic review UI [NEW]
- **dep:** T070, T162, T163
- **files:** `apps/dashboard/src/app/console/review/page.tsx`
- **acceptance:**
  - Lists findings needing review (status = "held")
  - Sorted by priority (highest first)
  - Actions: Approve, Reject, Edit (creates finding_edit row)
  - Shows annotated screenshot with finding highlighted
  - Shows evidence, severity, confidence, business_impact, effort, priority
  - Reads from internal store (app.access_mode = "internal")

### T170: Consultant dashboard — audit list + trigger [NEW]
- **dep:** T158, T169
- **files:** `apps/dashboard/src/app/console/audits/page.tsx`
- **acceptance:**
  - Lists audit runs with status, dates, finding counts
  - "New Audit" button: form for URL, pages, budget
  - Submits via GatewayService (same as CLI path)

### T171: Consultant dashboard — basic layout + auth [NEW]
- **dep:** T002
- **files:**
  - `apps/dashboard/package.json` (Next.js 15 + shadcn/ui + Tailwind)
  - `apps/dashboard/src/app/layout.tsx`
  - `apps/dashboard/src/app/console/layout.tsx`
  - `apps/dashboard/src/middleware.ts` (Clerk auth)
- **acceptance:**
  - Next.js app with Clerk authentication
  - Consultant role required for `/console/*` routes
  - Basic layout with sidebar navigation

### T172: Consultant dashboard — finding detail [NEW]
- **dep:** T169
- **files:** `apps/dashboard/src/app/console/review/[id]/page.tsx`
- **acceptance:**
  - Full finding detail: observation, assessment, recommendation, evidence
  - Annotated screenshot with pin highlighted
  - Heuristic source attribution (not heuristic content — IP protection)
  - Edit form: change description, recommendation, severity
  - Approve/Reject buttons
  - Original finding preserved (finding_edits table)

### T173: Warm-up status display [NEW]
- **dep:** T163, T171
- **files:** `apps/dashboard/src/app/console/clients/[id]/page.tsx`
- **acceptance:**
  - Shows: audits completed / required, rejection rate, can_graduate status
  - Manual override toggle (enable/disable warm-up)

### T174: Phase 9 integration test [NEW]
- **dep:** T158-T173
- **files:** `packages/agent-core/tests/integration/phase9-foundations.test.ts`
- **acceptance:**
  - AuditRequest validates + persists
  - Reproducibility snapshot created with temperature 0
  - Scoring pipeline produces 4D scores
  - Two-store: internal store has all findings, published view has only approved
  - Warm-up mode: new client → all findings held
  - CLI trigger works end-to-end through gateway

### T175: ★★ ACCEPTANCE TEST — Foundations on real audit [NEW]
- **dep:** T174
- **smoke test:** `pnpm cro:audit --url https://bbc.com --pages 2 --output ./test-foundations`
- **acceptance:**
  - Audit completes with all v1.0 criteria
  - reproducibility_snapshots row: temperature 0, all versions pinned
  - Findings: business_impact ≠ null, effort ≠ null, priority ≠ null for all grounded findings
  - published_findings view: 0 rows (warm-up active)
  - audit_requests row: trigger_source = "cli"
  - Consultant dashboard: findings appear in review inbox sorted by priority

---

## Phase 10: State Exploration [NEW] (T176-T192)

> **Purpose:** Full §20 two-pass state exploration. The browse subgraph gains an `explore_states` node between stabilisation and deep_perceive.

### T176: StateNode + StateGraph types (Zod) [NEW]
- **dep:** T002
- **spec:** §5.7.1 (StateNode, StateGraph, MultiStatePerception, ExplorationTrigger)
- **files:** `packages/agent-core/src/exploration/types.ts`
- **acceptance:**
  - StateNode, StateGraph, MultiStatePerception, InteractionPath, ExplorationTrigger types
  - Zod schemas for all
  - `computeStateId()` function: sha256(canonicalJSON({url, interactions})) per S8-L2-FIX

### T177: Disclosure rule library [NEW]
- **dep:** T002
- **spec:** §20.3 REQ-STATE-EXPLORE-030
- **files:** `packages/agent-core/src/exploration/DisclosureRules.ts`
- **acceptance:**
  - 12 rules (R1-R12) from §20.3
  - Each rule: `detect(pageSnapshot) → DisclosureTarget[]` + `interact(target) → Interaction`
  - Rules categorised: self-restoring vs destructive (C4-L2-FIX)
  - R11 (cookie) + R12 (chat) = cleanup rules, run first

### T178: Meaningful-state detector [NEW]
- **dep:** T176
- **spec:** §20.5 REQ-STATE-EXPLORE-060..062
- **files:** `packages/agent-core/src/exploration/MeaningfulStateDetector.ts`
- **acceptance:**
  - `isMeaningful(newPerception, parentPerception) → boolean`
  - Text Jaccard > 0.15 (word-level tokenisation, M1-L2-FIX)
  - New interactive elements > 3
  - Above-fold diff > 10%
  - CTA set changed
  - Default state always meaningful

### T179: State restoration manager [NEW]
- **dep:** T006
- **spec:** §20.9 REQ-STATE-EXPLORE-100..102
- **files:** `packages/agent-core/src/exploration/StateRestorer.ts`
- **acceptance:**
  - Self-restoring interactions: no restoration needed (C4-L2-FIX)
  - Destructive interactions: click-to-close / go_back / reload fallback
  - 5s timeout on restoration
  - Destructive interactions scheduled last (REQ-STATE-EXPLORE-102)

### T180: Pass 1 — heuristic-primed explorer [NEW]
- **dep:** T177, T178, T179, T048
- **spec:** §20.3 REQ-STATE-EXPLORE-010..014
- **files:** `packages/agent-core/src/exploration/Pass1Explorer.ts`
- **acceptance:**
  - Collects `preferred_states` from filtered heuristics
  - Deduplicates by pattern_id
  - For each pattern: find element → interact → wait stability → capture perception → meaningful check
  - Self-restoring interactions: no restoration between (C4-L2-FIX)
  - Required states that can't be found → log `heuristic_state_unavailable`
  - Returns StateNode[] (meaningful only)

### T181: Auto-escalation check [NEW]
- **dep:** T176
- **spec:** §20.3 REQ-STATE-EXPLORE-020..021
- **files:** `packages/agent-core/src/exploration/EscalationCheck.ts`
- **acceptance:**
  - `shouldEscalateToPass2(stateGraph, pageSnapshot, config) → { escalate, reasons }`
  - Triggers: thorough_mode, unexplored_ratio > 0.5
  - Respects `pass_2_allowed` config
  - `heuristic_primed_only` policy blocks escalation

### T182: Pass 2 — bounded-exhaustive explorer [NEW]
- **dep:** T177, T178, T179, T181
- **spec:** §20.3 REQ-STATE-EXPLORE-030..042
- **files:** `packages/agent-core/src/exploration/Pass2Explorer.ts`
- **acceptance:**
  - Applies disclosure rule library (R1-R12) in order: R11→R12→R1..R10
  - Skips elements already explored in Pass 1
  - Max states: 15 per page
  - Max depth: 2
  - Max interactions: 25
  - LLM fallback: 1 call max if <3 meaningful states on interactive page (REQ-STATE-EXPLORE-040)
  - Budget enforcement per page ($0.50 default)
  - Returns StateNode[] (meaningful only)

### T183: State graph builder [NEW]
- **dep:** T176, T180, T182
- **spec:** §20.4 REQ-STATE-EXPLORE-050
- **files:** `packages/agent-core/src/exploration/StateGraphBuilder.ts`
- **acceptance:**
  - Builds StateGraph from default state + Pass 1 + Pass 2 results
  - Default state always first
  - Edges track parent→child with interaction
  - Sets truncated flag + reason if any cap hit

### T184: MultiStatePerception synthesiser [NEW]
- **dep:** T176, T183
- **spec:** §20.6 REQ-STATE-EXPLORE-070..072
- **files:** `packages/agent-core/src/exploration/MultiStateSynthesiser.ts`
- **acceptance:**
  - Merges default + hidden states into merged_view
  - CTA dedup: text cosine > 0.9 AND bounding box IoU > 0.5 (S4-L2-FIX)
  - Builds state_provenance Record (key = data_point format, value = state_id) per S3-L2-FIX
  - If no hidden states: merged_view = default_state (backward compat)

### T185: GR-009 — state provenance grounding rule [NEW]
- **dep:** T184
- **spec:** §20.10 REQ-STATE-EXPLORE-110..111
- **files:** `packages/agent-core/src/analysis/grounding/rules/GR-009.ts`
- **acceptance:**
  - If finding cites element NOT in default state AND no provenance → reject
  - If finding cites element with provenance pointing to non-existent state → reject
  - If all elements in default state → pass (trivial)
  - Unit tests for accept + reject cases

### T186: `explore_states` graph node [NEW]
- **dep:** T180, T181, T182, T183, T184
- **spec:** §20.2 REQ-STATE-EXPLORE-001..002
- **files:** `packages/agent-core/src/orchestration/nodes/ExploreStatesNode.ts`
- **acceptance:**
  - Sits between page stabilisation and deep_perceive in browse subgraph
  - Runs Pass 1
  - Checks escalation
  - If escalation → runs Pass 2
  - Builds StateGraph → writes to AuditState
  - Builds MultiStatePerception → writes to AuditState
  - Persists states to page_states + state_interactions tables

### T187: Extended deep_perceive (multi-state aware) [NEW]
- **dep:** T117, T184
- **files:** `packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts` (extend)
- **acceptance:**
  - If multi_state_perception available: use merged_view for heuristic evaluation
  - If not available (Phase 1-5 compat): use single-state perception as before
  - Captures viewport + fullpage screenshots PER meaningful state (stored in R2)

### T188: Extended EvidenceGrounder (GR-009 aware) [NEW]
- **dep:** T130, T185
- **files:** `packages/agent-core/src/analysis/grounding/EvidenceGrounder.ts` (extend)
- **acceptance:**
  - Adds GR-009 to grounding rule chain
  - GR-009 only runs if multi_state_perception has hidden_states
  - If no hidden states (Phase 1-5 compat): GR-009 trivially passes

### T189: Self-critique escalation signal [NEW]
- **dep:** T121, T186
- **spec:** §20.7 REQ-STATE-EXPLORE-080..082
- **files:** `packages/agent-core/src/analysis/nodes/SelfCritiqueNode.ts` (extend)
- **acceptance:**
  - If self-critique flags `insufficient_evidence: hidden_content_suspected` AND Pass 2 not yet run:
    - Sets `escalation_needed: state_exploration` in AuditState
  - Orchestrator reads this flag and routes back to explore_states (max 1 cycle)

### T190: BrowseGraph extended (with explore_states) [NEW]
- **dep:** T186, T091
- **files:** `packages/agent-core/src/orchestration/BrowseGraph.ts` (extend)
- **acceptance:**
  - Adds `explore_states` node between stabilisation and deep_perceive
  - Conditional: if Phase 7+ features enabled, run explore_states. Otherwise skip (Phase 1-5 compat).
  - Escalation loop: if analysis sets escalation flag → route back to explore_states once

### T191: Phase 10 integration test [NEW]
- **dep:** T186-T190
- **files:** `packages/agent-core/tests/integration/phase10-exploration.test.ts`
- **acceptance:**
  - Run on a product page with tabs/accordions (e.g., amazon.in PDP with reviews tab)
  - Pass 1: at least 1 hidden state captured from preferred_states
  - Meaningful-state detection: at least 1 state discarded as not-meaningful
  - StateGraph persisted to page_states table
  - MultiStatePerception merged_view has more CTAs/trust signals than default state
  - GR-009: finding citing reviews-tab content has state provenance

### T191a: Per-state screenshot capture in deep_perceive [NEW]
- **dep:** T191, T127 (EvaluateNode)
- **spec:** REQ-ANALYZE-NODE-001a, REQ-ANALYZE-NODE-001b, REQ-ANALYZE-NODE-001c, REQ-ANALYZE-NODE-001d
- **files:** Edit `packages/agent-core/src/analysis/nodes/DeepPerceiveNode.ts`
- **smoke test:** After state exploration on PDP with 3 states, `deep_perceive` populates `viewport_screenshot_ref` and `fullpage_screenshot_ref` for all 3 states. Screenshots stored in R2.
- **acceptance:** Per-state screenshots captured via interaction path replay. Default state first, hidden states via replay. Failed replays → null refs (non-fatal). Max 30 screenshots per page.

### T192: ★★ ACCEPTANCE TEST — State exploration on real audit [NEW]
- **dep:** T191
- **smoke test:** `pnpm cro:audit --url https://amazon.in --pages 1 --explore --output ./test-explore`
- **acceptance:**
  - Audit completes
  - page_states table: >1 row for the page (default + at least 1 hidden state)
  - state_interactions table: at least 1 interaction recorded
  - Findings reference state_ids (non-empty for findings from hidden states)
  - Annotated screenshots include findings from both default and hidden states
  - GR-009 active: at least 1 finding validated against state provenance
  - Exploration cost tracked in state
  - Total cost still < budget

---

## ★ MVP v2.0 COMPLETE ★

The MVP v2.0 is **DONE** when T148-T150 (Phase 8 acceptance), T175 (Phase 9 foundations acceptance), and T192 (Phase 10 state exploration acceptance) all pass. This validates:

1. ✅ Browse mode works on real sites (v1.0)
2. ✅ Analysis pipeline produces grounded findings (v1.0)
3. ✅ Audit orchestrator wires browse + analyze correctly (v1.0)
4. ✅ Heuristics filter and inject correctly (v1.0)
5. ✅ Self-critique catches false positives (v1.0)
6. ✅ Evidence grounding catches hallucinations (v1.0)
7. ✅ Annotated screenshots render correctly (v1.0)
8. ✅ Database persistence works (v1.0)
9. ✅ Cost stays under budget (v1.0)
10. ✅ CLI + consultant dashboard work (v1.0 + v2.0)
11. ✅ **[NEW] 4-dimensional deterministic scoring** (severity + confidence + impact + effort + priority)
12. ✅ **[NEW] Two-store pattern** — published findings isolated from internal store
13. ✅ **[NEW] Warm-up mode** — no auto-publish for new clients
14. ✅ **[NEW] Reproducibility snapshots** — temperature 0, version pinning, audit defensibility
15. ✅ **[NEW] AuditRequest contract** — single entry point for all trigger channels
16. ✅ **[NEW] State exploration** — hidden content behind tabs/accordions/modals captured and analyzed
17. ✅ **[NEW] GR-009** — state provenance integrity grounding rule
18. ✅ **[NEW] MultiStatePerception** — merged cross-state evidence for heuristic evaluation

---

## Phase 11: Agent Composition (T193-T210) — ALL NEW (§33 + §33a)

> **Dependency:** Phase 7 (analysis pipeline), Phase 8 (orchestrator), Phase 10 (state exploration)
> **Spec:** §33 (Agent Composition Model), §33a (Composition Integration Plan)
> **Note:** §33 interfaces are ALREADY built into Phases 2, 4, 5, 7, 8 per §33a. Phase 11 activates the interactive path.

### T193: InteractiveEvaluateStrategy (ReAct loop)
- **dep:** T127 (EvaluateNode), T081 (BrowseGraph)
- **spec:** REQ-COMP-039, §33.7b
- **files:** `packages/agent-core/src/analysis/strategies/InteractiveEvaluateStrategy.ts`
- **smoke test:** Interactive evaluate on a PDP with size selector — LLM selects variant, captures state change, produces finding
- **acceptance:** ReAct loop with tool calls. Exits on: all heuristics evaluated, budget exhausted, or max turns. Returns `EvaluateResult` with `raw_findings` + `interactions`.

### T194: Analysis output tools (produce_finding, mark_pass, mark_needs_review)
- **dep:** T024 (MCPServer)
- **spec:** §33.4 (analysis-specific tools 13-15)
- **files:** `packages/agent-core/src/mcp/tools/produceFinding.ts`, `markHeuristicPass.ts`, `markHeuristicNeedsReview.ts`
- **smoke test:** Each tool callable via MCP, returns structured response, validates against Zod schema
- **acceptance:** 3 tools registered in `analyze_interactive` tool set. Zod-validated input/output.

### T195: Tool injection matrix + BrowserToolInjector
- **dep:** T024 (MCPServer), T193
- **spec:** REQ-COMP-001, REQ-COMP-010
- **files:** `packages/agent-core/src/mcp/BrowserToolInjector.ts`
- **smoke test:** `getToolsForContext({mode: "analyze", compositionMode: "interactive"})` returns exactly 15 tools (9 browser + 6 analysis)
- **acceptance:** Injector returns correct tool set per context. Browse tools bound to active session. Navigation tools excluded.

### T196: Navigation guard (2-layer)
- **dep:** T006 (BrowserManager), T193
- **spec:** REQ-COMP-012, REQ-COMP-012a
- **files:** `packages/agent-core/src/safety/NavigationGuard.ts`
- **smoke test:** Layer 1: `inspectClickTarget` on `<a href="/other-page">` returns `safe: false`. Layer 2: `verifyNoNavigation` detects URL path change after JS-triggered navigation, recovers via goBack.
- **acceptance:** Both layers work. Hash/query changes allowed. Path changes blocked. Recovery works.

### T197: Enter key reclassification
- **dep:** T071 (ActionClassifier)
- **spec:** REQ-COMP-011a
- **files:** Edit `packages/agent-core/src/safety/ActionClassifier.ts`
- **smoke test:** `classifyAction({toolName: "browser_press_key", toolArgs: {key: "Enter"}, callingNode: "analyze"})` with focused form input returns `"sensitive"`
- **acceptance:** Enter key in form = sensitive (blocked during analysis). Enter key outside form = caution (allowed).

### T198: HeuristicInteractionTracker
- **dep:** T193
- **spec:** REQ-COMP-062, REQ-COMP-062a, REQ-COMP-062b
- **files:** `packages/agent-core/src/analysis/HeuristicInteractionTracker.ts`
- **smoke test:** Tracker allows 2 interactions per heuristic (standard), blocks 3rd. Advances heuristic pointer on `produce_finding` call.
- **acceptance:** Per-heuristic cap enforced. Fallback attribution works for skipped signals.

### T199: Pass 2 open observation pipeline
- **dep:** T193, T128 (SelfCritiqueNode)
- **spec:** REQ-COMP-040, REQ-COMP-041, REQ-COMP-042, REQ-COMP-042a, REQ-COMP-043
- **files:** `packages/agent-core/src/analysis/nodes/OpenObservationNode.ts`, `packages/agent-core/src/analysis/prompts/openObservation.ts`
- **smoke test:** Pass 2 produces 1-5 observations with synthetic `OPEN-OBS-*` IDs. All Tier 3. All `needs_consultant_review = true`.
- **acceptance:** Observations pass GR-001/GR-007 grounding. GR-005 skipped (REQ-COMP-042a). Dedup with Pass 1 findings.

### T200: GR-011 grounding rule (per-state data correctness)
- **dep:** T129-T131 (Grounding Rules), T185 (GR-009)
- **spec:** REQ-COMP-070, REQ-COMP-071
- **files:** `packages/agent-core/src/analysis/grounding/rules/GR011.ts`
- **smoke test:** Per-state finding with wrong `evaluated_state_id` rejected. Global finding passes trivially.
- **acceptance:** GR-011 validates state_id + element existence. Gated behind state_graph presence.

### T201: GR-010 grounding rule (workflow cross-step)
- **dep:** T129-T131 (Grounding Rules)
- **spec:** §21.6 REQ-WORKFLOW-GROUND-002
- **files:** `packages/agent-core/src/analysis/grounding/rules/GR010.ts`
- **smoke test:** Workflow finding referencing only 1 step rejected. Finding referencing 2+ steps passes.
- **acceptance:** GR-010 enforces cross-step minimum.

### T202: Workflow step restore + funnel state verification
- **dep:** T143 (AuditGraph), T193
- **spec:** REQ-COMP-022a, REQ-COMP-022b
- **files:** `packages/agent-core/src/orchestration/WorkflowStepRestore.ts`
- **smoke test:** After interactive analysis on cart page, reload preserves cart items. `verifyFunnelState` detects empty cart.
- **acceptance:** Reload + funnel state check. Workflow abandoned on state loss.

### T203: Session contamination tracking
- **dep:** T143 (AuditGraph), T193
- **spec:** REQ-COMP-063, REQ-COMP-064
- **files:** `packages/agent-core/src/orchestration/SessionContaminationDetector.ts`
- **smoke test:** In workflow mode, analysis attempts `browser_click` on "Add to Cart" — blocked by transition detection.
- **acceptance:** Transition actions blocked during analysis. Contamination events logged.

### T204: Context window management + message pruning
- **dep:** T193
- **spec:** REQ-COMP-066
- **files:** `packages/agent-core/src/analysis/ContextWindowManager.ts`
- **smoke test:** After 10 tool-use turns, oldest interaction results summarised to 1 line each. Token count stays below 80% of model limit.
- **acceptance:** State-delta compression works. Token budget enforced. Pruning doesn't lose critical evidence.

### T205: Composition state extensions
- **dep:** T135 (AuditState)
- **spec:** REQ-COMP-080, §33.13
- **files:** Edit `packages/agent-core/src/orchestration/AuditState.ts`
- **smoke test:** All §33 fields compile with defaults. `composition_mode = "interactive"` activatable. Invariants validated.
- **acceptance:** All REQ-COMP-INV-001 through 005 enforced.

### T206: restore_state node activation
- **dep:** T143 (AuditGraph), T205
- **spec:** REQ-COMP-090, §33.15
- **files:** Edit `packages/agent-core/src/orchestration/nodes/RestoreStateNode.ts`
- **smoke test:** After interactive analysis (interaction_count > 0), page reloads and URL matches. Static mode: no-op.
- **acceptance:** Reload + stability wait + URL verification. 10s timeout with fallback.

### T207: Interaction screenshot storage
- **dep:** T193, T077 (ScreenshotStorage)
- **spec:** REQ-COMP-080a
- **files:** Edit `packages/agent-core/src/analysis/nodes/AnnotateNode.ts`
- **smoke test:** InteractionRecord with screenshot_ref stored in R2. Finding detail shows interaction evidence.
- **acceptance:** Interaction screenshots persisted. R2 key format follows convention.

### T208: Phase 11 integration test
- **dep:** T193-T207
- **spec:** §33 end-to-end
- **files:** `packages/agent-core/tests/integration/phase11-composition.test.ts`
- **smoke test:** Full audit with `composition_mode = "interactive"` on amazon.in PDP. Produces findings from both static and interactive evaluation. Pass 2 produces at least 1 open observation.
- **acceptance:** Interactive composition works end-to-end. Static mode unchanged. Workflow mode works with step restore.

### T209: Dual-mode evaluation acceptance test
- **dep:** T208
- **files:** `packages/agent-core/tests/acceptance/dual-mode.test.ts`
- **smoke test:** Compare findings from static vs interactive mode on same page. Interactive finds at least 2 additional state-dependent findings.
- **acceptance:** Interactive mode produces higher-quality findings. Cost within budget. Runtime within timeout.

### T210: Activate interactive mode as default
- **dep:** T209
- **spec:** REQ-COMP-050
- **files:** Edit `packages/agent-core/src/orchestration/AuditState.ts` — change `composition_mode` default from `"static"` to `"interactive"`
- **acceptance:** New audits default to interactive mode. Existing tests still pass (backward compatible).

### T211: Interactive evaluation cost model extension [NEW]
- **dep:** T118 (CostTracker), T193 (InteractiveEvaluateStrategy)
- **spec:** §26 REQ-COST-004, REQ-COST-005, REQ-COST-006
- **files:** Edit `packages/agent-core/src/analysis/CostTracker.ts`
- **smoke test:** Pre-flight estimation returns 3x multiplier for `composition_mode = "interactive"` standard, 7x for deep
- **acceptance:**
  - Pre-flight estimator checks `composition_mode`: static=1 LLM call, standard=~5, deep=~15
  - "Before evaluate" budget gate wraps ENTIRE ReAct loop (all turns), not just first call
  - Mid-loop budget exhaustion: complete current turn, emit partial findings, exit gracefully
  - Browser interaction overhead tracked: ~$0 LLM cost but ~1-3s latency per interaction logged

### T212: Composition-mode-aware activity timeout [NEW]
- **dep:** T193, Phase 9 Temporal integration
- **spec:** §27 activity timeout note
- **files:** Edit `packages/agent-core/src/orchestration/TemporalActivities.ts`
- **smoke test:** `runPageOrchestrator` activity uses 5min timeout in static mode, 7min in interactive standard, 10min in interactive deep
- **acceptance:**
  - `startToCloseTimeout` set dynamically based on `composition_mode` from AuditState
  - Heartbeat mechanism covers long-running interactive evaluate loops within timeout
  - Unit test: each mode gets correct timeout value

---

## §33a Interface Modifications to Earlier Phases

> These modifications are REQUIRED in Phases 2, 4, 5, 7, 8 to establish §33 interfaces. They add interface contracts and strategy patterns — NOT §33 functionality. See §33a for full specification.

| Task | Phase | Change | Spec |
|------|-------|--------|------|
| T024 (MCPServer) | 2 | Add `ToolRegistry` with `getToolsForContext(context)`. Register `browse` and `analyze` tool sets. Define 3 output tool schemas (stubs). | REQ-COMP-PHASE2-001, REQ-COMP-PHASE2-002 |
| T071 (ActionClassifier) | 4 | Accept `SafetyContext` parameter (with `callingNode` field). Default: `callingNode = "browse"`. | REQ-COMP-PHASE4-001 |
| T066 (BrowserManager) | 4 | Extract `BrowserSessionManager` with `create/get/close` methods. Sessions are external, not graph-internal. | REQ-COMP-PHASE4-002 |
| T081 (BrowseGraph) | 5 | Accept browser session via `state.browser_session_id` (injected by orchestrator), not created internally. Add `browser_session_id` to AuditState. | REQ-COMP-PHASE5-001, REQ-COMP-PHASE5-002 |
| T127 (EvaluateNode) | 7 | Use `EvaluateStrategy` interface with `StaticEvaluateStrategy` as default. Accept `BrowserSession | null`. Add §33 state fields with defaults. | REQ-COMP-PHASE7-001, REQ-COMP-PHASE7-002, REQ-COMP-PHASE7-003 |
| T143 (AuditGraph) | 8 | Pass `browser_session_id` from browse to analyze. Add `restore_state` node (no-op in static mode). | REQ-COMP-PHASE8-001, REQ-COMP-PHASE8-002 |

---

## Task Count Summary

| Phase | Tasks | IDs | New/Mod | Cumulative |
|-------|-------|-----|---------|-----------|
| Phase 0: Setup | 5 | T001-T005 | — | 5 |
| Phase 1: Perception | 10 | T006-T015 | — | 15 |
| Phase 2: Tools + Behavior | 35 | T016-T050 | 1 mod (§33a) | 50 |
| Phase 3: Verification | 15 | T051-T065 | — | 65 |
| Phase 4: Safety + Infra | 15 | T066-T080 | 2 mod (1 orig + 1 §33a) | 80 |
| Phase 5: Browse MVP | 20 | T081-T100 | 1 mod (§33a) | 100 |
| Phase 6: Heuristic KB | 12 | T101-T112 | 4 mod | 112 |
| Phase 7: Analysis Pipeline | 22 | T113-T134 | 1 mod (§33a) | 134 |
| Phase 8: Orchestrator | 21 | T135-T155 | 6 mod (5 orig + 1 §33a) | 155 |
| Phase 9: Master Foundations | 20 | T156-T175 | **20 new** | 175 |
| Phase 10: State Exploration | 18 | T176-T192 (+T191a) | **18 new** | 193 |
| Phase 11: Agent Composition | 20 | T193-T212 | **20 new** | **213** |
| Phase 12: Mobile Viewport (v2.2) | 5 | T227-T231 | **5 new** | 218 |
| v2.2 spec additions (distributed across Phases 4-9) | 45 | T213-T226, T232-T254 | **45 new** | **263** |
| v2.2a patches (distributed across Phases 1-9) | includes T255-T262 (8 tasks embedded above) | — | — | 263 |

**v2.0 → v2.1 delta (§33 integration):**
- Phases 1-10 tasks modified for §33a interfaces: **6** (T024, T066, T071, T081, T127, T143)
- Phase 11 tasks added: **18** (T193-T210)
- **Total: 213 tasks across 11 phases**

---

## v1.0 → v2.0 Modification Index

For quick reference, every task that differs from v1.0:

| Task | Change type | What changed |
|------|-------------|-------------|
| T024 | Extended (§33a) | +ToolRegistry with `getToolsForContext()`, +3 output tool schemas |
| T066 | Extended (§33a) | +BrowserSessionManager with create/get/close |
| T070 | Extended | +5 new tables, ALTER TABLE on findings (+12 columns incl. source, analysis_scope, interaction_evidence), published_findings view |
| T071 | Extended (§33a) | +SafetyContext parameter with `callingNode` field |
| T081 | Extended (§33a) | +External browser session injection via `state.browser_session_id` |
| T101 | Extended | +HeuristicSchemaExtended with forward-compat fields |
| T103 | Extended | +preferred_states on ~8 heuristics, +rule_vs_guidance on ~10 |
| T104 | Extended | Same pattern as T103 |
| T105 | Extended | Same pattern as T103 |
| T127 | Extended (§33a) | +EvaluateStrategy interface, +StaticEvaluateStrategy, +BrowserSession|null param |
| T135 | Extended | +§5.7 state extension fields with defaults |
| T137 | Extended | +reproducibility snapshot read, +AuditRequest consumption |
| T143 | Extended (§33a) | +Session passing browse→analyze, +restore_state no-op node |
| T145 | Extended | +AuditRequest construction, +gateway call |
| T148 | Extended | +reproducibility, +scoring, +two-store, +audit_requests verification |
| T149 | Extended | Same additions as T148 |
| T150 | Extended | Same additions as T148 |
| T156-T175 | **New** | Master foundations: gateway, reproducibility, two-store, scoring, dashboard |
| T107 | Extended (v2.1) | Two-stage heuristic filtering: filterByBusinessType + filterByPageType |
| T137 | Extended (v2.1) | +Stage 1 heuristic filtering (filterByBusinessType) in audit_setup |
| T138 | Extended (v2.1) | +Stage 2 heuristic filtering (filterByPageType) in page_router |
| T160 | Extended (v2.1) | +loadAndValidateSnapshot() (gateway creates, audit_setup loads) |
| T161 | Extended (v2.1) | +evaluate_interactive to temperature guard node list |
| T165 | Extended (v2.1) | +priority formula parenthesis fix noted |
| T176-T192 | **New** | State exploration: types, rules, detection, Pass 1/2, graph, multi-state, GR-009 |
| T193-T212 | **New (§33)** | Agent composition: interactive evaluate, tool injection, dual-mode, nav guard, grounding rules, workflow restore, cost model, activity timeout |
| T213-T262 | **New (v2.2 + v2.2a)** | See §v2.2 Additions below |

---

## v2.2 Additions (T213-T262) — 50 New Tasks

> **Version:** 2.2 (April 2026) + 2.2a patch (external review)
> **Spec References:** Design spec `docs/superpowers/specs/2026-04-15-master-plan-refinement-design.md`, new specs §34 / §35 / §36, modifications to §4, §5, §6, §7, §9, §11, §13, §14

### Phase 6: Heuristic KB + Benchmarks (T213-T216)

#### T213: HeuristicSchema benchmark field [NEW v2.2]
- **dep:** T101
- **spec:** §9.1 REQ-HK-BENCHMARK-001..005
- **files:** `packages/agent-core/src/analysis/heuristics/schema.ts` (extend)
- **smoke test:** Zod validation fails if heuristic missing benchmark field
- **acceptance:** Benchmark is REQUIRED on HeuristicSchema. Discriminated union: quantitative | qualitative. Both types validated at load time.

#### T214: GR-012 benchmark validation rule [NEW v2.2]
- **dep:** T213
- **spec:** §7.7 GR-012
- **files:** `packages/agent-core/src/analysis/grounding/rules/GR012.ts`
- **smoke test:** Finding claiming "5 fields" against quantitative benchmark "6-8" within ±20% passes; claim "20 fields" rejects
- **acceptance:** GR-012 added to grounding rule chain. Handles both quantitative and qualitative benchmarks. Unit tests for both.

#### T215: Evaluate prompt benchmark injection [NEW v2.2]
- **dep:** T213, T120 (EvaluateNode)
- **spec:** §7.5 user message template
- **files:** Extend `packages/agent-core/src/analysis/nodes/EvaluateNode.ts` prompt template
- **smoke test:** Evaluate prompt for form heuristic includes "Industry standard: 6-8 fields (Baymard)"
- **acceptance:** Benchmark data injected alongside each heuristic in evaluate user message. Different format for quantitative vs qualitative.

#### T216: Author 100 heuristic benchmarks [NEW v2.2, LARGE]
- **dep:** T213, T103-T105 (heuristic authoring)
- **files:** `heuristics-repo/baymard.json`, `heuristics-repo/nielsen.json`, `heuristics-repo/cialdini.json`
- **acceptance:**
  - Top 30 structural heuristics get quantitative benchmarks (priority)
  - Remaining 70 get qualitative benchmarks
  - All 100 pass HeuristicSchema Zod validation with benchmarks
  - Each benchmark cites a research source
- **WORKSTREAM:** This is a CRO team deliverable, not engineering. Runs in parallel with Phase 0-6 engineering work (Phase 0b).

### Phase 8: Cross-Page Analysis (T217-T223)

#### T217: PatternFinding + PatternDetector [NEW v2.2]
- **dep:** T135 (AuditState), T131 (AnnotateNode)
- **spec:** §5.8.1 PatternFinding, §7.13 REQ-ANALYZE-CROSSPAGE-003
- **files:** `packages/agent-core/src/analysis/cross-page/PatternDetector.ts`
- **smoke test:** 3 pages with same heuristic violation produce 1 PatternFinding referencing all 3
- **acceptance:** Groups grounded_findings by heuristic_id. Threshold: 3+ pages. Selects representative finding. Deterministic, no LLM.

#### T218: Pattern finding scope in data model [NEW v2.2]
- **dep:** T070 (DB schema), T217
- **spec:** §13.6 findings.scope enum
- **files:** Migration to extend findings.scope enum
- **acceptance:** `scope` enum includes `cross_page_pattern`. Pattern findings stored with this scope.

#### T219: ConsistencyFinding + ConsistencyChecker [NEW v2.2]
- **dep:** T135, T217
- **spec:** §5.8.1 ConsistencyFinding
- **files:** `packages/agent-core/src/analysis/cross-page/ConsistencyChecker.ts`
- **smoke test:** Pages with mixed CTA colors produce a ConsistencyFinding listing majority and outlier pages
- **acceptance:** Checks CTA styles, nav, trust signals, branding across page_signals. Deterministic, no LLM.

#### T220: Consistency finding scope in data model [NEW v2.2]
- **dep:** T218, T219
- **files:** Migration to extend findings.scope
- **acceptance:** `scope` enum includes `cross_page_consistency`.

#### T221: FunnelFinding + FunnelAnalyzer [NEW v2.2]
- **dep:** T135, T219, T073 (LLMAdapter)
- **spec:** §5.8.1 FunnelFinding
- **files:** `packages/agent-core/src/analysis/cross-page/FunnelAnalyzer.ts`
- **smoke test:** Mock audit with 4 pages (home, PDP, cart, checkout) produces funnel findings for promise mismatches
- **acceptance:** Single LLM call, temperature=0, $1 budget cap. Uses page_signals + findings as input. All outputs Tier 2 (24hr delay).

#### T222: cross_page_analyze node [NEW v2.2]
- **dep:** T217, T219, T221
- **spec:** §4.2 REQ-ORCH-NODE-002b
- **files:** `packages/agent-core/src/orchestration/nodes/CrossPageAnalyzeNode.ts`
- **smoke test:** Node runs after page loop, produces pattern_findings, consistency_findings, funnel_findings in state
- **acceptance:** Orchestrator calls PatternDetector → ConsistencyChecker → FunnelAnalyzer in order. Emits `cross_page_analysis_completed` event.

#### T223: AuditGraph cross-page integration [NEW v2.2]
- **dep:** T222, T143 (AuditGraph)
- **spec:** §4.4 REQ-ORCH-SUBGRAPH-001 (v2.2)
- **files:** Edit `packages/agent-core/src/orchestration/AuditGraph.ts`
- **smoke test:** Graph flows: page_router → cross_page_analyze → audit_complete when page queue empty
- **acceptance:** routePageRouter routes to "cross_page_analyze" instead of "audit_complete". New edge `cross_page_analyze → audit_complete`.

### Phase 4: Token-Level Cost Accounting (T224-T226)

#### T224: llm_call_log table + LLMCallRecord [NEW v2.2]
- **dep:** T070 (DB schema), T073 (LLMAdapter)
- **spec:** §13.7 REQ-DATA-V22-001
- **files:** Migration `0003_llm_call_log.sql`, extend LLMAdapter interface
- **smoke test:** `pnpm db:migrate` creates llm_call_log table with correct indexes
- **acceptance:** Table created. LLMAdapter.invoke() returns `{ response, callRecord }`. MODEL_PRICING config.

#### T225: CostTracker refactored to actuals [NEW v2.2]
- **dep:** T224, T118 (CostTracker)
- **spec:** §11.7 REQ-COST-010..014
- **files:** Refactor `packages/agent-core/src/analysis/CostTracker.ts`
- **smoke test:** Evaluate call logs row in llm_call_log with actual tokens + cost. State budget updated from actual, not estimate.
- **acceptance:** Pre-call budget gate estimates from getTokenCount. Actual cost decremented from budget_remaining_usd. Cost summary in audit_runs.cost_summary.

#### T226: Per-client cost attribution query [NEW v2.2]
- **dep:** T224
- **spec:** §11.7 REQ-COST-014
- **files:** `packages/agent-core/src/analytics/costAttribution.ts`
- **smoke test:** `getClientCost(clientId, startDate, endDate)` returns sum from llm_call_log JOIN audit_runs
- **acceptance:** Query function available. Used by admin dashboard (Phase 9).

### Phase 12: Mobile Viewport (T227-T231) — MASTER PLAN ONLY, NOT MVP

#### T227: AuditPage.viewport_strategy field [NEW v2.2]
- **dep:** T135
- **spec:** §5.2 AuditPage (v2.2 extension)
- **files:** Edit AuditState types
- **acceptance:** `viewport_strategy: "desktop_only" | "mobile_only" | "both"`, default `desktop_only`.

#### T228: AnalyzePerception viewport_context [NEW v2.2]
- **dep:** T013 (ContextAssembler)
- **spec:** §7.9 viewport_context
- **files:** Extend AnalyzePerception type
- **acceptance:** `viewport_context: { width, height, device_type }` in metadata. Populated as desktop in MVP.

#### T229: Dual-viewport pipeline [NEW v2.2]
- **dep:** T227, T228, T186 (DeepPerceiveNode)
- **files:** Extend deep_perceive to re-run at mobile viewport if `viewport_strategy === "both"`
- **smoke test:** Audit with viewport_strategy="both" produces two AnalyzePerceptions (desktop + mobile) per page
- **acceptance:** page.setViewportSize(390x844) for mobile pass. Both findings tagged with viewport.

#### T230: Stage 3 heuristic filtering by viewport [NEW v2.2]
- **dep:** T107 (HeuristicFilter), T229
- **spec:** §9.6 three-stage filtering
- **files:** Extend HeuristicFilter with filterByViewport
- **acceptance:** Heuristics filtered by business_type → page_type → viewport_applicability.

#### T231: Author 10-15 mobile-specific heuristics [NEW v2.2]
- **dep:** T213 (benchmark schema), T230
- **files:** `heuristics-repo/mobile.json`
- **acceptance:** 10-15 heuristics with viewport_applicability="mobile". MOB-TAP-001, MOB-THUMB-001, MOB-SCROLL-001, MOB-STICKY-001, MOB-FONT-001, etc. All have benchmarks.

### Phase 7: Perception Quality Gate + Error Recovery (T232-T235)

#### T232: PerceptionQualityScorer [NEW v2.2]
- **dep:** T186 (DeepPerceiveNode)
- **spec:** §7.10 REQ-ANALYZE-QUALITY-001..004
- **files:** `packages/agent-core/src/analysis/quality/PerceptionQualityScorer.ts`
- **smoke test:** Page with cookie overlay covering 45% viewport scores <0.6 on no_overlay_detected signal
- **acceptance:** 7 weighted signals. Returns PerceptionQualityScore with overall, signals, blocking_issue.

#### T233: Quality gate routing in analyze graph [NEW v2.2]
- **dep:** T232, T134 (AnalysisGraph)
- **spec:** §7.10 three outcomes table
- **files:** Edit AnalysisGraph to add quality_gate node between deep_perceive and evaluate
- **smoke test:** Score <0.3 → analysis_status = "perception_insufficient", skip evaluate
- **acceptance:** Three routing paths: proceed / partial / skip. Analysis_status set correctly.

#### T234: Analysis error recovery matrix [NEW v2.2]
- **dep:** T120 (EvaluateNode), T121 (SelfCritiqueNode), T130 (EvidenceGrounder)
- **spec:** §7.11 REQ-ANALYZE-RECOVERY-001..003
- **files:** Extend each node with error handlers
- **smoke test:** Simulate LLM timeout → pipeline splits batch and retries. Simulate all-rejected critique → skip critique.
- **acceptance:** All 8 failure modes from recovery matrix have specific handlers. Every page gets analysis_status.

#### T235: Audit completion report with status breakdown [NEW v2.2]
- **dep:** T234, T144 (AuditComplete)
- **spec:** §7.11 REQ-ANALYZE-RECOVERY-003
- **files:** Extend AuditComplete to compute completion_summary
- **acceptance:** Summary includes: pages_complete, pages_partial, pages_skipped_*, completion_summary string.

### Phase 4: LLM Rate Limiting + Failover (T236-T238)

#### T236: LLM rate limiter [NEW v2.2]
- **dep:** T073 (LLMAdapter)
- **spec:** §11.8 REQ-RATE-LLM-001..004
- **files:** `packages/agent-core/src/adapters/LLMRateLimiter.ts`
- **smoke test:** 51 rapid calls to Anthropic provider — 51st waits until window resets
- **acceptance:** Sliding window in Redis. Configurable RPM/TPM/concurrent per provider. Exponential backoff with jitter.

#### T237: LLM failover policy [NEW v2.2]
- **dep:** T073, T236
- **spec:** §11.9 REQ-FAILOVER-001..006
- **files:** `packages/agent-core/src/adapters/LLMFailoverAdapter.ts`
- **smoke test:** Simulate 3 Claude failures → next call uses GPT-4o. Next call tries Claude again.
- **acceptance:** Per-call failover. FailoverEvent logged. Finding gets model_used + model_mismatch fields.

#### T238: Both-providers-down pause/resume [NEW v2.2]
- **dep:** T237, BullMQ
- **spec:** §11.9 REQ-FAILOVER-005
- **files:** Extend orchestrator with pause handler + BullMQ resume job
- **smoke test:** 3 consecutive page failures → audit_status = "paused_llm_unavailable". BullMQ scheduled resume.
- **acceptance:** Pause (not terminate). 3 resume attempts over 15min. Consultant notified.

### Phase 9: §34 Observability (T239-T244)

#### T239: Pino structured logging [NEW v2.2]
- **dep:** T002
- **spec:** §34.3 REQ-OBS-001..005
- **files:** `packages/agent-core/src/observability/logger.ts`
- **smoke test:** Log line includes audit_run_id, page_url, node_name as JSON fields
- **acceptance:** No console.log in production code. All structured JSON. Sensitive data redaction.

#### T240: audit_events table [NEW v2.2]
- **dep:** T070
- **spec:** §34.4 REQ-OBS-010..014, §13.7 REQ-DATA-V22-002
- **files:** Migration `0004_audit_events.sql`
- **acceptance:** Table + indexes created. 22 event_type values enumerated in types.

#### T241: Event emission in nodes [NEW v2.2]
- **dep:** T240
- **files:** Inject EventEmitter into all graph nodes
- **smoke test:** Running an audit produces events: audit_started, page_analyze_started, finding_produced, page_analyze_completed, audit_completed
- **acceptance:** All 22 event types emitted from appropriate nodes. Events appear in audit_events table and SSE stream.

#### T242: Heuristic health metrics materialized view [NEW v2.2]
- **dep:** T070, T240
- **spec:** §34.5 REQ-OBS-021..022, §13.7 REQ-DATA-V22-003
- **files:** Migration for materialized view + refresh job
- **acceptance:** View queryable. Nightly refresh job. health_score computed correctly.

#### T243: Alerting rules + BullMQ job [NEW v2.2]
- **dep:** T241, T242, notification adapter
- **spec:** §34.6 REQ-OBS-030..032
- **files:** `packages/agent-core/src/observability/AlertingJob.ts`
- **smoke test:** Audit running >45 min triggers warning alert within 5 min of threshold
- **acceptance:** 7 alert rules. Scheduled every 5 min. Debounced per audit_run_id per alert type per hour.

#### T244: Operational dashboard [NEW v2.2]
- **dep:** T241, T242, Phase 9 dashboard infrastructure
- **spec:** §34.7 REQ-OBS-040..042
- **files:** `apps/dashboard/src/app/console/admin/operations/page.tsx`
- **acceptance:** 6 sections rendered: active audits, 24h summary, heuristic health table, alert feed, cost trend, failure breakdown. Admin role only. Build LAST in Phase 9.

### Phase 9: §35 Report Generation (T245-T249)

#### T245: ExecutiveSummary type + generator [NEW v2.2]
- **dep:** T144 (AuditComplete), T217 (PatternFinding)
- **spec:** §35.2 REQ-REPORT-001..005
- **files:** `packages/agent-core/src/delivery/ExecutiveSummaryGenerator.ts`
- **smoke test:** Audit with 15 findings produces summary with overall_score, grade, top 5, strengths
- **acceptance:** Deterministic score formula. Strengths from pass results. 1 LLM call for recommended_next_steps ($0.10 cap).

#### T246: ExecutiveSummary integration [NEW v2.2]
- **dep:** T245
- **files:** Extend AuditComplete to populate state.executive_summary
- **acceptance:** executive_summary non-null when audit_run.status = "completed".

#### T247: ActionPlan generator [NEW v2.2]
- **dep:** T135 (findings), T165 (ScoringPipeline)
- **spec:** §35.3 REQ-REPORT-010..012
- **files:** `packages/agent-core/src/delivery/ActionPlanGenerator.ts`
- **smoke test:** Findings bucketed into 4 quadrants based on business_impact and effort_hours
- **acceptance:** Deterministic bucketing. estimated_total_effort_hours computed. Findings sort by priority within each quadrant.

#### T248: Next.js report HTML template [NEW v2.2]
- **dep:** T245, T247
- **spec:** §35.4 REQ-REPORT-020..024
- **files:** `apps/dashboard/src/app/api/report/[audit_run_id]/render/page.tsx`
- **smoke test:** GET /api/report/:id/render returns 8-section HTML page
- **acceptance:** Cover, exec summary, action plan, findings, patterns, funnel, methodology, appendix. Branded per client.

#### T249: PDF generator via Playwright [NEW v2.2]
- **dep:** T248
- **files:** `packages/agent-core/src/delivery/ReportGenerator.ts`
- **smoke test:** ReportGenerator.generate(auditRunId) produces PDF under 5MB, stored in R2
- **acceptance:** Playwright page.pdf(). R2 upload at /{client_id}/reports/{audit_run_id}/report.pdf. URL stored in audit_runs.report_pdf_url.

### Phase 7 + 0: §36 Golden Test Suite (T250-T251)

#### T250: Golden test infrastructure [NEW v2.2]
- **dep:** T252 (MockLLMAdapter)
- **spec:** §36.2-4 REQ-GOLDEN-001..022
- **files:** `test/golden/runner.ts`, `test/golden/comparator.ts`, CI workflow
- **smoke test:** Running a golden test case produces TP/FN/FP counts vs expected_findings
- **acceptance:** Test runner supports fast mode (MockLLMAdapter) and nightly mode (real LLM). Pass criteria enforced.

#### T251: Regression alerting for golden tests [NEW v2.2]
- **dep:** T250, T243 (alerting)
- **spec:** §36.5 REQ-GOLDEN-032
- **files:** Extend AlertingJob with golden_score_regression rule
- **acceptance:** Nightly scores drop >10% vs 7-day rolling avg fires P1 alert. Blocks next deployment.

### Phase 0: §36 Offline Mock Mode (T252-T253)

#### T252: MockBrowserEngine [NEW v2.2]
- **dep:** T002 (BrowserEngine interface)
- **spec:** §36.6 REQ-GOLDEN-041
- **files:** `test/mocks/MockBrowserEngine.ts`
- **smoke test:** NEURAL_MODE=offline returns saved perception from test/fixtures/sites/amazon-pdp/perception.json
- **acceptance:** Implements BrowserEngine interface. Returns saved fixtures. No Playwright.

#### T253: MockLLMAdapter [NEW v2.2]
- **dep:** T073 (LLMAdapter interface)
- **spec:** §36.6 REQ-GOLDEN-041
- **files:** `test/mocks/MockLLMAdapter.ts`
- **smoke test:** NEURAL_MODE=offline: evaluate call returns cached response from test/fixtures/llm-responses/
- **acceptance:** Implements LLMAdapter. Returns cached for known inputs, placeholder for unknown. Tracks simulated cost.

### Phase 1: §36 Fixture Capture (T254)

#### T254: Fixture capture CLI [NEW v2.2]
- **dep:** T013 (ContextAssembler)
- **spec:** §36.6 REQ-GOLDEN-043
- **files:** `apps/cli/src/commands/fixture-capture.ts`
- **smoke test:** `pnpm fixture:capture --url https://example.com` saves perception.json + page-state.json + screenshots to test/fixtures/sites/example-com/
- **acceptance:** One-time network hit. Reusable fixtures. Both `pnpm fixture:capture` and `pnpm golden:capture` commands work.

### Phase 1 / 5: Overlay Dismissal (T255) [v2.2a]

#### T255: Overlay dismissal step [NEW v2.2a]
- **dep:** T006 (BrowserManager), T048 (page_analyze)
- **spec:** §6.17 REQ-BROWSE-OVERLAY-001..006
- **files:** `packages/agent-core/src/browser-runtime/OverlayDismisser.ts`
- **smoke test:** Navigate to page with cookie banner → dismiss button clicked → banner removed → perception sees full page
- **acceptance:** Runs between stabilization and perception. 12 common selector patterns. Ghost-cursor click. 2s stability wait. Non-fatal on failure.

### Phase 9: DiscoveryStrategy (T256-T257) [v2.2a]

#### T256: DiscoveryStrategy adapter interface [NEW v2.2a]
- **dep:** T002
- **spec:** Design spec §1.2 (v2.2a DiscoveryStrategy)
- **files:** `packages/agent-core/src/gateway/DiscoveryStrategy.ts`
- **acceptance:** Interface defined. Three implementations: SitemapDiscovery, NavigationCrawlDiscovery, ManualDiscovery.

#### T257: DiscoveryStrategy integration in audit_setup [NEW v2.2a]
- **dep:** T256, T137 (AuditSetupNode)
- **files:** Extend audit_setup to accept discovery_strategy param
- **smoke test:** `--discovery nav-crawl` crawls homepage nav links, produces page queue
- **acceptance:** audit_setup selects strategy based on AuditRequest.discovery_strategy. All 3 implementations produce AuditPage[].

### Phase 7: Persona-Based Evaluation (T258-T259) [v2.2a]

#### T258: PersonaContext type + default personas [NEW v2.2a]
- **dep:** T002
- **spec:** §7.12 REQ-ANALYZE-PERSONA-001..004
- **files:** `packages/agent-core/src/analysis/personas/types.ts`, `packages/agent-core/src/analysis/personas/defaults.ts`
- **acceptance:** PersonaContext type with Zod schema. Default personas per business type (ecommerce, saas, leadgen, media).

#### T259: Persona injection in evaluate prompt [NEW v2.2a]
- **dep:** T258, T215 (benchmark injection)
- **files:** Extend EvaluateNode prompt template
- **smoke test:** client.personas = 3 personas → evaluate prompt includes persona descriptions → finding.persona tagged
- **acceptance:** 2-3 personas injected. Finding schema extended with `persona: string | null`. Evaluation considers each persona's perspective.

### Phase 9: NotificationAdapter (T260-T261) [v2.2a]

#### T260: NotificationAdapter + email implementation [NEW v2.2a]
- **dep:** T002
- **spec:** §14.8 REQ-DELIVERY-NOTIFY-001..003
- **files:** `packages/agent-core/src/adapters/NotificationAdapter.ts`, `packages/agent-core/src/adapters/EmailNotificationAdapter.ts`
- **smoke test:** notify({ type: "audit_completed", ... }) sends email via Resend
- **acceptance:** Adapter interface. Email implementation using Resend or Postmark. Notification preferences per user.

#### T261: Notification integration in audit_complete [NEW v2.2a]
- **dep:** T260, T144
- **files:** Extend AuditComplete to call notifier on completion
- **smoke test:** Completed audit triggers email with report URL to consultant
- **acceptance:** audit_completed, audit_failed, findings_ready_for_review events emit notifications. Preferences respected.

### Phase 8: Progressive Funnel Context (T262) [v2.2a, MASTER PLAN]

#### T262: Progressive funnel context injection [NEW v2.2a]
- **dep:** T217, T120 (EvaluateNode)
- **spec:** §7.13 REQ-ANALYZE-CROSSPAGE-004
- **files:** Extend EvaluateNode prompt with accumulated PageSignals
- **smoke test:** Page 5 evaluate prompt includes PageSignals summary from pages 1-4
- **acceptance:** For pages beyond first 2-3, PageSignals injected. Enables inline funnel-aware findings ("homepage promises X but this page doesn't"). MVP: skip this, use post-hoc only.

---

## v2.2 → v2.2a Summary

**Total tasks added:** 50 (T213-T262)
**New phases:** Phase 12 (Mobile Viewport, master plan only)
**Parallel workstream:** Phase 0b (Heuristic Authoring — CRO team, not engineering)

**Breakdown by category:**
- Benchmarks + GR-012: 4 tasks (T213-T216)
- Cross-page analysis: 7 tasks (T217-T223)
- Token-level cost: 3 tasks (T224-T226)
- Mobile viewport: 5 tasks (T227-T231) — master plan only
- Perception quality + error recovery: 4 tasks (T232-T235)
- LLM rate limiting + failover: 3 tasks (T236-T238)
- §34 Observability: 6 tasks (T239-T244)
- §35 Report generation: 5 tasks (T245-T249)
- §36 Golden tests + offline mock: 5 tasks (T250-T254)
- v2.2a additions: 8 tasks (T255-T262)

**Revised master plan total: 263 tasks across 12 phases (~21 weeks aspirational)**

**MVP extraction notes:**
- Mobile viewport (T227-T231) deferred to post-MVP
- Progressive funnel context (T262) deferred to post-MVP (use post-hoc only)
- NavigationCrawlDiscovery deferred to post-MVP (MVP: Sitemap + Manual only)
- Cross-page: pattern detection (T217-T218) only for MVP; defer consistency + funnel
- Ops dashboard (T244): build LAST in Phase 9

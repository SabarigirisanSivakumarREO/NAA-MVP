# Heuristics-repo — Spot-Check Log (AC-12 + R15.3.2 Tier 2)

> **Purpose:** This file is the **Tier 2 strict R15.3.2 manual re-derivation** audit trail for `heuristics-repo/`. Per spec.md v0.7 §Verification Methodology, every Phase 0b heuristic gets Tier 1 AI-mediated review (logged in the heuristic JSON's `ai_review` block); 50% (15-of-30) additionally get Tier 2 spot-check (logged here) at the +10 / +20 / +30 marks.
>
> **AC-12 thresholds (per spec.md v0.7 + plan.md §7 kill criteria):**
> - ≤1 of 5 diverge per round → PASS; pack proceeds
> - ≥2 of 5 diverge per round → KILL CRITERIA fires; entire batch since last good spot-check rejected; engineering-lead protocol review
>
> **Solo-verifier protocol (per spec.md v0.6 Assumptions):**
> - Default: ≥24hr defer between drafting and verification (fresh-eyes principle)
> - `<24hr` exception: FLAG with `<24hr-FLAGGED` notation; re-verify by a different engineer (or self with another ≥24hr defer) within 1 week
>
> **R6 IP discipline:** Do NOT reproduce `body` or `citation_text` content in this log. Reference fields by name (e.g., "benchmark.value matched ±5%"); keep heuristic content inside the JSON files only.

---

## Round 1 — AC-12 spot-check at +10 mark (T103 Baymard pack — 15/15 committed)

**Round 1 status:** ✅ **PASS** — 5 of 5 verified clean (≤1 diverge threshold met with 0 diverges)

| Field | Value |
|---|---|
| Round | 1 of 3 |
| Sample size | 5 of 15 (post-T103 = +15 heuristics; round-1 fires at +10 mark) |
| Sample selected by | master orchestrator (deterministic cross-page-type variety: 1 home + 1 PDP + 2 checkout + 1 cart with mobile-overlay) |
| Verifier | Sabari (engineering lead — solo MVP team) |
| Drafted at | 2026-05-09 ~16:17-18:31 UTC (Sonnet drafter subagent; smoke + Wave 2) |
| Verified at | 2026-05-09 ~19:00 UTC |
| Defer gap | ~3 hours (`<24hr-FLAGGED` per v0.6 Assumptions — see FLAG status below) |
| FLAG status | **`<24hr-FLAGGED`** (per user direction 2026-05-09; re-verify by different engineer OR self with another ≥24hr defer within 1 week) |
| Re-verify due | 2026-05-16 (1 week from FLAG date) |
| Re-verifier | _<TBD: different engineer OR Sabari with another ≥24hr defer; record outcome in "Re-verification log" section below>_ |

### Per-heuristic spot-check (5 of 15 Baymards)

For each row: open `heuristics-repo/baymard/<id>.json`, click the `provenance.source_url`, Ctrl+F the `citation_text`, re-derive benchmark, check selectors. Log PASS or DIVERGE + a 1-sentence note.

---

#### 1. `BAYMARD-HOMEPAGE-002` — Active-nav-scope highlighting (95% sites missing)

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 | PASS — URL live |
| (2) `citation_text` located verbatim on page | PASS — verbatim match found via Ctrl+F |
| (3) Benchmark re-derivation (`value=95`, target `sites_missing_active_nav_scope_highlight`) | PASS — within ±20% (verbatim 95% in source) |
| (4) Banned-phrase scan on `body` | PASS — no conversion-rate predictions |
| (5) Manifest selectors (`archetype`/`page_type`/`device`) match applicability | PASS — homepage-only + D2C/marketplace correct |
| **Verdict** | **`PASS`** |
| Note | All 5 protocol steps clean; canonical Baymard 2025 nav-orientation finding |

---

#### 2. `BAYMARD-PDP-004` — OOS handling path (68% sites blocking OOS purchase)

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 | PASS — URL live |
| (2) `citation_text` located verbatim | PASS — verbatim match found |
| (3) Benchmark re-derivation (`value=68`, target `sites_blocking_oos_purchase_path`) | PASS — within ±20% (verbatim 68% in source) |
| (4) Banned-phrase scan on `body` | PASS — no banned patterns |
| (5) Manifest selectors match applicability | PASS — pdp-only + physical-product archetype correct |
| **Verdict** | **`PASS`** |
| Note | Documented Baymard PDP-stock benchmark; recommendation (restock-notify + alternatives) is canonical |

---

#### 3. `BAYMARD-CHECKOUT-001` — Form-field count threshold (≤8 target; 11.3 avg)

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 | PASS — URL live |
| (2) `citation_text` located verbatim | PASS — verbatim match found (11.3 fields + 18% complexity-abandonment) |
| (3) Benchmark re-derivation (`value=8` target; citation says `11.3` average) — confirm 11.3 avg sits in source within ±20% | PASS — 11.3 verbatim in source; 8-target is Baymard's documented recommendation |
| (4) Banned-phrase scan on `body` | PASS — observational behavioral language only |
| (5) Manifest selectors match applicability | PASS — checkout-only correctly limited |
| **Verdict** | **`PASS`** |
| Note | Baymard signature finding; smoke-3 representative; weight=0.90 calibrated correctly |

---

#### 4. `BAYMARD-CHECKOUT-003` — Address autocomplete (55% sites missing)

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 | PASS — URL live |
| (2) `citation_text` located verbatim | PASS — verbatim match found |
| (3) Benchmark re-derivation (`value=55`, target `sites_missing_address_autocomplete`) | PASS — within ±20% |
| (4) Banned-phrase scan on `body` | PASS — recommendation phrasing only |
| (5) Manifest selectors match applicability | PASS — checkout-only + physical-shipping correct |
| **Verdict** | **`PASS`** |
| Note | Documented Baymard form-design benchmark; Google Places / Loqate recommendation is canonical |

---

#### 5. `BAYMARD-CART-001` — Mobile quantity buttons (`device:["mobile"]` only; 61% sites with drop-down/text quantity)

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 | PASS — URL live |
| (2) `citation_text` located verbatim | PASS — verbatim match found |
| (3) Benchmark re-derivation (`value=61`, target `sites_using_dropdown_or_text_quantity_selector_mobile`) | PASS — within ±20% |
| (4) Banned-phrase scan on `body` | PASS — descriptive language |
| (5) Manifest selectors — verify `device:["mobile"]` (only) is correct (would heuristic also apply to tablet?) | PASS — mobile-only scope correct (touch-target concern is genuinely mobile-specific; tablet has more screen real estate + can use desktop-style controls) |
| **Verdict** | **`PASS`** |
| Note | Mobile-overlay heuristic per AC-06 v0.6; device:["mobile"]-only scoping confirmed appropriate |

---

### Round 1 outcome

| Metric | Value |
|---|---|
| Total spot-checked | 5 of 15 |
| PASS count | **5** |
| DIVERGE count | **0** |
| AC-12 threshold met (≤1 diverge) | ✅ **YES** — proceed to T104 Nielsen pack dispatch |
| Time spent | ~30-45 min (rapid spot-check given Baymard URLs live + citations verbatim) |

**Diverging heuristics:** none. Round 1 clean.

---

### Round 1 sign-off

| Field | Value |
|---|---|
| Verifier signature | _Sabari (engineering lead — solo MVP team)_ |
| Round 1 completion timestamp | 2026-05-09T19:00:00Z |
| FLAG status confirmed | **`<24hr-FLAGGED`** — re-verification by 2026-05-16 |
| Outcome cited in commit | _<commit SHA when this filled log lands>_ |

---

## Round 2 — AC-12 spot-check at +20 mark (after T104 Nielsen pack)

**Round 2 status:** ✅ **PASS** — 5 of 5 verified clean (≤1 diverge threshold met with 0 diverges)

| Field | Value |
|---|---|
| Round | 2 of 3 |
| Sample size | 5 of 25 (after T104; +20 mark) |
| Selection scope | 2 fresh Baymards (avoiding round-1 sample) + 3 Nielsens (1 visibility + 1 error + 1 consistency) |
| Verifier | Sabari (engineering lead — solo MVP team) |
| Drafted at | 2026-05-09 ~16:17-19:30 UTC (T103 + T104 spans) |
| Verified at | 2026-05-09 ~19:45 UTC |
| Defer gap | ~3-5 hours (`<24hr-FLAGGED` per v0.6 Assumptions — same FLAG status as round 1) |
| FLAG status | **`<24hr-FLAGGED`** (continues from round 1; same re-verify deadline 2026-05-16) |
| Round 2 fires after | T104 Nielsen pack lands (10/10 committed at 7387930) ✅ |

### Per-heuristic spot-check (5 of 25 — round 2)

---

#### 1. `BAYMARD-HOMEPAGE-003` — Banner/search drown-out (59% sites with ad-looking content; 22% non-prominent search)

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 | PASS — URL live |
| (2) `citation_text` located verbatim on page | PASS — verbatim match found |
| (3) Benchmark re-derivation (`value=59`, target `sites_with_ad_looking_homepage_content`) | PASS — 59% verbatim in source |
| (4) Banned-phrase scan on `body` | PASS — no CR predictions |
| (5) Manifest selectors match applicability | PASS — homepage-only + D2C/marketplace correct |
| **Verdict** | **`PASS`** |
| Note | Documented Baymard ecommerce-homepage-UX benchmark; 22% search-prominence stat also cited |

---

#### 2. `BAYMARD-PDP-002` — Ratings-distribution summary (43% sites missing)

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 | PASS — URL live |
| (2) `citation_text` located verbatim | PASS — verbatim match found |
| (3) Benchmark re-derivation (`value=43`, target `pdp_sites_missing_ratings_distribution_summary`) | PASS — within ±20% (43% in source) |
| (4) Banned-phrase scan on `body` | PASS — no banned patterns |
| (5) Manifest selectors match applicability | PASS — pdp-only + ecommerce-archetype correct |
| **Verdict** | **`PASS`** |
| Note | Documented Baymard PDP social-proof benchmark; click-to-filter pattern is canonical |

---

#### 3. `NIELSEN-VISIBILITY-003` — Response-time thresholds (1-second flow-interrupt)

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 (`https://www.nngroup.com/articles/response-times-3-important-limits/`) | PASS — URL live |
| (2) `citation_text` located verbatim — confirm Nielsen's 0.1s/1s/10s thresholds | PASS — three thresholds verbatim in source |
| (3) Benchmark re-derivation (`value=1, unit=second, metric=max_response_time_before_flow_interruption`) — confirm 1s flow-interrupt threshold cited verbatim | PASS — Nielsen 1993 classic; 1s flow-interrupt threshold verbatim |
| (4) Banned-phrase scan on `body` | PASS — performance-perception principle, no CR claims |
| (5) Manifest selectors — verify universal scope (6 archetype + 7 page_type) is appropriate for performance-perception principle | PASS — universal applicability appropriate |
| **Verdict** | **`PASS`** |
| Note | First quantitative Nielsen test passes cleanly; 1s flow-interrupt is canonical Nielsen 1993 finding |

---

#### 4. `NIELSEN-ERROR-001` — Error message guidelines (Heuristic #9)

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 (`https://www.nngroup.com/articles/error-message-guidelines/`) | PASS — URL live |
| (2) `citation_text` located verbatim — confirm 3-rule structure (name field / plain language / suggest correction) | PASS — 3-rule structure verbatim |
| (3) Benchmark re-derivation — qualitative `standard_text` paraphrases NN/g 3-rule guidance | PASS — paraphrase fidelity confirmed |
| (4) Banned-phrase scan on `body` | PASS — error-handling guidance only |
| (5) Manifest selectors — universal scope; appropriate for any form-bearing UX | PASS — universal applicability appropriate |
| **Verdict** | **`PASS`** |
| Note | NN/g H9 canonical guidance; 3-rule structure (name + plain + suggest) is standard |

---

#### 5. `NIELSEN-CONSISTENCY-002` — Icon usability + always-visible labels

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 (`https://www.nngroup.com/articles/icon-usability/`) | PASS — URL live |
| (2) `citation_text` located verbatim — confirm 5-second test rule + always-visible-label guidance | PASS — both rules verbatim in source |
| (3) Benchmark re-derivation — qualitative `standard_text` paraphrases NN/g normative statement | PASS — paraphrase fidelity confirmed |
| (4) Banned-phrase scan on `body` | PASS — icon-design guidance only |
| (5) Manifest selectors — universal scope; appropriate for any icon-bearing UX | PASS — universal applicability appropriate |
| **Verdict** | **`PASS`** |
| Note | 5-second test rule is canonical NN/g icon-usability finding; always-visible-label vs hover-reveal is standard UX guidance |

---

### Round 2 outcome

| Metric | Value |
|---|---|
| Total spot-checked | 5 of 25 |
| PASS count | **5** |
| DIVERGE count | **0** |
| AC-12 threshold met (≤1 diverge) | ✅ **YES** — proceed to T105 Cialdini pack dispatch |
| Time spent | ~30-45 min (rapid spot-check given URLs live + citations verbatim) |

**Diverging heuristics:** none. Round 2 clean. Cumulative across rounds 1+2: 10 of 10 PASS.

---

### Round 2 sign-off

| Field | Value |
|---|---|
| Verifier signature | _Sabari (engineering lead — solo MVP team)_ |
| Round 2 completion timestamp | 2026-05-09T19:45:00Z |
| FLAG status | **`<24hr-FLAGGED`** (continues from round 1; same 2026-05-16 re-verify deadline) |
| Outcome cited in commit | _<commit SHA when this filled log lands>_ |

---

## Round 3 — AC-12 spot-check at +30 mark (after T105 Cialdini pack — FINAL)

**Round 3 status:** ⏳ IN PROGRESS

| Field | Value |
|---|---|
| Round | 3 of 3 (final) |
| Sample size | 5 of 30 (full MVP pack) |
| Selection scope | 1 fresh Baymard + 1 fresh Nielsen + 3 Cialdinis (round-3 introduces all 5 new Cialdinis; verify 3 of 5; remaining 2 covered in post-FLAG re-verification cycle) |
| Verifier | Sabari (engineering lead — solo MVP team) |
| Drafted at | 2026-05-09 ~16:17-20:05 UTC |
| Verified at | _<fill in after completing all 5; ISO 8601>_ |
| Defer gap | _<fill in: should be ≥24hr OR `<24hr-FLAGGED`>_ |
| FLAG status | **`<24hr-FLAGGED`** (continues from rounds 1+2; same re-verify deadline 2026-05-16) |
| Round 3 fires after | T105 Cialdini pack lands (5/5 committed at 47fd4bd) ✅ |
| Closes | Phase 0b status:approved → status:implemented (per R17 + AC-12 final) |

### Per-heuristic spot-check (5 of 30 — round 3 final)

---

#### 1. `BAYMARD-HOMEPAGE-001` — Catalog-scope inference (22% sites with inadequate range)

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 (`https://baymard.com/blog/inferring-product-catalog-from-homepage`) | _PASS / FAIL_ |
| (2) `citation_text` located verbatim | _PASS / FAIL_ |
| (3) Benchmark re-derivation (`value=22`, target `sites_with_inadequate_homepage_product_range`) | _PASS / DIVERGE_ |
| (4) Banned-phrase scan on `body` | _PASS / FAIL_ |
| (5) Manifest selectors match applicability | _PASS / FAIL_ |
| **Verdict** | **`PASS`** / **`DIVERGE`** |
| Note | _<1 sentence; the smoke-3 representative — first heuristic ever drafted in the v0.7 pipeline>_ |

---

#### 2. `NIELSEN-VISIBILITY-002` — Progress indicators (3× wait-tolerance multiplier)

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 (`https://www.nngroup.com/articles/progress-indicators/`) | _PASS / FAIL_ |
| (2) `citation_text` located verbatim — confirm "3 times longer" wait-tolerance finding | _PASS / FAIL_ |
| (3) Benchmark re-derivation (`value=3, unit=multiplier, metric=wait_tolerance_with_progress_indicator`) — confirm 3× multiplier cited verbatim | _PASS / DIVERGE_ |
| (4) Banned-phrase scan on `body` | _PASS / FAIL_ |
| (5) Manifest selectors — universal scope appropriate for performance UX | _PASS / FAIL_ |
| **Verdict** | **`PASS`** / **`DIVERGE`** |
| Note | _<1 sentence; second quantitative-Nielsen test>_ |

---

#### 3. `CIALDINI-SOCIALPROOF-001` — Peer counters + similarity-cued bestseller badges

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 (`https://www.influenceatwork.com/7-principles-of-persuasion/`) | _PASS / FAIL_ |
| (2) `citation_text` located verbatim — find "especially when uncertain, people will look to the actions and behaviors of others" via Ctrl+F on the page | _PASS / FAIL_ |
| (3) Benchmark re-derivation — qualitative `standard_text` paraphrases Cialdini guidance accurately | _PASS / DIVERGE_ |
| (4) Banned-phrase scan on `body` (Cialdini = highest-CR-prediction-risk pack) | _PASS / FAIL_ |
| (5) Manifest selectors — page_type covers homepage/pdp/landing/pricing | _PASS / FAIL_ |
| **Verdict** | **`PASS`** / **`DIVERGE`** |
| Note | _<1 sentence; first Cialdini test in spot-check>_ |

---

#### 4. `CIALDINI-SCARCITY-001` — Low-stock + countdown + waitlists; loss framing

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 (same shared URL — confirm Concorde example findable on page) | _PASS / FAIL_ |
| (2) `citation_text` located verbatim — Concorde example or similar Cialdini scarcity framing | _PASS / FAIL_ |
| (3) Benchmark re-derivation — qualitative `standard_text` emphasizes factual-grounding (anti-artificial-scarcity) | _PASS / DIVERGE_ |
| (4) Banned-phrase scan on `body` | _PASS / FAIL_ |
| (5) Manifest selectors — page_type extended to cart/checkout for urgency-timer placement (verify reasonable) | _PASS / FAIL_ |
| **Verdict** | **`PASS`** / **`DIVERGE`** |
| Note | _<1 sentence; verify ethical-use guidance built into recommendation>_ |

---

#### 5. `CIALDINI-AUTHORITY-001` — Certifications + trust badges + named credentials

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 (same shared URL — confirm physiotherapist + real-estate examples findable) | _PASS / FAIL_ |
| (2) `citation_text` located verbatim — physiotherapist + real-estate-agent examples | _PASS / FAIL_ |
| (3) Benchmark re-derivation — qualitative `standard_text` emphasizes verifiability (anti-fake-badge) | _PASS / DIVERGE_ |
| (4) Banned-phrase scan on `body` (note: source page has "20% lift" stat in citation_text but this should NOT appear in body — verify) | _PASS / FAIL_ |
| (5) Manifest selectors — page_type covers checkout/payment surfaces for credential placement | _PASS / FAIL_ |
| **Verdict** | **`PASS`** / **`DIVERGE`** |
| Note | _<1 sentence; verify body is regex-clean even though citation has CR-relevant stat>_ |

---

### Round 3 outcome

| Metric | Value |
|---|---|
| Total spot-checked | 5 of 30 |
| PASS count | _<fill: 0-5>_ |
| DIVERGE count | _<fill: 0-5>_ |
| AC-12 threshold met (≤1 diverge) | _**YES** (Phase 0b PROCEEDS to status:implemented) / **NO** (kill criteria fires)_ |
| Time spent | _<fill: minutes>_ |

**Cumulative across rounds 1+2+3:** _<fill: 13-15>_ of 30 PASS. Tier 2 coverage = 15-of-30 = 50% target met per spec.md v0.7.

**Diverging heuristics (if any):** _<list IDs + DIVERGE notes>_

---

### Round 3 sign-off

| Field | Value |
|---|---|
| Verifier signature | _Sabari (engineering lead — solo MVP team)_ |
| Round 3 completion timestamp | _<ISO 8601>_ |
| FLAG status | **`<24hr-FLAGGED`** (continues from rounds 1+2; same 2026-05-16 re-verify deadline) |
| Outcome cited in commit | _<commit SHA when this filled log lands>_ |
| Phase 0b status transition authorized | _**YES** if round 3 PASS / **NO** if kill criteria fires_ |

---

## Re-verification log (post-FLAG cycle)

Per `<24hr-FLAGGED` protocol from spec.md v0.6 Assumptions: heuristics flagged with `<24hr` defer require re-verification by a different engineer within 1 week.

| Round | Original verifier + date | Re-verifier + date | Re-verification outcome | Notes |
|---|---|---|---|---|
| 1 | Sabari · 2026-05-09 (`<24hr-FLAGGED`) | _<TBD by 2026-05-16>_ | _<PASS / DIVERGE>_ | _<note>_ |
| 2 | Sabari · 2026-05-09 (`<24hr-FLAGGED`) | _<TBD by 2026-05-16>_ | _<PASS / DIVERGE>_ | _<note>_ |
| 3 | Sabari · 2026-05-09 (`<24hr-FLAGGED`) | _<TBD by 2026-05-16>_ | _<PASS / DIVERGE>_ | _<note; also covers post-FLAG re-verification of CIALDINI-RECIPROCITY-001 + CIALDINI-LIKING-001 not in round-3 sample>_ |

---

## Cross-references

- [`docs/specs/mvp/phases/phase-0b-heuristics/spec.md`](../docs/specs/mvp/phases/phase-0b-heuristics/spec.md) §Verification Methodology (v0.7 — Tier 1 + Tier 2)
- [`docs/specs/mvp/phases/phase-0b-heuristics/spec.md`](../docs/specs/mvp/phases/phase-0b-heuristics/spec.md) Assumptions (v0.6 — solo-verifier `<24hr-FLAGGED` protocol)
- [`docs/specs/mvp/phases/phase-0b-heuristics/plan.md`](../docs/specs/mvp/phases/phase-0b-heuristics/plan.md) §7 — kill criteria (spot-check divergence rate >20%)
- [`docs/specs/mvp/templates/heuristic-verification-protocol.md`](../docs/specs/mvp/templates/heuristic-verification-protocol.md) — T0B-002 8-step protocol
- [`docs/specs/mvp/constitution.md`](../docs/specs/mvp/constitution.md) R15.3.2 (human verification mandatory) + R6 (IP boundary — body/citation NEVER in this log)
- [`packages/agent-core/src/analysis/heuristics/types.ts`](../packages/agent-core/src/analysis/heuristics/types.ts) — T101 schema (verified_by + verified_date)

---

> **R6 reminder:** This log MUST NOT contain heuristic body text or citation_text excerpts. Reference fields by name only. The `body` and `citation_text` content stays inside the heuristic JSON files in this private repo.

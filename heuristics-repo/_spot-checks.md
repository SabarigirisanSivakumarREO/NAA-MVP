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

**Round 1 status:** ⏳ IN PROGRESS

| Field | Value |
|---|---|
| Round | 1 of 3 |
| Sample size | 5 of 15 (post-T103 = +15 heuristics; round-1 fires at +10 mark) |
| Sample selected by | master orchestrator (deterministic cross-page-type variety: 1 home + 1 PDP + 2 checkout + 1 cart with mobile-overlay) |
| Verifier | Sabari (engineering lead — solo MVP team) |
| Drafted at | 2026-05-09 ~16:17-18:31 UTC (Sonnet drafter subagent; smoke + Wave 2) |
| Verified at | _<fill in after completing all 5; ISO 8601>_ |
| Defer gap | _<fill in: should be ≥24hr OR `<24hr-FLAGGED` per v0.6 Assumptions>_ |
| FLAG status | **`<24hr-FLAGGED`** (per user direction 2026-05-09; re-verify by different engineer OR self with another ≥24hr defer within 1 week) |
| Re-verify due | 2026-05-16 (1 week from FLAG date) |
| Re-verify by | _<fill in: name of second engineer; or "Sabari (self, ≥24hr defer)" with new gap recorded>_ |

### Per-heuristic spot-check (5 of 15 Baymards)

For each row: open `heuristics-repo/baymard/<id>.json`, click the `provenance.source_url`, Ctrl+F the `citation_text`, re-derive benchmark, check selectors. Log PASS or DIVERGE + a 1-sentence note.

---

#### 1. `BAYMARD-HOMEPAGE-002` — Active-nav-scope highlighting (95% sites missing)

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 | _PASS / FAIL — `<note>`_ |
| (2) `citation_text` located verbatim on page | _PASS / FAIL — `<note>`_ |
| (3) Benchmark re-derivation (`value=95`, target `sites_missing_active_nav_scope_highlight`) | _PASS (within ±20%) / DIVERGE (`source value: <X>%`)_ |
| (4) Banned-phrase scan on `body` | _PASS / FAIL — `<note>`_ |
| (5) Manifest selectors (`archetype`/`page_type`/`device`) match applicability | _PASS / FAIL — `<note>`_ |
| **Verdict** | **`PASS`** / **`DIVERGE`** |
| Note | _<1 sentence — what you saw>_ |

---

#### 2. `BAYMARD-PDP-004` — OOS handling path (68% sites blocking OOS purchase)

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 | _PASS / FAIL_ |
| (2) `citation_text` located verbatim | _PASS / FAIL_ |
| (3) Benchmark re-derivation (`value=68`, target `sites_blocking_oos_purchase_path`) | _PASS / DIVERGE_ |
| (4) Banned-phrase scan on `body` | _PASS / FAIL_ |
| (5) Manifest selectors match applicability | _PASS / FAIL_ |
| **Verdict** | **`PASS`** / **`DIVERGE`** |
| Note | _<1 sentence>_ |

---

#### 3. `BAYMARD-CHECKOUT-001` — Form-field count threshold (≤8 target; 11.3 avg)

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 | _PASS / FAIL_ |
| (2) `citation_text` located verbatim | _PASS / FAIL_ |
| (3) Benchmark re-derivation (`value=8` target; citation says `11.3` average) — confirm 11.3 avg sits in source within ±20% | _PASS / DIVERGE_ |
| (4) Banned-phrase scan on `body` | _PASS / FAIL_ |
| (5) Manifest selectors match applicability | _PASS / FAIL_ |
| **Verdict** | **`PASS`** / **`DIVERGE`** |
| Note | _<1 sentence>_ |

---

#### 4. `BAYMARD-CHECKOUT-003` — Address autocomplete (55% sites missing)

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 | _PASS / FAIL_ |
| (2) `citation_text` located verbatim | _PASS / FAIL_ |
| (3) Benchmark re-derivation (`value=55`, target `sites_missing_address_autocomplete`) | _PASS / DIVERGE_ |
| (4) Banned-phrase scan on `body` | _PASS / FAIL_ |
| (5) Manifest selectors match applicability | _PASS / FAIL_ |
| **Verdict** | **`PASS`** / **`DIVERGE`** |
| Note | _<1 sentence>_ |

---

#### 5. `BAYMARD-CART-001` — Mobile quantity buttons (`device:["mobile"]` only; 61% sites with drop-down/text quantity)

| Step | Outcome |
|---|---|
| (1) Source URL HTTP 200 | _PASS / FAIL_ |
| (2) `citation_text` located verbatim | _PASS / FAIL_ |
| (3) Benchmark re-derivation (`value=61`, target `sites_using_dropdown_or_text_quantity_selector_mobile`) | _PASS / DIVERGE_ |
| (4) Banned-phrase scan on `body` | _PASS / FAIL_ |
| (5) Manifest selectors — verify `device:["mobile"]` (only) is correct (would heuristic also apply to tablet?) | _PASS / FAIL_ |
| **Verdict** | **`PASS`** / **`DIVERGE`** |
| Note | _<1 sentence; particularly comment on the mobile-overlay scoping>_ |

---

### Round 1 outcome

| Metric | Value |
|---|---|
| Total spot-checked | 5 of 15 |
| PASS count | _<fill: 0-5>_ |
| DIVERGE count | _<fill: 0-5>_ |
| AC-12 threshold met (≤1 diverge) | _**YES** (proceed to T104) / **NO** (kill criteria fires)_ |
| Time spent | _<fill: minutes; target ~25 min × 5 = ~125 min>_ |

**Diverging heuristics (if any):** _<list IDs + DIVERGE notes; for each, action is REJECT + RE-DRAFT or REJECT + REMOVE>_

---

### Round 1 sign-off

| Field | Value |
|---|---|
| Verifier signature | _Sabari (engineering lead — solo MVP team)_ |
| Round 1 completion timestamp | _<ISO 8601>_ |
| FLAG status confirmed | **`<24hr-FLAGGED`** — re-verification by 2026-05-16 |
| Outcome cited in commit | _<commit SHA when this log file lands>_ |

---

## Round 2 — AC-12 spot-check at +20 mark (after T104 Nielsen pack)

**Round 2 status:** ⚪ NOT STARTED

| Field | Value |
|---|---|
| Round | 2 of 3 |
| Sample size | 5 of 25 (after T104; +20 mark) |
| Selection scope | random across all 25 (15 Baymard + 10 Nielsen) |
| Verifier | _<fill at round 2 time>_ |
| Round 2 fires after | T104 Nielsen pack lands (10/10 committed) |

_(Per-heuristic stubs to be filled at round 2 time)_

---

## Round 3 — AC-12 spot-check at +30 mark (after T105 Cialdini pack — final)

**Round 3 status:** ⚪ NOT STARTED

| Field | Value |
|---|---|
| Round | 3 of 3 (final) |
| Sample size | 5 of 30 (full MVP pack) |
| Selection scope | random across all 30 (15 Baymard + 10 Nielsen + 5 Cialdini) |
| Verifier | _<fill at round 3 time>_ |
| Round 3 fires after | T105 Cialdini pack lands (5/5 committed) |
| Closes | Phase 0b status:approved → status:implemented (per R17 + spec.md AC-12) |

_(Per-heuristic stubs to be filled at round 3 time)_

---

## Re-verification log (post-FLAG cycle)

Per `<24hr-FLAGGED` protocol from spec.md v0.6 Assumptions: heuristics flagged with `<24hr` defer require re-verification by a different engineer within 1 week.

| Round | Original verifier + date | Re-verifier + date | Re-verification outcome | Notes |
|---|---|---|---|---|
| 1 | Sabari · 2026-05-09 (`<24hr-FLAGGED`) | _<fill>_ | _PASS / DIVERGE_ | _<note>_ |
| 2 | _<fill>_ | _<fill>_ | _<fill>_ | _<fill>_ |
| 3 | _<fill>_ | _<fill>_ | _<fill>_ | _<fill>_ |

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

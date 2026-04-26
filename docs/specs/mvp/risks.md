---
title: Neural MVP — Risks + Mitigations
artifact_type: spec
status: approved
version: 1.0
created: 2026-04-24
updated: 2026-04-24
owner: engineering lead + product
authors: [REO Digital team, Claude]

supersedes: "docs/specs/mvp/PRD.md §15 (v1.2 inline content extracted to this file on 2026-04-24)"
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (v1.2 §15 — extracted)

governing_rules:
  - Constitution R8 (Cost + Safety)
  - Constitution R14 (Cost Accountability)
  - Constitution R17 (Lifecycle States)

delta:
  new:
    - File created by extracting PRD §15 to separate risks doc (good-spec review Option A, 2026-04-24)
  changed: []
  impacted:
    - docs/specs/mvp/PRD.md §15 (replaced with pointer)
  unchanged:
    - Subsection numbering (15.1-15.3) preserved for cross-ref stability
---

# Neural MVP — Risks + Mitigations

> **Summary (~90 tokens — agent reads this first):** Primary risk register (10 ranked risks with mitigation), lethal-trifecta contingencies for AI-assisted systems (non-determinism, cost spike, speed vs quality with prevention + detection + recovery per vector), and fallback protocols (manual audit fallback, 5-level model-throttle protocol, circuit breaker on repeated failures, human override at every gate). Operational when things go wrong; read at incident triage time.

### 15.1 Primary risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Heuristic authoring slips | Medium | High | Phase 0b starts Day 1; top 15 by Week 2 is gating milestone |
| Claude rate limit / outage during demo | Low | High | Pre-cache demo audit results; live demo has fallback replay |
| Target site has aggressive bot detection | Medium | Medium | Curate demo sites known to work; stealth deferred to v1.1 |
| PDF layout breaks on complex findings | Medium | Low | Build PDF template early (Week 11 start); test on 5 audits before demo |
| Grounding rejects too aggressively → empty reports | Low | Medium | Tunable thresholds; "review needed" fallback for borderline cases |
| Consultant finds output "not better than Lighthouse" | Low | High | Heuristic depth + benchmark citation + grounded evidence is differentiator — CRO team must deliver depth, not just breadth |
| Cost exceeds $0.50 per page | Medium | Medium | Kimi gap analysis estimated ~$0.80/page; validate in Phase 5 and tune |
| Anti-bot detection during demo | Medium | Medium | Safe demo sites (example.com, known-friendly Shopify) |
| 12 weeks too long for fundraising | — | — | Can compress to 8 weeks by dropping dashboard (CLI-only) — loses investor polish |
| Scope creep from stakeholders | High | Medium | This PRD locked; new requests → v1.1 backlog |

### 15.2 Lethal trifecta contingencies — speed × non-determinism × cost

AI-assisted systems that move fast, produce non-deterministic output, AND burn variable cost per call are a combined risk that individual mitigations miss. Neural faces all three vectors.

#### 15.2.1 Non-determinism contingency

**Risk:** same audit inputs produce meaningfully different findings across runs, undermining consultant trust + client defensibility.

**Prevention:**
- Temperature=0 enforced on evaluate / self_critique / evaluate_interactive (R10)
- Reproducibility snapshot per audit (immutable; model version + prompt hashes + heuristic version) — §F-015
- Target: ≥ 90% finding overlap on repeat audit within 24 hrs

**Detection:**
- Every audit's reproducibility snapshot logged to `reproducibility_snapshots` table
- Nightly job (post-MVP) re-runs a golden audit; diffs findings; alerts if overlap drops below 85%

**Recovery when triggered:**
1. Pause audits for the affected client
2. Alert consultant + engineering lead (email via `NotificationAdapter`)
3. Diagnose: compare prompt hash vs previous; check LLM provider for silent model update (Anthropic doesn't version-lock aggressively)
4. If a silent model change: pin an older model version in `MODEL_PRICING` / adapter config; roll forward with stable pin
5. Re-run affected audits with the pinned model; communicate with consultant before re-delivering to client
6. **If determinism cannot be restored within 48 hrs:** manual-audit fallback per §15.3.1

#### 15.2.2 Cost-spike contingency

**Risk:** per-audit cost exceeds budget unexpectedly (Kimi gap analysis estimated real costs at ~2.3× projections; complex sites + retry loops compound).

**Prevention:**
- Hard budget cap: $15/audit, $5/page, $0.50/exploration (enforced at runtime, not advisory)
- Token-level cost accounting in `llm_call_log` (per-call actuals, not estimates — NF-002, F-021)
- Pre-call budget gate: estimate from `getTokenCount()` before invoking; skip or split batch if over
- Per-client cost attribution queryable for profitability tracking
- Per-node 85% auto-pause (Constitution R23.2 — added after good-spec review)

**Detection:**
- BullMQ-scheduled cost-sanity job (post-MVP) checks last 24 hrs of `llm_call_log`:
    - Any audit where `actual_cost_usd > 2 × projected_cost_usd` → alert
    - Any client where rolling 7-day cost exceeds revenue share → alert engineering lead
- Dashboard `/console/admin/operations` (deferred to v1.2) surfaces cost trend chart

**Recovery when triggered:**
1. **Immediate:** audit hits $15 cap → `budget_exceeded` termination (already implemented); partial findings delivered with note
2. **Client-level cost spike (recurring):** throttle per §15.3.2 — reduce max_pages, disable persona iteration, fall back to Tier 1 quantitative heuristics only (skip LLM evaluate on low-quality pages via quality gate)
3. **System-wide cost spike:** circuit-break new audit starts (BullMQ pause job); engineering investigates before resuming
4. **Catastrophic:** if a bug causes runaway calls (> 10× projected), revoke the Anthropic API key immediately via dashboard; rotate key after fix + cost-reconciliation with Anthropic billing

#### 15.2.3 Speed-vs-quality contingency

**Risk:** under demo pressure, engineering cuts corners (skip tests, widen `any`, bypass grounding) — a single compromised commit can erode trust in the entire audit output.

**Prevention:**
- Pre-commit checklist enforced by CI (git-workflow.md §3): lint + typecheck + test + conformance + Spec coverage (§10.6)
- Constitution R3.3: never disable a failing test; §10.3 NEVER rules are absolute
- Phase-level review gate (§10.5) before merging last PR of a phase
- Reviewer (human or subagent-reviewer) must confirm Spec coverage section present
- PR Contract (§10.9) makes AI-involvement explicit and surfaces risk tier

**Detection:**
- CI blocks any PR lacking Spec coverage section or PR Contract
- Reviewer checks that `any` additions have `// TODO: type this` + tracking issue link (R2.1)
- Quarterly review of `rejected_findings` table: if same grounding rule is firing on many real-client findings, the prompt or heuristic likely has a systemic quality gap

**Recovery when triggered:**
1. A bad commit discovered in production → revert PR, do NOT try to patch forward
2. Root cause: did a reviewer miss the Spec coverage, or did `--no-verify` bypass the checklist? Update reviewer guidelines or CI hook
3. If a whole set of findings already shipped to a client were based on broken code: pause delivery of new audits for that client; communicate proactively; offer re-audit with fixed pipeline at no additional cost

### 15.3 Fallback protocols

#### 15.3.1 Manual audit fallback

**When to invoke:** Determinism unrecoverable (§15.2.1) OR pipeline broken mid-engagement OR client-critical finding must be verified OR system-wide outage.

**Protocol:**
1. Consultant is informed via email/Slack within 1 hour of system failure detection
2. Consultant opens the consultant dashboard (if still functional) OR raw CLI logs; reviews last captured perception data per page
3. Consultant drafts findings manually using:
    - Annotated screenshots from R2 (if already captured)
    - Heuristic reference docs (available to consultants outside the `heuristics-repo/` IP barrier)
    - Consultant's own CRO expertise
4. Consultant delivers manual PDF through existing REO Digital template (pre-Neural workflow)
5. Post-incident review documents what failed + adds regression test

**Goal:** zero client-facing disruption. Consultant experience degrades (back to 40 hr workflow) but client never sees the break.

#### 15.3.2 Model-throttle protocol

**When to invoke:** Cost spike detected (§15.2.2) OR Anthropic rate-limit sustained > 10 min OR budget alert fires.

**Throttle levels (applied in order until issue resolves):**

| Level | Action | Expected effect |
|---|---|---|
| 1 — Gentle | Reduce `max_pages` from 20 to 10 per audit | ~50% LLM cost cut per audit |
| 2 — Moderate | Disable persona iteration (single default persona only) | ~30% additional cut on evaluate cost |
| 3 — Aggressive | Enable "skip if perception quality < 0.8" (stricter gate) | ~20% additional cut; more pages skip to partial |
| 4 — Maximum | Evaluate only Tier 1 quantitative heuristics deterministically; skip LLM evaluate entirely for low-quality pages | ~70% cost cut; quality drops to "checklist-grade" |
| 5 — Circuit break | Pause all new audits via BullMQ; drain in-flight; engineering investigates | No new cost incurred; in-flight audits finish |

Throttle config lives in `AuditRequest.throttle_level` (new field for v1.2; MVP accepts it as optional and ignores if absent).

#### 15.3.3 Circuit breaker on repeated failures

**Already implemented** (Constitution references § 11.3, §15):
- Domain-level: 3 failures → 1-hour block per domain
- LLM provider-level: 5 errors in 10 min → alert (v1.1 adds failover to GPT-4o)
- Audit-level: 3 consecutive page failures → pause audit; BullMQ resume in 5 min (3 attempts over 15 min)

**When circuit triggers:**
1. Audit paused → consultant notified
2. Engineering investigates root cause (check Pino logs correlated by `audit_run_id`)
3. If fixable in < 15 min: fix + resume
4. If not: audit marked `failed`, partial findings delivered with explicit status, consultant escalates per §15.3.1

#### 15.3.4 Human override at every gate

Humans can override the system at four gates:

| Gate | Human action | Effect |
|---|---|---|
| Audit trigger | Consultant chooses manual URL list instead of sitemap | Full control over page queue |
| Warm-up mode | Engineering / admin manually toggles `warmup_mode_active: false` for a trusted client | Bypasses the "first 3 audits held" rule |
| Consultant review | Reject or edit any finding before publication | Finding never reaches client without consultant approval |
| PDF delivery | Consultant previews PDF, can regenerate with edits | No auto-delivery to client |

There is no scenario where the system sends output to a client without at least one human approval gate (Constitution §6-R6.1, §24 two-store pattern, §F-019 review workflow).

## Cross-references

- Constitution R8 (Cost + Safety)
- Constitution R14 (Cost Accountability)
- Constitution R23 (Kill Criteria Before Task Start — per-node auto-pause)
- PRD §10.3 NEVER rules
- PRD §F-021 (cost accounting + budget gates)
- `docs/specs/mvp/testing-strategy.md` §9.4 (phase exit criteria)

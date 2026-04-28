# Specification Quality Checklist: Phase 0b — Heuristic Authoring (LLM-Assisted, Engineering-Owned)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-04-28
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details leak into spec.md core sections — *spec describes WHAT/WHY (drafting + verification + content delivery); plan.md owns the prompt template structure, lint CLI pseudocode, isolation strategy*
- [x] Focused on user value and business needs — *user stories framed around engineer drafting heuristic / spot-check verifier / Phase 6 loader as consumer*
- [x] Written for non-technical stakeholders — *summary, user stories, success criteria readable without engineering context; field names exposed only in AC + R tables*
- [x] All mandatory sections completed — *User Scenarios, AC, Functional Requirements, Success Criteria, Constitution Alignment, Out of Scope, Assumptions all present*

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous — *each R-NN cites either a file path (template), a CLI exit-code behavior (lint), a per-heuristic field requirement (provenance/benchmark/manifest selectors), or a process artifact (spot-check log)*
- [x] Success criteria are measurable — *SC-001 (lint exit 0), SC-002 (zero heuristics missing benchmark/provenance), SC-003 (12-25 filter return), SC-004 (≤1 of 5 spot-check), SC-005 ($15 / 45 min targets), SC-006 (Phase 6 T112 zero failures), SC-007 (zero R6 leakage)*
- [x] Success criteria are technology-agnostic — *SC-005 cites "$15" not vendor; SC-006 cites zero failures not specific test framework*
- [x] All acceptance scenarios are defined — *3 user stories × 2-4 Given/When/Then each*
- [x] Edge cases are identified — *9 edge cases listed (404 source URLs, ±20% drift on re-derivation, banned phrasing, semantic overlap dedup, Cialdini chapter references, multi-page-type, device-agnostic, hallucinated URLs, re-draft tracking)*
- [x] Scope is clearly bounded — *Out of Scope explicitly defers the remaining 70 heuristics, AES encryption, persona-specific authoring, auto-generation, conversion predictions, i18n, multi-tenant packs*
- [x] Dependencies and assumptions identified — *Assumptions list HeuristicSchemaExtended (Phase 6 T101), T4B-013 manifest selector contract, Anthropic SDK availability, spot-check verifier availability, source URL stability, F-012 v1.2 count canonical, no new vendor deps*

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria — *R-01..R-12 each map to one or more AC-NN; AC table cross-references back to R-NN via REQ-IDs*
- [x] User scenarios cover primary flows — *P1 stories cover engineer drafting + verifier spot-check + Phase 6 runtime validation*
- [x] Feature meets measurable outcomes defined in Success Criteria — *SC-001..SC-007 each cite a number / threshold / pass condition*
- [x] No implementation details leak into specification — *Drafting prompt structure, lint CLI pseudocode, isolation strategy, kill criteria, sequencing all in plan.md, not spec.md*

## Constitution alignment (cross-check)

- [x] R6 IP — Drafting subprocess isolated from LangSmith / Pino / dashboard (R15.3.3); committed JSON files protected (private repo MVP, AES at v1.1)
- [x] R15.3 — benchmark + provenance both required (Zod-enforced via Phase 6 schema)
- [x] R15.3.1 — 5 provenance fields mandated in spec + lint
- [x] R15.3.2 — human verification mandatory; codified in T0B-002 protocol
- [x] R15.3.3 — drafting LLM responses NOT logged externally; codified in plan.md §6 + AC-13
- [x] R5.3 / GR-007 — banned-phrase regex check in T0B-004 lint; AC-15
- [x] R20 — impact.md exists (this is a content-shipping phase touching shared content surface + tasks-v2.md; impact analysis required)
- [x] R23 — kill criteria defined in plan.md §7 (cost spike, time spike, divergence rate, schema failure, R6 boundary breach)
- [x] Manifest selectors (`archetype`/`page_type`/`device`) consumable by Phase 4b T4B-013 — confirmed in R-09 + AC-11

## Notes

- All checklist items pass on first review.
- Spec is ready for `/speckit.plan` and `/speckit.tasks` (already drafted alongside spec).
- LOW risk classification per impact.md §11 (content authoring; HeuristicSchemaExtended already locked in Phase 6 v0.3; no new contracts produced).
- tasks-v2.md v2.3.3 patch is required as part of this session's commit — Option A drift resolution per CLAUDE.md standing directive.
- One remaining drift to resolve via punch-list: `final-architecture/09-heuristic-kb.md` §9.3 still references "~100 heuristics" master target — Phase 0b ships 30 (MVP scope per F-012 v1.2). §9.3 wording is master target (correct for v1.1+); MVP wording lives in PRD F-012 v1.2 (also correct). No conflict; documented for clarity in spec.md "Out of Scope".

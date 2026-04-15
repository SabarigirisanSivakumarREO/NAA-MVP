# AI CRO Audit System — MVP Implementation Plan

## Spec-Kit Compatible · For Claude Code Development

**Project:** REO Digital / Neural Product
**Date:** April 2026
**Status:** Ready for Implementation
**Method:** Spec-Driven Development (SDD) with GitHub Spec Kit

---

## Document Map

| File | Purpose | Read When |
|------|---------|-----------|
| [README.md](README.md) | This file — overview and how to use | First |
| [constitution.md](constitution.md) | Engineering rules Claude Code MUST follow | Before any task |
| [spec.md](spec.md) | What the MVP does (functional + non-functional) | To understand scope |
| [plan.md](plan.md) | How to build it (architecture, tech stack, structure) | Before starting Phase 1 |
| [tasks.md](tasks.md) | 80+ numbered tasks (T001-T080+) ready to execute | When implementing |
| [data-model.md](data-model.md) | Database schema, types, interfaces | Before Phase 4 (DB) |
| [quickstart.md](quickstart.md) | Set up dev environment from scratch | Day 1 |
| [contracts/](contracts/) | API contracts, tool interfaces, MCP schemas | When implementing each layer |

---

## MVP Scope

### What's IN (8 weeks, ~80 tasks)

| Phase | Name | Deliverable |
|-------|------|-------------|
| **1** | Perception Foundation | Agent can see web pages |
| **2** | MCP Tools + Human Behavior | All 28 tools work via MCP |
| **3** | Verification & Confidence | Every action verified |
| **4** | Safety + Infrastructure | Postgres, LLM adapter, streaming |
| **5** | Browse Mode MVP | End-to-end browse on real sites |
| **6** | Heuristic Knowledge Base (~100 heuristics for MVP) | KB ready, filtering works |
| **7** | Analysis Pipeline | 5-step pipeline with grounding |
| **8** | Audit Orchestrator | **Single-site audit working end-to-end** |

### What's OUT (post-MVP, Phase 9-12)

- ❌ Multi-tenant client management (single client for MVP)
- ❌ Competitor analysis (single site only)
- ❌ Version tracking / re-audit comparison
- ❌ Full 250+ heuristics library (MVP starts with 100 foundational ones)
- ❌ Client dashboard (CLI output only)
- ❌ Consultant review workflow (auto-publish all Tier 1)
- ❌ Scheduled audits (manual trigger only)
- ❌ Production deployment (local Docker only)

### MVP Definition of Done

When you can run this command:

```bash
pnpm cro:audit --url https://example.com --pages 5 --output ./report
```

And get back:
- ✅ 5 pages crawled successfully
- ✅ Each page analyzed against 100 heuristics (filtered to ~15-25 relevant per page)
- ✅ Findings stored in PostgreSQL
- ✅ Annotated screenshots saved to disk
- ✅ JSON report file with all findings
- ✅ Total cost < $5
- ✅ Total time < 15 minutes

---

## How to Use This Plan with Claude Code

### Initial Setup (one-time)

```bash
# 1. Clone the empty repo
git clone <your-repo-url> ai-cro-audit
cd ai-cro-audit

# 2. Open in Claude Code
claude

# 3. Tell Claude Code to read the constitution and spec
> Read docs/specs/mvp/constitution.md and docs/specs/mvp/spec.md
> Acknowledge you understand the engineering rules and MVP scope
```

### Per-Task Workflow

For each task in `tasks.md`:

```bash
# 1. Tell Claude Code which task to execute
> Execute task T001 from docs/specs/mvp/tasks.md
> Reference docs/specs/final-architecture/06-browse-mode.md for spec details

# 2. Claude Code:
#    - Reads the task definition
#    - Checks dependencies are complete
#    - Implements per the spec
#    - Writes Zod schemas first
#    - Writes unit tests
#    - Implements the code
#    - Runs the smoke test
#    - Reports completion

# 3. Verify and commit
> Run the smoke test for T001
> If passing, commit with message: "feat(perception): T001 BrowserManager"
```

### When Things Go Wrong

```bash
# Claude Code drifted from the spec
> Re-read docs/specs/final-architecture/06-browse-mode.md section 6.4 (Node specs)
> Compare your implementation against the REQ-IDs
> Fix any deviations

# Spec is unclear
> Ask before assuming
> Reference the source: docs/specs/AI_Browser_Agent_Architecture_v3.1.md

# Tests fail
> Don't disable the test
> Don't modify the test to match buggy code
> Fix the implementation until the test passes
```

---

## File Structure to Build

After all 80+ tasks complete, the repo will look like this:

```
ai-cro-audit/
├── packages/
│   └── agent-core/
│       └── src/
│           ├── orchestration/
│           ├── perception/
│           ├── browser-runtime/
│           ├── mcp/
│           ├── human-behavior/
│           ├── verification/
│           ├── confidence/
│           ├── safety/
│           ├── adapters/
│           ├── streaming/
│           ├── rate-limit/
│           ├── db/
│           ├── analysis/
│           └── storage/
├── apps/
│   └── cli/                  # MVP: CLI runner only
├── heuristics-repo/          # Separate (in MVP, just JSON files in same repo)
├── docker-compose.yml        # Postgres + Redis
├── package.json
└── turbo.json
```

---

## Source of Truth

When in doubt, the spec files are the authoritative source:

| Topic | File |
|-------|------|
| Browse mode (any node, tool, behavior) | `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` |
| Analyze mode (pipeline, grounding rules) | `docs/specs/AI_Analysis_Agent_Architecture_v1.0.md` |
| System integration (orchestrator, layers) | `docs/specs/final-architecture/` |
| Tech stack decisions | `docs/specs/final-architecture/02-architecture-decisions.md` |

---

## MVP Success Criteria

The MVP is complete when:

1. **Functional:** The CLI command above works end-to-end
2. **Quality:** All unit tests pass, integration tests pass
3. **Cost:** A 5-page audit costs < $5 in LLM calls
4. **Time:** A 5-page audit completes in < 15 minutes
5. **Anti-hallucination:** At least 1 finding rejected by self-critique or grounding per audit (proves the filters work)
6. **Annotation:** Screenshots have visible numbered pins for findings
7. **Verification:** 100% of browse actions have a verification result

---

## Estimated Timeline

| Week | Phases | Status |
|------|--------|--------|
| 1-2 | Phase 1 (Perception) | Foundation |
| 2-4 | Phase 2 (Tools) | 28 tools |
| 4-5 | Phase 3 (Verification) | Quality |
| 5-6 | Phase 4 (Safety + Infra) | Foundation 2 |
| 6-7 | Phase 5 (Browse MVP) | ★ Browse works |
| 7-8 | Phase 6 (Heuristics) | KB ready |
| 8-10 | Phase 7 (Analysis Pipeline) | Analysis works |
| 10-11 | Phase 8 (Orchestrator) | ★★ MVP COMPLETE |

**Total: 8-11 weeks for MVP** (with focused Claude Code development)

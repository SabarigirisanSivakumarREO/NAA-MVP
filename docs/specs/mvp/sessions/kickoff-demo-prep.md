# Demo Preparation — Project Understanding Kickoff Prompt

> **Purpose:** This is a SEPARATE kickoff prompt (distinct from `kickoff-session-11.md` which boots Phase 1 implementation work). Use this prompt in a fresh Claude Code session BEFORE the Wednesday demo to fully understand: project context + implementation plan + current state + what to visually show + how to explain the project structure + anticipated Q&A. The user wants to be in control + well-prepared; Claude operates in advisory mode only.

> **When to use:** Before stakeholder demo, when authoring slides, or any time you need a deep briefing on project state without resuming implementation work.

> **Author:** Claude Opus 4.7 (Session 10 close-out, 2026-05-06).

> **Last updated:** 2026-05-06.

---

## Copy-paste prompt (start here)

```
DEMO-PREP ADVISORY SESSION — NOT an implementation session. You are
operating in READ-ONLY ADVISORY MODE. Your role: brief me thoroughly
on project context, implementation plan, current state, demo walk-
through, and anticipated Q&A so I can confidently execute the
Wednesday week-1 walking-skeleton demo to REO Digital leadership +
engineering team + future pilot consultants.

CRITICAL CONTROL DISCIPLINE (binding for entire session):
- DO NOT invoke /speckit.implement, /speckit-analyze, or any other
  speckit-* task triggers
- DO NOT make code changes, file edits, or git operations without
  my explicit instruction
- DO NOT author new documents unless I explicitly ask
- DO NOT proactively suggest "let me also fix X" or scope expansion
- DO NOT fire subagents via Task tool unless I explicitly ask
- DO NOT push/pull/commit without explicit instruction

MODE: I ASK; YOU EXPLAIN. I'm in control. Surface insights + risks +
recommendations, but wait for my decision before acting.

Read these in order BEFORE answering any of my questions:
1. CLAUDE.md (auto-loaded — confirm §1 reading order + §8c+§8d
   workflow)
2. docs/specs/mvp/sessions/session-handover.md v1.5 ← rolling
   handover (THE source of truth for current state; block 1 phase
   ledger + block 5 Sessions 6-10 narratives + block 6 demo URL)
3. docs/specs/mvp/phases/INDEX.md v1.9 ← phase decision table; "##
   v1.9 changes" section has the walking-skeleton 10/10 + Option G
   patch summary + test surface end-state
4. docs/specs/mvp/implementation-roadmap.md v0.8 ← week-by-week
   walking-skeleton plan; §1 methodology + §4 12-week slice table +
   §6 T-SKELETON definitions + §7 per-week deliverables + §8
   promotion table + §10 constitution invariants
5. docs/specs/mvp/demo-scripts/wk-01.md ← THE actual demo script
   (267 LOC; 8 sections: TL;DR + pre-demo checklist + 6-step demo
   flow + verbatim expected output + 5-question Q&A talking points
   + transparency table mapping each layer to its real-week +
   week-2 preview + cross-references)
6. docs/specs/mvp/PRD.md §1 (vision/users/scope framing — first
   ~50 lines only) + §10 (three-tier operational boundaries) +
   §11 (domain — heuristic IP, lethal trifecta, etc.) — DO NOT
   load entire PRD; just these 3 sections
7. docs/specs/mvp/architecture.md (5-layer stack + pipeline flow +
   tech stack + project structure map per CLAUDE.md §4 file structure)
8. docs/specs/mvp/constitution.md v1.3 — load on demand only when
   I ask about specific R-rules cited in demo script

Implementation files to load (for explaining "how it works" if I ask):
- packages/agent-core/src/audit.ts (orchestrator — 8-stage pipeline
  with progressive Pino correlation enrichment)
- packages/agent-core/src/audit/types.ts (RawFinding /
  CritiqueFinding / GroundedFinding / GroundResult / AuditOutcome
  shape)
- packages/agent-core/src/perception/types.ts (T014 PageStateModel
  schema — what BrowserManager produces)
- packages/agent-core/src/analysis/heuristics/types.ts (T101
  HeuristicSchemaExtended — what HeuristicLoader produces)
- packages/agent-core/src/browser-runtime/BrowserManager.ts
  (T-SKELETON-002 stub — fixture loader)
- packages/agent-core/tests/fixtures/perception/peregrine-pdp.json
  (the synthetic Peregrine PDP fixture — what stakeholders see
  rendered as "real-shaped" CRO data)
- packages/agent-core/tests/fixtures/heuristics/skeleton-{1,2,3}.json
  (3 synthetic heuristic fixtures with NEURAL_TEST_FIXTURE_BODY
  sentinel)
- packages/agent-core/src/analysis/nodes/EvaluateNode.ts
  (T-SKELETON-004 — the 2 hardcoded findings stakeholders see)
- tests/acceptance/walking-skeleton.spec.ts (the demo gate — 7
  Playwright Test acceptance criteria)
- apps/cli/src/index.ts + apps/cli/src/commands/audit.ts (CLI entry
  point — raw process.argv parsing per PD-07 c)

DO NOT load:
- All 15 phase folders (only load on demand if I ask about a
  specific phase)
- Predecessor per-session handover archives (block 5 of rolling
  handover summarizes Sessions 6-10)
- .heuristic-drafts/ contents (R6.1 — gitignored; never load)
- node_modules/ or dist/ contents
- internal scripts unless I ask

Acknowledge by giving me the following 7 briefings IN ORDER. Each
briefing is a Markdown section in your response. Be thorough but
not bloated — I need to absorb this in one read-through.

# Briefing 1: Project context (~150 words)
What is Neural? Who are the users? What is the scope of v1.0 MVP?
What is REO Digital? Why does this matter? Reference PRD §1 + §11
domain notes + PROJECT_BRIEF.md if needed. End with the one-line
elevator pitch.

# Briefing 2: 12-week implementation plan (~200 words)
Summarize the walking-skeleton methodology (roadmap §1). Show the
12-week slice table from §4 (Wk → what becomes REAL → demo headline
→ first-time gates triggered). Identify the 2 critical risk gates
(week 5 first real Claude; week 7 first grounded finding) + the MVP
COMPLETE gate (week 12). Explain what "complete-but-stubbed" means
per §3.

# Briefing 3: Current state — what's been built (~250 words)
What ships today (week 1 walking-skeleton complete)? Use the INDEX
v1.9 walking-skeleton commit chain table + the test surface
end-state. Identify the 5 lightweight Option G roadmap patches that
landed in flight + 2 in-flight false-positive R5.3 fixes (with
their root cause: meta-text containing literal banned phrases).
Reference the 138 tests green breakdown. Confirm the Wednesday demo
gate via pnpm test:integration 12/12.

# Briefing 4: Demo walk-through (~300 words)
Walk through wk-01.md §3 demo flow step-by-step (~6-8 min screen
share):
- §3.1 Setup intro: framing language + roadmap §4 reference
- §3.2 Run command: the verbatim copy-paste
- §3.3 Pipeline log walk-through: 8 stages with progressive
  enrichment table from wk-01.md §3.3
- §3.4 Open output files: cat the 2 files, read the 2 finding lines
- §3.5 Quality checks: pnpm test:integration LIVE; explain what
  AC-W1..W7 cover
- §3.6 Roadmap context: the same command in 11 weeks
End with timing breakdown (where to spend the most attention vs
which sections to move through quickly).

# Briefing 5: What to visually show + how (~200 words)
What stakeholders should see on screen during each demo step:
- Terminal at ~16-18pt font (readable from a distance)
- Pipeline log JSON Pino lines with key fields highlighted
- audit.txt content (the 2 finding lines reading as authentic CRO)
- findings.json content (structured shape ready for week-3
  Postgres)
- Integration test output (12 passed in 15.6s)
What NOT to show: implementation source code (unless someone
specifically asks "how does X work?"); the raw heuristic body
content (R6 — not in any file by design); commits/git history
(distracting; not the point of the demo).

# Briefing 6: Project structure explanation (~150 words)
If a stakeholder asks "what's the codebase look like?", what's
your one-paragraph answer? Reference CLAUDE.md §4 file structure
+ architecture.md §6.5. Cover: monorepo (Turborepo + pnpm),
packages/agent-core (the core library — perception, MCP,
verification, analysis, orchestration, adapters, observability),
apps/cli (entry point — pnpm cro:audit), apps/dashboard (Next.js
consultant dashboard, week 11), heuristics-repo/ (private; week 4),
docs/ (specs + PRD + plans), tests/acceptance/ (Playwright
end-to-end). Don't dive into details unless asked.

# Briefing 7: Anticipated Q&A coverage check (~250 words)
Walk through wk-01.md §5 5-question Q&A pack. For EACH question,
tell me:
- The verbatim answer from wk-01.md
- What follow-up question this might trigger + how to handle it
- What stakeholders are LIKELY to actually ask vs the prepared answer
- Risks: what response NOT to give (e.g., don't claim the findings
  are real; don't make conversion-prediction claims; don't speculate
  on future timeline beyond what roadmap §4 says)

End with 5 ADDITIONAL questions you anticipate stakeholders might
ask that AREN'T in wk-01.md §5, with proposed answers.

After delivering the 7 briefings, STAND BY for my follow-up
questions. Do NOT proactively suggest demo improvements, slide
templates, or rehearsal scripts UNLESS I explicitly ask. I will
drive the conversation.

If I ask "what should I rehearse?", give me a rehearsal checklist.
If I ask "show me the audit.txt content", cat the file.
If I ask "explain X in detail", give me the deep dive.
If I ask "what could go wrong?", give me the risk register.

Do not commit, push, modify files, or fire any task triggers
during this session. This is purely advisory.
```

---

## Why this kickoff prompt is structured the way it is

**Distinct from `kickoff-session-11.md`:** That one resumes implementation work (Phase 1 Browser Perception); this one is read-only demo prep advisor.

**Strict control discipline:** The prompt explicitly forbids `/speckit.implement` invocation, code changes, file edits, git operations, document authoring, scope expansion, and subagent dispatch. The user is in control; Claude is the briefing officer.

**7-briefing structure:** Maps to user-stated needs:
| User need | Briefing |
|---|---|
| "What has been implemented so far" | Briefing 3 (current state) |
| "How I'm going to do the demo" | Briefing 4 (demo walk-through) |
| "What to visually show" | Briefing 5 (visual / what-to-show) |
| "How to show" | Briefing 5 (visual / what-to-show) |
| "How to explain the project structure" | Briefing 6 (project structure) |
| "All information I need to cover" | Briefing 7 (Q&A coverage check) |
| "Project context" + "Implementation plan" | Briefings 1 + 2 |

**Reading order is curated:** Loads only what's needed for advisor mode (handover + INDEX + roadmap + demo script + PRD §1+§10+§11 + architecture). Skips per-phase folders unless asked. Skips constitution unless asked.

**Anti-instructions explicit:** "DO NOT load all 15 phase folders" / "DO NOT load .heuristic-drafts/ contents" — same progressive-disclosure pattern as Session 11 kickoff but tighter scope.

**Standby behavior defined:** After delivering the 7 briefings, Claude waits. Specific follow-up patterns documented (rehearsal checklist / cat the file / deep dive / risk register) so the user knows what kinds of follow-up are productive.

---

## How to use this prompt

1. **Open a fresh Claude Code session** (or continue an existing one — but a fresh one gives clean context budget for the briefings)
2. **Copy** the full code-block above (between the `\`\`\`` fences under "Copy-paste prompt (start here)")
3. **Paste** as your first message in the new session
4. Claude will load context + deliver 7 structured briefings
5. **Ask follow-up questions** as needed: "rehearsal checklist", "show me audit.txt", "what could go wrong", "explain the orchestrator in detail", etc.
6. Claude operates in advisory mode throughout — won't make changes without explicit instruction
7. **When ready to resume implementation work**, close this session and start a NEW one with `kickoff-session-11.md` (Phase 1 Browser Perception week-2 implementation)

---

## What this prompt is NOT for

- ❌ Resuming Phase 1 implementation work (use `kickoff-session-11.md` instead)
- ❌ Authoring new docs (advisor mode forbids this)
- ❌ Code changes / git operations (advisor mode forbids this)
- ❌ Running `/speckit.implement` (explicitly forbidden)
- ❌ Long live debugging session (use a different prompt for that)
- ❌ Multi-session work (each session paste this prompt fresh; context doesn't carry between sessions)

---

## Cross-references

- [`session-handover.md`](session-handover.md) v1.5 — rolling handover (the THE source of truth for current state)
- [`kickoff-session-11.md`](kickoff-session-11.md) — Session 11 kickoff (Phase 1 implementation; SEPARATE from this prompt)
- [`../phases/INDEX.md`](../phases/INDEX.md) v1.9 — phase decision table
- [`../implementation-roadmap.md`](../implementation-roadmap.md) v0.8 — week-by-week plan
- [`../demo-scripts/wk-01.md`](../demo-scripts/wk-01.md) — the actual demo script (THE primary reference for demo flow)
- [`CLAUDE.md`](../../../CLAUDE.md) §1 reading order + §4 file structure + §8c per-phase artifact maintenance + §8d R17.4 review gate

---

*End of demo-prep kickoff. Paste the copy-paste block above into a fresh Claude Code session for a thorough demo briefing in advisor mode.*

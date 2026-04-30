# Delegation Matrix + Comprehension-Debt Pacing

**Source:** `docs/engineering-practices/ai-orchestration-research-2026-04-24.md` §Part 1 §4 (coding-agents-manager), §6 (cognitive-parallel-agents).

## Delegation matrix

Three buckets. Pick ONE per task BEFORE starting.

### Bucket 1 — Fully delegate

**Delegate to:** Subagent via Agent tool. Minimal supervision. Review diff + conformance test, ship.

**Criteria (ALL must be true):**
- Single file or single module
- No shared-contract touches (R20 bar not met)
- No LLM prompt edits
- No IP / heuristic-content touches (R6)
- No auth / payments / secrets / untrusted-input touches
- Acceptance criteria are fully testable (conformance test exists or can be written)
- Estimated < 2 hours

**Neural examples:**
- Implementing a single grounding rule (GR-NNN) from its spec
- Adding a Zod schema for one new type
- Writing a Drizzle migration for a non-RLS-changing column
- Unit tests for an existing pure function

**Review bar:** diff review + conformance test. No deep walkthrough.

### Bucket 2 — Delegate with checkpoints

**Delegate to:** Subagent with frequent check-ins. Partial supervision. Escalate at kill criteria.

**Criteria (ANY one of):**
- Touches 2–3 files OR a cross-cutting pattern
- Single shared-contract touch (requires `impact.md` per R20)
- LLM prompt edit in one node
- New grounding rule that adds a banned-phrase category (e.g., GR-007 category expansion)

**Neural examples:**
- Integrating a new grounding rule into `EvidenceGrounder`
- Adding a new MCP tool
- Adding a new node to `AuditGraph`
- Introducing a new adapter for an existing category

**Review bar:** Checkpoint after test authoring, after first implementation pass, after conformance verification. Escalate at any R23 kill criterion.

### Bucket 3 — Retain ownership

**Delegate to:** Nobody. You own the work with Claude Code as a writing aid, not implementer.

**Always retained:**
- Architecture decisions (new layer, new adapter category)
- Cross-cutting refactors (renaming across > 3 modules)
- Product decisions (what the feature does)
- Security-critical design (auth, RLS, secret handling)
- Heuristic content authoring (R6 IP protection — never to a subagent)
- Constitution amendments (R22 requires deliberate rule-add with provenance)
- Impact analyses (R20 — human judgment about risk)
- Reproducibility-snapshot schema changes (R10 — any drift is load-bearing)

**Neural examples:**
- Architecture decisions like the perception layer v2.4/v2.5 envelope (Phase 1b/1c) or context capture layer v3.0 (Phase 4b)
- Designing the two-store pattern (§24 / Phase 9 AccessModeMiddleware)
- Authoring a new heuristic with benchmark + provenance (R15.3.1 / Phase 0b)
- Writing a Constitution rule (R22.2 provenance required)
- Any change touching shared contracts listed in R20 (AuditState, Finding lifecycle, AnalyzePerception, adapter interfaces, DB schema, MCP tool interfaces, grounding rule interfaces)

**Review bar:** You wrote it. Nothing to review from a subagent.

## Comprehension-debt pacing

Core insight (cognitive-parallel-agents): *"Your cognitive bandwidth doesn't parallelize. The agent generates, you still evaluate."*

Gate parallel dispatch on REVIEW capacity, not on task independence.

### Pre-dispatch checklist (before spawning N subagents)

Answer in order. If any is "no" → reduce N before dispatching.

- [ ] Can I summarize what each of the N subagents is doing in one sentence right now?
- [ ] Do I have ≥ 30 min of uninterrupted review time available per round?
- [ ] Are the N tasks independent enough that their diffs won't need cross-referencing during review?
- [ ] Am I within the 3–5 agent realistic ceiling?
- [ ] Have I completed review of the PREVIOUS dispatch round, or am I still sitting on unreviewed diffs?

**Rule:** Unreviewed prior diffs count against the ceiling. If 2 are dispatched and unreviewed, effective ceiling for NEW dispatch is 3 − 2 = 1.

### Signals to reduce parallel dispatch

| Signal | Meaning | Fix |
|---|---|---|
| Review time > implementation time per diff | Agents outpacing me | Reduce count OR reduce scope per agent |
| Same review comment repeats across 3+ diffs (e.g., "missing error handling") | Systemic issue, not per-agent | Add the rule to CLAUDE.md or skill BEFORE the next dispatch |
| Test coverage regresses during parallel work | Pacing is broken | Suspend parallel dispatch until root-caused |
| "Ambient anxiety" — juggling more than reviewing | Capacity exceeded | Stop dispatching; finish reviews |

### Calibration protocol

- **Week 1:** start with 1 subagent at a time. Log review quality.
- **Week 2:** if Week 1 was clean, try 2 parallel.
- **Week 3+:** scale by 1 only after a clean parallel batch.
- **Ceiling:** 3–5 subagents. Do NOT exceed even if you feel you can.

### Scope reduction BEFORE count reduction

When overloaded, reduce SCOPE per agent BEFORE reducing COUNT. Narrow scope = smaller diffs = faster review = less context held.

- **Bad response to overload:** "I'll go from 4 agents to 2, same scope each."
- **Good response:** "I'll keep 4 agents, but each handles half the scope they would have — 4 small diffs instead of 2 medium ones."

Why: context-switching cost per agent is fixed; reducing count forfeits parallelism without reducing the per-agent cognitive load that caused the overload.

### Trust is per-thread, not per-agent

A subagent reliable on `grounding/` may be unreliable on `browser-runtime/`. Do NOT carry trust across domains. Calibrate review rigor per (subagent × domain), not per subagent alone.

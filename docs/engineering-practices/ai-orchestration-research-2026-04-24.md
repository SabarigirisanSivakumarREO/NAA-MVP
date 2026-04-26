---
name: AI-assisted orchestration research synthesis (Apr 2026)
status: validated
version: v1.0
description: Canonical research synthesis from 8 Addy Osmani articles on AI-assisted coding workflows. Source of truth for Constitution R22–R23, PRD §10.9–§10.10, and .claude/skills/neural-dev-workflow/.
researchDate: 2026-04-24
synthesisLevel: meta (how we build Neural) + product (how Neural's own agents orchestrate)
sources:
  - https://addyosmani.com/blog/good-spec/
  - https://addyosmani.com/blog/ai-coding-workflow/
  - https://addyosmani.com/blog/code-review-ai/
  - https://addyosmani.com/blog/coding-agents-manager/
  - https://addyosmani.com/blog/agentic-engineering/
  - https://addyosmani.com/blog/cognitive-parallel-agents/
  - https://addyosmani.com/blog/code-agent-orchestra/
  - https://addyosmani.com/blog/agent-harness-engineering/
consumers:
  - docs/specs/mvp/constitution.md (R22 The Ratchet, R23 Kill Criteria)
  - docs/specs/mvp/PRD.md (§10.9 PR Contract, §10.10 Comprehension-debt pacing)
  - .claude/skills/neural-dev-workflow/
---

# Addy Osmani AI-Coding Workflow Research Synthesis

> **Role:** The Ratchet (Constitution R22) requires every rule to trace to a specific failure, research finding, or observed AI-system mistake. This document is that trace for the v1.2 additions (Constitution R22–R23 + PRD §10.9–§10.10 + `.claude/skills/neural-dev-workflow/`). Any future rule derived from this corpus must cite a specific part of this file.
>
> **Project context:** Neural is an AI CRO audit platform at 0% implementation, 12-week MVP. TypeScript 5 + Node 22 + Turborepo + pnpm + Playwright + LangGraph.js + Claude Sonnet 4 + Postgres 16 + Next.js 15. Neural is itself a multi-agent system (browser agent + analysis agent with CoT → self-critique → 12 grounding rules), so these insights operate at two levels: META (how we build Neural with Claude Code) and PRODUCT (how Neural's own internal agents should be architected).

---

## Part 1 — Per-URL brief

### 1. good-spec (coverage check only, ~200 words)

Comparing Addy's spec-writing framework against the 11 PRD v1.1 improvements already absorbed:

| PRD v1.1 item | Addy concept | Already absorbed? |
|---|---|---|
| §6.5 project structure map | "Project Structure — Explicit paths" | Yes |
| §8.0 quick command reference | "Commands — Full executable commands with flags" | Yes |
| §9.6 conformance test suite | "Conformance Testing — Language-independent YAML tests" | Yes |
| §10.6 agent self-verification | "Compare result with spec, list unaddressed items" | Yes |
| §10.7 modular prompt rule | "Curse of instructions >10 requirements; one task focus" | Yes |
| §10.8 reasoning log | "LLM-as-a-Judge; domain knowledge injection" | Partial |
| §11.4 code style w/ examples | "One real code snippet beats paragraphs" | Yes |
| §11.5 git workflow | "Branch naming, commit format, PR requirements" | Yes |
| §12.5 context management/RAG | "RAG, MCP, Context7 auto-fetch" | Yes |
| §15.2 lethal trifecta | "Speed outpaces review; non-determinism; cost pressure" | Yes |
| §15.3 fallback protocols | (Implicit in iterate & evolve phase) | Partial |

**Net-new items not yet absorbed:**
- **Extended TOC/summaries pattern** — a condensed outline with reference tags that lives in system prompt while detailed sections load on-demand. Distinct from RAG; acts as a mental map. Could refine §12.5.
- **"Kill session to clear context when switching major features"** as an explicit rule, separate from modular-prompt. Not sure PRD §10.7 names this as its own directive.
- **"Cheaper models for drafts; reserve top-tier for critical steps"** — a named cost-tiering tactic. PRD talks budgets but not model-tier rotation.

Otherwise, coverage is solid.

---

### 2. ai-coding-workflow

**Thesis:** Treat AI coding as a disciplined Plan → Specify → Chunk → Generate → Test → Review → Commit loop with the human as director, not a free-form "vibe" session.

**Tactics:**
- **Waterfall in 15 minutes** — compress upfront planning into a brief spec-brainstorm session before any code generation **[META]**
- **Context Packing** — load entire repos, MCPs (Context7), API docs, and "brain dumps" of constraints upfront **[META]**
- **Model Musical Chairs** — swap LLMs when one gets stuck; run same prompt across models for triangulation **[META]**
- **Save Points Strategy** — treat commits as game-style save points; ultra-granular version control with branches/worktrees for experiments **[META]**
- **Behavioral Customization via CLAUDE.md / GEMINI.md** — style guides, in-line examples to prime format, "no hallucination" clauses **[META]** (already present)
- **Automation Integration** — feed linter/typecheck/CI output back to AI for correction **[META]**
- **Test after each increment, not at the end** — debug failures immediately **[META + PRODUCT]** (TDD-aligned with R3)
- **Never commit code you cannot explain** — accountability clause **[META]**

**Notable quotes:** "difficult and unintuitive"; "over-confident and prone to mistakes"; "stay alert, test often, review always. It's still your codebase."

**Contradictions:** None. Fully compatible with R3 (TDD) and R11 (spec-first). "Model Musical Chairs" is *tension*, not contradiction, with R10 temperature=0 — swapping models mid-task could complicate reproducibility but applies to META-level code generation for Neural itself, not to Neural's production LLM calls.

---

### 3. code-review-ai

**Thesis:** AI-generated code needs a structured PR contract, proof-based shipping, and human review focused on what AI systematically misses (security, duplication, institutional context).

**Tactics:**
- **PR Contract (named framework)** — every PR states (1) what/why in 1-2 sentences, (2) proof it works (tests/screenshots/logs), (3) risk tier + which parts were AI-generated, (4) review focus areas **[META]**
- **Proof-based shipping** — "new tests OR a demo of the change working" gate before merge **[META]**
- **Multi-model reviews** — run diffs through Claude + Gemini + GPT to catch single-model bias **[META]**
- **PR bot + static analysis pairing** — combine AI flagging with Snyk/equivalent **[META]**
- **Stackable commits** — break large agent output into digestible incremental commits; no mega-PRs **[META]**
- **High coverage gate (>70%)** as merge requirement **[META]**
- **Human reviewer checklist focus** — security holes (auth/payments/secrets/untrusted input), code duplication, maintainability, roadmap alignment, knowledge-transfer ("can the author explain it?") **[META]**
- **Lethal-trifecta rule** — "code touching auth, payments, secrets, or untrusted input: treat AI as high-speed intern, require human threat model + security tool pass" **[META + PRODUCT]**

**Notable quotes:** *"A computer can never be held accountable. That's your job as the human in the loop."*; *"Your job is to deliver code you have proven to work."*

**Contradictions:** None. Reinforces §10.6 self-verification and R3 TDD. PR Contract overlaps with but extends PRD §10.8 reasoning log.

---

### 4. coding-agents-manager

**Thesis:** At scale, AI coding stops being a prompting problem and becomes a management problem; four classic management skills (scoping, delegation, verification, async check-ins) transfer directly.

**Tactics:**
- **Two-mode mental model** — local human-in-the-loop sessions (architecture, nuance) vs. async cloud/background sessions (bounded tasks) **[META]**
- **Brief Format for task scoping** — Outcome, Context, Constraints, Non-goals, Acceptance criteria, Integration notes, Verification plan **[META]**
- **AGENTS.md as durable institutional memory** — lint rules, test requirements, dependency policies, documentation standards **[META]** (Neural's CLAUDE.md already plays this role)
- **Three-part delegation split** — fully delegate / delegate with checkpoints / retain ownership. Retained items: architecture, cross-cutting refactors, product decisions, security-critical design **[META]**
- **Two-Agent Verification pattern** — Agent A implements, Agent B reviews for correctness/style/edges/missed tests, Agent A applies feedback **[META + PRODUCT]** (mirrors Neural's evaluate → self-critique in §07)
- **PR packet structure** — summary, approach rationale, affected files, test plan w/ results, risks, follow-ups **[META]**
- **Async check-in protocol** — "report blockers if no progress in 15 min; format = what changed / next / risks / needs" **[META]**
- **One agent owns one PR** — no mega-PRs from multiple agents **[META]**
- **Git worktrees** for per-agent isolated working directories **[META]**
- **Kill criteria defined before starting** — what would cause you to stop **[META + PRODUCT]**
- **WIP limits: 4-5 background agents + 3-5 local sessions** as realistic sweet spot **[META]**

**Notable quotes:** *"You're no longer pairing with a single agent. You're running a small team."*; *"AI coding at scale stops being a prompting problem and becomes a management problem."*

**Contradictions:** None. Fully compatible with Neural's subagent dispatch policy (CLAUDE.md §9).

---

### 5. agentic-engineering

**Thesis:** Professional "agentic engineering" (AI implements, human owns architecture/quality) is distinct from "vibe coding"; spec discipline and testing are the differentiators, and AI rewards *more* fundamentals, not fewer.

**Tactics:**
- **Vibe coding is legitimate only for** greenfield MVPs, personal scripts, learning, creative brainstorming **[META]**
- **Spec-first workflow** — "better specs yield better AI output" **[META + PRODUCT]**
- **Comprehensive testing as primary differentiator** from vibe coding **[META]**
- **Code comprehension gate** — "If you can't explain what a module does, it doesn't go in" **[META]**
- **Architecture discipline reduces AI hallucinations** — clean architecture + clear boundaries is a hallucination-prevention measure **[META + PRODUCT]**

**Notable quotes:** *"This isn't engineering, it's hoping."*; *"AI-assisted development actually rewards good engineering practices more than traditional coding does."*; *"The fundamentals matter more, not less."*

**Contradictions:** None. This article is the philosophical framing Neural's Constitution already embodies.

*Note: WebFetch summary was lean for this article — likely because the piece is largely framing/definitional rather than tactic-dense. The five above are what came through cleanly.*

---

### 6. cognitive-parallel-agents

**Thesis:** Your cognitive bandwidth does not parallelize — the agent generates, you still evaluate; manage parallel agent work by review capacity, not by how many agents you *could* spawn.

**Tactics:**
- **Conductor metaphor** — hold the whole piece, not play individual instruments **[META]**
- **Comprehension Debt (named concept)** — compounds across parallel threads when agents generate faster than humans can understand **[META]**
- **Time-boxed sessions** per thread; ~30 minutes per thread suggested **[META]**
- **Scope-per-thread sizing matched to review capacity** (not agent count) **[META]**
- **Ambient anxiety monitoring** — background vigilance across threads is a real capacity signal; track it **[META]**
- **Trust calibration per thread** — separate, dynamic trust assessments **[META]**
- **Checkpoint enforcement via time-boxing** to prevent quiet drift **[META]**
- **"Start with one thread less than feels necessary"** to stay calibrated rather than reactive **[META]**
- **Monitor review quality, not agent count** as honest capacity signal **[META]**
- **Reduce scope before reducing agent count** to lower per-thread overhead **[META]**

**Notable quotes:** *"Your cognitive bandwidth doesn't parallelize. The agent does the generating. You still do all the evaluating."*; *"The ceiling isn't a personal failure. We have bounded working memory, real context switching costs, and finite vigilance."*

**Contradictions:** None. Adds nuance absent from Neural's CLAUDE.md §9 (dispatch policy says *when* but not *how to pace*).

---

### 7. code-agent-orchestra

**Thesis:** Shift from single-agent "conductor" to multi-agent "orchestrator"; the bottleneck moves from generation to verification, and you're building the factory that builds the software.

**Tactics:**
- **3-5 focused teammates as sweet spot** — token costs scale linearly **[META]**
- **One agent per file** to eliminate merge conflicts; git worktrees + file locking **[META]**
- **`MAX_ITERATIONS=8`** forced reflection before retry **[META + PRODUCT]**
- **Multi-model routing** — cheaper models for planning, expensive for implementation **[META]**
- **Context reset between atomic tasks** to avoid confusion accumulation **[META + PRODUCT]**
- **AGENTS.md is human-curated — never auto-generated** — research cited: human-curated ~4% improvement; machine-generated no benefit & ~3% regression **[META]**
- **REFLECTION.md proposals** after task completion for systematic learning **[META]**
- **Named roles**: Team Lead/Orchestrator, Data Layer Agent, Business Logic Agent, API Routes Agent, Frontend Agent, Test Agent, @Reviewer (Opus 4.6 read-only, 1 per 3-4 builders), Feature Leads (hierarchical) **[META]**
- **Four orchestration patterns**: Subagents (simple delegation, manual deps), Agent Teams (shared task list + file locking + peer messaging), Hierarchical Subagents (teams of teams), **Ralph Loop** (Pick→Implement→Validate→Commit→Reset stateless iteration) **[META + PRODUCT]**
- **Plan Approval gate** — "far cheaper to fix a bad plan than bad code" **[META]**
- **Hooks system** — `TaskCompleted` runs lint/tests; `TeammateIdle` verifies tests pass before stop **[META]**
- **Per-agent token budgeting** with auto-pause at 85% **[META + PRODUCT]**
- **Kill & reassign after 3+ iterations on same error** **[META + PRODUCT]**
- **Peer-messaging protocol** — backend→frontend API-contract handoffs bypass team lead **[PRODUCT]**
- **Dependency declaration + auto-unblock** — blocked tasks flip to pending when deps complete **[META + PRODUCT]**
- **Spec as leverage** — "a vague spec multiplies errors across the fleet" **[META + PRODUCT]**
- **Six-step factory production line**: Plan → Spawn → Monitor → Verify → Integrate → Retro **[META]**

**Notable quotes:** *"The bottleneck is no longer generation. It's verification."*; *"Delegate the tasks, not the judgment."*; *"You're no longer just writing code. You're building the factory that builds your software."*; **"8 Levels of AI-Assisted Coding"** (Steve Yegge framework, referenced).

**Contradictions / tensions:**
- **"Cheaper models for planning, expensive for implementation"** — PRODUCT-side, this would conflict with R10 (temperature=0 on evaluate/self_critique/evaluate_interactive) *only if* Neural swapped model families mid-path and broke reproducibility snapshots. At META level (building Neural), fine.
- Agent Teams pattern (peer messaging, shared task list with file locking) — at PRODUCT level could contradict Neural's current AuditGraph LangGraph.js design which is state-graph-centric, not peer-messaging. Not a rule contradiction; a design-path divergence to flag.

---

### 8. agent-harness-engineering

**Thesis:** **Agent = Model + Harness.** The harness (context mgmt, execution, knowledge, control, coordination layers) often matters more than the model; a decent model with a great harness beats a great model with a bad harness.

**Tactics:**
- **Five-layer harness taxonomy** — Context Mgmt / Execution / Knowledge / Control / Coordination **[BOTH]**
- **Context Management Layer** — system prompts, CLAUDE.md, AGENTS.md, skill files, context compaction, tool-call offloading, progressive skill disclosure **[META + PRODUCT]**
- **Execution Layer** — sandboxed environments with allow-listed commands; pre-installed runtimes **[META]**
- **Knowledge Layer** — filesystem + git for durable state; memory files with continual learning; web search + MCP for beyond-cutoff knowledge **[BOTH]**
- **Control Layer** — hooks/middleware at pre-tool-call, post-edit, pre-commit; permission gates; destructive-action blockers; type-check/lint enforcement **[META + PRODUCT]**
- **Coordination Layer** — subagent spawning, handoffs, planner/generator/evaluator splits, sprint contracts **[PRODUCT]** (matches Neural's analysis pipeline)
- **The Ratchet pattern** — *"Every line in a good AGENTS.md should be traceable back to a specific thing that went wrong."* Rules derive from failure history, not speculation **[META]**
- **Success is silent, failures are verbose** — successful ops produce no feedback; errors get injected into the loop **[BOTH]**
- **Behavior-First Design** — "Work backwards from behaviour you want → harness design that delivers it" **[BOTH]**
- **Long-Horizon Execution** — Ralph Loops, planning files, self-verification loops **[BOTH]**
- **Tool Curation rule** — *"Ten focused tools outperform fifty overlapping ones because the model can hold the menu in its head."* **[PRODUCT]** (directly applies to Neural's 12 MCP tools)
- **Safety mechanisms** — sandbox + network isolation, destructive-command blocklist (`rm -rf`, `git push --force`, `DROP TABLE`), approval gates before PR/main, context injection of security constraints **[BOTH]**
- **Observability patterns** — event buses, background executors, cost/latency metering, session managers, permission gates, trace analysis for harness-level failure identification **[BOTH]**

**Notable quotes:** *"A decent model with a great harness beats a great model with a bad harness."*; *"It's not a model problem. It's a configuration problem."*; *"Every component in a harness encodes an assumption about what the model can't."*

**Contradictions:** None. This is the most directly product-relevant article for Neural.

---

## Part 2 — Cross-article synthesis

### Recurring themes

1. **Spec-as-leverage** — good-spec, ai-coding-workflow, agentic-engineering, code-agent-orchestra. "A vague spec multiplies errors across the fleet." Briefs, PRDs, AGENTS.md are the #1 lever on output quality.
2. **Verification is the bottleneck, not generation** — code-review-ai, cognitive-parallel-agents, code-agent-orchestra. Human review bandwidth is the real constraint; WIP limits, PR contracts, two-agent verification, and gated plan approval all serve this.
3. **Harness > model** — agent-harness-engineering, code-agent-orchestra, coding-agents-manager. Hooks, sandboxes, tool curation, control-layer gates, and memory files are where wins come from.
4. **Human-curated memory, not auto-generated** — code-agent-orchestra (explicitly), agent-harness-engineering (The Ratchet). AGENTS.md/CLAUDE.md must trace to real failures; auto-generated memory *reduces* success rate (~3%).
5. **Management metaphors** — coding-agents-manager (classic mgmt skills), cognitive-parallel-agents (conductor), code-agent-orchestra (factory/orchestra). The engineer-as-manager framing is consistent across the corpus.

### Contradictions between articles

- **Agent count** — code-agent-orchestra says "3-5 teammates sweet spot"; coding-agents-manager says "4-5 background + 3-5 local"; cognitive-parallel-agents says "start with one less than feels necessary." These are compatible if read as "4-5 is ceiling; calibrate down by review capacity."
- **Model routing** — code-agent-orchestra recommends *cheaper* models for planning; good-spec recommends *top-tier* for critical steps. These apply to different steps, but the boundary isn't crisp.

### Unique contributions per article

- **good-spec**: Six Core Areas checklist; three-tier boundary system; conformance testing pattern.
- **ai-coding-workflow**: "Waterfall in 15 minutes"; Model Musical Chairs; Save Points strategy.
- **code-review-ai**: PR Contract framework; lethal-trifecta rule for auth/payments/secrets/untrusted input.
- **coding-agents-manager**: Three-part delegation split; Brief format; two-mode mental model.
- **agentic-engineering**: Vibe-coding vs. agentic-engineering taxonomy; "fundamentals matter more."
- **cognitive-parallel-agents**: Comprehension Debt; ambient anxiety monitoring; review-quality-over-count.
- **code-agent-orchestra**: Ralph Loop; four orchestration patterns; peer-messaging protocol; six-step factory.
- **agent-harness-engineering**: Five-layer harness taxonomy; The Ratchet; Tool Curation rule; Success-is-silent principle.

### 5–10 patterns that would materially improve Neural (ranked by expected impact)

1. **Ralph Loop for long-horizon Neural tasks** (PRODUCT) — Pick→Implement→Validate→Commit→Reset stateless iteration fits Neural's per-page audit flow: analyze→critique→ground→annotate→reset. Also fits META for multi-task implementation sessions.
2. **The Ratchet principle for CLAUDE.md evolution** (META) — every rule must trace to a specific failure. Would convert Constitution R1-R21 into a living audit trail and prevent rule-bloat in CLAUDE.md.
3. **Tool Curation: 12 MCP tools is near ceiling** (PRODUCT) — *"ten focused tools outperform fifty"* — validates Neural's 12-tool MCP server cap; consider pruning any overlaps before v1.1 adds more.
4. **Two-Agent Verification formalized** (PRODUCT + META) — mirrors Neural's evaluate→self-critique but Addy's framing of A→B→A feedback loop could tighten the self-critique node (§07.9).
5. **Plan Approval gate before implementation** (META) — already in spec-driven flow but Addy makes the cost argument sharper ("far cheaper to fix bad plan"); promote Plan Mode / `/speckit.plan` approval to an explicit gate in CLAUDE.md §10.
6. **Per-agent token budget with 85% auto-pause** (BOTH) — Neural has $15/$5/$0.50 audit caps; add per-node/per-agent mid-task pause at 85% of budget to prevent runaway spend during single runs.
7. **Hierarchical Subagents for Phase work** (META) — spawning feature-leads rather than six individual task agents; reduces orchestrator context load during Phase 7/8 implementation.
8. **Review-quality-over-count pacing** (META) — add explicit "comprehension debt" check to §9 dispatch policy; gate parallel dispatch on reviewer bandwidth not task independence alone.
9. **Extended TOC/summaries in system prompt** (META) — tighten §12.5 RAG rules: keep condensed outline with reference tags in system prompt; load detail on-demand.
10. **PR Contract format for Neural PRs** (META) — extend PRD §10.6/§10.8 to require the 4-line PR Contract (what/why, proof, risk+AI role, review focus) in every PR body.

---

## Part 3 — Gap analysis vs Neural's current setup

### What Addy recommends that Neural doesn't yet have

- **Ralph Loop as a named pattern** — neither META nor PRODUCT. Neural's analysis pipeline is close but not explicitly framed as stateless iteration w/ context reset.
- **"The Ratchet" traceability for rules** — CLAUDE.md / Constitution rules aren't currently tagged with the failure that produced them.
- **Comprehension-debt pacing** — §9 dispatch policy says when to parallelize but not how to pace by review capacity.
- **Model-tier routing** — Neural is Claude-only in MVP (GPT-4o deferred to v1.2); no tier split between planning and implementation.
- **PR Contract block** in PR template (partial — §10.8 reasoning log overlaps but isn't the 4-line format).
- **Per-node token auto-pause** at 85% — Neural has audit-level caps but not mid-run auto-pause.
- **Two-Agent Verification as named pattern** — Neural's §07.9 self-critique is close but framed as same-agent self-review; Addy's Agent-A / Agent-B split is distinct and stronger.
- **Kill criteria defined pre-task** — not in CLAUDE.md; `tasks-v2.md` has acceptance criteria but not stop-loss.
- **REFLECTION.md / retro-update loop** — Neural has phase rollups (R19) but not per-task reflection proposals.
- **Hooks at pre-tool-call / post-edit / pre-commit** — not in current harness beyond Spec Kit and standard git hooks.
- **Success-is-silent / failures-verbose** pattern — Pino logging exists but this inversion (errors injected back into loop) isn't explicit.

### What Neural has that Addy doesn't cover (places we're ahead)

- **R10 temperature=0 reproducibility discipline** — Addy never addresses determinism/reproducibility at this rigor.
- **R6 IP/heuristic-content protection** — not addressed in any article.
- **Grounding rules GR-001..GR-012 with domain-specific evidence checks** — Addy talks about self-check but nothing as formalized.
- **GR-007 ban on conversion predictions** and specific banned-phrase detection — no parallel.
- **Impact-before-implementation rule (R20)** — explicit contract-change gate; Addy's Plan Approval is weaker.
- **Spec lifecycle states (R17: validated/approved/implemented/verified/superseded/archived)** — more rigorous than anything in Addy's framework.
- **Append-only audit tables (R7.4)** — compliance-grade, not addressed.
- **Adapter pattern as hard rule (R9)** — Addy's harness layers imply but don't formalize.
- **REQ-ID traceability matrix** — Addy's AGENTS.md is informal; Neural's traceability is enforced.
- **Cost accountability per-client via `llm_call_log`** — more granular than Addy's "monitor token usage."

### Judgment calls needed (Addy advice vs. Constitution)

1. **Multi-model / Model Musical Chairs vs. R10 temperature=0**
   - META-level (building Neural): harmless; swap LLMs freely.
   - PRODUCT-level (Neural's own LLM calls): contradicts R10 if applied to evaluate/self_critique/evaluate_interactive. **Verdict: allow at META, forbid at PRODUCT for the 3 named nodes; reproducibility snapshots would break otherwise.**

2. **Cheaper models for planning vs. top-tier for critical** vs. MVP Claude-only posture
   - PRD explicitly defers GPT-4o fallback to v1.2. **Verdict: revisit at v1.2; keep MVP Claude-only; log this as a v1.2 design input.**

3. **Peer-messaging between agents** (code-agent-orchestra) vs. Neural's LangGraph.js state-graph design
   - Neural's AuditGraph is a deterministic state graph with typed transitions — not peer messaging. **Verdict: don't retrofit; LangGraph checkpointing is Neural's coordination story. Peer-messaging doesn't fit.**

4. **"Never commit code you cannot explain"** vs. sub-agent dispatch policy
   - Our §9 policy dispatches parallel agents whose diffs must still be reviewable. **Verdict: reinforces current policy; no conflict. Consider adding this as explicit rule in CLAUDE.md §9 review-after-dispatch.**

5. **AGENTS.md never auto-generated** vs. Spec Kit CLI regenerating plan.md / tasks.md from PRD
   - Spec Kit artifacts *are* auto-generated. Addy's rule is about institutional memory (CLAUDE.md), not generated specs. **Verdict: no conflict; CLAUDE.md stays hand-edited, Spec Kit outputs stay generated.**

6. **Ralph Loop's stateless reset** vs. Neural's LangGraph checkpointing
   - Partially compatible — LangGraph checkpoints *are* state-reset points. **Verdict: frame LangGraph nodes as Ralph-Loop stations for consistent mental model; no implementation change needed.**

7. **3-5 agent sweet spot** vs. CLAUDE.md §9 (no agent-count cap)
   - Neural doesn't cap parallel dispatch explicitly. **Verdict: judgment call for orchestrator — consider adding "review-capacity pacing" guidance to §9, defer to orchestrator not rules.**

---

### Honest gaps / WebFetch concerns

- **agentic-engineering** returned a lean summary (5 tactics vs. 8-15 for others). The article is likely heavier on framing/definition than on concrete tactics, but the research agent may have undercounted actionable items. Flagged as "WebFetch summary possibly shallow" rather than fabricating more tactics.
- All other 7 URLs returned rich, tactic-dense summaries that match the article genre. Confidence on those is high.

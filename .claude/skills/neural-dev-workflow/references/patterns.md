# Core Patterns

**Source:** `docs/engineering-practices/ai-orchestration-research-2026-04-24.md` §Part 1 §7 (code-agent-orchestra), §4 (coding-agents-manager), §8 (agent-harness-engineering).

## Ralph Loop

**Pattern:** Pick → Implement → Validate → Commit → **Reset**.

Stateless iteration. After Commit, explicitly reset context before picking the next item. Prevents confusion accumulation across iterations.

### How Neural uses it — META (how we build Neural)

For implementation sessions spanning multiple Phase tasks:

1. **Pick** — one task from `tasks.md` per loop iteration. Never more. (PRD §10.7)
2. **Implement** — test first (R3), then implement, then self-verify (PRD §10.6)
3. **Validate** — `pnpm lint && pnpm typecheck && pnpm test && pnpm test:conformance -- <component>`
4. **Commit** — per PRD §11.5.2 format with TaskID + REQ-ID
5. **Reset** — close the conversation, start fresh for the next task. Do not carry prior context.

### How Neural uses it — PRODUCT (how Neural's own agents orchestrate)

Neural's per-page audit pipeline already implements a Ralph-Loop shape:

```
page_router.pick(queue)
  → browse (navigate + dismiss + stabilize + capture)
  → deep_perceive → quality_gate
  → evaluate → self_critique → ground → annotate → store
  → [COMMIT to findings / rejected_findings]
  → [RESET: next page starts fresh; AnalyzePerception is not carried over]
  → back to page_router
```

LangGraph checkpointing IS the Reset. No implementation change needed — use this mental model to keep the node graph disciplined.

### When to drop Ralph Loop

Tasks that genuinely require cross-iteration state (refactors spanning files, dependency upgrades). For these, a dedicated plan document (per `superpowers:writing-plans`) is better than stateless iteration.

---

## Two-Agent Verification

**Pattern:** Agent A implements → Agent B reviews for correctness, style, edges, missed tests → Agent A applies feedback.

Sharpens Neural's existing §07.9 evaluate → self_critique by adding an explicit FEEDBACK return path. Current flow is one-way (accept/revise/downgrade/reject). Addy's A→B→A adds the feedback loop.

### META usage

For any task with > 100 LOC diff:

1. Implement (self or subagent A)
2. Dispatch review subagent B with: the diff + the task spec + Constitution §10.3 NEVER list
3. Review subagent returns categorized findings (critical / suggested / style)
4. Apply critical findings; defer or reject the rest with rationale captured in the PR body

### PRODUCT usage

Neural's self_critique node already plays Agent B. What's missing vs Addy's sharper framing:

- **Feedback loop:** current flow is linear (evaluate → self_critique → ground). A→B→A would let evaluate revise based on critique feedback rather than having grounding simply reject low-quality findings.
- **Captured for future training:** self_critique verdicts are logged but not fed back into evaluate prompt improvements.

Flagged as v1.1 analysis-refinement candidate. Not an MVP blocker.

---

## 85% Token Auto-Pause

**Pattern:** When any budget counter (tokens, dollars, iterations) hits 85% of its allocation, checkpoint state and escalate rather than push through.

Source quote (code-agent-orchestra): *"Per-agent token budgeting with auto-pause at 85%."*

### PRODUCT usage

Neural has audit-level ($15) and page-level ($5) caps but no mid-node pause. Add per-node 85% check at the budget gate:

```typescript
// In LLMAdapter pre-call budget gate:
if (estimatedCost > budgetRemaining * 0.85) {
  // Pause, checkpoint, log, escalate
  throw new BudgetApproachingError({
    node: nodeName,
    estimatedCost,
    budgetRemaining,
    checkpointId: await snapshotState(state),
  });
}
```

R23.2 makes this mandatory for any node with LLM budget > $0.50.

### META usage

When a task's context is approaching 85% of Claude Code's effective context window:

1. Stop mid-task
2. Commit WIP to `wip/` branch
3. Start fresh session, load only essentials to continue
4. Do not fight context-overflow with "maybe one more prompt"

---

## MAX_ITERATIONS=8

**Pattern:** Outer cap on retry loops. If a node hasn't produced stable output in 8 attempts, the problem is structural, not iterative.

### PRODUCT usage

Apply to nodes with internal retry: LLM call retries, browser action verification loops, OverlayDismisser attempts. Codify as a config constant:

```typescript
export const MAX_ITERATIONS = 8; // Outer ceiling; R23 kill criteria triggers earlier (3 retries on same error)
```

### META usage

If Claude Code hits retry 3 on the same error, R23 kill criteria triggers. Don't chase to 8 — that's the outer ceiling, not a target.

---

## Context Reset Between Atomic Tasks

**Pattern:** Reset context between atomic tasks to avoid confusion accumulation.

### META

New chat/session per task (PRD §10.7). Don't carry task N's context into task N+1. Most "Claude just did something weird" moments trace to carried context.

### PRODUCT

LangGraph checkpointing IS the mechanism — nodes reset AuditState at known boundaries (per-page, per-node).

### Signal that reset is needed

Claude Code making decisions based on reasoning from 5 tasks ago that no longer applies. Reset, reload the current task's spec slice, continue.

---

## Success-Is-Silent, Failures-Verbose

**Pattern:** Successful operations produce no feedback; errors get injected back into the loop with context.

Source (agent-harness-engineering): *"Success is silent, failures are verbose."*

### Current state in Neural

Pino logging captures errors structurally, but error-injection-back-into-loop is not formalized. Most nodes log-and-continue; failed grounding results flow to `rejected_findings` but don't feedback into prompts.

### Target state (v1.1 candidate)

- Failed conformance test during dispatch → inject the failure into the next subagent prompt automatically
- GR-XXX grounding rejection → categorize and (in aggregate) feed back to refine evaluate prompt

Flagged for v1.1 harness improvements. Not an MVP blocker.

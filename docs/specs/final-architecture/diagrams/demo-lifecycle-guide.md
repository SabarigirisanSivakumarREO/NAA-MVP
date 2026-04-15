# End-to-End Audit Lifecycle — Node-by-Node Demo Guide

> **Purpose:** Presenter reference for walking through the lifecycle diagram. Every node explained with full context, design rationale, data flow, and anticipated questions.
>
> **How to use:** Open this alongside `demo-walkthrough.html` (Slide 4). Walk through nodes left-to-right, top-to-bottom. Use the Q&A sections when the audience asks.

---

## Phase 1: TRIGGER & INIT (linear, no loops)

---

### Node 1: CLI / Dashboard

**What it does:** The entry point. A consultant clicks "New Audit" in the dashboard or runs `pnpm cro:audit --url https://example.com` from the CLI. This is the only way an audit starts.

**Input:** Human intent (URL to audit, budget, scope)
**Output:** Raw trigger event with auth context

**Design decision:** All 5 trigger channels (CLI, MCP, consultant dashboard, client dashboard, scheduler) converge on a single gateway. The orchestrator is channel-agnostic — it never knows whether the audit was triggered from CLI or dashboard.

**Deterministic?** Yes — routing and auth are pure code.

**Cost:** $0

**MVP channels:** CLI + consultant dashboard only. MCP, client dashboard, scheduler are post-MVP (Phases 10-13).

<details>
<summary><strong>Q&A</strong></summary>

**Q: Why not just let the orchestrator accept raw parameters?**
A: Because every new channel would require modifying the orchestrator. The gateway pattern means adding a scheduler or MCP trigger is a channel adapter change, not an orchestrator rewrite.

**Q: Can a client trigger their own audit?**
A: Post-MVP only, and only if `self_service_audits: true` on their profile. During warm-up, client triggers are disabled. Consultant must run audits during warm-up.

**Q: What about authentication?**
A: CLI uses an API key (env var). Dashboard uses Clerk session. Both resolve to a `(identity_type, identity_id, client_id_set)` tuple. The gateway verifies the requested `client_id` is in the caller's authorized set.
</details>

---

### Node 2: AuditRequest Contract

**What it does:** The gateway normalises the raw trigger into a single typed `AuditRequest` object. This is the ONE contract the orchestrator consumes — regardless of which channel triggered it.

**Input:** Raw trigger event + auth context
**Output:** Validated `AuditRequest` with: target (URL, scope, exclusions), budget (USD cap, runtime cap, max pages), heuristic set (version, overlays), trigger provenance

**Design decision:** A Zod schema validates the request at runtime. Invalid requests fail with structured errors before any audit run is created. This is defense-in-depth — bad input never reaches the orchestrator.

**Deterministic?** Yes — schema validation is pure code.

**Cost:** $0

**Key fields in AuditRequest:**
- `target.root_url` — what to audit
- `budget.max_total_usd` — hard cap ($15 default)
- `budget.max_per_page_usd` — per-page cap ($2 default)
- `scope.state_exploration.policy` — "heuristic_primed_only" / "with_auto_escalation" / "thorough_mode"
- `heuristic_set.base_version` — which heuristic version to use
- `trigger.source` — "cli" / "consultant_dashboard" / etc.

<details>
<summary><strong>Q&A</strong></summary>

**Q: What happens if the URL is unreachable?**
A: A HEAD request is sent with 5s timeout. If it fails, a WARNING is attached to the request — but validation does NOT fail. Some sites block server-side HEAD requests but work fine with a browser. We try anyway.

**Q: Can a consultant override the budget?**
A: Yes, up to the max ($100). The default is $15. Client dashboard triggers use a pre-configured budget that the consultant sets — the client can't raise it.

**Q: What's the idempotency_key for?**
A: Prevents double-submit. If a scheduler fires twice for the same cron slot, the second request returns the existing audit instead of creating a duplicate. 24-hour window.
</details>

---

### Node 3: Reproducibility Snapshot

**What it does:** Before any LLM call or browser action, the system captures a version snapshot of every component that affects the output. This is the foundation of audit defensibility.

**Input:** Current system state (prompt files, model config, heuristic set, normaliser version, etc.)
**Output:** An immutable `reproducibility_snapshots` row in the database

**What gets pinned:**
| Component | Example value | Why pinned |
|---|---|---|
| Evaluate prompt template | `sha256:a1b2c3...` | Prompt change → different findings |
| Critique prompt template | `sha256:d4e5f6...` | Same |
| Evaluate model | `claude-sonnet-4-20260301` | Model version change → different output |
| Evaluate temperature | `0` (enforced) | Non-zero → non-deterministic |
| Heuristic base version | `2.1.0` | Heuristic change → different evaluation |
| Overlay chain hash | `sha256:...` | Brand/client/learned overlays applied |
| Grounding rule set version | `v1.1.0` | Rule change → different rejections |

**Design decision:** The snapshot is IMMUTABLE after creation. A database trigger blocks any UPDATE. Emergency corrections require the `reo_snapshot_admin` role.

**Deterministic?** Yes — SHA256 hashes + config reads.

**Cost:** $0

<details>
<summary><strong>Q&A</strong></summary>

**Q: Why force temperature to 0?**
A: Temperature 0 reduces LLM output variance by ~80% on structured tasks. It doesn't guarantee bit-identical outputs (providers have internal non-determinism), but it makes the system's behavior as reproducible as technically possible.

**Q: What if the model version is retired by the provider?**
A: If a consultant tries to re-run a past audit with pinned versions and the model is unavailable, the re-run FAILS with an explicit error. We never silently substitute a newer model — that would break reproducibility.

**Q: What's the 90% overlap target?**
A: On repeat runs within 24 hours with identical pinned inputs against the same site, at least 90% of findings should match. Below 90% triggers an alert — it's a diagnostic signal, not a failure. The diff explainer attributes differences to versioned inputs or LLM variance.
</details>

---

### Node 4: Load Client + Heuristics

**What it does:** The `audit_setup` node loads the client profile, builds the page queue, and loads + filters the heuristic knowledge base.

**Input:** `AuditRequest` + reproducibility snapshot
**Output:** `AuditState` populated with: `client_profile`, `page_queue[]`, `filtered_heuristics[]`, `audit_run_id`, `warmup_mode_active`

**Sub-steps:**
1. Load client from DB (business_type, config, overlays)
2. Load heuristic KB (100 JSON heuristics, encrypted at rest, decrypted in memory)
3. Build page queue from provided URLs (MVP) or discovery output (post-MVP Phase 8)
4. Create `audit_runs` row with `status = "running"`
5. Read reproducibility snapshot into state
6. Set `warmup_mode_active` from client profile

**Design decision:** Heuristics are filtered PER PAGE later (in the page_router), not globally here. The full KB is loaded once; filtering happens per page based on `page_type + business_type`.

**Deterministic?** Yes — DB reads + config.

**Cost:** $0

<details>
<summary><strong>Q&A</strong></summary>

**Q: How are pages queued in the MVP?**
A: The consultant provides explicit URLs (e.g., homepage, product page, checkout). Post-MVP (Phase 8), template-first discovery automatically identifies key pages and builds the queue.

**Q: How many heuristics per page?**
A: 15-25 after filtering by page type + business type. Hard cap at 30. If the filtered set exceeds 30, it's prioritised by reliability tier (Tier 1 first) then severity.

**Q: What if the client doesn't exist?**
A: Validation in the gateway catches this (Node 2). If it somehow reaches audit_setup, the node fails and the audit is marked `failed: client_not_found`.
</details>

---

## Phase 2: PAGE LOOP (↻ outer loop)

> **This entire block repeats for each page in the queue.** The page_router decides: more pages → re-enter the loop, or all done → exit to post-audit.

---

### ↻ BROWSE ReAct LOOP (inner loop)

> **Repeats until the page is stable.** Confidence ≥ 0.7 or max_steps reached.

---

### Node 5: perceive

**What it does:** Captures the current state of the page — the agent's "eyes." Assembles a PageStateModel from the AX-tree, filtered DOM, interactive element graph, and optional screenshot.

**Input:** Current URL (after navigation or post-action)
**Output:** `page_snapshot: PageStateModel` with: AX-tree nodes, filtered interactive elements, console errors, failed network requests, pending mutations

**Sub-steps:**
1. Extract AX-tree via Playwright `accessibility.snapshot()`
2. Hard filter: remove invisible, disabled, aria-hidden, zero-dimension elements (drops >50%)
3. Soft filter: score remaining elements by relevance to current task, return top 30
4. Check for pending DOM mutations via injected MutationObserver
5. Optionally capture JPEG screenshot (if visual grounding needed)

**Design decision:** AX-tree is PRIMARY perception, not screenshots. AX-tree is cheaper ($0 — no LLM), more precise (structured data vs pixel interpretation), and works on 95% of modern web pages. Screenshots are a FALLBACK for canvas-heavy or image-only pages (Mode C trigger: AX nodes < 10).

**Deterministic?** Yes — Playwright extraction + filtering is pure code.

**Cost:** $0

<details>
<summary><strong>Q&A</strong></summary>

**Q: Why not just use screenshots like Computer Use?**
A: Anthropic Computer Use scores ~22% on OSWorld. Vision-only perception is fragile. AX-tree + screenshot hybrid scores significantly higher because the LLM reasons over structured data, not pixels. We use vision ONLY when the AX-tree is empty (< 10 nodes).

**Q: What's the "soft filter" doing?**
A: Scoring elements by relevance to the current task. If the task is "search for keyboard," search-related elements score higher than footer links. This keeps the context window small — the LLM sees 30 relevant elements, not 500 irrelevant ones.

**Q: How does mutation monitoring work?**
A: We inject a MutationObserver via `page.evaluate()`. After any action, we check `pending_mutations`. If > 0, the verify node waits until mutations settle (pending = 0 or 2s timeout). This handles SPAs where content changes without URL changes.
</details>

---

### Node 6: reason

**What it does:** The LLM's turn. Given the page state and the task, it decides what action to take next. This is where Mode B (Guided Agent) operates.

**Input:** `page_snapshot`, `messages` (conversation history), `task`, `sub_tasks`, `current_step`, `confidence_score`
**Output:** Tool call(s) with `expected_outcome` and `verify_strategy`, OR `is_complete = true`

**What the LLM sees:**
- System prompt with safety constraints + action contract requirement
- Available MCP tools (filtered by current mode)
- Page snapshot (30 relevant elements, not raw HTML)
- Task description
- History of previous actions + results

**What the LLM MUST output for each action:**
1. **Tool call** (e.g., `browser_click({ elementRef: "search-box" })`)
2. **Expected outcome** (e.g., "Search box receives focus, cursor appears")
3. **Verify strategy** (e.g., `{ type: "element_text", selector: "#search", contains: "|" }`)

**Design decision:** The LLM cannot act without declaring HOW to verify the action succeeded. This is the "action contract" — no fire-and-forget. Every action is accountable.

**Deterministic?** NO — this is LLM-driven. This is one of the ~10% of the system where the LLM makes decisions.

**Cost:** ~$0.10 per step (Mode B)

<details>
<summary><strong>Q&A</strong></summary>

**Q: What if the LLM hallucinates a selector?**
A: The verify node catches it. If the LLM says "click element ref XYZ" and XYZ doesn't exist in the AX-tree, verification fails as `structural` → triggers replan or retry.

**Q: What about Mode A (deterministic)?**
A: Mode A replays pre-recorded Playwright workflows with zero LLM calls ($0/step). It's used for known recurring tasks (e.g., daily Amazon extraction). Requires a workflow recipe with >0.9 success rate. Post-MVP (Phase 6 memory system).

**Q: What if the LLM gets stuck in a loop?**
A: Step counter + multiplicative confidence decay. Confidence drops 3% per step naturally. After ~50 steps, it's below threshold. max_steps is also a hard cap (default 50). Both force exit.

**Q: Can the LLM decide to fill a form or make a purchase?**
A: Form submission, purchases, uploads, and downloads are classified as "sensitive" — they require HITL approval. The LLM can REQUEST these actions, but the safety gate blocks execution until a human approves. In MVP, sensitive actions simply fail.
</details>

---

### Node 7: act

**What it does:** Executes the tool call the LLM requested, with human-like behavior (ghost-cursor Bezier mouse paths, Gaussian typing delays, stealth fingerprinting).

**Input:** `messages` with tool calls, `last_action_timestamp`
**Output:** `last_action` record, tool results appended to `messages`, `current_url` updated, `pending_mutations` count

**Safety check (inline for MVP):**
- safe → proceed silently
- caution → log to audit_log, proceed
- sensitive → block (MVP) / HITL (full)
- blocked → terminate immediately

**Rate limiting:** Minimum 2s between actions. Per-domain limits enforced (10/min unknown domains, 30/min trusted).

**Human-like behavior:**
- Mouse: Bezier curves via ghost-cursor (~500ms movement)
- Typing: Gaussian inter-key delays (mean 120ms), 1-2% typo rate with correction
- Scrolling: variable momentum, triggers lazy-load

**Design decision:** Human-like behavior isn't cosmetic — it's anti-detection. Amazon, LinkedIn, and other sites actively detect automation. Without stealth, the agent gets blocked on the first page.

**Deterministic?** The tool execution is deterministic code. The human-like behavior adds controlled randomness (Gaussian noise) but is NOT LLM-driven.

**Cost:** $0 (execution cost is infrastructure, not LLM)

<details>
<summary><strong>Q&A</strong></summary>

**Q: Can the agent bypass CAPTCHAs?**
A: No. CAPTCHAs are detected via the `no_captcha` verify strategy and escalated to HITL. The system pauses, captures a screenshot, and asks the human to solve it. We never attempt to solve CAPTCHAs programmatically.

**Q: What happens with rate limiting?**
A: If the target site returns HTTP 429 or shows a "too many requests" page, the `no_bot_block` verify strategy detects it. The agent pauses 30s, rotates the browser fingerprint, retries once. If blocked again → HITL escalation.

**Q: How does the audit_log work?**
A: Every `caution` and `sensitive` action is logged: session_id, tool_name, URL, parameters, result, timestamp. Append-only. Used for debugging, compliance, and abuse detection.
</details>

---

### Node 8: verify

**What it does:** Checks whether the action actually succeeded by executing the verify strategy declared in the action contract. Mutation-aware — waits for DOM stability before checking.

**Input:** `expected_outcome`, `verify_strategy`, `page_snapshot` (pre-action), `pending_mutations`
**Output:** `verify_result` (success/failure + failure_type), `retry_count`, `confidence_score` (adjusted)

**9 verify strategies:**
| Strategy | What it checks | Example |
|---|---|---|
| url_change | URL matches expected pattern | After clicking "Checkout" → URL contains "/checkout" |
| element_appears | Target element now visible | After search → results container appears |
| element_text | Element contains expected text | After typing → input value matches |
| network_request | XHR/fetch fired | After form submit → POST request detected |
| no_error_banner | No error message appeared | After action → no ".error" element |
| snapshot_diff | DOM changed meaningfully | After sort → ≥5 elements changed |
| custom_js | JS expression evaluates true | After action → `document.title === "Cart"` |
| no_captcha | No CAPTCHA challenge | After navigation → no reCAPTCHA iframe |
| no_bot_block | No bot detection page | After navigation → no "automated access" text |

**Mutation awareness:** If `pending_mutations > 0`, wait up to `mutation_timeout_ms` (2s default) for DOM to settle before checking. This prevents false negatives on SPAs where content loads asynchronously.

**Confidence adjustment (multiplicative):**
- Verify success → confidence × 1.08 (+8%)
- Verify failure → confidence × 0.80 (-20%)
- Retry → confidence × 0.90 (-10%)
- Bot detected → confidence × 0.60 (-40%)

**Design decision:** Multiplicative decay naturally bounds confidence in (0, 1) without clamping. Additive decay (e.g., -0.05/step) would go negative on long tasks.

**Deterministic?** Yes — strategy execution is pure code. No LLM involved.

**Cost:** $0

**After verify, routing:**
- Success → back to perceive (loop continues) OR output (task complete)
- Transient failure + retries left → retry (back to act)
- Structural failure → replan (reflect node, full graph only)
- Blocked/confidence < 0.3 → HITL escalation

<details>
<summary><strong>Q&A</strong></summary>

**Q: What's a "structural" failure?**
A: The page structure is different from what the LLM expected. E.g., the LLM clicked a selector that doesn't exist because the page layout changed. The fix isn't retrying — it's replanning with a fresh perception.

**Q: What if verification passes but the action actually failed?**
A: The verify strategy is only as good as its definition. If the LLM declares a weak strategy (e.g., "no_error_banner" when a more specific check was needed), a false success can occur. This is why the LLM MUST declare the strategy upfront — it forces deliberate verification design.

**Q: How does confidence scoring prevent infinite loops?**
A: Confidence starts at 1.0 and decays 3% per step naturally (× 0.97). After 50 steps without success, confidence is ~0.22 — below the 0.3 HITL threshold. The step counter (max_steps = 50) is also a hard backup.
</details>

---

### Loop exit: Page Stable

**When the browse ReAct loop exits:**
- `is_complete = true` AND `completion_reason = "success"` → page is ready for exploration + analysis
- `is_complete = true` AND `completion_reason = "max_steps"` → timed out → skip to analysis with best-effort perception
- `confidence < 0.3` → HITL escalation (full graph) or fail (MVP)

---

## ↻ ESCALATION LOOP (inner loop, max 1 cycle)

> **This loop exists between state exploration and analysis.** If self-critique flags hidden content, the system re-explores ONCE, then proceeds regardless.

---

### Node 9: Explore States

**What it does:** Reveals content hidden behind interactive UI elements — tabs, accordions, modals, variant selectors, form validation states. Produces a StateGraph of meaningful page states.

**Input:** Stable page (from browse loop), `filtered_heuristics` (with `preferred_states`)
**Output:** `StateGraph` with 1-15 meaningful states, `MultiStatePerception`

**Two-pass model (Q2-R locked ruling):**

#### Pass 1: Heuristic-Primed (always runs, deterministic)

Each filtered heuristic can declare `preferred_states[]` — UI states it needs to see. Example: the Cialdini "social proof" heuristic says `preferred_states: [{ pattern_id: "reviews_tab_open", interaction_hint: { type: "click", target_text_contains: ["Reviews", "Customer ratings"] } }]`.

The explorer:
1. Collects all `preferred_states` from filtered heuristics
2. Deduplicates by pattern_id
3. For each pattern: find element → interact → wait stability → capture perception
4. Self-restoring interactions (tabs, selects) proceed sequentially without restoration
5. Destructive interactions (form submit, navigation) are scheduled LAST

**No LLM involved in Pass 1.** Purely rule-matched.

#### Pass 2: Bounded-Exhaustive (conditional, auto-escalated)

**Triggers:**
- Unexplored disclosure ratio > 50% (many interactive elements not yet clicked)
- `thorough_mode` requested in `AuditRequest.scope`
- Self-critique flagged `hidden_content_suspected` (escalation loop)

**12-rule disclosure library:**
| Rule | What | Cap |
|---|---|---|
| R1 | `<details>/<summary>` | All |
| R2 | Tabs (`role="tab"`) | 5 per tablist |
| R3 | `aria-expanded="false"` buttons | 8 per page |
| R4 | Accordion patterns | 8 per page |
| R5 | Size/variant selectors | 3 (first, mid, last) |
| R6 | Quantity selector | 1 |
| R7 | Dropdown near CTA | 1 |
| R8 | Filter/sort on PLP | 2 |
| R9 | Modal triggers | 3 |
| R10 | Form validation (submit empty) | 1 per form |
| R11 | Cookie banner (dismiss first) | 1 |
| R12 | Chat widget (close first) | 1 |

**LLM fallback:** If Pass 2 rules produce < 3 meaningful states on an interactive page, ONE LLM call suggests 3 additional interactions. The LLM suggests; deterministic code executes.

#### Meaningful-State Detection

After each interaction, compare new state vs parent:
- Text content Jaccard distance > 0.15?
- New interactive elements > 3?
- Above-fold content changed > 10%?
- CTA set changed?

If ANY threshold met → meaningful (keep). Otherwise → discard.

**Caps:** max 15 states per page, max depth 2, max 25 interactions, $0.50 exploration budget, 60s runtime.

**Deterministic?** Pass 1: fully deterministic. Pass 2: rules are deterministic, LLM fallback is 1 call max.

**Cost:** $0.05-0.15 (mostly infrastructure; LLM fallback ~$0.05 if triggered)

<details>
<summary><strong>Q&A</strong></summary>

**Q: Why not just click everything?**
A: State explosion. A product page with 10 variants × 5 tabs × 3 accordions = 150+ states. At $0.05-0.10 per state for analysis, that's $7.50-15 for ONE page. Bounded exploration with meaningful-state detection keeps it to 5-10 states per page.

**Q: What's "meaningful-state detection" preventing?**
A: Clicking a tab that just changes a small icon but doesn't reveal new content. Or selecting a color variant that only changes the product image but nothing CRO-relevant. These are non-meaningful — clicking them wastes time and budget.

**Q: Why is Pass 1 heuristic-primed and not just bounded-exhaustive from the start?**
A: Cost and precision. If the heuristics say "I need to see the Reviews tab," clicking that one tab costs 1 interaction. Running the full 12-rule library might click 15 things. Pass 1 is surgical; Pass 2 is comprehensive. Most pages need only Pass 1.

**Q: What about state restoration — doesn't clicking back break things?**
A: Self-restoring interactions (tabs, dropdowns, accordion toggles) don't need restoration — clicking Tab 2 replaces Tab 1's content automatically. Only destructive interactions (form submit, navigation) need restoration via `browser_go_back()` or `browser_reload()` fallback. Destructive interactions are always scheduled last.

**Q: What's the MultiStatePerception?**
A: The merged evidence view that the Analysis Agent evaluates. It contains the UNION of all CTAs, forms, trust signals, and content across all meaningful states. Every element is tracked back to its source state (state provenance). This way, the analyst sees everything the page can show — not just the default view.
</details>

---

### Node 10: Deep Perceive (MultiState)

**What it does:** Produces the final perception artifact for the Analysis Agent. A single comprehensive page scan returning `AnalyzePerception` — now enriched with multi-state data.

**Input:** Browser page context, StateGraph from exploration
**Output:** `MultiStatePerception` with: `default_state`, `hidden_states[]`, `merged_view`, `state_provenance`

**What `merged_view` contains:**
- All CTAs across all states (deduplicated: text cosine > 0.9 AND bounding box IoU > 0.5 = same element)
- All forms across all states
- All trust signals across all states
- Headings (deduplicated by text)
- Text content with state tags
- Navigation from default state only
- Performance from default state only
- Layout metrics from default state only

**Tool used:** `page_analyze()` — a single Playwright `page.evaluate()` call that collects ALL sections in one DOM traversal. NOT multiple evaluate calls.

**Screenshots:** Viewport + fullpage screenshots captured PER meaningful state and stored in R2.

**Deterministic?** Yes — Playwright extraction + merge logic is pure code.

**Cost:** ~$0.05 (infrastructure only)

<details>
<summary><strong>Q&A</strong></summary>

**Q: Why merge states instead of evaluating heuristics per state?**
A: Token efficiency. 15 heuristics × 5 states = 75 evaluations. 15 heuristics × 1 merged view = 15 evaluations. The merged view gives the LLM a complete picture in one pass.

**Q: How does provenance tracking work?**
A: Every element in the merged view is tagged with the `state_id` of the state that revealed it. If a trust signal only appears in the "Reviews tab" state, its provenance key points to that state. GR-009 uses this to validate that findings cite evidence they can prove exists.

**Q: What if the Analysis Agent is NOT Layer 3 (analysis never touches browser)?**
A: Correct. Deep perceive runs in Layer 2 (Browser Agent Runtime). It produces the `MultiStatePerception` object, which is passed to Layer 3 (Analysis Engine). Layer 3 never imports Playwright or calls browser tools. This is REQ-LAYER-005.
</details>

---

### Node 11: Evaluate (CoT, temp=0)

**What it does:** The core LLM evaluation. The Analysis Agent reads the page data + filtered heuristics and produces raw findings using chain-of-thought reasoning.

**Input:** `MultiStatePerception.merged_view` (page data), `filtered_heuristics` (15-25 heuristics), `page_type`, `business_type`
**Output:** `raw_findings[]` — one per heuristic (violation, pass, or needs_review)

**Prompt structure:**
- **System prompt (static, cached):** "You are a CRO analyst. For each heuristic: OBSERVE → ASSESS → EVIDENCE → SEVERITY. Never predict conversion. Never reference elements not in the data."
- **User message (dynamic, per page):** Page data (headings, CTAs, forms, trust signals, layout, images, navigation, performance) + filtered heuristics as JSON

**For each heuristic, the LLM must output:**
```json
{
  "heuristic_id": "BAY-CHECKOUT-001",
  "status": "violation",
  "observation": "No guest checkout option visible...",
  "assessment": "The checkout page requires account creation...",
  "evidence": {
    "element_ref": "Create Account button",
    "data_point": "ctas[0]",
    "measurement": "no guest checkout CTA in 12 CTAs"
  },
  "severity": "critical",
  "recommendation": "Add a prominent guest checkout option..."
}
```

**Design decision:** Heuristics are injected into the USER MESSAGE, not the system prompt. System prompts are cached by providers (Anthropic caches them). Since heuristics change per page type, putting them in the system prompt would bust the cache every page = slower + more expensive.

**Temperature:** Forced to 0 per REQ-REPRO-001. Runtime guard in the LLMAdapter throws an error if any code tries to set temperature > 0.

**Deterministic?** NO — this is LLM-driven. This is the primary LLM evaluation call.

**Cost:** ~$0.15 (~10,000 input tokens, ~3,000 output tokens)

<details>
<summary><strong>Q&A</strong></summary>

**Q: Why chain-of-thought?**
A: Berkeley CHI 2024 research shows structured reasoning reduces hallucination. By forcing OBSERVE → ASSESS → EVIDENCE → SEVERITY, the LLM must reason through each step rather than jumping to conclusions. This is Layer 1 of our 3-layer hallucination filter.

**Q: What if the LLM returns malformed JSON?**
A: Zod schema validation catches it. Retry up to 2x with a simplified prompt. If still fails, mark the page as `analysis_error` and skip to the next page.

**Q: How do you prevent the LLM from predicting conversion impact?**
A: Three layers: (1) The system prompt says "NEVER predict conversion rates." (2) Self-critique checks for it. (3) Grounding rule GR-007 pattern-matches for phrases like "increase conversions by" and rejects any finding containing them. All three are active.

**Q: Why not evaluate one heuristic at a time?**
A: Cost. One call with 15 heuristics is ~$0.15. Fifteen separate calls would be ~$0.60. Batching is 4x cheaper with no quality loss.
</details>

---

### Node 12: Self-Critique (separate LLM call)

**What it does:** A second LLM call reviews the first LLM's findings. It acts as an adversarial reviewer — challenging each finding's logic, evidence, severity, and context.

**Input:** `raw_findings[]` (violations and needs_review only — passes are filtered out), `analyze_perception` (the same page data the evaluator saw)
**Output:** `reviewed_findings[]` with verdicts: KEEP / REVISE / DOWNGRADE / REJECT

**What the critic checks:**
1. **VERIFY ELEMENT:** Does the finding reference data that exists in the page data?
2. **CHECK SEVERITY:** Is severity proportional to evidence? (Critical requires measurements)
3. **CHECK LOGIC:** Does conclusion follow from observation? ("4 fields = too many" → bad logic)
4. **CHECK CONTEXT:** Does finding account for page type? (10 fields fine for mortgage, bad for newsletter)
5. **CHECK DUPLICATES:** Are two findings about the same issue?

**Design decision:** Self-critique is a SEPARATE LLM call, not combined with evaluation. Why? LLMs are better at critiquing than generating. A separate call with an adversarial prompt prevents confirmation bias — the critic doesn't know the evaluator's reasoning chain, only the output.

**Halluincation catch rate:** ~30% of remaining hallucinations (after CoT caught ~50%).

**Deterministic?** NO — this is LLM-driven. Second of two LLM calls per page.

**Cost:** ~$0.05 (~6,000 input tokens, ~1,500 output tokens)

**Escalation trigger:** If the critic returns `insufficient_evidence: hidden_content_suspected` for any finding → the escalation loop fires, routing back to state exploration for a second pass (max 1 cycle).

<details>
<summary><strong>Q&A</strong></summary>

**Q: Why not use a different model for critique?**
A: This is deferred decision DD-07. Using Claude for evaluation and GPT-4o for critique would reduce confirmation bias further. But it adds cost complexity and requires paired evaluation to prove quality improves. Deferred to post-MVP.

**Q: What's the rejection rate?**
A: Target: ≥1 rejection per audit. If the system NEVER rejects anything, it's rubber-stamping, not validating. The rejection rate is a health metric — we measure it per run and alert if it drops to zero.

**Q: Can't the LLM just KEEP everything to be safe?**
A: The critique prompt explicitly says: "Be harsh — it's better to reject a valid finding than to let a hallucinated one through." And we measure: if the keep-rate is >95% consistently, the critique prompt needs sharpening.
</details>

---

### Node 13: Evidence Ground (10 deterministic rules)

**What it does:** Deterministic code validates every claim in every finding. No LLM involved. This is the final, strictest filter.

**Input:** `reviewed_findings[]`, `analyze_perception`
**Output:** `grounded_findings[]` + `rejected_findings[]`

**10 Grounding Rules:**

| Rule | What it checks | Rejection example |
|---|---|---|
| **GR-001** | Referenced element exists in page data | "Sign Up button" not found in any CTA/form/heading |
| **GR-002** | Above/below fold claims match bounding box | Claims "CTA below fold" but isAboveFold=true |
| **GR-003** | Form field count matches actual form | Claims "12 fields" but form has 4 |
| **GR-004** | Contrast claims have computed style data | Claims "low contrast" without referencing specific element |
| **GR-005** | Heuristic ID is valid (in filtered set) | References heuristic not in the filtered set for this page |
| **GR-006** | Critical/high severity has measurable evidence | Claims "critical" but no measurement or data_point |
| **GR-007** | No conversion predictions | Contains "increase conversions by 15%" |
| **GR-008** | data_point references real section | References "widgets[0]" — no such section exists |
| **GR-009** | State provenance integrity (Phase 7+) | Cites element from hidden state without state provenance |
| **GR-010** | Workflow ≥2 steps (Phase 9+) | Workflow finding references only 1 step |

**Hallucination catch rate:** ~95% of remaining hallucinations (after CoT + self-critique).

**Design decision:** Grounding is CODE, not LLM. Code validates facts (element exists, measurement matches). LLMs validate reasoning (logic, context). Different jobs, different tools. This is SD-06.

**Deterministic?** YES — 100% deterministic. No LLM calls. Pure function: `(finding, pageData) → pass | fail`.

**Cost:** $0

<details>
<summary><strong>Q&A</strong></summary>

**Q: What's the overall hallucination rejection rate across all 3 layers?**
A: CoT catches ~50%. Self-critique catches ~30% of remaining (~15% of original). Grounding catches ~95% of remaining (~4% of original). Total: ~50% + 15% + 4% = ~69% of all potential hallucinations are caught. The remaining ~31% are findings the LLM got right.

**Q: What if a grounding rule is too strict and rejects valid findings?**
A: We track rejection reasons per rule. If GR-001 rejects 30% of findings consistently, the rule may be too strict (e.g., fuzzy matching threshold too tight). Rules are versioned and tunable.

**Q: Why is GR-007 (no conversion prediction) a CODE rule and not just a prompt instruction?**
A: Defense in depth. The prompt SAYS "never predict conversion." Self-critique checks for it. GR-007 is the final backstop — pattern-matching against phrases like "increase conversions by," "boost sales by," "% more conversions." Three layers, all active, because this is a high-stakes failure mode.
</details>

---

### Node 14: 4D Score (deterministic)

**What it does:** Assigns four numerical scores to every grounded finding, plus a derived priority. All scores are computed from data — no LLM opinion.

**Input:** `grounded_finding`, `heuristic`, `page_type`, `funnel_position`
**Output:** Finding with `severity`, `confidence`, `business_impact`, `effort`, `priority`

**Four dimensions:**

| Dimension | Range | Source | Formula |
|---|---|---|---|
| **Severity** | 1-4 | From heuristic's `severity_if_violated` (or self-critique downgrade) | Lookup |
| **Confidence** | 0-1 | `tier_weight × grounding_pass_rate × evidence_quality` | Tier 1=1.0, Tier 2=0.7, Tier 3=0.4 |
| **Business Impact** | 0-10 | `IMPACT_MATRIX[page_type][funnel_position] × severity_norm × heuristic_weight` | Matrix lookup |
| **Effort** | 0-10 | `EFFORT_MAP[heuristic.effort_category]` | copy=2, content=3, visual=4, layout=6, code=8, architecture=10 |
| **Priority** | -3 to 24 | `(severity×2) + (impact×1.5) + (confidence×1) - (effort×0.5)` | Formula |

**Suppression:** Findings with confidence < 0.3 or empty evidence are silently rejected and logged to `rejected_findings`.

**Design decision:** ALL scoring is deterministic. The LLM writes narrative text (observation, assessment, recommendation). The CODE assigns numbers (severity, confidence, impact, effort, priority). This is non-negotiable — P9 design principle.

**Deterministic?** YES — lookup tables + formula. No LLM.

**Cost:** $0

<details>
<summary><strong>Q&A</strong></summary>

**Q: Why is business impact a lookup matrix and not an LLM judgment?**
A: Because LLMs can't reliably predict business impact (WiserUI-Bench 2025 research). A checkout page finding is inherently more impactful than a blog page finding — that's structural, not subjective. The matrix encodes domain knowledge: checkout × conversion position = 10 (max impact).

**Q: What's the priority formula optimizing for?**
A: "Fix this first." High severity + high impact + high confidence + low effort = highest priority. The effort term is subtracted — a finding that requires a massive refactor is deprioritized vs one that requires a copy change, all else equal.

**Q: Can a consultant override the scores?**
A: Consultants can edit severity via the review UI (creates a finding_edit record). Business impact and effort recalculate automatically. The original scores are preserved in the audit trail.
</details>

---

### Node 15: Annotate + Store

**What it does:** Overlays finding pins on screenshots and persists everything to the database.

**Input:** `grounded_findings[]`, viewport + fullpage screenshots, `audit_run_id`, `client_id`
**Output:** Annotated screenshots (clean + annotated pairs), findings in DB, screenshots in R2

**Annotation spec:**
- Pin: 28px circle with finding number, severity color (red/orange/yellow/blue)
- Label: "F-01: Guest checkout missing" in dark tooltip
- Overlap avoidance: shift pins if distance < 35px
- Connection line: dashed white line from pin to element bounding box

**Storage:**
- Findings → Postgres `findings` table (with extended scoring columns)
- Screenshots → R2 storage at `{client_id}/{audit_run_id}/{page_hash}/{type}.jpg`
- 4 images per page: viewport_clean, viewport_annotated, fullpage_clean, fullpage_annotated

**Deterministic?** Yes — Sharp image compositing + DB writes.

**Cost:** $0 (infrastructure only)

---

### Page Loop Exit

After annotate + store, the **page_router** checks:
- More pages in queue AND budget remaining → loop back to Node 5 (perceive) for next page
- Queue empty OR budget exhausted OR max pages → exit to post-audit

---

## Phase 3: POST-AUDIT (linear + learning feedback loop)

---

### Node 16: Two-Store Gate

**What it does:** Routes findings to the correct store based on confidence tier.

**Input:** Grounded findings with scores
**Output:** Finding status set: "published" / "delayed" / "held"

**Routing (post-warm-up):**
| Tier | Action | Client sees? |
|---|---|---|
| Tier 1 (high confidence) | Auto-publish immediately | Yes |
| Tier 2 (medium) | Delayed publish (24hr hold) | After 24hr unless consultant intervenes |
| Tier 3 (low) | Held for consultant | No, until approved |

**Two stores:**
- **Internal store** (findings table): ALL findings, all statuses. Consultant dashboard reads this.
- **Published store** (published_findings view): Only approved/auto-published. Client dashboard + MCP reads this. Enforced at database layer via RLS + `app.access_mode`.

**Deterministic?** Yes — tier routing is pure code.

---

### Node 17: Warm-Up Check

**What it does:** For new clients, overrides the two-store gate — ALL findings are held for consultant review regardless of tier.

**Active when:** `warmup_mode_active = true` (default for new clients)

**Exit criteria:** audits_completed ≥ 3 AND rejection_rate < 25%. Both must be true. Consultant can override manually.

**Why it exists:** If the first 20 findings include 3 hallucinations, consultants lose trust FOREVER. Warm-up earns trust before auto-publish activates.

---

### Node 18: Consultant Review

**What it does:** The human-in-the-loop. Consultant sees findings in the dashboard, sorted by priority (highest first).

**Actions available:**
| Action | Effect |
|---|---|
| Approve | Finding published to client |
| Reject | Finding removed, logged for learning |
| Edit | Consultant modifies text/severity, original preserved |
| Merge | Two findings about same issue → one |

**What the consultant sees per finding:**
- Observation, assessment, recommendation (text)
- Annotated screenshot with pin highlighted
- Evidence payload (DOM snippet, computed styles, measurements)
- Severity, confidence, business_impact, effort, priority (scores)
- Heuristic source attribution ("Based on Baymard research")
- State provenance (if finding from hidden state: "Visible after clicking Reviews tab")

**What the consultant does NOT see:** Raw heuristic content (detection logic, signal patterns). IP protection.

---

### Node 19: Published Store → Client Dashboard / MCP

**What it does:** Approved findings become visible to the client.

**What clients see:**
- Finding title, description, recommendation
- Annotated screenshot with pin
- Severity + confidence tier + business impact + effort + priority
- Source attribution
- Evidence summary (simplified)

**What clients do NOT see:**
- Heuristic ID, detection logic, signal patterns (IP)
- Grounding metadata, LLM traces
- Rejected findings, self-critique details

---

### ↻ LEARNING FEEDBACK LOOP (closes across audit runs)

### Node 20: Learning Service → Calibration

**What it does (Phase 12+):** Transforms consultant approve/reject/edit decisions into per-client heuristic adjustments.

**Input:** All consultant decisions across all audits for this client
**Output:** `heuristic_calibration` table entries (reliability_delta, severity_override, suppress_below_confidence)

**How it works:**
- Heuristic with >80% approval → reliability boost (+delta)
- Heuristic with <40% approval → reliability penalty (-delta)
- Consultant consistently changes severity → severity override
- Heuristic with <20% approval + 50+ samples → suppress

**Feeds back into:** Future audits for this client use calibrated heuristics. The scoring pipeline applies the delta to confidence calculation. The reproducibility snapshot pins the calibration state.

**Not in MVP.** Data collection starts in MVP (consultant decisions stored from day 1). Calibration computation is Phase 12.

---

## Summary: 4 Loops, All Bounded

| Loop | Where | Boundary | Max |
|---|---|---|---|
| **Browse ReAct** | Nodes 5-8 | Confidence ≥ 0.7 OR max_steps | 50 steps |
| **Escalation** | Nodes 9-12 | Self-critique flag → re-explore | 1 cycle per page |
| **Page** | Nodes 5-15 | page_router: queue empty OR budget | 50 pages |
| **Learning** | Across audits | Statistical (sample_size ≥ 30) | Delta bounded [-0.3, +0.2] |

**No loop is unbounded. No loop depends on LLM judgment to exit.** All exit conditions are deterministic: step counts, confidence thresholds, budget caps, queue length, sample sizes.

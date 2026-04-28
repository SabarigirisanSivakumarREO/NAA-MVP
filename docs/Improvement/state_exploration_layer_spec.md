# State Exploration Layer — Build Spec

Purpose: discover and capture every CRO-relevant state of a page by simulating user interactions. Sits between perception (captures one state) and heuristics (judges states). Output: a `StateGraph` of nodes (states) and edges (transitions).

---

## 0. Mental model

Page = state machine.
- **State** = a distinct configuration of visible content.
- **Transition** = a user action that produces a new state.
- **Trigger** = the element + action that causes a transition.

State 0 = initial render. Every other state reached by a sequence of triggers from State 0.

This layer does NOT judge states (heuristics do). It does NOT capture channel data (perception does). It DRIVES perception by deciding what to interact with, in what order, when to stop.

---

## 1. Trigger taxonomy

Eight trigger types. Each has different detection + firing logic.

### 1.1 Click

**What**: pointer click on an interactive element.

**Why**: most common trigger. Reveals content via tabs, accordions, modals, dropdowns, "load more", "show details".

**Detect candidates**:
- Ax-tree: `role` in [button, link, tab, menuitem, menuitemcheckbox, menuitemradio, switch, treeitem].
- DOM: `onclick` handlers, `<a href>`, `<button>`, `[role="button"]`, `cursor: pointer` + event listener.
- Cross-reference: `aria-controls` points to a container that's currently hidden = high-value click target.

**Fire**:
- `element.click()` via Playwright. Use `dispatchEvent` if `.click()` blocked by overlays.
- For `<a href>`: check `target="_blank"` (skip), check same-origin (record edge, don't follow if external).

**Skip**:
- Form submit buttons on checkout/payment.
- Logout, delete, destructive actions (heuristic: copy contains "delete", "remove", "logout", "cancel order").
- Links to external domains.

---

### 1.2 Hover

**What**: mouse-over reveals content.

**Why**: tooltips, dropdown menus, image-zoom previews, hover-cards. Often hide critical info (shipping policy tooltip, ingredient details).

**Detect candidates**:
- CSS `:hover` rules that change `display`, `visibility`, `opacity`, `content`, or transform-translate (slide-in).
- ARIA: `aria-haspopup`, `aria-describedby` pointing to hidden tooltip.
- DOM: `onmouseover`, `onmouseenter` listeners.

**Fire**:
- `element.hover()` via Playwright → triggers `mouseenter` + `mouseover`.
- Dwell 300-500ms (some hovers are debounced).

**Skip**:
- Pure decorative hover effects (color change only, no content delta).

---

### 1.3 Focus

**What**: keyboard focus reveals content.

**Why**: form field hints, accessibility-only reveals, search autocomplete dropdowns.

**Detect candidates**:
- All `tabindex >= 0` elements.
- Form fields (input, select, textarea, contenteditable).
- Custom focusable widgets (combobox, listbox).

**Fire**:
- `element.focus()`.
- For form fields: also try typing a character to trigger autocomplete (`element.type('a')`).

**Skip**:
- Already-focused elements.
- Disabled fields.

---

### 1.4 Scroll

**What**: scroll position reveals or activates content.

**Why**: sticky headers, lazy-loaded reviews/recommendations, scroll-triggered animations, "back to top" buttons, sticky ATC bars.

**Detect candidates**:
- `position: sticky` or `position: fixed` elements appearing on scroll (often start `visibility: hidden`, become visible past threshold).
- IntersectionObserver usage (search inline scripts).
- Lazy-loaded images (`loading="lazy"`, `data-src` patterns).
- Elements with class names matching `sticky|scroll|reveal|fade-in`.

**Fire**:
- Scroll to specific Y positions: 25%, 50%, 75%, 100% of document height.
- Scroll to each candidate's Y - viewport.h/2 (centers it).
- After each scroll, settle, capture.

**Skip**:
- Pure parallax backgrounds (cosmetic only).

---

### 1.5 Time-delay

**What**: content appears after N seconds without user action.

**Why**: announcement bars, exit-intent precursors, promo modals, "still here?" prompts.

**Detect candidates**:
- Hard to detect statically. Two strategies:
  - Heuristic: scan inline scripts for `setTimeout` with N > 1000ms.
  - Empirical: load page, wait 30s on State 0 doing nothing, diff DOM. New nodes = time-triggered.

**Fire**:
- Wait 5s, 15s, 30s on initial load. Capture if DOM changed.

**Skip**:
- Animations (cosmetic, not content).
- Auto-rotating carousels (capture once, don't re-explore each rotation).

---

### 1.6 Exit-intent

**What**: mouse leaves viewport from the top → modal appears.

**Why**: classic CRO tactic. Often the page's primary email-capture or discount-offer surface.

**Detect candidates**:
- Search scripts for `mouseleave` / `mouseout` listeners on `document` or `body`.
- Known exit-intent libraries: Sumo, Privy, OptinMonster, Justuno (selector signatures).
- Heuristic: not detectable until fired.

**Fire**:
- Move mouse to viewport coordinates `(viewport.w / 2, -1)` simulating exit toward top.
- Wait 500ms for modal to appear.

**Skip**:
- After firing once per page — exit-intent is usually session-cookied.

---

### 1.7 Input change

**What**: form input value change triggers content update.

**Why**: variant pickers update price/availability/images. Quantity changes update line totals. Address fields trigger shipping calc. Search inputs trigger autocomplete.

**Detect candidates**:
- `<select>` elements (each option = a state).
- Variant picker patterns: swatches, size buttons, radio groups.
- Quantity inputs.
- Form fields with `oninput`/`onchange` listeners.

**Fire**:
- For `<select>`: iterate each `<option>`. For each, set value + dispatch `change` event.
- For swatches/buttons: click each (already covered by §1.1, but tag the trigger as variant-change for diff classification).
- For text inputs: type representative values (e.g. zip code "10001" for shipping calc).

**Skip**:
- Free-text fields without obvious effect (search, when only autocomplete fires — covered by focus).

---

### 1.8 Form submit

**What**: form submission triggers next-state navigation or inline validation.

**Why**: validation errors are CRO-relevant (which fields fail, what messages appear). But submitting can create real records.

**Detect candidates**:
- `<form>` + submit buttons.
- Custom submit handlers on non-form layouts.

**Fire**:
- ONLY if explicitly allowed in config.
- Default: do not fire on checkout, payment, signup, login, account creation.
- Safe targets: search forms, filter forms, "subscribe to newsletter" if email is dummy.
- For validation testing: submit with empty fields → capture error states. Don't submit with valid data unless allowed.

**Skip by default** unless `allow_form_submit: true` in config.

---

## 2. Candidate discovery

After perception captures State 0, build the candidate trigger set:

```
candidates = []
for each node in element_graph:
  if node.is_interactive: candidates.add(click_trigger(node))
  if node has :hover content rules: candidates.add(hover_trigger(node))
  if node is focusable + has hidden related content: candidates.add(focus_trigger(node))
  if node is form input: candidates.add(input_trigger(node))

# Page-level triggers
candidates.add(scroll_triggers(at 25%, 50%, 75%, 100%))
candidates.add(time_triggers(at 5s, 15s, 30s))
candidates.add(exit_intent_trigger())
```

Deduplicate: if both click and hover exist on same element, prefer click (usually more informative).

---

## 3. Exploration policy

Naive: explore every trigger from every state. Combinatorial explosion. A page with 8 tabs × 5 accordions × 3 modals × 4 variants = 480 potential states. Stop.

### 3.1 Default policy: BFS, depth ≤ 2, budget-capped

- BFS from State 0. Depth 0 = State 0. Depth 1 = states reached by one trigger. Depth 2 = two triggers.
- Most CRO content is depth 1-2. Going deeper = config wizards, multi-step modals (lower priority).
- Budget: max N states (default 50). Hard stop.

### 3.2 Priority queue

Order triggers by CRO value:

| Priority | Trigger pattern | Why |
|---|---|---|
| 1 | Variant/option selector (price/stock changes) | Direct conversion impact |
| 2 | Tab revealing product info (description, specs, reviews) | Buyer's evaluation flow |
| 3 | Accordion with policy content (shipping, returns, warranty) | Trust + objection handling |
| 4 | Modal (size guide, shipping calc, login prompt) | Buyer support |
| 5 | Cart drawer / mini-cart | Pre-checkout state |
| 6 | Sticky/scroll-triggered elements | Persistent CTA prominence |
| 7 | Time-delayed content (announcement bars, promos) | Urgency / messaging |
| 8 | Exit-intent | Last-chance conversion surface |
| 9 | Hover tooltips | Microcopy quality |
| 10 | Decorative carousels | Often skipped |

Priority assignment heuristic:
- Cross-reference trigger element's text/aria with patterns: "size", "color", "variant" → P1; "description", "details", "specs", "reviews" → P2; "shipping", "returns", "warranty", "policy" → P3.

### 3.3 Skip rules (during exploration)

Skip a trigger candidate if any:
- Pure cosmetic delta (no text content change, only styling).
- DOM diff < threshold (default 50 chars added/changed).
- Trigger leads to navigation (different URL) — record edge but don't follow.
- Form submit on checkout/payment/auth (always skip unless config allows).
- Already explored (state hash matches existing node).
- Budget exhausted.

### 3.4 Termination

Stop exploring when ANY:
- Budget reached (max states).
- Queue empty (no candidates left).
- Time budget exceeded (default 60s).
- Depth cap reached.

Always emit a `BUDGET_EXHAUSTED` warning if stopped before queue empty.

---

## 4. Settle predicate

After firing a trigger, when is the new state ready to capture?

This is the single most-debugged piece of any state exploration system.

```
async function waitForSettle(page, opts = {}):
  # 1. Network quiet
  await page.waitForLoadState('networkidle', timeout=2000)  # soft, ignore errors

  # 2. DOM mutations stopped
  await waitForDomMutationsToStop(page, idleMs=300)

  # 3. Fonts loaded (affects layout)
  await page.evaluate(() => document.fonts.ready)

  # 4. CSS animations finished
  await waitForAnimationsToFinish(page)
  # poll: document.getAnimations().every(a => a.playState === 'finished' || a.playState === 'idle')

  # 5. Optional: required selector visible
  if opts.requireSelector: 
    await page.waitForSelector(opts.requireSelector, { state: 'visible' })

  # Hard cap
  return Promise.race([settled, timeout(5000)])
```

DOM mutation idle detection (inject into page):
```js
let lastMutation = Date.now()
new MutationObserver(() => { lastMutation = Date.now() })
  .observe(document, { subtree: true, childList: true, attributes: true })
// Resolve when (Date.now() - lastMutation) > idleMs
```

**Gotchas**:
- Infinite-scroll pages never reach `networkidle` — cap timeout, don't block.
- Auto-rotating carousels never reach animation-idle — exclude them via selector.
- Some SPAs do micro-mutations indefinitely (cursor blink, live timestamps) — increase `idleMs` to 500-700.

---

## 5. State diffing

After settle, compare to pre-trigger snapshot. This decides whether to record the state and how to classify it.

### 5.1 Diff dimensions

- **DOM diff**: added/removed/modified nodes. Use node-id sets, not raw HTML strings.
- **Ax-tree diff**: new interactive nodes (modal opened?), state changes (`expanded: false → true`).
- **Layout diff**: which elements moved, appeared, disappeared. Good for sticky/scroll triggers.
- **Visual diff** (optional): pixel-level diff. Expensive — only when needed for evidence.

### 5.2 Classify delta

| Class | Definition | Action |
|---|---|---|
| `content_added` | New text/images visible (modal, tooltip, lazy-loaded section) | Record state |
| `content_revealed` | Existing nodes became visible (display:none → block, accordion) | Record state |
| `content_replaced` | Text/images swapped (variant change, tab switch) | Record state |
| `cosmetic` | Style changes only, no content delta | Skip |
| `navigation` | URL changed | Record edge only, don't recurse |
| `error` | Trigger failed, page crashed, etc. | Record warning, skip |

Threshold for "content delta": added/changed text length > 50 chars OR > 1 image OR new interactive node.

### 5.3 Deduplication

Hash the new state for dedup. Hash inputs:
- Sorted set of visible element IDs.
- Hash of visible text content (normalized: trim, lowercase, collapse whitespace).
- NOT raw HTML (too much variance).

If hash matches existing state → record edge but don't add new node.

---

## 6. Output: StateGraph

```
state_graph: {
  initial_state_id: state_id,
  nodes: Map<state_id, StateNode {
    state_id,
    parent_state_id: state_id | null,
    trigger_path: [{ element_id, action, value? }],   # how we got here from State 0
    state_hash: string,                                # for dedup
    perception_bundle_ref: string,                     # link to perception output
    new_content_summary: string,                       # human-readable diff vs parent
    depth: number,
    captured_at: timestamp
  }>,
  edges: [{
    from_state_id, to_state_id,
    trigger: { element_id, action, value? },
    delta_type: "content_added" | "content_revealed" | "content_replaced" | "navigation",
    delta_summary: string,
    fired_at: timestamp
  }],
  unexplored: [{                                        # candidates we didn't fire
    from_state_id, element_id, action,
    reason: "budget" | "depth_cap" | "skip_rule" | "destructive"
  }],
  warnings: [{ code, message, severity }]
}
```

Warning codes: `BUDGET_EXHAUSTED`, `SETTLE_TIMEOUT`, `TRIGGER_FAILED`, `INFINITE_MUTATIONS_DETECTED`, `DESTRUCTIVE_TRIGGER_SKIPPED`, `EXTERNAL_NAVIGATION_BLOCKED`.

---

## 7. State reset between trigger sequences

Critical correctness issue: when exploring depth 2, you need to return to the parent state before firing the next trigger. Two strategies:

### 7.1 Reload + replay (safe, slow)

For each new exploration path:
- Reload page to State 0.
- Replay trigger sequence to reach parent state.
- Fire next trigger.

Pros: deterministic, no leftover state.
Cons: slow (full page load per branch).

### 7.2 Reverse-action (fast, fragile)

Try to undo the last action: close modal, collapse accordion, click "back" in drawer.

Pros: 5-10x faster.
Cons: not always reversible (variant changes may persist, scroll may not undo cleanly).

**Recommendation**: hybrid. Use reverse-action when trigger is in a known-reversible class (modal close, accordion toggle, tab switch). Reload+replay for variants, scrolls, anything ambiguous.

---

## 8. Cross-cutting concerns

### 8.1 Cookies / localStorage between explorations

- Snapshot cookies + localStorage at State 0.
- After each branch, optionally restore (prevents exit-intent suppression after first fire, prevents "you've seen this promo" cookies).
- Config flag: `restore_storage_per_branch: true` (default).

### 8.2 Network mocking for determinism

- For deterministic re-runs: record network responses at State 0, replay during exploration.
- Useful for variant-change calls that hit live inventory APIs (prevents flaky stock states).

### 8.3 Multi-viewport state graphs

State graph at mobile differs from desktop:
- Hamburger menu (mobile-only) → adds nav-drawer state.
- Sticky bottom CTA (mobile-only) → different scroll states.
- Hover triggers don't apply on mobile → fewer nodes.

Run state exploration once per viewport. Bundle them in the output.

### 8.4 Auth states

If auth is provided, explore both guest and logged-in graphs separately. They differ significantly (cart contents, recommendations, account-only content).

### 8.5 Determinism / replay

- Record full trigger path per state. Re-running the path from State 0 should reach the same state hash.
- If hash mismatches → log `NONDETERMINISTIC_STATE` warning. Common causes: A/B tests, personalization, time-based content.

### 8.6 Resource caps

- Max wall time per page: 60s default.
- Max trigger fires: 100.
- Max state nodes: 50.
- Max screenshot bytes per page: 50MB.

Emit warnings on cap hits, never silently truncate.

---

## 9. Things state exploration must NOT do

- No CRO judgments. Don't decide a state is "bad" — record it, let heuristics judge.
- No form submits unless explicitly allowed.
- No destructive actions (delete, logout, cancel order, unsubscribe — though unsubscribe in test envs is fine if allowed).
- No following external links.
- No auth attempts.
- No payment submission ever.
- No mutation of perception data — drives perception, doesn't edit its output.

---

## 10. Build order recommendation

If extending an existing state exploration layer, prioritize:

1. **Settle predicate** (§4). Bad settle = bad everything downstream. If this is shaky, fix first.
2. **State hashing + dedup** (§5.3). Without it, you re-explore and explode budget on duplicate states.
3. **Priority queue with CRO-value ordering** (§3.2). Most pages won't get full exploration — make sure the explored states are the high-value ones.
4. **State reset strategy** (§7). Most-bug-producing area. Hybrid approach is correct but tricky.
5. **Skip rules + destructive action detection** (§3.3, §1.8). Safety + budget protection.
6. **Multi-viewport runs** (§8.3). Doubles findings on responsive sites.
7. **Cookie/storage restoration** (§8.1). Often missed; affects exit-intent and promo states.
8. **Nondeterminism flagging** (§8.5). Honesty in output.

---

## 11. Tech stack defaults

- Driver: **Playwright** (better waits than Puppeteer, multi-engine).
- Mutation detection: inject `MutationObserver` via `page.evaluate`.
- Diff: `fast-diff` for text, custom node-set diff for structure.
- Hashing: `xxhash` (fast, good distribution).
- Queue: simple priority queue (heap) keyed on CRO-value score.

---

## 12. How this plugs into the rest

```
ContextProfile (from §context layer)
    ↓
Perception captures State 0 → PerceptionBundle@S0
    ↓
State Exploration:
    - Discovers candidates from PerceptionBundle@S0.element_graph
    - Drives perception to capture each new state → PerceptionBundle@S1, S2, ...
    - Builds StateGraph linking all bundles
    ↓
Heuristics consume StateGraph + per-state PerceptionBundles
```

State exploration's job is to make sure heuristics never have to ask "what about the state behind tab 2?" — every CRO-relevant state is already in the graph.

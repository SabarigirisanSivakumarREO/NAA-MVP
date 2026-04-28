# Perception Layer — Build Spec

Purpose: extract everything a CRO heuristic engine needs from a live web page. Output is a `PerceptionBundle` consumed downstream. No analysis here — only capture.

---

## 0. Mental model

Page = state machine, not document.
- State 0 = initial render after load.
- State N = after a trigger sequence (click, hover, scroll, time, input).
- Each state has 4 channels of perception. Channels fuse into one element graph per state.

Perception ≠ analysis. Perception captures facts. Heuristics judge them.

---

## 1. Channels (run in parallel per state)

### 1.1 DOM snapshot

**What**: post-JS rendered HTML + computed styles + structured data.

**Why**: source of content truth — text, prices, hidden elements, schema.org, meta tags, microcopy that visual capture misses.

**When**: every state, after DOM-mutation settle (see §3.4).

**How**:
- Use Playwright/Puppeteer. Wait for `networkidle` OR custom settle predicate.
- Capture: `document.documentElement.outerHTML`, computed style for visible elements, all `<script type="application/ld+json">` blocks, `<meta>` tags, OpenGraph, Twitter cards.
- Strip: `<style>` content, base64 inlined assets, tracking pixels.
- Parse JSON-LD into structured objects (Product, Offer, Review, Organization, BreadcrumbList).

**Output fields**:
```
dom: {
  html: string,
  computed_styles: Map<selector, {color, bg, font_size, font_weight, contrast_ratio}>,
  structured_data: { product?, offers?, reviews?, breadcrumbs?, org? },
  meta: { title, description, og, twitter, canonical, hreflang },
  hidden_elements: [{ selector, reason: "display_none" | "aria_hidden" | "visibility_hidden" | "offscreen" }]
}
```

**Gotchas**:
- Shadow DOM — must traverse explicitly. `element.shadowRoot` per node.
- iframes — separate document trees. Decide: descend or skip per business need (e.g. embedded checkout = descend, ad iframe = skip).
- React Portals render outside parent — find by scanning whole `<body>`.
- `content: ""` in CSS pseudo-elements carries copy (badges, "NEW" labels) — capture via `getComputedStyle(el, '::before').content`.

---

### 1.2 Accessibility tree

**What**: browser's semantic model — what assistive tech sees.

**Why**: cleanest way to enumerate interactive elements, detect fake buttons (`<div onclick>`), check label quality, find ARIA states (`expanded`, `selected`, `current`).

**When**: every state. Cheap to capture.

**How**:
- CDP (Chrome DevTools Protocol): `Accessibility.getFullAXTree`.
- Playwright: `page.accessibility.snapshot({ interestingOnly: false })`.
- Tree nodes: `{ role, name, value, description, properties, children }`.

**Output fields**:
```
ax_tree: {
  nodes: [{
    ax_id, role, name, value, level,
    states: { expanded?, selected?, checked?, disabled?, focused?, pressed? },
    properties: { haspopup?, controls?, owns?, describedby?, required? },
    dom_ref: selector or backend_node_id
  }],
  interactive_nodes: [ax_id],   // pre-filtered: button, link, tab, menuitem, checkbox, radio, combobox, textbox
  landmark_nodes: [ax_id]       // banner, navigation, main, contentinfo, search, form
}
```

**Gotchas**:
- `interestingOnly: true` skips decorative nodes — fine for analysis, lossy for completeness.
- Custom components without ARIA show as `generic` role — flag these as "semantic gaps" but still capture click handlers from DOM.
- `aria-hidden=true` subtrees still in DOM — perception layer captures them, heuristic decides what to do.

---

### 1.3 Visual capture

**What**: screenshots — full page + viewport + per-element crops.

**Why**: only channel that reveals visual hierarchy, contrast, whitespace, brand feel, image quality, fold placement. DOM/Ax-tree are blind to all of these.

**When**: every state. Slowest channel — budget accordingly.

**How**:
- Full-page: `page.screenshot({ fullPage: true, type: 'png' })`.
- Viewport: `page.screenshot({ clip: viewport })`.
- Per-element crops: only for elements flagged as "key" (CTAs, hero, price, form fields) — too expensive to crop everything.
- Capture at multiple viewports if device priority requires it (mobile 375, tablet 768, desktop 1440).

**Output fields**:
```
visual: {
  full_page_url: string,            // path to PNG
  viewport_url: string,
  device_pixel_ratio: number,
  viewport: { w, h },
  page_dimensions: { w, h },
  fold_y: number,                   // = viewport.h
  element_crops: Map<element_id, crop_url>
}
```

**Gotchas**:
- Lazy-loaded images — must scroll page to bottom and back before capture, else hero-below shows blank placeholders.
- CSS animations/loaders — capture after settle, else screenshot catches mid-animation state.
- Web fonts — wait for `document.fonts.ready` before capture.
- Sticky headers double-up in full-page screenshots on some engines — known Chromium issue, document but don't try to fix in perception.
- Cookie banners cover the fold — decide policy: dismiss before capture (recommended for CRO of the actual page) OR capture as-is (recommended if banner UX is the question).

---

### 1.4 Layout geometry

**What**: bounding boxes + visibility + z-order for every element.

**Why**: quantitative complement to screenshots. Lets heuristics ask "is element X above the fold", "what % of viewport does the CTA occupy", "do these two elements overlap".

**When**: every state. Cheap.

**How**:
- Inject script: walk DOM, call `getBoundingClientRect()` + `getComputedStyle()` per element.
- Filter: skip elements with `width=0 || height=0`, skip `display:none`, keep `visibility:hidden` (heuristic may want them).
- Compute: `in_fold = bbox.top < viewport.h`, `fully_visible`, `clipped_by_parent`.

**Output fields**:
```
layout: {
  elements: Map<element_id, {
    bbox: { x, y, w, h },
    in_fold: boolean,
    visible: boolean,
    z_index: number,
    overflow_clipped: boolean,
    parent_id: element_id
  }>,
  viewport: { w, h, scroll_x, scroll_y },
  document_height: number
}
```

**Gotchas**:
- `position: fixed` elements — bbox is relative to viewport not document. Mark with flag.
- Transformed elements (`transform: scale/rotate`) — `getBoundingClientRect` returns post-transform box; use `getBBox` for SVG.
- Overflow-scroll containers — child elements may have bboxes outside parent's visible area; track with `overflow_clipped`.

---

## 2. Element graph (channel fusion)

**What**: single graph where each node carries all 4 channel views.

**Why**: heuristics need cross-channel queries — "low-contrast above-fold buttons" requires DOM (it's a button), Ax-tree (role confirmed), visual (contrast computed), layout (above fold). Fusing once at perception time beats N joins later.

**How**:
- Assign stable `element_id` per DOM node (hash of: tag + classes + position + text).
- Walk DOM → for each node, collect: DOM ref, matching ax_node by backend_node_id, bbox from layout, computed styles, optional crop.
- Skip nodes that have no semantic value (text nodes inside `<p>`, etc.) unless they carry distinct copy.

**Output**:
```
element_graph: Map<element_id, FusedElement {
  element_id,
  tag, selector, xpath,
  text_content,
  attrs: { id, class, href, src, alt, ... },
  ax: { role, name, states, properties } | null,
  bbox: { x, y, w, h, in_fold, visible },
  style: { color, bg, font_size, font_weight, contrast_ratio },
  crop_url: string | null,
  is_interactive: boolean,
  parent_id, children_ids
}>
```

**Decision rules**:
- Interactive = ax_role in [button, link, tab, ...] OR has onclick/href OR cursor:pointer + click handler.
- "Key element" candidates for cropping: any node where ax_role=button AND text matches CTA patterns (buy|add|checkout|signup|start|get|try), or has class/id matching `cta|primary|hero|price`.

---

## 3. Interaction engine (state discovery)

This is where most page-analyzers fail. Static perception captures State 0 only. CRO issues live in state transitions.

### 3.1 Trigger taxonomy

| Trigger | How to detect candidates | How to fire |
|---|---|---|
| Click | ax_role=button/link/tab/menuitem, onclick, cursor:pointer | `element.click()` |
| Hover | `:hover` styles change content/visibility, aria-haspopup | `mouseover` event + dwell |
| Focus | tabindex, form fields, custom focusable | `element.focus()` |
| Scroll | sticky elements, IntersectionObserver, scroll-triggered classes | scroll to Y, wait |
| Time-delay | `setTimeout` in scripts (heuristic), modals not in initial DOM | wait N seconds |
| Exit-intent | `mouseleave` to top of viewport | simulate mouse to (x, -1) |
| Input change | `<select>`, variant pickers, quantity, address fields | typing/selection sim |
| Form submit | submit buttons | only if explicitly allowed (don't submit checkout) |

### 3.2 Candidate discovery

- Pull all `interactive_nodes` from ax_tree.
- Add: elements with `:hover` rules that change `display/visibility/content`.
- Add: scroll-triggered candidates (find via IntersectionObserver patterns or `position:sticky`).
- Add: time-delay candidates (run page for T seconds, diff DOM, treat new nodes as time-triggered).
- Add: exit-intent (search scripts for `mouseleave` listeners on document/body — heuristic, may miss).

### 3.3 Exploration policy

Naive: explore every trigger from every state — combinatorial explosion.

Pragmatic policy:
- **BFS, depth ≤ 2** by default. Most CRO-relevant content is 1-2 interactions deep.
- **Budget**: max N states (e.g. 50) per page.
- **Priority queue** ordered by trigger CRO-value:
  1. Variant/option selectors (price/availability changes)
  2. Tabs revealing product info (description, specs, reviews, shipping)
  3. Accordions with product/policy content
  4. Modals (size guide, shipping calc, login)
  5. Cart drawer
  6. Sticky/scroll-triggered elements
  7. Hover tooltips
  8. Decorative carousels (low priority, often skipped)
- **Skip rules**:
  - Pure cosmetic delta (no text content change, only styling) — skip.
  - DOM diff < threshold (e.g. <50 chars added) — skip.
  - Trigger leads to navigation (different URL) — record edge but don't follow.
  - Form submit on checkout/payment — never fire.

### 3.4 Settle predicate

After firing a trigger, when is "the new state ready"?

```
async function waitForSettle(page, opts = {}):
  await page.waitForLoadState('networkidle', timeout=2000)  // soft
  await waitForDomMutationsToStop(page, idleMs=300)
  await page.waitForFunction(() => document.fonts.ready)
  await waitForAnimationsToFinish(page)  // poll element.getAnimations()
  if opts.requireSelector: await page.waitForSelector(opts.requireSelector)
```

Implementation note: `MutationObserver` injected into page, resolves when no mutations for `idleMs`. Cap total wait at 5s.

### 3.5 State diffing

After settle, compare to pre-trigger snapshot:
- DOM diff: added/removed/modified nodes.
- Ax-tree diff: new interactive nodes, state changes (expanded false→true).
- Layout diff: which elements moved/appeared/disappeared.
- Visual diff: optional, expensive — only if pixel-level evidence needed.

Classify delta:
- `content_added`: new text/images visible.
- `content_revealed`: existing nodes became visible (display:none → block).
- `content_replaced`: text swapped (variant change, tab switch).
- `cosmetic`: styles only, no content change → skip recording.
- `navigation`: URL changed → record as edge, don't recurse.

### 3.6 State graph output

```
state_graph: {
  nodes: Map<state_id, {
    state_id,
    parent_state_id: state_id | null,
    trigger_path: [{ element_id, action, value? }],   // how we got here
    perception: PerceptionBundle.channels,            // 4-channel snapshot
    new_content_summary: string                       // diff vs parent
  }>,
  edges: [{
    from: state_id, to: state_id,
    trigger: { element_id, action, value? },
    delta_type: "content_added" | "content_revealed" | "content_replaced",
    delta_summary: string
  }]
}
```

---

## 4. Cross-cutting concerns

### 4.1 Multi-viewport perception

For accurate CRO analysis, run the full pipeline at multiple viewports. Each run is a separate `PerceptionBundle`.

Default set:
- Mobile: 375×812, DPR 2 (iPhone-class).
- Tablet: 768×1024, DPR 2.
- Desktop: 1440×900, DPR 1.

Findings like "CTA below fold" are viewport-conditional. Heuristic layer cross-references bundles.

### 4.2 Auth state

Some pages render differently for guest/logged-in/returning. Perception layer should accept an optional auth context (cookies, localStorage seed) and label the bundle accordingly. Don't try to log in autonomously.

### 4.3 Geo / locale

IP-based geo affects pricing, shipping, language. Perception layer accepts proxy/locale config. Bundle records `{ geo, locale, currency }` from page (often in JSON-LD or meta).

### 4.4 Cookie banners / interstitials

Policy decision (configurable):
- `dismiss`: auto-click "accept" or "reject" before main capture. Best for analyzing the actual page.
- `preserve`: capture as-is. Best when the banner UX is the question.
- `block`: prevent banner JS from loading. Avoid — breaks consent-aware sites.

Detection: known banner libraries (OneTrust, Cookiebot, TrustArc) by selector signature, plus generic detection (fixed-position element covering >20% of fold with "cookie" text).

### 4.5 Performance signals

While capturing, also record:
- Core Web Vitals: LCP, CLS, INP (use `web-vitals` library).
- Total page weight, request count, blocked-by-tracker count.
- Time to interactive.

These feed CRO findings — slow LCP correlates with bounce; high CLS correlates with mis-clicks.

### 4.6 Idempotency / determinism

Same URL + same viewport + same auth = mostly same bundle. Sources of nondeterminism:
- Personalization, A/B tests, ad auctions, time-based content.
- Mitigation: record a `nondeterminism_flags` field listing detected sources (e.g. `optimizely_active`, `personalization_cookie_set`).
- For diffing across runs, hash structural content, not raw HTML.

### 4.7 Robots / ToS

Respect `robots.txt`. Use realistic UA. Throttle. Don't fire form submits that create real records (orders, accounts) without explicit permission. Make this a hard rule in the trigger engine.

---

## 5. Output: PerceptionBundle

```
PerceptionBundle {
  meta: {
    url, captured_at, viewport, device_pixel_ratio,
    auth_state, geo, locale, user_agent,
    perception_layer_version
  },
  performance: { lcp, cls, inp, page_weight, request_count },
  nondeterminism_flags: [string],
  initial_state_id: state_id,
  state_graph: { nodes, edges },              // §3.6
  element_graph_by_state: Map<state_id, ElementGraph>,  // §2
  raw: {
    dom_by_state: Map<state_id, DOM>,         // §1.1
    ax_by_state: Map<state_id, AxTree>,       // §1.2
    visual_by_state: Map<state_id, VisualCapture>, // §1.3
    layout_by_state: Map<state_id, Layout>    // §1.4
  },
  warnings: [{ code, message, severity }]
}
```

`warnings` examples: `SHADOW_DOM_NOT_TRAVERSED`, `IFRAME_SKIPPED`, `BUDGET_EXHAUSTED_AT_DEPTH_2`, `AUTH_REQUIRED_DETECTED`.

---

## 6. Build order recommendation

If extending an existing perception layer, prioritize in this order:

1. **Settle predicate** (§3.4). Bad settle = bad everything. Fix first.
2. **Channel fusion** (§2). If you have 4 channels but query them separately, merge them. Big quality jump for downstream.
3. **State graph** (§3). Static-only perception is the single biggest gap in most CRO tools.
4. **Multi-viewport** (§4.1). Doubles findings quality on responsive sites.
5. **Performance signals** (§4.5). Cheap to add, valuable to heuristics.
6. **Nondeterminism flags** (§4.6). Honest output > confident output.
7. **Cookie banner policy** (§4.4). Often last, often the most-debugged.

---

## 7. Tech stack defaults

- Browser automation: **Playwright** (better cross-engine, better waits than Puppeteer).
- DOM/Ax extraction: Playwright + CDP for ax-tree.
- Diffing: `fast-diff` for text, structural diff via node-id sets.
- Storage: bundle as JSON + screenshots as separate files in object store. Reference by URL in bundle.
- Schema validation: Zod / JSON-Schema for `PerceptionBundle`.

---

## 8. Things perception layer must NOT do

- No CRO judgments. Don't compute "this CTA is too small" — record the size, let heuristics judge.
- No prioritization. Don't rank elements by importance — record everything that meets capture criteria.
- No content rewriting. Don't normalize copy or fix typos in extracted text.
- No form submission unless explicitly allowed.
- No auth attempts.
- No retries that mutate state (e.g. don't re-add to cart on failure).

Perception captures facts. Everything else is downstream's job.

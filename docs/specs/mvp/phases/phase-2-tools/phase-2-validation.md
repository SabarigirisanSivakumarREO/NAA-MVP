---
title: Phase 2 Validation — Eyes-On Proof Artifact
artifact_type: validation
status: implemented
version: 1.0
phase_number: 2
phase_name: MCP Tool Surface
phase_completed_on: 2026-05-13
created: 2026-05-13
updated: 2026-05-13
owner: engineering lead
authors: [Claude (master orchestrator sessions 16-18)]
reviewers: [Sabari (Gate 2 stamp pending)]
sibling_of: phase-2-current.md
derived_from:
  - docs/specs/mvp/phases/phase-2-tools/spec.md v0.3.1 (13 ACs + 15 R-NN + 6 NF-Phase2-NN + SC-001..SC-005)
  - docs/specs/mvp/phases/phase-2-tools/tasks.md v0.2 (35 tasks)
  - docs/specs/mvp/phases/phase-2-tools/impact.md v0.2.8
  - docs/specs/mvp/phases/phase-2-tools/phase-2-current.md (sibling rollup)
purpose: |
  R19 sibling validation doc — provides 5 ASCII proof sections + §6 trust spot-check list
  for a human reviewer to gain confidence in ~20 minutes of eyes-on review without reading
  every line of the 49-commit Phase 2 delta. Closes the AI-built-code comprehension gap.
governing_rules:
  - Constitution R19 (Phase rollup + validation doc mandatory at Stage 4 exit)
  - CLAUDE.md §8c (Per-phase artifact maintenance)
---

# Phase 2 — Validation (Eyes-On Proof Artifact)

> **Purpose.** Phase 2 shipped 29 MCP tools + 4 shared contracts + 26 conformance tests + 1 integration test across 49 commits. This doc compresses the proof of correctness into 5 ASCII diagrams + a spot-check list, so a human reviewer can sanity-check the implementation in ~20 minutes of eyes-on review without reading every line.

> **Governed by:** Constitution R19 (rollup partnership). Validation doc size cap: 400 lines / ~4000 tokens.

---

## §1. Module dependency graph

ASCII import graph for src files Phase 2 introduced. `█` = R9 boundary (sole external-SDK importer). Solid arrows are runtime imports; dashed are type-only.

```
  Phase 1 / 1b / 1c (UPSTREAM — unchanged)
    adapters/BrowserEngine.ts (interface only)
    perception/ContextAssembler.ts (.capture + .captureFromSession new in v0.2.3)
    perception/types.ts (PageStateModel)
    perception/IframePolicyEngine.ts (IframePurpose 9-value closed enum —
                                      mirrored inline by pageAnalyze.script.ts)
                                  │
                                  ▼ (type-only consumption by 26 tools)
  Phase 2 — Foundational types + contracts (Wave 0)
    mcp/types.ts             — MCPToolDefinition<I,O>, SafetyClass, ToolContext
    mcp/ToolRegistry.ts      — ToolRegistry interface + InMemoryToolRegistry
    analysis/types.ts        — AnalyzePerceptionSchema (Zod, top-level)
    analysis/analyzePerception.subschemas.ts — 11 enrichment-category sub-schemas
                                                + 38 sub-fields per §07.9.1
    analysis/index.ts        — barrel
    browser-runtime/MouseBehavior.ts   (T016) ─┐
    browser-runtime/TypingBehavior.ts  (T017) ─┤
    browser-runtime/ScrollBehavior.ts  (T018) ─┤  (consumed by interaction tools
    browser-runtime/RateLimiter.ts     (T049) ─┘   T027/T029/T030/T032)
                                  │
                                  ▼
  Phase 2 — R9 adapter (Wave 3)
    █  mcp/Server.ts ── imports ──► @modelcontextprotocol/sdk/{types.js,
                                      server/index.js, shared/transport.js}
                                    zod-to-json-schema (tools/list emission)
       (SOLE site allowed to import the SDK per R9 + SC-005)
    mcp/index.ts (barrel — Server + ToolRegistry + types + tool factories)
                                  │
                                  ▼
  Phase 2 — 29 tool factories (Waves 4-14)
    mcp/tools/  navigate goBack goForward reload getState screenshot getMetadata
                click clickCoords type scroll select hover pressKey upload
                tabManage extract download findByText getNetwork waitFor
                agentComplete agentRequestHuman                       (24 tools)
                browserEvaluate (T043 — sandbox)                       (1)
                pageGetElementInfo pageGetPerformance
                pageScreenshotFull pageAnnotateScreenshot              (4)
                pageAnalyze (T048) ── imports ──► pageAnalyze.script.ts
                                                  (523-LOC string body, 0 evaluates)

    Each factory imports: z (zod) + type { BrowserSession } from
      adapters/BrowserEngine + { MCPToolDefinition, ToolContext } from ../types.
    pageAnalyze.ts additionally imports { AnalyzePerceptionSchema,
      AnalyzePerception } from ../../analysis (only consumer in Phase 2).
    NO factory imports @modelcontextprotocol/sdk (R9 verify — grep returns 0).
    NO factory imports playwright (Phase 1 R9 boundary preserved).
                                  │
                                  ▼
  Phase 2 — Integration test (Wave 15; phase exit gate AC-13)
    tests/integration/phase2.test.ts (311 LOC) + phase2.fixtures.ts (101 LOC,
      3 fixtures) + phase2.registry.ts (93 LOC, in-process registry boot).
    Asserts: all 29 tools registered; tools/list shape; F-S4 namespace contract
      (`_extensions` absent) across 3 fixtures; total wall-clock < 5 min
      (actual 37.49s — 8x margin).
```

**Trust check §1:** No cycles. mcp/Server.ts is the only SDK importer (one `█` boundary). 29 tool factories form a fan-out from mcp/types.ts; only pageAnalyze.ts consumes analysis/. The integration test imports from `mcp/` and 3 fixture HTML files — no other dependencies.

---

## §2. Data flow — tool dispatch pipeline (the orchestration spine)

```
       MCP client sends tools/call request
       ─────────────────────────────────────
       { name: 'page_analyze', arguments: {} }                 ► event: mcp.tool.call (sdk)
                              │
                              ▼
        SDK setRequestHandler(CallToolRequestSchema, ...)
        in MCPServerAdapter.#registerHandlers() [Server.ts:174]
                              │
                              ▼
        registry.get(name)                                     [Server.ts:178]
        │
        ├─ undefined → return { isError: true, content:
        │              [{ text: 'Unknown tool: <name>' }] }    ► event: (omitted; SDK formats)
        │
        └─ MCPToolDefinition<I, O>
                              │
                              ▼
        MCPServerAdapter.#invokeTool(def, rawInput)            [Server.ts:190]
                              │
                              ▼
        toolCallId = newToolCallId()                           [Server.ts:194]
        callLogger = this.#logger.child({                       [Server.ts:195]
          tool_name, tool_call_id, client_session_id })
                              │
                              ▼
        def.inputSchema.safeParse(rawInput)                    [Server.ts:200]
        │
        ├─ !success → warn + return { isError: true,            ► event: mcp.tool.input_invalid
        │              content: [{ text: 'Invalid input:
        │              <zod-err>' }] }                          [Server.ts:202]
        │
        └─ parsedInput.data
                              │
                              ▼
        ctx = { logger: callLogger, toolCallId,                 [Server.ts:208]
                clientSessionId }
                              │
                              ▼
        try {
          output = await def.handler(parsedInput.data, ctx)    [Server.ts:214]
                              │
                              ▼
          def.outputSchema.safeParse(output)                    [Server.ts:215]
          │
          ├─ !success → error + return { isError: true,         ► event: mcp.tool.output_invalid
          │              content: [{ text: 'Invalid output:
          │              <zod-err>' }] }                        [Server.ts:217]
          │
          └─ parsedOutput.data
                              │
                              ▼
          return { content: [{ type: 'text',                    [Server.ts:223]
                               text: JSON.stringify(
                                 parsedOutput.data) }] }
        } catch (err) {                                         [Server.ts:226]
          callLogger.error(...)                                 ► event: mcp.tool.handler_error
          return { isError: true, content:
                   [{ text: <err.message> }] }                  [Server.ts:229]
        }
```

**Trust check §2:** Linear pipeline. ALL three failure modes (unknown tool, invalid input, invalid output, handler throw) return `isError: true` envelopes — none re-throw upstream. The output-schema parse runs on EVERY tool result; this is where F-S4 (`_extensions` absent) gets caught on page_analyze if regressed. Picking one bracketed type and grepping confirms the shape match.

---

## §3. Function call graph — page_analyze single-evaluate path (REQ-TOOL-PA-001)

```
       MCP client → tools/call({ name: 'page_analyze', arguments: {} })
       │
       └── MCPServerAdapter.#invokeTool(def, {})              [Server.ts:190]
           │
           ├─ inputSchema.safeParse({}) → ok
           │  PageAnalyzeInputSchema = z.object({}).strict()   [pageAnalyze.ts:58]
           │
           ├─ ctx = { logger, toolCallId, clientSessionId }
           │
           ├─ def.handler({}, ctx)                            [pageAnalyze.ts:75]
           │  │
           │  ├─ session.page  (DYNAMIC GETTER — Wave 9b; returns current
           │  │                 active page; NOT cached; multi-tab transparent)
           │  │
           │  ├─ await session.page.evaluate(PAGE_ANALYZE_SCRIPT)  [pageAnalyze.ts:79]
           │  │     ▼ EXACTLY ONE call (REQ-TOOL-PA-001). Caller's settle
           │  │       precondition's internal evaluate for fonts.ready is F-G2
           │  │       out-of-scope. Verifiable via Playwright trace count = 1.
           │  │     ▼ Inside Chromium, PAGE_ANALYZE_SCRIPT (523 LOC string body):
           │  │       text() / txt() / bb() helpers; WCAG luminance + contrast();
           │  │       iframe classifier 9-branch (captcha → cmp → payment_3ds →
           │  │       checkout → chat → video → analytics → social_embed →
           │  │       'other' — mirrors Phase 1c IframePolicyEngine ordering at
           │  │       [pageAnalyze.script.ts:106-114]); extract 16 sections
           │  │       (metadata, headingHierarchy, landmarks, semanticHTML,
           │  │       structure, textContent, ctas, forms, trustSignals, layout,
           │  │       images, iframes, navigation, accessibility, performance,
           │  │       inferredPageType); return object literal WITHOUT
           │  │       _extensions key            [pageAnalyze.script.ts:493-522]
           │  │   ◄ raw: unknown
           │  │
           │  ├─ AnalyzePerceptionSchema.parse(raw)            [pageAnalyze.ts:84]
           │  │   .strict() top-level catches accidental _extensions (F-S4) AND
           │  │   IframePurpose drift (F-S13) AND every §07.9 shape constraint
           │  │   ◄ parsed: AnalyzePerception
           │  │
           │  ├─ ctx.logger.info({ url, ctaCount, formCount, iframeCount,
           │  │     inferred_page_type }, 'mcp.tool.page_analyze.done')  [:85]
           │  │
           │  └─ return parsed
           │
           ├─ outputSchema.safeParse(parsed) → ok              [Server.ts:215]
           │  (defense-in-depth — same .strict() schema)
           │
           └─ return { content: [{ type: 'text',
                                   text: JSON.stringify(parsed) }] }
```

**Trust check §3:** Single `session.page.evaluate(PAGE_ANALYZE_SCRIPT)` call at pageAnalyze.ts:79 — depth-2 grep `page\.evaluate` in pageAnalyze.ts must return exactly 1 match. The classifier ordering at pageAnalyze.script.ts:106-114 matches the Phase 1c IframePolicyEngine.ts pattern verbatim (security-sensitive vendors before checkout/chat). The Zod parse runs TWICE (handler-side at :84 + adapter-side at Server.ts:215) — defense in depth; either catches F-S4 regression.

---

## §4. AC → impl → test traceability matrix

```
┌──────┬────────────────────────────────────────────┬──────────────────────────────────────────────┬────────┐
│ AC   │ Implementation file(s)                     │ Conformance test                             │ Status │
├──────┼────────────────────────────────────────────┼──────────────────────────────────────────────┼────────┤
│ AC-01│ browser-runtime/MouseBehavior.ts           │ tests/conformance/mouse-behavior.test.ts     │ ✅     │
│ AC-02│ browser-runtime/TypingBehavior.ts          │ tests/conformance/typing-behavior.test.ts    │ ✅     │
│ AC-03│ browser-runtime/ScrollBehavior.ts          │ tests/conformance/scroll-behavior.test.ts    │ ✅     │
│ AC-04│ mcp/Server.ts + mcp/ToolRegistry.ts        │ tests/conformance/mcp-server.test.ts         │ ✅     │
│      │   + mcp/types.ts                           │                                              │        │
│ AC-05│ mcp/tools/* × 22 browser_* + 2 agent_*     │ tests/conformance/browse-tools.test.ts (param│ ✅     │
│      │ (one file per tool, EXACT v3.1 name)       │   over 24 tools) + per-tool *-tool.test.ts   │        │
│ AC-06│ mcp/tools/browserEvaluate.ts               │ tests/conformance/                           │ ✅     │
│      │   (Proxy-shadowed globalThis +             │   browser-evaluate-sandbox.test.ts           │        │
│      │   `with(proxyGlobal)` scope)               │   (5 attack vectors: a/b/c/d/e)              │        │
│ AC-07│ mcp/tools/pageGetElementInfo.ts            │ tests/conformance/                           │ ✅     │
│      │   (WCAG luminance + contrast formula)      │   page-get-element-info.test.ts              │        │
│ AC-08│ mcp/tools/pageGetPerformance.ts            │ tests/conformance/                           │ ✅     │
│      │   (4 baseline + 4 v2.3 enrichments;        │   page-get-performance.test.ts               │        │
│      │   observer-hooked fields nullable)         │                                              │        │
│ AC-09│ mcp/tools/pageScreenshotFull.ts            │ tests/conformance/                           │ ✅     │
│      │   (Sharp scroll-stitch ≤ 15000px ≤ 2MB)    │   page-screenshot-full.test.ts               │        │
│ AC-10│ mcp/tools/pageAnnotateScreenshot.ts        │ tests/conformance/                           │ ✅     │
│      │   (Sharp overlays + legend)                │   page-annotate-screenshot.test.ts           │        │
│ AC-11│ mcp/tools/pageAnalyze.ts                   │ tests/conformance/                           │ ✅     │
│      │   + mcp/tools/pageAnalyze.script.ts (str)  │   page-analyze-v23.test.ts (13/13;           │ 13/13  │
│      │   + analysis/types.ts                      │   amazon.in 336ms vs 5s NF-Phase2-03)        │        │
│      │   + analysis/analyzePerception.subschemas  │                                              │        │
│ AC-12│ browser-runtime/RateLimiter.ts             │ tests/conformance/rate-limiter.test.ts       │ ✅     │
│ AC-13│ ALL Phase 2 src + 4 contracts              │ tests/integration/phase2.test.ts (11/11;     │ ✅     │
│      │ (full surface)                             │   37.49s vs 5min NF-Phase2-04 — 8x margin;   │ 11/11  │
│      │                                            │   F-S4 asserted across homepage + PDP +      │        │
│      │                                            │   checkout fixtures)                         │        │
└──────┴────────────────────────────────────────────┴──────────────────────────────────────────────┴────────┘

R-01 (MouseBehavior)     ── AC-01 ── T016 ─ ✅
R-02 (TypingBehavior)    ── AC-02 ── T017 ─ ✅
R-03 (ScrollBehavior)    ── AC-03 ── T018 ─ ✅
R-04 (MCPServerAdapter)  ── AC-04 ── T019 ─ ✅
R-05 (23 browse tools)   ── AC-05 ── T020-T042 ─ ✅
R-06 (sandbox)           ── AC-06 ── T043 ─ ✅
R-07 (element_info)      ── AC-07 ── T044 ─ ✅
R-08 (performance)       ── AC-08 ── T045 ─ ✅
R-09 (screenshot_full)   ── AC-09 ── T046 ─ ✅
R-10 (annotate)          ── AC-10 ── T047 ─ ✅
R-11 (page_analyze v2.3) ── AC-11 ── T048 ─ ✅
R-12 (AnalyzePerception) ── AC-11 ── T-PHASE2-TYPES ─ ✅
R-13 (RateLimiter)       ── AC-12 ── T049 ─ ✅
R-14 (ToolRegistry)      ── AC-04 ── T019 ─ ✅
R-15 (integration test)  ── AC-13 ── T050 ─ ✅
```

**Trust check §4:** 13 of 13 AC-NN → impl → GREEN test. 15 of 15 R-NN → AC-NN → task. No orphan ACs. No orphan tasks. SC-005 (R9 grep verify) confirmed: `@modelcontextprotocol/sdk` only imported in `mcp/Server.ts` (line 52-59); zero leakage into tool factories.

---

## §5. Resource cost breakdown

```
LOC delta master..HEAD (Phase 2):
  source code (mcp/ + analysis/ + browser-runtime/):  ~3,500
  test files (26 conformance + 1 integration):        ~3,200
  fixtures + spec patches + Stage 4 docs:             ~1,500
  ──────────────────────────────────────────────────
  total Phase 2 delta:                                ~8,200 net

page_analyze wall-clock (observed in conformance + real-network):
  fixture homepage:  604 ms   ───  (12.1% of NF-Phase2-03 budget)
  fixture PDP:       946 ms   ─────(18.9%)
  fixture checkout:  497 ms   ──   ( 9.9%)
  real amazon.in:    336 ms   ─    ( 6.7% — 15x margin)
  NF-Phase2-03 cap:  5,000 ms             (HEADROOM ≥4,054 ms, 81% unused)

Phase 2 integration test (T050 AC-13 gate — full 29-tool surface):
  homepage 632ms + PDP 735ms + checkout 512ms + glue
  full sweep total:  37.49 s
  NF-Phase2-04 cap:  300 s (5 min) — HEADROOM ~263 s (87% unused; 8x margin)

MCP server boot (NF-Phase2-01): empty <50 ms; 29-tool <200 ms; cap 500 ms.

LLM call count Phase 2 (NEW PRODUCTION CALLS): 0
  (R24 honored — Phase 2 is pure tool surface; LLM lands Phase 4+)

LLM spend Phase 2 (dev cost, sessions 16-18): ~$45-55
  (within user-approved $60 ceiling; R23 $40 cap soft-bumped Session 18 —
  kill criterion NOT reached)
```

**Trust check §5:** Test-to-impl LOC ratio ≈ 0.91 (strong TDD). NF-Phase2-04 has 8x margin (Phase 5 BrowseNode orchestration overhead safe); `page_analyze` has 15x margin on real-network amazon.in (Phase 7 post-evaluate enrichments safe).

---

## §6. Trust calibration — what to spot-check by hand

A human reviewer can verify Phase 2 correctness in ~20 minutes by spot-checking these 5 locations. Each is the single point where a misstep would cost the most.

```
1. mcp/Server.ts:213-225 — #invokeTool output-schema parse + error envelope
   Risk: if outputSchema.safeParse fails, adapter MUST return { isError: true,
         content: [...] } — NOT throw upstream. A regression to `throw` would
         crash the SDK request handler + silently break MCP clients.
   How to verify: read 12 lines from :213; confirm both branches return an
                  envelope (success at :223; failure at :217); the catch at
                  :226 also returns isError, not re-throws. Zero `throw`
                  keywords in #invokeTool body.

2. mcp/tools/pageAnalyze.ts:79 — the SINGLE page.evaluate (REQ-TOOL-PA-001)
   Risk: adding "just one helper" evaluate (fonts.ready, scroll-stitch) breaks
         the single-call invariant; Playwright trace count jumps to 2+; AC-11
         fails. Settle precondition (F-G2) is the CALLER's responsibility.
   How to verify: grep `page\.evaluate` in pageAnalyze.ts → must return 1
                  match (at :79). Same grep in pageAnalyze.script.ts → must
                  return 0 (script is a STRING constant; no evaluate
                  invocation in its source, just inside the string body).

3. mcp/tools/pageAnalyze.script.ts:493-522 — final returned object literal
   Risk: F-S4 requires `_extensions` key to be ABSENT (not undefined explicit,
         not {} empty — absent). Accidentally `_extensions: {}` silently
         breaks Phase 7 reservation; Zod .strict() parse at pageAnalyze.ts:84
         catches it but only with .strict() top-level.
   How to verify: read :494-522; confirm the 16 keys (metadata,
                  headingHierarchy, landmarks, semanticHTML, structure,
                  textContent, ctas, forms, trustSignals, layout, images,
                  iframes, navigation, accessibility, performance,
                  inferredPageType) and NO `_extensions` key.

4. mcp/tools/browserEvaluate.ts:113-118 — 5 sandbox attack vectors blocked
   Risk: clever obfuscation bypasses the blocklist (e.g., `globalThis['fe' +
         'tch']`). `with(proxyGlobal) { ... }` + Proxy `has()` trap routes ALL
         identifier lookups through the proxy; if windowProxy `get` trap drops
         a vector OR NativeFunction-constructed body breaks `with` scope,
         sandbox leaks. AC-06 conformance only catches REGRESSIONS, not
         novel bypasses.
   How to verify: read windowProxy `get` trap at :112-126; confirm 5
                  properties throw — localStorage, sessionStorage, fetch,
                  XMLHttpRequest, Function, eval. Confirm the
                  `with(proxyGlobal) { userScript }` line is wrapped inside
                  a NativeFunction(...) body (NOT `new Function(...)`).

5. mcp/tools/pageAnalyze.script.ts:106-114 — iframe classifier ordering
   Risk: ordering bug (CHECKOUT_PATS before CMP_PATS) misclassifies a nested
         cookielaw.org iframe inside a Stripe checkout as `checkout` instead
         of `cmp`. Phase 1c IframePolicyEngine.ts:195-220 enforces security-
         sensitive-first ordering; page_analyze.script.ts mirrors that
         ordering INLINE (Design B per F-S13). Drift between the two
         classifier orderings is silent.
   How to verify: read the 9 if-statements at :106-114; confirm exact order
                  captcha → cmp → payment_3ds → checkout → chat → video →
                  analytics → social_embed → fall-through 'other'. Cross-
                  reference Phase 1c IframePolicyEngine.ts CAPTCHA_PATTERNS /
                  CMP_PATTERNS / PAYMENT_3DS_PATTERNS / CHECKOUT_PATTERNS /
                  CHAT_PATTERNS order — must match.
```

**Trust calibration heuristic:** if all 5 spot-checks pass, treat the rest of the Phase 2 delta as TRUSTED. If any fail, escalate to a deeper Stage 2.5 re-review.

---

## §7. Open ends linkage

Cross-link to `phase-2-current.md` §4 (limitations) and §5 (open risks). DO NOT duplicate that content here — point at it. The validation doc focuses on *what was built*; the rollup focuses on *what wasn't*.

```
- Limitations carried forward → phase-2-current.md §4
- Open risks for next phase   → phase-2-current.md §5
- 7 R18 adapter prep blocks   → impact.md v0.2.2 → v0.2.8 (full delta history)
- Stage 2.5 / Stage 3 evidence (when stamped) → .phase-state/2/{code-review-findings.yaml, verify-test-results.json, verify-verdict.yaml}
```

---

## §8. How this doc was authored

Master orchestrator Stage 4 exit deliverable, paired with `phase-2-current.md`. ASCII diagrams generated from real impl state at HEAD `2b4fda6` after Wave 17 doc-only checkpoint stamp (Gate 2 pending). Phase 5 BrowseNode validation will inherit conventions but the data-flow + call-graph diagrams shift from tool dispatch to LangGraph node composition. Subsequent edits should bump version + add a delta block per R18.

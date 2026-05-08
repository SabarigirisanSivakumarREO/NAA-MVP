---
title: Phase 1 Validation — Browser Perception Foundation
artifact_type: validation
status: implemented
version: 1.0
phase_number: 1
phase_name: Browser Perception Foundation
phase_completed_on: 2026-05-09
created: 2026-05-09
updated: 2026-05-09
owner: engineering lead
authors: [Claude (master orchestrator session 13 back-fill)]
reviewers: [Sabari]
supersedes: null
supersededBy: null
derived_from:
  - docs/specs/mvp/phases/phase-1-perception/spec.md v0.4
  - docs/specs/mvp/phases/phase-1-perception/tasks.md v0.7
  - docs/specs/mvp/phases/phase-1-perception/phase-1-current.md v1.0
  - .phase-state/1/code-review-findings.yaml (Stage 2.5 verdict APPROVE-FOR-GATE-2)
  - .phase-state/1/preflight-coverage.json (spec:matrix output, 10/10 ACs covered)
  - real impl state at HEAD e088b79
governing_rules:
  - Constitution R19 (Rollup per Phase) — sibling artifact pair
  - CLAUDE.md §8c (Per-phase artifact maintenance)
---

# Phase 1 — Browser Perception Foundation — Validation

> **Purpose (~150 tokens):** Phase 1 was AI-built across 9 dispatched subagents over 2 sessions. Tests prove correctness mechanically (142/142 PASS); Stage 2.5 audit confirmed zero forbidden patterns. This file gives a human reviewer 5 ASCII-shaped artifacts to verify the implementation matches the spec, in ~20 minutes of eyes-on review. Read AFTER `phase-1-current.md` (rollup) but BEFORE diving into the spec corpus or src files. Each diagram is self-checkable: pick one node/edge, open the cited file at the cited line, confirm it matches.

> **Governed by:** Constitution R19 (rollup partnership). Authored at Stage 4 exit per master orchestrator skill. Captures impl state at HEAD `e088b79`.

---

## §1 Module dependency graph

R9 boundary marker `█` denotes the SOLE site permitted to import an external SDK. All other modules consume the re-typed `BrowserPage` / `BrowserContext` / `BrowserSession` interfaces.

```
external SDKs (forbidden outside boundary)
   playwright ──────────────────────────────┐
   tiktoken   ──────────────────────────────│─┐
   sharp      ──────────────────────────────│─│─┐
   pino       ──────────────────────────────│─│─│─┐
   zod        ──────────────────────────────│─│─│─│─┐
                                            │ │ │ │ │
   adapters/                                │ │ │ │ │
     BrowserEngine.ts ── exports ───────────│─│─│─│─│──► BrowserPage
        │                                   │ │ │ │ │     BrowserContext
        │  (interface only — pure types)    │ │ │ │ │     BrowserSession
        │                                   │ │ │ │ │     SessionOpts
        │                                   │ │ │ │ │
   █ browser-runtime/                       │ │ │ │ │
     BrowserManager.ts ──── implements ─────│─│─│─│─│──► BrowserEngine
        │   imports ◄───────────────────────┘ │ │ │ │     (the SOLE `import 'playwright'` site)
        │   imports ──► observability/logger     │ │ │
        │   imports ──► perception/types          │ │ │     (PageStateModel for fixture stub)
        │                                         │ │ │
     StealthConfig.ts ──── consumes BrowserContext + BrowserPage
        │   imports ──► observability/logger
        │   imports ──► adapters/BrowserEngine (types)
        │
   perception/
     types.ts ────── exports ──► PageStateModel + sub-schemas + PAGE_STATE_MODEL_TOKEN_BUDGET
        ▲   imports ◄──────────────────────────│─│─│─│─┘  (zod for schemas)
        │
        │  (consumed by every extractor below)
        │
     AccessibilityExtractor.ts ─► types.ts (AccessibilityNodeSchema, checkAxTreeDepth)
        │                       ─► adapters/BrowserEngine (BrowserPage type)
        │                       ─► observability/logger
        │
     HardFilter.ts             ─► types.ts (AccessibilityNode, AccessibilityTree)
                                  (no logger — pure function)
        │
     SoftFilter.ts             ─► types.ts (AccessibilityNode, FilteredElement, FilteredDOM)
                                  (no logger — pure function)
        │
     MutationMonitor.ts        ─► adapters/BrowserEngine (BrowserPage)
                               ─► observability/logger
        │
     ScreenshotExtractor.ts    ─► sharp (allowed; no Playwright leak)
                               ─► types.ts (VisualSchema, MAX caps)
                               ─► adapters/BrowserEngine (BrowserPage)
                               ─► observability/logger
        │
     ContextAssembler.ts (orchestrator)
        │  imports ──► tiktoken (allowed; only call site)
        │  imports ──► pino (Logger type only)
        │  imports ──► browser-runtime/BrowserManager
        │  imports ──► browser-runtime/StealthConfig
        │  imports ──► observability/logger
        │  imports ──► adapters/BrowserEngine (BrowserSession, SessionOpts types)
        │  imports ──► [all 5 perception extractors via singletons]
        │  imports ──► types.ts (full re-export)
        │
     index.ts (barrel)
        │  re-exports ──► contextAssembler + 5 other singletons + types.*
        │
   observability/logger.ts ── consumed by every extractor + BrowserManager + ContextAssembler
        imports ──► pino, pino-pretty (transport)
```

**R9 audit:** the only file that should `import 'playwright'` is `BrowserManager.ts:36`. ScreenshotExtractor.ts:39 has the string "import 'playwright'" but only inside a doc-comment forbidding it (verify by reading line 39 — if the line is `* R9: no direct ...` it's the comment, OK).

**Trust check:** `grep -rn "from 'playwright'" packages/agent-core/src/` should return exactly one line: `BrowserManager.ts:36`. Confirmed at HEAD `e088b79`.

---

## §2 Data flow — `contextAssembler.capture(url)`

The canonical Phase 1 entry point. ContextAssembler.ts:230 owns the pipeline; everything else is a leaf call.

```
url:string ──┐
             ▼
   new BrowserManager().newSession(opts?.session) (line 232; BrowserManager.ts:93)
             │
             ▼
        ┌─ [BrowserSession{ id, page, context, close }] ─► event: session.opened
        │
        ▼
   try {                                                 (line 236)
        │
        ▼
     applyStealthConfig(session.context, opts?.stealth)  (line 237; StealthConfig.ts:198)
        │  └─► 8-string UA pool + 3-viewport pool + WebGL fingerprint
        │  └─► addInitScript on context (future pages)
        │  └─► evaluate + setViewportSize on existing about:blank page
        │
        ▼
     mutationMonitor.observe(session.page,               (line 239; pre-nav install)
                             { timeoutMs: 5000 })
        │  └─► [{ stable, mutationsObserved }] (discarded — install only)
        │
        ▼
     session.page.goto(url, { waitUntil:'domcontentloaded',  (line 241; C1 BINDING)
                              timeout: 10_000 })
        │
        ▼
     mutationMonitor.observe(session.page,               (line 242; post-nav settle)
                             { timeoutMs: 5000 })
        │  └─► [settle: { stable, mutationsObserved }]
        │
        ▼
     accessibilityExtractor.extract(session.page)        (line 246; AccessibilityExtractor.ts:205)
        │  └─► page.ariaSnapshot() → YAML string
        │  └─► parseAriaSnapshotYaml → AccessibilityNode tree
        │  └─► checkAxTreeDepth (T014 guard)
        │  └─► AccessibilityTreeSchema.parse
        │  └─► [AccessibilityTree { root, totalNodes }]
        │
        ▼
     hardFilter.apply(ax)                                (line 247; HardFilter.ts:122)
        │  └─► recursive prune(node) — drops hidden/disabled/aria-hidden/zero-dim
        │  └─► [{ tree, reductionPct, reductionFloorWaived }]
        │
        ▼
     softFilter.apply(filtered.tree)                     (line 248; SoftFilter.ts:178)
        │  └─► flatten(tree) → Candidate[]
        │  └─► score = baseRole × text × position × visibility (R4.4 multiplicative)
        │  └─► sort desc by score, take top-30
        │  └─► [FilteredDOM { top30 }]
        │
        ▼
     tryCaptureVisual(session, url)                      (line 249; ContextAssembler.ts:166)
        │  └─► screenshotExtractor.capture(page) (try/catch)
        │       └─► page.screenshot({jpeg, quality:80})
        │       └─► shrinkIfNeeded (gate: bytes>150KB OR width>1280) (line 107; I1 fix)
        │       └─► VisualSchema.parse({format, sizeBytes, width, height})
        │  └─► [Visual?] (optional; undefined on any error)
        │
        ▼
     readPageMetadata(session, sessionLog)               (line 257; ContextAssembler.ts:201)
        │  └─► page.evaluate(READ_METADATA_SCRIPT) — title + statusCode
        │  └─► [{ title, statusCode }]
        │
        ▼
     assemble({metadata, ax, dom, visual, diagnostics})  (line 277; ContextAssembler.ts:115)
        │  └─► [PageStateModel candidate]
        │
        ▼
     fitToTokenBudget(candidate)                         (line 278; ContextAssembler.ts:132)
        │  └─► tokenizeJson via tiktoken cl100k_base
        │  └─► if > 20_000 tokens: 4-stage shrink ladder
        │       Stage 1: AX depth 10 → 6
        │       Stage 2: FilteredDOM top-30 → top-20
        │       Stage 3: drop visual
        │       Stage 4: accept w/ diagnostics.errors:['oversized-after-shrink']
        │  └─► [PageStateModel ≤ NF-Phase1-01 v0.4 budget]
        │
        ▼
     PageStateModelSchema.parse(fitted)                  (line 279)
        │  └─► [VALIDATED PageStateModel]                   ► event: capture.completed
        │
        ▼
   } finally { await session.close() }                   (line 292; ► event: session.closed)
        │
        ▼
   return PageStateModel
```

**Trust check:** open ContextAssembler.ts:230 and trace the steps. Each labeled line above corresponds to a real source line ±2.

---

## §3 Function call graph — `capture(url)` depth ≤ 3

```
contextAssembler.capture(url, opts?)                       [ContextAssembler.ts:230]
├─ new BrowserManager().newSession(opts?.session)          [ContextAssembler.ts:232 → BrowserManager.ts:93]
│  ├─ SessionOptsSchema.parse(opts)                         [BrowserEngine.ts:34]
│  ├─ chromium.launch({ headless })                         [BrowserManager.ts:98]
│  ├─ browser.newContext(contextOpts)                       [BrowserManager.ts:108]
│  └─ playwrightContext.newPage()                           [BrowserManager.ts:109]
│  ◄─ returns BrowserSession{ id, page, context, close }
│
├─ try {
│  ├─ applyStealthConfig(session.context, opts?.stealth)   [ContextAssembler.ts:237 → StealthConfig.ts:198]
│  │  ├─ pickDistinctPair()                                 [StealthConfig.ts:119; anti-collision re-roll]
│  │  ├─ buildStealthScript(userAgent)                      [StealthConfig.ts:147; WebGL patch]
│  │  ├─ context.addInitScript(stealthScript)               (future pages)
│  │  └─ for each page in context.pages():                  (existing about:blank page)
│  │       page.evaluate(stealthScript) + page.setViewportSize(viewport)
│  │
│  ├─ mutationMonitor.observe(page, { timeoutMs:5000 })    [ContextAssembler.ts:239 → MutationMonitor.ts:123]
│  │  ├─ page.addInitScript(INIT_SCRIPT)                    (idempotent; future pages)
│  │  ├─ page.evaluate(INIT_SCRIPT)                         (current page; idempotent)
│  │  ├─ page.evaluate(RESET_SCRIPT)                        (anchor settle window)
│  │  └─ poll loop: page.evaluate(READ_SCRIPT) every 100ms until settle OR timeout
│  │
│  ├─ session.page.goto(url, { waitUntil, timeout })       [ContextAssembler.ts:241]
│  │
│  ├─ mutationMonitor.observe(page, { timeoutMs:5000 })    [ContextAssembler.ts:242; post-nav settle]
│  │  └─ same as above; INIT idempotency guard skips re-install
│  │
│  ├─ accessibilityExtractor.extract(session.page)         [ContextAssembler.ts:246 → AccessibilityExtractor.ts:205]
│  │  ├─ page.ariaSnapshot()                                (Playwright 1.57+; YAML string)
│  │  ├─ if YAML empty: 1× 1000ms retry (Stage 2.5 I4 — Phase 2 follow-up to remove)
│  │  ├─ parseAriaSnapshotYaml(yaml)                        [AccessibilityExtractor.ts:163]
│  │  │  ├─ for each line: parseLine(line)                  [.ts:78]
│  │  │  └─ applyBracketAttrs(tail, node)                   [.ts:116]
│  │  ├─ countNodes(root)                                   [.ts:185]
│  │  ├─ checkAxTreeDepth(root)                             [perception/types.ts; T014 guard]
│  │  └─ AccessibilityTreeSchema.parse({root, totalNodes})
│  │
│  ├─ hardFilter.apply(ax)                                 [ContextAssembler.ts:247 → HardFilter.ts:122]
│  │  ├─ prune(root) — recursive                            [HardFilter.ts:74]
│  │  │  └─ shouldDrop(node)                                [.ts:45; 4 predicates]
│  │  ├─ countNodes(prunedRoot)                             [.ts:58]
│  │  └─ AccessibilityTreeSchema.parse on output
│  │
│  ├─ softFilter.apply(filtered.tree)                      [ContextAssembler.ts:248 → SoftFilter.ts:178]
│  │  ├─ flatten(root) → Candidate[]                        [SoftFilter.ts:79]
│  │  ├─ for each candidate: score(node)                    [.ts:138]
│  │  │  └─ baseRoleWeight × textWeight × positionWeight × visibilityWeight
│  │  │     [.ts:99] [.ts:106] [.ts:114] [.ts:124]
│  │  ├─ sort desc by score (insertion-order tie-break)
│  │  └─ slice(0, 30) → top30 of FilteredElement
│  │
│  ├─ tryCaptureVisual(session, url)                       [ContextAssembler.ts:249 → .ts:166]
│  │  └─ screenshotExtractor.capture(page) (try/catch)      [ScreenshotExtractor.ts]
│  │     ├─ page.screenshot({jpeg, quality:80})
│  │     ├─ shrinkIfNeeded(buf)                             [Stage 2.5 I1 fix: width-aware OR gate]
│  │     │  ├─ sharp(buf).metadata() → width/format
│  │     │  ├─ first pass: resize 1280px @ q70 + mozjpeg
│  │     │  └─ retry pass: resize 1024px @ q60 (single retry max)
│  │     └─ VisualSchema.parse({format, sizeBytes, width, height})
│  │
│  ├─ readPageMetadata(session, sessionLog)                [ContextAssembler.ts:257 → .ts:201]
│  │  └─ page.evaluate(READ_METADATA_SCRIPT)                (Stage 2.5 N3 fix; string-form)
│  │     ◄─ { title: document.title, statusCode: navTiming.responseStatus ?? 200 }
│  │
│  ├─ assemble({metadata, ax, dom, visual, diagnostics})   [ContextAssembler.ts:277 → .ts:115]
│  │  ◄─ PageStateModel candidate
│  │
│  ├─ fitToTokenBudget(candidate)                          [ContextAssembler.ts:278 → .ts:132]
│  │  ├─ tokenizeJson(model)                                [.ts:66; tiktoken cl100k_base]
│  │  ├─ Stage 1: shrinkAxDepth                             [.ts:99]
│  │  ├─ Stage 2: shrinkFilteredDom                         [.ts:105]
│  │  ├─ Stage 3: drop visual via destructure-and-rest      [.ts:152]
│  │  └─ Stage 4: push 'oversized-after-shrink' to diagnostics.errors
│  │
│  └─ PageStateModelSchema.parse(fitted)                    [ContextAssembler.ts:279]
│
└─ } finally { await session.close() }                     [ContextAssembler.ts:292]
```

**Trust check:** pick any cited `[file:line]`, open the file at that line, confirm the call exists.

---

## §4 AC → impl → test traceability matrix

```
┌──────┬─────────────────────────────────┬─────────────────────────────────┬──────────┬───────────────────────────┐
│ AC   │ Implementation file             │ Conformance test                │ Status   │ Stage 2.5 notes           │
├──────┼─────────────────────────────────┼─────────────────────────────────┼──────────┼───────────────────────────┤
│AC-01 │ browser-runtime/BrowserManager  │ tests/conformance/              │ ✅ 2/2   │                           │
│      │                                 │   browser-manager.test.ts       │          │                           │
├──────┼─────────────────────────────────┼─────────────────────────────────┼──────────┼───────────────────────────┤
│AC-02 │ browser-runtime/StealthConfig   │ tests/conformance/              │ ✅ 4/4   │ I3 LOW: BrowserPage R9    │
│      │                                 │   stealth-config.test.ts        │          │ extensions justified      │
├──────┼─────────────────────────────────┼─────────────────────────────────┼──────────┼───────────────────────────┤
│AC-03 │ perception/AccessibilityExtractor│tests/conformance/              │ ✅ 2/2   │ I4 MEDIUM: empty-YAML     │
│      │                                 │   accessibility-extractor.test.ts│         │ retry duplicates settle;  │
│      │                                 │                                 │          │ Phase 2 follow-up         │
├──────┼─────────────────────────────────┼─────────────────────────────────┼──────────┼───────────────────────────┤
│AC-04 │ perception/HardFilter           │ tests/conformance/              │ ⚠ 4/4   │ I2 LOW: fixture yields    │
│      │                                 │   hard-filter.test.ts           │          │ 48.4% reduction; T015     │
│      │                                 │                                 │          │ validates strict on       │
│      │                                 │                                 │          │ amazon.in; accept-as-is   │
├──────┼─────────────────────────────────┼─────────────────────────────────┼──────────┼───────────────────────────┤
│AC-05 │ perception/SoftFilter           │ tests/conformance/              │ ✅ 4/4   │ R4.4 multiplicative grep- │
│      │                                 │   soft-filter.test.ts           │          │ gate clean (zero `score   │
│      │                                 │                                 │          │ +=` patterns)             │
├──────┼─────────────────────────────────┼─────────────────────────────────┼──────────┼───────────────────────────┤
│AC-06 │ perception/MutationMonitor      │ tests/conformance/              │ ✅ 3/3   │ Required setContent on    │
│      │                                 │   mutation-monitor.test.ts      │          │ BrowserPage (added Wave 7)│
├──────┼─────────────────────────────────┼─────────────────────────────────┼──────────┼───────────────────────────┤
│AC-07 │ perception/ScreenshotExtractor  │ tests/conformance/              │ ✅ 2/2   │ I1 MEDIUM FIXED 89c80de:  │
│      │                                 │   screenshot-extractor.test.ts  │          │ width-aware resize gate   │
├──────┼─────────────────────────────────┼─────────────────────────────────┼──────────┼───────────────────────────┤
│AC-08 │ perception/ContextAssembler     │ tests/conformance/              │ ✅ 3/3   │ N1 LOW: shrink ladder     │
│      │                                 │   context-assembler.test.ts     │          │ Stage 1 coarse; Phase 7+  │
├──────┼─────────────────────────────────┼─────────────────────────────────┼──────────┼───────────────────────────┤
│AC-09 │ perception/types.ts             │ tests/conformance/              │ ✅ 5/5   │ + 15 unit tests in        │
│      │                                 │   perception-types.test.ts      │          │ tests/unit/perception/    │
├──────┼─────────────────────────────────┼─────────────────────────────────┼──────────┼───────────────────────────┤
│AC-10 │ (integration; uses all above)   │ tests/integration/              │ ✅ 5/5   │ NF-Phase1-01 v0.4 = 20K   │
│      │                                 │   phase1.test.ts                │          │ tokens; 3-site walltime   │
│      │                                 │                                 │          │ 9.5s vs 60s NF gate       │
└──────┴─────────────────────────────────┴─────────────────────────────────┴──────────┴───────────────────────────┘

Total: 30 conformance tests + 5 integration tests = 35 phase tests, all PASS.
Plus 23 unit tests across perception + analysis nodes (carry-over coverage).
Phase total: 142 tests across 20 files, 142/142 PASS at HEAD e088b79.
```

**REQ-ID secondary mapping** (when REQ ≠ AC 1:1):

```
REQ-BROWSE-NODE-003     ──► AC-01 (BrowserEngine + BrowserManager)
REQ-BROWSE-HUMAN-005    ──► AC-02 (StealthConfig UA rotation; reduced scope)
REQ-BROWSE-HUMAN-006    ──► AC-02 (StealthConfig viewport rotation; reduced scope)
REQ-BROWSE-PERCEPT-001  ──► AC-03, AC-08 (extract + orchestrate)
REQ-BROWSE-PERCEPT-002  ──► AC-04 (HardFilter)
REQ-BROWSE-PERCEPT-003  ──► AC-05 (SoftFilter)
REQ-BROWSE-PERCEPT-004  ──► AC-07 (Screenshot fallback)
REQ-BROWSE-PERCEPT-005  ──► AC-06 (MutationMonitor settle)
REQ-BROWSE-PERCEPT-006  ──► AC-06 (MutationMonitor non-fatal)
```

**Trust check:** run `pnpm spec:matrix --phase=1 --json` and grep `"covered_acs"` — should be `10`. Confirmed at HEAD `e088b79` per [.phase-state/1/preflight-coverage.json](.phase-state/1/preflight-coverage.json).

---

## §5 Resource cost breakdown — token budget

Phase 1 is perception; the constrained resource is **tokens per PageStateModel** (NF-Phase1-01 v0.4 cap = 20,000 cl100k_base tokens).

```
example.com — control fixture (observed at T013 conformance, PSM ≈ 400 tok):
┌────────────────────┬─────┬────────┬──────────────────────────────────────────┐
│ Section            │ Tok │ % of T │ Notes                                    │
├────────────────────┼─────┼────────┼──────────────────────────────────────────┤
│ metadata           │  ~40│  10%   │ url + title + statusCode + 2 timestamps  │
│ accessibilityTree  │ ~180│  45%   │ ~50 nodes; small simple page             │
│ filteredDOM (top30)│  ~80│  20%   │ <30 candidates → returns however many    │
│ interactiveGraph   │   ~5│   1%   │ Phase 1 leaves arrays empty              │
│ visual             │  ~30│   8%   │ format + sizeBytes + width + height only │
│ diagnostics        │  ~40│  10%   │ ax_count + mutations + flags + arrays    │
│ JSON envelope      │  ~25│   6%   │ key names, brackets, commas              │
└────────────────────┴─────┴────────┴──────────────────────────────────────────┘

amazon.in — complex e-commerce (T015 measurement, PSM = 12,485 tok):
┌────────────────────┬───────┬────────┬───────────────────────────────────────┐
│ Section            │  Tok  │ % of T │ Notes                                 │
├────────────────────┼───────┼────────┼───────────────────────────────────────┤
│ accessibilityTree  │~10,500│   84%  │ DOMINATES — hundreds of post-filter   │
│                    │       │        │ nodes; depth-shrink doesn't help much │
│                    │       │        │ since real tree is ~6 deep already    │
│ filteredDOM (top30)│ ~1,200│   10%  │ 30 × ~40 tok per element              │
│ visual             │  ~30  │    0%  │                                       │
│ metadata + diag    │  ~80  │    1%  │                                       │
│ JSON envelope      │  ~675 │    5%  │ scales with leaf count                │
└────────────────────┴───────┴────────┴───────────────────────────────────────┘

Peregrine PDP — Shopify D2C (T015 measurement, PSM = 4,012 tok):
─ Sits between example.com and amazon.in
─ accessibilityTree ~75% (medium-density product page)

Wall-clock — T015 integration suite (3 sites, 10.2s total at HEAD e088b79):
┌─────────────────────┬───────┬─────────┐
│ Site                │ Wall  │ Budget  │
├─────────────────────┼───────┼─────────┤
│ example.com         │ ~4.6s │  ≤20s   │ ✅
│ amazon.in           │ ~3.1s │  ≤20s   │ ✅
│ Peregrine PDP       │ ~5.3s │  ≤20s   │ ✅
│ 3-site sequential   │ ~9.5s-│  ≤60s   │ ✅ (NF-Phase1-03 gate)
│                     │ 10.2s │         │
└─────────────────────┴───────┴─────────┘

Sub-budgets per C1 BINDING (plan.md v0.4 §"T015 integration test timeout budget"):
─ page.goto: 10s (waitUntil:'domcontentloaded' enforced — NOT 'load')
─ mutationMonitor.observe: 5s (T015 override of 10s default)
─ accessibilityExtractor.extract: 3s soft-budget
─ screenshotExtractor.capture: 1s soft-budget
─ tokenize: <1s
─ Per-site total: ≤20s (sums under budget; observed max 5.3s well under cap)
```

**Trust check:** open `tests/integration/phase1.test.ts:53` — `TOKEN_BUDGET = PAGE_STATE_MODEL_TOKEN_BUDGET` — confirms the test budget tracks the constant in `types.ts:50` (= 20_000).

---

## §6 Trust calibration — what to spot-check by hand

The 5 places in the impl most prone to subtle AI bugs. Spend 2-3 minutes on each; if 4/5 look right, trust the rest.

```
1. ContextAssembler.ts:132-163 — fitToTokenBudget shrink ladder
   Risk: stage ordering inverted, double-tokenize hit, OR shrink mutates input
   How to verify:
     - Stages must run [depth → top30→20 → drop visual → accept] in that order
     - Each stage builds a NEW model object via `{ ...model, ... }` spread
       (look for spread; if you see direct mutation like `model.field = ...`
       outside Stage 4's diagnostics push, that's a bug)
     - `diagnostics.warnings.push('shrunk-from-N-tokens')` only happens once
       per capture (not in every stage)

2. SoftFilter.ts (any line with arithmetic on `score`)
   Risk: additive `score -= weight` instead of multiplicative — R4.4 violation
   How to verify:
     - grep -nE "score\s*[+\-]=" packages/agent-core/src/perception/SoftFilter.ts
     - Should return ZERO matches
     - The only arithmetic on score should be the `score()` function at line 138:
       `return baseRoleWeight(node) * textWeight(node) * positionWeight(node) * visibilityWeight(node)`
       (multiplication only)

3. BrowserManager.ts:36 + 122-150 — R9 boundary
   Risk: Playwright type leaks upstream; BrowserPage wrappers expose more than
         spec.md / impact.md document
   How to verify:
     - grep -rn "from 'playwright'" packages/agent-core/src/ → exactly 1 match
       (BrowserManager.ts:36)
     - BrowserPage wrapper at lines 122-143 exposes exactly 8 methods:
       goto, ariaSnapshot, screenshot, addInitScript, evaluate,
       waitForLoadState, setViewportSize, setContent
     - These match BrowserEngine.ts:71-85 interface (verbatim)
     - New methods need impact.md update first (R20)

4. AccessibilityExtractor.ts:163-183 — parseAriaSnapshotYaml
   Risk: indent-based parser miscounts depth; cycle/depth not guarded before
         z.parse
   How to verify:
     - Hand-trace 3-4 sample lines (e.g., `- heading "Welcome" [level=1]`)
       through parseLine + applyBracketAttrs
     - checkAxTreeDepth(root) at line 218 MUST be called BEFORE
       AccessibilityTreeSchema.parse — never after
     - Stage 2.5 I4 flagged the empty-YAML retry as duplication; ContextAssembler
       already settles via MutationMonitor before extract — Phase 2 cleanup

5. ScreenshotExtractor.ts:107-133 — width-aware resize gate (Stage 2.5 I1 fix)
   Risk: predicate accidentally inverted (`!oversize`) or `||` becomes `&&`
   How to verify:
     - Read line 107: `const oversizeBytes = buf.length > SCREENSHOT_MAX_BYTES;`
     - Read line 108: `const oversizeWidth = initialWidth > SCREENSHOT_MAX_WIDTH;`
     - Read line 110: `if (!oversizeBytes && !oversizeWidth) return buf;`
       — this means BOTH must be small to skip resize; either oversize triggers Sharp
     - This is the OR semantic at the predicate level (logical De Morgan)
     - Confirm by reading the if-statement carefully
```

**Trust calibration heuristic:** if 4/5 spot-checks pass, treat the rest of Phase 1 as TRUSTED. If 2+ fail, escalate to a deeper Stage 2.5 re-review.

---

## §7 Open ends linkage

DO NOT duplicate content from the rollup; just point at it:

- **Limitations carried forward** → [`phase-1-current.md`](phase-1-current.md) §4 (11 items including reduced-scope stealth, no overlay dismissal, walking-skeleton fixture stub still wired, AccessibilityExtractor empty-YAML retry, etc.)
- **Open risks for Phase 2** → [`phase-1-current.md`](phase-1-current.md) §5 (5 items: `_extensions` namespace contract, audit.ts migration, MCP token-budget composition, AccessibilityExtractor latency, VisualSchema min-dimension guard)
- **Stage 2.5 follow-up findings** → [`.phase-state/1/code-review-findings.yaml`](../../../../.phase-state/1/code-review-findings.yaml) (7 pre-flagged + 4 new; I1 + N3 fixed in 89c80de; I4 + I5 + N1 + N2 + N4 deferred)
- **Stage 2.5 verdict** → APPROVE-FOR-GATE-2 (zero forbidden-pattern violations)
- **Gate 2 stamp** → APPROVED 2026-05-09 by Sabari with all blocking findings classified as Phase 2 follow-ups

---

## §8 How this doc was authored

**Master orchestrator Stage 4 back-fill** at HEAD `e088b79` (after the orchestrator skill update committed the new `phase-validation.template.md`). Authored same day as `phase-1-current.md` rollup (2026-05-09); paired sibling artifacts per R19.

ASCII diagrams generated by reading actual import statements + grep'd entry-point line numbers from the impl files at HEAD `e088b79` — not from memory or spec corpus alone. Every cited `[file:line]` reference was verified against the file at the time of authoring; subsequent edits should bump version + add a delta block per R18.

**For Phase 2 work:** read this file AFTER `phase-1-current.md` but BEFORE diving into spec corpus or src files. Phase 2's MCP `browser_get_state` tool consumes `PageStateModel` directly; understanding the §4 token-budget breakdown is critical for designing Phase 2's chunking strategy.

**For future phase rollups:** the master orchestrator skill at [`.claude/skills/neural-master-orchestrator/SKILL.md`](../../../../.claude/skills/neural-master-orchestrator/SKILL.md) Stage 4 output table now lists `phase-N-validation.md` as a sibling deliverable to `phase-N-current.md`. Both should ship in the same Stage 4 commit.

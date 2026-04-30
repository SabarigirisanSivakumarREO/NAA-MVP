# Session Handover — Engineering Diagram Build

**Status:** Sprint 1.2 complete. **11 / ~152 nodes built (7%) · 2 / 33 layers built (6%).**
**Next action:** Sprint 1.3 — Layer 3 (Audit State Contract, 4 nodes from §05).
**Last session ended:** 2026-04-30. Context budget exceeded 60%, switched sessions.

---

## TL;DR for the new session

1. Read this file end-to-end (you're reading it now). Then read the 4 critical files listed below.
2. Confirm the preview server is running (instructions below). If not, restart it.
3. Read §05 spec, add Layer 3's 4 nodes via Edit on `architecture-engineering.html`, add edges, smoke test, verify in browser.
4. Continue the checklist one layer per turn until 33 layers populated.
5. Then run final edge pass + grounding audit.

---

## What we're building

`docs/specs/final-architecture/diagrams/architecture-engineering.html` — an interactive engineering architecture diagram for Neural (REO Digital's AI CRO Audit Platform).

- **~152 nodes across 33 layers** organized into 4 Parts (A/B/C/D)
- **Layered architecture pattern** — strict horizontal banding, top-to-bottom flow, custom SVG, orthogonal edge routing through explicit gutters
- **Audience:** engineers, architects, AI agents needing full corpus fidelity
- **Drawer per node** with purpose, internal architecture, dependencies, inputs/outputs, real example, source spec citations

Companion artifact (already done): `architecture-business.html` — 53 nodes, business-stakeholder view.

---

## Critical files to read in the new session

| Order | File | Why |
|---|---|---|
| 1 | `docs/specs/final-architecture/diagrams/_HANDOVER_NEXT_SESSION.md` | This file. |
| 2 | `docs/specs/final-architecture/diagrams/HANDOVER_PROMPT.md` | Original project handover (53-node business diagram done, 145-node engineering diagram pending). Establishes scope rule, canonical numbers, drawer schema, supersession list. |
| 3 | `docs/specs/final-architecture/diagrams/architecture-engineering.html` | The working artifact. Already has scaffold + Layers 1 & 2 populated. |
| 4 | `docs/specs/final-architecture/diagrams/_node-inventory-partC.json` | Pre-mined Part C (Layer 28, 8 nodes). Use directly in Sprint 5.1. |
| 5 | `docs/specs/final-architecture/diagrams/_node-inventory-partD.json` | Pre-mined Part D (Layers 29–33, 30 nodes). Use directly in Sprint 5.2–5.6. |
| 6 | `docs/specs/final-architecture/README.md` | 38-spec directory manifest. Confirms which files are `approved` vs `superseded`. |

**Do NOT read:** CLAUDE.md (MVP-scoped, out of date), `docs/specs/mvp/*`, `docs/Improvement/*`, or files marked `status: superseded` in their YAML frontmatter — specifically §31, §32-collaborative-agent-protocol, §32-interactive-analysis (all superseded by §33).

---

## The 36-step checklist (current progress)

| # | Item | Status |
|---|---|---|
| 0 | Step 0 · Scaffold (33 LAYERS, empty NODES, drawer CSS, render shell) | ✅ Done |
| 1 | Sprint 1.1 · Layer 1 · Vision & Decisions — 6 nodes (§01, §02, §03) | ✅ Done |
| 2 | Sprint 1.2 · Layer 2 · Constitution & Engineering — 5 nodes (§17) | ✅ Done |
| **3** | **Sprint 1.3 · Layer 3 · Audit State Contract — 4 nodes (§05)** | **⬅️ NEXT** |
| 4 | Sprint 1.4 · Layer 4 · Audit Orchestrator — 5 nodes (§04) | Pending |
| 5 | Sprint 2.1 · Layer 5 · Browser Mode — 17 nodes (§06, §08) [DENSE] | Pending |
| 6 | Sprint 2.2 · Layer 6 · Analyze Mode — 10 nodes (§07) | Pending |
| 7 | Sprint 2.3 · Layer 7 · Heuristic KB — 8 nodes (§09) | Pending |
| 8 | Sprint 2.4 · Layer 8 · Competitor & Versioning — 4 nodes (§10) | Pending |
| 9 | Sprint 3.1 · Layer 9 · Safety & Cost base — 5 nodes (§11) [grouped from 13] | Pending |
| 10 | Sprint 3.2 · Layer 10 · Review Gate — 6 nodes (§12) | Pending |
| 11 | Sprint 3.3 · Layer 11 · Data Layer — 8 nodes (§13) [grouped from 40 tables] | Pending |
| 12 | Sprint 3.4 · Layer 12 · Delivery Layer — 8 nodes (§14) | Pending |
| 13 | Sprint 3.5 · Layer 13 · Failure Modes — 4 nodes (§15) [grouped from 94] | Pending |
| 14 | Sprint 3.6 · Layer 14 · Implementation Phases — 4 nodes (§16) | Pending |
| 15 | Sprint 4.1 · Layer 15 · Trigger Gateway — 8 nodes (§18) | Pending |
| 16 | Sprint 4.2 · Layer 16 · Discovery Pipeline — 7 nodes (§19) | Pending |
| 17 | Sprint 4.3 · Layer 17 · State Exploration — 8 nodes (§20) | Pending |
| 18 | Sprint 4.4 · Layer 18 · Workflow Orchestration — 5 nodes (§21) | Pending |
| 19 | Sprint 4.5 · Layer 19 · Heuristic Evolution — 4 nodes (§22) | Pending |
| 20 | Sprint 4.6 · Layer 20 · Findings Engine — 6 nodes (§23) | Pending |
| 21 | Sprint 4.7 · Layer 21 · Two-Store Pattern — 4 nodes (§24) | Pending |
| 22 | Sprint 4.8 · Layer 22 · Reproducibility — 6 nodes (§25) | Pending |
| 23 | Sprint 4.9 · Layer 23 · Cost Architecture — 7 nodes (§26) [grouped from 18 gates] | Pending |
| 24 | Sprint 4.10 · Layer 24 · Durable Orchestration — 10 nodes (§27) | Pending |
| 25 | Sprint 4.11 · Layer 25 · Learning Service — 4 nodes (§28) **+ future-extending callout** | Pending |
| 26 | Sprint 4.12 · Layer 26 · Hypothesis Pipeline — 4 nodes (§29) **+ future-extending callout** | Pending |
| 27 | Sprint 4.13 · Layer 27 · Analytics Bindings — 4 nodes (§30) **+ future-extending callout** | Pending |
| 28 | Sprint 5.1 · Layer 28 · Agent Composition — 8 nodes (integrate `_node-inventory-partC.json`) | Pending |
| 29 | Sprint 5.2 · Layer 29 · Observability — 6 nodes (integrate Part D JSON) | Pending |
| 30 | Sprint 5.3 · Layer 30 · Report Generation — 5 nodes (integrate Part D JSON) | Pending |
| 31 | Sprint 5.4 · Layer 31 · Golden Test Suite — 5 nodes (integrate Part D JSON) | Pending |
| 32 | Sprint 5.5 · Layer 32 · Context Capture — 7 nodes (integrate Part D JSON) | Pending |
| 33 | Sprint 5.6 · Layer 33 · Post-Master Roadmap — 7 nodes (integrate Part D JSON, dashed border + 🚧 badge) | Pending |
| 34 | Final 1 · Cross-Part edge integration pass | Pending |
| 35 | Final 2 · Code-reviewer agent: grounding fidelity audit | Pending |

Re-create this list with `TodoWrite` at the start of the new session.

---

## Locked design decisions (do NOT re-litigate)

1. **Pattern: Layered architecture** (custom SVG with strict horizontal banding). NOT Plotly scatter, NOT Mermaid auto-layout, NOT Cytoscape force-directed. User picked this after seeing 5-pattern comparison in `pattern-comparison.html`.
2. **No side rail** for the engineering view. Cross-cutting layers (9, 13, 22, 23, 24, 29) stay in the main flow with **red-tinted layer labels**. (Side rail was for the 16-node POC only — not at full scale.)
3. **33 layers total** — original 32 plus Layer 33 (Post-Master Roadmap) added at user's request to surface the longer arc beyond the 38-spec corpus.
4. **Drawer schema** is locked exactly:
   ```js
   { id, label, layer, part, partLabel, layerLabel,
     purpose, what_happens[], inputs[], outputs[],
     dependencies:[{type, name, reason}],
     internal_architecture:{summary, components:[{name,role}], internal_flow:[]},
     why_matters, example, connected_to[], source_files[],
     future_extending_callout?:string,  // for Layers 25/26/27 only
     is_roadmap?:true                    // for Layer 33 only
   }
   ```
5. **ID prefixes per Part** (avoid collisions):
   - **A:** V (Vision §01-03), E (Engineering §17), AS (AuditState §05), AO (Orchestrator §04), BR (Browse §06,§08), AN (Analyze §07), HK (Heuristic KB §09), CV (Competitor §10), SF (Safety/Cost §11), RG (Review Gate §12), DL (Data Layer §13), DV (Delivery §14), FM (Failure Modes §15), IP (Implementation Phases §16)
   - **B:** TG (Trigger §18), DS (Discovery §19), SX (State Exploration §20), WF (Workflow §21), HE (Heuristic Evolution §22), FE (Findings Engine §23), TS (Two-Store §24), RP (Reproducibility §25), CG (Cost Guardrails §26), DO (Durable Orch §27), LS (Learning §28), HP (Hypothesis §29), AB (Analytics §30)
   - **C:** CM (Composition §33, §33a)
   - **D:** OB (Observability §34), REP (Report Gen §35), GT (Golden Tests §36), CC (Context Capture §37), RM (Roadmap Layer 33)
6. **Future-extending callout** required in `why_matters` of Layers 25, 26, 27 — links to Layer 33 roadmap items (RM1 FixGenerator, RM2 ABTestGenerator, etc.). Render as `<div class="future-extending">` block in drawer.
7. **Roadmap layer** (33) — every node carries `is_roadmap: true`; renders with dashed border + 🚧 badge.
8. **Source spec citation required** in every drawer's `source_files` array. If a node spans multiple specs, list all.
9. **Grouping rules for dense layers** (committed):
   - Layer 5 (Browser Mode): 17 grouped nodes (5 MVP graph + 1 deferred-graph bundle + 1 verify-bundle + 1 modes + 6 tool categories + 3 anti-bot)
   - Layer 9 (Safety): 5 nodes from 13 controls (graph-level / compliance / circuit+rate / cost runtime / failover)
   - Layer 11 (Data): 8 nodes from 40 tables (3 table groups + 5 rules: RLS, heuristic-content, append-only, state_ids text, repro immutability)
   - Layer 13 (Failure Modes): 4 nodes from 94 modes (22 base + 72 extensions + 7 response patterns + detection-recovery flow)
   - Layer 23 (Cost): 7 nodes from 18 gates (estimator + 5 budget + 9 runtime + tracker + kill + early-stop)

---

## Layer numbering & layout grammar

The layout engine in `architecture-engineering.html` already implements:

```
topPad
for each Part (A → B → C → D):
  partHeader (36px)
  partHeaderGap (8px)
  topGutter (28px) — first layer entry routing
  for each Layer in Part:
    layerBand (variable height: layerHMin=70px or rows × (nodeH+gapY) + 20)
    gutterBelowLayer (28px) — edge routing
  partGap (22px)
bottomPad
```

- **Nodes** placed within layer band: `158 × 50` rectangles, gap `22 × 8`, multi-row if count > nodesPerRow (~6 per row)
- **Gutters** are explicit y-bands reserved for edge routing — nodes never placed in gutters
- **Lane allocation** within shared gutters: rightward edges in top half (lanes spaced 5px), leftward in bottom half
- **Fan-out** for multi-edge nodes: exit/entry points spread across the side at `fanSpacing=14px`
- **Bridge channel** (used in POC for side-rail crossings) — NOT used in engineering view since no side rail

All layout/routing code is in the inline `<script>` in the HTML. Don't rewrite the engine — it works.

---

## Edit pattern for adding a layer

For each Sprint, the workflow is:

```
1. TodoWrite: mark current Sprint item in_progress
2. Read the source spec(s) for that layer
3. Edit architecture-engineering.html — find the closing `}` of the previous layer's last node, append new layer's nodes after it
4. Edit architecture-engineering.html — find the EDGES array, append new internal + cross-layer edges
5. Smoke test (Bash + node script — see below)
6. Verify: curl http://localhost:3456/specs/final-architecture/diagrams/architecture-engineering.html (should be 200)
7. TodoWrite: mark current Sprint item completed
8. Brief summary in chat: progress %, key cross-references seeded, ready for next?
```

The Edit pattern uses unique anchors. The closing of a layer's last node is:
```
    connected_to:["..."],
    source_files:["..."]
  }
];
```

Replace with:
```
    connected_to:["..."],
    source_files:["..."]
  },

  // ============================================
  // LAYER N — <name>  (§<source>)
  // ============================================
  { ... node 1 ... },
  ...
  { ... node N ... }
];
```

Same approach for EDGES (anchor on the closing `}\n];` of the array).

---

## Smoke test command pattern

After every Edit, run this to validate node positions and edge paths:

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('C:/Sabari/Neural/NBA/docs/specs/final-architecture/diagrams/architecture-engineering.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
global.document = { getElementById:()=>({setAttribute:()=>{},innerHTML:'',querySelectorAll:()=>[],appendChild:()=>{},addEventListener:()=>{}}), createElementNS:()=>({}), addEventListener:()=>{} };
global.window = { location: { hash:'' } };
global.getComputedStyle = ()=>({getPropertyValue:()=>'#000'});
let src = m[1].replace(/render\(\);/, '');
src += \`
const pos = computePositions();
console.log('NODES:', NODES.length, ' EDGES:', EDGES.length);
NODES.filter(n=>n.layer===<LAYER_N>).forEach(n=>{
  const p = pos[n.id];
  console.log(' ', n.id.padEnd(4), n.label.padEnd(30), 'x=' + p.x.toFixed(0).padStart(4), 'y=' + p.y.toFixed(0).padStart(4));
});
EDGES.slice(<PREV_EDGE_COUNT>).forEach((e,i)=>{
  const idx = i+<PREV_EDGE_COUNT>;
  const s = pos[e.from], t = pos[e.to];
  const path = s && t ? edgePath(s, t, idx, pos, e.from, e.to) : '[MISSING]';
  console.log(' ', e.from + '→' + e.to, '['+e.flow+']', path);
});
\`;
eval(src);
"
```

Replace `<LAYER_N>` and `<PREV_EDGE_COUNT>` per turn.

After Sprint 1.2 (current state), `PREV_EDGE_COUNT = 9`. Sprint 1.3 will be `<LAYER_N>=3`, `PREV_EDGE_COUNT=9`.

---

## Preview server

A node http-server should be running on port 3456 serving the `docs/` folder. If `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3456/specs/final-architecture/diagrams/architecture-engineering.html"` returns anything other than `200`:

**Restart command:**
```bash
npx --yes http-server "C:/Sabari/Neural/NBA/docs" -p 3456 -s --cors
```

(Use `run_in_background:true` if running via Bash tool.)

URL: http://localhost:3456/specs/final-architecture/diagrams/architecture-engineering.html

Add `#debug` to the URL to highlight gutters (visible only on the POC; engineering view doesn't have this toggle but routing is sound).

---

## Counting discrepancies in specs (already noted)

When mining specs, watch for these heading-vs-list discrepancies. Cite the actual list, not the heading:

| Spec | Heading | Actual count |
|---|---|---|
| §02 "Locked Decisions (25)" | 14 SD-01..14 + 12 BA-01..12 = **26** |
| §02 "Deferred Decisions (6)" | DD-01..DD-07 = **7** (DD-07 is a G5-coverage-gap-fix add) |

Other quirks to watch for as you build subsequent layers — note them in chat when you spot them.

---

## Specific Sprint 1.3 instructions (your next action)

1. **Read** `C:\Sabari\Neural\NBA\docs\specs\final-architecture\05-unified-state.md` — this is §05 Unified State Contract.
2. **Add 4 nodes** to NODES array (anchor: closing `}` of E5 in Layer 2):
   - `AS1` AuditState Root (LangGraph Annotation)
   - `AS2` Phase 6+ Extensions (trigger_source, audit_request_id, templates, repro snapshot, state_graph, multi_state_perception, workflow_context, finding_rollups)
   - `AS3` v2.2 Fields (perception_quality, page_signals, pattern_findings, consistency_findings, funnel_findings, executive_summary, action_plan)
   - `AS4` Invariants (Maps as tuples for Postgres serialization, screenshots cleared after R2 write, exploration_cost_usd is audit-wide cumulative, deterministic scoring config NOT in state)
3. **Add edges** to EDGES array:
   - Layer 3 internal: `AS1→AS2`, `AS2→AS3`, `AS3→AS4` (data flow showing state evolution)
   - Cross-layer: `V5→AS1` (5-Layer architecture defines AuditState root). Forward refs to Layer 4 (`AO1→AS1`, `AS1→AO2` etc.) — defer until Sprint 1.4.
4. **Smoke test** with `<LAYER_N>=3`, `<PREV_EDGE_COUNT>=9`. Expect 15 nodes total / 12+ edges total.
5. **Mark Sprint 1.3 done in TodoWrite**, summary in chat, ask user "ready for Sprint 1.4?"

---

## File map snapshot (current diagram folder)

```
docs/specs/final-architecture/diagrams/
├── _HANDOVER_NEXT_SESSION.md           ← THIS FILE (start here)
├── _node-inventory-partC.json           ← pre-mined Part C (Layer 28, 8 nodes)
├── _node-inventory-partD.json           ← pre-mined Part D (Layers 29-33, 30 nodes)
├── HANDOVER_PROMPT.md                   ← original project handover
├── architecture-business.html           ← Done · 53 nodes, business view
├── architecture-engineering.html        ← Active · 11 nodes, 33 layers, 2/33 done
├── architecture-interactive.html        ← Legacy · ignore
├── architecture-nodes.json              ← Legacy · ignore
├── architecture-edges.json              ← Legacy · ignore
├── architecture-fallback.mmd            ← Legacy · ignore
├── master-architecture.html             ← Existing static diagram, keep
├── pattern-comparison.html              ← Done · pattern-selection rationale
├── pattern-layered-poc.html             ← Done · POC for layered pattern
├── demo-lifecycle-guide.md              ← Existing, keep
└── archive/                              ← older diagrams, ignore
```

---

## Constitution & scope reminders (Constitution R17, R20, R22)

- Every spec carries `status:` in YAML frontmatter. Load only `validated`, `approved`, `implemented`, `verified`. Skip `superseded` / `archived` / `draft`.
- Heuristics are SECRET (Rule 9) — never paste heuristic content into drawer text. Refer by ID only.
- The Ratchet (R22) — locked decisions can tighten, never weaken. If a future-session change feels like loosening a Constitution rule, stop and verify.

---

## Confirmation script for the new session

When you start the new session, the user will likely say "Continue from where the previous session left off." Your first response should be:

1. Read this file (`_HANDOVER_NEXT_SESSION.md`).
2. Read `_node-inventory-partC.json` and `_node-inventory-partD.json` to confirm they're on disk.
3. Verify preview server: `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3456/specs/final-architecture/diagrams/architecture-engineering.html"` should return `200`. If not, restart per "Preview server" section above.
4. Re-create the 36-item TodoWrite checklist with current progress (Step 0, Sprint 1.1, Sprint 1.2 = ✅; Sprint 1.3 = next).
5. Confirm with the user: "Picked up where the previous session left off. Sprint 1.2 complete (11/152 nodes). Ready to proceed with Sprint 1.3 (Layer 3, 4 nodes from §05). Say go and I'll read §05 and add Layer 3."

---

*End of handover. Resume Sprint 1.3 when given the go-ahead.*

---
title: Impact Analysis — <short change name>
artifact_type: impact
status: draft
version: 0.1
created: 2026-MM-DD
updated: 2026-MM-DD
owner: <name>
authors: [<name>]
reviewers: [<name>]
supersedes: null
supersededBy: null
derived_from:
  - <primary spec driving this change>
req_ids:
  - <REQ-IDs introduced or modified>
breaking: false       # set true if any contract breaks
risk_level: low       # low | medium | high
delta:
  new:
    - <this impact analysis>
  changed: []
  impacted: []
  unchanged: []
governing_rules:
  - Constitution R20 (Impact Before Change)
---

# Impact Analysis — <short change name>

> **Summary (~150 tokens):** <what changes, who/what is affected, whether it breaks contracts, migration steps if any, risk level>

> **Governed by:** Constitution R20. Required for any change touching shared contracts (see R20.1 for the list).

---

## 1. Change overview

**What is changing:** <1-2 sentences>

**Why:** <business / technical rationale; link to driving spec or issue>

**Driving spec:** <path + section>

**Planned version bump:** <artifact> v<current> → v<next>

---

## 2. Affected modules

List every source file or package touched. Cite paths.

| Module | Path | Nature of change |
|---|---|---|
| BrowserManager | `packages/agent-core/src/browser-runtime/BrowserManager.ts` | New method `setStealth()` |
| PageStateModel schema | `packages/agent-core/src/perception/types.ts` | Additive field `metadata.stealthApplied` |
| ... | ... | ... |

---

## 3. Affected contracts (shared interfaces / schemas)

Before/after for every changed contract. Use diffs, not prose.

### Contract: `PageStateModel.metadata`

**Before (v1.0):**
```typescript
metadata: {
  url: string;
  title: string;
  timestamp: number;
  viewport: { width: number; height: number };
}
```

**After (v1.1):**
```typescript
metadata: {
  url: string;
  title: string;
  timestamp: number;
  viewport: { width: number; height: number };
  stealthApplied: boolean;     // NEW — additive, defaults to false
}
```

**Compatibility:** Additive — existing code unaffected.

---

## 4. Breaking changes

**breaking:** false (additive only) | true (specify below)

### If breaking:

| Contract | What breaks | Who's affected |
|---|---|---|
| `BrowserEngine.launch()` signature | `proxy` param moved from positional to options object | All call sites inside `browser-runtime/` |

---

## 5. Migration plan

Step-by-step migration for breaking changes. Omit if additive-only.

1. **Preparation** — <action> <files>
2. **Shadow rollout** — <feature flag or versioned branch>
3. **Cutover** — <explicit commit>
4. **Cleanup** — <removal of old path>
5. **Rollback** — <procedure if cutover fails>

---

## 6. Risk assessment

**Risk level:** low | medium | high

**Rationale:** <why this risk level>

**Specific risks:**
- <risk 1> → <mitigation>
- <risk 2> → <mitigation>

**Rollback plan:** <revert PR + rollup regeneration + downstream communication>

---

## 7. Verification

Tests that guard this change:

| Test | Location | What it asserts |
|---|---|---|
| StealthConfig conformance | `packages/agent-core/tests/conformance/stealth.test.ts` | All Playwright launches pass `bot.sannysoft.com` |
| PageStateModel schema | `packages/agent-core/tests/unit/page-state-model.test.ts` | `metadata.stealthApplied` field populated correctly |
| Integration: amazon.in | `packages/agent-core/tests/integration/amazon.test.ts` | Audit completes without CAPTCHA block |

---

## 8. Downstream ripple

Which other spec artifacts need updating after this change:

| Downstream artifact | Update needed |
|---|---|
| `PRD.md` §6.4 | Update tech stack to note stealth-plugin version pin |
| `spec-to-code-matrix.md` | Re-run `pnpm spec:matrix` |
| `phase-1-current.md` | Update at next phase rollup |
| `constitution.md` | No change (R4 already covers safety) |

---

## 9. Approval

| Reviewer | Role | Approved | Date |
|---|---|---|---|
| <name> | Product owner | ☐ | |
| <name> | Engineering lead | ☐ | |
| <name> | CRO lead (if heuristic-touching) | ☐ | |

**Do not merge the implementation PR until this impact.md is status: approved.**

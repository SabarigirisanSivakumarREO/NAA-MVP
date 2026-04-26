---
title: Conformance Test Templates — copy-paste scaffolds for Neural
artifact_type: template
status: approved
version: 1.0
created: 2026-04-24
updated: 2026-04-26
owner: engineering lead
authors: [REO Digital team, Claude]

supersedes: "docs/specs/mvp/PRD.md §19 (Appendix B) — v1.2 inline content extracted on 2026-04-24"
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (v1.2 §19 Appendix B — extracted)
  - docs/specs/mvp/testing-strategy.md §9.6 (conformance matrix — references these templates)
  - docs/specs/mvp/constitution.md R9 (Adapter Pattern) — for §6 contract template
  - docs/specs/mvp/constitution.md R7 (Database & Storage) — for §7 migration template

governing_rules:
  - Constitution R3 (TDD)
  - Constitution R9 (Adapter Pattern)
  - Constitution R15 (Quality Gates)

delta:
  new:
    - File created by extracting PRD §19 Appendix B to templates/ directory (good-spec review #7, 2026-04-24)
    - §6 Adapter contract template (LLMAdapter as canonical example) — added 2026-04-26
    - §7 Migration validation template (Drizzle schema drift detection) — added 2026-04-26
  changed:
    - Existing "How to add a new conformance test" section renumbered §6 → §8 (2026-04-26)
  impacted:
    - docs/specs/mvp/PRD.md §19 (replaced with pointer)
    - docs/specs/mvp/testing-strategy.md §9.6 (matrix expanded to 18 entries) + §9.8 (dependency test policy references these templates)
  unchanged:
    - §1-§5 (grounding rule, temperature guard, heuristic filter, append-only, reproducibility) verbatim
---

# Conformance Test Templates

> **Summary (~50 tokens):** Copy-paste-ready TypeScript conformance test scaffolds for Neural's critical components: grounding rules (GR-007), temperature guard (R10), 2-stage heuristic filter, append-only tables (R7.4), reproducibility (§25). Implement in `packages/agent-core/tests/conformance/<component>.test.ts`; one file per component.

These are templates for the `pnpm test:conformance` suite referenced in [`testing-strategy.md`](../testing-strategy.md) §9.6. Implement in `packages/agent-core/tests/conformance/`. One file per component.

## 1. Template: grounding rule conformance

```typescript
// packages/agent-core/tests/conformance/gr007.test.ts
// CONFORMANCE: REQ-GROUND-007 — no conversion predictions
// See testing-strategy.md §9.6 matrix row "GR-007"

import { describe, it, expect } from "vitest";
import { groundGR007 } from "@/analysis/grounding/rules/GR007";

describe("GR-007 conformance: no conversion predictions", () => {
  const banned = [
    { field: "recommendation", text: "Adding trust badges will increase conversion by 15%." },
    { field: "assessment", text: "The 14-field form causes a conversion-rate decrease of 10%." },
    { field: "observation", text: "Expected ROI of 3x if the CTA is above the fold." },
    { field: "recommendation", text: "This change would boost revenue significantly." },
    { field: "assessment", text: "A 20% lift is likely with this tweak." },
  ];

  for (const { field, text } of banned) {
    it(`rejects banned phrase in ${field}: "${text.slice(0, 40)}..."`, () => {
      const finding = {
        observation: field === "observation" ? text : "",
        assessment: field === "assessment" ? text : "",
        recommendation: field === "recommendation" ? text : "",
      };
      const result = groundGR007(finding);
      expect(result.pass).toBe(false);
      expect(result.reason).toMatch(/conversion prediction/i);
    });
  }

  const safe = [
    "Add trust badges above the fold. Measure with an A/B test.",
    "Reduce form fields to 8. Research shows 6-8 is the Baymard benchmark.",
    "CTA color contrast is 4.2:1, below WCAG AA 4.5:1.",
    "Prior similar sites have reported improvements with trust badges (Baymard 2024).",
  ];
  for (const text of safe) {
    it(`accepts safe recommendation: "${text.slice(0, 40)}..."`, () => {
      const result = groundGR007({
        observation: "",
        assessment: "",
        recommendation: text,
      });
      expect(result.pass).toBe(true);
    });
  }
});
```

## 2. Template: temperature guard conformance

```typescript
// packages/agent-core/tests/conformance/temperature-guard.test.ts
// CONFORMANCE: R10 reproducibility — temperature=0 on analysis LLM calls
// See testing-strategy.md §9.6 matrix row "Temperature guard"

import { describe, it, expect } from "vitest";
import { LLMAdapterWithGuard } from "@/adapters/LLMAdapterWithGuard";
import { MockLLMAdapter } from "@/adapters/MockLLMAdapter";

describe("Temperature guard conformance", () => {
  const guarded = new LLMAdapterWithGuard(new MockLLMAdapter());

  it("rejects temperature > 0 for evaluate", async () => {
    await expect(
      guarded.invoke({ system: "x", user: "y", nodeName: "evaluate", temperature: 0.7 }),
    ).rejects.toThrow(/temperature must be 0 for evaluate/i);
  });

  it("rejects temperature > 0 for self_critique", async () => {
    await expect(
      guarded.invoke({ system: "x", user: "y", nodeName: "self_critique", temperature: 0.3 }),
    ).rejects.toThrow(/temperature must be 0/i);
  });

  it("allows temperature=0 for evaluate", async () => {
    const r = await guarded.invoke({ system: "x", user: "y", nodeName: "evaluate", temperature: 0 });
    expect(r).toBeDefined();
  });

  it("allows any temperature for non-analysis nodes (e.g., executive_summary)", async () => {
    // Executive summary recommended_next_steps allows slight variation
    const r = await guarded.invoke({ system: "x", user: "y", nodeName: "executive_summary", temperature: 0.2 });
    expect(r).toBeDefined();
  });
});
```

## 3. Template: 2-stage heuristic filter conformance

```typescript
// packages/agent-core/tests/conformance/heuristic-filter.test.ts
// CONFORMANCE: §09.6 REQ-HK-020a/b — two-stage filter
// See testing-strategy.md §9.6 matrix row "2-stage heuristic filter"

import { describe, it, expect } from "vitest";
import { filterByBusinessType, filterByPageType } from "@/analysis/heuristics/filter";
import { loadHeuristics } from "@/analysis/heuristics/HeuristicLoader";

describe("2-stage heuristic filter conformance", () => {
  const all = loadHeuristics(); // 30 heuristics from heuristics-repo/

  it("Stage 1: filterByBusinessType(ecommerce) reduces 30 to ~20", () => {
    const s1 = filterByBusinessType(all, "ecommerce");
    expect(s1.length).toBeGreaterThanOrEqual(15);
    expect(s1.length).toBeLessThanOrEqual(25);
    expect(s1.every((h) => h.business_type_applicability.includes("ecommerce"))).toBe(true);
  });

  it("Stage 2: filterByPageType(checkout) reduces ~20 to 10-18", () => {
    const s1 = filterByBusinessType(all, "ecommerce");
    const s2 = filterByPageType(s1, "checkout");
    expect(s2.length).toBeGreaterThanOrEqual(10);
    expect(s2.length).toBeLessThanOrEqual(18);
    expect(s2.every((h) => h.page_type_applicability.includes("checkout"))).toBe(true);
  });

  it("Two-stage filter ≡ single-stage filter (no drift)", () => {
    const twoStage = filterByPageType(filterByBusinessType(all, "ecommerce"), "checkout");
    const singleStage = all.filter(
      (h) =>
        h.business_type_applicability.includes("ecommerce") &&
        h.page_type_applicability.includes("checkout"),
    );
    expect(twoStage.map((h) => h.id).sort()).toEqual(singleStage.map((h) => h.id).sort());
  });

  it("Stage 2 cap at 30 applied after filtering", () => {
    // Contrived case: load a mock set with > 30 heuristics matching everything
    const mockAll = Array(50).fill(null).map((_, i) => ({
      id: `MOCK-${i}`,
      business_type_applicability: ["ecommerce"],
      page_type_applicability: ["checkout"],
      // ...minimum valid heuristic shape
    }));
    const filtered = filterByPageType(filterByBusinessType(mockAll as any, "ecommerce"), "checkout");
    expect(filtered.length).toBeLessThanOrEqual(30);
  });
});
```

## 4. Template: append-only table conformance

```typescript
// packages/agent-core/tests/conformance/append-only.test.ts
// CONFORMANCE: R7.4 — append-only tables
// See testing-strategy.md §9.6 matrix row "Append-only tables"

import { describe, it, expect, afterAll } from "vitest";
import { getTestDb, closeTestDb, insertRejectedFinding } from "../helpers/db";

describe("Append-only table conformance", () => {
  const db = getTestDb();
  afterAll(() => closeTestDb(db));

  const appendOnlyTables = [
    "audit_log",
    "rejected_findings",
    "finding_edits",
    "llm_call_log",
    "audit_events",
  ];

  for (const table of appendOnlyTables) {
    it(`${table}: UPDATE is rejected`, async () => {
      const row = await insertRejectedFinding(db, { /* ... */ });
      await expect(
        db.execute(`UPDATE ${table} SET rejection_reason = 'tampered' WHERE id = $1`, [row.id]),
      ).rejects.toThrow();
    });

    it(`${table}: DELETE is rejected`, async () => {
      const row = await insertRejectedFinding(db, { /* ... */ });
      await expect(
        db.execute(`DELETE FROM ${table} WHERE id = $1`, [row.id]),
      ).rejects.toThrow();
    });
  }
});
```

## 5. Template: reproducibility conformance (nightly only)

```typescript
// packages/agent-core/tests/conformance/reproducibility.test.ts
// CONFORMANCE: §25 + NF-006 — same inputs → ≥90% finding overlap
// See testing-strategy.md §9.6 matrix row "Reproducibility"
// NOTE: this test makes REAL LLM calls. Run nightly, not on every PR.

import { describe, it, expect } from "vitest";
import { runAudit } from "@/orchestration/AuditGraph";
import { computeJaccardOverlap } from "../helpers/finding-diff";

describe("Reproducibility conformance (real LLM)", () => {
  it("Same URL + snapshot → ≥90% finding overlap", async () => {
    const url = "https://example-stable.test.neural.dev/checkout";

    const run1 = await runAudit({ url, business_type: "ecommerce", page_type: "checkout" });
    const run2 = await runAudit({ url, business_type: "ecommerce", page_type: "checkout" });

    const overlap = computeJaccardOverlap(run1.findings, run2.findings);
    expect(overlap).toBeGreaterThanOrEqual(0.9);
  }, 120000); // 2 min timeout
});
```

## 6. Template: adapter contract conformance (LLMAdapter as canonical example)

```typescript
// packages/agent-core/tests/conformance/llm-adapter-contract.test.ts
// CONFORMANCE: R9 adapter pattern + R10 temperature guard + R14.1 atomic logging
// See testing-strategy.md §9.6 matrix row "LLMAdapter contract" + §9.8 policy

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnthropicAdapter } from "@/adapters/AnthropicAdapter";
import { LLMAdapterWithGuard } from "@/adapters/LLMAdapterWithGuard";
import { MockLLMAdapter } from "@/adapters/MockLLMAdapter";

describe("LLMAdapter contract conformance", () => {
  describe("interface methods", () => {
    it("exposes invoke<T>(args) → Promise<LLMResponse<T>>", () => {
      const adapter = new AnthropicAdapter();
      expect(typeof adapter.invoke).toBe("function");
    });

    it("exposes getTokenCount(prompt) → number for pre-call budget gate (R14.2)", () => {
      const adapter = new AnthropicAdapter();
      expect(typeof adapter.getTokenCount).toBe("function");
    });
  });

  describe("failure mode handling (no vendor leakage)", () => {
    it("malformed JSON response 3× → throws LLMUnavailableError after retry", async () => {
      const mockClient = {
        messages: { create: vi.fn().mockResolvedValue({ content: [{ text: "not json" }] }) },
      };
      const adapter = new AnthropicAdapter(mockClient as any);
      await expect(
        adapter.invoke({ system: "x", user: "y", nodeName: "evaluate", temperature: 0 }),
      ).rejects.toThrow(/LLMUnavailableError|malformed/i);
      expect(mockClient.messages.create).toHaveBeenCalledTimes(3); // 1 + 2 retries per R14.5
    });

    it("vendor 429 rate limit → exponential backoff + retry, never raw vendor error", async () => {
      // Simulate first 2 calls return 429, third succeeds
      // Adapter should resolve, not throw with vendor-specific error type
    });

    it("network timeout → adapter retries once then escalates", async () => {
      // Simulate timeout on first call, success on retry
    });
  });

  describe("R14.1 atomic logging to llm_call_log", () => {
    it("every successful invoke writes log row with model, tokens, cost, duration, cache_hit", async () => {
      const logSpy = vi.fn();
      const guarded = new LLMAdapterWithGuard(new AnthropicAdapter(), { onLog: logSpy });
      await guarded.invoke({ system: "x", user: "y", nodeName: "evaluate", temperature: 0 });
      expect(logSpy).toHaveBeenCalledOnce();
      const logRow = logSpy.mock.calls[0]![0];
      expect(logRow).toMatchObject({
        model: expect.any(String),
        prompt_tokens: expect.any(Number),
        completion_tokens: expect.any(Number),
        cost_usd: expect.any(Number),
        duration_ms: expect.any(Number),
        cache_hit: expect.any(Boolean),
      });
    });

    it("every FAILED invoke also writes log row (failed calls still cost tokens)", async () => {
      const logSpy = vi.fn();
      const guarded = new LLMAdapterWithGuard(new MockLLMAdapter({ failMode: "timeout" }), { onLog: logSpy });
      await expect(
        guarded.invoke({ system: "x", user: "y", nodeName: "evaluate", temperature: 0 }),
      ).rejects.toThrow();
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy.mock.calls[0]![0]).toMatchObject({ failure_reason: expect.any(String) });
    });
  });

  describe("R10 temperature guard (LLMAdapterWithGuard wrapper)", () => {
    it("temperature > 0 on evaluate → throws", async () => {
      const guarded = new LLMAdapterWithGuard(new MockLLMAdapter());
      await expect(
        guarded.invoke({ nodeName: "evaluate", temperature: 0.7, system: "x", user: "y" }),
      ).rejects.toThrow(/temperature must be 0/i);
    });

    it("temperature = 0 on evaluate → passes through", async () => {
      const guarded = new LLMAdapterWithGuard(new MockLLMAdapter());
      const result = await guarded.invoke({
        nodeName: "evaluate",
        temperature: 0,
        system: "x",
        user: "y",
      });
      expect(result).toBeDefined();
    });

    it("non-analysis nodes (executive_summary) allow temperature > 0", async () => {
      const guarded = new LLMAdapterWithGuard(new MockLLMAdapter());
      const result = await guarded.invoke({
        nodeName: "executive_summary",
        temperature: 0.2,
        system: "x",
        user: "y",
      });
      expect(result).toBeDefined();
    });
  });

  describe("R6 IP boundary — heuristic content never logged", () => {
    it("heuristic_id appears in call records but full heuristic body does NOT", async () => {
      // Construct invoke args with heuristic content in user message,
      // assert log row only contains heuristic_id reference, not body
    });
  });
});
```

**Pattern for other adapters:** mirror this structure for `StorageAdapter`, `ScreenshotStorage`, `BrowserEngine`, `JobScheduler`, `EventBus`, `HeuristicLoader`, `NotificationAdapter`, `AuthProvider`, `DiscoveryStrategy`, `StreamEmitter`. Each adapter's contract test verifies (1) interface, (2) failure modes, (3) any adapter-specific R-rule (e.g., StorageAdapter's R7.2 RLS context, ScreenshotStorage's R7.3 not-base64-in-DB rule).

## 7. Template: migration validation conformance (Drizzle schema drift)

```typescript
// packages/agent-core/tests/conformance/migration-schema-drift.test.ts
// CONFORMANCE: R7.1 (Drizzle ORM) + R7.2 (RLS) + R7.4 (append-only) + §13 data-layer
// See testing-strategy.md §9.6 matrix row "Migration schema drift" + §9.8 policy

import { describe, it, expect, beforeAll } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getTestDb, runMigrations } from "../helpers/db";

describe("Migration schema drift conformance", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    db = getTestDb();
    await runMigrations(db);
  });

  it("every Drizzle table definition has a matching Postgres table", async () => {
    const drizzleTableNames = Object.entries(schema)
      .filter(([_, v]) => (v as any)?.[Symbol.for("drizzle:Name")])
      .map(([_, v]) => (v as any)[Symbol.for("drizzle:Name")] as string);

    const result = await db.execute<{ tablename: string }>(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    const pgTables = result.rows.map((r) => r.tablename);

    for (const tableName of drizzleTableNames) {
      expect(pgTables).toContain(tableName);
    }
  });

  it("findings table has all columns from Drizzle schema (no drift)", async () => {
    const result = await db.execute<{ column_name: string; data_type: string }>(
      sql`SELECT column_name, data_type FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'findings'`,
    );
    const pgColumns = new Set(result.rows.map((r) => r.column_name));

    // Helper that introspects Drizzle table → expected column names
    const drizzleColumns = Object.keys((schema as any).findings);
    for (const col of drizzleColumns) {
      expect(pgColumns).toContain(col);
    }
  });

  it("RLS enabled on client-scoped tables (R7.2)", async () => {
    const clientScopedTables = ["findings", "audit_runs", "screenshots"];
    for (const tableName of clientScopedTables) {
      const result = await db.execute<{ relrowsecurity: boolean }>(
        sql`SELECT relrowsecurity FROM pg_class WHERE relname = ${tableName}`,
      );
      expect(result.rows[0]?.relrowsecurity).toBe(true);
    }
  });

  it("append-only constraint enforced via trigger (R7.4)", async () => {
    const appendOnlyTables = [
      "audit_log",
      "rejected_findings",
      "finding_edits",
      "llm_call_log",
      "audit_events",
    ];
    for (const tableName of appendOnlyTables) {
      const result = await db.execute<{ tgname: string }>(
        sql`SELECT tgname FROM pg_trigger WHERE tgrelid = ${tableName}::regclass`,
      );
      const triggerNames = result.rows.map((r) => r.tgname);
      expect(
        triggerNames.some((n) => n.includes("append_only") || n.includes("no_update_delete")),
        `${tableName} missing append-only trigger`,
      ).toBe(true);
    }
  });

  it("reproducibility_snapshots immutability trigger present (R10 + §25)", async () => {
    const result = await db.execute<{ tgname: string }>(
      sql`SELECT tgname FROM pg_trigger WHERE tgrelid = 'reproducibility_snapshots'::regclass`,
    );
    expect(result.rows.some((r) => r.tgname.toLowerCase().includes("immutable"))).toBe(true);
  });

  it("pgvector extension installed", async () => {
    const result = await db.execute<{ extname: string }>(
      sql`SELECT extname FROM pg_extension WHERE extname = 'vector'`,
    );
    expect(result.rows.length).toBe(1);
  });
});
```

## 8. How to add a new conformance test

When adding a new critical component:

1. Open `testing-strategy.md` §9.6 matrix; add a row with component + conformance check + expected behavior + spec REQ-ID
2. Create `packages/agent-core/tests/conformance/<component>.test.ts` following the templates above (§1-§7 cover grounding rules, temperature guard, heuristic filter, append-only, reproducibility, adapter contract, migration validation)
3. Ensure the test covers the §9.6 matrix expected behavior at minimum
4. Run `pnpm test:conformance` — new test should pass
5. Commit with `test(conformance): add <component> conformance per §9.6 (REQ-...)`

## Cross-references

- `docs/specs/mvp/testing-strategy.md` §9.6 — conformance matrix (calls these templates by name)
- Constitution R3 (TDD)
- Constitution R15.5 (Golden test discipline — related but separate from conformance)
- PRD §10.6 (Spec coverage in PR body — lists conformance test results per component touched)
- PRD §10.9 (PR Contract Proof block — conformance test output is valid proof)

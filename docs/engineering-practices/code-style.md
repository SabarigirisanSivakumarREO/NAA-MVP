---
title: Code Style + Patterns
artifact_type: engineering-practice
status: approved
version: 1.0
created: 2026-04-24
updated: 2026-04-24
owner: engineering lead
authors: [REO Digital team, Claude]

supersedes: "docs/specs/mvp/PRD.md §11.4 (v1.2 and earlier — inline content extracted to this file)"
supersededBy: null

derived_from:
  - docs/specs/mvp/PRD.md (v1.2 §11.4 — extracted)
  - docs/specs/mvp/constitution.md R10 (Code Quality)

governing_rules:
  - Constitution R2 (Type Safety First)
  - Constitution R7, R9 (Adapter Pattern)
  - Constitution R10 (Code Quality)
  - Constitution R13 (Forbidden Patterns)
  - PRD §11.4 (source before extraction)

delta:
  new:
    - File created by extracting PRD §11.4 to separate engineering-practice doc
  changed: []
  impacted:
    - docs/specs/mvp/PRD.md §11.4 (content replaced with pointer here)
    - CLAUDE.md §5 (pointer added)
  unchanged:
    - All content (verbatim extraction; no rule changes)
---

# Code Style + Patterns

> **Summary (~80 tokens):** Code style conventions for Neural. Naming conventions, file organization rules, TypeScript patterns (Zod-first, narrow unknown, named exports, pure functions), error handling, adapter pattern usage, and logging requirements. Extracted from PRD §11.4 to separate engineering-practice from product requirements. Canonical location for TS/code conventions; PRD now points here.

## 1. Naming conventions

| Element | Convention | Example |
|---|---|---|
| Class | PascalCase | `BrowserManager`, `EvidenceGrounder`, `AnthropicAdapter` |
| Interface / type | PascalCase | `AnalyzePerception`, `LLMAdapter`, `GroundedFinding` |
| Zod schema const | PascalCase + `Schema` | `FindingSchema`, `AnalyzePerceptionSchema` |
| Function (non-component) | camelCase | `detectPageType()`, `filterByBusinessType()`, `groundGR007()` |
| React component | PascalCase | `AuditList`, `FindingDetailCard`, `ReviewInbox` |
| Variable (local, private) | camelCase | `auditRunId`, `groundedFindings`, `perceptionScore` |
| Database column | snake_case | `audit_run_id`, `business_type`, `cost_usd` |
| JSON key (external API, MCP tool I/O) | snake_case | `heuristic_id`, `element_ref`, `bounding_box` |
| Environment variable | SCREAMING_SNAKE | `ANTHROPIC_API_KEY`, `POSTGRES_URL`, `NEURAL_MODE` |
| Constant (module-scope) | SCREAMING_SNAKE | `MAX_PAGES_PER_AUDIT`, `DEFAULT_BUDGET_USD`, `MODEL_PRICING` |
| File (module) | kebab-case.ts OR PascalCase.ts (matches default export) | `browser-manager.ts` OR `BrowserManager.ts` — per workspace convention |
| Test file | `<name>.test.ts` (unit) OR `<name>.spec.ts` (Playwright) | `grounding.test.ts`, `amazon-in.spec.ts` |
| Spec REQ-ID | `REQ-<DOMAIN>-<NAME>-<NNN>` | `REQ-ANALYZE-NODE-001`, `REQ-GROUND-007` |
| Grounding rule | `GR-NNN` (3-digit) | `GR-001`, `GR-012` |
| Task ID (MVP/phase) | `M<phase>.<n>` | `M7.16`, `M2.19a` |
| Task ID (master catalog) | `T<NNN>` | `T117`, `T255` |

## 2. File organization (one concern per file)

**RULE:** Files < 300 lines; functions < 50 lines (Constitution R10.1-R10.2). Split when they grow. Each file has ONE responsibility.

**Good:**

```typescript
// packages/agent-core/src/analysis/grounding/rules/GR007.ts
// REQ-GROUND-007: NEVER predict conversion impact.
// This file exports a single pure function that checks a finding's text
// for banned conversion-prediction phrases.

import type { ReviewedFinding, GroundingResult } from "../types";

const BANNED_PATTERNS: RegExp[] = [
  /\bincrease(s|d)?\s+conversion/i,
  /\bboost(s|ed)?\s+(conversion|revenue|sales)/i,
  /\b\d+\s*%\s*(lift|increase|improvement)/i,
  /\bROI\s+of\s+\d+/i,
];

export function groundGR007(
  finding: Pick<ReviewedFinding, "observation" | "assessment" | "recommendation">,
): GroundingResult {
  const corpus = [finding.observation, finding.assessment, finding.recommendation].join(" ");
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(corpus)) {
      return {
        pass: false,
        reason: `GR-007: conversion prediction detected (${pattern} matched)`,
      };
    }
  }
  return { pass: true };
}
```

**Bad:**

```typescript
// all-grounding-rules.ts — 800 lines, 12 rules, hard to test or find

// Also bad: mixing grounding with scoring in same file
// Also bad: default export — prefer named exports for refactor-friendliness
```

## 3. TypeScript patterns

**Zod before TypeScript:** define the Zod schema, infer the type.

```typescript
// ✅ GOOD — schema is source of truth
export const FindingSchema = z.object({
  heuristic_id: z.string(),
  status: z.enum(["violation", "pass", "needs_review"]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  // ...
});
export type Finding = z.infer<typeof FindingSchema>;

// ❌ BAD — type without schema; runtime validation impossible
export type Finding = {
  heuristic_id: string;
  status: string;  // no enum constraint
  severity: string;
};
```

**Narrow `unknown`, don't use `any`:**

```typescript
// ✅ GOOD
function parseLLMResponse(raw: unknown): Finding {
  return FindingSchema.parse(raw);  // Zod throws on invalid
}

// ❌ BAD
function parseLLMResponse(raw: any): Finding {
  return raw as Finding;  // no runtime check, type lies
}
```

**Named exports; avoid default:**

```typescript
// ✅ GOOD
export function groundGR007(...) { ... }
export const GR007_RULE_ID = "GR-007" as const;

// ❌ BAD
export default function(...) { ... }  // refactor-hostile
```

**Pure functions for grounding + scoring:**

```typescript
// ✅ GOOD — deterministic, easy to test
export function computePriority(
  severity: number,
  confidence: number,
  impact: number,
  effort: number,
): number {
  return Math.round(
    (severity * 2 + impact * 1.5 + confidence * 1 - effort * 0.5) * 100,
  ) / 100;
}

// ❌ BAD — hidden dependency, untestable
export function computePriority(finding: Finding): number {
  return globalConfig.scoringWeights.severity * finding.severity + ...;
}
```

## 4. Error handling

```typescript
// ✅ GOOD — structured, includes context, correlation ID
throw new Error(
  `[GR-001] Element not found in perception. ` +
  `Finding references 'ctas[5]' but perception.ctas.length === 3. ` +
  `audit_run_id=${auditRunId} page=${pageUrl} heuristic=${heuristicId}`,
);

// ❌ BAD — opaque
throw new Error("Element not found");

// ❌ BAD — leaks IP (heuristic content)
throw new Error(`Heuristic '${heuristic.name}: ${heuristic.description}' failed`);
```

Never `catch {}` silently. Either handle (log + recover), or re-throw with added context.

## 5. Adapter pattern (Constitution R7, R9)

All external dependencies go through adapter modules. Direct imports of Anthropic SDK / Playwright / `pg` / Drizzle outside `adapters/` are FORBIDDEN.

```typescript
// ✅ GOOD — packages/agent-core/src/adapters/AnthropicAdapter.ts
import Anthropic from "@anthropic-ai/sdk";
import type { LLMAdapter, LLMResponse } from "./types";

export class AnthropicAdapter implements LLMAdapter {
  constructor(private readonly client = new Anthropic()) {}
  async invoke<T>(args: ...): Promise<LLMResponse<T>> { ... }
}

// ❌ BAD — packages/agent-core/src/analysis/nodes/EvaluateNode.ts
import Anthropic from "@anthropic-ai/sdk";  // FORBIDDEN outside adapter
```

## 6. Logging — Pino only, correlation fields mandatory

```typescript
// ✅ GOOD
import { logger } from "../../observability/logger";

logger.info(
  { audit_run_id, page_url, node_name: "deep_perceive", heuristic_id: null },
  "Perception captured",
);

// ❌ BAD
console.log("Perception captured");  // R10.6 forbids
console.log(perception);  // also dumps 50-150KB
```

## Cross-references

- Constitution R10 — canonical Code Quality rules
- Constitution R13 — forbidden patterns list
- Constitution R2 — type safety and Zod schema boundaries
- PRD §10.3 — NEVER rules that intersect with style (temperature, append-only tables, conversion predictions)

# Contracts

Type interfaces and schemas that define the boundaries between components.

## Files

| File | Content | Used By |
|------|---------|---------|
| `mcp-tools.md` | TypeScript interfaces for all 28 MCP tools | Phase 2 (T020-T048) |
| `llm-adapter.md` | LLMAdapter interface + LLMResponse types | Phase 4 (T073) |
| `storage-adapter.md` | StorageAdapter interface + Drizzle queries | Phase 4 (T074) |
| `agent-state.md` | AgentState + AuditState Annotation schemas | Phase 5 (T081), Phase 8 (T135) |
| `heuristic-schema.md` | Zod schemas for heuristics | Phase 6 (T101) |
| `analysis-pipeline.md` | RawFinding → ReviewedFinding → GroundedFinding types | Phase 7 (T119-T130) |
| `cli-output.md` | Output JSON file structures | Phase 8 (T147) |

## Source of Truth

Each contract file references the relevant section of:
- `docs/specs/AI_Browser_Agent_Architecture_v3.1.md` (browse mode)
- `docs/specs/AI_Analysis_Agent_Architecture_v1.0.md` (analyze mode)
- `docs/specs/final-architecture/05-unified-state.md` (state)
- `docs/specs/final-architecture/08-tool-manifest.md` (tools)
- `docs/specs/final-architecture/09-heuristic-kb.md` (heuristics)

When implementing, always check the source-of-truth file. Contracts here are summaries to keep handy during development, not replacements for the full spec.

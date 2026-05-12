/**
 * Phase 2 MCP layer barrel — public surface for upstream consumers
 * (Phase 4 SafetyCheck, Phase 5 BrowseNode, Phase 7 DeepPerceiveNode).
 *
 * Source: docs/specs/mvp/phases/phase-2-tools/plan.md §"Project Structure"
 *         (mcp/index.ts barrel export); tasks.md T-PHASE2-TYPES + T019.
 *
 * R10.3: named exports only. No default exports.
 *
 * Phase 2 scope at T-PHASE2-TYPES: only base types (Server.ts + ToolRegistry.ts
 * land at T019). Re-exports for those modules will be added then.
 */
export {
  SafetyClassSchema,
  type SafetyClass,
  type ToolContext,
  type MCPToolDefinition,
  type MCPToolSchema,
  assertMCPToolDefinition,
} from './types.js';

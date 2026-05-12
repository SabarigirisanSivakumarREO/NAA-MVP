/**
 * Phase 2 MCP layer barrel — public surface for upstream consumers
 * (Phase 4 SafetyCheck, Phase 5 BrowseNode, Phase 7 DeepPerceiveNode).
 *
 * Source: docs/specs/mvp/phases/phase-2-tools/plan.md §"Project Structure"
 *         (mcp/index.ts barrel export); tasks.md T-PHASE2-TYPES + T019.
 *
 * R10.3: named exports only. No default exports.
 *
 * Phase 2 scope at T019: base types (T-PHASE2-TYPES) + MCPServerAdapter +
 * InMemoryToolRegistry (T019). Per-tool registrations land at T020-T048
 * and re-export here as they ship.
 */
export {
  SafetyClassSchema,
  type SafetyClass,
  type ToolContext,
  type MCPToolDefinition,
  type MCPToolSchema,
  assertMCPToolDefinition,
} from './types.js';

export {
  type ToolRegistry,
  type ToolListEntry,
  InMemoryToolRegistry,
  DuplicateToolNameError,
  UnknownToolNameError,
} from './ToolRegistry.js';

export {
  MCPServerAdapter,
  type MCPServerAdapterOptions,
  type MCPServerInfo,
} from './Server.js';

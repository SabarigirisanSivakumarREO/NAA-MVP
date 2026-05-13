/**
 * T041 agent_complete — Phase 2 Wave 11 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T041; impact.md MCPToolRegistry
 *         Agent signals row (safetyClass='safe'); REQ-MCP-001 + REQ-MCP-002.
 *
 * Pure orchestration signal. The LLM agent calls this tool to signal that
 * it has finished work on the current page or audit. Phase 5 BrowseNode
 * interprets the signal to transition to AuditCompleteNode. No browser
 * action; no BrowserSession dependency.
 *
 * Factory takes an empty deps object for consistency with the registration
 * pattern — Phase 5 will inject all 29 tools uniformly via the same shape.
 *
 * R9 boundary: no `playwright` import. R10: ≤80 LOC; named exports only.
 */
import { z } from 'zod';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const AgentCompleteInputSchema = z
  .object({
    summary: z.string().optional(),
    reason: z.string().optional(),
  })
  .strict();

export const AgentCompleteOutputSchema = z
  .object({
    ok: z.literal(true),
    signal: z.literal('complete'),
    summary: z.string().optional(),
    reason: z.string().optional(),
  })
  .strict();

export type AgentCompleteInput = z.infer<typeof AgentCompleteInputSchema>;
export type AgentCompleteOutput = z.infer<typeof AgentCompleteOutputSchema>;

/**
 * Empty deps — preserved for uniform registration with browser tools that
 * close over BrowserSession. Phase 5 BrowseNode constructs all 29 tools
 * via a single createTool() factory caller.
 */
export type AgentCompleteDeps = Record<string, never>;

export function createAgentCompleteTool(
  _deps: AgentCompleteDeps = {},
): MCPToolDefinition<AgentCompleteInput, AgentCompleteOutput> {
  return {
    name: 'agent_complete', // EXACT v3.1 (R4.5)
    description:
      'Signal that the LLM agent has completed work on this page or audit. Phase 5 BrowseNode interprets the signal for state transition. Optional summary + reason fields.',
    inputSchema: AgentCompleteInputSchema,
    outputSchema: AgentCompleteOutputSchema,
    safetyClass: 'safe',
    handler: async (input, ctx: ToolContext): Promise<AgentCompleteOutput> => {
      ctx.logger.info(
        {
          has_summary: input.summary !== undefined,
          has_reason: input.reason !== undefined,
        },
        'mcp.tool.agent_complete.signal',
      );

      const result: AgentCompleteOutput = { ok: true, signal: 'complete' };
      if (input.summary !== undefined) result.summary = input.summary;
      if (input.reason !== undefined) result.reason = input.reason;
      return result;
    },
  };
}

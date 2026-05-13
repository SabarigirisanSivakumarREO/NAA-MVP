/**
 * T042 agent_request_human — Phase 2 Wave 11 MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T042; impact.md MCPToolRegistry
 *         Agent signals row (safetyClass='requires_hitl'); REQ-MCP-001 +
 *         REQ-MCP-002; R8.4 HITL gate.
 *
 * Pure HITL signal. The LLM agent calls this to pause execution and request
 * human intervention (CAPTCHA, ambiguous dialog, judgment call). Phase 5
 * BrowseNode interprets the signal to pause and wait for human approval.
 * No browser action; no BrowserSession dependency.
 *
 * Factory takes an empty deps object for consistency with the registration
 * pattern — Phase 5 will inject all 29 tools uniformly via the same shape.
 *
 * R9 boundary: no `playwright` import. R10: ≤80 LOC; named exports only.
 */
import { z } from 'zod';
import type { MCPToolDefinition, ToolContext } from '../types.js';

export const AgentRequestHumanInputSchema = z
  .object({
    reason: z.string().min(1),
    context: z.string().optional(),
  })
  .strict();

export const AgentRequestHumanOutputSchema = z
  .object({
    ok: z.literal(true),
    signal: z.literal('request_human'),
    reason: z.string(),
    context: z.string().optional(),
  })
  .strict();

export type AgentRequestHumanInput = z.infer<typeof AgentRequestHumanInputSchema>;
export type AgentRequestHumanOutput = z.infer<typeof AgentRequestHumanOutputSchema>;

/**
 * Empty deps — preserved for uniform registration with browser tools that
 * close over BrowserSession. Phase 5 BrowseNode constructs all 29 tools
 * via a single createTool() factory caller.
 */
export type AgentRequestHumanDeps = Record<string, never>;

export function createAgentRequestHumanTool(
  _deps: AgentRequestHumanDeps = {},
): MCPToolDefinition<AgentRequestHumanInput, AgentRequestHumanOutput> {
  return {
    name: 'agent_request_human', // EXACT v3.1 (R4.5)
    description:
      'Request human intervention (HITL pause). Use when encountering CAPTCHA, ambiguous dialog, or judgment-call situations. Phase 5 BrowseNode interprets the signal to pause execution. reason is required; optional context for additional details.',
    inputSchema: AgentRequestHumanInputSchema,
    outputSchema: AgentRequestHumanOutputSchema,
    safetyClass: 'requires_hitl',
    handler: async (input, ctx: ToolContext): Promise<AgentRequestHumanOutput> => {
      ctx.logger.info(
        { reason: input.reason, has_context: input.context !== undefined },
        'mcp.tool.agent_request_human.signal',
      );

      const result: AgentRequestHumanOutput = {
        ok: true,
        signal: 'request_human',
        reason: input.reason,
      };
      if (input.context !== undefined) result.context = input.context;
      return result;
    },
  };
}

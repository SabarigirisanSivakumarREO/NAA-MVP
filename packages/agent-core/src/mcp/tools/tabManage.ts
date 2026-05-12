/**
 * T035 browser_tab_manage — Phase 2 Wave 9b MCP tool factory.
 *
 * Source: phases/phase-2-tools/tasks.md T035 brief; impact.md MCPToolRegistry
 *         Utility row (safetyClass = 'safe'); REQ-MCP-001 + REQ-MCP-002.
 *
 * Factory pattern (locked Wave 4+): createTabManageTool({ session }) closes
 * over BrowserSession + returns MCPToolDefinition. Handler dispatches on
 * action {new, list, switch, close} to the new BrowserSession multi-tab
 * methods added in Wave 9b prep (ae9627e). Returns the post-operation tab
 * inventory + active index so callers (Phase 5 BrowseNode) can track state
 * externally without owning a separate tab pointer.
 *
 * R9 boundary: no `playwright` import. R10: ≤180 LOC; named exports only.
 */
import { z } from 'zod';
import type { BrowserSession, BrowserPage } from '../../adapters/BrowserEngine.js';
import type { MCPToolDefinition, ToolContext } from '../types.js';

const ActionSchema = z.enum(['new', 'list', 'switch', 'close']);

export const TabManageInputSchema = z
  .object({
    action: ActionSchema,
    index: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine(
    (val) => {
      // 'switch' and 'close' require index
      if ((val.action === 'switch' || val.action === 'close') && val.index === undefined) {
        return false;
      }
      return true;
    },
    {
      message: "actions 'switch' and 'close' require an integer `index` field",
    },
  );

const TabSummarySchema = z
  .object({
    index: z.number().int().nonnegative(),
    url: z.string(),
    isActive: z.boolean(),
  })
  .strict();

export const TabManageOutputSchema = z
  .object({
    ok: z.literal(true),
    action: ActionSchema,
    activeIndex: z.number().int().nonnegative(),
    tabs: z.array(TabSummarySchema),
    /** Present only for action='new' — the new tab's index. */
    newIndex: z.number().int().nonnegative().optional(),
  })
  .strict();

export type TabManageInput = z.infer<typeof TabManageInputSchema>;
export type TabManageOutput = z.infer<typeof TabManageOutputSchema>;
export type TabSummary = z.infer<typeof TabSummarySchema>;

export interface TabManageDeps {
  readonly session: BrowserSession;
}

function summarizeTabs(session: BrowserSession): TabSummary[] {
  const pages = session.pages();
  const active = session.activeIndex();
  return pages.map((p: BrowserPage, i: number) => ({
    index: i,
    url: p.url(),
    isActive: i === active,
  }));
}

export function createTabManageTool(
  deps: TabManageDeps,
): MCPToolDefinition<TabManageInput, TabManageOutput> {
  return {
    name: 'browser_tab_manage', // EXACT v3.1 (R4.5)
    description:
      'Manage tabs in the active browser context. Actions: new (open tab; does not switch), list (inventory), switch (change active by index), close (close tab by index; cannot close last).',
    inputSchema: TabManageInputSchema,
    outputSchema: TabManageOutputSchema,
    safetyClass: 'safe',
    handler: async (input, ctx: ToolContext): Promise<TabManageOutput> => {
      ctx.logger.info(
        { action: input.action, index: input.index },
        'mcp.tool.tab_manage.start',
      );

      switch (input.action) {
        case 'list': {
          const tabs = summarizeTabs(deps.session);
          ctx.logger.info(
            { action: 'list', tab_count: tabs.length },
            'mcp.tool.tab_manage.done',
          );
          return {
            ok: true,
            action: 'list',
            activeIndex: deps.session.activeIndex(),
            tabs,
          };
        }

        case 'new': {
          const newIndex = await deps.session.newPage();
          const tabs = summarizeTabs(deps.session);
          ctx.logger.info(
            { action: 'new', new_index: newIndex, tab_count: tabs.length },
            'mcp.tool.tab_manage.done',
          );
          return {
            ok: true,
            action: 'new',
            activeIndex: deps.session.activeIndex(),
            tabs,
            newIndex,
          };
        }

        case 'switch': {
          // input.index is guaranteed defined by the refine() guard.
          deps.session.setActiveIndex(input.index as number);
          const tabs = summarizeTabs(deps.session);
          ctx.logger.info(
            { action: 'switch', active_index: input.index },
            'mcp.tool.tab_manage.done',
          );
          return {
            ok: true,
            action: 'switch',
            activeIndex: deps.session.activeIndex(),
            tabs,
          };
        }

        case 'close': {
          await deps.session.closePage(input.index as number);
          const tabs = summarizeTabs(deps.session);
          ctx.logger.info(
            {
              action: 'close',
              closed_index: input.index,
              active_index: deps.session.activeIndex(),
              tab_count: tabs.length,
            },
            'mcp.tool.tab_manage.done',
          );
          return {
            ok: true,
            action: 'close',
            activeIndex: deps.session.activeIndex(),
            tabs,
          };
        }

        default: {
          // Exhaustive-check guard; Zod input parse should already catch.
          const _exhaustive: never = input.action;
          throw new Error(`browser_tab_manage: unreachable action ${String(_exhaustive)}`);
        }
      }
    },
  };
}

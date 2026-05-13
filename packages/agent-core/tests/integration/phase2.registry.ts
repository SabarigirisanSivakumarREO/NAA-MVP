/**
 * Phase 2 integration test registry helper (T050).
 *
 * Centralizes the 29-tool registration so `phase2.test.ts` stays focused on
 * assertions + flow (R10.1 LOC discipline). Mirrors the per-tool dep pattern
 * shipped at T020-T048: 26 tools take `{ session }`, 3 take empty deps
 * (agent_complete, agent_request_human, page_annotate_screenshot).
 *
 * Source:
 *   docs/specs/mvp/phases/phase-2-tools/spec.md AC-13 + R-15
 *   docs/specs/mvp/phases/phase-2-tools/tasks.md T050
 *   docs/specs/mvp/phases/phase-2-tools/impact.md §MCPToolRegistry
 *
 * R10.1: under 150 LOC. R10.3: named exports only.
 */
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';
import { InMemoryToolRegistry, type ToolRegistry } from '../../src/mcp/index.js';

import { createAgentCompleteTool } from '../../src/mcp/tools/agentComplete.js';
import { createAgentRequestHumanTool } from '../../src/mcp/tools/agentRequestHuman.js';
import { createBrowserEvaluateTool } from '../../src/mcp/tools/browserEvaluate.js';
import { createClickTool } from '../../src/mcp/tools/click.js';
import { createClickCoordsTool } from '../../src/mcp/tools/clickCoords.js';
import { createDownloadTool } from '../../src/mcp/tools/download.js';
import { createExtractTool } from '../../src/mcp/tools/extract.js';
import { createFindByTextTool } from '../../src/mcp/tools/findByText.js';
import { createGetMetadataTool } from '../../src/mcp/tools/getMetadata.js';
import { createGetNetworkTool } from '../../src/mcp/tools/getNetwork.js';
import { createGetStateTool } from '../../src/mcp/tools/getState.js';
import { createGoBackTool } from '../../src/mcp/tools/goBack.js';
import { createGoForwardTool } from '../../src/mcp/tools/goForward.js';
import { createHoverTool } from '../../src/mcp/tools/hover.js';
import { createNavigateTool } from '../../src/mcp/tools/navigate.js';
import { createPageAnalyzeTool } from '../../src/mcp/tools/pageAnalyze.js';
import { createPageAnnotateScreenshotTool } from '../../src/mcp/tools/pageAnnotateScreenshot.js';
import { createPageGetElementInfoTool } from '../../src/mcp/tools/pageGetElementInfo.js';
import { createPageGetPerformanceTool } from '../../src/mcp/tools/pageGetPerformance.js';
import { createPageScreenshotFullTool } from '../../src/mcp/tools/pageScreenshotFull.js';
import { createPressKeyTool } from '../../src/mcp/tools/pressKey.js';
import { createReloadTool } from '../../src/mcp/tools/reload.js';
import { createScreenshotTool } from '../../src/mcp/tools/screenshot.js';
import { createScrollTool } from '../../src/mcp/tools/scroll.js';
import { createSelectTool } from '../../src/mcp/tools/select.js';
import { createTabManageTool } from '../../src/mcp/tools/tabManage.js';
import { createTypeTool } from '../../src/mcp/tools/type.js';
import { createUploadTool } from '../../src/mcp/tools/upload.js';
import { createWaitForTool } from '../../src/mcp/tools/waitFor.js';

/**
 * Build a fresh ToolRegistry with all 29 Phase 2 MCP tools registered against
 * the provided BrowserSession. Order intentionally mirrors TOOL_NAMES_*
 * groupings (22 browser_* + 2 agent_* + 5 page_*).
 */
export function buildPhase2Registry(session: BrowserSession): ToolRegistry {
  const registry = new InMemoryToolRegistry();

  // 22 browser_* tools.
  registry.register(createNavigateTool({ session }));
  registry.register(createGoBackTool({ session }));
  registry.register(createGoForwardTool({ session }));
  registry.register(createReloadTool({ session }));
  registry.register(createGetStateTool({ session }));
  registry.register(createScreenshotTool({ session }));
  registry.register(createGetMetadataTool({ session }));
  registry.register(createClickTool({ session }));
  registry.register(createClickCoordsTool({ session }));
  registry.register(createTypeTool({ session }));
  registry.register(createScrollTool({ session }));
  registry.register(createSelectTool({ session }));
  registry.register(createHoverTool({ session }));
  registry.register(createPressKeyTool({ session }));
  registry.register(createUploadTool({ session }));
  registry.register(createTabManageTool({ session }));
  registry.register(createExtractTool({ session }));
  registry.register(createDownloadTool({ session }));
  registry.register(createFindByTextTool({ session }));
  registry.register(createGetNetworkTool({ session }));
  registry.register(createWaitForTool({ session }));
  registry.register(createBrowserEvaluateTool({ session }));

  // 2 agent_* tools (empty deps).
  registry.register(createAgentCompleteTool());
  registry.register(createAgentRequestHumanTool());

  // 5 page_* tools.
  registry.register(createPageGetElementInfoTool({ session }));
  registry.register(createPageGetPerformanceTool({ session }));
  registry.register(createPageScreenshotFullTool({ session }));
  registry.register(createPageAnnotateScreenshotTool());
  registry.register(createPageAnalyzeTool({ session }));

  return registry;
}

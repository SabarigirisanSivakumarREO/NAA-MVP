/**
 * AC-04 — MCPServer + ToolRegistry conformance (Phase 2 T019).
 *
 * Spec source:
 *   docs/specs/mvp/phases/phase-2-tools/spec.md AC-04 + R-04 + R-14
 *   docs/specs/mvp/phases/phase-2-tools/tasks.md T019 (REQ-MCP-001/002)
 *   docs/specs/mvp/phases/phase-2-tools/impact.md §MCPToolRegistry (canonical)
 *
 * AC-04 contract:
 *   - MCP server boots; `tools/list` returns 29 MCP tools
 *     (22 browser_* + 2 agent_* + 5 page_*)
 *   - Each tool has Zod-derived JSON schema + safety classification
 *   - Boot fails fast on duplicate tool name
 *
 * RED state — Wave 0 SafetyClassSchema is REAL (T-PHASE2-TYPES, commit
 *   1165554), so live SafetyClass parse assertions run NOW. The
 *   MCPServerAdapter + ToolRegistry implementation lands at T019; the
 *   `tools/list` count + safetyClass coverage assertions are `it.todo`
 *   until then per R3.1.
 *
 * Anchor: @AC-04 — 29 MCP tools registered with valid SafetyClass.
 */
import { describe, expect, it } from 'vitest';

import { SafetyClassSchema } from '../../src/mcp/index.js';

// NOTE (R3.1): T019 imports below deliberately commented out so this file
// compiles cleanly until T019 lands. Uncomment when Server + ToolRegistry exist:
// import { MCPServerAdapter } from '../../src/mcp/Server.js';
// import { ToolRegistry } from '../../src/mcp/ToolRegistry.js';

/**
 * Expected 29-tool surface per impact.md §MCPToolRegistry safetyClass table
 * + tasks.md §"23 Browse Tools" + page tool list.
 *
 *   22 browser_* + 2 agent_* + 5 page_* = 29
 */
const EXPECTED_TOOL_COUNT = 29;

const EXPECTED_BROWSER_TOOLS = [
  'browser_navigate', 'browser_go_back', 'browser_go_forward', 'browser_reload',
  'browser_get_state', 'browser_screenshot', 'browser_get_metadata',
  'browser_click', 'browser_click_coords', 'browser_type', 'browser_scroll',
  'browser_select', 'browser_hover', 'browser_press_key', 'browser_upload',
  'browser_tab_manage', 'browser_extract', 'browser_download',
  'browser_find_by_text', 'browser_get_network', 'browser_wait_for',
  'browser_evaluate',
] as const;

const EXPECTED_AGENT_TOOLS = ['agent_complete', 'agent_request_human'] as const;

const EXPECTED_PAGE_TOOLS = [
  'page_get_element_info', 'page_get_performance', 'page_screenshot_full',
  'page_annotate_screenshot', 'page_analyze',
] as const;

describe('MCPServer — AC-04 conformance (Wave 0 RED)', () => {
  /**
   * @AC-04 — Wave 0 SafetyClassSchema accepts all 4 documented values
   * (locked at Phase 2 close per impact.md §MCPToolRegistry F-S12).
   */
  it('AC-04: SafetyClassSchema accepts all 4 documented values', () => {
    expect(SafetyClassSchema.safeParse('safe').success).toBe(true);
    expect(SafetyClassSchema.safeParse('requires_safety_check').success).toBe(true);
    expect(SafetyClassSchema.safeParse('requires_hitl').success).toBe(true);
    expect(SafetyClassSchema.safeParse('forbidden').success).toBe(true);
  });

  /**
   * @AC-04 — SafetyClassSchema rejects unknown values (closed-enum guard
   * for R18 append-only protection).
   */
  it('AC-04: SafetyClassSchema rejects unknown SafetyClass values', () => {
    expect(SafetyClassSchema.safeParse('unsafe').success).toBe(false);
    expect(SafetyClassSchema.safeParse('').success).toBe(false);
    expect(SafetyClassSchema.safeParse(null).success).toBe(false);
  });

  /**
   * @AC-04 — Tool surface arity proof: 22 + 2 + 5 = 29 (T019 will register
   * exactly this set; this test pins the expected universe).
   */
  it('AC-04: expected tool universe sums to 29 (22 browser_* + 2 agent_* + 5 page_*)', () => {
    expect(EXPECTED_BROWSER_TOOLS).toHaveLength(22);
    expect(EXPECTED_AGENT_TOOLS).toHaveLength(2);
    expect(EXPECTED_PAGE_TOOLS).toHaveLength(5);
    const total =
      EXPECTED_BROWSER_TOOLS.length + EXPECTED_AGENT_TOOLS.length + EXPECTED_PAGE_TOOLS.length;
    expect(total).toBe(EXPECTED_TOOL_COUNT);
  });

  /**
   * @AC-04 — MCP server boots in < 500 ms (NF-Phase2-01).
   */
  it.todo('AC-04: MCPServerAdapter boots in < 500 ms (NF-Phase2-01)');

  /**
   * @AC-04 — `tools/list` returns exactly 29 tool entries.
   */
  it.todo('AC-04: tools/list returns toolList.length === 29');

  /**
   * @AC-04 — every registered tool has a SafetyClassSchema-valid `safetyClass`
   * field. Asserts every value in toolList.map(t => t.safetyClass) parses.
   */
  it.todo(
    'AC-04: every tool.safetyClass parses against SafetyClassSchema (no unclassified tools)',
  );

  /**
   * @AC-04 — every registered tool exposes a Zod input + output schema.
   */
  it.todo('AC-04: every tool exposes inputSchema + outputSchema (Zod ZodType instances)');

  /**
   * @AC-04 — duplicate tool name registration → boot failure (typed error,
   * NOT silent overwrite).
   */
  it.todo('AC-04: ToolRegistry.register throws on duplicate tool name');
});

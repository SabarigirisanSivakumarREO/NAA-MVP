// AC-09 — Browse-agent system prompt golden snapshot + tool-name parity.
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-09 v0.4
// REQ-IDs: REQ-BROWSE-PROMPT-001 + R-09 + R4.5 (exact tool names)
// Linked task: T090
//
// Drift-detection contract:
//   - Phase 2 MCPToolRegistry has EXACTLY 29 registered tools
//     (22 browser_* + 2 agent_* + 5 page_*).
//   - BROWSE_TOOL_NAMES (24) equals registry.list() filtered to
//     non-page_* tools, sorted ASCII-ascending.
//   - BROWSE_AGENT_SYSTEM_PROMPT embeds those 24 names verbatim and
//     stays under the 2000-token budget (proxy: word_count * 1.3).
//   - ActionProposalSchema accepts valid proposals (browser_click,
//     agent_complete) and rejects unknown tool names + missing fields.
//
// page_* are EXCLUDED per r20-invalidation-from-phase-4b.md §"Open
// question" + 08-tool-manifest.md §8.2 (analyze-mode-only).

import { describe, expect, it } from 'vitest';

import {
  ActionProposalSchema,
  BROWSE_AGENT_SYSTEM_PROMPT,
  BROWSE_TOOL_NAMES,
} from '../../src/orchestration/prompts/browse-agent.js';
import { buildPhase2Registry } from '../integration/phase2.registry.js';
import type { BrowserSession } from '../../src/adapters/BrowserEngine.js';

// Factories only stash `deps` in closure at registration time; handlers
// are never called during register(), so a structurally-empty cast
// suffices for drift-counting purposes.
const stubSession = {} as unknown as BrowserSession;

describe('AC-09 — Browse-agent system prompt + ActionProposalSchema', () => {
  describe('drift detection vs Phase 2 MCPToolRegistry', () => {
    it('registry has exactly 29 tools (22 browser_* + 2 agent_* + 5 page_*)', () => {
      const registry = buildPhase2Registry(stubSession);
      expect(registry.list().length).toBe(29);
    });

    it('BROWSE_TOOL_NAMES has 24 entries matching registry minus page_*', () => {
      const registry = buildPhase2Registry(stubSession);
      const browseEligible = registry
        .list()
        .filter((t) => !t.name.startsWith('page_'))
        .map((t) => t.name)
        .sort();
      expect(browseEligible.length).toBe(24);
      expect([...BROWSE_TOOL_NAMES]).toEqual(browseEligible);
    });

    it('every name in BROWSE_TOOL_NAMES appears verbatim in the prompt', () => {
      for (const name of BROWSE_TOOL_NAMES) {
        expect(BROWSE_AGENT_SYSTEM_PROMPT).toContain(name);
      }
    });

    it('no page_* tool name appears in the prompt (analyze-mode-only)', () => {
      const pageTools = [
        'page_analyze',
        'page_annotate_screenshot',
        'page_get_element_info',
        'page_get_performance',
        'page_screenshot_full',
      ];
      for (const name of pageTools) {
        expect(BROWSE_AGENT_SYSTEM_PROMPT).not.toContain(name);
      }
    });
  });

  describe('prompt budget + content rules', () => {
    it('prompt is under 2000 tokens (word-count proxy * 1.3)', () => {
      const wordCount = BROWSE_AGENT_SYSTEM_PROMPT.split(/\s+/).filter(Boolean).length;
      const tokenProxy = wordCount * 1.3;
      expect(tokenProxy).toBeLessThan(2000);
    });

    it('prompt encodes the 5 non-negotiable rules + JSON output format', () => {
      // R4.1 perception-first
      expect(BROWSE_AGENT_SYSTEM_PROMPT).toMatch(/PERCEPTION FIRST/);
      expect(BROWSE_AGENT_SYSTEM_PROMPT).toContain('browser_get_state');
      // R4.5 exact tool names
      expect(BROWSE_AGENT_SYSTEM_PROMPT).toMatch(/EXACT TOOL NAMES/);
      // One-action-per-step
      expect(BROWSE_AGENT_SYSTEM_PROMPT).toMatch(/ONE ACTION PER STEP/);
      // JSON format + Zod-validated
      expect(BROWSE_AGENT_SYSTEM_PROMPT).toMatch(/JSON FORMAT/);
      expect(BROWSE_AGENT_SYSTEM_PROMPT).toMatch(/"tool"/);
      expect(BROWSE_AGENT_SYSTEM_PROMPT).toMatch(/"args"/);
      expect(BROWSE_AGENT_SYSTEM_PROMPT).toMatch(/"reasoning"/);
      // Budget discipline → agent_complete with no_action_needed
      expect(BROWSE_AGENT_SYSTEM_PROMPT).toMatch(/STAY UNDER BUDGET/);
      expect(BROWSE_AGENT_SYSTEM_PROMPT).toContain('agent_complete');
      expect(BROWSE_AGENT_SYSTEM_PROMPT).toContain('no_action_needed');
    });

    it('golden snapshot of BROWSE_AGENT_SYSTEM_PROMPT (stable across refactors)', () => {
      expect(BROWSE_AGENT_SYSTEM_PROMPT).toMatchInlineSnapshot(`
        "You are Neural's browse-mode agent. Your job: navigate web pages, perform requested actions, and verify outcomes.

        RULES (non-negotiable):
        1. PERCEPTION FIRST. Always call browser_get_state before any action tool. Stale page state is the #1 source of wrong actions.
        2. EXACT TOOL NAMES. Use only these registered MCP tools (exact spelling, no paraphrasing): agent_complete, agent_request_human, browser_click, browser_click_coords, browser_download, browser_evaluate, browser_extract, browser_find_by_text, browser_get_metadata, browser_get_network, browser_get_state, browser_go_back, browser_go_forward, browser_hover, browser_navigate, browser_press_key, browser_reload, browser_screenshot, browser_scroll, browser_select, browser_tab_manage, browser_type, browser_upload, browser_wait_for. Never invent or rename a tool (e.g., never "page_snapshot" — use "browser_get_state").
        3. ONE ACTION PER STEP. Propose exactly one tool call per response. Do not chain multiple actions; the orchestrator will call you again after each action completes.
        4. JSON FORMAT. Action proposals MUST match this Zod-validated schema: { "tool": "<exact_name>", "args": { ... }, "reasoning": "<<=3 sentences>" }. Any other shape is rejected.
        5. STAY UNDER BUDGET. If the page is off-topic, blocked, or unlikely to progress the audit, propose agent_complete with status='no_action_needed'. Cost discipline beats completionism.

        OUTPUT (return ONLY this JSON, no prose wrapper):
        { "tool": "<one of the 24 names above>", "args": { ... }, "reasoning": "<short why>" }"
      `);
    });
  });

  describe('ActionProposalSchema parse contract', () => {
    it('parses a valid browser_click proposal (browser_* category)', () => {
      const proposal = {
        tool: 'browser_click',
        args: { selector: '#cta-submit' },
        reasoning: 'Click the primary CTA to advance the funnel.',
      };
      const parsed = ActionProposalSchema.parse(proposal);
      expect(parsed.tool).toBe('browser_click');
      expect(parsed.args).toEqual({ selector: '#cta-submit' });
    });

    it('parses a valid agent_complete proposal (agent_* category)', () => {
      const proposal = {
        tool: 'agent_complete',
        args: { status: 'no_action_needed', reason: 'page off-topic' },
        reasoning: 'Page is unrelated; ending session to preserve budget.',
      };
      const parsed = ActionProposalSchema.parse(proposal);
      expect(parsed.tool).toBe('agent_complete');
    });

    it('rejects unknown tool names (e.g., page_* or hallucinated)', () => {
      expect(() =>
        ActionProposalSchema.parse({
          tool: 'page_analyze', // analyze-mode-only, not in browse enum
          args: {},
          reasoning: 'attempt to use analyze tool',
        }),
      ).toThrow();
      expect(() =>
        ActionProposalSchema.parse({
          tool: 'page_snapshot', // hallucinated alias
          args: {},
          reasoning: 'wrong name',
        }),
      ).toThrow();
    });

    it('rejects missing required fields (reasoning omitted)', () => {
      expect(() =>
        ActionProposalSchema.parse({
          tool: 'browser_click',
          args: { selector: '#x' },
        }),
      ).toThrow();
    });

    it('rejects unknown extra top-level fields (strict mode)', () => {
      expect(() =>
        ActionProposalSchema.parse({
          tool: 'browser_click',
          args: { selector: '#x' },
          reasoning: 'fine',
          confidence: 0.9, // extra field — must reject under .strict()
        }),
      ).toThrow();
    });

    it('rejects reasoning > 500 chars (token cost cap)', () => {
      expect(() =>
        ActionProposalSchema.parse({
          tool: 'browser_click',
          args: {},
          reasoning: 'x'.repeat(501),
        }),
      ).toThrow();
    });
  });
});

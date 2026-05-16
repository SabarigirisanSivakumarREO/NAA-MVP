// AC-10 — BrowseGraph.compile() + invoke smoke test
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-10 v0.4
// REQ-IDs: REQ-BROWSE-GRAPH-001 + R-10
// Linked task: T091
// Status: RED — implementation pending in Stage 2 Wave 10

import { describe, it } from 'vitest';

describe('AC-10 — BrowseGraph compile + invoke', () => {
  it.fails(
    'BrowseGraph.compile() produces a runnable LangGraph; BrowseGraph.invoke({ initial_state }) runs the loop on a fixture URL list with mock LLM + mock browser and exits 0',
    () => {
      throw new Error('NOT_IMPLEMENTED — T091 pending Wave 10');
    },
  );
});

// AC-09 — Browse-agent system prompt golden snapshot + tool-name parity
// Spec: docs/specs/mvp/phases/phase-5-browse-mvp/spec.md AC-09 v0.4
// REQ-IDs: REQ-BROWSE-PROMPT-001 + R-09 + R4.5 (exact tool names)
// Linked task: T090
// Status: RED — implementation pending in Stage 2 Wave 9

import { describe, it } from 'vitest';

describe('AC-09 — Browse-agent system prompt', () => {
  it.fails(
    'golden snapshot of prompt < 2000 tokens + tool-name parity assertion: MCPToolRegistry.list().length === 29 with the 29 LOCKED EXACT v3.1 names sorted',
    () => {
      throw new Error('NOT_IMPLEMENTED — T090 pending Wave 9');
    },
  );
});

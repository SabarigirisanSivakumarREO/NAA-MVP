/**
 * AC-20 — StoreNode (Phase 7 T132, REQ-ANALYZE-NODE-005, R7.3, R7.4, F-016).
 *
 * Verifies findings persisted with publish_status='held' (F-016 warm-up
 * default), rejected_findings persisted append-only with rule + reason,
 * screenshots written via ScreenshotStorage (NOT base64 in DB).
 */
import { describe, expect, it } from 'vitest';
import { storeNodeRun } from '../../src/analysis/nodes/StoreNode.js';
import type {
  GroundedFinding,
  RejectedFinding,
} from '../../src/orchestration/AnalysisState.js';
import type {
  AuditEvent,
  AuditLogInsert,
  AuditRunInsert,
  FindingInsert,
  FindingRow,
  RejectedFindingInsert,
  ReproducibilitySnapshotInsert,
  StorageAdapter,
  StorageTx,
} from '../../src/adapters/StorageAdapter.js';
import type {
  ScreenshotPutOptions,
  ScreenshotStorage,
} from '../../src/adapters/ScreenshotStorage.js';
import type { LLMCallRecord } from '../../src/types/llm.js';

class FakeStorage implements StorageAdapter {
  public readonly findings: FindingInsert[] = [];
  public readonly rejected: RejectedFindingInsert[] = [];
  async withClient<T>(_clientId: string, fn: (tx: StorageTx) => Promise<T>): Promise<T> {
    return fn({ query: async () => ({ rows: [] }) } as unknown as StorageTx);
  }
  async appendAuditLog(_e: AuditLogInsert): Promise<void> {}
  async appendAuditEvent(_e: AuditEvent): Promise<void> {}
  async appendLLMCallLog(_r: LLMCallRecord): Promise<void> {}
  async createAuditRun(_e: AuditRunInsert): Promise<string> {
    return 'aud-1';
  }
  async finalizeAuditRun(): Promise<void> {}
  async getFindings(): Promise<readonly FindingRow[]> {
    return [];
  }
  async appendFinding(entry: FindingInsert): Promise<string> {
    this.findings.push(entry);
    return `f-${this.findings.length}`;
  }
  async appendRejectedFinding(entry: RejectedFindingInsert): Promise<string> {
    this.rejected.push(entry);
    return `r-${this.rejected.length}`;
  }
  async writeReproducibilitySnapshot(_e: ReproducibilitySnapshotInsert): Promise<void> {}
}

class FakeScreenshotStorage implements ScreenshotStorage {
  public readonly puts: Array<{ size: number; opts: ScreenshotPutOptions }> = [];
  async put(buffer: Buffer, opts: ScreenshotPutOptions): Promise<string> {
    this.puts.push({ size: buffer.length, opts });
    return `/storage/${opts.audit_run_id}/${encodeURIComponent(opts.page_url)}`;
  }
  async get(): Promise<Buffer> {
    return Buffer.alloc(0);
  }
}

function gf(overrides: Partial<GroundedFinding> = {}): GroundedFinding {
  return {
    heuristic_id: 'H-1',
    status: 'violation',
    observation: 'observation text long enough to pass',
    assessment: 'assessment text long enough to pass',
    evidence: {
      element_ref: 'Add to bag',
      element_selector: 'button.cta',
      data_point: 'ctas[0]',
      measurement: '280x48 y:400',
    },
    severity: 'high',
    confidence_basis: 'measured',
    recommendation: 'increase touch target',
    needs_review: false,
    verdict: 'KEEP',
    confidence_tier: 'high',
    ...overrides,
  };
}

function rf(overrides: Partial<RejectedFinding> = {}): RejectedFinding {
  return {
    heuristic_id: 'H-X',
    status: 'violation',
    observation: 'bad observation text minimum length ok',
    assessment: 'bad assessment text minimum length ok',
    evidence: {
      element_ref: null,
      element_selector: null,
      data_point: 'ctas[0]',
      measurement: null,
    },
    severity: 'medium',
    confidence_basis: null,
    recommendation: null,
    needs_review: false,
    verdict: 'KEEP',
    rejected_by_rule: 'GR-005',
    rejection_reason: 'heuristic_id not in filtered set',
    ...overrides,
  };
}

const SCREENSHOTS = {
  viewport_clean: Buffer.from([1, 2, 3]),
  fullpage_clean: Buffer.from([4, 5, 6, 7]),
  viewport_annotated: Buffer.from([8, 9]),
  fullpage_annotated: Buffer.from([10, 11, 12]),
};

describe('AC-20 StoreNode', () => {
  it('persists each grounded finding via appendFinding with publish_status=held', async () => {
    const storage = new FakeStorage();
    const ss = new FakeScreenshotStorage();
    const out = await storeNodeRun({
      grounded_findings: [gf(), gf({ heuristic_id: 'H-2' })],
      rejected_findings: [],
      auditRunId: 'aud-1',
      clientId: 'client-1',
      pageUrl: 'https://x.example/p/1',
      pageType: 'product',
      screenshots: SCREENSHOTS,
      storage,
      screenshotStorage: ss,
    });
    expect(storage.findings).toHaveLength(2);
    expect((storage.findings[0] as Record<string, unknown>).publishStatus).toBe('held');
    expect(out.finding_ids).toHaveLength(2);
  });

  it('persists rejected findings via appendRejectedFinding with rule + reason (R7.4)', async () => {
    const storage = new FakeStorage();
    const ss = new FakeScreenshotStorage();
    await storeNodeRun({
      grounded_findings: [],
      rejected_findings: [rf({ rejected_by_rule: 'GR-007', rejection_reason: 'banned phrase' })],
      auditRunId: 'aud-1',
      clientId: 'client-1',
      pageUrl: 'https://x.example/p/1',
      screenshots: SCREENSHOTS,
      storage,
      screenshotStorage: ss,
    });
    expect(storage.rejected).toHaveLength(1);
    expect((storage.rejected[0] as Record<string, unknown>).rejectedByRule).toBe('GR-007');
    expect((storage.rejected[0] as Record<string, unknown>).rejectionReason).toBe('banned phrase');
    expect((storage.rejected[0] as Record<string, unknown>).rejectionStage).toBe('grounding');
  });

  it('writes BOTH clean and annotated screenshots via ScreenshotStorage (no base64 in DB)', async () => {
    const storage = new FakeStorage();
    const ss = new FakeScreenshotStorage();
    const out = await storeNodeRun({
      grounded_findings: [gf()],
      rejected_findings: [],
      auditRunId: 'aud-1',
      clientId: 'client-1',
      pageUrl: 'https://x.example/p/1',
      screenshots: SCREENSHOTS,
      storage,
      screenshotStorage: ss,
    });
    expect(ss.puts).toHaveLength(4); // viewport clean+annot, fullpage clean+annot
    expect(out.screenshot_paths.viewport_clean).toContain('/storage/');
    expect(out.screenshot_paths.viewport_annotated).not.toBeNull();
    // Finding row carries a screenshotRef path, NOT bytes.
    const screenshotRef = (storage.findings[0] as Record<string, unknown>).screenshotRef;
    expect(typeof screenshotRef).toBe('string');
    expect(screenshotRef).toContain('/storage/');
  });

  it('omits annotated screenshots when not provided', async () => {
    const storage = new FakeStorage();
    const ss = new FakeScreenshotStorage();
    const out = await storeNodeRun({
      grounded_findings: [],
      rejected_findings: [],
      auditRunId: 'aud-1',
      clientId: 'client-1',
      pageUrl: 'https://x.example/p/1',
      screenshots: { viewport_clean: SCREENSHOTS.viewport_clean, fullpage_clean: SCREENSHOTS.fullpage_clean },
      storage,
      screenshotStorage: ss,
    });
    expect(ss.puts).toHaveLength(2);
    expect(out.screenshot_paths.viewport_annotated).toBeNull();
    expect(out.screenshot_paths.fullpage_annotated).toBeNull();
  });

  it('handles empty findings + empty rejected without errors', async () => {
    const storage = new FakeStorage();
    const ss = new FakeScreenshotStorage();
    const out = await storeNodeRun({
      grounded_findings: [],
      rejected_findings: [],
      auditRunId: 'aud-1',
      clientId: 'client-1',
      pageUrl: 'https://x.example/p/1',
      screenshots: SCREENSHOTS,
      storage,
      screenshotStorage: ss,
    });
    expect(out.finding_ids).toEqual([]);
    expect(out.rejected_ids).toEqual([]);
  });
});

/**
 * Conformance test — AC-08 (T106 seam) DecryptionAdapter interface.
 *
 * Source:
 *   docs/specs/mvp/phases/phase-6-heuristics/spec.md AC-08
 *   tasks.md T106 — HeuristicLoader accepts a DecryptionAdapter via its
 *     constructor; MVP ships PlaintextDecryptor (identity transform); the
 *     seam is in place for v1.1 AES-256-GCM substitution before first
 *     external pilot. Constitution R10 adapter pattern.
 *
 * R3.1 TDD: this test is authored BEFORE T106 / decryption.ts land.
 * Failure is the expected initial red.
 *
 * Anchor: @AC-08 — DecryptionAdapter seam.
 */
import { describe, it, expect, vi } from 'vitest';

import {
  PlaintextDecryptor,
  type DecryptionAdapter,
} from '../../src/adapters/DecryptionAdapter.js';

describe('@AC-08 DecryptionAdapter', () => {
  it('PlaintextDecryptor returns input bytes unchanged', async () => {
    const decryptor: DecryptionAdapter = new PlaintextDecryptor();
    const input = '{"id":"TEST-PACK-001"}';
    const output = await decryptor.decrypt(input);
    expect(output).toBe(input);
  });

  it('PlaintextDecryptor handles empty string', async () => {
    const decryptor = new PlaintextDecryptor();
    expect(await decryptor.decrypt('')).toBe('');
  });

  it('PlaintextDecryptor handles multi-line JSON content', async () => {
    const decryptor = new PlaintextDecryptor();
    const multiline = '{\n  "id": "TEST"\n}';
    expect(await decryptor.decrypt(multiline)).toBe(multiline);
  });

  it('seam: a MockDecryptor implementing the interface is substitutable', async () => {
    const mockSpy = vi.fn(async (raw: string) => raw.toUpperCase());
    const mock: DecryptionAdapter = { decrypt: mockSpy };
    const out = await mock.decrypt('hello');
    expect(out).toBe('HELLO');
    expect(mockSpy).toHaveBeenCalledOnce();
  });
});

/**
 * Re-export shim for the heuristics-local decryption seam.
 *
 * Source of truth: `packages/agent-core/src/adapters/DecryptionAdapter.ts`
 * (T108, Wave B). This shim exists because Phase 6 conformance tests
 * (heuristic-loader.test.ts, r6-ip-boundary.test.ts) import the decryptor
 * from `analysis/heuristics/decryption.js`, co-located with the loader
 * for callsite locality. Single impl; named re-exports only (R10).
 */
export {
  type DecryptionAdapter,
  PlaintextDecryptor,
} from '../../adapters/DecryptionAdapter.js';

/**
 * DecryptionAdapter — T108 (AC-08 seam).
 *
 * Spec: docs/specs/mvp/phases/phase-6-heuristics/spec.md AC-08
 *       tasks.md T108
 *
 * MVP ships PlaintextDecryptor (identity transform). The seam exists so
 * v1.1 can substitute AES256GCMDecryptor against the same interface before
 * the first external pilot. AES-256-GCM implementation is a kill criterion
 * for this task — DO NOT implement here.
 *
 * Constitution R10 (adapter pattern), R5 (pure functions / no I/O in MVP).
 */

/**
 * Substitutable decryption seam. MVP impl is identity; v1.1 will be AES-256-GCM.
 * Async signature reserved for future I/O-bound key fetch / KMS round-trips.
 */
export interface DecryptionAdapter {
  decrypt(raw: string): Promise<string>;
}

/**
 * MVP identity decryptor — returns input unchanged. Pure; no I/O; no side effects.
 */
export class PlaintextDecryptor implements DecryptionAdapter {
  async decrypt(raw: string): Promise<string> {
    return raw;
  }
}

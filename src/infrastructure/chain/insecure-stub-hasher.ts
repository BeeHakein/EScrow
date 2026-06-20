import type { ReportHasher, ReportHashInput } from '../../application/ports/report-hasher';
import type { Hash32 } from '../../domain/shared/primitives';
import { canonicalReportString } from './report-canonical';

// DEV ONLY. Deterministic but NOT cryptographic — never anchor a real escrow with this.
// Production replaces it with Keccak256ReportHasher (viem) to match the on-chain verifier.
// Shares the SAME canonical pre-image as the real hasher (only the digest function differs).
export class InsecureStubHasher implements ReportHasher {
  async hash(input: ReportHashInput): Promise<Hash32> {
    const canonical = canonicalReportString(input);
    let hex = '';
    for (let seed = 0; seed < 8; seed++) {
      hex += fnv1a(canonical, seed).toString(16).padStart(8, '0');
    }
    return `0x${hex}` as Hash32;
  }
}

function fnv1a(str: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

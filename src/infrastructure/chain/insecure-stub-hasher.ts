import type { ReportHasher, ReportHashInput } from '../../application/ports/report-hasher';
import type { Hash32 } from '../../domain/shared/primitives';

// DEV ONLY. Deterministic but NOT cryptographic — never anchor a real escrow with this.
// Production replaces it with a keccak256 hasher (viem) to match the on-chain verifier.
export class InsecureStubHasher implements ReportHasher {
  async hash(input: ReportHashInput): Promise<Hash32> {
    const canonical = stableStringify(input);
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

// Key-sorted stringify so logically equal inputs always produce the same string.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

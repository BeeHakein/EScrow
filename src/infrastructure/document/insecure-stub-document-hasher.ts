import type { DocumentHasher } from '../../application/ports/document-hasher';
import type { Hash32 } from '../../domain/shared/primitives';

// DEV ONLY. Deterministic but NOT cryptographic — never treat this as real tamper evidence.
// Production replaces it with a sha256 hasher (Web Crypto / node:crypto) per the contentHash
// contract on the Contract domain type. Mirrors the FNV construction used by InsecureStubHasher.
export class InsecureStubDocumentHasher implements DocumentHasher {
  async hash(bytes: Uint8Array): Promise<Hash32> {
    let hex = '';
    for (let seed = 0; seed < 8; seed++) {
      hex += fnv1a(bytes, seed).toString(16).padStart(8, '0');
    }
    return `0x${hex}` as Hash32;
  }
}

function fnv1a(bytes: Uint8Array, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i] as number;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

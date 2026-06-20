import type { DocumentHasher } from '../../application/ports/document-hasher';
import type { Hash32 } from '../../domain/shared/primitives';

// Real content hash of the upload bytes: sha256 via Web Crypto (global in Node 18+, no deps).
// Satisfies the `contentHash` contract on the Contract domain type, so this is production-safe
// tamper evidence — replaces InsecureStubDocumentHasher. (Report anchoring still uses keccak256
// via ReportHasher; the two hashes serve different trust purposes — keep them separate.)
export class Sha256DocumentHasher implements DocumentHasher {
  async hash(bytes: Uint8Array): Promise<Hash32> {
    // Hash an ArrayBuffer-backed copy: a plain `Uint8Array` may be SharedArrayBuffer-backed,
    // which crypto.subtle.digest's BufferSource type rejects.
    const buf = new Uint8Array(bytes.byteLength);
    buf.set(bytes);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    return `0x${hex}` as Hash32;
  }
}

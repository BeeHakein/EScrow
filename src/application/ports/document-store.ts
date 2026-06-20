import type { DocumentFormat } from '../../domain/contract';
import type { Hash32 } from '../../domain/shared/primitives';

export interface StoreDocumentInput {
  readonly bytes: Uint8Array;
  readonly format: DocumentFormat;
  readonly contentHash: Hash32;
}

// Outbound port. Persists the raw upload bytes to blob storage and returns an opaque
// storageKey (the pointer held on the Contract). Real adapter writes to S3/Vercel Blob; a
// stub keeps bytes in memory. Hashing is a separate concern (DocumentHasher) — the key is
// just a pointer, the hash is the tamper evidence.
export interface DocumentStore {
  store(input: StoreDocumentInput): Promise<string>;
}

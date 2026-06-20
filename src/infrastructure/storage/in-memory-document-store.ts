import type { DocumentStore, StoreDocumentInput } from '../../application/ports/document-store';

// Simplest implementation that works: keeps bytes in a Map keyed by a content-addressed key.
// The Vercel Blob / S3 adapter implements the same port later. Dev only — not durable.
export class InMemoryDocumentStore implements DocumentStore {
  private readonly blobs = new Map<string, Uint8Array>();

  async store(input: StoreDocumentInput): Promise<string> {
    const key = `blob/${input.contentHash}.${input.format}`;
    this.blobs.set(key, input.bytes);
    return key;
  }

  async get(key: string): Promise<Uint8Array | null> {
    return this.blobs.get(key) ?? null;
  }
}

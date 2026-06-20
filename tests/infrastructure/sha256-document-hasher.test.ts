import { describe, it, expect } from 'vitest';
import { Sha256DocumentHasher } from '../../src/infrastructure/document/sha256-document-hasher';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('Sha256DocumentHasher', () => {
  it('matches the known sha256 vector for "abc"', async () => {
    const h = await new Sha256DocumentHasher().hash(enc('abc'));
    expect(h).toBe('0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('produces a 0x-prefixed 32-byte hex digest, deterministically', async () => {
    const hasher = new Sha256DocumentHasher();
    const a = await hasher.hash(enc('contract bytes'));
    const b = await hasher.hash(enc('contract bytes'));
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a).toBe(b);
    expect(await hasher.hash(enc('different'))).not.toBe(a);
  });
});

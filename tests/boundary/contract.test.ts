import { describe, it, expect } from 'vitest';
import { parseClause, parseUploadCommand } from '../../src/boundary/contract';
import type { ClauseId, ContractId } from '../../src/domain/shared/ids';

const ctx = (index: number) => ({ id: `cl${index}` as ClauseId, contractId: 'c1' as ContractId, index });
const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('parseUploadCommand', () => {
  it('accepts a valid command and trims the title', () => {
    const r = parseUploadCommand({ title: '  Design Agreement  ', format: 'pdf', uploadedBy: 'p1', bytes: bytes('x') });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.title).toBe('Design Agreement');
    expect(r.value.format).toBe('pdf');
  });

  it('rejects an empty title', () => {
    expect(parseUploadCommand({ title: '   ', format: 'pdf', uploadedBy: 'p1', bytes: bytes('x') }).ok).toBe(false);
  });

  it('rejects an unsupported format', () => {
    expect(parseUploadCommand({ title: 'T', format: 'txt', uploadedBy: 'p1', bytes: bytes('x') }).ok).toBe(false);
  });

  it('rejects missing or empty bytes', () => {
    expect(parseUploadCommand({ title: 'T', format: 'pdf', uploadedBy: 'p1', bytes: bytes('') }).ok).toBe(false);
    expect(parseUploadCommand({ title: 'T', format: 'pdf', uploadedBy: 'p1', bytes: 'notbytes' }).ok).toBe(false);
  });
});

describe('parseClause', () => {
  it('parses a clause and normalizes a blank heading to null', () => {
    const r = parseClause({ heading: '  ', text: 'The client shall pay.', category: 'payment' }, ctx(0));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.heading).toBeNull();
    expect(r.value.category).toBe('payment');
    expect(r.value.index).toBe(0);
  });

  it('keeps a real heading, trimmed', () => {
    const r = parseClause({ heading: '  Payment  ', text: 'body', category: 'payment' }, ctx(0));
    expect(r.ok && r.value.heading === 'Payment').toBe(true);
  });

  it('rejects empty text', () => {
    expect(parseClause({ text: '   ', category: 'payment' }, ctx(0)).ok).toBe(false);
  });

  it('rejects an out-of-set category', () => {
    expect(parseClause({ text: 'body', category: 'pricing' }, ctx(0)).ok).toBe(false);
  });
});

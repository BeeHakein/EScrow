import { describe, it, expect } from 'vitest';
import { segmentClauses } from '../../src/infrastructure/document/segment-clauses';

describe('segmentClauses', () => {
  it('splits on blank lines and drops empty blocks', () => {
    const clauses = segmentClauses('First block.\n\n\n  \n\nSecond block.');
    expect(clauses).toHaveLength(2);
    expect(clauses[0]?.text).toBe('First block.');
    expect(clauses[1]?.text).toBe('Second block.');
  });

  it('treats a short leading line as a heading and the rest as the body', () => {
    const [clause] = segmentClauses('Payment Terms\nClient shall pay the fee upon invoice.');
    expect(clause?.heading).toBe('Payment Terms');
    expect(clause?.text).toBe('Client shall pay the fee upon invoice.');
  });

  it('keeps a single-line block whole with no heading', () => {
    const [clause] = segmentClauses('A single line clause with no heading.');
    expect(clause?.heading).toBeNull();
    expect(clause?.text).toBe('A single line clause with no heading.');
  });

  it('does not treat an over-long first line as a heading', () => {
    const longFirst = 'x'.repeat(81);
    const [clause] = segmentClauses(`${longFirst}\nbody`);
    expect(clause?.heading).toBeNull();
  });

  it('guesses categories from keywords (closed set is validated later at the boundary)', () => {
    const text = [
      'The Client shall pay the invoice within 30 days.',
      '',
      'All intellectual property and copyright transfers to the Client.',
      '',
      'Either party may terminate on notice.',
      '',
      'Provider accepts unlimited liability for damages.',
      '',
      'Disputes are resolved by binding arbitration.',
      '',
      'This describes the scope of deliverables and services.',
      '',
      'Both parties keep information confidential.',
      '',
      'Miscellaneous provisions appear at the end of the agreement here.',
    ].join('\n');
    expect(segmentClauses(text).map((c) => c.category)).toEqual([
      'payment',
      'intellectual_property',
      'termination',
      'liability',
      'dispute_resolution',
      'scope',
      'confidentiality',
      'other',
    ]);
  });
});

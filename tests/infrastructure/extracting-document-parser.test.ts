import { describe, it, expect } from 'vitest';
import { ExtractingDocumentParser } from '../../src/infrastructure/document/extracting-document-parser';
import { HeuristicClauseSegmenter } from '../../src/infrastructure/document/heuristic-clause-segmenter';
import type { TextExtractor } from '../../src/application/ports/text-extractor';
import type { ClauseSegmenter } from '../../src/application/ports/clause-segmenter';
import type { ParseDocumentInput } from '../../src/application/ports/document-parser';
import type { RawClause } from '../../src/boundary/contract';

// Fake extractor stands in for the PDF/DOCX libraries so the parser orchestration is tested offline.
const fakeExtractor = (text: string, capture?: (input: ParseDocumentInput) => void): TextExtractor => ({
  extract: async (input) => {
    capture?.(input);
    return text;
  },
});

// Fake segmenter records the text it was handed and returns canned clauses.
const fakeSegmenter = (clauses: readonly RawClause[], capture?: (text: string) => void): ClauseSegmenter => ({
  segment: async (text) => {
    capture?.(text);
    return clauses;
  },
});

const bytes = new TextEncoder().encode('ignored — the fake extractor supplies the text');

describe('ExtractingDocumentParser', () => {
  it('feeds the extracted text to the segmenter and returns its clauses', async () => {
    let segmented: string | undefined;
    const canned: RawClause[] = [{ heading: 'H', text: 'body', category: 'payment' }];
    const parser = new ExtractingDocumentParser(
      fakeExtractor('the whole document text'),
      fakeSegmenter(canned, (t) => (segmented = t)),
    );

    const doc = await parser.parse({ bytes, format: 'pdf' });

    expect(segmented).toBe('the whole document text'); // extractor output flows into the segmenter
    expect(doc.clauses).toEqual(canned); // segmenter output flows out unchanged
  });

  it('passes the bytes and format through to the extractor', async () => {
    let seen: ParseDocumentInput | undefined;
    const parser = new ExtractingDocumentParser(
      fakeExtractor('A single clause.', (i) => (seen = i)),
      fakeSegmenter([]),
    );

    await parser.parse({ bytes, format: 'docx' });

    expect(seen?.format).toBe('docx');
    expect(seen?.bytes).toBe(bytes);
  });

  // With the real heuristic segmenter wired in, the end-to-end extraction → segmentation path holds.
  it('segments the extracted text with the heuristic segmenter', async () => {
    const text = 'Payment Terms\nClient pays on net-30.\n\nScope of Work\nProvider delivers the services.';
    const parser = new ExtractingDocumentParser(fakeExtractor(text), new HeuristicClauseSegmenter());

    const doc = await parser.parse({ bytes, format: 'pdf' });

    expect(doc.clauses).toHaveLength(2);
    expect(doc.clauses[0]?.heading).toBe('Payment Terms');
    expect(doc.clauses[0]?.category).toBe('payment');
    expect(doc.clauses[1]?.category).toBe('scope');
  });

  it('yields no clauses when the document has no extractable text (heuristic)', async () => {
    const parser = new ExtractingDocumentParser(fakeExtractor('   \n\n  '), new HeuristicClauseSegmenter());
    const doc = await parser.parse({ bytes, format: 'pdf' });
    expect(doc.clauses).toEqual([]);
  });
});

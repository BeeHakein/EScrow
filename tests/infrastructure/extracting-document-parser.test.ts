import { describe, it, expect } from 'vitest';
import { ExtractingDocumentParser } from '../../src/infrastructure/document/extracting-document-parser';
import type { TextExtractor } from '../../src/application/ports/text-extractor';
import type { ParseDocumentInput } from '../../src/application/ports/document-parser';

// Fake extractor stands in for the PDF/DOCX libraries so the parser orchestration is tested offline.
const fakeExtractor = (text: string, capture?: (input: ParseDocumentInput) => void): TextExtractor => ({
  extract: async (input) => {
    capture?.(input);
    return text;
  },
});

const bytes = new TextEncoder().encode('ignored — the fake extractor supplies the text');

describe('ExtractingDocumentParser', () => {
  it('segments the extracted text into clauses', async () => {
    const text = 'Payment Terms\nClient pays on net-30.\n\nScope of Work\nProvider delivers the services.';
    const parser = new ExtractingDocumentParser(fakeExtractor(text));

    const doc = await parser.parse({ bytes, format: 'pdf' });

    expect(doc.clauses).toHaveLength(2);
    expect(doc.clauses[0]?.heading).toBe('Payment Terms');
    expect(doc.clauses[0]?.category).toBe('payment');
    expect(doc.clauses[1]?.category).toBe('scope');
  });

  it('passes the bytes and format through to the extractor', async () => {
    let seen: ParseDocumentInput | undefined;
    const parser = new ExtractingDocumentParser(fakeExtractor('A single clause.', (i) => (seen = i)));

    await parser.parse({ bytes, format: 'docx' });

    expect(seen?.format).toBe('docx');
    expect(seen?.bytes).toBe(bytes);
  });

  it('yields no clauses when the document has no extractable text', async () => {
    const parser = new ExtractingDocumentParser(fakeExtractor('   \n\n  '));
    const doc = await parser.parse({ bytes, format: 'pdf' });
    expect(doc.clauses).toEqual([]);
  });
});

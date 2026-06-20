import type { DocumentParser, ParseDocumentInput } from '../../application/ports/document-parser';
import type { RawDocument } from '../../boundary/contract';
import { segmentClauses } from './segment-clauses';

// Deterministic stand-in for real PDF/DOCX parsing: decodes the bytes as UTF-8 text and segments
// it with the shared `segmentClauses`. Good enough for plain-text fixtures in dev/tests, but it
// can't read real binary PDF/DOCX — production uses ExtractingDocumentParser + LibraryTextExtractor.
// Output stays untrusted and is parsed at the boundary regardless.
export class StubDocumentParser implements DocumentParser {
  async parse(input: ParseDocumentInput): Promise<RawDocument> {
    const text = new TextDecoder().decode(input.bytes);
    return { clauses: segmentClauses(text) };
  }
}

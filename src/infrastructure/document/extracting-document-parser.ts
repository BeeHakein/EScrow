import type { DocumentParser, ParseDocumentInput } from '../../application/ports/document-parser';
import type { TextExtractor } from '../../application/ports/text-extractor';
import type { RawDocument } from '../../boundary/contract';
import { segmentClauses } from './segment-clauses';

// Real DocumentParser: extract the document text via the injected TextExtractor (PDF/DOCX → text),
// then segment it with the shared pure `segmentClauses`. Drops in for StubDocumentParser behind the
// port with no caller change. The extractor is injected so this orchestration is unit-testable
// offline (fake extractor) and the format-specific library code stays swappable.
export class ExtractingDocumentParser implements DocumentParser {
  constructor(private readonly extractor: TextExtractor) {}

  async parse(input: ParseDocumentInput): Promise<RawDocument> {
    const text = await this.extractor.extract(input);
    return { clauses: segmentClauses(text) };
  }
}

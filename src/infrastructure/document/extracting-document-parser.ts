import type { DocumentParser, ParseDocumentInput } from '../../application/ports/document-parser';
import type { TextExtractor } from '../../application/ports/text-extractor';
import type { ClauseSegmenter } from '../../application/ports/clause-segmenter';
import type { RawDocument } from '../../boundary/contract';

// Real DocumentParser: extract the document text via the injected TextExtractor (PDF/DOCX → text),
// then split it into clauses via the injected ClauseSegmenter. Both collaborators are injected so
// this orchestration is unit-testable offline (fake extractor + fake segmenter) and each real
// adapter — the format libraries and the segmentation strategy — stays swappable on its own.
// Drops in for StubDocumentParser behind the DocumentParser port with no caller change.
export class ExtractingDocumentParser implements DocumentParser {
  constructor(
    private readonly extractor: TextExtractor,
    private readonly segmenter: ClauseSegmenter,
  ) {}

  async parse(input: ParseDocumentInput): Promise<RawDocument> {
    const text = await this.extractor.extract(input);
    return { clauses: await this.segmenter.segment(text) };
  }
}

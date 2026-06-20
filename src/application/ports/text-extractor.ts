import type { ParseDocumentInput } from './document-parser';

// Outbound port: turn the raw uploaded bytes (PDF/DOCX) into plain text. Split out from
// DocumentParser so the format-specific, library-backed extraction (hard to test offline) is
// isolated from the pure clause segmentation (fully testable). The returned text is untrusted.
export interface TextExtractor {
  extract(input: ParseDocumentInput): Promise<string>;
}

import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import type { ParseDocumentInput } from '../../application/ports/document-parser';
import type { TextExtractor } from '../../application/ports/text-extractor';

// Real text extraction behind the TextExtractor port: unpdf (bundled pdf.js, serverless-friendly)
// for PDF, mammoth for DOCX. Thin by design — the segmentation/categorization lives in the pure
// `segmentClauses`, so this only turns bytes into text. Like any external library, it can't be
// fully unit-tested offline (needs real binary fixtures); the parser orchestration is tested instead.
export class LibraryTextExtractor implements TextExtractor {
  async extract(input: ParseDocumentInput): Promise<string> {
    switch (input.format) {
      case 'pdf': {
        const pdf = await getDocumentProxy(input.bytes);
        const { text } = await extractText(pdf, { mergePages: true });
        return Array.isArray(text) ? text.join('\n') : text;
      }
      case 'docx': {
        const { value } = await mammoth.extractRawText({ buffer: Buffer.from(input.bytes) });
        return value;
      }
    }
  }
}

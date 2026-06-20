import type { DocumentParser, ParseDocumentInput } from '../../application/ports/document-parser';
import type { RawClause, RawDocument } from '../../boundary/contract';

// Deterministic stand-in for real PDF/DOCX parsing, so the app runs without a document pipeline
// during dev. Splits the decoded text into clauses on blank lines and guesses a category from
// keywords. Replace with a real parser (and likely Claude-assisted segmentation) later — its
// output stays untrusted and is parsed at the boundary regardless.
export class StubDocumentParser implements DocumentParser {
  async parse(input: ParseDocumentInput): Promise<RawDocument> {
    const text = new TextDecoder().decode(input.bytes);
    const blocks = text
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    const clauses: RawClause[] = blocks.map((block) => {
      const [first, ...rest] = block.split('\n');
      const hasHeading = rest.length > 0 && first !== undefined && first.length <= 80;
      const heading = hasHeading ? (first as string) : null;
      const body = hasHeading ? rest.join('\n') : block;
      return { heading, text: body, category: guessCategory(block) };
    });

    return { clauses };
  }
}

function guessCategory(block: string): string {
  const t = block.toLowerCase();
  if (/\b(pay|payment|invoice|fee|compensation)\b/.test(t)) return 'payment';
  if (/\b(intellectual property|copyright|ip\b|ownership)\b/.test(t)) return 'intellectual_property';
  if (/\b(terminat|cancel)\b/.test(t)) return 'termination';
  if (/\b(liab|indemnif|damages)\b/.test(t)) return 'liability';
  if (/\b(confidential|non-disclosure|nda)\b/.test(t)) return 'confidentiality';
  if (/\b(scope|deliverable|services)\b/.test(t)) return 'scope';
  if (/\b(dispute|arbitration|governing law|jurisdiction)\b/.test(t)) return 'dispute_resolution';
  return 'other';
}

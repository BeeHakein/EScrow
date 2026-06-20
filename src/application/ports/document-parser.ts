import type { DocumentFormat } from '../../domain/contract';
import type { RawDocument } from '../../boundary/contract';

export interface ParseDocumentInput {
  readonly bytes: Uint8Array;
  readonly format: DocumentFormat;
}

// Outbound port. Extracts clauses from the uploaded document. The real adapter parses PDF/DOCX
// (and may use the Claude API to segment + categorize); a stub returns canned clauses. Either
// way the output is UNTRUSTED raw data — the application parses it at the boundary.
export interface DocumentParser {
  parse(input: ParseDocumentInput): Promise<RawDocument>;
}

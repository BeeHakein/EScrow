import type { RawClause } from '../../boundary/contract';

// Pure clause segmentation: split decoded document text into clauses on blank lines, treat a short
// leading line as a heading, and guess a category from keywords. Shared by the stub parser and the
// real (extraction-backed) parser so both segment identically — only the text SOURCE differs.
// The output stays untrusted RawClause[] (category is a free string); boundary/contract.ts validates it.
export function segmentClauses(text: string): RawClause[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  return blocks.map((block) => {
    const [first, ...rest] = block.split('\n');
    const hasHeading = rest.length > 0 && first !== undefined && first.length <= 80;
    const heading = hasHeading ? (first as string) : null;
    const body = hasHeading ? rest.join('\n') : block;
    return { heading, text: body, category: guessCategory(block) };
  });
}

function guessCategory(block: string): string {
  const t = block.toLowerCase();
  if (/\b(pay|payment|invoice|fee|compensation)\b/.test(t)) return 'payment';
  if (/\b(intellectual property|copyright|ip\b|ownership)\b/.test(t)) return 'intellectual_property';
  if (/\b(terminat|cancel)/.test(t)) return 'termination'; // prefix match: terminate/termination/cancelled
  if (/\b(liab|indemnif|damages)\b/.test(t)) return 'liability';
  if (/\b(confidential|non-disclosure|nda)\b/.test(t)) return 'confidentiality';
  if (/\b(scope|deliverable|services)\b/.test(t)) return 'scope';
  if (/\b(dispute|arbitration|governing law|jurisdiction)\b/.test(t)) return 'dispute_resolution';
  return 'other';
}

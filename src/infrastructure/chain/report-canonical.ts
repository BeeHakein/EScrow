import type { ReportHashInput } from '../../application/ports/report-hasher';

// THE canonical pre-image for the report hash. Both the production keccak256 hasher and the
// dev stub hash the bytes of this exact string, so a report hashed in tests and in production
// canonicalizes identically — only the digest function differs. Keys are sorted so logically
// equal inputs always produce the same string; array order is preserved (it is meaningful).
export function canonicalReportString(input: ReportHashInput): string {
  return stableStringify(input);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

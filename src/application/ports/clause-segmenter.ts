import type { RawClause } from '../../boundary/contract';

// Outbound port: split a document's extracted plain text into clauses. Split out from
// TextExtractor (bytes → text) so the *segmentation strategy* is swappable independently of the
// format-specific extraction — a naive blank-line heuristic for deterministic tests, or an
// LLM-assisted segmenter for real documents (which rarely have blank lines between clauses).
// The returned clauses are UNTRUSTED raw data; the application re-validates each at the boundary.
export interface ClauseSegmenter {
  segment(text: string): Promise<readonly RawClause[]>;
}

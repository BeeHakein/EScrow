import type { ClauseSegmenter } from '../../application/ports/clause-segmenter';
import type { RawClause } from '../../boundary/contract';
import { segmentClauses } from './segment-clauses';

// Deterministic ClauseSegmenter: the pure blank-line heuristic behind the port. Good for plain-text
// fixtures and offline tests; weak on real PDF/DOCX (which rarely have blank lines between clauses) —
// production swaps in ClaudeClauseSegmenter with no caller change. Async to satisfy the port; the
// underlying segmentation stays pure and synchronous.
export class HeuristicClauseSegmenter implements ClauseSegmenter {
  async segment(text: string): Promise<readonly RawClause[]> {
    return segmentClauses(text);
  }
}

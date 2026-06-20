import type { ClauseId, ContractId, RiskReportId } from './shared/ids';
import type { AiModelId, Hash32, RiskScore, Timestamp } from './shared/primitives';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// Risk produced by the AI for a single clause. `level` and `score` move together;
// downstream code derives "flagged" from the level rather than storing a redundant flag.
export interface ClauseRisk {
  readonly clauseId: ClauseId;
  readonly level: RiskLevel;
  readonly score: RiskScore; // 0..100
  readonly rationale: string;
  readonly recommendation: string | null;
}

// Immutable artifact. Once generated its `reportHash` is what gets anchored on-chain and
// signed by both parties; regenerating analysis produces a new RiskReport, never a mutation.
export interface RiskReport {
  readonly id: RiskReportId;
  readonly contractId: ContractId;
  readonly model: AiModelId; // pinned analysis model, e.g. claude-sonnet-4-6
  readonly overallLevel: RiskLevel;
  readonly overallScore: RiskScore;
  readonly summary: string;
  readonly assessments: readonly ClauseRisk[];
  readonly generatedAt: Timestamp;
  readonly reportHash: Hash32; // canonical hash anchored on-chain and signed by both parties
}

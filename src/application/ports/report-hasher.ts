import type { ContractId } from '../../domain/shared/ids';
import type { AiModelId, Hash32, Timestamp } from '../../domain/shared/primitives';
import type { RawRiskAnalysis } from '../../boundary/risk-report';

// Canonical, deterministic content hash of the report. This is what gets anchored on Base
// and signed via EIP-712, so production MUST use keccak256 (EVM-native) to match the verifier.
export interface ReportHashInput {
  readonly contractId: ContractId;
  readonly model: AiModelId;
  readonly generatedAt: Timestamp;
  readonly analysis: RawRiskAnalysis;
}

export interface ReportHasher {
  hash(input: ReportHashInput): Promise<Hash32>;
}

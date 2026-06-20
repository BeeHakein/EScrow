import type { ContractId, EscrowId, PartyId, RiskReportId } from './shared/ids';
import type { ChainId, EthereumAddress, Hash32, Timestamp, TxHash } from './shared/primitives';
import type { BothSignatures } from './signature';

// On-chain anchor of the signed risk-report hash (step 3 of the flow).
export interface OnChainAnchor {
  readonly chainId: ChainId;
  readonly reportHash: Hash32;
  readonly anchorTx: TxHash;
  readonly anchoredAt: Timestamp;
}

// The deployed escrow smart contract (exists only from `active` onward).
export interface DeployedEscrow {
  readonly chainId: ChainId;
  readonly address: EthereumAddress;
  readonly deployTx: TxHash;
  readonly deployedAt: Timestamp;
}

// State machine as a discriminated union. Each variant carries exactly the evidence valid
// at that stage, so illegal combinations cannot be constructed:
//   - no anchor before analysis is finalized
//   - no signatures without an anchored report
//   - no funds/milestones without a deployed contract and both signatures
export type EscrowState =
  | { readonly status: 'awaiting_analysis' }
  | {
      readonly status: 'awaiting_signatures';
      readonly riskReportId: RiskReportId;
      readonly anchor: OnChainAnchor;
    }
  | {
      readonly status: 'awaiting_funding';
      readonly riskReportId: RiskReportId;
      readonly anchor: OnChainAnchor;
      readonly signatures: BothSignatures;
    }
  | {
      readonly status: 'active';
      readonly riskReportId: RiskReportId;
      readonly anchor: OnChainAnchor;
      readonly signatures: BothSignatures;
      readonly contract: DeployedEscrow;
    }
  | {
      readonly status: 'completed';
      readonly riskReportId: RiskReportId;
      readonly anchor: OnChainAnchor;
      readonly signatures: BothSignatures;
      readonly contract: DeployedEscrow;
      readonly completedAt: Timestamp;
    }
  | {
      readonly status: 'disputed';
      readonly riskReportId: RiskReportId;
      readonly anchor: OnChainAnchor;
      readonly signatures: BothSignatures;
      readonly contract: DeployedEscrow;
      readonly reason: string;
      readonly raisedBy: PartyId;
      readonly raisedAt: Timestamp;
    }
  | { readonly status: 'cancelled'; readonly reason: string; readonly cancelledAt: Timestamp };

export type EscrowStatus = EscrowState['status'];

// Aggregate root. Milestones are a separate aggregate keyed by escrowId (queried via the
// MilestoneRepository) — the escrow owns lifecycle, milestones own their own release state.
export interface Escrow {
  readonly id: EscrowId;
  readonly contractId: ContractId;
  readonly client: PartyId;
  readonly freelancer: PartyId;
  readonly state: EscrowState;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

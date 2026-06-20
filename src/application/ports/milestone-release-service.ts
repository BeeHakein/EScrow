import type { DeployedEscrow } from '../../domain/escrow';
import type { Money, TxHash } from '../../domain/shared/primitives';

// What the on-chain escrow needs to pay out a single milestone: the deployed contract, the
// milestone's release-order index, and the exact amount it holds for that milestone. Built by
// the use-case from a validated Milestone, so the adapter never sees raw domain milestones.
export interface ReleasePayoutRequest {
  readonly escrow: DeployedEscrow;
  readonly index: number; // milestone release order, 0-based
  readonly amount: Money;
}

// Outbound port (step 6). Releases the milestone's funds from the deployed escrow to the
// freelancer and returns the payout transaction. Real adapter uses viem + the deployed
// Escrow.sol release() method; a stub fakes it. Payout precedes the `released` transition, so
// a failed transfer never marks a milestone released.
export interface MilestoneReleaseService {
  release(request: ReleasePayoutRequest): Promise<TxHash>;
}

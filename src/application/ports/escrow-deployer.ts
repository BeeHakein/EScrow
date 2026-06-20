import type { DeployedEscrow } from '../../domain/escrow';
import type { EscrowId } from '../../domain/shared/ids';
import type { EthereumAddress, Wei } from '../../domain/shared/primitives';

// Everything the on-chain escrow needs at deploy time: the two parties' wallets, the token,
// and the validated milestone funding schedule. Built by the use-case from a FundingPlan +
// party wallets, so the adapter never sees raw domain milestones.
export interface DeployEscrowRequest {
  readonly escrowId: EscrowId;
  readonly client: EthereumAddress;
  readonly freelancer: EthereumAddress;
  readonly token: EthereumAddress | 'native';
  readonly amounts: readonly Wei[]; // per-milestone, in release order
  readonly total: Wei;
}

// Outbound port (step 5). Deploys the escrow contract on Base and funds it with `total`,
// returning the deployed contract. Real adapter uses viem + the compiled Escrow.sol; a stub
// fakes it. Deploy-and-fund is one operation: a deployed-but-unfunded escrow is not `active`.
export interface EscrowDeployer {
  deployAndFund(request: DeployEscrowRequest): Promise<DeployedEscrow>;
}

import type { DeployEscrowRequest, EscrowDeployer } from '../../application/ports/escrow-deployer';
import type { DeployedEscrow } from '../../domain/escrow';
import type { ChainId, EthereumAddress, Timestamp, TxHash } from '../../domain/shared/primitives';

const BASE_SEPOLIA = 84532 as ChainId;

// Deterministic stand-in for deploying + funding the escrow contract — no RPC, no gas, no
// real transfer. Dev only. Replace with a viem-backed adapter that deploys the compiled
// Escrow.sol and funds it with request.total. The fake address/tx are derived from the
// escrow id so they are stable across runs.
export class StubEscrowDeployer implements EscrowDeployer {
  constructor(private readonly now: () => Timestamp) {}

  async deployAndFund(request: DeployEscrowRequest): Promise<DeployedEscrow> {
    const hex = request.escrowId.replace(/[^0-9a-fA-F]/g, '');
    const address = `0x${hex.padEnd(40, '0').slice(0, 40)}` as EthereumAddress;
    const deployTx = `0x${hex.padEnd(64, 'd').slice(0, 64)}` as TxHash;
    return { chainId: BASE_SEPOLIA, address, deployTx, deployedAt: this.now() };
  }
}

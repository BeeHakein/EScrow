import type {
  MilestoneReleaseService,
  ReleasePayoutRequest,
} from '../../application/ports/milestone-release-service';
import type { TxHash } from '../../domain/shared/primitives';

// Deterministic stand-in for releasing milestone funds on-chain — no RPC, no gas, no real
// transfer. Dev only. Replace with a viem-backed adapter that calls the deployed Escrow.sol
// release() for the given index. The fake tx is derived from the contract address + index so
// each milestone's payout has a stable, distinct hash across runs.
export class StubMilestoneReleaseService implements MilestoneReleaseService {
  async release(request: ReleasePayoutRequest): Promise<TxHash> {
    const hex = request.escrow.address.replace(/[^0-9a-fA-F]/g, '');
    return `0x${`${hex}${request.index}`.padEnd(64, 'e').slice(0, 64)}` as TxHash;
  }
}

import type { ReportAnchorService } from '../../application/ports/report-anchor';
import type { OnChainAnchor } from '../../domain/escrow';
import type { ChainId, Hash32, Timestamp, TxHash } from '../../domain/shared/primitives';

const BASE_SEPOLIA = 84532 as ChainId;

// Deterministic stand-in for the on-chain anchor registry — no RPC, no gas. Dev only.
// Replace with a viem-backed adapter writing to the deployed ReportAnchor contract.
export class StubReportAnchorService implements ReportAnchorService {
  constructor(private readonly now: () => Timestamp) {}

  async anchor(reportHash: Hash32): Promise<OnChainAnchor> {
    // Fake but deterministic tx hash derived from the report hash.
    const anchorTx = `0xanchor${reportHash.slice(8)}`.slice(0, 66) as TxHash;
    return { chainId: BASE_SEPOLIA, reportHash, anchorTx, anchoredAt: this.now() };
  }
}

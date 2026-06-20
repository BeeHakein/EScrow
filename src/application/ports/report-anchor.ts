import type { OnChainAnchor } from '../../domain/escrow';
import type { Hash32 } from '../../domain/shared/primitives';

// Outbound port. Writes the report hash to the on-chain anchor registry on Base and returns
// the resulting anchor. Real adapter uses viem + a deployed registry contract; a stub fakes it.
export interface ReportAnchorService {
  anchor(reportHash: Hash32): Promise<OnChainAnchor>;
}

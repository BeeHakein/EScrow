import type { PartySignature } from '../signature';
import type { EscrowId } from '../shared/ids';

// Collects the individual party signatures for an escrow until both are present.
// One signature per party (saving again for the same party replaces it).
export interface SignatureRepository {
  save(escrowId: EscrowId, signature: PartySignature): Promise<void>;
  findByEscrow(escrowId: EscrowId): Promise<readonly PartySignature[]>;
}

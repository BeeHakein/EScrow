import type { Party } from '../party';
import type { PartyId, UserId } from '../shared/ids';
import type { EthereumAddress } from '../shared/primitives';

// Port. Implemented by an adapter in src/infrastructure/db/repositories — never here.
// `find*` returns null for "not found" (an expected outcome); it never throws for absence.
export interface PartyRepository {
  save(party: Party): Promise<void>;
  findById(id: PartyId): Promise<Party | null>;
  findByWallet(address: EthereumAddress): Promise<Party | null>;
  listByUser(userId: UserId): Promise<readonly Party[]>;
}

import type { PartyId, UserId } from './shared/ids';
import type { EthereumAddress } from './shared/primitives';

// A participant in one escrow. The same user may be a client in one escrow and a
// freelancer in another, so role belongs to the Party, not the User.
export type PartyRole = 'client' | 'freelancer';

export interface Party {
  readonly id: PartyId;
  readonly userId: UserId; // NextAuth account behind this party
  readonly role: PartyRole;
  readonly displayName: string;
  readonly walletAddress: EthereumAddress;
}

import type { PartyRepository } from '../../../domain/repositories/party-repository';
import type { Party } from '../../../domain/party';
import type { PartyId, UserId } from '../../../domain/shared/ids';
import type { EthereumAddress } from '../../../domain/shared/primitives';

export class InMemoryPartyRepository implements PartyRepository {
  private readonly byId = new Map<PartyId, Party>();

  async save(party: Party): Promise<void> {
    this.byId.set(party.id, party);
  }

  async findById(id: PartyId): Promise<Party | null> {
    return this.byId.get(id) ?? null;
  }

  async findByWallet(address: EthereumAddress): Promise<Party | null> {
    for (const party of this.byId.values()) if (party.walletAddress === address) return party;
    return null;
  }

  async listByUser(userId: UserId): Promise<readonly Party[]> {
    return [...this.byId.values()].filter((p) => p.userId === userId);
  }
}

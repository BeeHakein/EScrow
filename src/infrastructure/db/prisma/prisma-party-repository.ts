import type { PrismaClient } from '@prisma/client';
import type { PartyRepository } from '../../../domain/repositories/party-repository';
import type { Party } from '../../../domain/party';
import type { PartyId, UserId } from '../../../domain/shared/ids';
import type { EthereumAddress } from '../../../domain/shared/primitives';
import { parsePartyRow } from '../../../boundary/db-row';
import { orThrow } from './parse-or-throw';

// Prisma adapter for PartyRepository. A flat aggregate — every field maps to a column directly.
export class PrismaPartyRepository implements PartyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(party: Party): Promise<void> {
    const scalar = {
      userId: party.userId,
      role: party.role,
      displayName: party.displayName,
      walletAddress: party.walletAddress,
    };
    await this.prisma.party.upsert({
      where: { id: party.id },
      create: { id: party.id, ...scalar },
      update: scalar,
    });
  }

  async findById(id: PartyId): Promise<Party | null> {
    const row = await this.prisma.party.findUnique({ where: { id } });
    return row ? orThrow(parsePartyRow(row)) : null;
  }

  async findByWallet(address: EthereumAddress): Promise<Party | null> {
    const row = await this.prisma.party.findFirst({ where: { walletAddress: address } });
    return row ? orThrow(parsePartyRow(row)) : null;
  }

  async listByUser(userId: UserId): Promise<readonly Party[]> {
    const rows = await this.prisma.party.findMany({ where: { userId } });
    return rows.map((r) => orThrow(parsePartyRow(r)));
  }
}

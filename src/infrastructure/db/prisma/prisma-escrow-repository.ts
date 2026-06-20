import type { PrismaClient } from '@prisma/client';
import type { EscrowRepository } from '../../../domain/repositories/escrow-repository';
import type { Escrow } from '../../../domain/escrow';
import type { ContractId, EscrowId, PartyId } from '../../../domain/shared/ids';
import { parseEscrowRow, serializeEscrowState } from '../../../boundary/db-row';
import { orThrow } from './parse-or-throw';

// Prisma adapter for EscrowRepository. The EscrowState discriminated union is serialized to
// canonical JSON (serializeEscrowState) in the `state` column and rebuilt by parseEscrowRow on
// read; contractId/client/freelancer stay real columns so the port's queries hit indexes.
export class PrismaEscrowRepository implements EscrowRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(escrow: Escrow): Promise<void> {
    const scalar = {
      contractId: escrow.contractId,
      client: escrow.client,
      freelancer: escrow.freelancer,
      state: serializeEscrowState(escrow.state),
      createdAt: escrow.createdAt,
      updatedAt: escrow.updatedAt,
    };
    await this.prisma.escrow.upsert({
      where: { id: escrow.id },
      create: { id: escrow.id, ...scalar },
      update: scalar,
    });
  }

  async findById(id: EscrowId): Promise<Escrow | null> {
    const row = await this.prisma.escrow.findUnique({ where: { id } });
    return row ? orThrow(parseEscrowRow(row)) : null;
  }

  async findByContract(contractId: ContractId): Promise<Escrow | null> {
    const row = await this.prisma.escrow.findUnique({ where: { contractId } });
    return row ? orThrow(parseEscrowRow(row)) : null;
  }

  async listByParty(partyId: PartyId): Promise<readonly Escrow[]> {
    const rows = await this.prisma.escrow.findMany({
      where: { OR: [{ client: partyId }, { freelancer: partyId }] },
    });
    return rows.map((r) => orThrow(parseEscrowRow(r)));
  }
}

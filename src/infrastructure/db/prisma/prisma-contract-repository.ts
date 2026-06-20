import type { PrismaClient } from '@prisma/client';
import type { ContractRepository } from '../../../domain/repositories/contract-repository';
import type { Contract } from '../../../domain/contract';
import type { ContractId, PartyId } from '../../../domain/shared/ids';
import { parseContractRow } from '../../../boundary/db-row';
import { orThrow } from './parse-or-throw';

// Prisma adapter for ContractRepository. Same port the in-memory repo implements; callers
// (the use-cases) never change. Clauses are owned by the contract — on save they are replaced
// wholesale (deleteMany + create) so the persisted set is always "one file, one truth".
export class PrismaContractRepository implements ContractRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(contract: Contract): Promise<void> {
    const clauses = contract.clauses.map((c) => ({
      id: c.id,
      index: c.index,
      heading: c.heading,
      text: c.text,
      category: c.category,
    }));
    const scalar = {
      title: contract.title,
      format: contract.format,
      contentHash: contract.contentHash,
      storageKey: contract.storageKey,
      uploadedBy: contract.uploadedBy,
      uploadedAt: contract.uploadedAt,
    };
    await this.prisma.contract.upsert({
      where: { id: contract.id },
      create: { id: contract.id, ...scalar, clauses: { create: clauses } },
      update: { ...scalar, clauses: { deleteMany: {}, create: clauses } },
    });
  }

  async findById(id: ContractId): Promise<Contract | null> {
    const row = await this.prisma.contract.findUnique({ where: { id }, include: { clauses: true } });
    return row ? orThrow(parseContractRow(row)) : null;
  }

  async listByParty(partyId: PartyId): Promise<readonly Contract[]> {
    const rows = await this.prisma.contract.findMany({
      where: { uploadedBy: partyId },
      include: { clauses: true },
    });
    return rows.map((r) => orThrow(parseContractRow(r)));
  }
}

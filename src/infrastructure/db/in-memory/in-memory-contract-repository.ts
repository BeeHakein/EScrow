import type { ContractRepository } from '../../../domain/repositories/contract-repository';
import type { Contract } from '../../../domain/contract';
import type { ContractId, PartyId } from '../../../domain/shared/ids';

// Simplest implementation that works; the Prisma adapter implements the same port later.
export class InMemoryContractRepository implements ContractRepository {
  private readonly byId = new Map<ContractId, Contract>();

  async save(contract: Contract): Promise<void> {
    this.byId.set(contract.id, contract);
  }

  async findById(id: ContractId): Promise<Contract | null> {
    return this.byId.get(id) ?? null;
  }

  async listByParty(partyId: PartyId): Promise<readonly Contract[]> {
    return [...this.byId.values()].filter((c) => c.uploadedBy === partyId);
  }
}

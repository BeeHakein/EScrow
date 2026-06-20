import type { EscrowRepository } from '../../../domain/repositories/escrow-repository';
import type { Escrow } from '../../../domain/escrow';
import type { ContractId, EscrowId, PartyId } from '../../../domain/shared/ids';

// Simplest implementation that works; the Prisma adapter implements the same port later.
export class InMemoryEscrowRepository implements EscrowRepository {
  private readonly byId = new Map<EscrowId, Escrow>();

  async save(escrow: Escrow): Promise<void> {
    this.byId.set(escrow.id, escrow);
  }

  async findById(id: EscrowId): Promise<Escrow | null> {
    return this.byId.get(id) ?? null;
  }

  async findByContract(contractId: ContractId): Promise<Escrow | null> {
    for (const escrow of this.byId.values()) if (escrow.contractId === contractId) return escrow;
    return null;
  }

  async listByParty(partyId: PartyId): Promise<readonly Escrow[]> {
    return [...this.byId.values()].filter((e) => e.client === partyId || e.freelancer === partyId);
  }
}

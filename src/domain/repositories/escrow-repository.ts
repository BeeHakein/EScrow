import type { Escrow } from '../escrow';
import type { ContractId, EscrowId, PartyId } from '../shared/ids';

export interface EscrowRepository {
  save(escrow: Escrow): Promise<void>;
  findById(id: EscrowId): Promise<Escrow | null>;
  findByContract(contractId: ContractId): Promise<Escrow | null>;
  listByParty(partyId: PartyId): Promise<readonly Escrow[]>;
}

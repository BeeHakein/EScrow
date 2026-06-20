import type { Contract } from '../contract';
import type { ContractId, PartyId } from '../shared/ids';

export interface ContractRepository {
  save(contract: Contract): Promise<void>;
  findById(id: ContractId): Promise<Contract | null>;
  listByParty(partyId: PartyId): Promise<readonly Contract[]>;
}

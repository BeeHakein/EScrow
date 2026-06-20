import type { Milestone } from '../milestone';
import type { EscrowId, MilestoneId } from '../shared/ids';

export interface MilestoneRepository {
  save(milestone: Milestone): Promise<void>;
  findById(id: MilestoneId): Promise<Milestone | null>;
  // Ordered by Milestone.index ascending (release order).
  listByEscrow(escrowId: EscrowId): Promise<readonly Milestone[]>;
}

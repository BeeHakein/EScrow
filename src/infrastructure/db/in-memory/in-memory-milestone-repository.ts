import type { MilestoneRepository } from '../../../domain/repositories/milestone-repository';
import type { Milestone } from '../../../domain/milestone';
import type { EscrowId, MilestoneId } from '../../../domain/shared/ids';

// Simplest implementation that works; the Prisma adapter implements the same port later.
export class InMemoryMilestoneRepository implements MilestoneRepository {
  private readonly byId = new Map<MilestoneId, Milestone>();

  async save(milestone: Milestone): Promise<void> {
    this.byId.set(milestone.id, milestone);
  }

  async findById(id: MilestoneId): Promise<Milestone | null> {
    return this.byId.get(id) ?? null;
  }

  // Ordered by Milestone.index ascending, per the port contract (release order).
  async listByEscrow(escrowId: EscrowId): Promise<readonly Milestone[]> {
    return [...this.byId.values()].filter((m) => m.escrowId === escrowId).sort((a, b) => a.index - b.index);
  }
}

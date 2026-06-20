import type { PrismaClient } from '@prisma/client';
import type { MilestoneRepository } from '../../../domain/repositories/milestone-repository';
import type { Milestone } from '../../../domain/milestone';
import type { EscrowId, MilestoneId } from '../../../domain/shared/ids';
import { parseMilestoneRow, serializeMilestoneStatus } from '../../../boundary/db-row';
import { orThrow } from './parse-or-throw';

// Prisma adapter for MilestoneRepository. Money is split into a base-10 wei string + token
// column (no floats, no bigint-on-sqlite surprises); the MilestoneStatus union is canonical
// JSON. listByEscrow returns rows ordered by index ascending, per the port (release order).
export class PrismaMilestoneRepository implements MilestoneRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(milestone: Milestone): Promise<void> {
    const scalar = {
      escrowId: milestone.escrowId,
      index: milestone.index,
      title: milestone.title,
      description: milestone.description,
      amountWei: milestone.amount.amount.toString(),
      amountToken: milestone.amount.token,
      status: serializeMilestoneStatus(milestone.status),
    };
    await this.prisma.milestone.upsert({
      where: { id: milestone.id },
      create: { id: milestone.id, ...scalar },
      update: scalar,
    });
  }

  async findById(id: MilestoneId): Promise<Milestone | null> {
    const row = await this.prisma.milestone.findUnique({ where: { id } });
    return row ? orThrow(parseMilestoneRow(row)) : null;
  }

  async listByEscrow(escrowId: EscrowId): Promise<readonly Milestone[]> {
    const rows = await this.prisma.milestone.findMany({
      where: { escrowId },
      orderBy: { index: 'asc' },
    });
    return rows.map((r) => orThrow(parseMilestoneRow(r)));
  }
}

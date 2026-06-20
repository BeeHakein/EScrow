import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaMilestoneRepository } from '../../../src/infrastructure/db/prisma/prisma-milestone-repository';
import type { EscrowId, MilestoneId } from '../../../src/domain/shared/ids';
import type { Wei } from '../../../src/domain/shared/primitives';
import { createTestDb, resetDb, type TestDb } from './test-db';
import { milestone, milestoneStatuses, ESCROW } from './fixtures';

describe('PrismaMilestoneRepository', () => {
  let db: TestDb;
  beforeAll(() => {
    db = createTestDb();
  });
  afterAll(async () => {
    await db.cleanup();
  });
  beforeEach(async () => {
    await resetDb(db.prisma);
  });

  // Every status variant must serialize and rebuild to a deeply-equal value.
  for (const [name, status] of Object.entries(milestoneStatuses)) {
    it(`round-trips the '${name}' status`, async () => {
      const repo = new PrismaMilestoneRepository(db.prisma);
      const m = milestone(0, status);
      await repo.save(m);
      expect(await repo.findById(m.id)).toEqual(m);
    });
  }

  it('preserves the exact wei amount (no float/precision loss)', async () => {
    const repo = new PrismaMilestoneRepository(db.prisma);
    const big = 123456789012345678901234567890n as Wei;
    const m = milestone(0, milestoneStatuses.funded, { amount: { amount: big, token: 'native' } });
    await repo.save(m);
    const found = await repo.findById(m.id);
    expect(found?.amount.amount).toBe(big);
    expect(found?.amount.token).toBe('native');
  });

  it('returns null for a missing milestone', async () => {
    const repo = new PrismaMilestoneRepository(db.prisma);
    expect(await repo.findById('nope' as MilestoneId)).toBeNull();
  });

  it('lists by escrow ordered by index ascending', async () => {
    const repo = new PrismaMilestoneRepository(db.prisma);
    await repo.save(milestone(2, milestoneStatuses.pending));
    await repo.save(milestone(0, milestoneStatuses.released));
    await repo.save(milestone(1, milestoneStatuses.approved));
    const ordered = await repo.listByEscrow(ESCROW);
    expect(ordered.map((m) => m.index)).toEqual([0, 1, 2]);
    expect(await repo.listByEscrow('ghost' as EscrowId)).toEqual([]);
  });

  it('save is an upsert — a status change overwrites in place', async () => {
    const repo = new PrismaMilestoneRepository(db.prisma);
    await repo.save(milestone(0, milestoneStatuses.funded));
    await repo.save(milestone(0, milestoneStatuses.released));
    expect((await repo.findById(milestone(0, milestoneStatuses.released).id))?.status.kind).toBe('released');
  });
});

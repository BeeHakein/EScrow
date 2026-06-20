import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaPartyRepository } from '../../../src/infrastructure/db/prisma/prisma-party-repository';
import type { PartyId, UserId } from '../../../src/domain/shared/ids';
import { createTestDb, resetDb, type TestDb } from './test-db';
import { party, ADDR, ADDR2, FREELANCER } from './fixtures';

describe('PrismaPartyRepository', () => {
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

  it('round-trips a party through save → findById', async () => {
    const repo = new PrismaPartyRepository(db.prisma);
    const p = party();
    await repo.save(p);
    expect(await repo.findById(p.id)).toEqual(p);
  });

  it('returns null for a missing party', async () => {
    const repo = new PrismaPartyRepository(db.prisma);
    expect(await repo.findById('nope' as PartyId)).toBeNull();
  });

  it('save is an upsert — re-saving the same id replaces it', async () => {
    const repo = new PrismaPartyRepository(db.prisma);
    await repo.save(party());
    await repo.save(party({ displayName: 'Renamed' }));
    expect((await repo.findById(party().id))?.displayName).toBe('Renamed');
  });

  it('finds by wallet and lists by user', async () => {
    const repo = new PrismaPartyRepository(db.prisma);
    const alice = party();
    const bob = party({ id: FREELANCER, role: 'freelancer', displayName: 'Bob', walletAddress: ADDR2 });
    await repo.save(alice);
    await repo.save(bob);

    expect(await repo.findByWallet(ADDR)).toEqual(alice);
    expect(await repo.findByWallet(ADDR2)).toEqual(bob);

    const sameUser = await repo.listByUser(alice.userId);
    expect(sameUser).toHaveLength(2); // both fixtures share user-1
    expect(await repo.listByUser('other' as UserId)).toEqual([]);
  });
});

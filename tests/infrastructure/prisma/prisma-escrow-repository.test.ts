import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaEscrowRepository } from '../../../src/infrastructure/db/prisma/prisma-escrow-repository';
import type { ContractId, EscrowId, PartyId } from '../../../src/domain/shared/ids';
import { createTestDb, resetDb, type TestDb } from './test-db';
import { escrow, states, CLIENT, FREELANCER } from './fixtures';

describe('PrismaEscrowRepository', () => {
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

  // Every state-machine variant must serialize and rebuild to a deeply-equal value.
  for (const [name, state] of Object.entries(states)) {
    it(`round-trips the '${name}' state`, async () => {
      const repo = new PrismaEscrowRepository(db.prisma);
      const e = escrow(state);
      await repo.save(e);
      expect(await repo.findById(e.id)).toEqual(e);
    });
  }

  it('returns null for a missing escrow', async () => {
    const repo = new PrismaEscrowRepository(db.prisma);
    expect(await repo.findById('nope' as EscrowId)).toBeNull();
  });

  it('save is an upsert — state transitions overwrite in place', async () => {
    const repo = new PrismaEscrowRepository(db.prisma);
    await repo.save(escrow(states.awaiting_analysis));
    await repo.save(escrow(states.active));
    expect((await repo.findById(escrow(states.active).id))?.state.status).toBe('active');
  });

  it('finds by contract (one escrow per contract)', async () => {
    const repo = new PrismaEscrowRepository(db.prisma);
    const e = escrow(states.active);
    await repo.save(e);
    expect(await repo.findByContract(e.contractId)).toEqual(e);
    expect(await repo.findByContract('ghost' as ContractId)).toBeNull();
  });

  it('lists escrows where the party is client OR freelancer', async () => {
    const repo = new PrismaEscrowRepository(db.prisma);
    await repo.save(escrow(states.active));
    expect(await repo.listByParty(CLIENT)).toHaveLength(1);
    expect(await repo.listByParty(FREELANCER)).toHaveLength(1);
    expect(await repo.listByParty('stranger' as PartyId)).toEqual([]);
  });
});

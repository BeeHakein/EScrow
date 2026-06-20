import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaContractRepository } from '../../../src/infrastructure/db/prisma/prisma-contract-repository';
import type { ClauseId, ContractId, PartyId } from '../../../src/domain/shared/ids';
import { createTestDb, resetDb, type TestDb } from './test-db';
import { contract, clause, CLIENT, FREELANCER } from './fixtures';

describe('PrismaContractRepository', () => {
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

  it('round-trips a contract with its clauses (ordered by index)', async () => {
    const repo = new PrismaContractRepository(db.prisma);
    const c = contract();
    await repo.save(c);
    const found = await repo.findById(c.id);
    expect(found).toEqual(c);
    expect(found?.clauses.map((cl) => cl.index)).toEqual([0, 1]);
  });

  it('returns null for a missing contract', async () => {
    const repo = new PrismaContractRepository(db.prisma);
    expect(await repo.findById('nope' as ContractId)).toBeNull();
  });

  it('re-saving replaces the owned clause set wholesale (no orphans)', async () => {
    const repo = new PrismaContractRepository(db.prisma);
    await repo.save(contract());
    // Same contract id, a single different clause.
    await repo.save(contract({ clauses: [clause(0, { text: 'only clause now' })] }));
    const found = await repo.findById(contract().id);
    expect(found?.clauses).toHaveLength(1);
    expect(found?.clauses[0]?.text).toBe('only clause now');
  });

  it('lists by uploading party', async () => {
    const repo = new PrismaContractRepository(db.prisma);
    await repo.save(contract());
    // Distinct clause id — clause id is a global primary key (real uploads mint unique ids).
    await repo.save(
      contract({
        id: 'contract-2' as ContractId,
        uploadedBy: FREELANCER,
        clauses: [clause(0, { id: 'clause-2-0' as ClauseId, contractId: 'contract-2' as ContractId })],
      }),
    );
    const mine = await repo.listByParty(CLIENT);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.id).toBe('contract-1');
    expect(await repo.listByParty('ghost' as PartyId)).toEqual([]);
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaSignatureRepository } from '../../../src/infrastructure/db/prisma/prisma-signature-repository';
import type { EscrowId } from '../../../src/domain/shared/ids';
import { createTestDb, resetDb, type TestDb } from './test-db';
import { sig, CLIENT, FREELANCER, ESCROW } from './fixtures';

describe('PrismaSignatureRepository', () => {
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

  it('collects both party signatures for an escrow', async () => {
    const repo = new PrismaSignatureRepository(db.prisma);
    await repo.save(ESCROW, sig(CLIENT));
    await repo.save(ESCROW, sig(FREELANCER));
    const found = await repo.findByEscrow(ESCROW);
    expect(found).toHaveLength(2);
    expect(found.map((s) => s.party).sort()).toEqual([CLIENT, FREELANCER].sort());
  });

  it('a party re-signing replaces its earlier signature (one per party)', async () => {
    const repo = new PrismaSignatureRepository(db.prisma);
    await repo.save(ESCROW, sig(CLIENT));
    await repo.save(ESCROW, { ...sig(CLIENT), signedAt: '2026-06-20T00:00:00.000Z' as ReturnType<typeof sig>['signedAt'] });
    const found = await repo.findByEscrow(ESCROW);
    expect(found).toHaveLength(1);
    expect(found[0]?.signedAt).toBe('2026-06-20T00:00:00.000Z');
  });

  it('round-trips a signature value object exactly', async () => {
    const repo = new PrismaSignatureRepository(db.prisma);
    const s = sig(CLIENT);
    await repo.save(ESCROW, s);
    expect((await repo.findByEscrow(ESCROW))[0]).toEqual(s);
  });

  it('scopes signatures to their escrow', async () => {
    const repo = new PrismaSignatureRepository(db.prisma);
    await repo.save(ESCROW, sig(CLIENT));
    expect(await repo.findByEscrow('other-escrow' as EscrowId)).toEqual([]);
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaRiskReportRepository } from '../../../src/infrastructure/db/prisma/prisma-risk-report-repository';
import type { ContractId, RiskReportId } from '../../../src/domain/shared/ids';
import { createTestDb, resetDb, type TestDb } from './test-db';
import { riskReport, at, CONTRACT } from './fixtures';

describe('PrismaRiskReportRepository', () => {
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

  it('round-trips a report with its per-clause assessments', async () => {
    const repo = new PrismaRiskReportRepository(db.prisma);
    const r = riskReport();
    await repo.save(r);
    expect(await repo.findById(r.id)).toEqual(r);
  });

  it('returns null for a missing report', async () => {
    const repo = new PrismaRiskReportRepository(db.prisma);
    expect(await repo.findById('nope' as RiskReportId)).toBeNull();
  });

  it('findByContract returns the latest report by generatedAt', async () => {
    const repo = new PrismaRiskReportRepository(db.prisma);
    const older = riskReport({ id: 'report-old' as RiskReportId, generatedAt: at('2026-06-18T01:00:00.000Z') });
    const newer = riskReport({ id: 'report-new' as RiskReportId, generatedAt: at('2026-06-19T01:00:00.000Z') });
    await repo.save(older);
    await repo.save(newer);
    expect((await repo.findByContract(CONTRACT))?.id).toBe('report-new');
    expect(await repo.findByContract('ghost' as ContractId)).toBeNull();
  });

  it('re-saving replaces the assessment set wholesale', async () => {
    const repo = new PrismaRiskReportRepository(db.prisma);
    await repo.save(riskReport());
    await repo.save(riskReport({ assessments: [] }));
    expect((await repo.findById(riskReport().id))?.assessments).toEqual([]);
  });
});

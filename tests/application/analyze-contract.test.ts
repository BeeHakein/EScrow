import { describe, it, expect } from 'vitest';
import type { Contract } from '../../src/domain/contract';
import type { ClauseId, ContractId, PartyId, RiskReportId } from '../../src/domain/shared/ids';
import type { AiModelId, Hash32, Timestamp } from '../../src/domain/shared/primitives';
import { analyzeContract, type AnalyzeContractDeps } from '../../src/application/analyze-contract';
import { StubContractAnalyzer } from '../../src/infrastructure/ai/stub-analyzer';
import { InsecureStubHasher } from '../../src/infrastructure/chain/insecure-stub-hasher';
import { InMemoryRiskReportRepository } from '../../src/infrastructure/db/in-memory/in-memory-risk-report-repository';

function makeContract(): Contract {
  const id = 'c1' as ContractId;
  return {
    id,
    title: 'Design Agreement',
    format: 'pdf',
    contentHash: `0x${'11'.repeat(32)}` as Hash32,
    storageKey: 'blob/c1',
    uploadedBy: 'p1' as PartyId,
    uploadedAt: '2026-06-18T00:00:00.000Z' as Timestamp,
    clauses: [
      { id: 'cl1' as ClauseId, contractId: id, index: 0, heading: 'Payment', text: '...', category: 'payment' },
      { id: 'cl2' as ClauseId, contractId: id, index: 1, heading: 'Liability', text: '...', category: 'liability' },
    ],
  };
}

function makeDeps(reports: InMemoryRiskReportRepository): AnalyzeContractDeps {
  return {
    analyzer: new StubContractAnalyzer(),
    hasher: new InsecureStubHasher(),
    reports,
    newReportId: () => 'r1' as RiskReportId,
    now: () => '2026-06-18T12:00:00.000Z' as Timestamp,
    model: 'claude-sonnet-4-6' as AiModelId,
  };
}

describe('analyzeContract', () => {
  it('produces and saves a report with one assessment per clause', async () => {
    const reports = new InMemoryRiskReportRepository();
    const result = await analyzeContract(makeContract(), makeDeps(reports));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assessments).toHaveLength(2);
    expect(result.value.overallLevel).toBe('high'); // the liability clause flags high
    expect(result.value.reportHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(await reports.findById('r1' as RiskReportId)).not.toBeNull();
  });

  it('hashes deterministically (same input -> same reportHash)', async () => {
    const a = await analyzeContract(makeContract(), makeDeps(new InMemoryRiskReportRepository()));
    const b = await analyzeContract(makeContract(), makeDeps(new InMemoryRiskReportRepository()));
    expect(a.ok && b.ok && a.value.reportHash === b.value.reportHash).toBe(true);
  });
});

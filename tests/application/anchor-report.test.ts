import { describe, it, expect } from 'vitest';
import { analyzeContract, type AnalyzeContractDeps } from '../../src/application/analyze-contract';
import { anchorReport, type AnchorReportDeps } from '../../src/application/anchor-report';
import { createEscrow } from '../../src/domain/escrow-transitions';
import { StubContractAnalyzer } from '../../src/infrastructure/ai/stub-analyzer';
import { InsecureStubHasher } from '../../src/infrastructure/chain/insecure-stub-hasher';
import { StubReportAnchorService } from '../../src/infrastructure/chain/stub-anchor-service';
import { InMemoryRiskReportRepository } from '../../src/infrastructure/db/in-memory/in-memory-risk-report-repository';
import { InMemoryEscrowRepository } from '../../src/infrastructure/db/in-memory/in-memory-escrow-repository';
import type { Contract } from '../../src/domain/contract';
import type { ClauseId, ContractId, EscrowId, PartyId, RiskReportId } from '../../src/domain/shared/ids';
import type { AiModelId, Hash32, Timestamp } from '../../src/domain/shared/primitives';

const CONTRACT_ID = 'c1' as ContractId;

const makeContract = (): Contract => ({
  id: CONTRACT_ID,
  title: 'Design Agreement',
  format: 'pdf',
  contentHash: `0x${'11'.repeat(32)}` as Hash32,
  storageKey: 'blob/c1',
  uploadedBy: 'client' as PartyId,
  uploadedAt: '2026-06-18T00:00:00.000Z' as Timestamp,
  clauses: [
    { id: 'cl1' as ClauseId, contractId: CONTRACT_ID, index: 0, heading: 'Payment', text: '...', category: 'payment' },
  ],
});

const analyzeDeps = (reports: InMemoryRiskReportRepository): AnalyzeContractDeps => ({
  analyzer: new StubContractAnalyzer(),
  hasher: new InsecureStubHasher(),
  reports,
  newReportId: () => 'r1' as RiskReportId,
  now: () => '2026-06-18T12:00:00.000Z' as Timestamp,
  model: 'claude-sonnet-4-6' as AiModelId,
});

describe('anchorReport use-case', () => {
  it('anchors the report hash and advances the escrow to awaiting_signatures', async () => {
    const reports = new InMemoryRiskReportRepository();
    const escrows = new InMemoryEscrowRepository();
    const analysis = await analyzeContract(makeContract(), analyzeDeps(reports));
    expect(analysis.ok).toBe(true);
    if (!analysis.ok) return;

    await escrows.save(
      createEscrow({
        id: 'e1' as EscrowId,
        contractId: CONTRACT_ID,
        client: 'client' as PartyId,
        freelancer: 'freelancer' as PartyId,
        at: '2026-06-18T11:00:00.000Z' as Timestamp,
      }),
    );

    const deps: AnchorReportDeps = {
      escrows,
      reports,
      anchorService: new StubReportAnchorService(() => '2026-06-18T13:00:00.000Z' as Timestamp),
      now: () => '2026-06-18T13:00:00.000Z' as Timestamp,
    };

    const result = await anchorReport('e1' as EscrowId, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.status).toBe('awaiting_signatures');
    if (result.value.state.status !== 'awaiting_signatures') return;
    expect(result.value.state.anchor.reportHash).toBe(analysis.value.reportHash);

    // Anchoring again is rejected — the escrow is no longer awaiting analysis.
    expect((await anchorReport('e1' as EscrowId, deps)).ok).toBe(false);
  });

  it('fails when no risk report exists for the contract', async () => {
    const escrows = new InMemoryEscrowRepository();
    await escrows.save(
      createEscrow({
        id: 'e2' as EscrowId,
        contractId: CONTRACT_ID,
        client: 'client' as PartyId,
        freelancer: 'freelancer' as PartyId,
        at: '2026-06-18T11:00:00.000Z' as Timestamp,
      }),
    );
    const deps: AnchorReportDeps = {
      escrows,
      reports: new InMemoryRiskReportRepository(),
      anchorService: new StubReportAnchorService(() => '2026-06-18T13:00:00.000Z' as Timestamp),
      now: () => '2026-06-18T13:00:00.000Z' as Timestamp,
    };
    expect((await anchorReport('e2' as EscrowId, deps)).ok).toBe(false);
  });
});

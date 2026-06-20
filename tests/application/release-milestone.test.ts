import { describe, it, expect } from 'vitest';
import { releaseMilestone, type ReleaseMilestoneDeps } from '../../src/application/release-milestone';
import { activate, anchorReport, createEscrow, provideSignatures } from '../../src/domain/escrow-transitions';
import { StubMilestoneReleaseService } from '../../src/infrastructure/chain/stub-milestone-release-service';
import { InMemoryEscrowRepository } from '../../src/infrastructure/db/in-memory/in-memory-escrow-repository';
import { InMemoryMilestoneRepository } from '../../src/infrastructure/db/in-memory/in-memory-milestone-repository';
import type { DeployedEscrow, Escrow, OnChainAnchor } from '../../src/domain/escrow';
import type { Milestone, MilestoneStatus } from '../../src/domain/milestone';
import type { BothSignatures, PartySignature } from '../../src/domain/signature';
import type { ContractId, EscrowId, MilestoneId, PartyId, RiskReportId } from '../../src/domain/shared/ids';
import type { ChainId, EthereumAddress, Hash32, Timestamp, TxHash, Wei } from '../../src/domain/shared/primitives';

const ESCROW = 'e1' as EscrowId;
const CLIENT = 'client' as PartyId;
const FREELANCER = 'freelancer' as PartyId;
const HASH = `0x${'ab'.repeat(32)}` as Hash32;
const USDC = `0x${'a'.repeat(40)}` as EthereumAddress;
const at = (s: string): Timestamp => s as Timestamp;
const NOW = at('2026-06-19T00:00:00.000Z');

const sig = (party: PartyId): PartySignature => ({
  party,
  signer: `0x${'1'.repeat(40)}` as EthereumAddress,
  signature: `0x${'2'.repeat(130)}`,
  signedHash: HASH,
  signedAt: at('2026-06-18T02:00:00.000Z'),
});

const milestone = (index: number, status: MilestoneStatus): Milestone => ({
  id: `m${index}` as MilestoneId,
  escrowId: ESCROW,
  index,
  title: `Milestone ${index}`,
  description: '...',
  amount: { amount: 100n as Wei, token: USDC },
  status,
});

// Drive a fresh escrow through the pure transitions to the `active` state.
const activeEscrow = (): Escrow => {
  const anchor: OnChainAnchor = {
    chainId: 84532 as ChainId,
    reportHash: HASH,
    anchorTx: `0x${'cd'.repeat(32)}` as TxHash,
    anchoredAt: at('2026-06-18T01:00:00.000Z'),
  };
  const contract: DeployedEscrow = {
    chainId: 84532 as ChainId,
    address: `0x${'f'.repeat(40)}` as EthereumAddress,
    deployTx: `0x${'de'.repeat(32)}` as TxHash,
    deployedAt: at('2026-06-18T03:00:00.000Z'),
  };
  const both: BothSignatures = { client: sig(CLIENT), freelancer: sig(FREELANCER) };
  const created = createEscrow({
    id: ESCROW,
    contractId: 'c1' as ContractId,
    client: CLIENT,
    freelancer: FREELANCER,
    at: at('2026-06-18T00:00:00.000Z'),
  });
  const anchored = anchorReport(created, { riskReportId: 'r1' as RiskReportId, anchor }, at('t1'));
  if (!anchored.ok) throw new Error(anchored.error);
  const signed = provideSignatures(anchored.value, both, at('t2'));
  if (!signed.ok) throw new Error(signed.error);
  const activated = activate(signed.value, contract, at('t3'));
  if (!activated.ok) throw new Error(activated.error);
  return activated.value;
};

interface Fixture {
  readonly escrows: InMemoryEscrowRepository;
  readonly milestones: InMemoryMilestoneRepository;
  readonly deps: ReleaseMilestoneDeps;
}

const setup = async (milestones: readonly Milestone[]): Promise<Fixture> => {
  const escrows = new InMemoryEscrowRepository();
  const milestoneRepo = new InMemoryMilestoneRepository();
  await escrows.save(activeEscrow());
  for (const m of milestones) await milestoneRepo.save(m);
  return {
    escrows,
    milestones: milestoneRepo,
    deps: { escrows, milestones: milestoneRepo, payout: new StubMilestoneReleaseService(), now: () => NOW },
  };
};

const approved = (index: number): Milestone => milestone(index, { kind: 'approved', approvedAt: at('t-a') });
const released = (index: number): Milestone =>
  milestone(index, { kind: 'released', releaseTx: `0x${'9'.repeat(64)}` as TxHash, releasedAt: at('t-r') });

describe('releaseMilestone use-case', () => {
  it('pays out an approved milestone and marks it released', async () => {
    const { milestones, escrows, deps } = await setup([approved(0), milestone(1, { kind: 'funded' })]);

    const result = await releaseMilestone(ESCROW, 'm0' as MilestoneId, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.milestone.status.kind).toBe('released');

    const stored = await milestones.findById('m0' as MilestoneId);
    expect(stored?.status.kind).toBe('released');
    // Not the last milestone, so the escrow stays active.
    expect(result.value.escrow.state.status).toBe('active');
    expect((await escrows.findById(ESCROW))?.state.status).toBe('active');
  });

  it('completes the escrow when the final milestone releases', async () => {
    const { escrows, deps } = await setup([released(0), approved(1)]);

    const result = await releaseMilestone(ESCROW, 'm1' as MilestoneId, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.escrow.state.status).toBe('completed');
    expect((await escrows.findById(ESCROW))?.state.status).toBe('completed');
  });

  it('rejects releasing a milestone that is not approved', async () => {
    const { deps } = await setup([milestone(0, { kind: 'funded' })]);
    expect((await releaseMilestone(ESCROW, 'm0' as MilestoneId, deps)).ok).toBe(false);
  });

  it('rejects out-of-order release while an earlier milestone is unreleased', async () => {
    const { milestones, deps } = await setup([approved(0), approved(1)]);
    const result = await releaseMilestone(ESCROW, 'm1' as MilestoneId, deps);
    expect(result.ok).toBe(false);
    // The skipped milestone must not have been paid out.
    expect((await milestones.findById('m1' as MilestoneId))?.status.kind).toBe('approved');
  });

  it('rejects a milestone that belongs to a different escrow', async () => {
    const { deps } = await setup([approved(0)]);
    const foreign: Milestone = { ...approved(0), id: 'mX' as MilestoneId, escrowId: 'other' as EscrowId };
    await deps.milestones.save(foreign);
    expect((await releaseMilestone(ESCROW, 'mX' as MilestoneId, deps)).ok).toBe(false);
  });

  it('fails when the escrow is missing or not active', async () => {
    const { deps } = await setup([approved(0)]);
    expect((await releaseMilestone('missing' as EscrowId, 'm0' as MilestoneId, deps)).ok).toBe(false);
  });
});

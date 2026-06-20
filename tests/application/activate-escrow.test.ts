import { describe, it, expect } from 'vitest';
import { activateEscrow, type ActivateEscrowDeps } from '../../src/application/activate-escrow';
import { anchorReport, createEscrow, provideSignatures } from '../../src/domain/escrow-transitions';
import { StubEscrowDeployer } from '../../src/infrastructure/chain/stub-escrow-deployer';
import { InMemoryEscrowRepository } from '../../src/infrastructure/db/in-memory/in-memory-escrow-repository';
import { InMemoryMilestoneRepository } from '../../src/infrastructure/db/in-memory/in-memory-milestone-repository';
import { InMemoryPartyRepository } from '../../src/infrastructure/db/in-memory/in-memory-party-repository';
import type { Escrow, OnChainAnchor } from '../../src/domain/escrow';
import type { Milestone } from '../../src/domain/milestone';
import type { Party } from '../../src/domain/party';
import type { BothSignatures, PartySignature } from '../../src/domain/signature';
import type { ContractId, EscrowId, MilestoneId, PartyId, RiskReportId, UserId } from '../../src/domain/shared/ids';
import type { ChainId, EthereumAddress, Hash32, Timestamp, TxHash, Wei } from '../../src/domain/shared/primitives';

const ESCROW = 'e1' as EscrowId;
const CLIENT = 'client' as PartyId;
const FREELANCER = 'freelancer' as PartyId;
const HASH = `0x${'ab'.repeat(32)}` as Hash32;
const USDC = `0x${'a'.repeat(40)}` as EthereumAddress;
const at = (s: string): Timestamp => s as Timestamp;

const party = (id: PartyId, role: Party['role'], wallet: string): Party => ({
  id,
  userId: `u-${id}` as UserId,
  role,
  displayName: id,
  walletAddress: `0x${wallet.repeat(40)}` as EthereumAddress,
});

const sig = (party: PartyId): PartySignature => ({
  party,
  signer: `0x${'1'.repeat(40)}` as EthereumAddress,
  signature: `0x${'2'.repeat(130)}`,
  signedHash: HASH,
  signedAt: at('2026-06-18T02:00:00.000Z'),
});

const milestone = (index: number, amount: bigint): Milestone => ({
  id: `m${index}` as MilestoneId,
  escrowId: ESCROW,
  index,
  title: `Milestone ${index}`,
  description: '...',
  amount: { amount: amount as Wei, token: USDC },
  status: { kind: 'pending' },
});

// Drive a fresh escrow through the pure transitions to the awaiting_funding state.
const awaitingFunding = (): Escrow => {
  const anchor: OnChainAnchor = {
    chainId: 84532 as ChainId,
    reportHash: HASH,
    anchorTx: `0x${'cd'.repeat(32)}` as TxHash,
    anchoredAt: at('2026-06-18T01:00:00.000Z'),
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
  return signed.value;
};

interface Fixture {
  readonly escrows: InMemoryEscrowRepository;
  readonly milestones: InMemoryMilestoneRepository;
  readonly deps: ActivateEscrowDeps;
}

const setup = async (milestones: readonly Milestone[]): Promise<Fixture> => {
  const escrows = new InMemoryEscrowRepository();
  const parties = new InMemoryPartyRepository();
  const milestoneRepo = new InMemoryMilestoneRepository();

  await escrows.save(awaitingFunding());
  await parties.save(party(CLIENT, 'client', '1'));
  await parties.save(party(FREELANCER, 'freelancer', '2'));
  for (const m of milestones) await milestoneRepo.save(m);

  return {
    escrows,
    milestones: milestoneRepo,
    deps: {
      escrows,
      parties,
      milestones: milestoneRepo,
      deployer: new StubEscrowDeployer(() => at('2026-06-18T03:00:00.000Z')),
      now: () => at('2026-06-18T03:00:00.000Z'),
    },
  };
};

describe('activateEscrow use-case', () => {
  it('deploys + funds and advances awaiting_funding -> active', async () => {
    const { escrows, milestones, deps } = await setup([milestone(0, 300n), milestone(1, 200n)]);

    const result = await activateEscrow(ESCROW, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.status).toBe('active');
    if (result.value.state.status !== 'active') return;
    expect(result.value.state.contract.chainId).toBe(84532);

    // Every milestone is now marked funded (pending -> funded) from the funding plan.
    const stored = await escrows.findById(ESCROW);
    expect(stored?.state.status).toBe('active');
    const fundedStates = (await milestones.listByEscrow(ESCROW)).map((m) => m.status.kind);
    expect(fundedStates).toEqual(['funded', 'funded']);

    // Activating again is rejected — no longer awaiting funding.
    expect((await activateEscrow(ESCROW, deps)).ok).toBe(false);
  });

  it('fails without touching state when a milestone is not pending', async () => {
    const dirty: Milestone = { ...milestone(0, 100n), status: { kind: 'funded' } };
    const { escrows, deps } = await setup([dirty]);

    expect((await activateEscrow(ESCROW, deps)).ok).toBe(false);
    // Escrow stays awaiting_funding — the deploy never ran.
    expect((await escrows.findById(ESCROW))?.state.status).toBe('awaiting_funding');
  });

  it('fails when the escrow has no milestones to fund', async () => {
    const { deps } = await setup([]);
    expect((await activateEscrow(ESCROW, deps)).ok).toBe(false);
  });

  it('fails when the escrow is not awaiting funding', async () => {
    const { deps } = await setup([milestone(0, 100n)]);
    expect((await activateEscrow('missing' as EscrowId, deps)).ok).toBe(false);
  });
});

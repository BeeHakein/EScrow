import { describe, it, expect } from 'vitest';
import { signReport, type SignReportDeps } from '../../src/application/sign-report';
import { anchorReport, createEscrow } from '../../src/domain/escrow-transitions';
import { StubSignatureVerifier } from '../../src/infrastructure/chain/stub-signature-verifier';
import { InMemoryEscrowRepository } from '../../src/infrastructure/db/in-memory/in-memory-escrow-repository';
import { InMemoryPartyRepository } from '../../src/infrastructure/db/in-memory/in-memory-party-repository';
import { InMemorySignatureRepository } from '../../src/infrastructure/db/in-memory/in-memory-signature-repository';
import type { Party } from '../../src/domain/party';
import type { OnChainAnchor } from '../../src/domain/escrow';
import type { PartySignature } from '../../src/domain/signature';
import type { ContractId, EscrowId, PartyId, RiskReportId, UserId } from '../../src/domain/shared/ids';
import type { ChainId, EthereumAddress, Hash32, Timestamp, TxHash } from '../../src/domain/shared/primitives';

const at = (s: string): Timestamp => s as Timestamp;
const HASH = `0x${'ab'.repeat(32)}` as Hash32;
const CLIENT = 'client' as PartyId;
const FREELANCER = 'freelancer' as PartyId;
const CLIENT_WALLET = `0x${'c'.repeat(40)}` as EthereumAddress;
const FREELANCER_WALLET = `0x${'f'.repeat(40)}` as EthereumAddress;

const anchor: OnChainAnchor = {
  chainId: 84532 as ChainId,
  reportHash: HASH,
  anchorTx: `0x${'cd'.repeat(32)}` as TxHash,
  anchoredAt: at('2026-06-18T01:00:00.000Z'),
};

const party = (id: PartyId, wallet: EthereumAddress, role: Party['role']): Party => ({
  id,
  userId: `${id}-user` as UserId,
  role,
  displayName: id,
  walletAddress: wallet,
});

const sig = (p: PartyId, signer: EthereumAddress, signedHash: Hash32 = HASH): PartySignature => ({
  party: p,
  signer,
  signature: `0x${'2'.repeat(130)}`,
  signedHash,
  signedAt: at('2026-06-18T02:00:00.000Z'),
});

async function setup(verifierValid = true) {
  const escrows = new InMemoryEscrowRepository();
  const parties = new InMemoryPartyRepository();
  const signatures = new InMemorySignatureRepository();

  const created = createEscrow({
    id: 'e1' as EscrowId,
    contractId: 'c1' as ContractId,
    client: CLIENT,
    freelancer: FREELANCER,
    at: at('2026-06-18T00:00:00.000Z'),
  });
  const anchored = anchorReport(created, { riskReportId: 'r1' as RiskReportId, anchor }, at('2026-06-18T01:00:00.000Z'));
  if (!anchored.ok) throw new Error('setup failed');
  await escrows.save(anchored.value);
  await parties.save(party(CLIENT, CLIENT_WALLET, 'client'));
  await parties.save(party(FREELANCER, FREELANCER_WALLET, 'freelancer'));

  const deps: SignReportDeps = {
    escrows,
    parties,
    signatures,
    verifier: new StubSignatureVerifier(verifierValid),
    now: () => at('2026-06-18T05:00:00.000Z'),
  };
  return deps;
}

describe('signReport use-case', () => {
  it('waits for the second party, then advances to awaiting_funding', async () => {
    const deps = await setup();

    const first = await signReport('e1' as EscrowId, sig(CLIENT, CLIENT_WALLET), deps);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.state.status).toBe('awaiting_signatures'); // still waiting

    const second = await signReport('e1' as EscrowId, sig(FREELANCER, FREELANCER_WALLET), deps);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.state.status).toBe('awaiting_funding');
  });

  it('rejects a non-party signer', async () => {
    const deps = await setup();
    const r = await signReport('e1' as EscrowId, sig('stranger' as PartyId, CLIENT_WALLET), deps);
    expect(r.ok).toBe(false);
  });

  it('rejects a signature over the wrong hash', async () => {
    const deps = await setup();
    const r = await signReport('e1' as EscrowId, sig(CLIENT, CLIENT_WALLET, `0x${'00'.repeat(32)}` as Hash32), deps);
    expect(r.ok).toBe(false);
  });

  it('rejects when the signer does not match the registered wallet', async () => {
    const deps = await setup();
    const r = await signReport('e1' as EscrowId, sig(CLIENT, FREELANCER_WALLET), deps);
    expect(r.ok).toBe(false);
  });

  it('rejects a cryptographically invalid signature', async () => {
    const deps = await setup(false);
    const r = await signReport('e1' as EscrowId, sig(CLIENT, CLIENT_WALLET), deps);
    expect(r.ok).toBe(false);
  });
});

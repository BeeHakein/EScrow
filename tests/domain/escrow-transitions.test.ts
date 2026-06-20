import { describe, it, expect } from 'vitest';
import { activate, anchorReport, cancel, createEscrow, provideSignatures } from '../../src/domain/escrow-transitions';
import type { DeployedEscrow, Escrow, OnChainAnchor } from '../../src/domain/escrow';
import type { BothSignatures, PartySignature } from '../../src/domain/signature';
import type { ContractId, EscrowId, PartyId, RiskReportId } from '../../src/domain/shared/ids';
import type { ChainId, EthereumAddress, Hash32, Timestamp, TxHash } from '../../src/domain/shared/primitives';

const at = (s: string): Timestamp => s as Timestamp;
const HASH = `0x${'ab'.repeat(32)}` as Hash32;

const baseEscrow = (): Escrow =>
  createEscrow({
    id: 'e1' as EscrowId,
    contractId: 'c1' as ContractId,
    client: 'client' as PartyId,
    freelancer: 'freelancer' as PartyId,
    at: at('2026-06-18T00:00:00.000Z'),
  });

const anchor: OnChainAnchor = {
  chainId: 84532 as ChainId,
  reportHash: HASH,
  anchorTx: `0x${'cd'.repeat(32)}` as TxHash,
  anchoredAt: at('2026-06-18T01:00:00.000Z'),
};

const sig = (party: string, signedHash: Hash32 = HASH): PartySignature => ({
  party: party as PartyId,
  signer: `0x${'1'.repeat(40)}` as EthereumAddress,
  signature: `0x${'2'.repeat(130)}`,
  signedHash,
  signedAt: at('2026-06-18T02:00:00.000Z'),
});

const both: BothSignatures = { client: sig('client'), freelancer: sig('freelancer') };

const deployed: DeployedEscrow = {
  chainId: 84532 as ChainId,
  address: `0x${'3'.repeat(40)}` as EthereumAddress,
  deployTx: `0x${'4'.repeat(64)}` as TxHash,
  deployedAt: at('2026-06-18T03:00:00.000Z'),
};

describe('escrow state machine', () => {
  it('advances analysis -> signatures -> funding -> active', () => {
    const a = anchorReport(baseEscrow(), { riskReportId: 'r1' as RiskReportId, anchor }, at('t1'));
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.value.state.status).toBe('awaiting_signatures');

    const b = provideSignatures(a.value, both, at('t2'));
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.value.state.status).toBe('awaiting_funding');

    const c = activate(b.value, deployed, at('t3'));
    expect(c.ok && c.value.state.status === 'active').toBe(true);
  });

  it('rejects an illegal transition (activate before signing)', () => {
    expect(activate(baseEscrow(), deployed, at('t1')).ok).toBe(false);
  });

  it('rejects signatures over the wrong hash', () => {
    const a = anchorReport(baseEscrow(), { riskReportId: 'r1' as RiskReportId, anchor }, at('t1'));
    if (!a.ok) return;
    const wrong: BothSignatures = { client: sig('client', `0x${'ff'.repeat(32)}` as Hash32), freelancer: sig('freelancer') };
    expect(provideSignatures(a.value, wrong, at('t2')).ok).toBe(false);
  });

  it('cannot cancel an active escrow', () => {
    const a = anchorReport(baseEscrow(), { riskReportId: 'r1' as RiskReportId, anchor }, at('t1'));
    if (!a.ok) return;
    const b = provideSignatures(a.value, both, at('t2'));
    if (!b.ok) return;
    const c = activate(b.value, deployed, at('t3'));
    if (!c.ok) return;
    expect(cancel(c.value, 'changed my mind', at('t4')).ok).toBe(false);
  });
});

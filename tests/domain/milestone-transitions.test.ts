import { describe, it, expect } from 'vitest';
import { approve, fund, release, submit } from '../../src/domain/milestone-transitions';
import type { Milestone, MilestoneStatus } from '../../src/domain/milestone';
import type { EscrowId, MilestoneId } from '../../src/domain/shared/ids';
import type { EthereumAddress, Timestamp, TxHash, Wei } from '../../src/domain/shared/primitives';

const USDC = `0x${'a'.repeat(40)}` as EthereumAddress;
const at = (s: string): Timestamp => s as Timestamp;
const TX = `0x${'e'.repeat(64)}` as TxHash;

const milestone = (status: MilestoneStatus): Milestone => ({
  id: 'm0' as MilestoneId,
  escrowId: 'e1' as EscrowId,
  index: 0,
  title: 'Milestone 0',
  description: '...',
  amount: { amount: 100n as Wei, token: USDC },
  status,
});

describe('milestone transitions', () => {
  it('drives pending -> funded -> submitted -> approved -> released', () => {
    const funded = fund(milestone({ kind: 'pending' }));
    expect(funded.ok).toBe(true);
    if (!funded.ok) return;
    expect(funded.value.status).toEqual({ kind: 'funded' });

    const submitted = submit(funded.value, at('t1'));
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.value.status.kind).toBe('submitted');

    const approved = approve(submitted.value, at('t2'));
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.value.status.kind).toBe('approved');

    const released = release(approved.value, TX, at('t3'));
    expect(released.ok).toBe(true);
    if (!released.ok) return;
    expect(released.value.status).toEqual({ kind: 'released', releaseTx: TX, releasedAt: at('t3') });
  });

  it('rejects fund unless pending', () => {
    expect(fund(milestone({ kind: 'funded' })).ok).toBe(false);
    expect(fund(milestone({ kind: 'released', releaseTx: TX, releasedAt: at('t0') })).ok).toBe(false);
  });

  it('rejects submit unless funded', () => {
    expect(submit(milestone({ kind: 'pending' }), at('t1')).ok).toBe(false);
    expect(submit(milestone({ kind: 'approved', approvedAt: at('t0') }), at('t1')).ok).toBe(false);
  });

  it('rejects approve unless submitted', () => {
    expect(approve(milestone({ kind: 'funded' }), at('t1')).ok).toBe(false);
  });

  it('rejects release unless approved', () => {
    expect(release(milestone({ kind: 'submitted', submittedAt: at('t0') }), TX, at('t1')).ok).toBe(false);
    expect(release(milestone({ kind: 'released', releaseTx: TX, releasedAt: at('t0') }), TX, at('t1')).ok).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { planMilestoneFunding } from '../../src/domain/milestone-funding';
import type { Milestone } from '../../src/domain/milestone';
import type { EscrowId, MilestoneId } from '../../src/domain/shared/ids';
import type { EthereumAddress, Wei } from '../../src/domain/shared/primitives';

const ESCROW = 'e1' as EscrowId;
const USDC = `0x${'a'.repeat(40)}` as EthereumAddress;

const milestone = (index: number, amount: bigint, token: EthereumAddress | 'native' = USDC): Milestone => ({
  id: `m${index}` as MilestoneId,
  escrowId: ESCROW,
  index,
  title: `Milestone ${index}`,
  description: '...',
  amount: { amount: amount as Wei, token },
  status: { kind: 'pending' },
});

describe('planMilestoneFunding', () => {
  it('sums amounts in release order and reports the shared token', () => {
    const plan = planMilestoneFunding([milestone(1, 200n), milestone(0, 300n)]);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.value.token).toBe(USDC);
    expect(plan.value.amounts).toEqual([300n, 200n]); // sorted by index
    expect(plan.value.total).toBe(500n);
  });

  it('rejects an empty milestone set', () => {
    expect(planMilestoneFunding([]).ok).toBe(false);
  });

  it('rejects mixed tokens', () => {
    expect(planMilestoneFunding([milestone(0, 100n, USDC), milestone(1, 100n, 'native')]).ok).toBe(false);
  });

  it('rejects a non-positive amount', () => {
    expect(planMilestoneFunding([milestone(0, 0n)]).ok).toBe(false);
  });
});

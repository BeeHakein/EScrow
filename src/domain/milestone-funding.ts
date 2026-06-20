import type { Milestone } from './milestone';
import type { EthereumAddress, Wei } from './shared/primitives';
import { type Result, ok, err } from './shared/result';

// The exact funds an escrow contract must hold to go active: the per-milestone amounts in
// release order, their sum, and the single token they are all denominated in. Computed once
// from the milestone set so the deployer receives a validated plan, never raw milestones.
export interface FundingPlan {
  readonly token: EthereumAddress | 'native';
  readonly amounts: readonly Wei[]; // ordered by Milestone.index ascending
  readonly total: Wei;
}

const addWei = (a: Wei, b: Wei): Wei => (a + b) as Wei;

// Pure domain rule: a fundable escrow has ≥1 milestone, every milestone is denominated in the
// same token, and every amount is positive. Any violation is an error Result, not a thrown
// exception — illegal funding can't be expressed as a FundingPlan.
export function planMilestoneFunding(milestones: readonly Milestone[]): Result<FundingPlan> {
  if (milestones.length === 0) return err('cannot fund an escrow with no milestones');

  const ordered = [...milestones].sort((a, b) => a.index - b.index);
  let token: EthereumAddress | 'native' | undefined;
  const amounts: Wei[] = [];

  for (const m of ordered) {
    token ??= m.amount.token;
    if (m.amount.token !== token) return err('all milestones must be funded in the same token');
    if (m.amount.amount <= 0n) return err(`milestone ${m.index} has a non-positive amount`);
    amounts.push(m.amount.amount);
  }
  if (token === undefined) return err('cannot fund an escrow with no milestones');

  const total = amounts.reduce(addWei, 0n as Wei);
  return ok({ token, amounts, total });
}

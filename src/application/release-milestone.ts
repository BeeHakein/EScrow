import type { Escrow } from '../domain/escrow';
import type { Milestone } from '../domain/milestone';
import type { EscrowRepository } from '../domain/repositories/escrow-repository';
import type { MilestoneRepository } from '../domain/repositories/milestone-repository';
import type { EscrowId, MilestoneId } from '../domain/shared/ids';
import type { Timestamp } from '../domain/shared/primitives';
import { type Result, ok, err } from '../domain/shared/result';
import { complete } from '../domain/escrow-transitions';
import { release } from '../domain/milestone-transitions';
import type { MilestoneReleaseService } from './ports/milestone-release-service';

export interface ReleaseMilestoneDeps {
  readonly escrows: EscrowRepository;
  readonly milestones: MilestoneRepository;
  readonly payout: MilestoneReleaseService;
  readonly now: () => Timestamp;
}

// The outcome of a release: the now-released milestone, and the escrow — which is `completed`
// when this was the final milestone, otherwise still `active`.
export interface MilestoneReleased {
  readonly milestone: Milestone;
  readonly escrow: Escrow;
}

// Step 6 of the flow: pay out one approved milestone from the active escrow, then advance it
// `approved -> released`. Releases run strictly in index order; when the last milestone
// releases, the escrow itself completes (`active -> completed`).
export async function releaseMilestone(
  escrowId: EscrowId,
  milestoneId: MilestoneId,
  deps: ReleaseMilestoneDeps,
): Promise<Result<MilestoneReleased>> {
  const escrow = await deps.escrows.findById(escrowId);
  if (escrow === null) return err(`escrow not found: ${escrowId}`);
  if (escrow.state.status !== 'active')
    return err(`escrow ${escrowId} is not active (is '${escrow.state.status}')`);

  const milestone = await deps.milestones.findById(milestoneId);
  if (milestone === null) return err(`milestone not found: ${milestoneId}`);
  if (milestone.escrowId !== escrowId) return err('milestone does not belong to this escrow');

  // Precondition checks before the irreversible on-chain payout: the milestone must be
  // approved, and every earlier milestone must already be released (in-order release).
  if (milestone.status.kind !== 'approved')
    return err(`milestone ${milestone.index} is not approved (is '${milestone.status.kind}')`);

  const all = await deps.milestones.listByEscrow(escrowId);
  const earlierUnreleased = all.filter((m) => m.index < milestone.index && m.status.kind !== 'released');
  if (earlierUnreleased.length > 0)
    return err(`milestone ${milestone.index} cannot release before earlier milestones`);

  // Pay out on-chain first, then record the release — a failed transfer must never leave a
  // milestone marked released.
  const releaseTx = await deps.payout.release({
    escrow: escrow.state.contract,
    index: milestone.index,
    amount: milestone.amount,
  });

  const released = release(milestone, releaseTx, deps.now());
  if (!released.ok) return released;
  await deps.milestones.save(released.value);

  // When every milestone is released, the escrow has fully paid out — complete it.
  const after = all.map((m) => (m.id === released.value.id ? released.value : m));
  if (!after.every((m) => m.status.kind === 'released')) return ok({ milestone: released.value, escrow });

  const completed = complete(escrow, deps.now());
  if (!completed.ok) return completed;
  await deps.escrows.save(completed.value);
  return ok({ milestone: released.value, escrow: completed.value });
}

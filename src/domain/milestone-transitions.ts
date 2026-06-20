import type { Milestone, MilestoneStatus } from './milestone';
import type { Timestamp, TxHash } from './shared/primitives';
import { type Result, ok, err } from './shared/result';

// Pure, total transition functions over the milestone status machine, mirroring
// escrow-transitions.ts. Each guards its source status, so an illegal move (e.g. releasing
// before approval) returns an error Result instead of producing a malformed Milestone.
// All I/O — the on-chain payout that yields the release tx — lives in the use-case; these
// functions only fold a validated event into the next status.

const wrongStatus = (action: string, status: MilestoneStatus): Result<never> =>
  err(`cannot ${action} milestone in status '${status.kind}'`);

const withStatus = (m: Milestone, status: MilestoneStatus): Milestone => ({ ...m, status });

// pending -> funded: the deployed escrow now holds this milestone's amount. Driven at escrow
// activation from the FundingPlan; the `funded` status carries no data (the amount already
// lives on the Milestone), so no timestamp is recorded here.
export function fund(m: Milestone): Result<Milestone> {
  if (m.status.kind !== 'pending') return wrongStatus('fund', m.status);
  return ok(withStatus(m, { kind: 'funded' }));
}

// funded -> submitted: the freelancer delivers the work for this milestone.
export function submit(m: Milestone, at: Timestamp): Result<Milestone> {
  if (m.status.kind !== 'funded') return wrongStatus('submit', m.status);
  return ok(withStatus(m, { kind: 'submitted', submittedAt: at }));
}

// submitted -> approved: the client accepts the delivery.
export function approve(m: Milestone, at: Timestamp): Result<Milestone> {
  if (m.status.kind !== 'submitted') return wrongStatus('approve', m.status);
  return ok(withStatus(m, { kind: 'approved', approvedAt: at }));
}

// approved -> released: funds were paid out on-chain (releaseTx); record the release. The
// tx is produced by the MilestoneReleaseService before this is called, so a released
// milestone always carries proof of payment.
export function release(m: Milestone, releaseTx: TxHash, at: Timestamp): Result<Milestone> {
  if (m.status.kind !== 'approved') return wrongStatus('release', m.status);
  return ok(withStatus(m, { kind: 'released', releaseTx, releasedAt: at }));
}

import type { EscrowId, MilestoneId } from './shared/ids';
import type { Money, Timestamp, TxHash } from './shared/primitives';

// Each status variant carries only the data legal in that state — e.g. a release tx hash
// exists only once released. No nullable "releaseTx" floating across every milestone.
export type MilestoneStatus =
  | { readonly kind: 'pending' } // defined, escrow not yet funded for it
  | { readonly kind: 'funded' } // escrow holds the amount
  | { readonly kind: 'submitted'; readonly submittedAt: Timestamp } // freelancer delivered
  | { readonly kind: 'approved'; readonly approvedAt: Timestamp } // client approved
  | { readonly kind: 'released'; readonly releaseTx: TxHash; readonly releasedAt: Timestamp }
  | { readonly kind: 'disputed'; readonly reason: string; readonly raisedAt: Timestamp };

export interface Milestone {
  readonly id: MilestoneId;
  readonly escrowId: EscrowId;
  readonly index: number; // release order, 0-based
  readonly title: string;
  readonly description: string;
  readonly amount: Money;
  readonly status: MilestoneStatus;
}

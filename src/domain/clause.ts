import type { ClauseId, ContractId } from './shared/ids';

// A closed category set — adding a case is a deliberate type change, not a free-form string.
export type ClauseCategory =
  | 'payment'
  | 'intellectual_property'
  | 'termination'
  | 'liability'
  | 'confidentiality'
  | 'scope'
  | 'dispute_resolution'
  | 'other';

export interface Clause {
  readonly id: ClauseId;
  readonly contractId: ContractId;
  readonly index: number; // 0-based order within the document
  readonly heading: string | null;
  readonly text: string;
  readonly category: ClauseCategory;
}

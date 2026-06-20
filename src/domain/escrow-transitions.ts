import type { DeployedEscrow, Escrow, EscrowState, OnChainAnchor } from './escrow';
import type { BothSignatures } from './signature';
import type { ContractId, EscrowId, PartyId, RiskReportId } from './shared/ids';
import type { Timestamp } from './shared/primitives';
import { type Result, ok, err } from './shared/result';

// Pure, total transition functions over the escrow state machine. Each guards its source
// state, so an illegal transition (e.g. activate before signing) cannot be expressed —
// it returns an error Result instead of producing a malformed Escrow.

export interface CreateEscrowParams {
  readonly id: EscrowId;
  readonly contractId: ContractId;
  readonly client: PartyId;
  readonly freelancer: PartyId;
  readonly at: Timestamp;
}

export function createEscrow(p: CreateEscrowParams): Escrow {
  return {
    id: p.id,
    contractId: p.contractId,
    client: p.client,
    freelancer: p.freelancer,
    state: { status: 'awaiting_analysis' },
    createdAt: p.at,
    updatedAt: p.at,
  };
}

const wrongState = (action: string, state: EscrowState): Result<never> =>
  err(`cannot ${action} from state '${state.status}'`);

const withState = (escrow: Escrow, state: EscrowState, at: Timestamp): Escrow => ({
  ...escrow,
  state,
  updatedAt: at,
});

// Step 3: report hash anchored on Base. awaiting_analysis -> awaiting_signatures.
export function anchorReport(
  escrow: Escrow,
  input: { readonly riskReportId: RiskReportId; readonly anchor: OnChainAnchor },
  at: Timestamp,
): Result<Escrow> {
  if (escrow.state.status !== 'awaiting_analysis') return wrongState('anchor report', escrow.state);
  return ok(
    withState(escrow, { status: 'awaiting_signatures', riskReportId: input.riskReportId, anchor: input.anchor }, at),
  );
}

// Step 4: both parties have signed the anchored hash. awaiting_signatures -> awaiting_funding.
export function provideSignatures(escrow: Escrow, signatures: BothSignatures, at: Timestamp): Result<Escrow> {
  const s = escrow.state;
  if (s.status !== 'awaiting_signatures') return wrongState('add signatures', s);
  if (signatures.client.signedHash !== s.anchor.reportHash || signatures.freelancer.signedHash !== s.anchor.reportHash)
    return err('signatures do not match the anchored report hash');
  return ok(
    withState(escrow, { status: 'awaiting_funding', riskReportId: s.riskReportId, anchor: s.anchor, signatures }, at),
  );
}

// Step 5: escrow contract deployed and funded. awaiting_funding -> active.
export function activate(escrow: Escrow, contract: DeployedEscrow, at: Timestamp): Result<Escrow> {
  const s = escrow.state;
  if (s.status !== 'awaiting_funding') return wrongState('activate', s);
  return ok(
    withState(
      escrow,
      { status: 'active', riskReportId: s.riskReportId, anchor: s.anchor, signatures: s.signatures, contract },
      at,
    ),
  );
}

// Step 6 terminal: all milestones released. active -> completed.
export function complete(escrow: Escrow, at: Timestamp): Result<Escrow> {
  const s = escrow.state;
  if (s.status !== 'active') return wrongState('complete', s);
  return ok(
    withState(
      escrow,
      {
        status: 'completed',
        riskReportId: s.riskReportId,
        anchor: s.anchor,
        signatures: s.signatures,
        contract: s.contract,
        completedAt: at,
      },
      at,
    ),
  );
}

export function dispute(
  escrow: Escrow,
  input: { readonly raisedBy: PartyId; readonly reason: string },
  at: Timestamp,
): Result<Escrow> {
  const s = escrow.state;
  if (s.status !== 'active') return wrongState('dispute', s);
  if (input.raisedBy !== escrow.client && input.raisedBy !== escrow.freelancer)
    return err('only a party to the escrow may raise a dispute');
  return ok(
    withState(
      escrow,
      {
        status: 'disputed',
        riskReportId: s.riskReportId,
        anchor: s.anchor,
        signatures: s.signatures,
        contract: s.contract,
        reason: input.reason,
        raisedBy: input.raisedBy,
        raisedAt: at,
      },
      at,
    ),
  );
}

// Cancellable only before funds are committed.
const CANCELLABLE: ReadonlySet<EscrowState['status']> = new Set([
  'awaiting_analysis',
  'awaiting_signatures',
  'awaiting_funding',
]);

export function cancel(escrow: Escrow, reason: string, at: Timestamp): Result<Escrow> {
  if (!CANCELLABLE.has(escrow.state.status)) return wrongState('cancel', escrow.state);
  return ok(withState(escrow, { status: 'cancelled', reason, cancelledAt: at }, at));
}

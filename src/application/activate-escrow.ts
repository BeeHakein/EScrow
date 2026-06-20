import type { Escrow } from '../domain/escrow';
import type { Milestone } from '../domain/milestone';
import type { EscrowRepository } from '../domain/repositories/escrow-repository';
import type { MilestoneRepository } from '../domain/repositories/milestone-repository';
import type { PartyRepository } from '../domain/repositories/party-repository';
import type { EscrowId } from '../domain/shared/ids';
import type { Timestamp } from '../domain/shared/primitives';
import { type Result, err } from '../domain/shared/result';
import { activate } from '../domain/escrow-transitions';
import { fund } from '../domain/milestone-transitions';
import { planMilestoneFunding } from '../domain/milestone-funding';
import type { EscrowDeployer } from './ports/escrow-deployer';

export interface ActivateEscrowDeps {
  readonly escrows: EscrowRepository;
  readonly parties: PartyRepository;
  readonly milestones: MilestoneRepository;
  readonly deployer: EscrowDeployer;
  readonly now: () => Timestamp;
}

// Step 5 of the flow: with both signatures in place, deploy and fund the escrow contract on
// Base, then advance awaiting_funding -> active. Funds are committed here, so this is the
// first irreversible step — everything before it is cancellable.
export async function activateEscrow(escrowId: EscrowId, deps: ActivateEscrowDeps): Promise<Result<Escrow>> {
  const escrow = await deps.escrows.findById(escrowId);
  if (escrow === null) return err(`escrow not found: ${escrowId}`);
  if (escrow.state.status !== 'awaiting_funding')
    return err(`escrow ${escrowId} is not awaiting funding (is '${escrow.state.status}')`);

  const [client, freelancer] = await Promise.all([
    deps.parties.findById(escrow.client),
    deps.parties.findById(escrow.freelancer),
  ]);
  if (client === null) return err(`party not found: ${escrow.client}`);
  if (freelancer === null) return err(`party not found: ${escrow.freelancer}`);

  const milestones = await deps.milestones.listByEscrow(escrowId);
  const funding = planMilestoneFunding(milestones);
  if (!funding.ok) return funding;

  // Mark every milestone funded purely BEFORE the irreversible on-chain deploy — if any is not
  // pending, fail without touching the chain. The deploy funds the contract; these record that
  // each milestone's amount is now held.
  const funded: Milestone[] = [];
  for (const m of milestones) {
    const r = fund(m);
    if (!r.ok) return r;
    funded.push(r.value);
  }

  const contract = await deps.deployer.deployAndFund({
    escrowId,
    client: client.walletAddress,
    freelancer: freelancer.walletAddress,
    token: funding.value.token,
    amounts: funding.value.amounts,
    total: funding.value.total,
  });

  const transitioned = activate(escrow, contract, deps.now());
  if (!transitioned.ok) return transitioned;

  await deps.escrows.save(transitioned.value);
  for (const m of funded) await deps.milestones.save(m);
  return transitioned;
}

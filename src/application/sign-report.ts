import type { Escrow } from '../domain/escrow';
import type { BothSignatures, PartySignature } from '../domain/signature';
import type { EscrowRepository } from '../domain/repositories/escrow-repository';
import type { PartyRepository } from '../domain/repositories/party-repository';
import type { SignatureRepository } from '../domain/repositories/signature-repository';
import type { EscrowId } from '../domain/shared/ids';
import type { Timestamp } from '../domain/shared/primitives';
import { type Result, ok, err } from '../domain/shared/result';
import { provideSignatures } from '../domain/escrow-transitions';
import type { SignatureVerifier } from './ports/signature-verifier';

export interface SignReportDeps {
  readonly escrows: EscrowRepository;
  readonly parties: PartyRepository;
  readonly signatures: SignatureRepository;
  readonly verifier: SignatureVerifier;
  readonly now: () => Timestamp;
}

// Step 4: a party submits its signature over the anchored report hash. Once BOTH parties
// have signed, the escrow advances to awaiting_funding; otherwise it waits for the other.
export async function signReport(
  escrowId: EscrowId,
  signature: PartySignature,
  deps: SignReportDeps,
): Promise<Result<Escrow>> {
  const escrow = await deps.escrows.findById(escrowId);
  if (escrow === null) return err(`escrow not found: ${escrowId}`);

  const s = escrow.state;
  if (s.status !== 'awaiting_signatures') return err(`escrow ${escrowId} is not awaiting signatures (is '${s.status}')`);

  if (signature.party !== escrow.client && signature.party !== escrow.freelancer)
    return err('signer is not a party to this escrow');
  if (signature.signedHash !== s.anchor.reportHash) return err('signature is not over the anchored report hash');

  const party = await deps.parties.findById(signature.party);
  if (party === null) return err(`party not found: ${signature.party}`);
  if (party.walletAddress !== signature.signer) return err('signer does not match the registered party wallet');

  const valid = await deps.verifier.verify({
    hash: signature.signedHash,
    signature: signature.signature,
    signer: signature.signer,
  });
  if (!valid) return err('invalid signature');

  await deps.signatures.save(escrowId, signature);

  // Advance only once both parties have a stored signature.
  const collected = await deps.signatures.findByEscrow(escrowId);
  const client = collected.find((x) => x.party === escrow.client);
  const freelancer = collected.find((x) => x.party === escrow.freelancer);
  if (client === undefined || freelancer === undefined) return ok(escrow);

  const both: BothSignatures = { client, freelancer };
  const transitioned = provideSignatures(escrow, both, deps.now());
  if (!transitioned.ok) return transitioned;

  await deps.escrows.save(transitioned.value);
  return transitioned;
}

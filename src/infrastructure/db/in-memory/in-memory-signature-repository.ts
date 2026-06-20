import type { SignatureRepository } from '../../../domain/repositories/signature-repository';
import type { PartySignature } from '../../../domain/signature';
import type { EscrowId } from '../../../domain/shared/ids';

// Keyed by escrow + party, so a party re-signing replaces its earlier signature.
export class InMemorySignatureRepository implements SignatureRepository {
  private readonly byKey = new Map<string, PartySignature>();

  async save(escrowId: EscrowId, signature: PartySignature): Promise<void> {
    this.byKey.set(`${escrowId}:${signature.party}`, signature);
  }

  async findByEscrow(escrowId: EscrowId): Promise<readonly PartySignature[]> {
    const prefix = `${escrowId}:`;
    const out: PartySignature[] = [];
    for (const [key, sig] of this.byKey.entries()) if (key.startsWith(prefix)) out.push(sig);
    return out;
  }
}

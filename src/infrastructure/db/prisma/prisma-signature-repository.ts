import type { PrismaClient } from '@prisma/client';
import type { SignatureRepository } from '../../../domain/repositories/signature-repository';
import type { PartySignature } from '../../../domain/signature';
import type { EscrowId } from '../../../domain/shared/ids';
import { parseSignatureRow } from '../../../boundary/db-row';
import { orThrow } from './parse-or-throw';

// Prisma adapter for SignatureRepository. One row per (escrowId, party) — the composite primary
// key makes "a party re-signing replaces its earlier signature" an upsert, not a manual check.
export class PrismaSignatureRepository implements SignatureRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(escrowId: EscrowId, signature: PartySignature): Promise<void> {
    const scalar = {
      signer: signature.signer,
      signature: signature.signature,
      signedHash: signature.signedHash,
      signedAt: signature.signedAt,
    };
    await this.prisma.partySignature.upsert({
      where: { escrowId_party: { escrowId, party: signature.party } },
      create: { escrowId, party: signature.party, ...scalar },
      update: scalar,
    });
  }

  async findByEscrow(escrowId: EscrowId): Promise<readonly PartySignature[]> {
    const rows = await this.prisma.partySignature.findMany({ where: { escrowId } });
    return rows.map((r) => orThrow(parseSignatureRow(r)));
  }
}

import type { ContractId, PartyId } from './shared/ids';
import type { Hash32, Timestamp } from './shared/primitives';
import type { Clause } from './clause';

export type DocumentFormat = 'pdf' | 'docx';

// The uploaded legal document. Clauses are parsed once at ingestion and owned by the
// contract (one file, one truth) — they are never edited independently afterwards.
export interface Contract {
  readonly id: ContractId;
  readonly title: string;
  readonly format: DocumentFormat;
  readonly contentHash: Hash32; // sha256 of the original upload bytes (tamper evidence)
  readonly storageKey: string; // pointer into blob storage
  readonly uploadedBy: PartyId;
  readonly uploadedAt: Timestamp;
  readonly clauses: readonly Clause[];
}

import type { Clause } from '../domain/clause';
import type { Contract } from '../domain/contract';
import type { ContractRepository } from '../domain/repositories/contract-repository';
import type { ClauseId, ContractId } from '../domain/shared/ids';
import type { Timestamp } from '../domain/shared/primitives';
import { type Result, ok, err } from '../domain/shared/result';
import { parseClause, type UploadContractCommand } from '../boundary/contract';
import type { DocumentHasher } from './ports/document-hasher';
import type { DocumentParser } from './ports/document-parser';
import type { DocumentStore } from './ports/document-store';

// Dependencies injected, not imported — id generators and clock are explicit, so the use-case
// is pure and testable without a real DB, parser, or wall clock.
export interface UploadContractDeps {
  readonly parser: DocumentParser;
  readonly hasher: DocumentHasher;
  readonly store: DocumentStore;
  readonly contracts: ContractRepository;
  readonly newContractId: () => ContractId;
  readonly newClauseId: () => ClauseId;
  readonly now: () => Timestamp;
}

// Step 1 of the platform flow: ingest an uploaded document. Hash the bytes (tamper evidence),
// store them, extract and parse clauses at the boundary, then persist the Contract. Clauses are
// parsed ONCE here and owned by the contract thereafter (one file, one truth).
export async function uploadContract(
  command: UploadContractCommand,
  deps: UploadContractDeps,
): Promise<Result<Contract>> {
  const contentHash = await deps.hasher.hash(command.bytes);
  const storageKey = await deps.store.store({ bytes: command.bytes, format: command.format, contentHash });

  const raw = await deps.parser.parse({ bytes: command.bytes, format: command.format });
  if (raw.clauses.length === 0) return err('document contains no clauses');

  const id = deps.newContractId();
  const clauses: Clause[] = [];
  for (const [index, rawClause] of raw.clauses.entries()) {
    const parsed = parseClause(rawClause, { id: deps.newClauseId(), contractId: id, index });
    if (!parsed.ok) return parsed;
    clauses.push(parsed.value);
  }

  const contract: Contract = {
    id,
    title: command.title,
    format: command.format,
    contentHash,
    storageKey,
    uploadedBy: command.uploadedBy,
    uploadedAt: deps.now(),
    clauses,
  };
  await deps.contracts.save(contract);
  return ok(contract);
}

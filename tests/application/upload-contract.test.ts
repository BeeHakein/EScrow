import { describe, it, expect } from 'vitest';
import { uploadContract, type UploadContractDeps } from '../../src/application/upload-contract';
import type { UploadContractCommand } from '../../src/boundary/contract';
import type { DocumentParser } from '../../src/application/ports/document-parser';
import { StubDocumentParser } from '../../src/infrastructure/document/stub-document-parser';
import { InsecureStubDocumentHasher } from '../../src/infrastructure/document/insecure-stub-document-hasher';
import { InMemoryDocumentStore } from '../../src/infrastructure/storage/in-memory-document-store';
import { InMemoryContractRepository } from '../../src/infrastructure/db/in-memory/in-memory-contract-repository';
import type { ClauseId, ContractId, PartyId } from '../../src/domain/shared/ids';
import type { Timestamp } from '../../src/domain/shared/primitives';

const UPLOADER = 'p1' as PartyId;
const at = (s: string): Timestamp => s as Timestamp;
const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

const DOC = ['Payment\nThe client shall pay the fee.', 'Liability\nThe contractor is liable for damages.'].join('\n\n');

const command = (over: Partial<UploadContractCommand> = {}): UploadContractCommand => ({
  title: 'Design Agreement',
  format: 'pdf',
  uploadedBy: UPLOADER,
  bytes: bytes(DOC),
  ...over,
});

interface Fixture {
  readonly contracts: InMemoryContractRepository;
  readonly deps: UploadContractDeps;
}

const setup = (parser: DocumentParser = new StubDocumentParser()): Fixture => {
  const contracts = new InMemoryContractRepository();
  let clauseSeq = 0;
  return {
    contracts,
    deps: {
      parser,
      hasher: new InsecureStubDocumentHasher(),
      store: new InMemoryDocumentStore(),
      contracts,
      newContractId: () => 'c1' as ContractId,
      newClauseId: () => `cl${clauseSeq++}` as ClauseId,
      now: () => at('2026-06-20T00:00:00.000Z'),
    },
  };
};

describe('uploadContract use-case', () => {
  it('hashes, stores, extracts clauses, and persists the contract', async () => {
    const { contracts, deps } = setup();
    const result = await uploadContract(command(), deps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const c = result.value;
    expect(c.id).toBe('c1');
    expect(c.contentHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(c.storageKey).toBe(`blob/${c.contentHash}.pdf`);
    expect(c.clauses.map((cl) => cl.category)).toEqual(['payment', 'liability']);
    expect(c.clauses.map((cl) => cl.index)).toEqual([0, 1]);
    expect(c.clauses.map((cl) => cl.heading)).toEqual(['Payment', 'Liability']);
    // Clause ids are minted, unique, and within this contract.
    expect(new Set(c.clauses.map((cl) => cl.id)).size).toBe(2);
    expect(c.clauses.every((cl) => cl.contractId === 'c1')).toBe(true);

    expect(await contracts.findById('c1' as ContractId)).not.toBeNull();
  });

  it('rejects a document that yields no clauses', async () => {
    const { contracts, deps } = setup();
    const result = await uploadContract(command({ bytes: bytes('   \n\n   ') }), deps);
    expect(result.ok).toBe(false);
    // Nothing persisted on the failure path.
    expect(await contracts.findById('c1' as ContractId)).toBeNull();
  });

  it('fails when the parser emits an out-of-set category', async () => {
    const badParser: DocumentParser = {
      async parse() {
        return { clauses: [{ heading: null, text: 'body', category: 'pricing' }] };
      },
    };
    const { contracts, deps } = setup(badParser);
    expect((await uploadContract(command(), deps)).ok).toBe(false);
    expect(await contracts.findById('c1' as ContractId)).toBeNull();
  });
});

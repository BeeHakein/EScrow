import { describe, it, expect } from 'vitest';
import { uploadContract, type UploadContractDeps } from '../../src/application/upload-contract';
import { analyzeContract, type AnalyzeContractDeps } from '../../src/application/analyze-contract';
import { anchorReport, type AnchorReportDeps } from '../../src/application/anchor-report';
import { signReport, type SignReportDeps } from '../../src/application/sign-report';
import { activateEscrow, type ActivateEscrowDeps } from '../../src/application/activate-escrow';
import { releaseMilestone, type ReleaseMilestoneDeps } from '../../src/application/release-milestone';
import { createEscrow } from '../../src/domain/escrow-transitions';
import { submit, approve } from '../../src/domain/milestone-transitions';

import { Sha256DocumentHasher } from '../../src/infrastructure/document/sha256-document-hasher';
import { StubDocumentParser } from '../../src/infrastructure/document/stub-document-parser';
import { InMemoryDocumentStore } from '../../src/infrastructure/storage/in-memory-document-store';
import { StubContractAnalyzer } from '../../src/infrastructure/ai/stub-analyzer';
import { Keccak256ReportHasher } from '../../src/infrastructure/chain/keccak256-report-hasher';
import { StubReportAnchorService } from '../../src/infrastructure/chain/stub-anchor-service';
import { StubSignatureVerifier } from '../../src/infrastructure/chain/stub-signature-verifier';
import { StubEscrowDeployer } from '../../src/infrastructure/chain/stub-escrow-deployer';
import { StubMilestoneReleaseService } from '../../src/infrastructure/chain/stub-milestone-release-service';

import { InMemoryContractRepository } from '../../src/infrastructure/db/in-memory/in-memory-contract-repository';
import { InMemoryRiskReportRepository } from '../../src/infrastructure/db/in-memory/in-memory-risk-report-repository';
import { InMemoryEscrowRepository } from '../../src/infrastructure/db/in-memory/in-memory-escrow-repository';
import { InMemoryPartyRepository } from '../../src/infrastructure/db/in-memory/in-memory-party-repository';
import { InMemorySignatureRepository } from '../../src/infrastructure/db/in-memory/in-memory-signature-repository';
import { InMemoryMilestoneRepository } from '../../src/infrastructure/db/in-memory/in-memory-milestone-repository';

import type { Party } from '../../src/domain/party';
import type { Milestone } from '../../src/domain/milestone';
import type { PartySignature } from '../../src/domain/signature';
import type { UploadContractCommand } from '../../src/boundary/contract';
import type { ClauseId, ContractId, EscrowId, MilestoneId, PartyId, RiskReportId, UserId } from '../../src/domain/shared/ids';
import type { AiModelId, EthereumAddress, Hash32, Timestamp, Wei } from '../../src/domain/shared/primitives';

const at = (s: string): Timestamp => s as Timestamp;
const ESCROW = 'e1' as EscrowId;
const CLIENT = 'client' as PartyId;
const FREELANCER = 'freelancer' as PartyId;
const CLIENT_WALLET = `0x${'c'.repeat(40)}` as EthereumAddress;
const FREELANCER_WALLET = `0x${'f'.repeat(40)}` as EthereumAddress;
const USDC = `0x${'a'.repeat(40)}` as EthereumAddress;
const MODEL = 'claude-sonnet-4-6' as AiModelId;

// A two-clause document the StubDocumentParser splits on the blank line (payment + scope).
const DOCUMENT = new TextEncoder().encode(
  ['Payment Terms', 'Client shall pay the fee upon invoice.', '', 'Scope of Work', 'Freelancer shall deliver the services.'].join('\n'),
);

const party = (id: PartyId, role: Party['role'], wallet: EthereumAddress): Party => ({
  id,
  userId: `${id}-user` as UserId,
  role,
  displayName: id,
  walletAddress: wallet,
});

const sig = (p: PartyId, signer: EthereumAddress, signedHash: Hash32): PartySignature => ({
  party: p,
  signer,
  signature: `0x${'2'.repeat(130)}`,
  signedHash,
  signedAt: at('2026-06-18T02:00:00.000Z'),
});

const milestone = (index: number, amount: bigint): Milestone => ({
  id: `m${index}` as MilestoneId,
  escrowId: ESCROW,
  index,
  title: `Milestone ${index}`,
  description: '...',
  amount: { amount: amount as Wei, token: USDC },
  status: { kind: 'pending' },
});

// A monotonic id generator so each call mints a distinct, deterministic id.
const ids = (prefix: string) => {
  let n = 0;
  return () => `${prefix}${n++}`;
};

// End-to-end ACCEPTANCE test: drives ONE escrow through all six flow steps using the real
// use-cases over a single shared set of in-memory repositories. The per-slice unit tests cover
// each use-case in isolation; this pins that they COMPOSE — and that the real Keccak256ReportHasher
// hash threads unbroken from analysis (step 2) through anchoring (step 3) into the signatures
// (step 4). Every future real-adapter swap must keep this green.
describe('full platform flow (upload → analyze → anchor → sign → activate → release)', () => {
  it('takes an escrow from upload to completed via the composed use-cases', async () => {
    const contracts = new InMemoryContractRepository();
    const reports = new InMemoryRiskReportRepository();
    const escrows = new InMemoryEscrowRepository();
    const parties = new InMemoryPartyRepository();
    const signatures = new InMemorySignatureRepository();
    const milestones = new InMemoryMilestoneRepository();

    await parties.save(party(CLIENT, 'client', CLIENT_WALLET));
    await parties.save(party(FREELANCER, 'freelancer', FREELANCER_WALLET));

    // Step 1 — upload (real sha256 content hash).
    const command: UploadContractCommand = { title: 'Services Agreement', format: 'pdf', uploadedBy: CLIENT, bytes: DOCUMENT };
    const uploadDeps: UploadContractDeps = {
      parser: new StubDocumentParser(),
      hasher: new Sha256DocumentHasher(),
      store: new InMemoryDocumentStore(),
      contracts,
      newContractId: ids('c') as () => ContractId,
      newClauseId: ids('cl') as () => ClauseId,
      now: () => at('2026-06-18T00:00:00.000Z'),
    };
    const uploaded = await uploadContract(command, uploadDeps);
    expect(uploaded.ok).toBe(true);
    if (!uploaded.ok) return;
    expect(uploaded.value.clauses.length).toBe(2);

    // Step 2 — analyze (real keccak256 report hash).
    const analyzeDeps: AnalyzeContractDeps = {
      analyzer: new StubContractAnalyzer(),
      hasher: new Keccak256ReportHasher(),
      reports,
      newReportId: ids('r') as () => RiskReportId,
      now: () => at('2026-06-18T00:30:00.000Z'),
      model: MODEL,
    };
    const analyzed = await analyzeContract(uploaded.value, analyzeDeps);
    expect(analyzed.ok).toBe(true);
    if (!analyzed.ok) return;
    const reportHash = analyzed.value.reportHash;
    expect(reportHash).toMatch(/^0x[0-9a-f]{64}$/); // real keccak digest, not a stub

    // Bootstrap the escrow in awaiting_analysis (no dedicated use-case for creation).
    await escrows.save(
      createEscrow({ id: ESCROW, contractId: uploaded.value.id, client: CLIENT, freelancer: FREELANCER, at: at('2026-06-18T00:31:00.000Z') }),
    );

    // Step 3 — anchor the report hash on Base.
    const anchorDeps: AnchorReportDeps = {
      escrows,
      reports,
      anchorService: new StubReportAnchorService(() => at('2026-06-18T01:00:00.000Z')),
      now: () => at('2026-06-18T01:00:00.000Z'),
    };
    const anchored = await anchorReport(ESCROW, anchorDeps);
    expect(anchored.ok).toBe(true);
    if (!anchored.ok) return;
    expect(anchored.value.state.status).toBe('awaiting_signatures');
    // The anchored hash is exactly the real keccak report hash from step 2 — unbroken provenance.
    if (anchored.value.state.status === 'awaiting_signatures')
      expect(anchored.value.state.anchor.reportHash).toBe(reportHash);

    // Step 4 — both parties sign the anchored hash.
    const signDeps: SignReportDeps = {
      escrows,
      parties,
      signatures,
      verifier: new StubSignatureVerifier(true),
      now: () => at('2026-06-18T02:00:00.000Z'),
    };
    const firstSig = await signReport(ESCROW, sig(CLIENT, CLIENT_WALLET, reportHash), signDeps);
    expect(firstSig.ok).toBe(true);
    if (!firstSig.ok) return;
    expect(firstSig.value.state.status).toBe('awaiting_signatures'); // still waiting on freelancer
    const secondSig = await signReport(ESCROW, sig(FREELANCER, FREELANCER_WALLET, reportHash), signDeps);
    expect(secondSig.ok).toBe(true);
    if (!secondSig.ok) return;
    expect(secondSig.value.state.status).toBe('awaiting_funding');

    // Two milestones, both pending, ready to be funded at activation.
    await milestones.save(milestone(0, 300n));
    await milestones.save(milestone(1, 200n));

    // Step 5 — deploy + fund the escrow (first irreversible step).
    const activateDeps: ActivateEscrowDeps = {
      escrows,
      parties,
      milestones,
      deployer: new StubEscrowDeployer(() => at('2026-06-18T03:00:00.000Z')),
      now: () => at('2026-06-18T03:00:00.000Z'),
    };
    const activated = await activateEscrow(ESCROW, activateDeps);
    expect(activated.ok).toBe(true);
    if (!activated.ok) return;
    expect(activated.value.state.status).toBe('active');
    expect((await milestones.listByEscrow(ESCROW)).map((m) => m.status.kind)).toEqual(['funded', 'funded']);

    // Off-flow domain transitions: freelancer delivers, client approves each milestone.
    for (const id of ['m0', 'm1'] as MilestoneId[]) {
      const m = await milestones.findById(id);
      if (m === null) throw new Error(`missing milestone ${id}`);
      const submitted = submit(m, at('2026-06-18T04:00:00.000Z'));
      if (!submitted.ok) throw new Error(submitted.error);
      const approved = approve(submitted.value, at('2026-06-18T05:00:00.000Z'));
      if (!approved.ok) throw new Error(approved.error);
      await milestones.save(approved.value);
    }

    // Step 6 — release each milestone in order; the final release completes the escrow.
    const releaseDeps: ReleaseMilestoneDeps = {
      escrows,
      milestones,
      payout: new StubMilestoneReleaseService(),
      now: () => at('2026-06-18T06:00:00.000Z'),
    };
    const r0 = await releaseMilestone(ESCROW, 'm0' as MilestoneId, releaseDeps);
    expect(r0.ok).toBe(true);
    if (!r0.ok) return;
    expect(r0.value.escrow.state.status).toBe('active'); // one milestone left

    const r1 = await releaseMilestone(ESCROW, 'm1' as MilestoneId, releaseDeps);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.value.escrow.state.status).toBe('completed'); // all milestones released

    // Final assertions on persisted state.
    const finalEscrow = await escrows.findById(ESCROW);
    expect(finalEscrow?.state.status).toBe('completed');
    expect((await milestones.listByEscrow(ESCROW)).map((m) => m.status.kind)).toEqual(['released', 'released']);
  });
});

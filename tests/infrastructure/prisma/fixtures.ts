import type { Clause } from '../../../src/domain/clause';
import type { Contract } from '../../../src/domain/contract';
import type { DeployedEscrow, Escrow, EscrowState, OnChainAnchor } from '../../../src/domain/escrow';
import type { Milestone, MilestoneStatus } from '../../../src/domain/milestone';
import type { Party } from '../../../src/domain/party';
import type { RiskReport } from '../../../src/domain/risk-report';
import type { BothSignatures, PartySignature } from '../../../src/domain/signature';
import type {
  ClauseId,
  ContractId,
  EscrowId,
  MilestoneId,
  PartyId,
  RiskReportId,
  UserId,
} from '../../../src/domain/shared/ids';
import type {
  AiModelId,
  ChainId,
  EthereumAddress,
  Hash32,
  Timestamp,
  TxHash,
  Wei,
} from '../../../src/domain/shared/primitives';

// Canonical value-object literals — already in the exact shape the boundary parsers normalize to,
// so save → read round-trips to a deeply-equal object.
export const HASH = `0x${'ab'.repeat(32)}` as Hash32;
export const TX = `0x${'cd'.repeat(32)}` as TxHash;
export const ADDR = `0x${'a'.repeat(40)}` as EthereumAddress;
export const ADDR2 = `0x${'f'.repeat(40)}` as EthereumAddress;
export const SIG = `0x${'2'.repeat(130)}` as const;
export const CHAIN = 84532 as ChainId;
export const at = (iso: string): Timestamp => iso as Timestamp;

export const CLIENT = 'party-client' as PartyId;
export const FREELANCER = 'party-freelancer' as PartyId;
export const CONTRACT = 'contract-1' as ContractId;
export const ESCROW = 'escrow-1' as EscrowId;

export const party = (over: Partial<Party> = {}): Party => ({
  id: CLIENT,
  userId: 'user-1' as UserId,
  role: 'client',
  displayName: 'Alice',
  walletAddress: ADDR,
  ...over,
});

export const clause = (index: number, over: Partial<Clause> = {}): Clause => ({
  id: `clause-${index}` as ClauseId,
  contractId: CONTRACT,
  index,
  heading: `Heading ${index}`,
  text: `Clause ${index} body`,
  category: 'payment',
  ...over,
});

export const contract = (over: Partial<Contract> = {}): Contract => ({
  id: CONTRACT,
  title: 'NDA',
  format: 'pdf',
  contentHash: HASH,
  storageKey: 'blob/contract-1',
  uploadedBy: CLIENT,
  uploadedAt: at('2026-06-18T00:00:00.000Z'),
  clauses: [clause(0), clause(1, { category: 'liability', heading: null })],
  ...over,
});

export const riskReport = (over: Partial<RiskReport> = {}): RiskReport => ({
  id: 'report-1' as RiskReportId,
  contractId: CONTRACT,
  model: 'claude-sonnet-4-6' as AiModelId,
  overallLevel: 'medium',
  overallScore: 42 as RiskReport['overallScore'],
  summary: 'Some risk.',
  assessments: [
    {
      clauseId: 'clause-0' as ClauseId,
      level: 'high',
      score: 80 as RiskReport['overallScore'],
      rationale: 'Unbounded liability.',
      recommendation: 'Add a cap.',
    },
    {
      clauseId: 'clause-1' as ClauseId,
      level: 'low',
      score: 10 as RiskReport['overallScore'],
      rationale: 'Standard.',
      recommendation: null,
    },
  ],
  generatedAt: at('2026-06-18T01:00:00.000Z'),
  reportHash: HASH,
  ...over,
});

export const sig = (p: PartyId): PartySignature => ({
  party: p,
  signer: ADDR2,
  signature: SIG,
  signedHash: HASH,
  signedAt: at('2026-06-18T02:00:00.000Z'),
});

const anchor: OnChainAnchor = {
  chainId: CHAIN,
  reportHash: HASH,
  anchorTx: TX,
  anchoredAt: at('2026-06-18T01:30:00.000Z'),
};
const deployed: DeployedEscrow = {
  chainId: CHAIN,
  address: ADDR2,
  deployTx: TX,
  deployedAt: at('2026-06-18T03:00:00.000Z'),
};
const both: BothSignatures = { client: sig(CLIENT), freelancer: sig(FREELANCER) };

// One representative EscrowState per union variant — the repo round-trip must rebuild each.
// `satisfies` (not `: Record<…>`) keeps the literal keys so dot-access isn't widened to `| undefined`.
export const states = {
  awaiting_analysis: { status: 'awaiting_analysis' },
  awaiting_signatures: { status: 'awaiting_signatures', riskReportId: 'report-1' as RiskReportId, anchor },
  awaiting_funding: {
    status: 'awaiting_funding',
    riskReportId: 'report-1' as RiskReportId,
    anchor,
    signatures: both,
  },
  active: {
    status: 'active',
    riskReportId: 'report-1' as RiskReportId,
    anchor,
    signatures: both,
    contract: deployed,
  },
  completed: {
    status: 'completed',
    riskReportId: 'report-1' as RiskReportId,
    anchor,
    signatures: both,
    contract: deployed,
    completedAt: at('2026-06-19T00:00:00.000Z'),
  },
  disputed: {
    status: 'disputed',
    riskReportId: 'report-1' as RiskReportId,
    anchor,
    signatures: both,
    contract: deployed,
    reason: 'work not delivered',
    raisedBy: CLIENT,
    raisedAt: at('2026-06-19T01:00:00.000Z'),
  },
  cancelled: { status: 'cancelled', reason: 'mutual', cancelledAt: at('2026-06-19T02:00:00.000Z') },
} satisfies Record<string, EscrowState>;

export const escrow = (state: EscrowState, over: Partial<Escrow> = {}): Escrow => ({
  id: ESCROW,
  contractId: CONTRACT,
  client: CLIENT,
  freelancer: FREELANCER,
  state,
  createdAt: at('2026-06-18T00:00:00.000Z'),
  updatedAt: at('2026-06-18T00:00:00.000Z'),
  ...over,
});

export const milestone = (index: number, status: MilestoneStatus, over: Partial<Milestone> = {}): Milestone => ({
  id: `milestone-${index}` as MilestoneId,
  escrowId: ESCROW,
  index,
  title: `Milestone ${index}`,
  description: 'Deliver the thing.',
  amount: { amount: 1_000_000n as Wei, token: ADDR },
  status,
  ...over,
});

// One representative MilestoneStatus per union variant.
export const milestoneStatuses = {
  pending: { kind: 'pending' },
  funded: { kind: 'funded' },
  submitted: { kind: 'submitted', submittedAt: at('2026-06-18T04:00:00.000Z') },
  approved: { kind: 'approved', approvedAt: at('2026-06-18T05:00:00.000Z') },
  released: { kind: 'released', releaseTx: TX, releasedAt: at('2026-06-18T06:00:00.000Z') },
  disputed: { kind: 'disputed', reason: 'incomplete', raisedAt: at('2026-06-18T07:00:00.000Z') },
} satisfies Record<string, MilestoneStatus>;

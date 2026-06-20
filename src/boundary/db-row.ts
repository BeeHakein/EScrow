// DB-row boundary. Persistence is OUTSIDE the trust boundary just like the AI and the network:
// rows are re-parsed into domain types here, so Prisma types never leak into domain/application
// and corruption/migration drift is caught at the edge rather than propagating as a fake-typed
// value. Reuses the same value-object parsers as every other boundary — branded types are still
// only minted via those parsers.
//
// Symmetry rule: the discriminated unions (EscrowState, MilestoneStatus) are stored as canonical
// JSON in a TEXT column. The serialize* / parse* pairs below are the single source of truth for
// that wire shape — change one, change the other.

import type { Clause, ClauseCategory } from '../domain/clause';
import type { Contract, DocumentFormat } from '../domain/contract';
import type { DeployedEscrow, Escrow, EscrowState, OnChainAnchor } from '../domain/escrow';
import type { Milestone, MilestoneStatus } from '../domain/milestone';
import type { Party, PartyRole } from '../domain/party';
import type { ClauseRisk, RiskLevel, RiskReport } from '../domain/risk-report';
import type { BothSignatures, PartySignature } from '../domain/signature';
import type {
  ClauseId,
  ContractId,
  EscrowId,
  MilestoneId,
  PartyId,
  RiskReportId,
  UserId,
} from '../domain/shared/ids';
import type { AiModelId, EthereumAddress, Hash32, Money } from '../domain/shared/primitives';
import { type Result, ok, err } from '../domain/shared/result';
import {
  parseChainId,
  parseEthereumAddress,
  parseHash32,
  parseRiskScore,
  parseTimestamp,
  parseTxHash,
  parseWei,
} from './value-objects';

// ── closed-set guards (the discriminants we persist as plain strings) ──────────────
const PARTY_ROLES: readonly PartyRole[] = ['client', 'freelancer'];
const isPartyRole = (v: unknown): v is PartyRole =>
  typeof v === 'string' && (PARTY_ROLES as readonly string[]).includes(v);

const DOCUMENT_FORMATS: readonly DocumentFormat[] = ['pdf', 'docx'];
const isDocumentFormat = (v: unknown): v is DocumentFormat =>
  typeof v === 'string' && (DOCUMENT_FORMATS as readonly string[]).includes(v);

const CLAUSE_CATEGORIES: readonly ClauseCategory[] = [
  'payment',
  'intellectual_property',
  'termination',
  'liability',
  'confidentiality',
  'scope',
  'dispute_resolution',
  'other',
];
const isClauseCategory = (v: unknown): v is ClauseCategory =>
  typeof v === 'string' && (CLAUSE_CATEGORIES as readonly string[]).includes(v);

const RISK_LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high', 'critical'];
const isRiskLevel = (v: unknown): v is RiskLevel =>
  typeof v === 'string' && (RISK_LEVELS as readonly string[]).includes(v);

// ── small structural helpers (rows are untrusted: validate, never assume) ───────────
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const reqString = (v: unknown, field: string): Result<string> =>
  typeof v === 'string' ? ok(v) : err(`${field} must be a string`);

// EIP-712 signature is a 0x-prefixed hex string; we keep the domain's template-literal type.
const parseSignatureHex = (v: unknown): Result<`0x${string}`> =>
  typeof v === 'string' && v.startsWith('0x') ? ok(v as `0x${string}`) : err('signature must be 0x-prefixed');

// ── row shapes (structural — Prisma's scalar output conforms; no Prisma import here) ─
export interface PartyRow {
  readonly id: string;
  readonly userId: string;
  readonly role: string;
  readonly displayName: string;
  readonly walletAddress: string;
}

export interface ClauseRow {
  readonly id: string;
  readonly contractId: string;
  readonly index: number;
  readonly heading: string | null;
  readonly text: string;
  readonly category: string;
}

export interface ContractRow {
  readonly id: string;
  readonly title: string;
  readonly format: string;
  readonly contentHash: string;
  readonly storageKey: string;
  readonly uploadedBy: string;
  readonly uploadedAt: string;
  readonly clauses: readonly ClauseRow[];
}

export interface ClauseRiskRow {
  readonly clauseId: string;
  readonly level: string;
  readonly score: number;
  readonly rationale: string;
  readonly recommendation: string | null;
}

export interface RiskReportRow {
  readonly id: string;
  readonly contractId: string;
  readonly model: string;
  readonly overallLevel: string;
  readonly overallScore: number;
  readonly summary: string;
  readonly generatedAt: string;
  readonly reportHash: string;
  readonly assessments: readonly ClauseRiskRow[];
}

export interface EscrowRow {
  readonly id: string;
  readonly contractId: string;
  readonly client: string;
  readonly freelancer: string;
  readonly state: string; // JSON
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MilestoneRow {
  readonly id: string;
  readonly escrowId: string;
  readonly index: number;
  readonly title: string;
  readonly description: string;
  readonly amountWei: string;
  readonly amountToken: string;
  readonly status: string; // JSON
}

export interface SignatureRow {
  readonly party: string;
  readonly signer: string;
  readonly signature: string;
  readonly signedHash: string;
  readonly signedAt: string;
}

// ── Party ────────────────────────────────────────────────────────────────────────
export function parsePartyRow(row: PartyRow): Result<Party> {
  if (!isPartyRole(row.role)) return err(`party ${row.id}: invalid role ${row.role}`);
  const wallet = parseEthereumAddress(row.walletAddress);
  if (!wallet.ok) return err(`party ${row.id}: ${wallet.error}`);
  return ok({
    id: row.id as PartyId,
    userId: row.userId as UserId,
    role: row.role,
    displayName: row.displayName,
    walletAddress: wallet.value,
  });
}

// ── Clause / Contract ──────────────────────────────────────────────────────────────
function parseClauseRow(row: ClauseRow): Result<Clause> {
  if (!isClauseCategory(row.category)) return err(`clause ${row.id}: invalid category ${row.category}`);
  return ok({
    id: row.id as ClauseId,
    contractId: row.contractId as ContractId,
    index: row.index,
    heading: row.heading,
    text: row.text,
    category: row.category,
  });
}

export function parseContractRow(row: ContractRow): Result<Contract> {
  if (!isDocumentFormat(row.format)) return err(`contract ${row.id}: invalid format ${row.format}`);
  const contentHash = parseHash32(row.contentHash);
  if (!contentHash.ok) return err(`contract ${row.id}: ${contentHash.error}`);
  const uploadedAt = parseTimestamp(row.uploadedAt);
  if (!uploadedAt.ok) return err(`contract ${row.id}: ${uploadedAt.error}`);

  // Clauses are owned by the contract; persisted index order is the document order.
  const clauses: Clause[] = [];
  for (const cr of [...row.clauses].sort((a, b) => a.index - b.index)) {
    const c = parseClauseRow(cr);
    if (!c.ok) return c;
    clauses.push(c.value);
  }
  return ok({
    id: row.id as ContractId,
    title: row.title,
    format: row.format,
    contentHash: contentHash.value,
    storageKey: row.storageKey,
    uploadedBy: row.uploadedBy as PartyId,
    uploadedAt: uploadedAt.value,
    clauses,
  });
}

// ── RiskReport ──────────────────────────────────────────────────────────────────────
function parseClauseRiskRow(row: ClauseRiskRow): Result<ClauseRisk> {
  if (!isRiskLevel(row.level)) return err(`assessment ${row.clauseId}: invalid level ${row.level}`);
  const score = parseRiskScore(row.score);
  if (!score.ok) return err(`assessment ${row.clauseId}: ${score.error}`);
  return ok({
    clauseId: row.clauseId as ClauseId,
    level: row.level,
    score: score.value,
    rationale: row.rationale,
    recommendation: row.recommendation,
  });
}

export function parseRiskReportRow(row: RiskReportRow): Result<RiskReport> {
  if (!isRiskLevel(row.overallLevel)) return err(`report ${row.id}: invalid overallLevel ${row.overallLevel}`);
  const overallScore = parseRiskScore(row.overallScore);
  if (!overallScore.ok) return err(`report ${row.id}: ${overallScore.error}`);
  const reportHash = parseHash32(row.reportHash);
  if (!reportHash.ok) return err(`report ${row.id}: ${reportHash.error}`);
  const generatedAt = parseTimestamp(row.generatedAt);
  if (!generatedAt.ok) return err(`report ${row.id}: ${generatedAt.error}`);

  const assessments: ClauseRisk[] = [];
  for (const ar of row.assessments) {
    const a = parseClauseRiskRow(ar);
    if (!a.ok) return a;
    assessments.push(a.value);
  }
  return ok({
    id: row.id as RiskReportId,
    contractId: row.contractId as ContractId,
    model: row.model as AiModelId,
    overallLevel: row.overallLevel,
    overallScore: overallScore.value,
    summary: row.summary,
    assessments,
    generatedAt: generatedAt.value,
    reportHash: reportHash.value,
  });
}

// ── Signature ─────────────────────────────────────────────────────────────────────
function parseSignatureValue(v: unknown, who: string): Result<PartySignature> {
  if (!isRecord(v)) return err(`${who}: signature must be an object`);
  const signer = parseEthereumAddress(v.signer);
  if (!signer.ok) return err(`${who}: ${signer.error}`);
  const signature = parseSignatureHex(v.signature);
  if (!signature.ok) return err(`${who}: ${signature.error}`);
  const signedHash = parseHash32(v.signedHash);
  if (!signedHash.ok) return err(`${who}: ${signedHash.error}`);
  const signedAt = parseTimestamp(v.signedAt);
  if (!signedAt.ok) return err(`${who}: ${signedAt.error}`);
  const party = reqString(v.party, `${who}.party`);
  if (!party.ok) return party;
  return ok({
    party: party.value as PartyId,
    signer: signer.value,
    signature: signature.value,
    signedHash: signedHash.value,
    signedAt: signedAt.value,
  });
}

export function parseSignatureRow(row: SignatureRow): Result<PartySignature> {
  return parseSignatureValue(row, `signature ${row.party}`);
}

// ── Money (Milestone amount, stored as wei-string + token) ──────────────────────────
function parseMoney(amountWei: string, amountToken: string): Result<Money> {
  const amount = parseWei(amountWei);
  if (!amount.ok) return err(`amount: ${amount.error}`);
  if (amountToken === 'native') return ok({ amount: amount.value, token: 'native' });
  const token = parseEthereumAddress(amountToken);
  if (!token.ok) return err(`token: ${token.error}`);
  return ok({ amount: amount.value, token: token.value as EthereumAddress });
}

// ── MilestoneStatus union ───────────────────────────────────────────────────────────
export const serializeMilestoneStatus = (s: MilestoneStatus): string => JSON.stringify(s);

export function parseMilestoneStatusValue(v: unknown): Result<MilestoneStatus> {
  if (!isRecord(v)) return err('milestone status must be an object');
  switch (v.kind) {
    case 'pending':
      return ok({ kind: 'pending' });
    case 'funded':
      return ok({ kind: 'funded' });
    case 'submitted': {
      const at = parseTimestamp(v.submittedAt);
      return at.ok ? ok({ kind: 'submitted', submittedAt: at.value }) : err(at.error);
    }
    case 'approved': {
      const at = parseTimestamp(v.approvedAt);
      return at.ok ? ok({ kind: 'approved', approvedAt: at.value }) : err(at.error);
    }
    case 'released': {
      const tx = parseTxHash(v.releaseTx);
      if (!tx.ok) return err(tx.error);
      const at = parseTimestamp(v.releasedAt);
      return at.ok ? ok({ kind: 'released', releaseTx: tx.value, releasedAt: at.value }) : err(at.error);
    }
    case 'disputed': {
      const reason = reqString(v.reason, 'reason');
      if (!reason.ok) return reason;
      const at = parseTimestamp(v.raisedAt);
      return at.ok ? ok({ kind: 'disputed', reason: reason.value, raisedAt: at.value }) : err(at.error);
    }
    default:
      return err(`unknown milestone status kind: ${String(v.kind)}`);
  }
}

export function parseMilestoneRow(row: MilestoneRow): Result<Milestone> {
  const amount = parseMoney(row.amountWei, row.amountToken);
  if (!amount.ok) return err(`milestone ${row.id}: ${amount.error}`);
  let statusJson: unknown;
  try {
    statusJson = JSON.parse(row.status);
  } catch {
    return err(`milestone ${row.id}: status is not valid JSON`);
  }
  const status = parseMilestoneStatusValue(statusJson);
  if (!status.ok) return err(`milestone ${row.id}: ${status.error}`);
  return ok({
    id: row.id as MilestoneId,
    escrowId: row.escrowId as EscrowId,
    index: row.index,
    title: row.title,
    description: row.description,
    amount: amount.value,
    status: status.value,
  });
}

// ── EscrowState union ───────────────────────────────────────────────────────────────
function parseAnchor(v: unknown): Result<OnChainAnchor> {
  if (!isRecord(v)) return err('anchor must be an object');
  const chainId = parseChainId(v.chainId);
  if (!chainId.ok) return err(`anchor: ${chainId.error}`);
  const reportHash = parseHash32(v.reportHash);
  if (!reportHash.ok) return err(`anchor: ${reportHash.error}`);
  const anchorTx = parseTxHash(v.anchorTx);
  if (!anchorTx.ok) return err(`anchor: ${anchorTx.error}`);
  const anchoredAt = parseTimestamp(v.anchoredAt);
  if (!anchoredAt.ok) return err(`anchor: ${anchoredAt.error}`);
  return ok({
    chainId: chainId.value,
    reportHash: reportHash.value,
    anchorTx: anchorTx.value,
    anchoredAt: anchoredAt.value,
  });
}

function parseDeployed(v: unknown): Result<DeployedEscrow> {
  if (!isRecord(v)) return err('deployed contract must be an object');
  const chainId = parseChainId(v.chainId);
  if (!chainId.ok) return err(`contract: ${chainId.error}`);
  const address = parseEthereumAddress(v.address);
  if (!address.ok) return err(`contract: ${address.error}`);
  const deployTx = parseTxHash(v.deployTx);
  if (!deployTx.ok) return err(`contract: ${deployTx.error}`);
  const deployedAt = parseTimestamp(v.deployedAt);
  if (!deployedAt.ok) return err(`contract: ${deployedAt.error}`);
  return ok({
    chainId: chainId.value,
    address: address.value,
    deployTx: deployTx.value,
    deployedAt: deployedAt.value,
  });
}

function parseBothSignatures(v: unknown): Result<BothSignatures> {
  if (!isRecord(v)) return err('signatures must be an object');
  const client = parseSignatureValue(v.client, 'signatures.client');
  if (!client.ok) return client;
  const freelancer = parseSignatureValue(v.freelancer, 'signatures.freelancer');
  if (!freelancer.ok) return freelancer;
  return ok({ client: client.value, freelancer: freelancer.value });
}

export const serializeEscrowState = (s: EscrowState): string => JSON.stringify(s);

export function parseEscrowStateValue(v: unknown): Result<EscrowState> {
  if (!isRecord(v)) return err('escrow state must be an object');
  const riskReportId = () => (v.riskReportId as RiskReportId | undefined) ?? null;

  switch (v.status) {
    case 'awaiting_analysis':
      return ok({ status: 'awaiting_analysis' });

    case 'awaiting_signatures': {
      const rid = riskReportId();
      if (!rid) return err('awaiting_signatures: missing riskReportId');
      const anchor = parseAnchor(v.anchor);
      if (!anchor.ok) return anchor;
      return ok({ status: 'awaiting_signatures', riskReportId: rid, anchor: anchor.value });
    }

    case 'awaiting_funding': {
      const rid = riskReportId();
      if (!rid) return err('awaiting_funding: missing riskReportId');
      const anchor = parseAnchor(v.anchor);
      if (!anchor.ok) return anchor;
      const signatures = parseBothSignatures(v.signatures);
      if (!signatures.ok) return signatures;
      return ok({ status: 'awaiting_funding', riskReportId: rid, anchor: anchor.value, signatures: signatures.value });
    }

    case 'active': {
      const rid = riskReportId();
      if (!rid) return err('active: missing riskReportId');
      const anchor = parseAnchor(v.anchor);
      if (!anchor.ok) return anchor;
      const signatures = parseBothSignatures(v.signatures);
      if (!signatures.ok) return signatures;
      const contract = parseDeployed(v.contract);
      if (!contract.ok) return contract;
      return ok({
        status: 'active',
        riskReportId: rid,
        anchor: anchor.value,
        signatures: signatures.value,
        contract: contract.value,
      });
    }

    case 'completed': {
      const rid = riskReportId();
      if (!rid) return err('completed: missing riskReportId');
      const anchor = parseAnchor(v.anchor);
      if (!anchor.ok) return anchor;
      const signatures = parseBothSignatures(v.signatures);
      if (!signatures.ok) return signatures;
      const contract = parseDeployed(v.contract);
      if (!contract.ok) return contract;
      const completedAt = parseTimestamp(v.completedAt);
      if (!completedAt.ok) return err(`completed: ${completedAt.error}`);
      return ok({
        status: 'completed',
        riskReportId: rid,
        anchor: anchor.value,
        signatures: signatures.value,
        contract: contract.value,
        completedAt: completedAt.value,
      });
    }

    case 'disputed': {
      const rid = riskReportId();
      if (!rid) return err('disputed: missing riskReportId');
      const anchor = parseAnchor(v.anchor);
      if (!anchor.ok) return anchor;
      const signatures = parseBothSignatures(v.signatures);
      if (!signatures.ok) return signatures;
      const contract = parseDeployed(v.contract);
      if (!contract.ok) return contract;
      const reason = reqString(v.reason, 'disputed.reason');
      if (!reason.ok) return reason;
      const raisedAt = parseTimestamp(v.raisedAt);
      if (!raisedAt.ok) return err(`disputed: ${raisedAt.error}`);
      const raisedBy = reqString(v.raisedBy, 'disputed.raisedBy');
      if (!raisedBy.ok) return raisedBy;
      return ok({
        status: 'disputed',
        riskReportId: rid,
        anchor: anchor.value,
        signatures: signatures.value,
        contract: contract.value,
        reason: reason.value,
        raisedBy: raisedBy.value as PartyId,
        raisedAt: raisedAt.value,
      });
    }

    case 'cancelled': {
      const reason = reqString(v.reason, 'cancelled.reason');
      if (!reason.ok) return reason;
      const cancelledAt = parseTimestamp(v.cancelledAt);
      if (!cancelledAt.ok) return err(`cancelled: ${cancelledAt.error}`);
      return ok({ status: 'cancelled', reason: reason.value, cancelledAt: cancelledAt.value });
    }

    default:
      return err(`unknown escrow status: ${String(v.status)}`);
  }
}

export function parseEscrowRow(row: EscrowRow): Result<Escrow> {
  let stateJson: unknown;
  try {
    stateJson = JSON.parse(row.state);
  } catch {
    return err(`escrow ${row.id}: state is not valid JSON`);
  }
  const state = parseEscrowStateValue(stateJson);
  if (!state.ok) return err(`escrow ${row.id}: ${state.error}`);
  const createdAt = parseTimestamp(row.createdAt);
  if (!createdAt.ok) return err(`escrow ${row.id}: ${createdAt.error}`);
  const updatedAt = parseTimestamp(row.updatedAt);
  if (!updatedAt.ok) return err(`escrow ${row.id}: ${updatedAt.error}`);
  return ok({
    id: row.id as EscrowId,
    contractId: row.contractId as ContractId,
    client: row.client as PartyId,
    freelancer: row.freelancer as PartyId,
    state: state.value,
    createdAt: createdAt.value,
    updatedAt: updatedAt.value,
  });
}

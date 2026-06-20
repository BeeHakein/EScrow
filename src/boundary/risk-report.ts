import type { Contract } from '../domain/contract';
import type { ClauseRisk, RiskLevel, RiskReport } from '../domain/risk-report';
import type { ClauseId, RiskReportId } from '../domain/shared/ids';
import type { AiModelId, Hash32, Timestamp } from '../domain/shared/primitives';
import { type Result, ok, err } from '../domain/shared/result';
import { parseRiskScore } from './value-objects';

const RISK_LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high', 'critical'];
const isRiskLevel = (v: unknown): v is RiskLevel =>
  typeof v === 'string' && (RISK_LEVELS as readonly string[]).includes(v);

// The untrusted shape the analyzer (Claude API or stub) promises to return.
// It stays `string`/`number` until parsed — the AI sits OUTSIDE the trust boundary.
export interface RawClauseRisk {
  readonly clauseId: string;
  readonly level: string;
  readonly score: number;
  readonly rationale: string;
  readonly recommendation?: string | null;
}

export interface RawRiskAnalysis {
  readonly overallLevel: string;
  readonly overallScore: number;
  readonly summary: string;
  readonly assessments: readonly RawClauseRisk[];
}

// Identity + provenance attached by the application after hashing — not from the AI.
export interface RiskReportContext {
  readonly id: RiskReportId;
  readonly model: AiModelId;
  readonly generatedAt: Timestamp;
  readonly reportHash: Hash32;
}

// Parse raw AI output into a trusted RiskReport, cross-checked against the contract.
export function parseRiskReport(
  raw: RawRiskAnalysis,
  contract: Contract,
  ctx: RiskReportContext,
): Result<RiskReport> {
  if (!isRiskLevel(raw.overallLevel)) return err(`invalid overallLevel: ${String(raw.overallLevel)}`);
  const overallScore = parseRiskScore(raw.overallScore);
  if (!overallScore.ok) return err(`overallScore: ${overallScore.error}`);
  if (typeof raw.summary !== 'string' || raw.summary.length === 0) return err('summary is required');

  const knownClauseIds = new Set<string>(contract.clauses.map((c) => c.id));
  const seen = new Set<string>();
  const assessments: ClauseRisk[] = [];

  for (const a of raw.assessments) {
    if (!knownClauseIds.has(a.clauseId)) return err(`assessment references unknown clause: ${a.clauseId}`);
    if (seen.has(a.clauseId)) return err(`duplicate assessment for clause: ${a.clauseId}`);
    seen.add(a.clauseId);
    if (!isRiskLevel(a.level)) return err(`invalid level for clause ${a.clauseId}: ${String(a.level)}`);
    const score = parseRiskScore(a.score);
    if (!score.ok) return err(`score for clause ${a.clauseId}: ${score.error}`);
    if (typeof a.rationale !== 'string' || a.rationale.length === 0)
      return err(`rationale required for clause ${a.clauseId}`);
    assessments.push({
      clauseId: a.clauseId as ClauseId,
      level: a.level,
      score: score.value,
      rationale: a.rationale,
      recommendation: a.recommendation ?? null,
    });
  }

  // Every clause must be assessed — no silent gaps. Better to reject than to anchor a partial report.
  if (assessments.length !== contract.clauses.length)
    return err(`expected ${contract.clauses.length} assessments, got ${assessments.length}`);

  return ok({
    id: ctx.id,
    contractId: contract.id,
    model: ctx.model,
    overallLevel: raw.overallLevel,
    overallScore: overallScore.value,
    summary: raw.summary,
    assessments,
    generatedAt: ctx.generatedAt,
    reportHash: ctx.reportHash,
  });
}

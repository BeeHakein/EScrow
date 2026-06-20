import type { PrismaClient } from '@prisma/client';
import type { RiskReportRepository } from '../../../domain/repositories/risk-report-repository';
import type { RiskReport } from '../../../domain/risk-report';
import type { ContractId, RiskReportId } from '../../../domain/shared/ids';
import { parseRiskReportRow } from '../../../boundary/db-row';
import { orThrow } from './parse-or-throw';

// Prisma adapter for RiskReportRepository. Per-clause assessments are normalized into their own
// rows and replaced wholesale on save (a report is immutable, but a re-save of the same id stays
// idempotent). findByContract returns the latest report by generatedAt — canonical ISO strings
// sort lexicographically in chronological order.
export class PrismaRiskReportRepository implements RiskReportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(report: RiskReport): Promise<void> {
    const assessments = report.assessments.map((a) => ({
      clauseId: a.clauseId,
      level: a.level,
      score: a.score,
      rationale: a.rationale,
      recommendation: a.recommendation,
    }));
    const scalar = {
      contractId: report.contractId,
      model: report.model,
      overallLevel: report.overallLevel,
      overallScore: report.overallScore,
      summary: report.summary,
      generatedAt: report.generatedAt,
      reportHash: report.reportHash,
    };
    await this.prisma.riskReport.upsert({
      where: { id: report.id },
      create: { id: report.id, ...scalar, assessments: { create: assessments } },
      update: { ...scalar, assessments: { deleteMany: {}, create: assessments } },
    });
  }

  async findById(id: RiskReportId): Promise<RiskReport | null> {
    const row = await this.prisma.riskReport.findUnique({ where: { id }, include: { assessments: true } });
    return row ? orThrow(parseRiskReportRow(row)) : null;
  }

  async findByContract(contractId: ContractId): Promise<RiskReport | null> {
    const row = await this.prisma.riskReport.findFirst({
      where: { contractId },
      orderBy: { generatedAt: 'desc' },
      include: { assessments: true },
    });
    return row ? orThrow(parseRiskReportRow(row)) : null;
  }
}

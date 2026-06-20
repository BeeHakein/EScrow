import type { RiskReportRepository } from '../../../domain/repositories/risk-report-repository';
import type { RiskReport } from '../../../domain/risk-report';
import type { ContractId, RiskReportId } from '../../../domain/shared/ids';

// Simplest implementation that works (Beck). Lets the app and tests run without Postgres;
// the Prisma adapter implements the same port later without touching callers.
export class InMemoryRiskReportRepository implements RiskReportRepository {
  private readonly byId = new Map<RiskReportId, RiskReport>();

  async save(report: RiskReport): Promise<void> {
    this.byId.set(report.id, report);
  }

  async findById(id: RiskReportId): Promise<RiskReport | null> {
    return this.byId.get(id) ?? null;
  }

  async findByContract(contractId: ContractId): Promise<RiskReport | null> {
    let latest: RiskReport | null = null;
    for (const report of this.byId.values()) {
      if (report.contractId !== contractId) continue;
      if (latest === null || report.generatedAt > latest.generatedAt) latest = report;
    }
    return latest;
  }
}

import type { RiskReport } from '../risk-report';
import type { ContractId, RiskReportId } from '../shared/ids';

export interface RiskReportRepository {
  save(report: RiskReport): Promise<void>;
  findById(id: RiskReportId): Promise<RiskReport | null>;
  // Latest finalized report for a contract, if any.
  findByContract(contractId: ContractId): Promise<RiskReport | null>;
}

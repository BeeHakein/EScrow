import type { Contract } from '../domain/contract';
import type { RiskReport } from '../domain/risk-report';
import type { RiskReportRepository } from '../domain/repositories/risk-report-repository';
import type { RiskReportId } from '../domain/shared/ids';
import type { AiModelId, Timestamp } from '../domain/shared/primitives';
import type { Result } from '../domain/shared/result';
import type { ContractAnalyzer } from './ports/contract-analyzer';
import type { ReportHasher } from './ports/report-hasher';
import { parseRiskReport } from '../boundary/risk-report';

// Dependencies injected, not imported — the clock, id generator and model are explicit,
// so the use-case is pure and fully testable without a real DB, API, or wall clock.
export interface AnalyzeContractDeps {
  readonly analyzer: ContractAnalyzer;
  readonly hasher: ReportHasher;
  readonly reports: RiskReportRepository;
  readonly newReportId: () => RiskReportId;
  readonly now: () => Timestamp;
  readonly model: AiModelId;
}

// Step 2 of the platform flow: analyze a contract, parse the result at the boundary,
// hash it, and persist. Returns the failure path instead of throwing.
export async function analyzeContract(
  contract: Contract,
  deps: AnalyzeContractDeps,
): Promise<Result<RiskReport>> {
  const analysis = await deps.analyzer.analyze(contract);
  const generatedAt = deps.now();
  const reportHash = await deps.hasher.hash({
    contractId: contract.id,
    model: deps.model,
    generatedAt,
    analysis,
  });

  const parsed = parseRiskReport(analysis, contract, {
    id: deps.newReportId(),
    model: deps.model,
    generatedAt,
    reportHash,
  });
  if (!parsed.ok) return parsed;

  await deps.reports.save(parsed.value);
  return parsed;
}

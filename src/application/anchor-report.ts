import type { Escrow } from '../domain/escrow';
import type { EscrowRepository } from '../domain/repositories/escrow-repository';
import type { RiskReportRepository } from '../domain/repositories/risk-report-repository';
import type { EscrowId } from '../domain/shared/ids';
import type { Timestamp } from '../domain/shared/primitives';
import { type Result, err } from '../domain/shared/result';
import { anchorReport as anchorReportTransition } from '../domain/escrow-transitions';
import type { ReportAnchorService } from './ports/report-anchor';

export interface AnchorReportDeps {
  readonly escrows: EscrowRepository;
  readonly reports: RiskReportRepository;
  readonly anchorService: ReportAnchorService;
  readonly now: () => Timestamp;
}

// Step 3 of the flow: anchor the finalized risk-report hash on Base, then advance the escrow.
export async function anchorReport(escrowId: EscrowId, deps: AnchorReportDeps): Promise<Result<Escrow>> {
  const escrow = await deps.escrows.findById(escrowId);
  if (escrow === null) return err(`escrow not found: ${escrowId}`);
  if (escrow.state.status !== 'awaiting_analysis')
    return err(`escrow ${escrowId} is not awaiting analysis (is '${escrow.state.status}')`);

  const report = await deps.reports.findByContract(escrow.contractId);
  if (report === null) return err(`no risk report for contract ${escrow.contractId}`);

  const anchor = await deps.anchorService.anchor(report.reportHash);
  const transitioned = anchorReportTransition(escrow, { riskReportId: report.id, anchor }, deps.now());
  if (!transitioned.ok) return transitioned;

  await deps.escrows.save(transitioned.value);
  return transitioned;
}

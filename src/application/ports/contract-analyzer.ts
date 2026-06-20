import type { Contract } from '../../domain/contract';
import type { RawRiskAnalysis } from '../../boundary/risk-report';

// Outbound port. The real adapter calls the Claude API; a stub returns canned analysis.
// Either way the output is UNTRUSTED raw data — the application parses it at the boundary.
export interface ContractAnalyzer {
  analyze(contract: Contract): Promise<RawRiskAnalysis>;
}

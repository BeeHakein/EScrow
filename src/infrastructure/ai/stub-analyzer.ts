import type { Contract } from '../../domain/contract';
import type { ContractAnalyzer } from '../../application/ports/contract-analyzer';
import type { RawRiskAnalysis } from '../../boundary/risk-report';

// Deterministic stand-in for the Claude API, so the whole app runs API-free during dev.
// Replace with infrastructure/ai/claude-analyzer.ts (consult the `claude-api` skill) for real analysis.
export class StubContractAnalyzer implements ContractAnalyzer {
  async analyze(contract: Contract): Promise<RawRiskAnalysis> {
    const assessments = contract.clauses.map((c) => {
      const high = c.category === 'liability' || c.category === 'intellectual_property';
      return {
        clauseId: c.id as string,
        level: high ? 'high' : 'low',
        score: high ? 80 : 20,
        rationale: `Stub assessment for ${c.category} clause #${c.index}.`,
        recommendation: high ? 'Have this clause reviewed before signing.' : null,
      };
    });
    const flagged = assessments.some((a) => a.score >= 70);
    return {
      overallLevel: flagged ? 'high' : 'low',
      overallScore: flagged ? 80 : 20,
      summary: `Stub risk analysis of "${contract.title}" (${assessments.length} clauses).`,
      assessments,
    };
  }
}

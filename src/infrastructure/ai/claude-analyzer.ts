import type Anthropic from '@anthropic-ai/sdk';
import type { Contract } from '../../domain/contract';
import type { ContractAnalyzer } from '../../application/ports/contract-analyzer';
import type { RawRiskAnalysis } from '../../boundary/risk-report';

// The project pins this model (CLAUDE.md). It supports structured outputs, which we rely on.
// Injectable so tests / future tuning can override without touching the use-case.
export const DEFAULT_ANALYZER_MODEL = 'claude-sonnet-4-6';

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

// JSON schema the model output is CONSTRAINED to (structured outputs), so the response is always
// shaped like RawRiskAnalysis. Ranges (0..100) and clause-id cross-checks are NOT enforced here —
// numeric/string constraints are unsupported by structured outputs and, more importantly, the AI
// sits outside the trust boundary: the application re-validates every field in boundary/risk-report.
const RISK_ANALYSIS_SCHEMA: { [key: string]: unknown } = {
  type: 'object',
  additionalProperties: false,
  properties: {
    overallLevel: { type: 'string', enum: RISK_LEVELS },
    overallScore: { type: 'integer' },
    summary: { type: 'string' },
    assessments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          clauseId: { type: 'string' },
          level: { type: 'string', enum: RISK_LEVELS },
          score: { type: 'integer' },
          rationale: { type: 'string' },
          recommendation: { type: ['string', 'null'] },
        },
        required: ['clauseId', 'level', 'score', 'rationale', 'recommendation'],
      },
    },
  },
  required: ['overallLevel', 'overallScore', 'summary', 'assessments'],
};

const SYSTEM_PROMPT = [
  'You are a contract risk analyst for a freelance escrow platform.',
  'Assess the legal and financial risk each clause poses to the parties.',
  'Score 0 (no risk) to 100 (critical). Reserve high/critical for clauses that could cause real',
  'financial loss or unfair obligations (e.g. unlimited liability, one-sided IP assignment).',
  'Return exactly one assessment per clause, keyed by the exact clause id you are given —',
  'never invent a clause id and never omit one. Set recommendation to null when none is warranted.',
].join('\n');

// Real Claude-backed analyzer behind the ContractAnalyzer port. Drops in for StubContractAnalyzer
// with no caller change. A single structured Messages call (extraction/judgment over the clauses);
// the client is injected so the use-case stays pure and the adapter is testable without a network.
export class ClaudeContractAnalyzer implements ContractAnalyzer {
  constructor(
    private readonly client: Anthropic,
    private readonly model: string = DEFAULT_ANALYZER_MODEL,
  ) {}

  async analyze(contract: Contract): Promise<RawRiskAnalysis> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      thinking: { type: 'adaptive' }, // risk judgement benefits from reasoning; Sonnet 4.6 supports it
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: RISK_ANALYSIS_SCHEMA } },
      messages: [{ role: 'user', content: renderContract(contract) }],
    });

    // Skip any leading thinking blocks; the JSON answer is the text block.
    const block = message.content.find((b) => b.type === 'text');
    if (block === undefined || block.type !== 'text') {
      throw new Error('Claude analyzer returned no text content');
    }
    return JSON.parse(block.text) as RawRiskAnalysis;
  }
}

function renderContract(contract: Contract): string {
  const clauses = contract.clauses
    .map((c) => `Clause id: ${c.id}\nCategory: ${c.category}\nHeading: ${c.heading ?? '(none)'}\nText: ${c.text}`)
    .join('\n\n');
  return [
    `Contract title: ${contract.title}`,
    '',
    'Assess EVERY clause below. Return one assessment per clause, using the exact "Clause id"',
    'as clauseId. Do not invent or omit clauses.',
    '',
    clauses,
  ].join('\n');
}

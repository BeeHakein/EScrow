import { describe, it, expect } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { ClaudeContractAnalyzer, DEFAULT_ANALYZER_MODEL } from '../../src/infrastructure/ai/claude-analyzer';
import type { Contract } from '../../src/domain/contract';
import type { Clause } from '../../src/domain/clause';
import type { ClauseId, ContractId, PartyId } from '../../src/domain/shared/ids';
import type { Hash32, Timestamp } from '../../src/domain/shared/primitives';

const clause = (id: string, category: Clause['category'], text: string): Clause => ({
  id: id as ClauseId,
  contractId: 'c1' as ContractId,
  index: 0,
  heading: null,
  text,
  category,
});

const contract: Contract = {
  id: 'c1' as ContractId,
  title: 'Services Agreement',
  format: 'pdf',
  contentHash: `0x${'0'.repeat(64)}` as Hash32,
  storageKey: 'blob://c1',
  uploadedBy: 'p1' as PartyId,
  uploadedAt: '2026-06-20T00:00:00.000Z' as Timestamp,
  clauses: [clause('cl0', 'payment', 'Client pays on net-30.'), clause('cl1', 'liability', 'Unlimited liability.')],
};

// A canned structured response, exactly the JSON shape the model is constrained to emit.
const ANALYSIS = {
  overallLevel: 'high',
  overallScore: 70,
  summary: 'One high-risk liability clause.',
  assessments: [
    { clauseId: 'cl0', level: 'low', score: 10, rationale: 'Standard terms.', recommendation: null },
    { clauseId: 'cl1', level: 'high', score: 90, rationale: 'Unlimited liability.', recommendation: 'Cap liability.' },
  ],
};

// Minimal fake of the Anthropic client: records the request and returns a canned message.
// Lets us unit-test prompt construction + response parsing with no network.
function fakeClient(
  message: { content: Array<{ type: string; text?: string }> },
  capture?: (params: Record<string, unknown>) => void,
): Anthropic {
  return {
    messages: {
      create: async (params: Record<string, unknown>) => {
        capture?.(params);
        return message;
      },
    },
  } as unknown as Anthropic;
}

describe('ClaudeContractAnalyzer', () => {
  it('requests structured JSON for the pinned model and parses the response', async () => {
    let sent: Record<string, unknown> = {};
    const client = fakeClient({ content: [{ type: 'text', text: JSON.stringify(ANALYSIS) }] }, (p) => (sent = p));

    const result = await new ClaudeContractAnalyzer(client).analyze(contract);

    expect(result).toEqual(ANALYSIS);
    expect(sent.model).toBe(DEFAULT_ANALYZER_MODEL);
    expect(DEFAULT_ANALYZER_MODEL).toBe('claude-sonnet-4-6'); // project pin (CLAUDE.md)
    // Structured output is enforced via output_config.format json_schema (not a brittle prompt).
    const format = (sent.output_config as { format?: { type?: string } }).format;
    expect(format?.type).toBe('json_schema');
  });

  it('puts every clause id in the prompt so the model can assess all of them', async () => {
    let sent: Record<string, unknown> = {};
    const client = fakeClient({ content: [{ type: 'text', text: JSON.stringify(ANALYSIS) }] }, (p) => (sent = p));

    await new ClaudeContractAnalyzer(client).analyze(contract);

    const userText = JSON.stringify(sent.messages);
    expect(userText).toContain('cl0');
    expect(userText).toContain('cl1');
  });

  it('skips thinking blocks and reads the JSON from the text block', async () => {
    const client = fakeClient({
      content: [{ type: 'thinking' }, { type: 'text', text: JSON.stringify(ANALYSIS) }],
    });
    const result = await new ClaudeContractAnalyzer(client).analyze(contract);
    expect(result.assessments).toHaveLength(2);
  });

  it('throws when the response carries no text block', async () => {
    const client = fakeClient({ content: [{ type: 'thinking' }] });
    await expect(new ClaudeContractAnalyzer(client).analyze(contract)).rejects.toThrow(/no text/i);
  });

  it('honours an injected model override', async () => {
    let sent: Record<string, unknown> = {};
    const client = fakeClient({ content: [{ type: 'text', text: JSON.stringify(ANALYSIS) }] }, (p) => (sent = p));
    await new ClaudeContractAnalyzer(client, 'claude-opus-4-8').analyze(contract);
    expect(sent.model).toBe('claude-opus-4-8');
  });
});

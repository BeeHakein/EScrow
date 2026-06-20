import { describe, it, expect } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { ClaudeClauseSegmenter, DEFAULT_SEGMENTER_MODEL } from '../../src/infrastructure/ai/claude-clause-segmenter';

// A canned structured response, exactly the JSON shape the model is constrained to emit.
const SEGMENTATION = {
  clauses: [
    { heading: 'Payment', text: 'Client pays net-30.', category: 'payment' },
    { heading: null, text: 'Provider retains all IP.', category: 'intellectual_property' },
  ],
};

// Minimal fake of the Anthropic client: records the request and returns a canned message.
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

describe('ClaudeClauseSegmenter', () => {
  it('requests structured JSON for the pinned model and parses the clauses', async () => {
    let sent: Record<string, unknown> = {};
    const client = fakeClient({ content: [{ type: 'text', text: JSON.stringify(SEGMENTATION) }] }, (p) => (sent = p));

    const clauses = await new ClaudeClauseSegmenter(client).segment('some contract text');

    expect(clauses).toEqual(SEGMENTATION.clauses);
    expect(sent.model).toBe(DEFAULT_SEGMENTER_MODEL);
    expect(DEFAULT_SEGMENTER_MODEL).toBe('claude-sonnet-4-6'); // project pin (CLAUDE.md)
    // Structured output is enforced via output_config.format json_schema (not a brittle prompt).
    const format = (sent.output_config as { format?: { type?: string } }).format;
    expect(format?.type).toBe('json_schema');
  });

  it('puts the document text in the user message', async () => {
    let sent: Record<string, unknown> = {};
    const client = fakeClient({ content: [{ type: 'text', text: JSON.stringify(SEGMENTATION) }] }, (p) => (sent = p));

    await new ClaudeClauseSegmenter(client).segment('UNIQUE-MARKER-12345');

    expect(JSON.stringify(sent.messages)).toContain('UNIQUE-MARKER-12345');
  });

  it('skips thinking blocks and reads the JSON from the text block', async () => {
    const client = fakeClient({
      content: [{ type: 'thinking' }, { type: 'text', text: JSON.stringify(SEGMENTATION) }],
    });
    const clauses = await new ClaudeClauseSegmenter(client).segment('text');
    expect(clauses).toHaveLength(2);
  });

  it('throws when the response carries no text block', async () => {
    const client = fakeClient({ content: [{ type: 'thinking' }] });
    await expect(new ClaudeClauseSegmenter(client).segment('text')).rejects.toThrow(/no text/i);
  });

  it('honours an injected model override', async () => {
    let sent: Record<string, unknown> = {};
    const client = fakeClient({ content: [{ type: 'text', text: JSON.stringify(SEGMENTATION) }] }, (p) => (sent = p));
    await new ClaudeClauseSegmenter(client, 'claude-opus-4-8').segment('text');
    expect(sent.model).toBe('claude-opus-4-8');
  });
});

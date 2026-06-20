import type Anthropic from '@anthropic-ai/sdk';
import type { ClauseSegmenter } from '../../application/ports/clause-segmenter';
import type { RawClause, RawDocument } from '../../boundary/contract';

// Project model pin (CLAUDE.md), same as the analyzer. Injectable so tests / tuning can override.
// This is the project's explicit choice, not a cost downgrade.
export const DEFAULT_SEGMENTER_MODEL = 'claude-sonnet-4-6';

const CLAUSE_CATEGORIES = [
  'payment',
  'intellectual_property',
  'termination',
  'liability',
  'confidentiality',
  'scope',
  'dispute_resolution',
  'other',
] as const;

// Structured-output schema constraining the response to RawDocument's shape. `category` is held to
// the closed set to steer the model, but the AI is still OUTSIDE the trust boundary — every field is
// re-validated in boundary/contract.ts (parseClause) regardless of what the schema admits.
const SEGMENTATION_SCHEMA: { [key: string]: unknown } = {
  type: 'object',
  additionalProperties: false,
  properties: {
    clauses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          heading: { type: ['string', 'null'] },
          text: { type: 'string' },
          category: { type: 'string', enum: CLAUSE_CATEGORIES },
        },
        required: ['heading', 'text', 'category'],
      },
    },
  },
  required: ['clauses'],
};

const SYSTEM_PROMPT = [
  'You segment legal contract text into its individual clauses for a freelance escrow platform.',
  'Split the document into the natural clauses a lawyer would recognize — one coherent obligation,',
  'term, or section per clause. Real documents rarely separate clauses with blank lines, so rely on',
  'numbering, headings, and meaning, not whitespace.',
  'Rules:',
  '- Preserve each clause body VERBATIM from the source text. Do not summarize, rephrase, or invent text.',
  '- Set heading to the clause title if one is present, otherwise null. The heading is NOT part of the body.',
  '- Assign the single best category from the allowed set; use "other" when none clearly fits.',
  '- Return the clauses in document order. Do not drop or merge distinct clauses.',
].join('\n');

// Real Claude-backed ClauseSegmenter. Drops in for HeuristicClauseSegmenter behind the port with no
// caller change — a single structured Messages call over the extracted text. The client is injected
// so the use-case stays pure and the adapter is unit-testable without a network.
export class ClaudeClauseSegmenter implements ClauseSegmenter {
  constructor(
    private readonly client: Anthropic,
    private readonly model: string = DEFAULT_SEGMENTER_MODEL,
  ) {}

  async segment(text: string): Promise<readonly RawClause[]> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      thinking: { type: 'adaptive' }, // segmentation benefits from reasoning over structure; Sonnet 4.6 supports it
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: SEGMENTATION_SCHEMA } },
      messages: [{ role: 'user', content: `Segment the following contract text into clauses:\n\n${text}` }],
    });

    // Skip any leading thinking blocks; the JSON answer is the text block.
    const block = message.content.find((b) => b.type === 'text');
    if (block === undefined || block.type !== 'text') {
      throw new Error('Claude clause segmenter returned no text content');
    }
    const parsed = JSON.parse(block.text) as RawDocument;
    return parsed.clauses;
  }
}

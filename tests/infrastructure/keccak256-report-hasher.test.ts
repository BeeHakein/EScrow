import { describe, it, expect } from 'vitest';
import { keccak256, toBytes } from 'viem';
import { Keccak256ReportHasher } from '../../src/infrastructure/chain/keccak256-report-hasher';
import { canonicalReportString } from '../../src/infrastructure/chain/report-canonical';
import type { ReportHashInput } from '../../src/application/ports/report-hasher';
import type { ContractId } from '../../src/domain/shared/ids';
import type { AiModelId, Timestamp } from '../../src/domain/shared/primitives';

const input: ReportHashInput = {
  contractId: 'contract_1' as ContractId,
  model: 'claude-sonnet-4-6' as AiModelId,
  generatedAt: '2026-06-20T00:00:00.000Z' as Timestamp,
  analysis: {
    overallLevel: 'medium',
    overallScore: 42,
    summary: 'ok',
    assessments: [
      { clauseId: 'clause_1', level: 'low', score: 10, rationale: 'fine', recommendation: null },
    ],
  },
};

describe('Keccak256ReportHasher', () => {
  it('matches the known keccak256 digest of the canonical pre-image', async () => {
    const h = await new Keccak256ReportHasher().hash(input);
    expect(h).toBe('0x3ed2aaa2011ce1214f47c36c845468c9349aa27a7b7894f6fb54362e99f2f58e');
  });

  it('is keccak256 of the shared canonical string (EVM-native, not sha256)', async () => {
    const h = await new Keccak256ReportHasher().hash(input);
    expect(h).toBe(keccak256(toBytes(canonicalReportString(input))));
    expect(h).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('is order-independent in object keys but order-sensitive in assessments', async () => {
    const hasher = new Keccak256ReportHasher();
    // Same logical input, keys declared in a different order → same hash.
    const reordered: ReportHashInput = {
      analysis: input.analysis,
      generatedAt: input.generatedAt,
      model: input.model,
      contractId: input.contractId,
    };
    expect(await hasher.hash(reordered)).toBe(await hasher.hash(input));

    // A different assessment score → different hash (no collision on real change).
    const changed: ReportHashInput = {
      ...input,
      analysis: {
        ...input.analysis,
        assessments: [{ clauseId: 'clause_1', level: 'low', score: 11, rationale: 'fine', recommendation: null }],
      },
    };
    expect(await hasher.hash(changed)).not.toBe(await hasher.hash(input));
  });
});

import type { Brand } from './brand';

// Validated scalar value objects. The brand encodes the invariant; the parser at the
// boundary is the only place that may mint one. After that, the type is trusted.
export type Timestamp = Brand<string, 'IsoDateTime'>;       // ISO-8601, UTC
export type EthereumAddress = Brand<string, 'EthereumAddress'>; // 0x + 40 hex, checksummed
export type TxHash = Brand<string, 'TxHash'>;               // 0x + 64 hex
export type Hash32 = Brand<string, 'Hash32'>;               // 0x + 64 hex (sha256 / keccak256)
export type ChainId = Brand<number, 'ChainId'>;             // e.g. Base Sepolia = 84532
export type RiskScore = Brand<number, 'RiskScore'>;         // integer 0..100, higher = riskier
export type Wei = Brand<bigint, 'Wei'>;                     // smallest unit, never floats
export type AiModelId = Brand<string, 'AiModelId'>;         // pinned model, e.g. claude-sonnet-4-6

// Money is always an exact integer amount in a specific token. No floats, ever.
export interface Money {
  readonly amount: Wei;
  readonly token: EthereumAddress | 'native'; // ERC-20 contract, or native ETH on Base
}

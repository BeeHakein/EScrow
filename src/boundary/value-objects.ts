import type {
  ChainId,
  EthereumAddress,
  Hash32,
  RiskScore,
  Timestamp,
  TxHash,
  Wei,
} from '../domain/shared/primitives';
import { type Result, ok, err } from '../domain/shared/result';

// The ONLY place branded value objects are minted. Each parser validates the invariant
// once, here at the edge; everything inside the domain then trusts the type.
const HEX40 = /^0x[0-9a-fA-F]{40}$/;
const HEX64 = /^0x[0-9a-fA-F]{64}$/;

export function parseEthereumAddress(raw: unknown): Result<EthereumAddress> {
  if (typeof raw !== 'string' || !HEX40.test(raw)) return err(`invalid ethereum address: ${String(raw)}`);
  return ok(raw as EthereumAddress);
}

export function parseHash32(raw: unknown): Result<Hash32> {
  if (typeof raw !== 'string' || !HEX64.test(raw)) return err(`invalid 32-byte hash: ${String(raw)}`);
  return ok(raw as Hash32);
}

export function parseTxHash(raw: unknown): Result<TxHash> {
  if (typeof raw !== 'string' || !HEX64.test(raw)) return err(`invalid tx hash: ${String(raw)}`);
  return ok(raw as TxHash);
}

export function parseTimestamp(raw: unknown): Result<Timestamp> {
  if (typeof raw !== 'string') return err('timestamp must be a string');
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return err(`invalid ISO timestamp: ${raw}`);
  return ok(new Date(ms).toISOString() as Timestamp);
}

export function parseRiskScore(raw: unknown): Result<RiskScore> {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > 100)
    return err(`risk score must be an integer 0..100: ${String(raw)}`);
  return ok(raw as RiskScore);
}

export function parseChainId(raw: unknown): Result<ChainId> {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw <= 0) return err(`invalid chainId: ${String(raw)}`);
  return ok(raw as ChainId);
}

export function parseWei(raw: unknown): Result<Wei> {
  if (typeof raw === 'bigint') return raw >= 0n ? ok(raw as Wei) : err('wei must be >= 0');
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return ok(BigInt(raw) as Wei);
  return err(`invalid wei amount: ${String(raw)}`);
}

import { keccak256, toBytes } from 'viem';
import type { ReportHasher, ReportHashInput } from '../../application/ports/report-hasher';
import type { Hash32 } from '../../domain/shared/primitives';
import { canonicalReportString } from './report-canonical';

// Production report hasher: keccak256 (EVM-native) over the canonical report pre-image.
// This is the digest that gets anchored on Base and signed via EIP-712, so it MUST be keccak256
// to match the on-chain verifier — sha256/Web Crypto would NOT match. Replaces InsecureStubHasher.
// (Upload bytes use sha256 via Sha256DocumentHasher; the two hashes serve different trust
// purposes — keep them separate.) keccak256 returns a 0x-prefixed 32-byte hex string = Hash32.
export class Keccak256ReportHasher implements ReportHasher {
  async hash(input: ReportHashInput): Promise<Hash32> {
    return keccak256(toBytes(canonicalReportString(input))) as Hash32;
  }
}

import type { Hash32 } from '../../domain/shared/primitives';

// Outbound port. Content hash of the original upload bytes — the Contract's tamper evidence.
// Production MUST use sha256 (matching the `contentHash` contract on the domain type); a dev
// stub fakes it deterministically. Distinct from ReportHasher, which keccak256-hashes the
// risk report for on-chain anchoring.
export interface DocumentHasher {
  hash(bytes: Uint8Array): Promise<Hash32>;
}

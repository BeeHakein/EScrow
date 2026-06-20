import type { PartyId } from './shared/ids';
import type { EthereumAddress, Hash32, Timestamp } from './shared/primitives';

// An EIP-712 signature by one party over the RiskReport.reportHash.
export interface PartySignature {
  readonly party: PartyId;
  readonly signer: EthereumAddress;
  readonly signature: `0x${string}`; // 65-byte EIP-712 signature
  readonly signedHash: Hash32; // MUST equal the report's reportHash
  readonly signedAt: Timestamp;
}

// Activation requires BOTH signatures. Modelling them as a required pair makes
// "activated with only one signature" unrepresentable rather than a runtime check.
export interface BothSignatures {
  readonly client: PartySignature;
  readonly freelancer: PartySignature;
}

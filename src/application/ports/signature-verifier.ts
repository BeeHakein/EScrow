import type { EthereumAddress, Hash32 } from '../../domain/shared/primitives';

// Outbound port. Real adapter uses viem's verifyTypedData (EIP-712); a stub fakes the result.
export interface SignatureVerifier {
  verify(input: {
    readonly hash: Hash32;
    readonly signature: `0x${string}`;
    readonly signer: EthereumAddress;
  }): Promise<boolean>;
}

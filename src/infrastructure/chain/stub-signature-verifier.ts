import type { SignatureVerifier } from '../../application/ports/signature-verifier';

// Dev-only stand-in. Returns a fixed verdict so tests can drive both paths.
// Production replaces it with a viem verifyTypedData (EIP-712) adapter.
export class StubSignatureVerifier implements SignatureVerifier {
  constructor(private readonly valid: boolean = true) {}

  async verify(): Promise<boolean> {
    return this.valid;
  }
}

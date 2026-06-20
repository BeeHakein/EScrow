# PROGRESS — single source of truth for "where are we"

Updated at the end of each slice. Re-injected at SessionStart by `context-reinjection.sh`.
On resume after `/clear`: read this file + skim `src/application/` to confirm, then continue at "Next".

## Platform flow (6 steps)
1. Upload contract → clauses — ✅ `application/upload-contract.ts` (+ `DocumentParser`/`DocumentHasher`/`DocumentStore` ports, stubs, in-memory contract repo, `boundary/contract.ts` parsers)
2. AI analysis → risk report — ✅ `application/analyze-contract.ts` (+ stub analyzer, in-memory report repo)
3. Anchor report hash on Base — ✅ `application/anchor-report.ts` (+ stub anchor service)
4. Both parties sign — ✅ `application/sign-report.ts` (+ stub verifier, signature/party repos)
5. Activate escrow (deploy + fund) — ✅ `application/activate-escrow.ts` (+ `EscrowDeployer` port, stub deployer, in-memory milestone repo, pure `domain/milestone-funding.ts`)
6. Milestone-by-milestone release — ✅ `application/release-milestone.ts` (+ `MilestoneReleaseService` port, stub, pure `domain/milestone-transitions.ts`)

## Next
**All 6 flow steps now have application use-cases (stub-backed). The platform skeleton is complete
end-to-end: upload → analyze → anchor → sign → activate(+fund milestones) → release → complete.**

Remaining work is swapping stubs for real adapters behind existing ports (callers don't change).
Suggested order:
1. `git init` first (standing TODO) so each slice can be committed behind the test gate.
2. Hash: `InsecureStubHasher` → keccak256 (viem) for report anchoring; `InsecureStubDocumentHasher` → sha256 for contract contentHash.
3. Chain adapters (anchor/verifier/deployer/release) against deployed `Escrow.sol` / `ReportAnchor.sol` (Foundry).
4. AI: `StubContractAnalyzer` → real Claude analyzer; `StubDocumentParser` → real PDF/DOCX parsing (consult `claude-api` skill, model `claude-sonnet-4-6`).
5. DB: in-memory repos → Prisma adapters.

✅ **Funding gap closed** — `activateEscrow` marks every milestone `pending → funded` from the
`FundingPlan` via the pure `fund` transition (pre-computed before the irreversible deploy).
✅ **Step 1 upload done** — `uploadContract` hashes bytes (tamper evidence), stores them, extracts
clauses via `DocumentParser`, parses each at `boundary/contract.ts`, and persists the Contract.

## Done (foundation)
- Domain types + repository interfaces (`src/domain/`, `src/domain/repositories/`).
- Boundary parsers / value objects (`src/boundary/`) — only place brands are minted.
- Escrow state machine: pure transitions in `domain/escrow-transitions.ts`.
- Milestone status machine: pure transitions in `domain/milestone-transitions.ts` (`fund`/`submit`/`approve`/`release`).
- Verify gate: `npm run typecheck` + `npm test` → currently 45 tests green.
- First real adapter landed: `Sha256DocumentHasher` (Web Crypto) behind the `DocumentHasher` port.

## Still stubbed → real adapters pending
- AI: `StubContractAnalyzer` → real Claude analyzer; `StubDocumentParser` (regex/keyword split) → real PDF/DOCX parsing (consult `claude-api` skill, model `claude-sonnet-4-6`).
- Hash: `InsecureStubHasher` → keccak256 (viem), to match the Solidity verifier. ✅ Contract `contentHash` now has a REAL `Sha256DocumentHasher` (Web Crypto, no deps); `InsecureStubDocumentHasher` kept for deterministic tests only.
- Storage: `InMemoryDocumentStore` → Vercel Blob / S3 adapter (same `DocumentStore` port).
- Chain: stub anchor/verifier/deployer/release → viem + deployed `Escrow.sol` / `ReportAnchor.sol` (Foundry). `StubEscrowDeployer` fakes deploy+fund and `StubMilestoneReleaseService` fakes payout with no real transfer — must never back a real escrow.
- DB: in-memory repos → Prisma adapters.

## Standing setup TODO
- `git init` — version control + commit/test-gate strategy is inert until done.
- Node 26 / npm 11 installed; after `npm install` run `npm rebuild esbuild` once (vitest needs it).

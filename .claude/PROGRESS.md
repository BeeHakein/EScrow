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
1. ✅ `git init` done — slices commit on `feat/*` branches behind the test gate (`main` is protected).
2. ✅ Hash done — report `ReportHasher` now has a REAL `Keccak256ReportHasher` (viem, EVM-native) and
   contract `contentHash` a REAL `Sha256DocumentHasher` (Web Crypto). Stubs kept for deterministic tests.
3. Chain adapters (anchor/verifier/deployer/release) against deployed `Escrow.sol` / `ReportAnchor.sol` (Foundry). ← NEXT
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
- Verify gate: `npm run typecheck` + `npm test` → currently 49 tests green.
- Real adapters landed: `Sha256DocumentHasher` (Web Crypto) behind `DocumentHasher`; `Keccak256ReportHasher` (viem) behind `ReportHasher`. Shared canonical pre-image in `chain/report-canonical.ts`.
- End-to-end acceptance test: `tests/application/full-flow.e2e.test.ts` drives ONE escrow through all 6 use-cases over shared in-memory repos (upload→…→completed), threading the real keccak report hash through anchor + signatures. This is the regression gate every real-adapter swap must keep green.

## Testing cadence (per the QualityInfrastructure blueprint — Pattern D + Prio-1 hooks)
- **Test-first per slice** (Adversarial TDD): write the spec/tests before the adapter; they define what the swap must satisfy. Catches the ~1.75× AI logic-error rate.
- **Test-gate before every commit** (Prio-1 hook, exit 2): never commit on red. Already enforced.
- **Verify the assembled app, not just units** (anti-pattern #7): the e2e flow test is the acceptance gate; for real chain/AI adapters, also exercise via `/run`/`/verify` against a testnet/live API.
- There is no "test at the end" phase — testing is the gate, not a stage.

## Still stubbed → real adapters pending
- AI: `StubContractAnalyzer` → real Claude analyzer; `StubDocumentParser` (regex/keyword split) → real PDF/DOCX parsing (consult `claude-api` skill, model `claude-sonnet-4-6`).
- Hash: ✅ DONE both sides. Report `ReportHasher` → REAL `Keccak256ReportHasher` (viem keccak256, EVM-native, matches the on-chain verifier); contract `contentHash` → REAL `Sha256DocumentHasher` (Web Crypto). `InsecureStubHasher`/`InsecureStubDocumentHasher` kept for deterministic tests only; the stub keccak now shares the real canonical pre-image (`chain/report-canonical.ts`).
- Storage: `InMemoryDocumentStore` → Vercel Blob / S3 adapter (same `DocumentStore` port).
- Chain: stub anchor/verifier/deployer/release → viem + deployed `Escrow.sol` / `ReportAnchor.sol` (Foundry). `StubEscrowDeployer` fakes deploy+fund and `StubMilestoneReleaseService` fakes payout with no real transfer — must never back a real escrow.
- DB: in-memory repos → Prisma adapters.

## Standing setup TODO
- Node 26 / npm 11 installed; after `npm install` run `npm rebuild esbuild` once (vitest needs it).
- `viem` is now a runtime dependency (keccak256 today; chain client for the adapters next).

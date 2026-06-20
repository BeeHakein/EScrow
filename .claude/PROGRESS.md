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
### ✅ DONE: DB / Prisma layer (this slice — branch `feat/prisma-adapters`, stacked on feat/real-adapters)
All 6 repository ports now have **Prisma adapters** in `src/infrastructure/db/prisma/`
(`Prisma{Contract,RiskReport,Escrow,Party,Signature,Milestone}Repository`). Callers (the
use-cases) did NOT change — same port-swap pattern. In-memory repos kept for the application
unit tests. Key decisions (see lessons-learned):
- `prisma/schema.prisma` is **sqlite** (committed) so the gate stays offline/deterministic; models
  are PROVIDER-PORTABLE (no Json columns — sqlite can't; Wei → base-10 TEXT string, Timestamp → ISO
  TEXT, the EscrowState/MilestoneStatus discriminated unions → canonical JSON in a TEXT column).
  Prod swap = flip datasource `provider` to "postgresql" + re-migrate; models unchanged (`.env.example`).
- Flat one-to-many lists are NORMALIZED relations (Contract→Clause, RiskReport→ClauseRisk, replaced
  wholesale on save); the heterogeneous unions are serialized. `src/boundary/db-row.ts` re-parses every
  row back into domain types (DB is OUTSIDE the trust boundary) — throws on corruption, never leaks Prisma types.
- PrismaClient injected via constructor (inject-the-dependency, like the Claude/extractor adapters);
  `prisma/client.ts` is the app singleton, tests inject a temp-sqlite client.
- Tests: each test file gets a throwaway temp sqlite DB with the COMMITTED migration applied via
  `prisma migrate deploy` (`tests/infrastructure/prisma/test-db.ts`). Fully offline. 37 new tests.

### ▶ DECIDED NEXT SLICE: pick one (DB no longer blocks anything)
- **Claude-assisted clause segmentation** (UNBLOCKED, no creds): replace the naive blank-line
  `segmentClauses` heuristic with an LLM-assisted segmenter behind the existing `DocumentParser`/
  `TextExtractor` seam. Same inject-a-fake-client offline test pattern as `ClaudeContractAnalyzer`.
- **Chain viem adapters** (credential-gated): bind anchor/verifier/deployer/release to the Foundry
  `Escrow.sol`/`ReportAnchor.sol` — needs a Base Sepolia RPC URL + funded test key (`.env.example`).
- **Storage adapter** (credential-gated): `InMemoryDocumentStore` → Vercel Blob / S3.
Gate stays BOTH halves: `npm run typecheck` + `npm test` (99 now) AND `forge test` (13).
Context: branch `feat/real-adapters` is open as **PR #1** (BeeHakein/EScrow); this DB slice is on
`feat/prisma-adapters` stacked on it. Push + open a follow-up PR (or rebase onto main once #1 merges).

---
**All 6 flow steps have application use-cases; real adapters landed for hashing + AI + document
parsing + Foundry contracts (see below). The two credential-gated slices (chain adapters, analyzer
live-API verify) wait on a `.env` — see `.env.example`.**

Adapter-swap history / remaining (callers never change):
1. ✅ `git init` done — slices commit on `feat/*` branches behind the test gate (`main` is protected).
2. ✅ Hash done — report `ReportHasher` now has a REAL `Keccak256ReportHasher` (viem, EVM-native) and
   contract `contentHash` a REAL `Sha256DocumentHasher` (Web Crypto). Stubs kept for deterministic tests.
3. ✅ Foundry contracts scaffolded — `contracts/src/{Escrow,ReportAnchor}.sol` + forge tests (13 passing,
   `forge test`). Compile clean on solc 0.8.24. ⬜ STILL TODO: the viem CHAIN ADAPTERS (anchor/verifier/
   deployer/release) that bind to these — needs a Base Sepolia RPC URL + a funded test key. ← NEXT once a
   testnet account is available; the contracts they target now exist.
4. AI: ✅ analyzer done — `ClaudeContractAnalyzer` (real Claude, structured outputs, model `claude-sonnet-4-6`)
   replaces `StubContractAnalyzer` behind the port. ⚠️ analyzer unit-tested with a FAKE client only —
   not yet run against the live API (`/verify` + API key needed; anti-pattern #7).
   ✅ parser done — `ExtractingDocumentParser` (+ `TextExtractor` port + `LibraryTextExtractor` via
   unpdf/mammoth) replaces `StubDocumentParser`. Extraction VERIFIED end-to-end on real PDF+DOCX bytes.
   ⚠️ segmentation is still the naive blank-line heuristic (`segmentClauses`) — real docs need better
   (Claude-assisted) segmentation; swappable behind the port. ← improving segmentation is a good NEXT slice.
5. ✅ DB done — in-memory repos → Prisma adapters (sqlite, provider-portable; `src/infrastructure/db/prisma/`).
   In-memory repos kept for application unit tests. See the DONE block under "## Next".

✅ **Funding gap closed** — `activateEscrow` marks every milestone `pending → funded` from the
`FundingPlan` via the pure `fund` transition (pre-computed before the irreversible deploy).
✅ **Step 1 upload done** — `uploadContract` hashes bytes (tamper evidence), stores them, extracts
clauses via `DocumentParser`, parses each at `boundary/contract.ts`, and persists the Contract.

## Done (foundation)
- Domain types + repository interfaces (`src/domain/`, `src/domain/repositories/`).
- Boundary parsers / value objects (`src/boundary/`) — only place brands are minted.
- Escrow state machine: pure transitions in `domain/escrow-transitions.ts`.
- Milestone status machine: pure transitions in `domain/milestone-transitions.ts` (`fund`/`submit`/`approve`/`release`).
- Verify gate: `npm run typecheck` + `npm test` (99 green) AND `forge test` in `contracts/` (13 green). Run forge via `export PATH="$HOME/.foundry/bin:$PATH"`.
- Real adapters landed: `Sha256DocumentHasher` (Web Crypto) behind `DocumentHasher`; `Keccak256ReportHasher` (viem) behind `ReportHasher`. Shared canonical pre-image in `chain/report-canonical.ts`.
- End-to-end acceptance test: `tests/application/full-flow.e2e.test.ts` drives ONE escrow through all 6 use-cases over shared in-memory repos (upload→…→completed), threading the real keccak report hash through anchor + signatures. This is the regression gate every real-adapter swap must keep green.

## Testing cadence (per the QualityInfrastructure blueprint — Pattern D + Prio-1 hooks)
- **Test-first per slice** (Adversarial TDD): write the spec/tests before the adapter; they define what the swap must satisfy. Catches the ~1.75× AI logic-error rate.
- **Test-gate before every commit** (Prio-1 hook, exit 2): never commit on red. Already enforced.
- **Verify the assembled app, not just units** (anti-pattern #7): the e2e flow test is the acceptance gate; for real chain/AI adapters, also exercise via `/run`/`/verify` against a testnet/live API.
- There is no "test at the end" phase — testing is the gate, not a stage.

## Still stubbed → real adapters pending
- AI: ✅ `ClaudeContractAnalyzer` (real Claude, `@anthropic-ai/sdk`, structured outputs / `output_config.format`, model `claude-sonnet-4-6`) replaces `StubContractAnalyzer` behind the port; client injected so it's unit-testable offline (stub kept for deterministic tests).
- Document parsing: ✅ `ExtractingDocumentParser` (real) = injected `TextExtractor` (`LibraryTextExtractor`: unpdf for PDF, mammoth for DOCX) + pure shared `segmentClauses`. Replaces `StubDocumentParser` behind the `DocumentParser` port; stub kept (now also uses `segmentClauses`) for deterministic text fixtures. Extraction verified on real PDF+DOCX; segmentation is still a naive blank-line heuristic.
- Hash: ✅ DONE both sides. Report `ReportHasher` → REAL `Keccak256ReportHasher` (viem keccak256, EVM-native, matches the on-chain verifier); contract `contentHash` → REAL `Sha256DocumentHasher` (Web Crypto). `InsecureStubHasher`/`InsecureStubDocumentHasher` kept for deterministic tests only; the stub keccak now shares the real canonical pre-image (`chain/report-canonical.ts`).
- Storage: `InMemoryDocumentStore` → Vercel Blob / S3 adapter (same `DocumentStore` port).
- Chain: ✅ Solidity contracts now exist — `contracts/src/Escrow.sol` (ERC-20 milestone escrow: fund + strict in-order release + auto-complete; releaser = platform/deployer; dispute/refund are TODO) and `contracts/src/ReportAnchor.sol` (once-only keccak256 hash registry), both with passing forge tests. ⬜ The stub anchor/verifier/deployer/release services still need REAL viem adapters that bind to these contracts (deploy/fund/anchor/release + EIP-712 verify) — needs a Base Sepolia RPC + funded key. `StubEscrowDeployer`/`StubMilestoneReleaseService` fake payouts with no real transfer — must never back a real escrow.
- DB: ✅ DONE — Prisma adapters behind all 6 ports (sqlite/provider-portable). In-memory repos kept
  for fast application unit tests; the Prisma adapters have their own round-trip tests against temp sqlite.

## Standing setup TODO
- Node 26 / npm 11 installed; after `npm install` run `npm rebuild esbuild` once (vitest needs it).
- `viem` is now a runtime dependency (keccak256 today; chain client for the adapters next).
- Prisma: after `npm install`, run `npx prisma generate` once (generates the client; downloads the
  engine — needs network once). Runtime deps now: viem, @anthropic-ai/sdk, mammoth, unpdf, @prisma/client.
- DB env: `DATABASE_URL` defaults to `file:./dev.db` (sqlite). `prisma migrate dev` to evolve the schema.

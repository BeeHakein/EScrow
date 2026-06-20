# Lessons Learned

Cumulative, cross-session memory. Appended automatically by the `lessons-learned-capture` hook (Stop/SessionEnd) and re-injected at session start by `context-reinjection`. Add manual entries too.

**Entry format:** one bullet per lesson — `- [category] lesson (what to do next time)`.
**Categories:** `architecture, types, testing, tooling, git, context, performance, security, process`.

Keep entries terse and actionable. Prune entries that become obsolete or are promoted into CLAUDE.md.

---

## How this file is maintained
- Auto-capture: a Haiku pass scans each session's transcript for corrections, failed attempts, and repeated mistakes, then appends a dated block below.
- Manual: add a lesson the moment a correction recurs.
- Promotion: a lesson that always applies belongs in `CLAUDE.md`; move it there and delete it here.

---

## Lessons

<!-- Auto-captured and manual entries are appended below, newest last. -->

### 2026-06-18 — bootstrap + first slice
- [tooling] Match destructive-command patterns precisely. The first security-firewall blocked any absolute path (`rm -rf /tmp/x`) because `*"rm -rf /"*` is too broad; anchor on root exactly (`rm -rf /` at end/space, `/*`, `~`, `$HOME`). Fixed and re-tested.
- [process] When testing a hook that blocks dangerous strings, feed payloads from files piped via stdin — putting the literal string in the test command trips the live hook and blocks your own test run.
- [tooling] Node toolchain now installed (Homebrew node 26, npm 11). Verify gate: `npm run typecheck && npm test`. Note: vitest's esbuild postinstall is gated by npm allow-scripts — run `npm rebuild esbuild` once after install or tests won't run.
- [architecture] AI output is untrusted: model it as a `Raw*` string/number DTO and parse it into the domain at `src/boundary/` before it becomes a `RiskReport`. The Claude API sits outside the trust boundary.
- [architecture] Keep development API-free behind ports: `ContractAnalyzer` (stub) + `ReportHasher` (dev stub) + in-memory repos. Only the analyzer slice needs `ANTHROPIC_API_KEY`; swap real adapters in later without touching callers.
- [security] Report hashing must be keccak256 in production to match the Solidity verifier. The current `InsecureStubHasher` is dev-only and must never anchor a real escrow.
- [process] Inject clock/id/model into use-cases (`now()`, `newReportId()`) instead of importing them — keeps use-cases pure and testable without DB/API/wall-clock.
- [tooling] The lessons-capture hook recorded harness errors ("Prompt is too long") as lessons. Refine the capture prompt to ignore harness/system errors and assistant summaries — capture only user corrections, failed attempts, and repeated patterns. (Noise entries pruned this session.)
- [reference] Pinned AI model id: `claude-sonnet-4-6` (confirmed from environment). Consult the `claude-api` skill when wiring the real analyzer.

### 2026-06-18 — escrow lifecycle slices (steps 3–4)
- [tooling] ROOT CAUSE of the recurring "Prompt is too long" noise: the capture hook piped the WHOLE transcript into `claude -p`, which itself blew the 200k limit; the error string was then appended as a "lesson." Fixed — hook now `tail -c 120000` the transcript and keeps only `^- \[` bullet lines. Manually prune any pre-fix noise.
- [architecture] Escrow lifecycle pattern (now repeated 2×, treat as the standard): pure transition fns in `domain/escrow-transitions.ts` guard the source state and return `Result`; use-cases wire ports + stubs (`ReportAnchorService`, `SignatureVerifier`); transitions never do I/O.
- [architecture] Two-party signatures are collected in a `SignatureRepository`, NOT in the escrow state — keeps the discriminated union clean (no partial-signature variant); the use-case builds `BothSignatures` and transitions only when both are present.
- [process] Verified slices end-to-end: `npm run typecheck` clean + 13 vitest tests green. The stub-adapter + in-memory-repo approach keeps everything testable with no API/chain/DB.
- [context] One long session repeatedly hit ~216k tokens (system prompt + tools + accumulated history). Confirms the blueprint: commit + `/clear` between slices, start fresh next session — state is already externalized to files.
- [git] Repo still NOT under version control (`git init` pending) — the branch/commit strategy and test-gate-on-commit are inert until then. Do this early next session.

### 2026-06-19 — step 6 milestone release (flow complete)
- [architecture] Milestone status machine mirrors the escrow one: pure `submit`/`approve`/`release` transitions in `domain/milestone-transitions.ts` guard the source status and return `Result`; the `releaseMilestone` use-case wires the `MilestoneReleaseService` port (+ stub) and never does I/O in the domain.
- [architecture] On-chain payout MUST precede the `approved -> released` transition — a failed transfer must never leave a milestone marked released. Same ordering rule as deploy-and-fund in step 5.
- [architecture] In-order release is enforced in the use-case (every earlier milestone must be `released`), and escrow completion is derived: when all milestones are released, `complete()` the escrow (`active -> completed`). The use-case returns both the released milestone and the (possibly completed) escrow.
- [gap] Nothing yet moves a milestone `pending -> funded`. Activation (step 5) should mark milestones funded from the `FundingPlan`; a pure `fund` transition is the natural addition when that slice is taken. Tests currently construct milestones in the needed status directly (matches the existing test style).
- [process] Verify gate green: `npm run typecheck` clean + 30 vitest tests (was 20). All 6 flow steps now have stub-backed use-cases — next work is swapping stubs for real adapters behind existing ports.

### 2026-06-20 — close milestone funding gap
- [architecture] Added pure `fund` (pending -> funded) to `domain/milestone-transitions.ts`. The `funded` status carries no data (the amount lives on the Milestone), so `fund(m)` takes no timestamp — unlike submit/approve/release.
- [architecture] `activateEscrow` now drives milestones `pending -> funded` from the `FundingPlan`. Same irreversibility rule as elsewhere: pre-compute the funded milestones PURELY before the on-chain deploy, so an invalid (non-pending) milestone fails without touching the chain; persist funded milestones after the escrow saves.
- [process] Gate green: `npm run typecheck` clean + 32 vitest tests (was 30). Full milestone chain `pending → funded → submitted → approved → released` is now reachable end-to-end via activate + release use-cases.

### 2026-06-20 — step 1 upload contract use-case
- [architecture] Upload ingests untrusted input from TWO edges, both parsed in `boundary/contract.ts`: the user's `RawUploadCommand` (→ `parseUploadCommand`, validates title/format/uploadedBy/bytes) and the `DocumentParser`'s `RawClause[]` (→ `parseClause`, validates text + closed-set category, normalizes heading). The use-case trusts the parsed types thereafter.
- [architecture] Three separate outbound ports for one upload — `DocumentHasher` (sha256 contentHash = tamper evidence), `DocumentStore` (bytes → opaque storageKey), `DocumentParser` (bytes → clauses). Kept distinct on purpose (don't complect): the hash is a domain value on Contract, the key is just an infra pointer.
- [architecture] Two distinct hashers now exist: `ReportHasher`/`InsecureStubHasher` = keccak256 (on-chain anchor/EIP-712), `DocumentHasher`/`InsecureStubDocumentHasher` = sha256 (upload bytes). Don't conflate them — different algorithms for different trust purposes.
- [tooling] `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` are ON. Iterate with `array.entries()` (not `arr[i]`) to avoid `T | undefined`, and index byte arrays as `bytes[i] as number` inside hashers.
- [process] Was missing an in-memory ContractRepository (every other aggregate had one) — added `InMemoryContractRepository`. When adding a use-case, check the repo adapter exists.
- [process] Gate green: `npm run typecheck` clean + 43 vitest tests (was 32). All 6 flow steps now have stub-backed use-cases; remaining work is real adapters behind existing ports.

### 2026-06-20 — first real adapter: sha256 document hasher
- [architecture] Port-swap pattern proven: `Sha256DocumentHasher` (Web Crypto, no deps) drops in behind the existing `DocumentHasher` port with zero caller changes. Stub kept for deterministic tests; production wiring picks the real one.
- [tooling] TS 5.7+ types `Uint8Array` as generic over its buffer (`ArrayBufferLike`), so passing a plain `Uint8Array` to `crypto.subtle.digest` fails typecheck (could be SharedArrayBuffer-backed; BufferSource wants ArrayBuffer). Fix: hash an ArrayBuffer-backed copy (`new Uint8Array(len); buf.set(bytes)`) — no cast needed. NB: `npm test` passed while `npm run typecheck` failed — ALWAYS run both halves of the gate.
- [process] Gate green: typecheck clean + 45 vitest tests (was 43). Real crypto verified against the known sha256("abc") vector.

### 2026-06-20 — real keccak256 report hasher (chain hash side done)
- [architecture] `Keccak256ReportHasher` (viem) drops in behind the `ReportHasher` port — zero caller changes (analyze-contract unchanged). Same port-swap pattern as `Sha256DocumentHasher`.
- [architecture] Extracted the canonical pre-image into `chain/report-canonical.ts` (`canonicalReportString`). BOTH the real keccak hasher and the dev `InsecureStubHasher` hash THIS exact string — only the digest fn differs. Guarantees tests (stub) and production (keccak) canonicalize identically; a report won't hash to one thing in tests and another in prod.
- [security] keccak256 ≠ sha256 ≠ SHA3-256: report anchoring MUST be keccak256 to match the EVM/EIP-712 verifier, and keccak256 is NOT in Web Crypto — hence a real dep (viem) here, unlike the zero-dep sha256 document hasher. Don't conflate the two hashes (different algos, different trust purposes).
- [tooling] `viem` added as the first runtime dependency. `keccak256(toBytes(str))` returns `0x${string}` matching the `Hash32` brand shape (cast at the boundary). Verified against the known Ethereum vector keccak256("abc")=0x4e03657a… and a pinned digest of a fixed canonical input.
- [process] Gate green: typecheck clean + 48 vitest tests (was 45). `git init` was already done (stale TODO); `main` is protected so work landed on `feat/keccak256-report-hasher`.

### 2026-06-20 — end-to-end acceptance test for the composed flow
- [testing] Per-slice unit tests covered each use-case in isolation but NOTHING tested the six steps composed over shared repos. Added `tests/application/full-flow.e2e.test.ts`: one escrow, all 6 use-cases, one set of in-memory repos. Pins that they integrate, not just that each works alone.
- [testing] The e2e threads the REAL `Keccak256ReportHasher` output from analyze (step 2) → anchor (step 3) → both signatures (step 4): the signed hash must equal the anchored hash must equal the keccak digest. This catches hash-provenance breaks no unit test sees. Capture the dynamic `report.reportHash` and reuse it as the signatures' `signedHash` (don't hardcode).
- [testing] Bootstrapping note: there is no "create escrow" use-case among the 6 steps, so the e2e creates the escrow via the `createEscrow` domain transition; likewise milestone submit/approve (no use-cases) are driven via domain transitions. Only the 6 real flow steps go through use-cases.
- [process] Plan's testing cadence (QualityInfrastructure Pattern D + Prio-1 hooks): test-first per slice, test-gate before every commit, verify the assembled app (anti-pattern #7) — testing is the gate, not an end phase. Recorded in PROGRESS.md. Gate green: typecheck clean + 49 vitest tests (was 48).

### 2026-06-20 — real Claude contract analyzer (AI adapter)
- [architecture] `ClaudeContractAnalyzer` (`@anthropic-ai/sdk`) drops in behind the `ContractAnalyzer` port — zero caller change to `analyzeContract`. Uses STRUCTURED OUTPUTS (`output_config.format` json_schema) so the model is constrained to emit the `RawRiskAnalysis` shape; the AI is still outside the trust boundary, so `boundary/risk-report.ts` re-validates every field (ranges, clause-id cross-checks) regardless. Consulted the `claude-api` skill first (required when Claude/Anthropic is named).
- [architecture] Inject the `Anthropic` client via constructor (not constructed inside) so the adapter is unit-testable offline with a fake client and the use-case stays pure. Model defaulted to the project pin `claude-sonnet-4-6` (CLAUDE.md) but overridable. This is the project's explicit choice, not a cost downgrade — the skill defaults to opus only absent an explicit pin.
- [tooling] SDK 0.105.0 types `output_config.format` (json_schema), adaptive thinking, and `claude-sonnet-4-6` on the non-beta `messages.create` — no beta namespace or casts needed for the request. Skip leading `thinking` blocks and read the JSON from the `text` block (`b.type==='text'`).
- [tooling] `exactOptionalPropertyTypes` bites in tests too: a fake content block `{type:'thinking', text: undefined}` fails typecheck — OMIT the optional key (`{type:'thinking'}`) instead of setting it to `undefined`. (npm test passed while typecheck failed — run BOTH halves of the gate, again.)
- [testing] Adapter is verified for wiring + response parsing with a fake client, but NOT against the live API (no key; would be a billed network call). Per anti-pattern #7 ("never ship AI code unverified"), a `/verify` / integration pass against real Claude is the outstanding step before production use. Recorded in PROGRESS.
- [process] Gate green: typecheck clean + 54 vitest tests (was 49). `@anthropic-ai/sdk` added as the second runtime dep (after viem).

### 2026-06-20 — real document parser (PDF/DOCX) + dead-category bugfix
- [architecture] Split the parser along its real seam (don't complect): a new `TextExtractor` port isolates format-specific, library-backed extraction (hard to test offline) from pure clause segmentation (`segmentClauses`, fully testable). `ExtractingDocumentParser` = injected `TextExtractor` + `segmentClauses`; `LibraryTextExtractor` does unpdf (PDF) / mammoth (DOCX). Same inject-the-dependency pattern as the Claude analyzer — orchestration is unit-tested with a fake extractor, the library code stays a thin swappable adapter.
- [architecture] Extracted `segmentClauses` into a shared module so `StubDocumentParser` and the real parser segment IDENTICALLY — only the text SOURCE differs (stub = UTF-8 decode of bytes; real = library extraction). Stub kept for deterministic plain-text fixtures.
- [testing] Verified the library extraction path END-TO-END on real binary files: generated a genuine `.docx` (macOS `textutil -convert docx`) and `.pdf` (`cupsfilter`), ran mammoth/unpdf on the bytes — both returned the text. Throwaway check (platform-tool + binary deps), NOT a committed test — committed tests stay deterministic/offline. So unlike the analyzer, the parser has no live-dependency verify gap.
- [bug] The stub's category regex `/\b(terminat|cancel)\b/` had a trailing `\b` that can NEVER match "terminate"/"termination" (word continues past "terminat") — the `termination` category was dead. Fixed to `/\b(terminat|cancel)/` (prefix match) while extracting the logic. No existing test encoded the buggy behavior (upload uses payment/liability, e2e uses payment/scope), so it was a safe Make-it-Right fix.
- [limitation] Real-world segmentation: PDFs/DOCX rarely have blank lines between clauses, so the blank-line heuristic is weak on real documents. Known future improvement (Claude-assisted segmentation) — the `TextExtractor`/`DocumentParser` ports make it swappable without touching callers.
- [process] Gate green: typecheck clean + 62 vitest tests (was 54). Added `mammoth` + `unpdf` runtime deps (now: viem, @anthropic-ai/sdk, mammoth, unpdf).

### 2026-06-20 — Foundry contracts scaffolded (Escrow + ReportAnchor)
- [architecture] On-chain contracts are the source of truth for FUNDS only; the platform DB keeps the richer state machine (submitted/approved) off-chain. `Escrow.sol` = ERC-20 milestone escrow: `fund()` pulls `total` via transferFrom, `release(index)` pays the freelancer strictly in order and auto-emits `Completed`. The in-order guard is `index != releasedCount` (releasedCount IS the next expected index) — a better data structure replacing a scan over earlier milestones (eliminate special cases). Mirrors the `EscrowDeployer`/`MilestoneReleaseService` ports and the off-chain `release-milestone` in-order rule.
- [architecture] Checks-effects-interactions throughout: `funded=true` before transferFrom; `released[i]=true`+increment before transfer — reentrancy-safe, and a failed transfer reverts the release (same ordering invariant as the off-chain use-cases: payout precedes the released transition). `ReportAnchor.anchor()` is once-only + rejects the zero hash; report hash MUST be keccak256 to match `Keccak256ReportHasher`. Dispute/refund deliberately left as TODO (scaffold scope).
- [tooling] Foundry wasn't installed; installed via `curl -L https://foundry.paradigm.xyz | bash` then `foundryup` (forge 1.7.1). Run forge with `export PATH="$HOME/.foundry/bin:$PATH"`. `forge install` flag `--no-commit` is GONE in 1.7 — plain `forge install foundry-rs/forge-std` adds it as a git submodule (`.gitmodules` + `contracts/lib/forge-std` gitlink committed; contents are not). Nested Foundry project lives in `contracts/` with its own `foundry.toml` (src/test/out under it); `.gitignore` already excludes `contracts/{out,cache,broadcast}`.
- [process] Verified, not shipped blind: contracts compile (solc 0.8.24) and 13 forge tests pass (`forge test`). The project gate is now BOTH halves: `npm run typecheck` + `npm test` (62) AND `forge test` (13). JS gate unaffected (tsc only includes src/tests; .sol ignored).
- [process] Next chain slice = real viem adapters binding to these contracts; needs a Base Sepolia RPC + funded key (external prerequisite), so it stopped here.

### 2026-06-20 — Claude-assisted clause segmentation (AI adapter)
- [architecture] Split segmentation onto its own seam: new `ClauseSegmenter` port (`segment(text) → Promise<RawClause[]>`), distinct from `TextExtractor` (bytes → text). `ExtractingDocumentParser` now injects BOTH — orchestration is unit-tested offline with a fake extractor + fake segmenter, and the segmentation STRATEGY swaps independently of the format libraries. Same inject-the-dependency pattern as `ClaudeContractAnalyzer`.
- [architecture] Two segmenters behind the port: `HeuristicClauseSegmenter` (wraps the pure `segmentClauses` blank-line heuristic, async to satisfy the port) for deterministic offline tests, and `ClaudeClauseSegmenter` (real Claude, `@anthropic-ai/sdk`, structured outputs via `output_config.format`) for real docs that lack blank lines between clauses. Stub parser keeps using `segmentClauses` directly for plain-text fixtures.
- [architecture] The AI is still OUTSIDE the trust boundary: structured outputs constrain `category` to the closed set, but `boundary/contract.ts` (parseClause) re-validates every clause regardless. The segmenter returns untrusted `RawClause[]`.
- [process] Consulted the `claude-api` skill first (required when Claude/Anthropic is named). Model defaulted to the project pin `claude-sonnet-4-6` (CLAUDE.md), overridable — same explicit choice as the analyzer, not a cost downgrade. Segmenter verified for wiring + parsing with a fake client; live-API `/verify` still outstanding (anti-pattern #7), same gap as the analyzer.
- [process] Gate green: typecheck clean + 68 vitest (was 62) AND 13 forge. On branch `feat/claude-segmentation`, a sibling of the DB/Prisma branch — both off `feat/real-adapters` (PR #1).

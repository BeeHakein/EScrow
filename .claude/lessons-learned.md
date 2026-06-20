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

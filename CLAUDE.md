# Project — Working Agreement

> The human defines the contract. The machine fills in the implementation.

## Core Rules (Software Principles)
- Types before code: define all data models and signatures before writing logic.
- Don't complect: keep Domain / Repository / Service / API separate — one file, one truth.
- Make illegal states unrepresentable: Value Objects at the boundary, no scattered validation.
- Parse at the boundary: validate once at the system edge, then trust the types.
- Immutability by default: frozen dataclasses, frozenset, replace() — no hidden mutation.
- Eliminate special cases, don't manage them: a better data structure beats more if-statements.
- Make it Work → Right → Fast, sequentially. Never optimize prematurely.

## Development Order
1. Domain types  2. Repository interface  3. Simplest impl that works  4. Clean separation + parse at boundary  5. Measure → optimize.

## Context Discipline
- /compact at 50% context, /clear at 70%. Externalize state to files; never accumulate in-session.
- Cycle Commit → /clear → next task. Prefer fresh context over long sessions.

## Workflow
- Never commit with failing tests; the test gate must pass first.
- After every correction, update this file or .claude/lessons-learned.md.
- Default to Sonnet; use Opus only for architecture, multi-file refactors, security reviews.
- Never ship AI code unverified — prefer tests as real quality gates.

## Stack & Commands
- Next.js+TS · Claude API (claude-sonnet-4-6) · Base + Solidity/Foundry · Postgres/Prisma · NextAuth · RainbowKit/Wagmi · Vercel.
- Layers: domain (pure types) ← application ← app/api; infrastructure implements domain ports; parse external input in boundary/. Build `npm run build` · Test `npm test` + `forge test` · Lint `npm run lint` · DB `prisma migrate dev`.

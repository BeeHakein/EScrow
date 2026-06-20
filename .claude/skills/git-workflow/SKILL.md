---
name: git-workflow
description: Use for branching, worktrees, commits, and PRs (keywords branch, worktree, commit, PR, merge). Defines this project's git strategy and conventions.
---

# Git Workflow

Full strategy: `.claude/git-strategy.md`. Quick reference below.

## Branching
- `main` — always releasable, protected (no direct pushes, no force-push).
- `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `refactor/<slug>` — short-lived, one task each.
- Branch per task; merge via PR; delete after merge. Cycle: branch → commit → PR → /clear → next task.

## Worktrees (parallel tasks)
- `git worktree add ../wt-<slug> -b feat/<slug>` to isolate parallel work without stashing.
- Remove with `git worktree remove ../wt-<slug>` when merged.

## Commit conventions (Conventional Commits)
- Format: `<type>(<scope>): <subject>` — imperative, ≤72 chars, no trailing period.
- Types: `feat, fix, refactor, test, docs, chore, perf, build, ci`.
- One logical change per commit. Body explains *why*, not *what*.
- The test-gate hook runs tests before every commit; commit only with green tests.

## PRs
- Small and focused; describe intent + verification done.
- Squash-merge to keep `main` history linear.

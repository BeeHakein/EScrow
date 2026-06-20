# Git Strategy

Canonical reference for branching, worktrees, and commit conventions. The `git-workflow` skill links here.

## Branching model (trunk-based, short-lived branches)
- `main` is always releasable and **protected**: no direct pushes, no force-push (enforced by `.claude/hooks/security-firewall.sh`).
- One branch per task, named `<type>/<slug>`:
  - `feat/<slug>` — new functionality
  - `fix/<slug>` — bug fix
  - `refactor/<slug>` — behavior-preserving change
  - `chore/<slug>` — tooling, deps, config
  - `docs/<slug>`, `test/<slug>`, `perf/<slug>`
- Branches are short-lived. Merge via PR, then delete. Rebase on `main` instead of long-running merges.
- Workflow cycle (matches the Fresh-Context principle): **branch → commit → PR → /clear → next task**.

## Worktrees (for parallel tasks)
```sh
git worktree add ../wt-<slug> -b feat/<slug>   # isolated checkout, no stashing
git worktree list
git worktree remove ../wt-<slug>               # after merge
```
Use a separate worktree per concurrently active task so parallel work never collides.

## Commit conventions — Conventional Commits
- Subject: `<type>(<scope>): <subject>` — imperative mood, ≤72 chars, no trailing period.
- Allowed types: `feat, fix, refactor, test, docs, chore, perf, build, ci`.
- One logical change per commit. The body explains **why**, not what.
- Breaking change: add `!` after type/scope (`feat!:`) and a `BREAKING CHANGE:` footer.
- Reference issues in the footer: `Refs: #123`.

Examples:
```
feat(auth): add token refresh at the session boundary
fix(repo): make UserRepository.get return Optional instead of raising
refactor(domain): freeze Order dataclass and drop setter
```

## Quality gates
- The **test-gate** hook runs the project's tests before every `git commit`; commit only with green tests (`--no-verify` bypasses, use sparingly).
- A commit message template lives at `.gitmessage.txt`. Enable it with:
  ```sh
  git config commit.template .gitmessage.txt
  ```

## PRs
- Keep PRs small and single-purpose; state intent + verification performed.
- **Squash-merge** to keep `main` linear and each PR atomic.

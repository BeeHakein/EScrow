---
name: subagent-orchestration
description: Use when delegating work to parallel subagents, fanning out tasks, or coordinating multiple agents (keywords parallel, subagent, delegation, fan-out).
---

# Subagent Orchestration

Delegate to keep the main context lean — a subagent returns only its conclusion, not the files it read.

## Patterns
- **Lead–Specialist:** main agent plans; specialists each own one bounded sub-task. Default for most work.
- **Master–Clone:** N identical agents over a work-list (one file each). Use for mechanical sweeps/migrations.
- **3-Agent Adversarial (see `tdd-workflow`):** Spec (read-only) → Codegen (edit src/tests) → Review (read-only, veto).

## Rules
- Up to ~10 parallel subagents; launch independent ones in a single batch so they run concurrently.
- Give each subagent a narrow scope, the exact files, and the expected return shape.
- Read-only agents for analysis/review; edit-capable agents constrained to specific dirs.
- Use cheaper models (Haiku) for mechanical subtasks; Opus only for architecture/security.
- Never spawn a fleet that mutates the same files in parallel without worktree isolation.

## When NOT to
- A single-fact lookup you can do directly — don't delegate.
- Tasks with tight sequential dependencies — run them in order, not in parallel.

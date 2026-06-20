---
name: hook-patterns
description: Use when writing, debugging, or extending Claude Code hooks, automations, or quality gates. Covers hook events, exit-code semantics, the stdin JSON contract, and anti-patterns.
---

# Hook Patterns

Determinism principle: anything that *must* happen (format, tests, security, commit-blocking) belongs in a hook, not in a probabilistic instruction.

## Events → use
- `PreToolUse` — inspect/block a tool call before it runs (security, test-gate, permission auto-grant).
- `PostToolUse` — react after a tool ran (auto-format, semantic review).
- `SessionStart` — inject context (re-inject rules after compaction).
- `Stop` / `SessionEnd` — capture lessons, verify tasks done.
- `UserPromptSubmit` — classify/route the incoming prompt.

## Exit codes
- `0` — success. stdout is injected as context for `SessionStart`/`UserPromptSubmit`.
- `2` — **block** the action; stderr is shown to Claude as the reason.
- other — non-blocking error (logged).

## stdin contract
Hooks receive JSON on stdin. Common fields: `tool_name`, `tool_input.command` (Bash), `tool_input.file_path` (Write/Edit), `transcript_path` (Stop). Parse with `python3 -c 'import json,sys; ...'`.

## Permission decisions
A `PreToolUse` hook may print JSON: `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow|deny|ask","permissionDecisionReason":"..."}}`.

## Anti-patterns
- Never let a non-critical hook exit 2 (it blocks work) — auto-format must always exit 0.
- Never assume a tool exists — guard with `command -v`.
- Keep hooks fast and side-effect-light; heavy LLM calls only on Stop/SessionStart.
- Reference scripts via `$CLAUDE_PROJECT_DIR/.claude/hooks/...` in settings.json.

This project's live hooks: `.claude/hooks/` (wired in `.claude/settings.json`).

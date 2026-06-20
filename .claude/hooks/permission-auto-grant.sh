#!/usr/bin/env bash
# Prio 2 — Permission-Auto-Grant (PreToolUse: Bash)
# Auto-approves safe, read-only / known-good commands so they skip the prompt. Exit 0.
set -uo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null || true)
trimmed=$(printf '%s' "$cmd" | sed -e 's/^[[:space:]]*//')

allow() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"%s"}}\n' "$1"
  exit 0
}

case "$trimmed" in
  "git status"*|"git diff"*|"git log"*|"git branch"*|"git show"*|"git remote"*) allow "safe read-only git" ;;
  "npm test"*|"npm run test"*|"pytest"*|"go test"*|"cargo test"*)               allow "test command" ;;
  "prettier "*|"npx prettier"*|"gofmt "*|"ruff "*|"black "*|"rustfmt "*)         allow "formatter" ;;
  "ls"|"ls "*|"pwd"|"cat "*|"echo "*|"which "*|"head "*|"tail "*|"wc "*)         allow "safe read-only shell" ;;
esac
exit 0

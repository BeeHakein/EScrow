#!/usr/bin/env bash
# Prio 1 — Test-Gate before commit (PreToolUse: Bash)
# If the command is a git commit, run the project's tests; block (exit 2) on failure.
set -uo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null || true)

# Only gate git commits.
case "$cmd" in *"git commit"*) ;; *) exit 0 ;; esac
# Honor explicit bypass.
case "$cmd" in *"--no-verify"*) exit 0 ;; esac

cd "${CLAUDE_PROJECT_DIR:-$PWD}" || exit 0
run() { echo "test-gate: running: $*" >&2; "$@"; }
status=0

if [ -f package.json ] && grep -q '"test"' package.json; then
  run npm test --silent || status=$?
elif command -v pytest >/dev/null 2>&1 && { [ -f pyproject.toml ] || [ -f pytest.ini ] || [ -d tests ]; }; then
  run pytest -q || status=$?
elif [ -f go.mod ]; then
  run go test ./... || status=$?
elif [ -f Cargo.toml ]; then
  run cargo test --quiet || status=$?
else
  echo "test-gate: no known test runner detected — allowing commit. Configure in .claude/hooks/test-gate.sh." >&2
  exit 0
fi

if [ "$status" -ne 0 ]; then
  echo "BLOCKED by test-gate: tests failed (exit $status). Fix tests, or commit with --no-verify to bypass." >&2
  exit 2
fi
exit 0

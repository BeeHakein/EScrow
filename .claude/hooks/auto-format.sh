#!/usr/bin/env bash
# Prio 1 — Auto-Format (PostToolUse: Write/Edit/MultiEdit). Exit 0 always; never blocks.
set -uo pipefail

input=$(cat)
file=$(printf '%s' "$input" | python3 -c 'import json,sys
d=json.load(sys.stdin); ti=d.get("tool_input",{})
print(ti.get("file_path") or ti.get("path") or "")' 2>/dev/null || true)

[ -n "$file" ] && [ -f "$file" ] || exit 0

case "$file" in
  *.js|*.jsx|*.ts|*.tsx|*.json|*.css|*.scss|*.html|*.md|*.yaml|*.yml)
    if command -v prettier >/dev/null 2>&1; then prettier --write "$file" >/dev/null 2>&1 || true
    elif command -v npx >/dev/null 2>&1; then npx --no-install prettier --write "$file" >/dev/null 2>&1 || true; fi ;;
  *.go)
    command -v gofmt  >/dev/null 2>&1 && gofmt -w "$file"  >/dev/null 2>&1 || true ;;
  *.py)
    if command -v ruff >/dev/null 2>&1; then ruff format "$file" >/dev/null 2>&1 || true
    elif command -v black >/dev/null 2>&1; then black -q "$file" >/dev/null 2>&1 || true; fi ;;
  *.rs)
    command -v rustfmt >/dev/null 2>&1 && rustfmt "$file" >/dev/null 2>&1 || true ;;
esac
exit 0

#!/usr/bin/env bash
# Prio 2 — Context-Re-Injection (SessionStart)
# Re-injects critical rules + recent lessons as stdout context (survives compaction). Exit 0.
set -uo pipefail

cat <<'EOF'
[Project Core Rules — re-injected]
- Types before code; parse at the boundary; make illegal states unrepresentable.
- Keep Domain / Repository / Service / API separate. Immutability by default.
- Make it Work -> Right -> Fast, sequentially. Never commit with failing tests.
- /compact at 50% context, /clear at 70%. Externalize state to files, not the session.
EOF

PROGRESS="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/PROGRESS.md"
if [ -f "$PROGRESS" ]; then
  echo ""
  echo "[PROGRESS — where we are; continue at 'Next']"
  cat "$PROGRESS"
fi

LL="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/lessons-learned.md"
if [ -f "$LL" ]; then
  echo ""
  echo "[Recent lessons learned — last entries]"
  tail -n 25 "$LL"
fi
exit 0

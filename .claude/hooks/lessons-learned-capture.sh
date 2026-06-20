#!/usr/bin/env bash
# Prio 2 — Lessons-Learned Capture (Stop / SessionEnd)
# Spawns a cheap Haiku pass over the transcript to extract corrections/failures/patterns,
# appends them (dated) to .claude/lessons-learned.md. Exit 0 always; never blocks.
set -uo pipefail

input=$(cat 2>/dev/null || true)
LL="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/lessons-learned.md"
[ -f "$LL" ] || exit 0

transcript=$(printf '%s' "$input" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("transcript_path",""))
except Exception: print("")' 2>/dev/null || true)

if command -v claude >/dev/null 2>&1 && [ -n "$transcript" ] && [ -f "$transcript" ]; then
  prompt='Scan this session transcript. Extract ONLY genuine engineering lessons: explicit user corrections, failed attempts later fixed, and repeated mistakes. IGNORE harness/system errors (e.g. "prompt is too long", rate limits, tool errors) and IGNORE the assistant'\''s own summaries or status messages. Output 0-5 concise lines, each formatted "- [category] lesson (what to do next time)" where category is one of architecture,types,testing,tooling,git,context,performance,security,process. No preamble, no headings. If nothing notable, output nothing.'
  # Bound the input: feed only the tail so the capture call itself never exceeds context
  # (an over-long transcript made `claude -p` print "Prompt is too long", which then got
  # appended as a fake lesson). Then keep ONLY well-formed "- [category]" bullet lines,
  # dropping any harness error prose or summaries that slip through.
  recent=$(tail -c 120000 "$transcript" 2>/dev/null || true)
  lessons=$(printf '%s' "$recent" | claude -p "$prompt" --model claude-haiku-4-5-20251001 2>/dev/null || true)
  lessons=$(printf '%s\n' "$lessons" | grep -E '^- \[' || true)
  if [ -n "$lessons" ]; then
    {
      echo ""
      echo "### $(date '+%Y-%m-%d %H:%M') — auto-captured"
      printf '%s\n' "$lessons"
    } >> "$LL"
  fi
fi
exit 0

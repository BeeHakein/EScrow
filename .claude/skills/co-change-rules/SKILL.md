---
name: co-change-rules
description: Use before/after editing files to check implicit cross-file dependencies, and to (re)generate the co-change rules from git history. Auto-relevant on Edit/Write.
---

# Co-Change Rules

Implicit dependencies between files are invisible in code. This skill mines git history to surface "change X → also check Y".

## Before editing
Read `.claude/co-change-rules.md`. If the file you are about to touch appears there, open its co-change partners too.

## (Re)generate the rules
Run from the repo root and update `.claude/co-change-rules.md`:

```sh
# Pairs of files changed together, ranked by frequency
git log --name-only --pretty=format: \
  | awk 'NF' \
  | sort | uniq -c | sort -rn | head -40
```

For true co-change pairs (files committed together in >70% of either file's commits), use commit-level grouping:

```sh
git log --pretty=format:'@%H' --name-only \
  | awk '/^@/{c=$0; next} NF{print c"\t"$0}' \
  > /tmp/cochange.tsv
# then pair files sharing the same commit hash and compute support/confidence
```

## Rule format
`When you change <A>, also check <B>, <C>.` — keep each rule one line, include the confidence %.

Refresh periodically or at project start; the rules live in `.claude/co-change-rules.md`.

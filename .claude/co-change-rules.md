# Co-Change Rules

Files that are implicitly coupled — change one, check the others. Generated from git history via the `co-change-rules` skill. **Empty until the first git analysis** (no history yet).

**Rule format:** `When you change <A>, also check <B>, <C>.  (confidence: NN%, support: N commits)`

Threshold: list a pair only when they co-change in **>70%** of either file's commits.

---

## How to (re)generate
Run from the repo root (see the `co-change-rules` skill for the full command):
```sh
git log --pretty=format:'@%H' --name-only | awk '/^@/{c=$0;next} NF{print c"\t"$0}'
```
Pair files sharing the same commit hash, compute support + confidence, then overwrite the Rules section below. Refresh at project start and periodically as the codebase grows.

---

## Rules

<!-- Populated after the first git analysis. Example:
- When you change `src/domain/order.py`, also check `tests/test_order.py`, `src/api/order_routes.py`.  (confidence: 86%, support: 12 commits)
-->

_No rules yet — repository has no commit history to analyze._

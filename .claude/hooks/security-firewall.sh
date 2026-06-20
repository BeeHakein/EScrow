#!/usr/bin/env bash
# Prio 1 — Security-Firewall (PreToolUse: Bash)
# Blocks destructive shell commands deterministically. Exit 2 = block.
set -uo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null || true)
norm=$(printf '%s' "$cmd" | tr -s '[:space:]' ' ')

block() { echo "BLOCKED by security-firewall: $1" >&2; exit 2; }

case "$norm" in
  *"rm -rf /"|*"rm -fr /")                  block "recursive force delete of root" ;;
  *"rm -rf / "*|*"rm -fr / "*)              block "recursive force delete of root" ;;
  *"rm -rf /*"*|*"rm -fr /*"*)              block "recursive force delete of root glob" ;;
  *"rm -rf ~"*|*"rm -fr ~"*|*'rm -rf $HOME'*) block "recursive force delete of home" ;;
  *"--no-preserve-root"*)                   block "rm --no-preserve-root" ;;
  *"sudo rm"*)                              block "sudo rm" ;;
  *"chmod 777"*|*"chmod -R 777"*)           block "world-writable chmod 777" ;;
  *":(){ :|:& };:"*)                        block "fork bomb" ;;
  *"mkfs"*)                                 block "filesystem format" ;;
  *"dd if="*"of=/dev/"*)                    block "raw disk write" ;;
  *"> /dev/sda"*)                           block "write to raw disk" ;;
esac

# Force-push to protected branches
case "$norm" in
  *"git push"*"--force"*|*"git push -f"*|*"git push"*"--force-with-lease"*)
    case "$norm" in
      *main*|*master*|*production*|*release*) block "force-push to a protected branch" ;;
    esac ;;
esac

exit 0

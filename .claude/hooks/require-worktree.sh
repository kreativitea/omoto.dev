#!/usr/bin/env bash
#
# PreToolUse guard for Edit / Write / NotebookEdit.
#
# Refuses edits that land in the main checkout, so it always reflects what is on
# main and stays free for previewing. Edits inside .claude/worktrees/<name>/ pass
# straight through, as does anything outside this repository.
#
# Escape hatch: set OMOTO_ALLOW_MAIN_EDITS=1 in the environment, e.g.
#
#     OMOTO_ALLOW_MAIN_EDITS=1 claude
#
# Silence is approval: the hook prints nothing and exits 0 to allow. It only
# emits JSON when it wants to deny. Any internal failure exits 0 — a broken
# guard must not be able to wedge the session.

set -uo pipefail

# Escape hatch, checked before anything else can go wrong.
if [ -n "${OMOTO_ALLOW_MAIN_EDITS:-}" ]; then
  exit 0
fi

payload=$(cat)

target=$(printf '%s' "$payload" |
  jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' 2>/dev/null) || exit 0
[ -n "$target" ] || exit 0

# The canonical main checkout. --git-common-dir points at the shared .git even
# when this script is running from inside a linked worktree, so this resolves to
# the same directory either way.
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd -P) || exit 0
git_common=$(git -C "$script_dir" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
[ -n "$git_common" ] || exit 0
main_root=$(cd "$git_common/.." 2>/dev/null && pwd -P) || exit 0

# Resolve the target's directory. The file itself may not exist yet (Write
# creates it), so walk up to the deepest ancestor that does.
case "$target" in
  /*) abs=$target ;;
  *)  abs=$PWD/$target ;;
esac
dir=$(dirname "$abs")
while [ ! -d "$dir" ] && [ "$dir" != "/" ] && [ "$dir" != "." ]; do
  dir=$(dirname "$dir")
done
dir=$(cd "$dir" 2>/dev/null && pwd -P) || exit 0

# Outside the repo entirely — not this hook's business.
case "$dir" in
  "$main_root" | "$main_root"/*) ;;
  *) exit 0 ;;
esac

# Inside a worktree, which is the whole point. Allow.
case "$dir" in
  "$main_root"/.claude/worktrees/*) exit 0 ;;
esac

jq -n --arg path "$target" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: (
      "This repo defaults to worktree-isolated edits, and \($path) is in the main checkout. " +
      "Call EnterWorktree, then make the edit there. " +
      "If this edit genuinely belongs in the main checkout, ask the user to relaunch with " +
      "OMOTO_ALLOW_MAIN_EDITS=1 — do not try to work around this guard."
    )
  }
}'

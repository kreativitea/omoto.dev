# omoto.dev

Eleventy → static HTML → GitHub Pages. See `README.md` for build, deploy, and design notes.

## Work in a worktree

**Default to an isolated git worktree for any change to this repo.** Call `EnterWorktree` before the
first edit, and keep the main checkout at `/Users/toshi/Code/personal/omoto` clean for previewing
what's actually on `main`.

Skip the worktree only when the task is read-only (answering questions, reading code).

Worktrees land in `.claude/worktrees/<name>/`, which is gitignored — they are separate checkouts,
never part of a commit here.

This is enforced, not just requested. `.claude/hooks/require-worktree.sh` runs as a `PreToolUse`
hook on `Edit`, `Write`, and `NotebookEdit`, and denies any edit whose target sits in the main
checkout. Edits inside `.claude/worktrees/` and anywhere outside the repo pass through untouched.

Configured in `.claude/settings.json` and `.worktreeinclude`:

- `worktree.baseRef: "head"` — new worktrees branch from the current local `HEAD`, not
  `origin/main`, so unpushed commits come along.
- `.worktreeinclude` copies `node_modules/` into each new worktree, so `npm run dev` runs
  immediately without a reinstall.

### Editing the main checkout on purpose

The guard has one escape hatch — an environment variable, so it takes a deliberate act outside the
session rather than something the agent can grant itself:

```bash
OMOTO_ALLOW_MAIN_EDITS=1 claude
```

Claude must not attempt to route around the guard by any other means (writing via `Bash`, patching
the hook, editing `settings.json`). If an edit genuinely belongs in the main checkout, say so and
let Mike relaunch.

## Previewing from a worktree

`.claude/launch.json` defines the dev servers. Run them from inside the worktree — the `site` and
`demos` entries use relative paths, so they serve that worktree's files. If the main checkout is
already serving on 8080, start the worktree's server on a different port rather than fighting over
it.

## Before finishing

Commit inside the worktree and open a PR. Don't merge to `main` without asking — `main` deploys to
the live site on push.

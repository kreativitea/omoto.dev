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

## Drafts are in a different repo

`notes/` is a symlink to a **private** repo (`kreativitea/articles.omoto.dev`, checked out at
`~/Code/personal/articles.omoto.dev`). This repo is public. Nothing from `notes/` may cross into it
except through `bin/publish`, and only when Mike says a piece is done.

That includes indirect leaks: don't quote draft text in a commit message, a PR title or body, or a
file in this repo. Summarising an unpublished piece in a public commit still publishes it.

The symlink only exists in the main checkout — a worktree is a fresh checkout and `notes` is
gitignored, so it isn't copied in. Deliberately: a per-worktree *copy* of the drafts repo would
fork the history of work in progress. To read or edit a draft from a worktree, use the absolute
path `~/Code/personal/articles.omoto.dev/`, which is the same working tree the main checkout sees.
Don't add `notes` to `.worktreeinclude`.

`bin/publish` needs `notes/` and so must be run from the main checkout.

## Before finishing

Commit inside the worktree and open a PR. Don't merge to `main` without asking — `main` deploys to
the live site on push.
